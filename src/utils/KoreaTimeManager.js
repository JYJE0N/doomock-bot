// src/utils/KoreaTimeManager.js - 한국시간 완전 통합 표준화
// Railway 환경 v3.0.1 리팩토링 표준

/**
 * 🇰🇷 한국시간 통합 관리자 (싱글톤)
 * - Railway 환경에서 완벽한 한국시간 처리
 * - 모든 모듈에서 동일한 방식으로 시간 처리
 * - Intl API 활용으로 정확성 보장
 */
class KoreaTimeManager {
  constructor() {
    if (KoreaTimeManager.instance) {
      return KoreaTimeManager.instance;
    }

    // 🇰🇷 한국 표준시 설정
    this.timezone = "Asia/Seoul";
    this.locale = "ko-KR";

    // 📋 표준 포맷터들 (성능 최적화)
    this.formatters = {
      // 로그용: 2025. 7. 20. 오후 10:51:09
      log: new Intl.DateTimeFormat(this.locale, {
        timeZone: this.timezone,
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        dayPeriod: "short",
      }),

      // 짧은 형식: 07/20 23:51
      short: new Intl.DateTimeFormat(this.locale, {
        timeZone: this.timezone,
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),

      // 날짜만: 2025-07-20
      dateOnly: new Intl.DateTimeFormat("sv-SE", {
        timeZone: this.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),

      // 시간만: 23:51:09
      timeOnly: new Intl.DateTimeFormat(this.locale, {
        timeZone: this.timezone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }),

      // 상세 형식: 2025년 7월 20일 일요일 오후 11시 51분
      detailed: new Intl.DateTimeFormat(this.locale, {
        timeZone: this.timezone,
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
        hour: "numeric",
        minute: "2-digit",
        dayPeriod: "long",
      }),

      // ISO 형식: 2025-07-20T23:51:09+09:00
      iso: new Intl.DateTimeFormat("sv-SE", {
        timeZone: this.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    };

    // 🔄 중복 방지 시스템
    this.activeOperations = new Map();
    this.operationTimeouts = new Map();
    this.maxTimeout = 10000; // 10초

    // 📊 캐시 시스템 (성능 향상)
    this.cache = new Map();
    this.cacheTimeout = 1000; // 1초

    KoreaTimeManager.instance = this;
  }

  // ==================== 🕐 기본 시간 조회 ====================

  /**
   * 현재 한국 시간 객체 반환
   * @returns {Date} 한국시간 Date 객체
   */
  now() {
    return new Date(
      new Date().toLocaleString("en-US", { timeZone: this.timezone })
    );
  }

  /**
   * 특정 날짜를 한국시간으로 변환
   * @param {Date|string|number} date - 변환할 날짜
   * @returns {Date} 한국시간 Date 객체
   */
  toKoreaTime(date) {
    const inputDate = new Date(date);
    return new Date(
      inputDate.toLocaleString("en-US", { timeZone: this.timezone })
    );
  }

  // ==================== 📝 포맷팅 메서드들 ====================

  /**
   * 로그용 시간 문자열 (캐시됨)
   * @param {Date} [date] - 포맷할 날짜 (기본값: 현재시간)
   * @returns {string} "2025. 7. 20. 오후 10:51:09"
   */
  getLogTimeString(date = null) {
    const targetDate = date || this.now();
    const cacheKey = `log_${Math.floor(targetDate.getTime() / 1000)}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const formatted = this.formatters.log.format(targetDate);
    this.cache.set(cacheKey, formatted);

    // 캐시 정리 (1초 후)
    setTimeout(() => this.cache.delete(cacheKey), this.cacheTimeout);

    return formatted;
  }

  /**
   * 짧은 형식 시간 문자열
   * @param {Date} [date] - 포맷할 날짜
   * @returns {string} "07/20 23:51"
   */
  getShortTimeString(date = null) {
    const targetDate = date || this.now();
    return this.formatters.short.format(targetDate);
  }

  /**
   * 날짜만 문자열
   * @param {Date} [date] - 포맷할 날짜
   * @returns {string} "2025-07-20"
   */
  getDateString(date = null) {
    const targetDate = date || this.now();
    return this.formatters.dateOnly.format(targetDate);
  }

  /**
   * 시간만 문자열
   * @param {Date} [date] - 포맷할 날짜
   * @returns {string} "23:51:09"
   */
  getTimeString(date = null) {
    const targetDate = date || this.now();
    return this.formatters.timeOnly.format(targetDate);
  }

  /**
   * 상세 형식 문자열
   * @param {Date} [date] - 포맷할 날짜
   * @returns {string} "2025년 7월 20일 일요일 오후 11시 51분"
   */
  getDetailedString(date = null) {
    const targetDate = date || this.now();
    return this.formatters.detailed.format(targetDate);
  }

  /**
   * ISO 형식 문자열 (한국시간 기준)
   * @param {Date} [date] - 포맷할 날짜
   * @returns {string} "2025-07-20T23:51:09+09:00"
   */
  getISOString(date = null) {
    const targetDate = date || this.now();
    const isoString = this.formatters.iso.format(targetDate);
    return `${isoString}+09:00`;
  }

  // ==================== 📊 유틸리티 메서드들 ====================

  /**
   * 상대 시간 계산 (몇 분 전, 몇 시간 전)
   * @param {Date|string|number} date - 비교할 날짜
   * @returns {string} "3분 전", "2시간 전" 등
   */
  getRelativeTime(date) {
    const targetDate = new Date(date);
    const now = this.now();
    const diffMs = now.getTime() - targetDate.getTime();

    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffSeconds < 30) return "방금 전";
    if (diffMinutes < 1) return `${diffSeconds}초 전`;
    if (diffMinutes < 60) return `${diffMinutes}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;

    return this.getDateString(targetDate);
  }

  /**
   * 근무시간 정보 조회
   * @param {Date} [date] - 확인할 날짜
   * @returns {Object} 근무시간 정보
   */
  getWorkTimeInfo(date = null) {
    const targetDate = date || this.now();
    const hour = targetDate.getHours();
    const dayOfWeek = targetDate.getDay();

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isWorkTime = hour >= 9 && hour < 18;
    const isLunchTime = hour >= 12 && hour < 13;

    return {
      isWeekend,
      isWorkday: !isWeekend,
      isWorkTime: !isWeekend && isWorkTime,
      isLunchTime: !isWeekend && isLunchTime,
      currentHour: hour,
      dayOfWeek,
      dayName: ["일", "월", "화", "수", "목", "금", "토"][dayOfWeek],
    };
  }

  // ==================== 🚫 중복 방지 시스템 ====================

  /**
   * 작업 시작 (중복 체크)
   * @param {string} operationId - 작업 ID
   * @param {Object} context - 컨텍스트 정보
   * @returns {boolean} 작업 시작 가능 여부
   */
  async startOperation(operationId, context = {}) {
    const now = Date.now();

    if (this.activeOperations.has(operationId)) {
      const startTime = this.activeOperations.get(operationId);
      const elapsed = now - startTime;

      if (elapsed < this.maxTimeout) {
        return false; // 중복 호출 차단
      } else {
        this.endOperation(operationId); // 타임아웃된 작업 정리
      }
    }

    this.activeOperations.set(operationId, now);

    // 자동 타임아웃 설정
    const timeoutId = setTimeout(() => {
      this.endOperation(operationId);
    }, this.maxTimeout);

    this.operationTimeouts.set(operationId, timeoutId);
    return true;
  }

  /**
   * 작업 완료
   * @param {string} operationId - 작업 ID
   */
  endOperation(operationId) {
    this.activeOperations.delete(operationId);

    if (this.operationTimeouts.has(operationId)) {
      clearTimeout(this.operationTimeouts.get(operationId));
      this.operationTimeouts.delete(operationId);
    }
  }

  /**
   * 고유 작업 ID 생성
   * @param {string} type - 작업 타입
   * @param {number} userId - 사용자 ID
   * @param {string} additional - 추가 정보
   * @returns {string} 고유 작업 ID
   */
  generateOperationId(type, userId, additional = "") {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${type}_${userId}_${timestamp}_${random}${additional}`;
  }

  // ==================== 🐛 디버그 및 상태 ====================

  /**
   * 디버그 정보 조회
   * @returns {Object} 디버그 정보
   */
  getDebugInfo() {
    const now = this.now();
    const systemTime = new Date();

    return {
      koreaTime: this.getLogTimeString(now),
      systemTime: systemTime.toISOString(),
      timezone: this.timezone,
      offset: "+09:00",
      workTimeInfo: this.getWorkTimeInfo(now),
      activeOperations: this.activeOperations.size,
      cacheSize: this.cache.size,
      railwayEnvironment: !!process.env.RAILWAY_ENVIRONMENT,
    };
  }

  /**
   * 상태 정보 조회
   * @returns {Object} 상태 정보
   */
  getStatus() {
    return {
      initialized: true,
      timezone: this.timezone,
      locale: this.locale,
      activeOperations: this.activeOperations.size,
      cacheEntries: this.cache.size,
      uptime: process.uptime(),
    };
  }

  /**
   * 정리 작업
   */
  cleanup() {
    // 모든 타임아웃 정리
    for (const timeoutId of this.operationTimeouts.values()) {
      clearTimeout(timeoutId);
    }

    this.activeOperations.clear();
    this.operationTimeouts.clear();
    this.cache.clear();
  }
}

// ==================== 🌍 싱글톤 인스턴스 ====================

const koreaTimeManager = new KoreaTimeManager();

// ==================== 📤 편의 함수들 (하위 호환성) ====================

/**
 * 현재 한국시간 조회 (편의 함수)
 * @returns {Date} 한국시간 Date 객체
 */
function now() {
  return koreaTimeManager.now();
}

/**
 * 로그용 한국시간 문자열 (편의 함수)
 * @param {Date} [date] - 포맷할 날짜
 * @returns {string} 로그용 시간 문자열
 */
function getLogTimeString(date) {
  return koreaTimeManager.getLogTimeString(date);
}

/**
 * 상대 시간 조회 (편의 함수)
 * @param {Date|string|number} date - 비교할 날짜
 * @returns {string} 상대 시간 문자열
 */
function getRelativeTime(date) {
  return koreaTimeManager.getRelativeTime(date);
}

// ==================== 📤 모듈 익스포트 ====================

module.exports = {
  KoreaTimeManager,
  koreaTimeManager, // 싱글톤 인스턴스

  // 편의 함수들
  now,
  getLogTimeString,
  getRelativeTime,

  // 기본 익스포트 (하위 호환성)
  getInstance: () => koreaTimeManager,
  default: koreaTimeManager,
};
