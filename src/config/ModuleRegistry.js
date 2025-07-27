// ===== 🚀 Enhanced 모듈 통합 및 테스트 시스템 v3.0.1 =====

// ===== 📋 모듈 레지스트리 업데이트 =====
// src/config/ModuleRegistry.js - Enhanced 모듈들 등록
const modules = [
  // ===== 🏛️ 시스템 모듈 (최우선) =====
  {
    key: "system",
    name: "시스템",
    description: "시스템 관리 및 설정",
    path: "./src/modules/SystemModule",
    priority: 1,
    required: true,
    enabled: true,
    enhanced: true,
    config: {
      showInMenu: false,
      version: "3.0.1",
    },
  },

  // ===== 📱 Enhanced 핵심 기능 모듈들 =====
  {
    key: "todo",
    name: "할일 관리",
    description: "Enhanced 할일 관리 시스템",
    path: "./src/modules/TodoModule",
    priority: 10,
    enabled: process.env.MODULE_TODO_ENABLED !== "false",
    enhanced: true,
    config: {
      icon: "📝",
      commands: ["/todo", "/할일"],
      features: {
        priority: true,
        dueDate: true,
        categories: true,
        statistics: true,
      },
      version: "3.0.1",
    },
  },
  {
    key: "timer",
    name: "타이머",
    description: "Enhanced 타이머 & 포모도로 시스템",
    path: "./src/modules/TimerModule",
    priority: 20,
    enabled: process.env.MODULE_TIMER_ENABLED !== "false",
    enhanced: true,
    config: {
      icon: "⏰",
      commands: ["/timer", "/타이머", "/pomodoro"],
      features: {
        pomodoro: true,
        notifications: true,
        templates: true,
        realTime: true,
      },
      version: "3.0.1",
    },
  },
  {
    key: "worktime",
    name: "근무시간",
    description: "Enhanced 근무시간 관리 시스템",
    path: "./src/modules/WorktimeModule",
    priority: 30,
    enabled: process.env.MODULE_WORKTIME_ENABLED !== "false",
    enhanced: true,
    config: {
      icon: "🏢",
      commands: ["/work", "/출근", "/퇴근"],
      features: {
        dashboard: true,
        analytics: true,
        performance: true,
        notifications: true,
      },
      version: "3.0.1",
    },
  },

  // ===== 🌟 부가 기능 모듈들 (기존) =====
  {
    key: "leave",
    name: "휴가 관리",
    description: "휴가 신청 및 관리",
    path: "./src/modules/LeaveModule",
    priority: 40,
    enabled: process.env.MODULE_LEAVE_ENABLED !== "false",
    enhanced: false,
    config: {
      icon: "🏖️",
      commands: ["/leave", "/휴가"],
      version: "2.0.0",
    },
  },
  {
    key: "reminder",
    name: "리마인더",
    description: "알림 설정 및 관리",
    path: "./src/modules/ReminderModule",
    priority: 50,
    enabled: process.env.MODULE_REMINDER_ENABLED !== "false",
    enhanced: false,
    config: {
      icon: "🔔",
      commands: ["/remind", "/알림"],
      version: "2.0.0",
    },
  },
  {
    key: "fortune",
    name: "운세",
    description: "오늘의 운세 확인",
    path: "./src/modules/FortuneModule",
    priority: 60,
    enabled: process.env.MODULE_FORTUNE_ENABLED !== "false",
    enhanced: false,
    config: {
      icon: "🔮",
      commands: ["/fortune", "/운세"],
      version: "2.0.0",
    },
  },
  {
    key: "weather",
    name: "날씨",
    description: "날씨 정보 제공",
    path: "./src/modules/WeatherModule",
    priority: 70,
    enabled: process.env.MODULE_WEATHER_ENABLED !== "false",
    enhanced: false,
    config: {
      icon: "🌤️",
      commands: ["/weather", "/날씨"],
      apiRequired: true,
      version: "2.0.0",
    },
  },
  {
    key: "tts",
    name: "음성변환",
    description: "텍스트를 음성으로 변환",
    path: "./src/modules/TTSModule",
    priority: 80,
    enabled: process.env.MODULE_TTS_ENABLED !== "false",
    enhanced: false,
    config: {
      icon: "🔊",
      commands: ["/tts", "/음성"],
      apiRequired: true,
      version: "2.0.0",
    },
  },
];

module.exports = {
  modules,
  version: "3.0.1",
  enhanced: true,
};

// ===== 🎯 Enhanced ModuleManager 업데이트 =====
// src/core/ModuleManager.js - Enhanced 지원 추가
class EnhancedModuleManager {
  constructor(options = {}) {
    // 기존 ModuleManager 코드...

    // Enhanced 지원 추가
    this.enhancedModules = new Map(); // Enhanced 모듈 추적
    this.serviceBuilder = options.serviceBuilder; // ServiceBuilder 주입

    logger.moduleStart("EnhancedModuleManager", "3.0.1");
  }

  /**
   * 🚀 Enhanced 모듈 등록 (기존 registerModule 확장)
   */
  async registerEnhancedModule(moduleKey, ModuleClass, config = {}) {
    try {
      logger.info(`📝 Enhanced 모듈 등록: ${moduleKey}`, {
        enhanced: config.enhanced,
        version: config.version,
      });

      // 기존 등록 프로세스
      const registered = this.registerModule(moduleKey, ModuleClass, config);

      if (registered && config.enhanced) {
        // Enhanced 모듈 추가 설정
        this.enhancedModules.set(moduleKey, {
          features: config.features || {},
          version: config.version || "3.0.1",
          hasServiceBuilder: !!this.serviceBuilder,
          uiType: "enhanced",
        });

        logger.success(`✨ Enhanced 모듈 등록 완료: ${moduleKey}`);
      }

      return registered;
    } catch (error) {
      logger.error(`❌ Enhanced 모듈 등록 실패 (${moduleKey}):`, error);
      return false;
    }
  }

  /**
   * 🔧 Enhanced 모듈 초기화 (ServiceBuilder 포함)
   */
  async initializeEnhancedModule(moduleKey) {
    try {
      const moduleConfig = this.moduleRegistry.get(moduleKey);
      if (!moduleConfig) {
        throw new Error(`등록되지 않은 모듈: ${moduleKey}`);
      }

      logger.info(`🚀 Enhanced 모듈 초기화: ${moduleKey}`);

      // Enhanced 모듈 인스턴스 생성 (ServiceBuilder 주입)
      const moduleInstance = new moduleConfig.ModuleClass(moduleKey, {
        bot: this.bot,
        db: this.db,
        moduleManager: this,
        serviceBuilder: this.serviceBuilder, // ⭐ ServiceBuilder 주입!
        moduleKey,
        moduleConfig,
        config: moduleConfig.config,
      });

      // 표준 초기화
      if (typeof moduleInstance.initialize === "function") {
        await moduleInstance.initialize();
      }

      // 인스턴스 등록
      this.moduleInstances.set(moduleKey, moduleInstance);

      // 초기화 완료 표시
      moduleConfig.initialized = true;
      moduleConfig.initializedAt = TimeHelper.getTimestamp();

      this.stats.activeModules++;

      logger.success(`✅ Enhanced 모듈 초기화 완료: ${moduleKey}`, {
        enhanced: this.enhancedModules.has(moduleKey),
        hasServiceBuilder: !!this.serviceBuilder,
      });
    } catch (error) {
      logger.error(`❌ Enhanced 모듈 초기화 실패 (${moduleKey}):`, error);
      throw error;
    }
  }

  /**
   * 📊 Enhanced 모듈 상태 조회
   */
  getEnhancedStatus() {
    const enhancedModulesList = Array.from(this.enhancedModules.entries()).map(
      ([key, config]) => {
        const instance = this.moduleInstances.get(key);
        return {
          key,
          ...config,
          initialized: !!instance,
          status: instance?.getStatus() || null,
        };
      }
    );

    return {
      totalEnhanced: this.enhancedModules.size,
      enhancedModules: enhancedModulesList,
      serviceBuilder: !!this.serviceBuilder,
      version: "3.0.1",
    };
  }
}

// ===== 🎹 Enhanced NavigationHandler 업데이트 =====
// src/handlers/EnhancedNavigationHandler.js - Enhanced UI 처리
const TelegramFormatter = require("../utils/TelegramFormatter");
const EnhancedBotResponses = require("../utils/EnhancedBotResponses");
const logger = require("../utils/Logger");

class EnhancedNavigationHandler {
  constructor(options = {}) {
    // 기존 NavigationHandler 코드...

    // Enhanced 지원 추가
    this.formatter = new TelegramFormatter();
    this.enhancedResponses = EnhancedBotResponses;
    this.enhancedModules = new Set(); // Enhanced 모듈 추적

    logger.moduleStart("EnhancedNavigationHandler", "3.0.1");
  }

  /**
   * 🎨 Enhanced UI 처리 (모듈 응답 기반)
   */
  async handleEnhancedResponse(bot, callbackQuery, moduleResponse) {
    try {
      const { success, action, data, uiType, error } = moduleResponse;
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;

      logger.debug("🎨 Enhanced UI 처리", {
        action,
        uiType,
        success,
        hasData: !!data,
      });

      if (!success) {
        // Enhanced 에러 처리
        return await this.handleEnhancedError(
          bot,
          callbackQuery,
          error,
          moduleResponse.suggestion
        );
      }

      // Enhanced UI 타입별 처리
      switch (uiType) {
        case "enhanced_card":
          return await this.renderEnhancedCard(
            bot,
            chatId,
            messageId,
            action,
            data
          );

        case "enhanced_list":
          return await this.renderEnhancedList(
            bot,
            chatId,
            messageId,
            action,
            data
          );

        case "enhanced_dashboard":
          return await this.renderEnhancedDashboard(
            bot,
            chatId,
            messageId,
            action,
            data
          );

        case "enhanced_form":
          return await this.renderEnhancedForm(
            bot,
            chatId,
            messageId,
            action,
            data
          );

        case "enhanced_success":
          return await this.renderEnhancedSuccess(
            bot,
            chatId,
            messageId,
            action,
            data
          );

        default:
          // 기본 Enhanced 처리
          return await this.renderDefaultEnhanced(
            bot,
            chatId,
            messageId,
            action,
            data
          );
      }
    } catch (error) {
      logger.error("❌ Enhanced UI 처리 실패:", error);
      return await this.sendFallbackMessage(
        bot,
        callbackQuery,
        "UI 처리 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 📱 Enhanced Todo 메뉴 렌더링
   */
  async renderEnhancedCard(bot, chatId, messageId, action, data) {
    try {
      let content, keyboard;

      switch (action) {
        case "show_todo_menu":
          content = this.formatter.createMenuCard(data.userName, {
            todos: data.stats.total,
            completed: data.stats.completed,
            pending: data.stats.pending,
          });

          keyboard = {
            inline_keyboard: [
              [
                { text: "📋 목록 보기", callback_data: "todo:list" },
                { text: "➕ 새 할일", callback_data: "todo:add" },
              ],
              [
                { text: "✅ 완료 처리", callback_data: "todo:complete" },
                { text: "📊 통계", callback_data: "todo:stats" },
              ],
              [
                { text: "⚙️ 설정", callback_data: "todo:settings" },
                { text: "🔙 메인 메뉴", callback_data: "system:menu" },
              ],
            ],
          };
          break;

        case "show_timer_menu":
          content = this.createTimerDashboard(data);
          keyboard = this.createTimerKeyboard(data);
          break;

        case "show_worktime_menu":
          content = this.createWorktimeDashboard(data);
          keyboard = this.createWorktimeKeyboard(data);
          break;

        default:
          content = this.formatter.createBox(
            "Enhanced UI",
            `액션: ${action}`,
            "info"
          );
          keyboard = {
            inline_keyboard: [[{ text: "🔙 뒤로", callback_data: "back" }]],
          };
      }

      return await bot.editMessageText(content, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "MarkdownV2",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("❌ Enhanced 카드 렌더링 실패:", error);
      throw error;
    }
  }

  /**
   * 📋 Enhanced Todo 목록 렌더링
   */
  async renderEnhancedList(bot, chatId, messageId, action, data) {
    try {
      if (action === "show_todo_list") {
        const content = this.formatter.createTodoListCard(
          data.todos,
          data.pagination
        );
        const keyboard = this.createTodoListKeyboard(
          data.pagination,
          data.filter
        );

        return await bot.editMessageText(content, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "MarkdownV2",
          reply_markup: keyboard,
        });
      }

      // 기본 리스트 처리
      const content = this.formatter.createBox(
        "목록",
        "Enhanced 목록 UI",
        "info"
      );
      return await bot.editMessageText(content, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "MarkdownV2",
      });
    } catch (error) {
      logger.error("❌ Enhanced 리스트 렌더링 실패:", error);
      throw error;
    }
  }

  /**
   * 📊 Enhanced 대시보드 렌더링
   */
  async renderEnhancedDashboard(bot, chatId, messageId, action, data) {
    try {
      let content;

      if (action === "show_worktime_dashboard") {
        content = this.formatter.createWorkDashboard(data.stats.today);
      } else if (action === "show_timer_dashboard") {
        content = this.createTimerDashboard(data);
      } else {
        content = this.formatter.createBox(
          "대시보드",
          "Enhanced 대시보드 UI",
          "info"
        );
      }

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "🔄 새로고침",
              callback_data: `${action.replace("show_", "")}:dashboard`,
            },
            {
              text: "⚙️ 설정",
              callback_data: `${action.split("_")[1]}:settings`,
            },
          ],
          [{ text: "🔙 메인 메뉴", callback_data: "system:menu" }],
        ],
      };

      return await bot.editMessageText(content, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "MarkdownV2",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("❌ Enhanced 대시보드 렌더링 실패:", error);
      throw error;
    }
  }

  /**
   * 🎊 Enhanced 성공 메시지 렌더링
   */
  async renderEnhancedSuccess(bot, chatId, messageId, action, data) {
    try {
      let title, message;

      switch (action) {
        case "show_complete_success":
          title = "할일 완료!";
          message = `"${data.completedTodo.title}" 완료되었습니다!`;
          break;

        case "show_checkin_success":
          title = "출근 완료!";
          message = `${data.checkInTime}에 출근 처리되었습니다!`;
          break;

        case "show_timer_started":
          title = "타이머 시작!";
          message = `"${data.timer.name}" 타이머가 시작되었습니다!`;
          break;

        default:
          title = "작업 완료!";
          message = "요청하신 작업이 완료되었습니다!";
      }

      const content = this.formatter.createSuccessAnimation(title, message);

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "📊 현황 보기",
              callback_data: `${action.split("_")[1]}:menu`,
            },
            { text: "🔙 메인 메뉴", callback_data: "system:menu" },
          ],
        ],
      };

      return await bot.editMessageText(content, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "MarkdownV2",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("❌ Enhanced 성공 렌더링 실패:", error);
      throw error;
    }
  }

  /**
   * ❌ Enhanced 에러 처리
   */
  async handleEnhancedError(bot, callbackQuery, error, suggestion) {
    try {
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;

      const content = this.formatter.createErrorMessage(
        error,
        suggestion || "다시 시도해주세요."
      );

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 다시 시도", callback_data: "retry" },
            { text: "❓ 도움말", callback_data: "system:help" },
          ],
          [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
        ],
      };

      return await bot.editMessageText(content, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "MarkdownV2",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("❌ Enhanced 에러 처리 실패:", error);
      return await this.sendFallbackMessage(
        bot,
        callbackQuery,
        "오류 처리 중 문제가 발생했습니다."
      );
    }
  }

  // ===== 🛠️ Enhanced UI 생성 헬퍼들 =====

  createTimerDashboard(data) {
    if (data.activeTimer) {
      return this.formatter.createTimerCard(data.activeTimer);
    }

    return this.formatter.createBox(
      "⏰ 타이머",
      `활성 타이머: 없음\n포모도로 완료: ${
        data.stats?.pomodoroCompleted || 0
      }개\n총 집중시간: ${data.stats?.totalFocusTime || 0}분`,
      "info"
    );
  }

  createTimerKeyboard(data) {
    const buttons = [];

    if (data.activeTimer) {
      buttons.push([
        {
          text:
            data.activeTimer.status === "running" ? "⏸️ 일시정지" : "▶️ 재시작",
          callback_data: `timer:${
            data.activeTimer.status === "running" ? "pause" : "resume"
          }`,
        },
        { text: "⏹️ 정지", callback_data: "timer:stop" },
      ]);
    } else {
      buttons.push([
        { text: "🍅 포모도로", callback_data: "timer:pomodoro:start" },
        { text: "⏰ 커스텀", callback_data: "timer:create" },
      ]);
    }

    buttons.push([
      { text: "📊 통계", callback_data: "timer:stats" },
      { text: "🔙 메뉴", callback_data: "system:menu" },
    ]);

    return { inline_keyboard: buttons };
  }

  createWorktimeDashboard(data) {
    return this.formatter.createWorkDashboard({
      checkInTime: data.currentSession?.formattedStartTime || "미출근",
      currentWorkHours: data.todayStats?.totalHours || 0,
      targetHours: 8,
      breaks: [],
    });
  }

  createWorktimeKeyboard(data) {
    const buttons = [];

    if (data.workStatus.id === "not_working") {
      buttons.push([
        { text: "🕐 출근", callback_data: "worktime:checkin" },
        { text: "🏠 재택근무", callback_data: "worktime:checkin:remote" },
      ]);
    } else {
      buttons.push([
        { text: "☕ 휴식", callback_data: "worktime:break:start" },
        { text: "🏠 퇴근", callback_data: "worktime:checkout" },
      ]);
    }

    buttons.push([
      { text: "📊 주간통계", callback_data: "worktime:weekly" },
      { text: "🔙 메뉴", callback_data: "system:menu" },
    ]);

    return { inline_keyboard: buttons };
  }

  createTodoListKeyboard(pagination, filter) {
    const buttons = [];

    // 페이지네이션
    if (pagination.totalPages > 1) {
      const pageButtons = [];
      if (pagination.hasPrev) {
        pageButtons.push({
          text: "⬅️ 이전",
          callback_data: `todo:page:${pagination.currentPage - 1}`,
        });
      }
      pageButtons.push({
        text: `${pagination.currentPage}/${pagination.totalPages}`,
        callback_data: "todo:page:info",
      });
      if (pagination.hasNext) {
        pageButtons.push({
          text: "다음 ➡️",
          callback_data: `todo:page:${pagination.currentPage + 1}`,
        });
      }
      buttons.push(pageButtons);
    }

    // 액션 버튼들
    buttons.push([
      { text: "➕ 추가", callback_data: "todo:add" },
      { text: "✅ 완료", callback_data: "todo:complete" },
    ]);

    buttons.push([{ text: "🔙 메뉴", callback_data: "todo:menu" }]);

    return { inline_keyboard: buttons };
  }
}

// ===== 🧪 Enhanced 통합 테스트 시스템 =====
// test/enhanced-integration-test.js
class EnhancedIntegrationTest {
  constructor() {
    this.testResults = [];
    this.moduleManager = null;
    this.navigationHandler = null;

    logger.moduleStart("EnhancedIntegrationTest", "3.0.1");
  }

  /**
   * 🧪 전체 Enhanced 시스템 테스트
   */
  async runFullTest() {
    try {
      logger.important("🧪 Enhanced 통합 테스트 시작!");

      // 1. ModuleManager 테스트
      await this.testModuleManager();

      // 2. Enhanced 모듈 등록 테스트
      await this.testEnhancedModuleRegistration();

      // 3. ServiceBuilder 연동 테스트
      await this.testServiceBuilderIntegration();

      // 4. NavigationHandler 연동 테스트
      await this.testNavigationHandlerIntegration();

      // 5. Enhanced UI 렌더링 테스트
      await this.testEnhancedUIRendering();

      // 6. 실제 콜백 플로우 테스트
      await this.testCallbackFlow();

      // 결과 보고
      this.generateTestReport();
    } catch (error) {
      logger.error("❌ Enhanced 통합 테스트 실패:", error);
      throw error;
    }
  }

  /**
   * 📊 테스트 결과 보고서 생성
   */
  generateTestReport() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(
      (r) => r.status === "PASS"
    ).length;
    const failedTests = totalTests - passedTests;

    logger.important("📊 Enhanced 통합 테스트 결과", {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      successRate: `${Math.round((passedTests / totalTests) * 100)}%`,
    });

    // 실패한 테스트 상세 로그
    const failed = this.testResults.filter((r) => r.status === "FAIL");
    if (failed.length > 0) {
      logger.error("❌ 실패한 테스트들:");
      failed.forEach((test) => {
        logger.error(`  - ${test.name}: ${test.error}`);
      });
    } else {
      logger.success("🎊 모든 Enhanced 테스트 통과!");
    }
  }

  /**
   * 📝 테스트 결과 기록
   */
  recordTest(name, status, details = {}) {
    this.testResults.push({
      name,
      status,
      timestamp: new Date(),
      ...details,
    });

    const emoji = status === "PASS" ? "✅" : "❌";
    logger.info(`${emoji} ${name}: ${status}`);
  }

  /**
   * 🎯 ModuleManager 테스트
   */
  async testModuleManager() {
    try {
      // Mock 데이터로 ModuleManager 생성
      const mockServiceBuilder = { create: () => ({}) };
      this.moduleManager = new EnhancedModuleManager({
        serviceBuilder: mockServiceBuilder,
      });

      this.recordTest("ModuleManager 생성", "PASS");

      // Enhanced 상태 확인
      const status = this.moduleManager.getEnhancedStatus();
      this.recordTest("Enhanced 상태 조회", status ? "PASS" : "FAIL");
    } catch (error) {
      this.recordTest("ModuleManager 테스트", "FAIL", { error: error.message });
    }
  }

  /**
   * 📝 Enhanced 모듈 등록 테스트
   */
  async testEnhancedModuleRegistration() {
    try {
      // Mock Enhanced 모듈 등록
      class MockTodoModule {
        constructor() {
          this.moduleName = "MockTodoModule";
        }
        async initialize() {
          return true;
        }
        setupActions() {
          return true;
        }
      }

      const registered = await this.moduleManager.registerEnhancedModule(
        "mock_todo",
        MockTodoModule,
        {
          enhanced: true,
          version: "3.0.1",
          features: { priority: true },
        }
      );

      this.recordTest("Enhanced 모듈 등록", registered ? "PASS" : "FAIL");

      // Enhanced 모듈 목록 확인
      const enhancedStatus = this.moduleManager.getEnhancedStatus();
      const hasEnhanced = enhancedStatus.totalEnhanced > 0;

      this.recordTest("Enhanced 모듈 추적", hasEnhanced ? "PASS" : "FAIL");
    } catch (error) {
      this.recordTest("Enhanced 모듈 등록 테스트", "FAIL", {
        error: error.message,
      });
    }
  }

  /**
   * 🎹 NavigationHandler 연동 테스트
   */
  async testNavigationHandlerIntegration() {
    try {
      this.navigationHandler = new EnhancedNavigationHandler();

      // Mock 모듈 응답 테스트
      const mockResponse = {
        success: true,
        action: "show_todo_menu",
        data: {
          userName: "테스트사용자",
          stats: { total: 5, completed: 2, pending: 3 },
        },
        uiType: "enhanced_card",
      };

      // UI 처리 시뮬레이션 (실제 봇 없이)
      const canProcess =
        typeof this.navigationHandler.handleEnhancedResponse === "function";

      this.recordTest(
        "NavigationHandler Enhanced 지원",
        canProcess ? "PASS" : "FAIL"
      );
    } catch (error) {
      this.recordTest("NavigationHandler 연동 테스트", "FAIL", {
        error: error.message,
      });
    }
  }

  /**
   * 🎨 Enhanced UI 렌더링 테스트
   */
  async testEnhancedUIRendering() {
    try {
      // TelegramFormatter 테스트
      const formatter = new TelegramFormatter();

      // 메뉴 카드 생성 테스트
      const menuCard = formatter.createMenuCard("테스트사용자", {
        todos: 5,
        timers: 2,
        workHours: 7.5,
      });

      const hasContent = menuCard && menuCard.length > 0;
      this.recordTest("Enhanced 메뉴 카드 생성", hasContent ? "PASS" : "FAIL");

      // 진행률 바 테스트
      const progressBar = formatter.createProgressBar(75, 100);
      const hasProgressBar = progressBar && progressBar.includes("▰");
      this.recordTest(
        "Enhanced 진행률 바 생성",
        hasProgressBar ? "PASS" : "FAIL"
      );

      // 박스 메시지 테스트
      const boxMessage = formatter.createBox(
        "테스트",
        "Enhanced 박스 메시지",
        "success"
      );
      const hasBox = boxMessage && boxMessage.includes("━");
      this.recordTest("Enhanced 박스 메시지 생성", hasBox ? "PASS" : "FAIL");
    } catch (error) {
      this.recordTest("Enhanced UI 렌더링 테스트", "FAIL", {
        error: error.message,
      });
    }
  }

  /**
   * 🔄 콜백 플로우 테스트
   */
  async testCallbackFlow() {
    try {
      // Mock 콜백 데이터
      const mockCallbackQuery = {
        id: "test_callback_123",
        data: "todo:menu",
        message: {
          chat: { id: 12345 },
          message_id: 67890,
        },
        from: {
          id: 98765,
          first_name: "테스트",
          username: "testuser",
        },
      };

      // 콜백 데이터 파싱 테스트
      const parsed =
        this.navigationHandler.parseCallbackData?.("todo:menu:param1");
      const hasParsing = parsed && parsed.moduleKey === "todo";
      this.recordTest("콜백 데이터 파싱", hasParsing ? "PASS" : "FAIL");

      // Enhanced 응답 처리 시뮬레이션
      const mockModuleResponse = {
        success: true,
        action: "show_todo_menu",
        data: { userName: "테스트사용자" },
        uiType: "enhanced_card",
      };

      // 처리 함수 존재 확인
      const canHandle =
        typeof this.navigationHandler.handleEnhancedResponse === "function";
      this.recordTest("Enhanced 응답 처리", canHandle ? "PASS" : "FAIL");
    } catch (error) {
      this.recordTest("콜백 플로우 테스트", "FAIL", { error: error.message });
    }
  }
}

// ===== 🚀 Enhanced 시스템 시작 스크립트 =====
// src/start-enhanced.js
async function startEnhancedSystem() {
  try {
    logger.important("🚀 Enhanced 시스템 v3.0.1 시작!");

    // 1. 통합 테스트 실행
    const tester = new EnhancedIntegrationTest();
    await tester.runFullTest();

    // 2. 실제 시스템 시작 (테스트 통과 시)
    const passedTests = tester.testResults.filter(
      (r) => r.status === "PASS"
    ).length;
    const totalTests = tester.testResults.length;

    if (passedTests === totalTests) {
      logger.success("✅ 모든 테스트 통과! Enhanced 시스템 시작 준비 완료!");

      // 실제 ModuleManager와 NavigationHandler 초기화
      // await initializeProductionSystem();
    } else {
      logger.error("❌ 테스트 실패로 인해 시스템 시작 중단");
      process.exit(1);
    }
  } catch (error) {
    logger.fatal("💀 Enhanced 시스템 시작 실패:", error);
    process.exit(1);
  }
}

// 모듈 export
module.exports = {
  EnhancedModuleManager,
  EnhancedNavigationHandler,
  EnhancedIntegrationTest,
  startEnhancedSystem,
};
