// src/core/BaseModule.js - 최종 수정 버전

const logger = require("../utils/Logger");

/**
 * 모든 모듈의 기반이 되는 클래스.
 * 공통 기능(초기화, 액션 등록, 상태 관리 등)을 제공합니다.
 */
class BaseModule {
  /**
   * @param {string} moduleName 모듈의 이름
   * @param {object} options 모듈에 필요한 옵션 객체
   * @param {Telegraf} options.bot Telegraf 봇 인스턴스
   * @param {ModuleManager} options.moduleManager 모듈 매니저 인스턴스
   * @param {ServiceBuilder} options.serviceBuilder 서비스 빌더 인스턴스
   * @param {object} options.config 모듈 설정 객체
   */
  constructor(moduleName, { bot, moduleManager, config, serviceBuilder }) {
    // <--- serviceBuilder를 받도록 수정
    if (new.target === BaseModule) {
      throw new TypeError("BaseModule은 직접 인스턴스화할 수 없습니다.");
    }

    this.moduleName = moduleName;
    this.bot = bot;
    this.moduleManager = moduleManager;
    this.serviceBuilder = serviceBuilder; // <--- 전달받은 serviceBuilder를 저장
    this.config = config || {};
    this.isInitialized = false;
    this.actionMap = new Map();

    this.stats = {
      messagesHandled: 0,
      callbacksHandled: 0,
      errorsCount: 0,
    };
  }

  /**
   * 모듈의 초기화 로직을 수행합니다.
   * 이 메서드는 ModuleManager에 의해 자동으로 호출됩니다.
   */
  async initialize() {
    try {
      await this.onInitialize();
      this.isInitialized = true;
    } catch (error) {
      logger.error(`[${this.moduleName}] 초기화 중 오류 발생:`, error);
      throw error;
    }
  }

  /**
   * 각 모듈에서 재정의할 실제 초기화 로직.
   */
  async onInitialize() {
    // 각 하위 모듈에서 이 메서드를 구현합니다.
  }

  /**
   * 액션을 등록하여 콜백 데이터와 핸들러 함수를 매핑합니다.
   * @param {object} actions - { actionName: handlerFunction } 형태의 객체
   */
  registerActions(actions) {
    for (const [actionName, handler] of Object.entries(actions)) {
      if (typeof handler === "function") {
        this.actionMap.set(actionName, handler.bind(this));
      }
    }
  }

  /**
   * 콜백 쿼리를 처리하는 중앙 핸들러.
   * 콜백 데이터를 기반으로 등록된 액션을 찾아 실행합니다.
   */
  async handleCallback(bot, callbackQuery, subAction, params) {
    try {
      const handler = this.actionMap.get(subAction);
      if (handler) {
        // 핸들러의 결과(UI 렌더링을 위한 데이터)를 반환합니다.
        return await handler(bot, callbackQuery, params);
      } else {
        logger.warn(`[${this.moduleName}] 알 수 없는 액션: ${subAction}`);
        return {
          type: "error",
          message: `알 수 없는 명령입니다: ${subAction}`,
        };
      }
    } catch (error) {
      logger.error(`[${this.moduleName}] 콜백 처리 오류:`, error);
      this.stats.errorsCount++;
      // 오류 발생 시에도 일관된 객체를 반환하여 NavigationHandler가 처리하도록 합니다.
      return { type: "error", message: "모듈 처리 중 오류가 발생했습니다." };
    }
  }

  // 사용자별 모듈 상태 관련 헬퍼 함수
  async getModuleState(userId) {
    if (
      this.moduleManager &&
      typeof this.moduleManager.getUserState === "function"
    ) {
      return await this.moduleManager.getUserState(this.moduleName, userId);
    }
    return null;
  }

  async setModuleState(userId, state) {
    if (
      this.moduleManager &&
      typeof this.moduleManager.setUserState === "function"
    ) {
      return await this.moduleManager.setUserState(
        this.moduleName,
        userId,
        state
      );
    }
  }

  async clearModuleState(userId) {
    if (
      this.moduleManager &&
      typeof this.moduleManager.clearUserState === "function"
    ) {
      return await this.moduleManager.clearUserState(this.moduleName, userId);
    }
  }
}

module.exports = BaseModule;
