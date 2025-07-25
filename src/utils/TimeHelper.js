// src/utils/TimeHelper.js - Railway 환경변수 최적화 한국시간 처리 (moment-timezone 제거)

/**
 * TimeHelper 클래스
 * - 순수 JavaScript Date 객체 사용
 * - Railway 환경에서 한국시간(UTC+9) 정확 처리
 * - moment-timezone 의존성 완전 제거
 */
class TimeHelper {
  /**
   * 정확한 한국시간 가져오기 (UTC+9)
   * Railway 서버 시간대 자동 보정
   */
  static getKoreaTime() {
    const now = new Date();
    // UTC+9 시간대로 변환 (Railway 서버 시간대 자동 보정)
    const koreaTime = new Date(
      now.getTime() + 9 * 60 * 60 * 1000 - now.getTimezoneOffset() * 60 * 1000
    );
    return koreaTime;
  }

  /**
   * 로그용 시간 문자열 (한국시간 기준)
   */
  static getLogTimeString(date = null) {
    const targetDate = date || this.getKoreaTime();
    return targetDate.toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  /**
   * 짧은 시간 문자열 (HH:mm 형식)
   */
  static getShortTimeString(date = null) {
    const targetDate = date || this.getKoreaTime();
    return targetDate.toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  // ==================== 📅 기본 날짜/시간 메서드 ====================

  /**
   * 현재 연도 (한국시간 기준)
   */
  static getCurrentYear() {
    return this.getKoreaTime().getFullYear();
  }

  /**
   * 현재 월 (1-12, 한국시간 기준)
   */
  static getCurrentMonth() {
    return this.getKoreaTime().getMonth() + 1;
  }

  /**
   * 현재 일 (한국시간 기준)
   */
  static getCurrentDate() {
    return this.getKoreaTime().getDate();
  }

  /**
   * 현재 시간 (한국시간 기준)
   */
  static getCurrentHour() {
    return this.getKoreaTime().getHours();
  }

  /**
   * 현재 분 (한국시간 기준)
   */
  static getCurrentMinute() {
    return this.getKoreaTime().getMinutes();
  }

  /**
   * 현재 시간 객체 (시, 분)
   */
  static getCurrentTime() {
    const now = this.getKoreaTime();
    return {
      hours: now.getHours(),
      minutes: now.getMinutes(),
    };
  }

  // ==================== 📝 포맷팅 메서드 ====================

  /**
   * 날짜 포맷팅 (YYYY-MM-DD 기본)
   */
  static formatDate(date = null, options = {}) {
    const targetDate = date || this.getKoreaTime();
    const defaultOptions = {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    };
    return targetDate.toLocaleDateString("ko-KR", {
      ...defaultOptions,
      ...options,
    });
  }

  /**
   * 시간 포맷팅 (HH:mm:ss 기본)
   */
  static formatTime(date = null, options = {}) {
    const targetDate = date || this.getKoreaTime();
    const defaultOptions = {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    };
    return targetDate.toLocaleTimeString("ko-KR", {
      ...defaultOptions,
      ...options,
    });
  }

  /**
   * 날짜시간 포맷팅 (YYYY-MM-DD HH:mm 기본)
   */
  static formatDateTime(date = null, options = {}) {
    const targetDate = date || this.getKoreaTime();
    const defaultOptions = {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    };
    return targetDate.toLocaleString("ko-KR", {
      ...defaultOptions,
      ...options,
    });
  }

  // ==================== ⏰ 상대시간 및 계산 ====================

  /**
   * 상대시간 표시 ("3분 전", "1시간 전" 등)
   */
  static getRelativeTime(date) {
    const now = this.getKoreaTime();
    const targetDate = new Date(date);
    const diffMs = now.getTime() - targetDate.getTime();

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return "방금 전";
    if (diffMinutes < 60) return `${diffMinutes}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;

    return this.formatDate(targetDate);
  }

  /**
   * 분 추가
   */
  static addMinutes(date, minutes) {
    const result = new Date(date.getTime());
    result.setMinutes(result.getMinutes() + minutes);
    return result;
  }

  /**
   * 시간 추가
   */
  static addHours(date, hours) {
    const result = new Date(date.getTime());
    result.setHours(result.getHours() + hours);
    return result;
  }

  /**
   * 일 추가
   */
  static addDays(date, days) {
    const result = new Date(date.getTime());
    result.setDate(result.getDate() + days);
    return result;
  }

  // ==================== 📅 날짜 비교 및 확인 ====================

  /**
   * 오늘인지 확인 (한국시간 기준)
   */
  static isToday(date) {
    const today = this.getKoreaTime();
    const targetDate = new Date(date);

    return (
      today.getFullYear() === targetDate.getFullYear() &&
      today.getMonth() === targetDate.getMonth() &&
      today.getDate() === targetDate.getDate()
    );
  }

  /**
   * 근무일 정보 가져오기
   */
  static getWorkdayInfo() {
    const now = this.getKoreaTime();
    const dayOfWeek = now.getDay();

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dayNames = [
      "일요일",
      "월요일",
      "화요일",
      "수요일",
      "목요일",
      "금요일",
      "토요일",
    ];

    return {
      isWeekend,
      isWorkday: !isWeekend,
      dayName: dayNames[dayOfWeek],
      dayOfWeek,
      currentTime: now,
    };
  }

  // ==================== 🎯 고유 ID 생성 ====================

  /**
   * 작업 ID 생성 (타임스탬프 + 랜덤)
   */
  static generateOperationId(type, userId, additional = "") {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${type}_${userId}_${timestamp}_${random}${additional}`;
  }

  // ==================== 🐛 디버그 및 시스템 정보 ====================

  /**
   * 시간 관련 디버그 정보
   */
  static getDebugInfo() {
    const koreaTime = this.getKoreaTime();
    const systemTime = new Date();

    return {
      koreaTime: this.getLogTimeString(koreaTime),
      systemTime: systemTime.toISOString(),
      timezone: "Asia/Seoul (UTC+9)",
      offset: systemTime.getTimezoneOffset(),
      railwayEnvironment: !!process.env.RAILWAY_ENVIRONMENT,
      serverLocation: process.env.RAILWAY_ENVIRONMENT || "Local",
    };
  }

  // ==================== 🌅 시간대별 인사말 ====================

  /**
   * 시간대별 인사말 생성
   */
  static getTimeBasedGreeting() {
    const hour = this.getCurrentHour();

    if (hour >= 5 && hour < 12) {
      return "🌅 좋은 아침이에요!";
    } else if (hour >= 12 && hour < 18) {
      return "☀️ 좋은 오후에요!";
    } else if (hour >= 18 && hour < 22) {
      return "🌆 좋은 저녁이에요!";
    } else {
      return "🌙 늦은 시간이네요!";
    }
  }

  // ==================== 📊 시간 통계 ====================

  /**
   * 두 시간 간의 차이 계산 (분 단위)
   */
  static getMinutesDifference(startDate, endDate = null) {
    const end = endDate || this.getKoreaTime();
    const start = new Date(startDate);
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
  }

  /**
   * 작업 시간 포맷팅 (예: 1시간 30분)
   */
  static formatDuration(minutes) {
    if (minutes < 60) {
      return `${minutes}분`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (remainingMinutes === 0) {
      return `${hours}시간`;
    }

    return `${hours}시간 ${remainingMinutes}분`;
  }
}

module.exports = TimeHelper;
