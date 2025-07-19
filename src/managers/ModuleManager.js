// src/managers/ModuleManager.js - 완전한 ModuleManager 구현

const Logger = require("../utils/Logger");
const AppConfig = require("../config/AppConfig");

class ModuleManager {
  constructor(bot = null, options = {}) {
    this.bot = bot;
    this.modules = new Map();
    this.dbManager = options.dbManager;
    this.userStates = options.userStates || new Map();
    this.isInitialized = false;

    // ⭐ 강화된 중복 처리 방지 시스템
    this.processingCallbacks = new Set(); // 사용자별 + 콜백별 중복 방지
    this.processingMessages = new Set(); // 메시지 중복 방지
    this.callbackTimeout = 5000; // 5초 후 자동 해제
    this.messageTimeout = 3000; // 3초 후 자동 해제

    // ⭐ 성능 모니터링
    this.stats = {
      totalCallbacks: 0,
      duplicateCallbacks: 0,
      totalMessages: 0,
      duplicateMessages: 0,
      errors: 0,
    };

    Logger.info("🔧 ModuleManager 생성됨 (중복 방지 시스템 활성화)");
  }

  // ⭐ 초기화 메서드 (누락된 메서드 추가)
  async initialize() {
    if (this.isInitialized) {
      Logger.warn("ModuleManager 이미 초기화됨");
      return;
    }

    try {
      Logger.info("⚙️ ModuleManager 초기화 시작...");

      // 모듈 로드 및 초기화
      await this.loadModules();
      await this.initializeModules();

      this.isInitialized = true;
      Logger.success(
        `✅ ModuleManager 초기화 완료 (${this.modules.size}개 모듈)`
      );
    } catch (error) {
      Logger.error("❌ ModuleManager 초기화 실패:", error);
      throw error;
    }
  }

  // ⭐ 모듈 로드
  async loadModules() {
    const moduleConfigs = this.getModuleConfigs();

    for (const [moduleName, config] of Object.entries(moduleConfigs)) {
      try {
        if (!config.enabled) {
          Logger.info(`⏸️ 모듈 ${moduleName} 비활성화됨`);
          continue;
        }

        await this.loadModule(moduleName, config);
      } catch (error) {
        Logger.error(`❌ 모듈 ${moduleName} 로드 실패:`, error);
        if (config.required) {
          throw new Error(`필수 모듈 ${moduleName} 로드 실패`);
        }
      }
    }
  }

  // ⭐ 개별 모듈 로드
  async loadModule(moduleName, config) {
    try {
      Logger.info(`📦 모듈 ${moduleName} 로드 중...`);

      let ModuleClass;
      try {
        ModuleClass = require(config.path);
      } catch (requireError) {
        Logger.warn(`⚠️ 모듈 파일을 찾을 수 없음: ${config.path}`);
        // 기본 모듈 클래스 생성
        ModuleClass = this.createDefaultModule(moduleName);
      }

      const moduleInstance = new ModuleClass();

      this.modules.set(moduleName, {
        instance: moduleInstance,
        config: config,
        status: "loaded",
        loadTime: new Date(),
      });

      Logger.success(`✅ 모듈 ${moduleName} 로드 완료`);
    } catch (error) {
      Logger.error(`❌ 모듈 ${moduleName} 로드 실패:`, error);
      throw error;
    }
  }

  // ⭐ 모듈 초기화
  async initializeModules() {
    for (const [moduleName, moduleData] of this.modules.entries()) {
      try {
        Logger.info(`🔧 모듈 ${moduleName} 초기화 중...`);

        const instance = moduleData.instance;
        if (instance.initialize) {
          await instance.initialize();
        }

        moduleData.status = "initialized";
        Logger.success(`✅ 모듈 ${moduleName} 초기화 완료`);
      } catch (error) {
        Logger.error(`❌ 모듈 ${moduleName} 초기화 실패:`, error);
        moduleData.status = "error";
      }
    }
  }

  // ⭐ 기본 모듈 설정 (ModuleConfig 대신 직접 정의)
  getModuleConfigs() {
    return {
      TodoModule: {
        enabled: true,
        priority: 1,
        required: false,
        path: "../modules/TodoModule",
        description: "할일 관리",
      },
      FortuneModule: {
        enabled: true,
        priority: 2,
        required: false,
        path: "../modules/FortuneModule",
        description: "운세",
      },
      WeatherModule: {
        enabled: true,
        priority: 3,
        required: false,
        path: "../modules/WeatherModule",
        description: "날씨",
      },
      TimerModule: {
        enabled: true,
        priority: 4,
        required: false,
        path: "../modules/TimerModule",
        description: "타이머",
      },
      LeaveModule: {
        enabled: true,
        priority: 5,
        required: false,
        path: "../modules/LeaveModule",
        description: "휴가 관리",
      },
      UtilsModule: {
        enabled: true,
        priority: 6,
        required: false,
        path: "../modules/UtilsModule",
        description: "유틸리티",
      },
    };
  }

  // ⭐ 기본 모듈 클래스 생성 (파일이 없을 때)
  createDefaultModule(moduleName) {
    return class DefaultModule {
      constructor() {
        this.name = moduleName;
        this.moduleName = moduleName.replace("Module", "").toLowerCase();
      }

      async initialize() {
        Logger.info(`🔧 기본 모듈 ${this.name} 초기화됨`);
      }

      async handleMessage(bot, msg) {
        return false;
      }

      async handleCallback(bot, callbackQuery, subAction, params, menuManager) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;

        const text = `🔧 **${this.name}**\n\n준비 중입니다...`;

        try {
          await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
              ],
            },
          });
        } catch (error) {
          Logger.error(`기본 모듈 ${this.name} 응답 실패:`, error);
        }

        return true;
      }

      canHandleCommand(command) {
        return false;
      }

      canHandleCallback(callbackData) {
        const prefix = callbackData.split("_")[0];
        return prefix === this.moduleName;
      }
    };
  }

  // ⭐ 콜백 처리 - 강화된 중복 방지 로직
  async handleCallback(bot, callbackQuery) {
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;
    const callbackId = `${userId}_${data}_${Date.now()}`;

    // ⭐ 사용자별 + 데이터별 고유 키 생성
    const userCallbackKey = `${userId}_${data}`;
    const globalCallbackKey = data;

    // ⭐ 이중 중복 방지 (사용자별 + 전역)
    if (
      this.processingCallbacks.has(userCallbackKey) ||
      this.processingCallbacks.has(globalCallbackKey)
    ) {
      Logger.warn(`중복 콜백 무시: ${data} (사용자: ${userId})`);
      try {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "⏳ 처리 중입니다... 잠시만 기다려주세요.",
          show_alert: false,
        });
      } catch (error) {
        Logger.debug("콜백 응답 실패 (이미 응답됨)");
      }
      return false;
    }

    // ⭐ 처리 중 플래그 설정 (사용자별 + 전역)
    this.processingCallbacks.add(userCallbackKey);
    this.processingCallbacks.add(globalCallbackKey);

    // ⭐ 자동 해제 타이머 (메모리 누수 방지)
    const timeoutId = setTimeout(() => {
      this.processingCallbacks.delete(userCallbackKey);
      this.processingCallbacks.delete(globalCallbackKey);
      Logger.debug(`콜백 처리 타임아웃 해제: ${data} (사용자: ${userId})`);
    }, this.callbackTimeout);

    try {
      // ⭐ 콜백 쿼리 응답 (한 번만!)
      try {
        await bot.answerCallbackQuery(callbackQuery.id);
        Logger.debug(`콜백 응답 완료: ${data}`);
      } catch (error) {
        Logger.debug("콜백 쿼리 응답 실패 (이미 응답됨 또는 만료됨)");
      }

      Logger.info(`📞 콜백 처리 시작: ${data}`, {
        userId: userId,
        callbackId: callbackId,
      });

      // 시스템 콜백 우선 처리
      if (await this.handleSystemCallback(bot, callbackQuery)) {
        return true;
      }

      // 모듈에서 콜백 처리 시도
      const module = this.findModuleForCallback(data);
      if (module) {
        try {
          Logger.debug(`모듈 발견: ${module.constructor.name}`, {
            hasHandleCallback: typeof module.handleCallback === "function",
            data: data,
          });

          if (typeof module.handleCallback === "function") {
            // ⭐ 표준화된 매개변수 구조로 전달
            const [prefix, ...parts] = data.split("_");
            const subAction = parts.join("_");
            const params = {};
            const menuManager = this;

            Logger.debug(
              `콜백 파싱: ${data} → prefix: ${prefix}, subAction: ${subAction}`
            );

            const result = await module.handleCallback(
              bot,
              callbackQuery,
              subAction,
              params,
              menuManager
            );

            Logger.info(`✅ 콜백 ${data} 모듈에서 처리 완료`);
            return result;
          } else {
            Logger.warn(
              `모듈 ${module.constructor.name}에 handleCallback 메서드가 없음`
            );
            return await this.handleBasicModuleCallback(
              bot,
              callbackQuery,
              module,
              data
            );
          }
        } catch (error) {
          Logger.error(`콜백 ${data} 처리 실패:`, error);
          Logger.error("에러 스택:", error.stack);

          // 에러 발생시 기본 처리로 폴백
          try {
            return await this.handleBasicModuleCallback(
              bot,
              callbackQuery,
              module,
              data
            );
          } catch (fallbackError) {
            Logger.error("기본 처리도 실패:", fallbackError);
            await this.sendErrorMessage(bot, callbackQuery.message.chat.id);
            return false;
          }
        }
      }

      // 모듈을 찾을 수 없는 경우
      Logger.warn(`처리할 수 없는 콜백: ${data}`);
      return await this.handleUnknownCallback(bot, callbackQuery, data);
    } catch (error) {
      Logger.error(`콜백 처리 오류 (${data}):`, error);
      await this.sendErrorMessage(bot, callbackQuery.message.chat.id);
      return false;
    } finally {
      // ⭐ 처리 완료 후 플래그 해제
      clearTimeout(timeoutId);
      this.processingCallbacks.delete(userCallbackKey);
      this.processingCallbacks.delete(globalCallbackKey);
      Logger.debug(`콜백 처리 완료, 플래그 해제: ${data} (사용자: ${userId})`);
    }
  }

  // ⭐ 시스템 콜백 처리
  async handleSystemCallback(bot, callbackQuery) {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;

    switch (data) {
      case "main_menu":
        await this.editMessage(
          bot,
          chatId,
          messageId,
          "🤖 **두목봇 메인 메뉴**\n\n원하는 기능을 선택해주세요:",
          {
            parse_mode: "Markdown",
            reply_markup: this.createMainMenuKeyboard(),
          }
        );
        return true;

      case "back":
      case "cancel":
        await this.editMessage(
          bot,
          chatId,
          messageId,
          "❌ **취소되었습니다**\n\n메인 메뉴로 돌아갑니다.",
          {
            parse_mode: "Markdown",
            reply_markup: this.createMainMenuKeyboard(),
          }
        );
        return true;

      default:
        return false;
    }
  }

  // ⭐ 모듈 찾기
  findModuleForCallback(callbackData) {
    try {
      // 정확한 매핑
      const moduleMapping = {
        todo_menu: "TodoModule",
        fortune_menu: "FortuneModule",
        weather_menu: "WeatherModule",
        timer_menu: "TimerModule",
        leave_menu: "LeaveModule",
        utils_menu: "UtilsModule",
      };

      if (moduleMapping[callbackData]) {
        const moduleName = moduleMapping[callbackData];
        const moduleData = this.modules.get(moduleName);
        if (moduleData && moduleData.status === "initialized") {
          return moduleData.instance;
        }
      }

      // 접두사 기반 매핑
      const prefix = callbackData.split("_")[0];
      const prefixMapping = {
        todo: "TodoModule",
        fortune: "FortuneModule",
        weather: "WeatherModule",
        timer: "TimerModule",
        leave: "LeaveModule",
        utils: "UtilsModule",
      };

      if (prefixMapping[prefix]) {
        const moduleName = prefixMapping[prefix];
        const moduleData = this.modules.get(moduleName);
        if (moduleData && moduleData.status === "initialized") {
          return moduleData.instance;
        }
      }

      // canHandleCallback으로 폴백
      for (const [moduleName, moduleData] of this.modules.entries()) {
        if (moduleData.status !== "initialized") continue;

        const instance = moduleData.instance;
        if (
          instance.canHandleCallback &&
          instance.canHandleCallback(callbackData)
        ) {
          return instance;
        }
      }
    } catch (error) {
      Logger.error("모듈 찾기 오류:", error);
    }
    return null;
  }

  // ⭐ 메시지 처리 - 중복 방지 추가
  async handleMessage(bot, msg) {
    const text = msg.text;
    if (!text) return false;

    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const messageId = msg.message_id;

    // ⭐ 메시지 중복 방지
    const messageKey = `${userId}_${chatId}_${messageId}`;

    if (this.processingMessages.has(messageKey)) {
      Logger.warn(`중복 메시지 무시: ${text} (사용자: ${userId})`);
      this.stats.duplicateMessages++;
      return false;
    }

    this.processingMessages.add(messageKey);
    this.stats.totalMessages++;

    // 자동 해제 타이머
    const timeoutId = setTimeout(() => {
      this.processingMessages.delete(messageKey);
      Logger.debug(`메시지 처리 타임아웃 해제: ${messageKey}`);
    }, this.messageTimeout);

    try {
      for (const [moduleName, moduleData] of this.modules.entries()) {
        if (moduleData.status !== "initialized") continue;

        const instance = moduleData.instance;
        if (instance.handleMessage) {
          const result = await instance.handleMessage(bot, msg);
          if (result) {
            Logger.debug(`메시지 "${text}"를 ${moduleName}에서 처리`);
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      Logger.error("메시지 처리 오류:", error);
      this.stats.errors++;
      return false;
    } finally {
      clearTimeout(timeoutId);
      this.processingMessages.delete(messageKey);
    }
  }

  // ⭐ 메인 메뉴 키보드 생성
  createMainMenuKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "📝 할일", callback_data: "todo_menu" },
          { text: "🔮 운세", callback_data: "fortune_menu" },
        ],
        [
          { text: "🌤️ 날씨", callback_data: "weather_menu" },
          { text: "⏰ 타이머", callback_data: "timer_menu" },
        ],
        [
          { text: "🏖️ 휴가", callback_data: "leave_menu" },
          { text: "🛠️ 유틸리티", callback_data: "utils_menu" },
        ],
      ],
    };
  }

  // ⭐ 헬퍼 메서드들
  async editMessage(bot, chatId, messageId, text, options = {}) {
    try {
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        ...options,
      });
    } catch (error) {
      Logger.error("메시지 수정 실패:", error.message);
      try {
        await bot.sendMessage(chatId, text, options);
      } catch (sendError) {
        Logger.error("메시지 전송도 실패:", sendError.message);
      }
    }
  }

  async sendMessage(bot, chatId, text, options = {}) {
    try {
      return await bot.sendMessage(chatId, text, options);
    } catch (error) {
      Logger.error("메시지 전송 실패:", error.message);
      throw error;
    }
  }

  async sendErrorMessage(bot, chatId) {
    try {
      await bot.sendMessage(
        chatId,
        "❌ 처리 중 오류가 발생했습니다.\n\n잠시 후 다시 시도해주세요.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
            ],
          },
        }
      );
    } catch (error) {
      Logger.error("에러 메시지 전송 실패:", error);
    }
  }

  // ⭐ 기본 모듈 처리 (폴백)
  async handleBasicModuleCallback(bot, callbackQuery, module, data) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;

    const text = `🔧 **${module.name || data}**\n\n준비 중입니다...`;

    try {
      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
          ],
        },
      });
      return true;
    } catch (error) {
      Logger.error(`기본 모듈 처리 실패 (${data}):`, error);
      return false;
    }
  }

  // ⭐ 알 수 없는 콜백 처리
  async handleUnknownCallback(bot, callbackQuery, data) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;

    let response = {
      text: `❓ **알 수 없는 요청**\n\n"${data}" 기능을 찾을 수 없어요.\n\n메인 메뉴로 돌아가서 다른 기능을 이용해보세요!`,
      buttons: [[{ text: "🔙 메인 메뉴", callback_data: "main_menu" }]],
    };

    // 기본 응답 패턴들
    if (data.startsWith("timer")) {
      response = {
        text: "⏰ **타이머 기능**\n\n타이머 기능은 준비 중입니다! 🚧\n\n포모도로 타이머와 작업 타이머를 곧 만나보실 수 있어요!",
        buttons: [[{ text: "🔙 메인 메뉴", callback_data: "main_menu" }]],
      };
    } else if (data.startsWith("weather")) {
      response = {
        text: "🌤️ **날씨 기능**\n\n날씨 기능은 준비 중입니다! 🚧\n\n실시간 날씨 정보를 곧 제공할 예정이에요!",
        buttons: [[{ text: "🔙 메인 메뉴", callback_data: "main_menu" }]],
      };
    } else if (data.startsWith("reminder")) {
      response = {
        text: "🔔 **리마인더 기능**\n\n리마인더 기능은 준비 중입니다! 🚧\n\n알림 서비스를 곧 제공할 예정이에요!",
        buttons: [[{ text: "🔙 메인 메뉴", callback_data: "main_menu" }]],
      };
    }

    try {
      await this.editMessage(bot, chatId, messageId, response.text, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: response.buttons },
      });
      return true;
    } catch (error) {
      Logger.error(`알 수 없는 콜백 처리 실패 (${data}):`, error);
      return false;
    }
  }

  isInitialized() {
    return this.isInitialized;
  }

  getModuleCount() {
    return this.modules.size;
  }

  // ⭐ 정리 - 강화된 정리 기능
  cleanup() {
    // 처리 중인 항목들 정리
    const callbackCount = this.processingCallbacks.size;
    const messageCount = this.processingMessages.size;

    this.processingCallbacks.clear();
    this.processingMessages.clear();

    // 통계 리셋
    this.stats = {
      totalCallbacks: 0,
      duplicateCallbacks: 0,
      totalMessages: 0,
      duplicateMessages: 0,
      errors: 0,
    };

    this.isInitialized = false;

    Logger.info(
      `🧹 ModuleManager 정리 완료 (콜백: ${callbackCount}, 메시지: ${messageCount} 정리)`
    );
  }

  // ⭐ 통계 업데이트 헬퍼
  updateStats(type, isDuplicate = false) {
    switch (type) {
      case "callback":
        this.stats.totalCallbacks++;
        if (isDuplicate) this.stats.duplicateCallbacks++;
        break;
      case "message":
        this.stats.totalMessages++;
        if (isDuplicate) this.stats.duplicateMessages++;
        break;
      case "error":
        this.stats.errors++;
        break;
    }
  }
}

module.exports = ModuleManager;
