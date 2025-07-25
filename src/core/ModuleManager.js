// src/core/ModuleManager.js - 타이머 이벤트 처리 추가

const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 중앙 모듈 관리자
 * - 모든 모듈의 생명주기 관리
 * - 콜백 라우팅 중앙 처리
 * - 중복 처리 방지
 * - ✅ 타이머 이벤트 처리 추가
 */
class ModuleManager {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.db = options.db || null;
    this.moduleInstances = new Map();
    this.isInitialized = false;

    // 중복 처리 방지를 위한 Set
    this.processingCallbacks = new Set();

    // ✅ 서비스 인스턴스 참조 저장
    this.services = {
      timerService: null,
      reminderService: null,
      // 다른 서비스들...
    };

    // 모듈 레지스트리
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

  /**
   * 모듈 매니저 초기화
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn("ModuleManager 이미 초기화됨");
      return;
    }

    try {
      logger.info("⚙️ ModuleManager 초기화 시작...");

      // 모든 모듈 로드
      await this.loadModules();

      // ✅ 서비스 이벤트 리스너 설정
      this.setupServiceEventListeners();

      this.isInitialized = true;
      logger.success(
        `✅ ModuleManager 초기화 완료 (${this.moduleInstances.size}개 모듈)`
      );
    } catch (error) {
      logger.error("❌ ModuleManager 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 모든 모듈 로드
   */
  async loadModules() {
    for (const [key, config] of Object.entries(this.moduleRegistry)) {
      try {
        logger.info(`📦 ${config.class} 모듈 생성 중...`);

        const ModuleClass = require(config.path);

        // ✅ DatabaseManager가 있으면 db 프로퍼티를 전달
        const dbToPass = this.db?.db || this.db;

        const moduleInstance = new ModuleClass(this.bot, {
          db: dbToPass, // MongoDB db 객체 직접 전달
          moduleManager: this,
        });

        // 모듈에도 설정
        if (dbToPass && moduleInstance) {
          moduleInstance.db = dbToPass;
        }

        // 모듈 초기화
        await moduleInstance.initialize();

        // ✅ 타이머 모듈의 서비스 참조 저장
        if (config.class === "TimerModule" && moduleInstance.timerService) {
          this.services.timerService = moduleInstance.timerService;
          logger.debug("✅ TimerService 참조 저장됨");
        }

        // ✅ 리마인더 모듈의 서비스 참조 저장
        if (
          config.class === "ReminderModule" &&
          moduleInstance.reminderService
        ) {
          this.services.reminderService = moduleInstance.reminderService;
          logger.debug("✅ ReminderService 참조 저장됨");
        }

        // ⭐ 두 가지 방식으로 저장 (호환성 유지)
        this.moduleInstances.set(key, moduleInstance); // key로 저장
        this.moduleInstances.set(config.class, moduleInstance); // class 이름으로도 저장

        logger.info(`✅ ${config.class} 로드 완료`);
      } catch (error) {
        logger.error(`❌ ${config.class} 로드 실패:`, error);
      }
    }
  }

  /**
   * ✅ 서비스 이벤트 리스너 설정 (핵심 해결책!)
   */
  setupServiceEventListeners() {
    // 🎯 타이머 완료 이벤트 처리
    if (this.services.timerService) {
      // EventEmitter의 on 메서드 사용
      this.services.timerService.on(
        "timerCompleted",
        async (completionData) => {
          await this.handleTimerCompletion(completionData);
        }
      );

      this.services.timerService.on(
        "pomodoroCompleted",
        async (completionData) => {
          await this.handlePomodoroCompletion(completionData);
        }
      );

      // 에러 이벤트도 처리
      this.services.timerService.on("timerError", (errorData) => {
        logger.error("타이머 에러:", errorData);
      });

      logger.info("🎯 타이머 이벤트 리스너 설정 완료");
    }

    // 📅 리마인더 완료 이벤트 처리 (향후 확장)
    if (this.services.reminderService) {
      logger.debug("📅 리마인더 이벤트 리스너 준비됨");
    }
  }

  /**
   * 🎯 일반 타이머 완료 처리 (사용자에게 알림 전송)
   */
  async handleTimerCompletion(completionData) {
    try {
      const {
        userId,
        taskName,
        plannedDuration,
        actualDuration,
        startTime,
        endTime,
      } = completionData;

      const completionText = `🎉 **타이머 완료!**

✅ **작업**: ${taskName}
⏱️ **계획 시간**: ${plannedDuration}분
📊 **실제 시간**: ${actualDuration}분
🕐 **시작**: ${TimeHelper.formatTime(startTime)}
🕕 **완료**: ${TimeHelper.formatTime(endTime)}

${
  actualDuration >= plannedDuration
    ? "👏 계획된 시간을 모두 채우셨네요!"
    : "⚡ 계획보다 일찍 완료하셨습니다!"
}

수고하셨습니다!`;

      // 사용자에게 메시지 전송
      if (this.bot && userId) {
        await this.bot.sendMessage(userId, completionText, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "⏰ 새 타이머", callback_data: "timer:menu" },
                { text: "📊 통계", callback_data: "timer:stats" },
              ],
              [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
            ],
          },
        });
      }
    } catch (error) {
      logger.error("타이머 완료 처리 중 오류:", error);
    }
  }

  /**
   * 🍅 포모도로 완료 처리 (사용자에게 단계별 알림 전송)
   */
  async handlePomodoroCompletion(completionData) {
    try {
      const {
        userId,
        completedMode,
        completedTask,
        actualDuration,
        nextMode,
        nextDuration,
        sessionCount,
        totalWorkTime,
        totalBreakTime,
        message,
        completionData: data,
      } = completionData;

      let completionText;
      let keyboard;

      if (completedMode === "work") {
        // 작업 완료 → 휴식 시간 안내
        completionText = `🍅 **포모도로 완료!**

${message}

📊 **현재 세션 정보:**
• 완료된 포모도로: ${sessionCount}개
• 총 작업 시간: ${totalWorkTime}분
• 총 휴식 시간: ${totalBreakTime}분

잠시 휴식을 취하세요! ☕`;

        keyboard = {
          inline_keyboard: [
            [
              {
                text: `☕ 휴식 시작 (${nextDuration}분)`,
                callback_data: `timer:pomodoro:break:${nextDuration === 15 ? "long" : "short"}`,
              },
            ],
            [
              { text: "⏹️ 세션 종료", callback_data: "timer:stop" },
              { text: "📊 통계", callback_data: "timer:stats" },
            ],
            [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
          ],
        };
      } else {
        // 휴식 완료 → 다음 작업 준비
        completionText = `☕ **휴식 완료!**

${message}

📊 **현재 세션 정보:**
• 완료된 포모도로: ${sessionCount}개
• 총 작업 시간: ${totalWorkTime}분
• 총 휴식 시간: ${totalBreakTime}분

다음 포모도로를 시작하세요! 💪`;

        keyboard = {
          inline_keyboard: [
            [
              {
                text: `🍅 포모도로 시작 (${nextDuration}분)`,
                callback_data: "timer:pomodoro:start",
              },
            ],
            [
              { text: "⏹️ 세션 종료", callback_data: "timer:stop" },
              { text: "📊 통계", callback_data: "timer:stats" },
            ],
            [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
          ],
        };
      }

      // 🔔 사용자에게 완료 알림 전송
      await this.bot.sendMessage(userId, completionText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      logger.info(
        `🍅 포모도로 완료 알림 전송: 사용자 ${userId}, ${completedMode} → ${nextMode}, 세션 ${sessionCount}`
      );
    } catch (error) {
      logger.error("포모도로 완료 알림 전송 실패:", error);
    }
  }

  /**
   * 콜백 처리 (기존 로직 유지) / 중앙 라우터
   */
  async handleCallback(callbackQuery) {
    const callbackKey = `${callbackQuery.from.id}-${callbackQuery.id}`;

    // 중복 처리 방지
    if (this.processingCallbacks.has(callbackKey)) {
      logger.debug("🔁 중복 콜백 무시:", callbackKey);
      return false;
    }

    this.processingCallbacks.add(callbackKey);

    try {
      const userName = getUserName(callbackQuery.from);
      logger.info(`🔔 콜백 수신: "${callbackQuery.data}" (${userName})`);

      // 콜백 데이터 파싱
      const callbackData = callbackQuery.data;
      const [targetModule, subAction, ...paramArray] = callbackData.split(":");
      const params = paramArray;

      // ✅ main 콜백은 system 모듈로 라우팅
      let moduleKey = targetModule;
      let actualSubAction = subAction;

      if (targetModule === "main") {
        moduleKey = "system";
        // main:menu → system 모듈의 showMainMenu 액션으로 변환
        actualSubAction = subAction === "menu" ? "menu" : subAction;
      }

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
        await this.sendModuleNotFoundMessage(callbackQuery);
        return false;
      }

      // ✅ 콜백 응답을 먼저 전송 (타임아웃 방지)
      try {
        await this.bot.answerCallbackQuery(callbackQuery.id);
      } catch (answerError) {
        logger.warn("콜백 응답 실패:", answerError.message);
        // 응답 실패해도 계속 진행
      }

      // 모듈의 handleCallback 호출 (표준 매개변수 전달)
      logger.debug(
        `🎯 ${moduleClass}.handleCallback 호출: action=${actualSubAction || "menu"}`
      );

      const handled = await module.handleCallback(
        this.bot,
        callbackQuery,
        actualSubAction || "menu", // subAction이 없으면 기본값 "menu"
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
   * 메시지 핸들러 (모든 모듈에 전달)
   */
  async handleMessage(bot, msg) {
    // 모든 모듈에게 메시지 전달 (우선순위 순)
    const moduleOrder = [
      "system",
      "todo",
      "timer",
      "worktime",
      "leave",
      "reminder",
      "fortune",
      "weather",
      "utils",
    ];

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
  }

  /**
   * 모듈 클래스 이름 찾기
   */
  findModuleClass(moduleKey) {
    return this.moduleRegistry[moduleKey]?.class || null;
  }

  /**
   * 모듈을 찾을 수 없을 때 메시지
   */
  async sendModuleNotFoundMessage(callbackQuery) {
    try {
      // ✅ 안전한 콜백 응답
      if (callbackQuery && callbackQuery.id) {
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: "⚠️ 해당 기능을 찾을 수 없습니다.",
          show_alert: false,
        });
      }

      // ✅ 메시지 수정 시 안전 체크
      if (callbackQuery && callbackQuery.message) {
        await this.bot.editMessageText(
          "⚠️ **기능을 찾을 수 없음**\n\n요청하신 기능이 현재 비활성화되어 있거나 존재하지 않습니다.",
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
      logger.error("모듈 없음 메시지 전송 실패:", error);
    }
  }

  /**
   * 에러 메시지 전송
   */
  async sendErrorMessage(callbackQuery) {
    try {
      if (callbackQuery && callbackQuery.message) {
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
   * 특정 모듈 가져오기
   */
  getModule(moduleName) {
    return this.moduleInstances.get(moduleName);
  }

  /**
   * 모듈 존재 여부 확인
   */
  hasModule(moduleName) {
    return this.moduleInstances.has(moduleName);
  }

  /**
   * 전체 상태 조회
   */
  getStatus() {
    const moduleStatuses = {};

    for (const [name, module] of this.moduleInstances) {
      moduleStatuses[name] = module.getStatus
        ? module.getStatus()
        : { active: true };
    }

    return {
      initialized: this.isInitialized,
      totalModules: this.moduleInstances.size,
      activeCallbacks: this.processingCallbacks.size,
      modules: moduleStatuses,
      services: {
        timer: this.services.timerService ? "활성" : "비활성",
        reminder: this.services.reminderService ? "활성" : "비활성",
      },
    };
  }

  /**
   * 정리 작업
   */
  async cleanup() {
    logger.info("🧹 ModuleManager 정리 시작...");

    // 서비스 정리
    if (this.services.timerService) {
      await this.services.timerService.cleanup();
    }

    // 모든 모듈 정리
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

module.exports = ModuleManager;
