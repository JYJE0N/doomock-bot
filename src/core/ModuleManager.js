// src/core/ModuleManager.js - 안전한 콜백 처리 강화

const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 중앙 모듈 관리자
 * - 모든 모듈의 생명주기 관리
 * - 콜백 라우팅 중앙 처리
 * - 중복 처리 방지
 */
class ModuleManager {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.db = options.db || null;
    this.moduleInstances = new Map();
    this.isInitialized = false;

    // 중복 처리 방지를 위한 Set
    this.processingCallbacks = new Set();

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
        const ModuleClass = require(config.path);
        const moduleInstance = new ModuleClass(this.bot, {
          db: this.db,
          moduleManager: this,
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
   * 중앙 콜백 처리 (표준 매개변수 사용)
   */
  async handleCallback(callbackQuery) {
    // ✅ 강화된 null/undefined 체크
    if (!callbackQuery) {
      logger.error("❌ callbackQuery가 null 또는 undefined입니다");
      return false;
    }

    if (!callbackQuery.data) {
      logger.error("❌ callbackQuery.data가 없습니다");
      // 빈 콜백이라도 응답은 해주기
      try {
        if (callbackQuery.id) {
          await this.bot.answerCallbackQuery(callbackQuery.id, {
            text: "⚠️ 잘못된 요청입니다.",
            show_alert: false,
          });
        }
      } catch (error) {
        logger.error("콜백 응답 실패:", error);
      }
      return false;
    }

    if (!callbackQuery.id) {
      logger.error("❌ callbackQuery.id가 없습니다");
      return false;
    }

    const callbackData = callbackQuery.data;
    const userId = callbackQuery.from?.id || "unknown";
    const callbackKey = `${userId}-${callbackData}`;

    // 중복 처리 방지
    if (this.processingCallbacks.has(callbackKey)) {
      logger.debug("🔁 중복 콜백 무시:", callbackData);
      try {
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: "⏳ 처리 중입니다...",
          show_alert: false,
        });
      } catch (error) {
        logger.error("중복 콜백 응답 실패:", error);
      }
      return false;
    }

    this.processingCallbacks.add(callbackKey);

    try {
      logger.info(`📨 콜백 데이터 수신: ${callbackData}`);

      // 콜백 데이터 파싱 (형식: "module:action:param1:param2")
      const parts = callbackData.split(":");
      if (parts.length === 0) {
        logger.error("❌ 콜백 데이터 형식이 잘못됨:", callbackData);
        await this.sendInvalidCallbackResponse(callbackQuery);
        return false;
      }

      const [targetModule, subAction, ...params] = parts;

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
      const handled = await module.handleCallback(
        this.bot,
        callbackQuery,
        subAction || "menu", // subAction이 없으면 기본값 "menu"
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
      // 처리 완료 후 제거 (1초 후)
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
   * 잘못된 콜백 데이터 응답
   */
  async sendInvalidCallbackResponse(callbackQuery) {
    try {
      if (callbackQuery && callbackQuery.id) {
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: "⚠️ 잘못된 요청 형식입니다.",
          show_alert: false,
        });
      }
    } catch (error) {
      logger.error("잘못된 콜백 응답 실패:", error);
    }
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
          "⚠️ **기능을 찾을 수 없음**\n\n요청하신 기능이 현재 비활성화되어 있거나 존재하지 않습니다.\n\n🏠 /start 명령어로 메인 메뉴로 돌아가세요.",
          {
            chat_id: callbackQuery.message.chat.id,
            message_id: callbackQuery.message.message_id,
            parse_mode: "Markdown",
          }
        );
      }
    } catch (error) {
      logger.error("모듈 찾을 수 없음 메시지 전송 실패:", error);
    }
  }

  /**
   * 에러 메시지 전송
   */
  async sendErrorMessage(callbackQuery) {
    try {
      // ✅ 안전한 콜백 응답
      if (callbackQuery && callbackQuery.id) {
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: "❌ 처리 중 오류가 발생했습니다.",
          show_alert: false,
        });
      }

      // ✅ 메시지 수정 시 안전 체크
      if (callbackQuery && callbackQuery.message) {
        await this.bot.editMessageText(
          `❌ **처리 중 오류 발생**\n\n시스템에서 일시적인 오류가 발생했습니다.\n\n**해결 방법:**\n• 잠시 후 다시 시도해주세요\n• 문제가 지속되면 /start 명령어를 사용하세요\n\n⏰ ${TimeHelper.getCurrentTime()}`,
          {
            chat_id: callbackQuery.message.chat.id,
            message_id: callbackQuery.message.message_id,
            parse_mode: "Markdown",
          }
        );
      }
    } catch (error) {
      logger.error("에러 메시지 전송 실패:", error);
    }
  }

  /**
   * 특정 모듈 인스턴스 반환
   */
  getModule(moduleClass) {
    return this.moduleInstances.get(moduleClass);
  }

  /**
   * 모든 모듈 인스턴스 반환
   */
  getAllModules() {
    return this.moduleInstances;
  }

  /**
   * 모듈 상태 확인
   */
  getModuleStatus() {
    const status = {};
    for (const [className, module] of this.moduleInstances) {
      status[className] = {
        initialized: module.isInitialized || false,
        active: module.isActive !== false,
        actionCount: module.actionMap?.size || 0,
      };
    }
    return status;
  }

  /**
   * 정리 메서드 (종료 시 호출)
   */
  async cleanup() {
    logger.info("🧹 ModuleManager 정리 시작...");

    for (const [className, module] of this.moduleInstances) {
      try {
        if (module.cleanup) {
          await module.cleanup();
          logger.debug(`✅ ${className} 정리 완료`);
        }
      } catch (error) {
        logger.error(`❌ ${className} 정리 실패:`, error);
      }
    }

    this.moduleInstances.clear();
    this.processingCallbacks.clear();

    logger.info("🧹 ModuleManager 정리 완료");
  }
}

module.exports = ModuleManager;
