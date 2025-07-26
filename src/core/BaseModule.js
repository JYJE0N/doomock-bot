// src/modules/BaseModule.js - 모든 모듈의 부모 클래스 v3.0.1
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName, getUserId } = require("../utils/UserHelper");

/**
 * 🏗️ BaseModule v3.0.1 (리팩토링)
 *
 * 🔧 주요 개선사항:
 * - 표준 매개변수 체계 완전 준수
 * - actionMap 방식 강화
 * - 에러 처리 표준화
 * - 사용자 상태 관리 개선
 * - 메모리 효율성 개선
 */
class BaseModule {
  constructor(moduleName, options = {}) {
    this.moduleName = moduleName;
    this.bot = options.bot;
    this.db = options.db;
    this.moduleManager = options.moduleManager;

    // 🎯 액션 맵 (핵심!)
    this.actionMap = new Map();

    // 👤 사용자 상태 관리
    this.userStates = new Map();
    this.userStateTimeouts = new Map();

    // ⏰ 설정
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      cacheEnabled: true,
      userStateTimeout: 10 * 60 * 1000, // 10분
      maxUserStates: 1000,
      ...options.config,
    };

    // 📊 통계
    this.stats = {
      callbacksHandled: 0,
      messagesHandled: 0,
      errorsCount: 0,
      activeUserStates: 0,
      lastActivity: null,
      startTime: Date.now(),
      averageResponseTime: 0,
      totalResponseTime: 0,
    };

    // 🔧 상태
    this.isInitialized = false;

    logger.info(`🏗️ ${moduleName} 베이스 모듈 생성됨`);
  }

  // ===== 🎯 표준 생명주기 메서드들 =====

  /**
   * 🚀 모듈 초기화 (표준 패턴)
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn(`${this.moduleName} 이미 초기화됨`);
      return;
    }

    try {
      logger.info(`🎯 ${this.moduleName} 초기화 시작...`);

      // 자식 클래스의 초기화 로직
      await this.onInitialize();

      // 액션 설정
      this.setupActions();

      // 사용자 상태 정리 스케줄
      this.scheduleUserStateCleanup();

      this.isInitialized = true;
      logger.success(`✅ ${this.moduleName} 초기화 완료`);
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 초기화 실패:`, error);
      throw error;
    }
  }

  /**
   * 🎯 자식 클래스에서 구현할 초기화 메서드
   */
  async onInitialize() {
    // 자식 클래스에서 구현
    // 예: 서비스 연결, DB 초기화 등
  }

  /**
   * 🎯 액션 설정 (자식 클래스에서 구현)
   */
  setupActions() {
    // 자식 클래스에서 구현
    // 예: this.registerActions({ menu: this.showMenu, ... });
  }

  // ===== 🎯 표준 처리 메서드들 (필수 구현) =====

  /**
   * 🎯 표준 콜백 처리 (핵심!)
   * 매개변수: (bot, callbackQuery, subAction, params, moduleManager)
   */
  async handleCallback(bot, callbackQuery, subAction, params, moduleManager) {
    const startTime = Date.now();

    try {
      // 📋 매개변수 검증
      if (
        !this.validateCallbackParams(
          bot,
          callbackQuery,
          subAction,
          params,
          moduleManager
        )
      ) {
        return false;
      }

      // 📊 통계 업데이트
      this.stats.callbacksHandled++;
      this.stats.lastActivity = TimeHelper.getLogTimeString();

      // 👤 사용자 정보 추출 (표준 방식)
      const userName = getUserName(callbackQuery);
      const userId = getUserId(callbackQuery);

      logger.debug(
        `🎯 ${this.moduleName}.${subAction} 콜백 처리: ${userName}`,
        {
          module: this.moduleName,
          action: subAction,
          userId,
          userName,
        }
      );

      // 🎯 액션 실행
      const action = this.actionMap.get(subAction);
      if (!action) {
        logger.warn(`${this.moduleName}: 알 수 없는 액션 - ${subAction}`);
        await this.sendActionNotFound(bot, callbackQuery, subAction);
        return false;
      }

      // 📞 표준 매개변수로 액션 실행
      await action.call(this, bot, callbackQuery, params, moduleManager);

      logger.debug(`✅ ${this.moduleName}.${subAction} 처리 완료`);
      return true;
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 콜백 처리 오류:`, error);
      this.stats.errorsCount++;

      await this.sendError(bot, callbackQuery, "처리 중 오류가 발생했습니다.");
      return false;
    } finally {
      // 📊 응답 시간 통계 업데이트
      const responseTime = Date.now() - startTime;
      this.updateResponseTimeStats(responseTime);
    }
  }

  /**
   * 💬 표준 메시지 처리
   * 매개변수: (bot, msg)
   */
  async handleMessage(bot, msg) {
    const startTime = Date.now();

    try {
      // 📋 매개변수 검증
      if (!this.validateMessageParams(bot, msg)) {
        return false;
      }

      // 📊 통계 업데이트
      this.stats.messagesHandled++;
      this.stats.lastActivity = TimeHelper.getLogTimeString();

      // 👤 사용자 정보 추출 (표준 방식)
      const userName = getUserName(msg);
      const userId = getUserId(msg);

      logger.debug(`💬 ${this.moduleName} 메시지 처리: ${userName}`, {
        module: this.moduleName,
        userId,
        userName,
        text: msg.text?.substring(0, 30) + "...",
      });

      // 🎯 자식 클래스의 메시지 처리 로직
      const handled = await this.onHandleMessage(bot, msg);

      if (handled) {
        logger.debug(`✅ ${this.moduleName} 메시지 처리 완료`);
      }

      return handled;
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 메시지 처리 오류:`, error);
      this.stats.errorsCount++;
      return false;
    } finally {
      // 📊 응답 시간 통계 업데이트
      const responseTime = Date.now() - startTime;
      this.updateResponseTimeStats(responseTime);
    }
  }

  /**
   * 🎯 자식 클래스에서 구현할 메시지 처리
   */
  async onHandleMessage(bot, msg) {
    // 자식 클래스에서 구현
    return false;
  }

  // ===== 🛠️ 액션 관리 메서드들 =====

  /**
   * 📝 액션 등록
   */
  registerAction(name, handler) {
    if (typeof handler !== "function") {
      throw new Error(`핸들러는 함수여야 합니다: ${name}`);
    }
    this.actionMap.set(name, handler.bind(this));
    logger.debug(`🎯 ${this.moduleName}.${name} 액션 등록됨`);
  }

  /**
   * 📝 여러 액션 한번에 등록
   */
  registerActions(actions) {
    for (const [name, handler] of Object.entries(actions)) {
      this.registerAction(name, handler);
    }
  }

  /**
   * 🔍 액션 존재 확인
   */
  hasAction(actionName) {
    return this.actionMap.has(actionName);
  }

  /**
   * 📋 등록된 액션 목록 조회
   */
  getActions() {
    return Array.from(this.actionMap.keys());
  }

  // ===== 👤 사용자 상태 관리 =====

  /**
   * 👤 사용자 상태 설정
   */
  setUserState(userId, state, timeoutMs = null) {
    try {
      // 메모리 사용량 제한
      if (this.userStates.size >= this.config.maxUserStates) {
        this.cleanupOldestUserStates();
      }

      this.userStates.set(userId, {
        ...state,
        createdAt: Date.now(),
        module: this.moduleName,
      });

      this.stats.activeUserStates = this.userStates.size;

      // 타임아웃 설정
      const timeout = timeoutMs || this.config.userStateTimeout;
      if (timeout > 0) {
        // 기존 타임아웃 정리
        if (this.userStateTimeouts.has(userId)) {
          clearTimeout(this.userStateTimeouts.get(userId));
        }

        // 새 타임아웃 설정
        const timeoutId = setTimeout(() => {
          this.clearUserState(userId);
        }, timeout);

        this.userStateTimeouts.set(userId, timeoutId);
      }

      logger.debug(`👤 ${this.moduleName} 사용자 상태 설정: ${userId}`, {
        module: this.moduleName,
        userId,
        timeout,
      });
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 사용자 상태 설정 실패:`, error);
    }
  }

  /**
   * 👤 사용자 상태 조회
   */
  getUserState(userId) {
    return this.userStates.get(userId);
  }

  /**
   * 👤 사용자 상태 확인
   */
  hasUserState(userId) {
    return this.userStates.has(userId);
  }

  /**
   * 👤 사용자 상태 정리
   */
  clearUserState(userId) {
    // 상태 삭제
    this.userStates.delete(userId);

    // 타임아웃 정리
    if (this.userStateTimeouts.has(userId)) {
      clearTimeout(this.userStateTimeouts.get(userId));
      this.userStateTimeouts.delete(userId);
    }

    this.stats.activeUserStates = this.userStates.size;

    logger.debug(`👤 ${this.moduleName} 사용자 상태 정리: ${userId}`);
  }

  /**
   * 🧹 오래된 사용자 상태 정리
   */
  cleanupOldestUserStates() {
    const entries = Array.from(this.userStates.entries());

    // 생성 시간 기준 정렬
    entries.sort(([, a], [, b]) => a.createdAt - b.createdAt);

    // 오래된 10%를 정리
    const cleanupCount = Math.max(1, Math.floor(entries.length * 0.1));

    for (let i = 0; i < cleanupCount; i++) {
      const [userId] = entries[i];
      this.clearUserState(userId);
    }

    logger.debug(
      `🧹 ${this.moduleName} 오래된 사용자 상태 ${cleanupCount}개 정리됨`
    );
  }

  /**
   * ⏰ 사용자 상태 정리 스케줄
   */
  scheduleUserStateCleanup() {
    // 5분마다 만료된 상태 정리
    this.userStateCleanupInterval = setInterval(() => {
      this.cleanupExpiredUserStates();
    }, 5 * 60 * 1000);
  }

  /**
   * 🧹 만료된 사용자 상태 정리
   */
  cleanupExpiredUserStates() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [userId, state] of this.userStates.entries()) {
      if (now - state.createdAt > this.config.userStateTimeout) {
        this.clearUserState(userId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(
        `🧹 ${this.moduleName} 만료된 사용자 상태 ${cleanedCount}개 정리됨`
      );
    }
  }

  // ===== 🔧 검증 메서드들 =====

  /**
   * 📋 콜백 매개변수 검증
   */
  validateCallbackParams(bot, callbackQuery, subAction, params, moduleManager) {
    if (!bot || !callbackQuery) {
      logger.error(
        `${this.moduleName}: 필수 매개변수 누락 (bot, callbackQuery)`
      );
      return false;
    }

    if (!callbackQuery.message || !callbackQuery.from) {
      logger.error(`${this.moduleName}: callbackQuery 구조 오류`);
      return false;
    }

    if (!subAction || typeof subAction !== "string") {
      logger.error(`${this.moduleName}: subAction이 필요합니다`);
      return false;
    }

    return true;
  }

  /**
   * 📋 메시지 매개변수 검증
   */
  validateMessageParams(bot, msg) {
    if (!bot || !msg) {
      logger.error(`${this.moduleName}: 필수 매개변수 누락 (bot, msg)`);
      return false;
    }

    if (!msg.chat || !msg.from) {
      logger.error(`${this.moduleName}: msg 구조 오류`);
      return false;
    }

    return true;
  }

  // ===== 💬 메시지 처리 유틸리티들 =====

  /**
   * 💬 메시지 전송 (재시도 포함)
   */
  async sendMessage(bot, chatId, text, options = {}) {
    const maxRetries = this.config.maxRetries;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await bot.sendMessage(chatId, text, {
          parse_mode: "Markdown",
          ...options,
        });
      } catch (error) {
        logger.warn(
          `${this.moduleName} 메시지 전송 실패 (시도 ${attempt}/${maxRetries}):`,
          error.message
        );

        if (attempt === maxRetries) {
          throw error;
        }

        // 재시도 대기
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  /**
   * ✏️ 메시지 편집 (재시도 포함)
   */
  async editMessage(bot, chatId, messageId, text, options = {}) {
    const maxRetries = this.config.maxRetries;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "Markdown",
          ...options,
        });
      } catch (error) {
        logger.warn(
          `${this.moduleName} 메시지 편집 실패 (시도 ${attempt}/${maxRetries}):`,
          error.message
        );

        if (attempt === maxRetries) {
          // 편집 실패 시 새 메시지 전송 시도
          try {
            return await this.sendMessage(bot, chatId, text, options);
          } catch (retryError) {
            logger.error(`${this.moduleName} 메시지 재전송 실패:`, retryError);
            throw retryError;
          }
        }

        // 재시도 대기
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  // ===== 🚨 에러 처리 메서드들 =====

  /**
   * 🚨 에러 메시지 전송
   */
  async sendError(bot, callbackQuery, message) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const errorText = `❌ **${this.moduleName} 오류**\n\n${message}\n\n잠시 후 다시 시도해주세요.`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "🔄 다시 시도",
              callback_data: `${this.moduleName.toLowerCase()}:menu`,
            },
            { text: "🏠 메인 메뉴", callback_data: "system:menu" },
          ],
        ],
      };

      await this.editMessage(bot, chatId, messageId, errorText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error(`${this.moduleName} 에러 메시지 전송 실패:`, error);
    }
  }

  /**
   * ❓ 액션 없음 메시지
   */
  async sendActionNotFound(bot, callbackQuery, action) {
    await this.sendError(
      bot,
      callbackQuery,
      `"${action}" 기능을 찾을 수 없습니다.`
    );
  }

  // ===== 📊 통계 및 상태 =====

  /**
   * 📊 응답 시간 통계 업데이트
   */
  updateResponseTimeStats(responseTime) {
    this.stats.totalResponseTime += responseTime;
    const totalRequests =
      this.stats.callbacksHandled + this.stats.messagesHandled;

    if (totalRequests > 0) {
      this.stats.averageResponseTime = Math.round(
        this.stats.totalResponseTime / totalRequests
      );
    }
  }

  /**
   * 📊 상태 조회
   */
  getStatus() {
    return {
      moduleName: this.moduleName,
      isInitialized: this.isInitialized,
      stats: {
        ...this.stats,
        activeUserStates: this.userStates.size,
      },
      activeUserStates: this.userStates.size,
      availableActions: Array.from(this.actionMap.keys()),
      config: this.config,
      uptime: Date.now() - this.stats.startTime,
    };
  }

  /**
   * 📊 상세 상태 텍스트 생성
   */
  generateStatusText() {
    const status = this.getStatus();
    const uptime = status.uptime;

    return `📱 **${this.moduleName} 상태**

🔧 **모듈 정보**:
• 초기화: ${status.isInitialized ? "✅" : "❌"}
• 등록된 액션: ${status.availableActions.length}개
• 활성 사용자 상태: ${status.activeUserStates}개

📊 **처리 통계**:
• 콜백 처리: ${status.stats.callbacksHandled}회
• 메시지 처리: ${status.stats.messagesHandled}회
• 평균 응답: ${status.stats.averageResponseTime}ms
• 에러: ${status.stats.errorsCount}개

⏱️ **가동시간**: ${this.formatDuration(uptime)}

🎯 **사용 가능한 액션**:
${status.availableActions.map((action) => `• ${action}`).join("\n")}`;
  }

  /**
   * ⏱️ 지속시간 포맷팅
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}시간 ${minutes % 60}분`;
    if (minutes > 0) return `${minutes}분 ${seconds % 60}초`;
    return `${seconds}초`;
  }

  // ===== 🛑 정리 작업 =====

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    try {
      logger.info(`🧹 ${this.moduleName} 정리 시작...`);

      // 사용자 상태 정리 타이머 중지
      if (this.userStateCleanupInterval) {
        clearInterval(this.userStateCleanupInterval);
        this.userStateCleanupInterval = null;
      }

      // 모든 사용자 상태 정리
      for (const userId of this.userStates.keys()) {
        this.clearUserState(userId);
      }

      // 액션 맵 정리
      this.actionMap.clear();

      // 자식 클래스의 정리 로직
      await this.onCleanup();

      this.isInitialized = false;

      logger.success(`✅ ${this.moduleName} 정리 완료`);
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 정리 실패:`, error);
    }
  }

  /**
   * 🎯 자식 클래스에서 구현할 정리 메서드
   */
  async onCleanup() {
    // 자식 클래스에서 구현
  }

  // ===== 🔧 고급 기능들 =====

  /**
   * 🔧 설정 업데이트
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    logger.info(`🔧 ${this.moduleName} 설정 업데이트됨`);
  }

  /**
   * 🔄 모듈 재시작
   */
  async restart() {
    try {
      logger.info(`🔄 ${this.moduleName} 재시작 중...`);

      await this.cleanup();
      await this.initialize();

      logger.success(`✅ ${this.moduleName} 재시작 완료`);
      return true;
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 재시작 실패:`, error);
      return false;
    }
  }

  /**
   * 🏥 헬스체크
   */
  healthCheck() {
    const issues = [];

    // 기본 상태 확인
    if (!this.isInitialized) {
      issues.push("모듈이 초기화되지 않음");
    }

    // 메모리 사용량 확인
    if (this.userStates.size > this.config.maxUserStates * 0.9) {
      issues.push("사용자 상태 메모리 사용량 높음");
    }

    // 에러율 확인
    const totalRequests =
      this.stats.callbacksHandled + this.stats.messagesHandled;
    const errorRate =
      totalRequests > 0 ? this.stats.errorsCount / totalRequests : 0;

    if (errorRate > 0.1) {
      // 10% 이상
      issues.push("높은 에러율 감지");
    }

    return {
      healthy: issues.length === 0,
      issues,
      status: this.getStatus(),
    };
  }
}

module.exports = BaseModule;
