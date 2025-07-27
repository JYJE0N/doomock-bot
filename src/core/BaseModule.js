// src/core/BaseModule.js - 개선된 베이스 모듈 v3.0.1
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName, getUserId } = require("../utils/UserHelper");

/**
 * 🏗️ BaseModule - 모든 모듈이 상속받는 표준 클래스
 *
 * 🎯 v3.0.1 개선사항:
 * - ServiceBuilder 지원 추가
 * - 사용자 상태 관리 내장
 * - 유틸리티 메서드 추가
 * - 메시지 처리 통일
 */
class BaseModule {
  constructor(moduleName, options = {}) {
    this.moduleName = moduleName;
    this.bot = options.bot;
    this.db = options.db;
    this.moduleManager = options.moduleManager;
    this.serviceBuilder = options.serviceBuilder; // 👈 ServiceBuilder 지원
    this.config = options.config || {};

    // 액션 맵 (switch문 대신 사용)
    this.actionMap = new Map();

    // 👈 사용자 상태 관리 (내장)
    this.userStates = new Map();

    // 상태
    this.isInitialized = false;
    this.lastActivity = null;

    // 통계
    this.stats = {
      callbacksHandled: 0,
      messagesHandled: 0,
      errorsCount: 0,
      createdAt: TimeHelper.now(),
    };

    logger.module(this.moduleName, "모듈 생성됨");
  }

  /**
   * 🎯 초기화 (자식 클래스에서 오버라이드)
   */
  async initialize() {
    try {
      logger.module(this.moduleName, "초기화 시작...");

      // 자식 클래스의 onInitialize 호출
      if (this.onInitialize) {
        await this.onInitialize();
      }

      // 액션 설정
      this.setupActions();

      this.isInitialized = true;
      logger.success(`${this.moduleName} 초기화 완료`);
    } catch (error) {
      logger.error(`${this.moduleName} 초기화 실패`, error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록 (자식 클래스에서 호출)
   */
  registerActions(actions) {
    for (const [action, handler] of Object.entries(actions)) {
      this.actionMap.set(action, handler.bind(this));
    }

    logger.debug(`${this.moduleName}: ${this.actionMap.size}개 액션 등록됨`);
  }

  /**
   * 🎯 액션 설정 (자식 클래스에서 구현 필수!)
   */
  setupActions() {
    throw new Error(`${this.moduleName}: setupActions() 구현 필요`);
  }

  /**
   * 🎯 콜백 처리 (표준 매개변수)
   */
  async handleCallback(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      this.stats.callbacksHandled++;
      this.lastActivity = TimeHelper.now();

      logger.navigation(this.moduleName, subAction, getUserId(callbackQuery));

      // 액션 찾기
      const handler = this.actionMap.get(subAction);
      if (!handler) {
        logger.warn(`${this.moduleName}: 알 수 없는 액션 - ${subAction}`);

        // NavigationHandler를 통한 에러 처리
        if (this.moduleManager && this.moduleManager.navigationHandler) {
          await this.moduleManager.navigationHandler.sendError(
            bot,
            callbackQuery,
            "알 수 없는 명령입니다."
          );
        }
        return;
      }

      // 핸들러 실행 (표준 매개변수)
      const result = await handler.call(
        this,
        bot,
        callbackQuery,
        subAction,
        params,
        moduleManager
      );

      // NavigationHandler가 UI 처리
      if (
        result &&
        this.moduleManager &&
        this.moduleManager.navigationHandler
      ) {
        await this.moduleManager.navigationHandler.handleModuleResponse(
          bot,
          callbackQuery,
          result
        );
      }
    } catch (error) {
      this.stats.errorsCount++;
      logger.error(`${this.moduleName} 콜백 처리 실패`, error);
      await this.handleError(callbackQuery, error);
    }
  }

  /**
   * 💬 메시지 처리 (표준 패턴)
   */
  async handleMessage(bot, msg) {
    try {
      this.stats.messagesHandled++;
      this.lastActivity = TimeHelper.now();

      // 자식 클래스의 onHandleMessage 호출
      const handled = await this.onHandleMessage(bot, msg);

      if (handled) {
        logger.debug(`${this.moduleName} 메시지 처리 완료`);
      }

      return handled;
    } catch (error) {
      this.stats.errorsCount++;
      logger.error(`${this.moduleName} 메시지 처리 실패`, error);
      return false;
    }
  }

  /**
   * 💬 메시지 처리 (자식 클래스에서 구현)
   */
  async onHandleMessage(bot, msg) {
    // 자식 클래스에서 구현
    return false; // handled 여부 반환
  }

  // ===== 🔧 유틸리티 메서드들 =====

  /**
   * 명령어 추출
   */
  extractCommand(text) {
    if (!text || typeof text !== "string") return null;

    const match = text.match(/^\/([a-zA-Z0-9_]+)/);
    return match ? match[1].toLowerCase() : null;
  }

  /**
   * 사용자 상태 조회
   */
  getUserState(userId) {
    return this.userStates.get(userId) || null;
  }

  /**
   * 사용자 상태 설정
   */
  setUserState(userId, state) {
    this.userStates.set(userId, {
      ...state,
      setAt: TimeHelper.now(),
      moduleId: this.moduleName,
    });
  }

  /**
   * 사용자 상태 초기화
   */
  clearUserState(userId) {
    return this.userStates.delete(userId);
  }

  /**
   * 모든 사용자 상태 초기화
   */
  clearAllUserStates() {
    this.userStates.clear();
  }

  /**
   * 만료된 사용자 상태 정리 (30분)
   */
  cleanupExpiredStates() {
    const now = TimeHelper.now();
    const expireTime = 30 * 60 * 1000; // 30분

    for (const [userId, state] of this.userStates.entries()) {
      if (now - state.setAt > expireTime) {
        this.userStates.delete(userId);
      }
    }
  }

  // ===== 🔧 표준 메시지 메서드들 =====

  /**
   * 성공 메시지 전송
   */
  async sendSuccess(bot, chatId, message) {
    if (this.moduleManager && this.moduleManager.navigationHandler) {
      await this.moduleManager.navigationHandler.sendSuccess(
        bot,
        chatId,
        message
      );
    }
  }

  /**
   * 에러 메시지 전송
   */
  async sendError(bot, callbackQuery, message) {
    if (this.moduleManager && this.moduleManager.navigationHandler) {
      await this.moduleManager.navigationHandler.sendError(
        bot,
        callbackQuery,
        message
      );
    }
  }

  /**
   * 메시지 편집
   */
  async editMessage(bot, chatId, messageId, text, options = {}) {
    try {
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        ...options,
      });
    } catch (error) {
      logger.error(`메시지 편집 실패 (${this.moduleName})`, error);
    }
  }

  /**
   * 메시지 전송
   */
  async sendMessage(bot, chatId, text, options = {}) {
    try {
      await bot.sendMessage(chatId, text, {
        parse_mode: "Markdown",
        ...options,
      });
    } catch (error) {
      logger.error(`메시지 전송 실패 (${this.moduleName})`, error);
    }
  }

  // ===== ❌ 에러 처리 =====

  /**
   * 에러 처리
   */
  async handleError(ctx, error) {
    logger.error(`${this.moduleName} 에러`, error);

    try {
      if (this.moduleManager && this.moduleManager.navigationHandler) {
        await this.moduleManager.navigationHandler.sendError(
          this.bot,
          ctx,
          "처리 중 오류가 발생했습니다."
        );
      } else {
        // 폴백 에러 처리
        const errorMessage =
          "❌ 처리 중 오류가 발생했습니다.\n다시 시도해주세요.";

        if (ctx.editMessageText) {
          await ctx.editMessageText(errorMessage);
        } else if (ctx.reply) {
          await ctx.reply(errorMessage);
        }
      }
    } catch (replyError) {
      logger.error("에러 메시지 전송 실패", replyError);
    }
  }

  // ===== 📊 상태 및 통계 =====

  /**
   * 통계 조회
   */
  getStats() {
    return {
      ...this.stats,
      uptime: TimeHelper.getTimeDiff(this.stats.createdAt, TimeHelper.now()),
      lastActivity: this.lastActivity,
      userStatesCount: this.userStates.size,
      actionsCount: this.actionMap.size,
    };
  }

  /**
   * 헬스 체크
   */
  isHealthy() {
    return this.isInitialized && !this.hasErrors();
  }

  /**
   * 에러 여부
   */
  hasErrors() {
    // 최근 1분간 에러가 5개 이상이면 unhealthy
    return this.stats.errorsCount > 5;
  }

  /**
   * 상태 조회
   */
  getStatus() {
    return {
      module: this.moduleName,
      initialized: this.isInitialized,
      healthy: this.isHealthy(),
      stats: this.getStats(),
      hasServiceBuilder: !!this.serviceBuilder,
      hasModuleManager: !!this.moduleManager,
    };
  }

  // ===== 🧹 정리 작업 =====

  /**
   * 정리 작업
   */
  async cleanup() {
    logger.module(this.moduleName, "정리 시작...");

    try {
      // 자식 클래스의 onCleanup 호출
      if (this.onCleanup) {
        await this.onCleanup();
      }

      // 상태 정리
      this.clearAllUserStates();
      this.actionMap.clear();

      this.isInitialized = false;
      logger.success(`${this.moduleName} 정리 완료`);
    } catch (error) {
      logger.error(`${this.moduleName} 정리 실패`, error);
    }
  }

  // ===== 🎯 자식 클래스에서 구현할 메서드들 =====

  /**
   * 초기화 시 호출 (선택적)
   */
  async onInitialize() {
    // 자식 클래스에서 오버라이드
  }

  /**
   * 정리 시 호출 (선택적)
   */
  async onCleanup() {
    // 자식 클래스에서 오버라이드
  }
}

module.exports = BaseModule;
