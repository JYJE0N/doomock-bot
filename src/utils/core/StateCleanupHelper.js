// src/utils/core/StateCleanupHelper.js - 상태 정리 헬퍼
const logger = require("./Logger");

/**
 * 🧹 StateCleanupHelper - 모듈 상태 자동 정리 유틸리티
 * 
 * V2 모듈들의 userStates 메모리 누수 방지를 위한 공통 정리 시스템
 */
class StateCleanupHelper {
  /**
   * 만료된 상태 정리
   * @param {Map} userStates - 사용자 상태 맵
   * @param {string} moduleName - 모듈명 (로깅용)
   * @param {number} timeout - 타임아웃 (기본 5분)
   * @returns {number} 정리된 상태 수
   */
  static cleanupExpiredStates(userStates, moduleName, timeout = 300000) {
    if (!userStates || typeof userStates.forEach !== 'function') {
      return 0;
    }

    const now = Date.now();
    const expired = [];
    
    userStates.forEach((state, userId) => {
      const timestamp = state.timestamp || state.createdAt || 0;
      if (now - timestamp > timeout) {
        expired.push(userId);
      }
    });
    
    if (expired.length > 0) {
      expired.forEach(userId => userStates.delete(userId));
      logger.debug(`🧹 ${moduleName}: ${expired.length}개 만료 상태 정리`);
    }
    
    return expired.length;
  }

  /**
   * 크기 기반 정리 (최대 크기 초과시 가장 오래된 것부터 제거)
   * @param {Map} userStates - 사용자 상태 맵
   * @param {string} moduleName - 모듈명
   * @param {number} maxSize - 최대 크기 (기본 1000)
   * @returns {number} 정리된 상태 수
   */
  static cleanupBySize(userStates, moduleName, maxSize = 1000) {
    if (!userStates || userStates.size <= maxSize) {
      return 0;
    }

    // 타임스탬프 기준으로 정렬하여 오래된 것부터 제거
    const sortedEntries = Array.from(userStates.entries()).sort((a, b) => {
      const timestampA = a[1].timestamp || a[1].createdAt || 0;
      const timestampB = b[1].timestamp || b[1].createdAt || 0;
      return timestampA - timestampB;
    });

    const toRemove = userStates.size - maxSize;
    for (let i = 0; i < toRemove; i++) {
      userStates.delete(sortedEntries[i][0]);
    }

    logger.debug(`🧹 ${moduleName}: 크기 제한으로 ${toRemove}개 상태 정리`);
    return toRemove;
  }

  /**
   * 자동 정리 인터벌 설정
   * @param {Map} userStates - 사용자 상태 맵
   * @param {string} moduleName - 모듈명
   * @param {Object} options - 옵션
   * @returns {NodeJS.Timer} 인터벌 ID
   */
  static setupAutoCleanup(userStates, moduleName, options = {}) {
    const {
      cleanupInterval = 60000, // 1분
      timeout = 300000,        // 5분
      maxSize = 1000          // 최대 1000개
    } = options;

    return setInterval(() => {
      try {
        let totalCleaned = 0;
        totalCleaned += this.cleanupExpiredStates(userStates, moduleName, timeout);
        totalCleaned += this.cleanupBySize(userStates, moduleName, maxSize);
        
        if (totalCleaned > 0) {
          logger.debug(`🧹 ${moduleName}: 총 ${totalCleaned}개 상태 정리 완료`);
        }
      } catch (error) {
        logger.error(`🧹 ${moduleName} 상태 정리 오류:`, error);
      }
    }, cleanupInterval);
  }

  /**
   * 모듈 종료시 정리
   * @param {NodeJS.Timer} cleanupInterval - 정리 인터벌 ID
   * @param {Map} userStates - 사용자 상태 맵
   * @param {string} moduleName - 모듈명
   */
  static cleanup(cleanupInterval, userStates, moduleName) {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
    }
    
    if (userStates) {
      const stateCount = userStates.size;
      userStates.clear();
      if (stateCount > 0) {
        logger.debug(`🧹 ${moduleName}: ${stateCount}개 모든 상태 정리`);
      }
    }
  }

  /**
   * 상태 추가/업데이트시 자동 타임스탬프 추가
   * @param {Map} userStates - 사용자 상태 맵
   * @param {string} userId - 사용자 ID
   * @param {Object} state - 상태 객체
   */
  static setState(userStates, userId, state) {
    userStates.set(userId, {
      ...state,
      timestamp: Date.now()
    });
  }
}

module.exports = StateCleanupHelper;