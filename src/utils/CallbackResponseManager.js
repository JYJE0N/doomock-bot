// src/utils/CallbackResponseManager.js - 중앙 콜백 응답 관리자 v4.0.1
const logger = require("./Logger");

/**
 * 🎯 CallbackResponseManager - 콜백 응답 중복 방지 시스템
 *
 * 📋 핵심 기능:
 * - answerCallbackQuery 중복 호출 방지
 * - 응답 상태 추적 및 관리
 * - 자동 정리 스케줄러
 * - 에러 상황 처리
 *
 * 🎭 비유:
 * 한 번의 질문에 여러 명이 동시에 대답하려는 걸 방지하는 '발언권 관리자' 같은 역할
 */
class CallbackResponseManager {
  constructor() {
    // 이미 응답한 콜백 ID 추적
    this.respondedCallbacks = new Set();

    // 응답 시도 중인 콜백 추적 (동시성 방지)
    this.pendingCallbacks = new Set();

    // 통계
    this.stats = {
      totalResponses: 0,
      successfulResponses: 0,
      duplicateAttempts: 0,
      errorResponses: 0,
      expiredCallbacks: 0,
    };

    // 자동 정리 스케줄러 (5분마다)
    this.startCleanupScheduler();

    logger.info("🎯 CallbackResponseManager 초기화 완료");
  }

  /**
   * 🎯 콜백 응답 (중복 방지 로직)
   */
  async answerCallback(bot, callbackQuery, options = {}) {
    const callbackId = callbackQuery.id;

    try {
      // 1. 이미 응답했는지 확인
      if (this.respondedCallbacks.has(callbackId)) {
        logger.debug(`중복 응답 시도 차단: ${callbackId}`);
        this.stats.duplicateAttempts++;
        return { success: false, reason: "already_answered" };
      }

      // 2. 현재 응답 시도 중인지 확인 (동시성 방지)
      if (this.pendingCallbacks.has(callbackId)) {
        logger.debug(`동시 응답 시도 차단: ${callbackId}`);
        this.stats.duplicateAttempts++;
        return { success: false, reason: "response_pending" };
      }

      // 3. 응답 시도 시작
      this.pendingCallbacks.add(callbackId);
      this.stats.totalResponses++;

      // 4. 실제 응답 처리
      // await bot.answerCallbackQuery(callbackId, {
      //   text: "🔊 TTS 설정 완료",
      //   show_alert: options.show_alert || false,
      //   url: options.url,
      //   cache_time: options.cache_time || 0,
      // });
      logger.debug("콜백 응답 처리됨 (BotController에서 이미 처리)");

      // 5. 성공 기록
      this.respondedCallbacks.add(callbackId);
      this.stats.successfulResponses++;

      logger.debug(
        `콜백 응답 성공: ${callbackId} - "${options.text || "처리 중..."}"`
      );

      return {
        success: true,
        callbackId,
        responseText: options.text,
      };
    } catch (error) {
      this.stats.errorResponses++;

      // 일반적인 에러 케이스들
      if (error.message.includes("query is too old")) {
        logger.warn(`만료된 콜백: ${callbackId}`);
        this.stats.expiredCallbacks++;

        // 만료된 콜백도 응답한 것으로 처리 (재시도 방지)
        this.respondedCallbacks.add(callbackId);

        return {
          success: false,
          reason: "expired",
          error: error.message,
        };
      } else if (
        error.message.includes("already answered") ||
        error.message.includes("QUERY_ID_INVALID")
      ) {
        logger.warn(`이미 응답된 콜백: ${callbackId}`);

        // 이미 응답된 것으로 기록
        this.respondedCallbacks.add(callbackId);

        return {
          success: false,
          reason: "already_answered_external",
          error: error.message,
        };
      } else {
        logger.error(`콜백 응답 실패: ${callbackId}`, error);

        return {
          success: false,
          reason: "unknown_error",
          error: error.message,
        };
      }
    } finally {
      // 응답 시도 완료 (성공/실패 관계없이)
      this.pendingCallbacks.delete(callbackId);
    }
  }

  /**
   * 🔄 로딩 응답 (즉시 반응)
   */
  async answerLoading(bot, callbackQuery, loadingText = null) {
    const loadingMessages = [
      "⏳ 처리 중...",
      "⌛ 잠시만 기다려주세요...",
      "🔄 로딩 중...",
      "⚡ 처리하고 있어요...",
    ];

    const text =
      loadingText ||
      loadingMessages[Math.floor(Math.random() * loadingMessages.length)];

    return await this.answerCallback(bot, callbackQuery, { text });
  }

  /**
   * ❌ 에러 응답 (알림 팝업)
   */
  async answerError(
    bot,
    callbackQuery,
    errorText = "처리 중 오류가 발생했습니다"
  ) {
    return await this.answerCallback(bot, callbackQuery, {
      text: `❌ ${errorText}`,
      show_alert: true,
    });
  }

  /**
   * ✅ 성공 응답
   */
  async answerSuccess(bot, callbackQuery, successText = "완료되었습니다") {
    return await this.answerCallback(bot, callbackQuery, {
      text: `✅ ${successText}`,
    });
  }

  /**
   * 🔍 콜백 상태 확인
   */
  getCallbackStatus(callbackId) {
    return {
      responded: this.respondedCallbacks.has(callbackId),
      pending: this.pendingCallbacks.has(callbackId),
      canRespond:
        !this.respondedCallbacks.has(callbackId) &&
        !this.pendingCallbacks.has(callbackId),
    };
  }

  /**
   * 📊 통계 조회
   */
  getStats() {
    return {
      ...this.stats,
      currentPending: this.pendingCallbacks.size,
      totalTracked: this.respondedCallbacks.size,
      successRate:
        this.stats.totalResponses > 0
          ? (
              (this.stats.successfulResponses / this.stats.totalResponses) *
              100
            ).toFixed(2)
          : 0,
    };
  }

  /**
   * 🧹 자동 정리 스케줄러 시작
   */
  startCleanupScheduler() {
    // 5분마다 오래된 콜백 정리
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);

    logger.debug("콜백 정리 스케줄러 시작됨 (5분 간격)");
  }

  /**
   * 🧹 메모리 정리
   */
  cleanup() {
    const beforeSize = this.respondedCallbacks.size;

    // 응답된 콜백 정리 (메모리 절약)
    this.respondedCallbacks.clear();

    // 만약 pending 상태가 너무 오래 지속되면 정리
    this.pendingCallbacks.clear();

    const cleanedCount = beforeSize;

    if (cleanedCount > 0) {
      logger.debug(`콜백 정리 완료: ${cleanedCount}개 항목 정리됨`);
    }
  }

  /**
   * 🛑 리소스 해제
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.respondedCallbacks.clear();
    this.pendingCallbacks.clear();

    logger.info("CallbackResponseManager 리소스 해제 완료");
  }

  /**
   * 🎯 싱글톤 인스턴스 (전역 사용)
   */
  static getInstance() {
    if (!CallbackResponseManager._instance) {
      CallbackResponseManager._instance = new CallbackResponseManager();
    }
    return CallbackResponseManager._instance;
  }
}

module.exports = CallbackResponseManager;
