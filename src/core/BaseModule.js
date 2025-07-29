// src/core/BaseModule.js - 표준화된 최종 수정 버전

const logger = require("../utils/Logger");

/**
 * 🏗️ 모든 모듈의 기반이 되는 클래스
 * - 표준 매개변수 체계 준수 (moduleName, options)
 * - actionMap 방식 사용
 * - 공통 기능 제공
 * - Railway 환경 최적화
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
  constructor(moduleName, options = {}) {
    // 🔥 핵심 수정: options 매개변수 안전하게 처리
    this.moduleName = moduleName;
    this.bot = options.bot;
    this.moduleManager = options.moduleManager;
    this.serviceBuilder = options.serviceBuilder;
    this.config = options.config || {};

    // 🎯 액션 맵 (핵심!)
    this.actionMap = new Map();

    // 📊 사용자 상태 관리
    this.userStates = new Map();

    // 📊 통계
    this.stats = {
      callbacksHandled: 0,
      messagesHandled: 0,
      errorsCount: 0,
      lastActivity: null,
    };

    this.isInitialized = false;

    logger.info(`🏗️ ${moduleName} 베이스 모듈 생성됨`, {
      hasBot: !!this.bot,
      hasModuleManager: !!this.moduleManager,
      hasServiceBuilder: !!this.serviceBuilder,
      configKeys: Object.keys(this.config),
    });
  }

  /**
   * 🎯 모듈 초기화 (표준 패턴)
   * 이 메서드는 ModuleManager에 의해 자동으로 호출됩니다.
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn(`${this.moduleName} 이미 초기화됨`);
      return;
    }

    try {
      logger.info(`🎯 ${this.moduleName} 초기화 시작...`);

      // 자식 클래스의 초기화 로직 호출
      await this.onInitialize();

      this.isInitialized = true;
      logger.success(`✅ ${this.moduleName} 초기화 완료`);
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 초기화 실패:`, error);
      throw error;
    }
  }

  /**
   * 🎯 자식 클래스에서 구현할 초기화 메서드
   * 서비스 연결, DB 초기화, 액션 등록 등을 수행
   */
  async onInitialize() {
    // 자식 클래스에서 구현
    // 예: 서비스 연결, setupActions() 호출 등
  }

  /**
   * 🎯 액션 등록 (자식 클래스에서 구현)
   */
  setupActions() {
    // 자식 클래스에서 구현
    // 예: this.registerActions({ menu: this.showMenu, ... });
  }

  /**
   * 🎯 표준 콜백 처리 (핵심!)
   * 모든 콜백은 여기서 중앙 처리됩니다.
   */
  async handleCallback(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      this.stats.callbacksHandled++;
      this.stats.lastActivity = new Date();

      logger.debug(`🎯 ${this.moduleName} 콜백 처리: ${subAction}`, {
        userId: callbackQuery.from.id,
        params: params,
      });

      const handler = this.actionMap.get(subAction);
      if (handler) {
        // 표준 매개변수로 핸들러 호출
        const result = await handler(
          bot,
          callbackQuery,
          subAction,
          params,
          moduleManager
        );

        logger.debug(`✅ ${this.moduleName} 액션 완료: ${subAction}`);
        return result;
      } else {
        logger.warn(`❓ ${this.moduleName} 알 수 없는 액션: ${subAction}`);
        return {
          type: "error",
          message: `알 수 없는 명령입니다: ${subAction}`,
        };
      }
    } catch (error) {
      logger.error(`💥 ${this.moduleName} 콜백 처리 오류:`, error);
      this.stats.errorsCount++;

      return {
        type: "error",
        message: "모듈 처리 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 🎯 표준 메시지 처리
   */
  async onHandleMessage(bot, msg) {
    try {
      this.stats.messagesHandled++;
      this.stats.lastActivity = new Date();

      const {
        text,
        from: { id: userId },
        chat: { id: chatId },
      } = msg;

      if (!text) return false;

      // 모듈 키워드 확인
      const moduleKeywords = this.getModuleKeywords();
      if (moduleKeywords && moduleKeywords.length > 0) {
        const lowerText = text.trim().toLowerCase();
        const isModuleMessage = moduleKeywords.some(
          (keyword) =>
            lowerText === keyword || lowerText.startsWith(keyword + " ")
        );

        if (isModuleMessage) {
          // NavigationHandler를 통해 모듈 메뉴 표시
          if (this.moduleManager?.navigationHandler) {
            await this.moduleManager.navigationHandler.sendModuleMenu(
              bot,
              chatId,
              this.moduleName.toLowerCase().replace("module", "")
            );
            return true;
          }
        }
      }

      // 사용자 입력 상태 처리
      const userState = this.getUserState(userId);
      if (userState?.awaitingInput) {
        return await this.handleUserInput(bot, msg, text, userState);
      }

      return false;
    } catch (error) {
      logger.error(`💥 ${this.moduleName} 메시지 처리 오류:`, error);
      this.stats.errorsCount++;
      return false;
    }
  }

  /**
   * 📝 사용자 입력 처리 (상태 기반)
   */
  async handleUserInput(bot, msg, text, userState) {
    // 자식 클래스에서 구현
    return false;
  }

  /**
   * 🔑 모듈별 키워드 정의 (자식 클래스에서 오버라이드)
   */
  getModuleKeywords() {
    return [];
  }

  /**
   * 🎯 액션 등록
   * 콜백 데이터와 핸들러 함수를 매핑합니다.
   */
  registerActions(actions) {
    for (const [actionName, handler] of Object.entries(actions)) {
      if (typeof handler === "function") {
        this.actionMap.set(actionName, handler.bind(this));
        logger.debug(`📋 ${this.moduleName} 액션 등록: ${actionName}`);
      } else {
        logger.warn(`⚠️ ${this.moduleName} 잘못된 핸들러: ${actionName}`);
      }
    }

    logger.info(
      `✅ ${this.moduleName} 총 ${this.actionMap.size}개 액션 등록됨`
    );
  }

  /**
   * 🛡️ 사용자 상태 관리 헬퍼들
   */
  setUserState(userId, state) {
    const userKey = userId.toString();
    this.userStates.set(userKey, {
      ...state,
      timestamp: Date.now(),
      module: this.moduleName,
    });

    logger.debug(`💾 사용자 상태 저장: ${userId} (${this.moduleName})`);
  }

  getUserState(userId) {
    return this.userStates.get(userId.toString()) || null;
  }

  clearUserState(userId) {
    const existed = this.userStates.delete(userId.toString());
    if (existed) {
      logger.debug(`🗑️ 사용자 상태 삭제: ${userId} (${this.moduleName})`);
    }
    return existed;
  }

  /**
   * 📊 모듈 상태 정보 반환
   */
  getModuleStatus() {
    return {
      moduleName: this.moduleName,
      isInitialized: this.isInitialized,
      stats: { ...this.stats },
      actionCount: this.actionMap.size,
      activeUserStates: this.userStates.size,
      hasBot: !!this.bot,
      hasModuleManager: !!this.moduleManager,
      hasServiceBuilder: !!this.serviceBuilder,
    };
  }

  /**
   * 🧹 모듈 정리 작업
   */
  async cleanup() {
    try {
      logger.info(`🧹 ${this.moduleName} 정리 시작...`);

      // 사용자 상태 정리
      this.userStates.clear();

      // 액션 맵 정리
      this.actionMap.clear();

      // 통계 초기화
      this.stats = {
        callbacksHandled: 0,
        messagesHandled: 0,
        errorsCount: 0,
        lastActivity: null,
      };

      this.isInitialized = false;

      logger.success(`✅ ${this.moduleName} 정리 완료`);
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 정리 실패:`, error);
    }
  }
}

module.exports = BaseModule;
