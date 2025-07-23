// src/managers/ModuleManager.js - 통합된 단일 매니저 (리팩토링)

const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

class ModuleManager {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.container = options.container || require("../core/DIContainer");
    this.moduleInstances = new Map();
    this.isInitialized = false;

    // 중복 처리 방지
    this.processingCallbacks = new Set();

    // 모듈 레지스트리 (ModuleConfig.js 통합)
    this.moduleRegistry = {
      system: { class: "SystemModule", path: "../modules/SystemModule" },
      todo: { class: "TodoModule", path: "../modules/TodoModule" },
      timer: { class: "TimerModule", path: "../modules/TimerModule" },
      worktime: { class: "WorktimeModule", path: "../modules/WorktimeModule" },
      leave: { class: "LeaveModule", path: "../modules/LeaveModule" },
      reminder: { class: "ReminderModule", path: "../modules/ReminderModule" },
      fortune: { class: "FortuneModule", path: "../modules/FortuneModule" },
      weather: { class: "WeatherModule", path: "../modules/WeatherModule" },
      utils: { class: "UtilsModule", path: "../modules/UtilsModule" },
    };

    logger.info("🔧 ModuleManager 생성됨");
  }

  // 🎯 초기화
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

  // 📦 모듈 로드
  async loadModules() {
    for (const [key, config] of Object.entries(this.moduleRegistry)) {
      try {
        const ModuleClass = require(config.path);
        const moduleInstance = new ModuleClass(this.bot, {
          container: this.container,
        });

        if (moduleInstance.initialize) {
          await moduleInstance.initialize();
        }

        this.moduleInstances.set(config.class, moduleInstance);
        logger.debug(`✅ ${config.class} 로드 완료`);
      } catch (error) {
        logger.error(`❌ ${config.class} 로드 실패:`, error.message);
      }
    }
  }

  // 🎯 메시지 핸들러
  async handleMessage(bot, msg) {
    if (!msg.text) return false;

    // 모든 모듈에게 메시지 전달 (우선순위 순)
    const moduleOrder = [
      "system",
      "todo",
      "leave",
      "worktime",
      "timer",
      "reminder",
      "fortune",
      "weather",
      "utils",
    ];

    for (const moduleName of moduleOrder) {
      const moduleClass = this.moduleRegistry[moduleName]?.class;
      const module = this.moduleInstances.get(moduleClass);

      if (module?.handleMessage) {
        try {
          const handled = await module.handleMessage(bot, msg);
          if (handled) {
            logger.debug(`📬 메시지가 ${moduleClass}에서 처리됨`);
            return true;
          }
        } catch (error) {
          logger.error(`❌ ${moduleClass} 메시지 처리 오류:`, error);
        }
      }
    }

    return false;
  }

  // 🎯 콜백 핸들러 (한 곳에서만 처리)
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

      // ⭐ 메인 메뉴 처리 (시스템 직접 처리)
      if (callbackData === "main:menu") {
        return await this.handleMainMenu(callbackQuery);
      }

      // ⭐ 콜백 데이터 파싱 (콜론 형식)
      const [targetModule, subAction, ...params] = callbackData.split(":");

      // 파싱 검증
      if (!targetModule) {
        logger.warn(`⚠️ 잘못된 콜백 형식: ${callbackData}`);
        return false;
      }

      // 🔍 모듈 찾기 (개선된 로직)
      const moduleClass = this.findModuleClass(targetModule);

      if (!moduleClass) {
        logger.warn(`⚠️ 모듈 클래스를 찾을 수 없음: ${targetModule}`);
        await this.sendModuleNotFoundMessage(callbackQuery);
        return false;
      }

      const moduleInstance = this.moduleInstances.get(moduleClass);

      if (!moduleInstance) {
        logger.warn(`⚠️ 모듈 인스턴스를 찾을 수 없음: ${moduleClass}`);

        // 🚨 TodoModule의 경우 특별 처리
        if (targetModule === "todo") {
          await this.handleTodoModuleError(callbackQuery);
          return false;
        }

        await this.sendModuleNotFoundMessage(callbackQuery);
        return false;
      }

      // ✅ 모듈 콜백 처리
      if (moduleInstance.handleCallback) {
        logger.info(`📞 ${moduleClass}.handleCallback 호출: ${subAction}`);

        const result = await moduleInstance.handleCallback(
          this.bot,
          callbackQuery,
          subAction,
          params,
          this
        );

        if (result) {
          logger.debug(`✅ ${moduleClass} 콜백 처리 완료`);
        } else {
          logger.warn(`⚠️ ${moduleClass} 콜백 처리 실패`);
        }

        return result;
      } else {
        logger.error(`❌ ${moduleClass}에 handleCallback 메서드 없음`);
        return false;
      }
    } catch (error) {
      logger.error(`❌ 콜백 처리 오류 (${callbackData}):`, error);
      await this.sendErrorCallback(callbackQuery);
      return false;
    } finally {
      // 🔓 중복 처리 방지 해제
      setTimeout(() => {
        this.processingCallbacks.delete(callbackKey);
      }, 1000);
    }
  }

  // 🏠 메인 메뉴
  async handleMainMenu(callbackQuery) {
    try {
      const userName = getUserName(callbackQuery.from);

      const menuText = `🏠 **메인 메뉴**

안녕하세요! ${userName}님!
무엇을 도와드릴까요?

아래 메뉴에서 원하는 기능을 선택해주세요:`;

      // 🎯 강제로 할일 관리 포함 (모듈 상태와 무관하게)
      const forceIncludeTodo = true;
      let keyboard;

      if (forceIncludeTodo) {
        keyboard = {
          inline_keyboard: [
            [
              { text: "📝 할일 관리", callback_data: "todo:menu" },
              { text: "🔮 운세", callback_data: "fortune:menu" },
            ],
            [
              { text: "🌤️ 날씨", callback_data: "weather:menu" },
              { text: "⏰ 타이머", callback_data: "timer:menu" },
            ],
            [
              { text: "🛠️ 유틸리티", callback_data: "utils:menu" },
              { text: "📅 휴가 관리", callback_data: "leave:menu" },
            ],
            [
              { text: "🕐 근무시간", callback_data: "worktime:menu" },
              { text: "🔔 리마인더", callback_data: "reminder:menu" },
            ],
            [
              { text: "📊 시스템 상태", callback_data: "system:status" },
              { text: "❓ 도움말", callback_data: "system:help" },
            ],
          ],
        };
      } else {
        keyboard = this.createMainMenuKeyboard();
      }

      await this.bot.editMessageText(menuText, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      logger.info(
        `🏠 메인 메뉴 표시 완료: ${userName} (${callbackQuery.from.id})`
      );
      return true;
    } catch (error) {
      logger.error("❌ 메인 메뉴 처리 오류:", error);
      return false;
    }
  }

  // 📊 시스템 상태
  async handleSystemStatus(callbackQuery) {
    try {
      const uptime = process.uptime();
      const memUsage = process.memoryUsage();

      const statusText = `📊 **시스템 상태**

**봇 정보:**
• 버전: v${process.env.npm_package_version || "3.0.1"}
• 환경: ${process.env.NODE_ENV || "development"}
• 가동 시간: ${this.formatUptime(uptime)}

**시스템 리소스:**
• 메모리 사용: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB
• 총 메모리: ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB

**모듈 상태:**
• 총 모듈: ${this.moduleInstances.size}개
• 활성 콜백: ${this.processingCallbacks.size}개`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 새로고침", callback_data: "system:status" },
            { text: "🔙 메인 메뉴", callback_data: "main:menu" },
          ],
        ],
      };

      await this.bot.editMessageText(statusText, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("❌ 시스템 상태 처리 오류:", error);
      return false;
    }
  }

  // 🎨 메인 메뉴 키보드 생성
  createMainMenuKeyboard() {
    logger.debug("🎨 메인 메뉴 키보드 생성 시작...");

    // 🎯 모든 모듈 버튼 정의 (우선순위 순)
    const allModuleButtons = [
      { module: "TodoModule", text: "📝 할일 관리", callback: "todo:menu" },
      { module: "FortuneModule", text: "🔮 운세", callback: "fortune:menu" },
      { module: "WeatherModule", text: "🌤️ 날씨", callback: "weather:menu" },
      { module: "TimerModule", text: "⏰ 타이머", callback: "timer:menu" },
      { module: "UtilsModule", text: "🛠️ 유틸리티", callback: "utils:menu" },
      { module: "LeaveModule", text: "📅 휴가 관리", callback: "leave:menu" },
      {
        module: "WorktimeModule",
        text: "🕐 근무시간",
        callback: "worktime:menu",
      },
      {
        module: "ReminderModule",
        text: "🔔 리마인더",
        callback: "reminder:menu",
      },
    ];

    // 🔍 활성화된 모듈만 필터링
    const activeModuleButtons = [];

    for (const btn of allModuleButtons) {
      const isActive = this.moduleInstances.has(btn.module);
      logger.debug(`📱 ${btn.module}: ${isActive ? "✅ 활성" : "❌ 비활성"}`);

      if (isActive) {
        activeModuleButtons.push({
          text: btn.text,
          callback_data: btn.callback,
        });
      }
    }

    // 🏗️ 키보드 배치 (2열)
    const keyboard = [];
    for (let i = 0; i < activeModuleButtons.length; i += 2) {
      const row = [activeModuleButtons[i]];
      if (i + 1 < activeModuleButtons.length) {
        row.push(activeModuleButtons[i + 1]);
      }
      keyboard.push(row);
    }

    // 🔧 시스템 메뉴 추가
    keyboard.push([
      { text: "📊 시스템 상태", callback_data: "system:status" },
      { text: "❓ 도움말", callback_data: "system:help" },
    ]);

    logger.info(
      `🎨 메인 메뉴 키보드 생성 완료: 활성 모듈 ${activeModuleButtons.length}개`
    );

    return { inline_keyboard: keyboard };
  }

  // 🔍 모듈 클래스 찾기
  findModuleClass(moduleKey) {
    // 🎯 정확한 매핑 테이블
    const moduleMapping = {
      // 시스템
      system: "SystemModule",
      main: "SystemModule",
      help: "SystemModule",

      // 핵심 모듈들
      todo: "TodoModule",
      fortune: "FortuneModule",
      weather: "WeatherModule",
      timer: "TimerModule",
      utils: "UtilsModule",
      leave: "LeaveModule",
      worktime: "WorktimeModule",
      reminder: "ReminderModule",

      // 별칭들
      할일: "TodoModule",
      운세: "FortuneModule",
      날씨: "WeatherModule",
      타이머: "TimerModule",
    };

    const moduleClass = moduleMapping[moduleKey.toLowerCase()];

    if (moduleClass) {
      logger.debug(`🔍 모듈 매핑: ${moduleKey} → ${moduleClass}`);
    } else {
      logger.warn(`❌ 알 수 없는 모듈: ${moduleKey}`);
    }

    return moduleClass;
  }
  /**
   * 🚨 TodoModule 에러 특별 처리
   */
  async handleTodoModuleError(callbackQuery) {
    try {
      const errorText = `🚨 **할일 관리 모듈 오류**

할일 관리 기능에 일시적인 문제가 발생했습니다.

**해결 방법:**
1. 잠시 후 다시 시도해주세요
2. /start 명령어로 봇을 재시작해보세요
3. 문제가 지속되면 관리자에게 문의하세요

**임시 대안:**
• 메모장에 할일을 적어두세요
• 다른 기능들은 정상 작동합니다`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 다시 시도", callback_data: "todo:menu" },
            { text: "🔙 메인 메뉴", callback_data: "main:menu" },
          ],
        ],
      };

      await this.bot.editMessageText(errorText, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      logger.error("🚨 TodoModule 특별 에러 처리 완료");
    } catch (error) {
      logger.error("TodoModule 에러 처리 실패:", error);
    }
  }
  /**
   * 📦 모듈 로드 (🔧 디버깅 강화)
   */
  async loadModules() {
    logger.info("📦 모듈 로딩 시작...");

    // 🎯 TodoModule 우선 로딩
    await this.loadPriorityModule("todo");

    // 나머지 모듈들 로딩
    for (const [key, config] of Object.entries(this.moduleRegistry)) {
      if (key !== "todo") {
        // todo는 이미 로딩했으므로 스킵
        await this.loadSingleModule(key, config);
      }
    }

    // 📊 로딩 결과 요약
    this.logLoadingResults();
  }

  /**
   * 🎯 우선순위 모듈 로딩 (TodoModule)
   */
  async loadPriorityModule(moduleKey) {
    logger.info(`🎯 우선순위 모듈 로딩: ${moduleKey}`);

    const config = this.moduleRegistry[moduleKey];
    if (!config) {
      logger.error(`❌ 우선순위 모듈 설정 없음: ${moduleKey}`);
      return;
    }

    await this.loadSingleModule(moduleKey, config, true);
  }

  /**
   * 📦 개별 모듈 로딩
   */
  async loadSingleModule(key, config, isPriority = false) {
    const prefix = isPriority ? "🎯" : "📦";

    try {
      logger.info(`${prefix} ${config.class} 로딩 시작...`);

      // 1단계: 클래스 파일 로드
      let ModuleClass;
      try {
        ModuleClass = require(config.path);
        logger.debug(`✅ 클래스 파일 로드 성공: ${config.path}`);
      } catch (requireError) {
        logger.error(
          `❌ 클래스 파일 로드 실패 (${config.class}):`,
          requireError.message
        );
        return;
      }

      // 2단계: 인스턴스 생성
      let moduleInstance;
      try {
        moduleInstance = new ModuleClass(this.bot, {
          dbManager: this.db,
          moduleManager: this,
        });
        logger.debug(`✅ 인스턴스 생성 성공: ${config.class}`);
      } catch (constructorError) {
        logger.error(
          `❌ 인스턴스 생성 실패 (${config.class}):`,
          constructorError.message
        );
        return;
      }

      // 3단계: 초기화
      if (moduleInstance.initialize) {
        try {
          await moduleInstance.initialize();
          logger.debug(`✅ 초기화 완료: ${config.class}`);
        } catch (initError) {
          logger.error(`❌ 초기화 실패 (${config.class}):`, initError.message);
          return;
        }
      } else {
        logger.warn(`⚠️ ${config.class}에 initialize 메서드 없음`);
      }

      // 4단계: 등록
      this.moduleInstances.set(config.class, moduleInstance);
      logger.success(`${prefix} ${config.class} 로딩 완료 ✅`);

      // 🎯 TodoModule 특별 검증
      if (key === "todo") {
        await this.validateTodoModule(moduleInstance);
      }
    } catch (error) {
      logger.error(`❌ ${config.class} 로딩 실패:`, error);
    }
  }

  /**
   * 🔍 TodoModule 특별 검증
   */
  async validateTodoModule(todoInstance) {
    logger.info("🔍 TodoModule 특별 검증 시작...");

    try {
      // 기본 메서드 존재 확인
      const requiredMethods = ["handleCallback", "showMenu", "showTodoList"];
      const missingMethods = [];

      for (const method of requiredMethods) {
        if (typeof todoInstance[method] !== "function") {
          missingMethods.push(method);
        }
      }

      if (missingMethods.length > 0) {
        logger.error(
          `❌ TodoModule 필수 메서드 누락: ${missingMethods.join(", ")}`
        );
        return false;
      }

      // TodoService 연결 확인
      if (!todoInstance.todoService) {
        logger.error("❌ TodoModule의 todoService가 연결되지 않음");
        return false;
      }

      // 간단한 기능 테스트
      if (typeof todoInstance.todoService.getUserTodos === "function") {
        logger.debug("✅ TodoService 메서드 접근 가능");
      } else {
        logger.error("❌ TodoService 메서드에 접근할 수 없음");
        return false;
      }

      logger.success("✅ TodoModule 검증 완료!");
      return true;
    } catch (error) {
      logger.error("❌ TodoModule 검증 실패:", error);
      return false;
    }
  }

  /**
   * 📊 로딩 결과 요약
   */
  logLoadingResults() {
    const totalModules = Object.keys(this.moduleRegistry).length;
    const loadedModules = this.moduleInstances.size;
    const failedModules = totalModules - loadedModules;

    logger.info(`📊 모듈 로딩 완료:`);
    logger.info(`   ✅ 성공: ${loadedModules}개`);
    logger.info(`   ❌ 실패: ${failedModules}개`);
    logger.info(
      `   📈 성공률: ${Math.round((loadedModules / totalModules) * 100)}%`
    );

    // 🎯 중요한 모듈들 개별 확인
    const criticalModules = ["TodoModule", "SystemModule", "FortuneModule"];
    logger.info(`🎯 핵심 모듈 상태:`);

    for (const moduleName of criticalModules) {
      const isLoaded = this.moduleInstances.has(moduleName);
      const status = isLoaded ? "✅ 로딩됨" : "❌ 실패";
      logger.info(`   ${moduleName}: ${status}`);
    }

    // 📝 등록된 모든 모듈 목록
    if (loadedModules > 0) {
      const moduleList = Array.from(this.moduleInstances.keys()).join(", ");
      logger.debug(`📝 로딩된 모듈들: ${moduleList}`);
    }
  }

  /**
   * ❌ 모듈 없음 메시지 (🔧 사용자 친화적 개선)
   */
  async sendModuleNotFoundMessage(callbackQuery) {
    try {
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: "⚠️ 해당 기능을 찾을 수 없습니다.",
        show_alert: false,
      });

      if (callbackQuery.message) {
        const unavailableText = `⚠️ **기능을 찾을 수 없음**

요청하신 기능이 현재 비활성화되어 있거나 
존재하지 않습니다.

**사용 가능한 기능:**
📝 할일 관리 • 🔮 운세 확인 • 🌤️ 날씨 조회
⏰ 타이머 • 🛠️ 유틸리티 • 📊 시스템 상태

메인 메뉴에서 다른 기능을 선택해주세요.`;

        await this.bot.editMessageText(unavailableText, {
          chat_id: callbackQuery.message.chat.id,
          message_id: callbackQuery.message.message_id,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 메인 메뉴", callback_data: "main:menu" }],
            ],
          },
        });
      }
    } catch (error) {
      logger.error("모듈 없음 메시지 전송 실패:", error);
    }
  }

  // 🕐 시간 포맷
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}일 ${hours}시간 ${minutes}분`;
    } else if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else {
      return `${minutes}분`;
    }
  }

  // 📊 상태 조회
  getStatus() {
    const moduleStatuses = {};
    for (const [name, module] of this.moduleInstances) {
      moduleStatuses[name] = module.getStats
        ? module.getStats()
        : { active: true };
    }

    return {
      initialized: this.isInitialized,
      totalModules: this.moduleInstances.size,
      activeCallbacks: this.processingCallbacks.size,
      modules: moduleStatuses,
    };
  }

  // 🧹 정리
  async cleanup() {
    logger.info("🧹 ModuleManager 정리 시작...");

    for (const [name, module] of this.moduleInstances) {
      try {
        if (module.cleanup) {
          await module.cleanup();
        }
        logger.debug(`✅ ${name} 정리 완료`);
      } catch (error) {
        logger.error(`❌ ${name} 정리 실패:`, error);
      }
    }

    this.moduleInstances.clear();
    this.processingCallbacks.clear();
    this.isInitialized = false;

    logger.info("✅ ModuleManager 정리 완료");
  }
}

// --------------- 디버깅 --------------

module.exports = ModuleManager;
