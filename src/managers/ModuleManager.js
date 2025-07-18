// src/managers/ModuleManager.js - 완전한 리팩토링된 모듈 관리자
const Logger = require("../utils/Logger");
const AppConfig = require("../config/AppConfig");
const ModuleConfig = require("../config/ModuleConfig");

class ModuleManager {
  constructor(bot = null, config = {}) {
    this.bot = bot;
    this.config = config;
    this.modules = new Map();
    this.moduleOrder = [];
    this.isInitialized = false;
    this.activeModules = new Map(); // 사용자별 활성 모듈 추적

    Logger.info("🔧 ModuleManager 생성됨");
  }

  setDependencies(dependencies) {
    this.dependencies = dependencies;
  }

  // ========== 초기화 관련 ==========

  async initialize() {
    try {
      Logger.info("⚙️ ModuleManager 초기화 시작...");

      await this.loadModules();
      await this.initializeModules();
      await this.validateDependencies();

      this.isInitialized = true;
      Logger.success("✅ ModuleManager 초기화 완료", {
        loadedModules: this.modules.size,
        moduleNames: Array.from(this.modules.keys()),
      });
    } catch (error) {
      Logger.error("❌ ModuleManager 초기화 실패:", error);
      throw error;
    }
  }

  async loadModules() {
    const moduleConfigs = ModuleConfig.getModuleConfigs();

    // 우선순위별로 정렬
    const sortedConfigs = Object.entries(moduleConfigs).sort(
      ([, a], [, b]) => (a.priority || 100) - (b.priority || 100)
    );

    for (const [moduleName, config] of sortedConfigs) {
      try {
        // 기능 토글 확인
        if (!this.isFeatureEnabled(moduleName)) {
          Logger.info(`⏸️ 모듈 ${moduleName} 비활성화됨`);
          continue;
        }

        await this.loadModule(moduleName, config);
        this.moduleOrder.push(moduleName);
      } catch (error) {
        Logger.error(`❌ 모듈 ${moduleName} 로드 실패:`, error);

        // 필수 모듈인 경우 전체 시스템 중단
        if (config.required) {
          throw new Error(`필수 모듈 ${moduleName} 로드 실패`);
        }
      }
    }
  }

  async loadModule(moduleName, config) {
    try {
      Logger.info(`📦 모듈 ${moduleName} 로드 중...`);

      if (!config.path) {
        throw new Error(`❌ ${moduleName} 모듈에 path 값이 없습니다.`);
      }

      // 모듈 클래스 import
      let ModuleClass;
      try {
        ModuleClass = require(config.path);
      } catch (requireError) {
        Logger.warn(
          `⚠️ 모듈 파일 ${config.path}을 찾을 수 없습니다. 스킵합니다.`
        );
        return;
      }

      // 모듈 인스턴스 생성
      const moduleInstance = new ModuleClass(config);

      // 모듈 등록
      this.modules.set(moduleName, {
        instance: moduleInstance,
        config: config,
        status: "loaded",
        loadTime: new Date(),
      });

      Logger.success(`✅ 모듈 ${moduleName} 로드 완료`);
    } catch (error) {
      Logger.error(`❌ 모듈 ${moduleName} 로드 실패:`, error);

      // 필수 모듈이 아니면 에러를 던지지 않음
      if (!config.required) {
        Logger.warn(`⚠️ 선택적 모듈 ${moduleName} 로드 실패, 계속 진행합니다.`);
        return;
      }
      throw error;
    }
  }

  async initializeModules() {
    for (const moduleName of this.moduleOrder) {
      try {
        const moduleData = this.modules.get(moduleName);
        if (!moduleData) continue;

        Logger.info(`🔧 모듈 ${moduleName} 초기화 중...`);

        await moduleData.instance.initialize();
        moduleData.status = "initialized";

        Logger.success(`✅ 모듈 ${moduleName} 초기화 완료`);
      } catch (error) {
        Logger.error(`❌ 모듈 ${moduleName} 초기화 실패:`, error);

        const moduleData = this.modules.get(moduleName);
        if (moduleData) {
          moduleData.status = "error";
          moduleData.error = error.message;
        }

        // 필수 모듈인 경우 전체 시스템 중단
        if (moduleData?.config.required) {
          throw new Error(`필수 모듈 ${moduleName} 초기화 실패`);
        }
      }
    }
  }

  async validateDependencies() {
    for (const [moduleName, moduleData] of this.modules.entries()) {
      if (moduleData.status !== "initialized") continue;

      const dependencies = moduleData.config.dependencies || [];

      for (const dependency of dependencies) {
        if (!this.isModuleLoaded(dependency)) {
          const error = `모듈 ${moduleName}의 의존성 ${dependency}가 로드되지 않음`;
          Logger.error(error);

          moduleData.status = "dependency_error";
          moduleData.error = error;

          if (moduleData.config.required) {
            throw new Error(error);
          }
        }
      }
    }
  }

  // ========== 기능 확인 ==========

  isFeatureEnabled(moduleName) {
    const featureMap = {
      TodoModule: AppConfig.FEATURES.TODO_MODULE,
      LeaveModule: AppConfig.FEATURES.LEAVE_MODULE,
      WeatherModule: AppConfig.FEATURES.WEATHER_MODULE,
      FortuneModule: AppConfig.FEATURES.FORTUNE_MODULE,
      TimerModule: AppConfig.FEATURES.TIMER_MODULE,
      InsightModule: AppConfig.FEATURES.INSIGHT_MODULE,
      UtilsModule: AppConfig.FEATURES.UTILS_MODULE,
      ReminderModule: AppConfig.FEATURES.REMINDER_MODULE,
      WorktimeModule: AppConfig.FEATURES.WORKTIME_MODULE,
    };

    return featureMap[moduleName] !== false;
  }

  // ========== 모듈 접근 ==========

  getModule(moduleName) {
    const moduleData = this.modules.get(moduleName);

    if (!moduleData) {
      Logger.debug(`모듈 ${moduleName}을 찾을 수 없습니다`);
      return null;
    }

    if (moduleData.status === "initialized" || moduleData.status === "loaded") {
      return moduleData.instance;
    }

    Logger.debug(
      `모듈 ${moduleName}은 사용할 수 없는 상태. 상태: ${moduleData.status}`
    );
    return null;
  }

  hasModule(moduleName) {
    const moduleData = this.modules.get(moduleName);
    return moduleData && moduleData.status === "initialized";
  }

  isModuleLoaded(moduleId) {
    const module = this.modules.get(moduleId);
    return (
      module && (module.status === "initialized" || module.status === "loaded")
    );
  }

  // ========== 명령어/콜백 처리 ==========

  findModuleForCommand(command) {
    try {
      for (const [moduleName, moduleData] of this.modules.entries()) {
        if (moduleData.status !== "initialized") continue;

        const instance = moduleData.instance;

        // canHandleCommand 메서드가 있는 경우
        if (instance.canHandleCommand && instance.canHandleCommand(command)) {
          Logger.debug(`명령어 ${command}를 ${moduleName}에서 처리`);
          return instance;
        }

        // 설정에서 명령어 목록 확인
        const commands = moduleData.config.commands || [];
        if (commands.includes(command)) {
          Logger.debug(
            `명령어 ${command}를 ${moduleName}에서 처리 (설정 기반)`
          );
          return instance;
        }

        // 모듈별 기본 명령어 확인
        const moduleCommands = this.getModuleCommands(moduleName);
        if (moduleCommands.includes(command)) {
          Logger.debug(
            `명령어 ${command}를 ${moduleName}에서 처리 (기본 명령어)`
          );
          return instance;
        }
      }
    } catch (error) {
      Logger.error("findModuleForCommand 오류:", error);
    }
    return null;
  }

  findModuleForCallback(callbackData) {
    try {
      for (const [moduleName, moduleData] of this.modules.entries()) {
        if (moduleData.status !== "initialized") continue;

        const instance = moduleData.instance;
        if (
          instance.canHandleCallback &&
          instance.canHandleCallback(callbackData)
        ) {
          Logger.debug(`콜백 ${callbackData}를 ${moduleName}에서 처리`);
          return instance;
        }
      }
    } catch (error) {
      Logger.error("findModuleForCallback 오류:", error);
    }
    return null;
  }

  async handleMessage(bot, msg) {
    const text = msg.text;
    if (!text) return false;

    // 명령어 파싱
    if (text.startsWith("/")) {
      return await this.handleCommand(bot, msg);
    }

    // 일반 메시지 처리 (모든 모듈에 전달)
    let handled = false;
    for (const [moduleName, moduleData] of this.modules.entries()) {
      if (moduleData.status !== "initialized") continue;

      try {
        const instance = moduleData.instance;
        if (instance.handleMessage) {
          const result = await instance.handleMessage(bot, msg);
          if (result) {
            handled = true;
            Logger.debug(`메시지가 ${moduleName} 모듈에서 처리됨`);
            break;
          }
        }
      } catch (error) {
        Logger.error(`모듈 ${moduleName}에서 메시지 처리 실패:`, error);
      }
    }

    return handled;
  }

  async handleCommand(bot, msg) {
    const text = msg.text || "";
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const isGroupChat =
      msg.chat.type === "group" || msg.chat.type === "supergroup";

    Logger.info(`명령어 처리: ${text}`, {
      userId,
      chatId,
      isGroup: isGroupChat,
      chatType: msg.chat.type,
    });

    if (!text.startsWith("/")) return false;

    // 명령어 파싱 (그룹에서 @봇이름 제거)
    let command, args;
    try {
      const parts = text.split(" ").filter(Boolean);
      let commandPart = parts[0].substring(1); // '/' 제거

      // 그룹에서 @봇이름 처리 (예: /fortune@doomock_todoBot -> fortune)
      if (commandPart.includes("@")) {
        commandPart = commandPart.split("@")[0];
      }

      command = commandPart;
      args = parts.slice(1);

      Logger.debug(`파싱된 명령어: ${command}`, { args, originalText: text });
    } catch (parseError) {
      Logger.error("명령어 파싱 오류:", parseError);
      return false;
    }

    // 빈 명령어 체크
    if (!command) {
      Logger.warn("빈 명령어 감지");
      return false;
    }

    try {
      // 시스템 명령어 우선 처리
      if (await this.handleSystemCommand(bot, msg, command, isGroupChat)) {
        return true;
      }

      // 모듈 명령어 처리
      const module = this.findModuleForCommand(command);
      if (module) {
        try {
          const result = await module.handleCommand(bot, msg, command, args);
          Logger.info(`명령어 ${command} 처리 완료`, { success: !!result });
          return result;
        } catch (error) {
          Logger.error(`명령어 ${command} 처리 실패:`, error);
          await this.sendCommandErrorMessage(
            bot,
            chatId,
            command,
            error,
            isGroupChat
          );
          return false;
        }
      }

      // 알 수 없는 명령어 처리
      await this.handleUnknownCommand(bot, msg, command, isGroupChat);
      return true;
    } catch (error) {
      Logger.error("명령어 처리 중 예외:", error);
      await this.sendCommandErrorMessage(
        bot,
        chatId,
        command,
        error,
        isGroupChat
      );
      return false;
    }
  }

  async handleCallback(bot, callbackQuery) {
    const data = callbackQuery.data;

    try {
      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      Logger.debug("콜백 쿼리 응답 실패 (이미 응답됨)");
    }

    Logger.userAction(callbackQuery.from.id, "callback", { data });

    // 시스템 콜백 우선 처리
    if (await this.handleSystemCallback(bot, callbackQuery)) {
      return true;
    }

    // 모듈에서 콜백 처리
    const module = this.findModuleForCallback(data);
    if (module) {
      try {
        return await module.handleCallback(bot, callbackQuery);
      } catch (error) {
        Logger.error(`콜백 ${data} 처리 실패:`, error);
        await this.sendErrorMessage(bot, callbackQuery.message.chat.id, error);
        return false;
      }
    }

    Logger.warn(`처리할 수 없는 콜백: ${data}`);
    return false;
  }

  // ========== 시스템 명령어 처리 ==========

  async handleSystemCommand(bot, msg, command, isGroupChat = false) {
    const chatId = msg.chat.id;

    switch (command) {
      case "start":
        // 그룹에서는 start 명령어 제한
        if (isGroupChat) {
          await bot.sendMessage(
            chatId,
            "🤖 안녕하세요! 개인 메시지로 대화해주세요.",
            { reply_to_message_id: msg.message_id }
          );
        } else {
          await this.handleStartCommand(bot, msg);
        }
        return true;

      case "help":
        await this.handleHelpCommand(bot, msg, isGroupChat);
        return true;

      case "status":
        // 관리자만 사용 가능
        if (this.isAdmin(msg.from)) {
          await this.handleStatusCommand(bot, msg);
        } else {
          await bot.sendMessage(chatId, "🚫 관리자만 사용할 수 있습니다.");
        }
        return true;

      case "modules":
        // 관리자만 사용 가능
        if (this.isAdmin(msg.from)) {
          await this.handleModulesCommand(bot, msg);
        } else {
          await bot.sendMessage(chatId, "🚫 관리자만 사용할 수 있습니다.");
        }
        return true;

      default:
        return false;
    }
  }

  async handleStartCommand(bot, msg) {
    const { getUserName } = require("../utils/UserHelper");
    const userName = getUserName(msg.from);

    const welcomeMessage =
      `🤖 **두목봇에 오신걸 환영합니다!**\n\n` +
      `안녕하세요 ${userName}님! 👋\n\n` +
      `두목봇은 직장인을 위한 종합 생산성 도구입니다.\n` +
      `아래 메뉴에서 원하는 기능을 선택해주세요:`;

    await bot.sendMessage(msg.chat.id, welcomeMessage, {
      parse_mode: "Markdown",
      reply_markup: this.createMainMenuKeyboard(),
    });
  }

  async handleHelpCommand(bot, msg, isGroupChat = false) {
    const chatId = msg.chat.id;
    let helpMessage;

    if (isGroupChat) {
      // 그룹에서는 간단한 도움말
      helpMessage =
        `❓ **두목봇 명령어**\n\n` +
        `• /fortune - 운세 보기\n` +
        `• /weather - 날씨 정보\n` +
        `• /help - 도움말\n\n` +
        `더 많은 기능은 개인 메시지로 /start 를 보내주세요!`;

      await bot.sendMessage(chatId, helpMessage, {
        parse_mode: "Markdown",
        reply_to_message_id: msg.message_id,
      });
    } else {
      // 개인 채팅에서는 상세한 도움말
      const moduleHelps = [];
      for (const [moduleName, moduleData] of this.modules.entries()) {
        if (moduleData.status !== "initialized") continue;

        const instance = moduleData.instance;
        if (instance.getHelpMessage) {
          try {
            const moduleHelp = await instance.getHelpMessage();
            moduleHelps.push(moduleHelp);
          } catch (error) {
            Logger.error(`모듈 ${moduleName} 도움말 생성 실패:`, error);
          }
        }
      }

      helpMessage = `❓ **두목봇 도움말**\n\n`;

      if (moduleHelps.length > 0) {
        helpMessage += moduleHelps.join("\n\n");
      } else {
        helpMessage += "사용 가능한 모듈이 없습니다.";
      }

      helpMessage += `\n\n**🔧 시스템 명령어**\n`;
      helpMessage += `• /start - 메인 메뉴\n`;
      helpMessage += `• /help - 도움말\n`;

      await bot.sendMessage(chatId, helpMessage, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
          ],
        },
      });
    }
  }

  async handleStatusCommand(bot, msg) {
    const status = this.getModuleStatus();

    let statusMessage = `📊 **모듈 상태**\n\n`;

    for (const [moduleName, moduleStatus] of Object.entries(status)) {
      const statusEmoji = moduleStatus.status === "initialized" ? "✅" : "❌";
      statusMessage += `${statusEmoji} **${moduleName}**\n`;
      statusMessage += `• 상태: ${moduleStatus.status}\n`;

      if (moduleStatus.error) {
        statusMessage += `• 오류: ${moduleStatus.error}\n`;
      }

      statusMessage += `\n`;
    }

    await bot.sendMessage(msg.chat.id, statusMessage, {
      parse_mode: "Markdown",
    });
  }

  async handleModulesCommand(bot, msg) {
    let modulesMessage = `🔧 **로드된 모듈 목록**\n\n`;

    const moduleCount = { total: this.modules.size, initialized: 0, error: 0 };

    for (const [moduleName, moduleData] of this.modules.entries()) {
      const statusEmoji =
        {
          initialized: "✅",
          loaded: "⏳",
          error: "❌",
          dependency_error: "⚠️",
        }[moduleData.status] || "❓";

      modulesMessage += `${statusEmoji} ${moduleName} (${moduleData.status})\n`;

      if (moduleData.status === "initialized") {
        moduleCount.initialized++;
      } else if (
        moduleData.status === "error" ||
        moduleData.status === "dependency_error"
      ) {
        moduleCount.error++;
      }
    }

    modulesMessage += `\n**📈 통계**\n`;
    modulesMessage += `• 전체: ${moduleCount.total}개\n`;
    modulesMessage += `• 정상: ${moduleCount.initialized}개\n`;
    modulesMessage += `• 오류: ${moduleCount.error}개\n`;

    await bot.sendMessage(msg.chat.id, modulesMessage, {
      parse_mode: "Markdown",
    });
  }

  async handleUnknownCommand(bot, msg, command, isGroupChat = false) {
    const chatId = msg.chat.id;
    const userName = this.getUserName(msg.from);

    let message;
    let replyMarkup = null;

    if (isGroupChat) {
      // 그룹에서는 간단한 응답
      message = `❓ 알 수 없는 명령어: /${command}`;

      // 그룹에서는 인라인 키보드 없이 텍스트만
      await bot.sendMessage(chatId, message, {
        reply_to_message_id: msg.message_id,
      });
    } else {
      // 개인 채팅에서는 자세한 안내
      message =
        `❓ **알 수 없는 명령어입니다: /${command}**\n\n` +
        `${userName}님, 다음 명령어를 사용해보세요:\n\n` +
        `• /start - 메인 메뉴\n` +
        `• /help - 도움말\n` +
        `• /fortune - 운세 보기\n` +
        `• /weather - 날씨 정보\n` +
        `• /todo - 할일 관리\n`;

      replyMarkup = {
        inline_keyboard: [
          [
            { text: "🔙 메인 메뉴", callback_data: "main_menu" },
            { text: "❓ 도움말", callback_data: "help" },
          ],
        ],
      };

      await bot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        reply_markup: replyMarkup,
      });
    }
  }

  // ========== 시스템 콜백 처리 ==========

  async handleSystemCallback(bot, callbackQuery) {
    const data = callbackQuery.data;

    switch (data) {
      case "main_menu":
        try {
          const { getUserName } = require("../utils/UserHelper");
          const userName = getUserName(callbackQuery.from);

          const welcomeMessage =
            `🤖 **두목봇 메인 메뉴**\n\n` +
            `안녕하세요 ${userName}님! 👋\n\n` +
            `원하는 기능을 선택해주세요:`;

          await bot.editMessageText(welcomeMessage, {
            chat_id: callbackQuery.message.chat.id,
            message_id: callbackQuery.message.message_id,
            parse_mode: "Markdown",
            reply_markup: this.createMainMenuKeyboard(),
          });
        } catch (error) {
          Logger.error("메인 메뉴 표시 실패:", error);
          await bot.sendMessage(
            callbackQuery.message.chat.id,
            "메인 메뉴로 돌아갑니다.",
            {
              reply_markup: this.createMainMenuKeyboard(),
            }
          );
        }
        return true;

      case "help":
        await this.handleHelpCommand(bot, callbackQuery.message);
        return true;

      case "noop":
        return true;

      case "cancel":
      case "cancel_action":
        await bot.editMessageText("❌ 작업이 취소되었습니다.", {
          chat_id: callbackQuery.message.chat.id,
          message_id: callbackQuery.message.message_id,
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
            ],
          },
        });
        return true;

      default:
        return false;
    }
  }

  // ========== 헬퍼 메서드 ==========

  sendCommandErrorMessage(bot, chatId, command, error, isGroupChat = false) {
    try {
      let message;
      let options = {};

      if (isGroupChat) {
        // 그룹에서는 간단한 에러 메시지
        message = `❌ /${command} 명령어 처리 중 오류가 발생했습니다.`;
      } else {
        // 개인 채팅에서는 자세한 에러 메시지
        message =
          `❌ **명령어 처리 오류**\n\n` +
          `/${command} 명령어 처리 중 오류가 발생했습니다.\n` +
          `잠시 후 다시 시도해주세요.`;

        options = {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
            ],
          },
        };
      }

      return bot.sendMessage(chatId, message, options);
    } catch (sendError) {
      Logger.error("명령어 에러 메시지 전송 실패:", sendError);
    }
  }

  getUserName(user) {
    if (!user) return "사용자";

    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }

    if (user.first_name) {
      return user.first_name;
    }

    if (user.username) {
      return `@${user.username}`;
    }

    return `User${user.id}`;
  }

  isAdmin(user) {
    if (!user) return false;

    // 환경변수에서 관리자 ID 목록 가져오기
    const adminIds = (process.env.ADMIN_IDS || "")
      .split(",")
      .map((id) => parseInt(id.trim()));
    return adminIds.includes(user.id);
  }

  getModuleCommands(moduleName) {
    const commandMap = {
      TodoModule: ["todo", "todo_add", "todo_list", "todo_done"],
      FortuneModule: ["fortune", "tarot", "luck"],
      WeatherModule: ["weather", "forecast", "w"],
      TimerModule: ["timer", "pomodoro", "countdown"],
      LeaveModule: ["leave", "vacation", "annual"],
      WorktimeModule: ["worktime", "work", "checkin", "checkout"],
      InsightModule: ["insight", "analytics", "report"],
      UtilsModule: ["tts", "utils", "tools"],
      ReminderModule: ["remind", "reminder", "alarm"],
    };

    return commandMap[moduleName] || [];
  }

  // ========== UI 헬퍼 ==========

  createMainMenuKeyboard() {
    const keyboard = [];
    const modules = this.getEnabledModules();

    const buttonConfig = {
      todo: { text: "📝 할일 관리", callback_data: "todo_menu" },
      leave: { text: "📅 휴가 관리", callback_data: "leave_menu" },
      timer: { text: "⏰ 타이머", callback_data: "timer_menu" },
      fortune: { text: "🔮 운세", callback_data: "fortune_menu" },
      weather: { text: "🌤️ 날씨", callback_data: "weather_menu" },
      insight: { text: "📊 인사이트", callback_data: "insight_menu" },
      utils: { text: "🛠️ 유틸리티", callback_data: "utils_menu" },
      reminder: { text: "🔔 리마인더", callback_data: "reminder_menu" },
      worktime: { text: "🕐 근무시간", callback_data: "worktime_menu" },
    };

    const buttons = [];
    for (const module of modules) {
      const moduleName = module.name.replace("Module", "").toLowerCase();
      if (buttonConfig[moduleName]) {
        buttons.push(buttonConfig[moduleName]);
      }
    }

    // 2개씩 행으로 배치
    for (let i = 0; i < buttons.length; i += 2) {
      keyboard.push(buttons.slice(i, i + 2));
    }

    // 도움말 버튼 추가
    keyboard.push([{ text: "❓ 도움말", callback_data: "help" }]);

    return { inline_keyboard: keyboard };
  }

  async sendErrorMessage(bot, chatId, error) {
    try {
      const errorMessage =
        `❌ 처리 중 오류가 발생했습니다.\n\n` +
        `${error.message || "알 수 없는 오류"}`;

      await bot.sendMessage(chatId, errorMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
          ],
        },
      });
    } catch (sendError) {
      Logger.error("오류 메시지 전송 실패:", sendError);
    }
  }

  // ========== 모듈 정보 조회 ==========

  getEnabledModules() {
    const enabledModules = [];
    for (const [moduleName, moduleData] of this.modules) {
      if (moduleData.status === "initialized") {
        enabledModules.push({
          name: moduleName,
          instance: moduleData.instance,
          config: moduleData.config,
        });
      }
    }
    return enabledModules;
  }

  getModules() {
    const modules = {};
    for (const [moduleName, moduleData] of this.modules) {
      if (moduleData.status === "initialized") {
        const key = moduleName.replace("Module", "").toLowerCase();
        modules[key] = moduleData.instance;
      }
    }
    return modules;
  }

  getInitializedModuleCount() {
    return Array.from(this.modules.values()).filter(
      (moduleData) => moduleData.status === "initialized"
    ).length;
  }

  getAllModules() {
    const moduleList = [];
    for (const [name, data] of this.modules.entries()) {
      moduleList.push({
        name,
        status: data.status,
        instance: data.instance,
        config: data.config,
        error: data.error,
        loadTime: data.loadTime,
      });
    }
    return moduleList;
  }

  getModuleStatus() {
    const status = {};
    for (const [moduleName, moduleData] of this.modules) {
      status[moduleName] = {
        status: moduleData.status,
        error: moduleData.error,
        loadTime: moduleData.loadTime,
        config: {
          priority: moduleData.config.priority,
          required: moduleData.config.required,
        },
      };

      if (moduleData.instance && moduleData.instance.getStatus) {
        try {
          const instanceStatus = moduleData.instance.getStatus();
          status[moduleName] = { ...status[moduleName], ...instanceStatus };
        } catch (error) {
          Logger.error(`모듈 ${moduleName} 상태 조회 실패:`, error);
        }
      }
    }
    return status;
  }

  // ========== CommandHandler/BotController 호환성 ==========

  async getAvailableModules(userId = null) {
    try {
      const availableModules = [];
      for (const [moduleName, moduleData] of this.modules) {
        if (moduleData.status === "initialized") {
          const moduleInfo = {
            id: moduleName.toLowerCase().replace("module", ""),
            name: this.getModuleDisplayName(moduleName),
            description: this.getModuleDescription(moduleName),
            icon: this.getModuleIcon(moduleName),
            status: moduleData.status,
            instance: moduleData.instance,
          };
          availableModules.push(moduleInfo);
        }
      }
      return availableModules;
    } catch (error) {
      Logger.error("getAvailableModules 오류:", error);
      return [];
    }
  }

  getModuleDisplayName(moduleName) {
    const displayNames = {
      TodoModule: "할일 관리",
      FortuneModule: "운세",
      WeatherModule: "날씨",
      TimerModule: "타이머",
      InsightModule: "인사이트",
      UtilsModule: "유틸리티",
      ReminderModule: "리마인더",
      LeaveModule: "휴가 관리",
      WorktimeModule: "근무시간",
    };
    return displayNames[moduleName] || moduleName;
  }

  getModuleDescription(moduleName) {
    const descriptions = {
      TodoModule: "할일 추가, 완료, 삭제 관리",
      FortuneModule: "오늘의 운세와 타로카드",
      WeatherModule: "화성/동탄 중심 날씨 정보",
      TimerModule: "포모도로와 작업 타이머",
      InsightModule: "마케팅 인사이트와 분석",
      UtilsModule: "TTS와 편의 기능",
      ReminderModule: "시간 기반 알림 서비스",
      LeaveModule: "연차와 휴가 관리",
      WorktimeModule: "근무시간 추적과 관리",
    };
    return descriptions[moduleName] || "설명 없음";
  }

  getModuleIcon(moduleName) {
    const icons = {
      TodoModule: "📝",
      FortuneModule: "🔮",
      WeatherModule: "🌤️",
      TimerModule: "⏰",
      InsightModule: "📊",
      UtilsModule: "🛠️",
      ReminderModule: "🔔",
      LeaveModule: "📅",
      WorktimeModule: "🕐",
    };
    return icons[moduleName] || "🔧";
  }

  async getActiveModule(userId) {
    const modules = await this.getAvailableModules(userId);
    return modules.length > 0 ? modules[0] : null;
  }

  async activateModule(chatId, moduleId) {
    try {
      const moduleName =
        moduleId.charAt(0).toUpperCase() + moduleId.slice(1) + "Module";
      const moduleData = this.modules.get(moduleName);

      if (moduleData && moduleData.status === "initialized") {
        Logger.info(`모듈 ${moduleId} 활성화됨`);
        return true;
      }

      Logger.warn(`모듈 ${moduleId}를 찾을 수 없음`);
      return false;
    } catch (error) {
      Logger.error(`모듈 ${moduleId} 활성화 실패:`, error);
      return false;
    }
  }

  async cancelModuleAction(userId, moduleId) {
    try {
      Logger.info(`사용자 ${userId}의 모듈 ${moduleId} 액션 취소`);
      return true;
    } catch (error) {
      Logger.error(`모듈 액션 취소 실패:`, error);
      return false;
    }
  }

  async getInlineResults(query) {
    try {
      const message = `🤖 [${query}]에 대한 결과입니다. /start 를 입력하세요!`;

      return [
        {
          type: "article",
          id: "1",
          title: `검색: ${query}`,
          input_message_content: {
            message_text: message,
          },
        },
      ];
    } catch (error) {
      Logger.error("인라인 결과 생성 실패:", error);
      return [];
    }
  }

  async getModuleHelp(moduleName) {
    try {
      const moduleData = this.modules.get(moduleName + "Module");
      if (
        moduleData &&
        moduleData.instance &&
        moduleData.instance.getHelpMessage
      ) {
        return await moduleData.instance.getHelpMessage();
      }
      return `❓ ${moduleName} 모듈의 도움말을 찾을 수 없습니다.`;
    } catch (error) {
      Logger.error(`모듈 ${moduleName} 도움말 조회 실패:`, error);
      return "❌ 도움말을 불러올 수 없습니다.";
    }
  }

  // ========== 시스템 관리 ==========

  async reloadModules() {
    Logger.info("🔄 모듈 재로드 시작...");

    try {
      await this.shutdown();
      this.clearModuleCache();

      this.modules.clear();
      this.moduleOrder = [];
      this.isInitialized = false;

      await this.initialize();
      Logger.success("✅ 모듈 재로드 완료");
    } catch (error) {
      Logger.error("❌ 모듈 재로드 실패:", error);
      throw error;
    }
  }

  clearModuleCache() {
    const moduleFiles = [
      "../modules/TodoModule",
      "../modules/LeaveModule",
      "../modules/WeatherModule",
      "../modules/FortuneModule",
      "../modules/TimerModule",
      "../modules/InsightModule",
      "../modules/UtilsModule",
      "../modules/ReminderModule",
      "../modules/WorktimeModule",
    ];

    for (const moduleFile of moduleFiles) {
      try {
        delete require.cache[require.resolve(moduleFile)];
      } catch (error) {
        // 파일이 없는 경우 무시
      }
    }
  }

  async shutdown() {
    Logger.info("⏹️ ModuleManager 종료 시작...");

    try {
      for (const [moduleName, moduleData] of this.modules.entries()) {
        try {
          if (moduleData.instance && moduleData.instance.cleanup) {
            await moduleData.instance.cleanup();
          }
        } catch (error) {
          Logger.error(`모듈 ${moduleName} 정리 실패:`, error);
        }
      }

      this.modules.clear();
      this.moduleOrder = [];
      this.activeModules.clear();
      this.isInitialized = false;

      Logger.success("✅ ModuleManager 종료 완료");
    } catch (error) {
      Logger.error("❌ ModuleManager 종료 실패:", error);
      throw error;
    }
  }
}

module.exports = ModuleManager;
