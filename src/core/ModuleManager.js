// src/core/ModuleManager.js - BotCommandsRegistry 통합된 표준화된 콜백 처리

const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

// ⭐ BotCommandsRegistry 참조 추가
const botCommandsRegistry = require("../config/BotCommandsRegistry");

class ModuleManager {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.db = options.dbManager || null;
    this.moduleInstances = new Map();
    this.isInitialized = false;

    // ⭐ BotCommandsRegistry 인스턴스 참조
    this.commandsRegistry = options.commandsRegistry || botCommandsRegistry;

    // 중복 처리 방지
    this.processingCallbacks = new Set();
    this.processingMessages = new Set();

    // ⭐ Registry 기반 모듈 레지스트리 (동적 생성)
    this.moduleRegistry = this.buildModuleRegistry();

    logger.info("🔧 ModuleManager 생성됨");
  }

  /**
   * ⭐ BotCommandsRegistry 기반 모듈 레지스트리 생성
   */
  buildModuleRegistry() {
    const registry = {};

    // CommandsRegistry에서 모듈 정보 추출
    for (const [commandName, commandConfig] of this.commandsRegistry
      .moduleCommands) {
      const moduleName = commandConfig.module;
      const moduleKey = commandName; // leave, todo, timer 등

      registry[moduleKey] = {
        class: moduleName,
        path: `../modules/${moduleName}`,
        command: commandName,
        description: commandConfig.description,
        category: commandConfig.category,
        quickActions: commandConfig.quickActions || [],
      };
    }

    // 시스템 모듈 추가
    registry.system = {
      class: "SystemModule",
      path: "../modules/SystemModule",
      command: "system",
      description: "시스템 관리",
      category: "system",
    };

    logger.info(`📋 ${Object.keys(registry).length}개 모듈 레지스트리 구성`);
    return registry;
  }

  async initialize() {
    if (this.isInitialized) {
      logger.warn("ModuleManager 이미 초기화됨");
      return;
    }

    try {
      logger.info("⚙️ ModuleManager 초기화 시작...");
      await this.loadModules();
      this.isInitialized = true;
      logger.success(
        `✅ ModuleManager 초기화 완료 (${this.moduleInstances.size}개 모듈)`
      );
    } catch (error) {
      logger.error("❌ ModuleManager 초기화 실패:", error);
      throw error;
    }
  }

  async loadModules() {
    for (const [key, config] of Object.entries(this.moduleRegistry)) {
      try {
        const ModuleClass = require(config.path);
        const moduleInstance = new ModuleClass(this.bot, {
          dbManager: this.db,
          moduleManager: this, // 자신의 참조 전달
          // ⭐ CommandsRegistry 정보 전달
          commandConfig: this.commandsRegistry.moduleCommands.get(key),
          commandsRegistry: this.commandsRegistry,
        });

        // 모듈 초기화
        if (moduleInstance.initialize) {
          await moduleInstance.initialize();
        }

        this.moduleInstances.set(config.class, moduleInstance);
        logger.debug(`✅ ${config.class} 로드 완료`);
      } catch (error) {
        logger.error(`❌ ${config.class} 로드 실패:`, error);
      }
    }
  }

  /**
   * ⭐ 명령어 처리 (Registry 기반)
   */
  async handleCommand(bot, msg, commandName) {
    try {
      const messageKey = `${msg.from.id}-${msg.message_id}`;

      // 중복 처리 방지
      if (this.processingMessages.has(messageKey)) {
        return false;
      }
      this.processingMessages.add(messageKey);

      // Registry에서 명령어 정보 조회
      const commandConfig = this.commandsRegistry.findCommand(commandName);

      if (!commandConfig || !commandConfig.module) {
        logger.warn(`처리할 수 없는 명령어: ${commandName}`);
        return false;
      }

      // 모듈 찾기
      const moduleInstance = this.moduleInstances.get(commandConfig.module);

      if (!moduleInstance) {
        logger.error(`모듈 인스턴스를 찾을 수 없음: ${commandConfig.module}`);
        return false;
      }

      // 모듈의 handleMessage 호출
      let handled = false;
      if (moduleInstance.handleMessage) {
        handled = await moduleInstance.handleMessage(bot, msg);
      }

      // 처리되지 않은 경우 기본 메뉴 표시
      if (!handled && moduleInstance.showMenu) {
        const fakeCallback = {
          message: { chat: msg.chat, message_id: null },
          from: msg.from,
        };
        await moduleInstance.showMenu(bot, fakeCallback, [], this);
        handled = true;
      }

      logger.debug(
        `🎯 명령어 ${commandName} 처리 결과: ${handled ? "성공" : "실패"}`
      );
      return handled;
    } catch (error) {
      logger.error(`명령어 처리 실패 [${commandName}]:`, error);
      return false;
    } finally {
      // 처리 완료 후 제거
      setTimeout(() => {
        const messageKey = `${msg.from.id}-${msg.message_id}`;
        this.processingMessages.delete(messageKey);
      }, 5000);
    }
  }

  /**
   * 중앙 콜백 처리 (표준 매개변수 사용)
   */
  async handleCallback(callbackQuery) {
    const callbackData = callbackQuery.data;
    const callbackKey = `${callbackQuery.from.id}-${callbackData}`;

    // 중복 처리 방지
    if (this.processingCallbacks.has(callbackKey)) {
      logger.debug("🔁 중복 콜백 무시:", callbackData);
      return false;
    }

    this.processingCallbacks.add(callbackKey);

    try {
      logger.info(`📨 콜백 데이터 수신: ${callbackData}`);

      // ⭐ 메인 메뉴 특별 처리
      if (callbackData === "main:menu") {
        return await this.handleMainMenu(callbackQuery);
      }

      // 콜백 데이터 파싱 (형식: "module:action:param1:param2")
      const [targetModule, subAction, ...params] = callbackData.split(":");

      // 파싱 검증
      if (!targetModule) {
        logger.warn(`⚠️ 잘못된 콜백 형식: ${callbackData}`);
        await this.sendErrorMessage(callbackQuery);
        return false;
      }

      // ⭐ Registry를 통한 모듈 유효성 검증
      const isValidModule = this.isValidModuleCallback(targetModule);
      if (!isValidModule) {
        logger.warn(`⚠️ 등록되지 않은 모듈: ${targetModule}`);
        await this.sendModuleNotFoundMessage(callbackQuery);
        return false;
      }

      logger.info(`🔔 콜백 라우팅: ${targetModule} → ${subAction || "menu"}`);

      // 특별 처리: main:menu는 system 모듈로 라우팅
      const moduleKey = targetModule === "main" ? "system" : targetModule;

      // 모듈 찾기
      const moduleClass = this.findModuleClass(moduleKey);
      if (!moduleClass) {
        logger.warn(`모듈을 찾을 수 없음: ${moduleKey}`);
        await this.sendModuleNotFoundMessage(callbackQuery);
        return false;
      }

      const module = this.moduleInstances.get(moduleClass);
      if (!module) {
        logger.error(`모듈 인스턴스가 없음: ${moduleClass}`);
        return false;
      }

      // 모듈의 handleCallback 호출 (표준 매개변수 전달)
      const handled = await module.handleCallback(
        this.bot,
        callbackQuery,
        subAction || "menu", // 기본값 "menu"
        params,
        this
      );

      if (handled) {
        logger.debug(`✅ ${moduleClass}에서 콜백 처리 완료`);
      } else {
        logger.warn(`❌ ${moduleClass}에서 콜백 처리 실패`);
      }

      return handled;
    } catch (error) {
      logger.error("콜백 처리 중 오류:", error);
      await this.sendErrorMessage(callbackQuery);
      return false;
    } finally {
      // 처리 완료 후 제거
      setTimeout(() => {
        this.processingCallbacks.delete(callbackKey);
      }, 1000);
    }
  }

  /**
   * ⭐ Registry 기반 모듈 유효성 검증
   */
  isValidModuleCallback(moduleKey) {
    // 시스템 모듈들
    const systemModules = ["main", "system", "help", "admin"];
    if (systemModules.includes(moduleKey)) {
      return true;
    }

    // Registry에 등록된 모듈들
    return this.commandsRegistry.moduleCommands.has(moduleKey);
  }

  /**
   * 메시지 핸들러 (모든 모듈에 전달)
   */
  async handleMessage(bot, msg) {
    try {
      // ⭐ Registry 기반 모듈 순서 결정
      const moduleOrder = this.getModuleProcessingOrder();

      for (const moduleKey of moduleOrder) {
        const moduleClass = this.moduleRegistry[moduleKey]?.class;
        if (!moduleClass) continue;

        const module = this.moduleInstances.get(moduleClass);
        if (module && module.handleMessage) {
          try {
            const handled = await module.handleMessage(bot, msg);
            if (handled) {
              logger.debug(`📬 메시지가 ${moduleClass}에서 처리됨`);
              return true;
            }
          } catch (error) {
            logger.error(`${moduleClass} 메시지 처리 오류:`, error);
          }
        }
      }

      return false;
    } catch (error) {
      logger.error("메시지 처리 중 전체 오류:", error);
      return false;
    }
  }

  /**
   * ⭐ Registry 기반 모듈 처리 순서 결정
   */
  getModuleProcessingOrder() {
    // 카테고리별 우선순위 정의
    const categoryPriority = {
      system: 1,
      productivity: 2,
      work: 3,
      entertainment: 4,
      info: 5,
      tools: 6,
      business: 7,
    };

    // Registry에서 모듈 정보 가져와서 우선순위 정렬
    const modules = Object.keys(this.moduleRegistry);

    return modules.sort((a, b) => {
      const configA = this.commandsRegistry.moduleCommands.get(a);
      const configB = this.commandsRegistry.moduleCommands.get(b);

      const priorityA = categoryPriority[configA?.category] || 999;
      const priorityB = categoryPriority[configB?.category] || 999;

      return priorityA - priorityB;
    });
  }

  /**
   * 🏠 메인 메뉴 처리 (Registry 기반 동적 생성)
   */
  async handleMainMenu(callbackQuery) {
    try {
      const keyboard = this.createMainMenuKeyboard();
      const userName = getUserName(callbackQuery.from);

      const stats = this.commandsRegistry.getCommandStats();

      const menuText = `🏠 **메인 메뉴**

안녕하세요 ${userName}님!
무엇을 도와드릴까요?

📋 **사용 가능한 기능**: ${stats.moduleCommands}개`;

      await this.bot.editMessageText(menuText, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("❌ 메인 메뉴 처리 오류:", error);
      return false;
    }
  }

  /**
   * ⭐ Registry 기반 동적 메인 메뉴 키보드 생성
   */
  createMainMenuKeyboard() {
    const keyboard = { inline_keyboard: [] };

    // Registry에서 공개 모듈 명령어 가져오기
    const publicModules = Array.from(
      this.commandsRegistry.moduleCommands.values()
    )
      .filter((cmd) => cmd.isPublic)
      .sort((a, b) => {
        // 카테고리별 정렬
        const categoryOrder = {
          work: 1,
          productivity: 2,
          entertainment: 3,
          info: 4,
          tools: 5,
        };
        return (
          (categoryOrder[a.category] || 999) -
          (categoryOrder[b.category] || 999)
        );
      });

    // 주요 모듈들 (2개씩 한 줄)
    const mainModules = publicModules.slice(0, 8); // 최대 8개

    for (let i = 0; i < mainModules.length; i += 2) {
      const row = [];

      const module1 = mainModules[i];
      if (module1) {
        row.push({
          text: `${this.getModuleEmoji(module1.command)} ${this.getModuleName(
            module1.command
          )}`,
          callback_data: `${module1.command}:menu`,
        });
      }

      const module2 = mainModules[i + 1];
      if (module2) {
        row.push({
          text: `${this.getModuleEmoji(module2.command)} ${this.getModuleName(
            module2.command
          )}`,
          callback_data: `${module2.command}:menu`,
        });
      }

      keyboard.inline_keyboard.push(row);
    }

    // 시스템 메뉴
    keyboard.inline_keyboard.push([
      { text: "❓ 도움말", callback_data: "system:help" },
      { text: "📊 상태", callback_data: "system:status" },
    ]);

    return keyboard;
  }

  /**
   * 모듈 이모지 매핑
   */
  getModuleEmoji(command) {
    const emojiMap = {
      leave: "🏖️",
      todo: "📝",
      timer: "⏰",
      weather: "🌤️",
      fortune: "🔮",
      worktime: "💼",
      utils: "🛠️",
      insight: "📊",
    };
    return emojiMap[command] || "📦";
  }

  /**
   * 모듈 이름 매핑
   */
  getModuleName(command) {
    const nameMap = {
      leave: "휴가 관리",
      todo: "할일 관리",
      timer: "타이머",
      weather: "날씨",
      fortune: "운세",
      worktime: "근무시간",
      utils: "유틸리티",
      insight: "인사이트",
    };
    return nameMap[command] || command;
  }

  /**
   * 모듈 클래스 이름 찾기
   */
  findModuleClass(moduleKey) {
    return this.moduleRegistry[moduleKey]?.class || null;
  }

  /**
   * ⭐ 사용자 액션 취소 (Registry 기반)
   */
  async cancelUserAction(userId) {
    try {
      // 모든 모듈에 취소 알림
      for (const [moduleClass, moduleInstance] of this.moduleInstances) {
        if (moduleInstance.clearUserState) {
          await moduleInstance.clearUserState(userId);
        }
      }

      logger.info(`🚫 사용자 ${userId} 액션 취소 완료`);
      return true;
    } catch (error) {
      logger.error("사용자 액션 취소 실패:", error);
      return false;
    }
  }

  /**
   * ⭐ Registry 기반 사용 가능한 모듈 목록 조회
   */
  getAvailableModules() {
    return Array.from(this.commandsRegistry.moduleCommands.values())
      .filter((cmd) => cmd.isPublic)
      .map((cmd) => ({
        command: cmd.command,
        description: cmd.description,
        category: cmd.category,
        emoji: this.getModuleEmoji(cmd.command),
        name: this.getModuleName(cmd.command),
        quickActions: cmd.quickActions || [],
      }));
  }

  /**
   * ⭐ 특정 모듈의 도움말 조회
   */
  async getModuleHelp(moduleName) {
    try {
      // Registry에서 모듈 정보 조회
      const moduleConfig = this.commandsRegistry.moduleCommands.get(moduleName);

      if (!moduleConfig) {
        return null;
      }

      // 특별한 도움말 처리 (LeaveModule)
      if (moduleName === "leave") {
        return this.commandsRegistry.generateLeaveHelpText();
      }

      // 일반 모듈 도움말 생성
      let helpText = `📖 **${moduleConfig.description}**\n\n`;
      helpText += `**명령어**: /${moduleConfig.command}\n`;
      helpText += `**카테고리**: ${moduleConfig.category}\n`;

      if (moduleConfig.quickActions && moduleConfig.quickActions.length > 0) {
        helpText += `**빠른 액션**: ${moduleConfig.quickActions.join(", ")}\n`;
      }

      return helpText;
    } catch (error) {
      logger.error(`모듈 도움말 조회 실패 [${moduleName}]:`, error);
      return null;
    }
  }

  /**
   * 모듈을 찾을 수 없을 때 메시지
   */
  async sendModuleNotFoundMessage(callbackQuery) {
    try {
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: "⚠️ 해당 기능을 찾을 수 없습니다.",
        show_alert: false,
      });

      if (callbackQuery.message) {
        const availableCount =
          this.commandsRegistry.getCommandStats().moduleCommands;

        await this.bot.editMessageText(
          `⚠️ **기능을 찾을 수 없음**\n\n요청하신 기능이 현재 비활성화되어 있거나 존재하지 않습니다.\n\n📋 현재 ${availableCount}개의 기능이 사용 가능합니다.`,
          {
            chat_id: callbackQuery.message.chat.id,
            message_id: callbackQuery.message.message_id,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
                [{ text: "❓ 도움말", callback_data: "system:help" }],
              ],
            },
          }
        );
      }
    } catch (error) {
      logger.error("모듈 없음 메시지 전송 실패:", error);
    }
  }

  /**
   * 에러 메시지 전송
   */
  async sendErrorMessage(callbackQuery) {
    try {
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ 처리 중 오류가 발생했습니다.",
        show_alert: true,
      });

      if (callbackQuery.message) {
        await this.bot.editMessageText(
          "❌ **오류 발생**\n\n처리 중 문제가 발생했습니다.\n잠시 후 다시 시도해주세요.",
          {
            chat_id: callbackQuery.message.chat.id,
            message_id: callbackQuery.message.message_id,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
              ],
            },
          }
        );
      }
    } catch (error) {
      logger.error("에러 메시지 전송 실패:", error);
    }
  }

  /**
   * ⭐ Registry 기반 모듈 상태 조회
   */
  getStatus() {
    const registryStats = this.commandsRegistry.getCommandStats();

    return {
      initialized: this.isInitialized,
      loadedModules: this.moduleInstances.size,
      registeredCommands: registryStats.moduleCommands,
      totalCommands: registryStats.totalCommands,
      publicCommands: registryStats.publicCommands,
      modules: Array.from(this.moduleInstances.keys()),
      processingCallbacks: this.processingCallbacks.size,
      processingMessages: this.processingMessages.size,
    };
  }

  /**
   * 정리 작업
   */
  async cleanup() {
    try {
      logger.info("🧹 ModuleManager 정리 시작...");

      // 모든 모듈 정리
      for (const [moduleClass, moduleInstance] of this.moduleInstances) {
        if (moduleInstance.cleanup) {
          await moduleInstance.cleanup();
        }
      }

      // 처리 중인 작업 정리
      this.processingCallbacks.clear();
      this.processingMessages.clear();

      logger.info("✅ ModuleManager 정리 완료");
    } catch (error) {
      logger.error("❌ ModuleManager 정리 중 오류:", error);
    }
  }
}

module.exports = ModuleManager;
