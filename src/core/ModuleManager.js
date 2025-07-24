// src/core/ModuleManager.js - 중앙 모듈 관리자 (리팩토링)
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
      system: {
        class: "SystemModule",
        path: "../modules/SystemModule",
        name: "시스템",
        icon: "🏠",
        description: "메인 메뉴 및 시스템 기능",
        commands: ["/start", "/help", "/status"],
      },
      todo: {
        class: "TodoModule",
        path: "../modules/TodoModule",
        name: "할일 관리",
        icon: "📝",
        description: "할일을 추가하고 관리합니다",
        commands: ["/todo"],
      },
      timer: {
        class: "TimerModule",
        path: "../modules/TimerModule",
        name: "타이머",
        icon: "⏰",
        description: "포모도로 타이머를 사용합니다",
        commands: ["/timer"],
      },
      worktime: {
        class: "WorktimeModule",
        path: "../modules/WorktimeModule",
        name: "근무시간",
        icon: "🕐",
        description: "출퇴근 시간을 관리합니다",
        commands: ["/worktime", "/출근", "/퇴근"],
      },
      leave: {
        class: "LeaveModule",
        path: "../modules/LeaveModule",
        name: "휴가관리",
        icon: "🏖️",
        description: "휴가를 신청하고 관리합니다",
        commands: ["/leave", "/휴가"],
      },
      reminder: {
        class: "ReminderModule",
        path: "../modules/ReminderModule",
        name: "리마인더",
        icon: "📅",
        description: "알림을 설정합니다",
        commands: ["/reminder"],
      },
      fortune: {
        class: "FortuneModule",
        path: "../modules/FortuneModule",
        name: "운세",
        icon: "🔮",
        description: "오늘의 운세를 확인합니다",
        commands: ["/fortune", "/운세"],
      },
      weather: {
        class: "WeatherModule",
        path: "../modules/WeatherModule",
        name: "날씨",
        icon: "☁️",
        description: "현재 날씨를 확인합니다",
        commands: ["/weather", "/날씨"],
      },
      utils: {
        class: "UtilsModule",
        path: "../modules/UtilsModule",
        name: "유틸리티",
        icon: "🔧",
        description: "TTS 등 유용한 도구를 사용합니다",
        commands: ["/tts"],
      },
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
      await this.loadModule(key, config);
    }
  }

  /**
   * 단일 모듈 로드
   */
  async loadModule(key, config) {
    try {
      logger.debug(`📦 ${config.class} 로드 중...`);

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

      return true;
    } catch (error) {
      logger.error(`❌ ${config.class} 로드 실패:`, error);
      return false;
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

      // 콜백 데이터 파싱 (형식: "module:action:param1:param2")
      const [targetModule, subAction, ...params] = callbackData.split(":");

      // 특별 처리: main:menu는 system 모듈로 라우팅
      const moduleKey = targetModule === "main" ? "system" : targetModule;

      // 모듈 찾기
      const module = this.getModule(moduleKey);
      if (!module) {
        logger.warn(`모듈을 찾을 수 없음: ${moduleKey}`);
        await this.sendModuleNotFoundMessage(callbackQuery);
        return false;
      }

      // 모듈의 handleCallback 호출 (표준 매개변수 전달)
      const handled = await module.handleCallback(
        this.bot,
        callbackQuery,
        subAction || "menu",
        params,
        this
      );

      if (handled) {
        logger.debug(`✅ ${module.name}에서 콜백 처리 완료`);
      } else {
        logger.warn(`❌ ${module.name}에서 콜백 처리 실패`);
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
      const module = this.getModule(moduleKey);
      if (module && module.handleMessage) {
        try {
          const handled = await module.handleMessage(bot, msg);
          if (handled) {
            logger.debug(`📬 메시지가 ${module.name}에서 처리됨`);
            return true;
          }
        } catch (error) {
          logger.error(`${module.name} 메시지 처리 오류:`, error);
        }
      }
    }

    return false;
  }

  /**
   * 특정 모듈 가져오기
   * @param {string} moduleKeyOrClass - 모듈 키 또는 클래스 이름
   * @returns {Object|null} 모듈 인스턴스
   */
  getModule(moduleKeyOrClass) {
    // 클래스 이름으로 직접 검색
    if (this.moduleInstances.has(moduleKeyOrClass)) {
      return this.moduleInstances.get(moduleKeyOrClass);
    }

    // 키로 검색
    const config = this.moduleRegistry[moduleKeyOrClass];
    if (config) {
      return this.moduleInstances.get(config.class);
    }

    return null;
  }

  /**
   * 로드된 모듈 목록 반환
   * @returns {Array} 로드된 모듈 정보 배열
   */
  getLoadedModules() {
    const modules = [];

    try {
      for (const [moduleClass, moduleInstance] of this.moduleInstances) {
        // moduleRegistry에서 해당 모듈의 정보 찾기
        let moduleInfo = null;
        for (const [key, config] of Object.entries(this.moduleRegistry)) {
          if (config.class === moduleClass) {
            moduleInfo = { key, ...config };
            break;
          }
        }

        modules.push({
          key: moduleInfo?.key,
          name: moduleInstance.name,
          class: moduleClass,
          isActive: moduleInstance.isActive !== false,
          isInitialized: moduleInstance.isInitialized || false,
          hasActions: moduleInstance.actionMap?.size > 0,
          actionCount: moduleInstance.actionMap?.size || 0,
          instance: moduleInstance,
          config: moduleInfo,
        });
      }

      logger.debug(`📦 로드된 모듈 수: ${modules.length}`);
      return modules;
    } catch (error) {
      logger.error("로드된 모듈 목록 조회 오류:", error);
      return [];
    }
  }

  /**
   * 활성화된 모듈 목록 반환
   * @returns {Array} 활성화된 모듈 정보 배열
   */
  getActiveModules() {
    return this.getLoadedModules().filter((module) => module.isActive);
  }

  /**
   * 사용 가능한 모듈 목록 반환 (사용자에게 표시용)
   * @returns {Array} 사용 가능한 모듈 정보
   */
  async getAvailableModules() {
    const modules = this.getActiveModules();
    const availableModules = [];

    for (const module of modules) {
      // 시스템 모듈은 제외
      if (module.key === "system") continue;

      if (module.config) {
        availableModules.push({
          key: module.key,
          name: module.config.name,
          icon: module.config.icon,
          description: module.config.description,
          commands: module.config.commands,
          isActive: module.isActive,
        });
      }
    }

    return availableModules;
  }

  /**
   * 모듈 상태 정보 반환
   * @returns {Object} 모듈 상태 정보
   */
  getModuleStatus() {
    const modules = this.getLoadedModules();

    return {
      totalModules: modules.length,
      activeModules: modules.filter((m) => m.isActive).length,
      initializedModules: modules.filter((m) => m.isInitialized).length,
      activeCallbacks: this.processingCallbacks.size,
      modules: modules.map((m) => ({
        name: m.name,
        key: m.key,
        isActive: m.isActive,
        isInitialized: m.isInitialized,
        actionCount: m.actionCount,
      })),
    };
  }

  /**
   * 전체 상태 조회 (기존 getStatus 개선)
   */
  getStatus() {
    const moduleStatus = this.getModuleStatus();

    return {
      initialized: this.isInitialized,
      totalModules: moduleStatus.totalModules,
      activeModules: moduleStatus.activeModules,
      activeCallbacks: moduleStatus.activeCallbacks,
      modules: moduleStatus.modules,
    };
  }

  /**
   * 모듈 리로드
   * @param {string} moduleKey - 리로드할 모듈 키
   */
  async reloadModule(moduleKey) {
    try {
      logger.info(`🔄 ${moduleKey} 모듈 리로드 시작...`);

      const config = this.moduleRegistry[moduleKey];
      if (!config) {
        throw new Error(`모듈 설정을 찾을 수 없음: ${moduleKey}`);
      }

      // 기존 모듈 언로드
      await this.unloadModule(moduleKey);

      // 모듈 다시 로드
      await this.loadModule(moduleKey, config);

      logger.info(`✅ ${moduleKey} 모듈 리로드 완료`);
      return true;
    } catch (error) {
      logger.error(`❌ ${moduleKey} 모듈 리로드 실패:`, error);
      return false;
    }
  }

  /**
   * 모듈 언로드
   * @param {string} moduleKey - 언로드할 모듈 키
   */
  async unloadModule(moduleKey) {
    try {
      const config = this.moduleRegistry[moduleKey];
      if (!config) {
        logger.warn(`언로드할 모듈을 찾을 수 없음: ${moduleKey}`);
        return false;
      }

      const module = this.moduleInstances.get(config.class);
      if (module) {
        // 모듈 정리
        if (typeof module.cleanup === "function") {
          await module.cleanup();
        }

        // 인스턴스 제거
        this.moduleInstances.delete(config.class);
        logger.info(`✅ ${moduleKey} 모듈 언로드 완료`);
      }

      return true;
    } catch (error) {
      logger.error(`❌ ${moduleKey} 모듈 언로드 실패:`, error);
      return false;
    }
  }

  /**
   * 모든 모듈에 이벤트 브로드캐스트
   * @param {string} event - 이벤트 이름
   * @param {any} data - 전달할 데이터
   */
  async broadcastToModules(event, data) {
    const modules = this.getLoadedModules();

    for (const module of modules) {
      try {
        if (module.instance && typeof module.instance.onEvent === "function") {
          await module.instance.onEvent(event, data);
        }
      } catch (error) {
        logger.error(`${module.name} 이벤트 처리 오류:`, error);
      }
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
   * 디버그 정보 출력
   */
  debugInfo() {
    const status = this.getStatus();

    logger.info("=== ModuleManager 디버그 정보 ===");
    logger.info(`초기화 상태: ${this.isInitialized}`);
    logger.info(`전체 모듈: ${status.totalModules}`);
    logger.info(`활성 모듈: ${status.activeModules}`);
    logger.info(`활성 콜백: ${status.activeCallbacks}`);

    logger.info("--- 모듈 상세 정보 ---");
    status.modules.forEach((module) => {
      logger.info(`${module.key}: ${module.name}`);
      logger.info(`  - 활성화: ${module.isActive}`);
      logger.info(`  - 초기화: ${module.isInitialized}`);
      logger.info(`  - 액션 수: ${module.actionCount}`);
    });

    logger.info("=== 디버그 정보 끝 ===");
  }

  /**
   * 정리 작업
   */
  async cleanup() {
    logger.info("🧹 ModuleManager 정리 시작...");

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
