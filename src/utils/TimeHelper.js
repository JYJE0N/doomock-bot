// src/utils/TimeHelper.js - 정확한 한국시간 처리
class TimeHelper {
  static getKoreaTime() {
    const now = new Date();
    // Railway 서버 시간대 보정 + UTC+9
    const koreaTime = new Date(
      now.getTime() + 9 * 60 * 60 * 1000 - now.getTimezoneOffset() * 60 * 1000
    );
    return koreaTime;
  }

  static getLogTimeString(date = null) {
    const targetDate = date || this.getKoreaTime();
    return targetDate.toLocaleString("ko-KR");
  }

  static getShortTimeString(date = null) {
    const targetDate = date || this.getKoreaTime();
    return targetDate.toLocaleString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  // ==================== 📝 기존 메서드들 (한국시간 기반으로 수정) ====================

  static getCurrentYear() {
    return this.getKoreaTime().getFullYear();
  }

  static getCurrentMonth() {
    return this.getKoreaTime().getMonth() + 1;
  }

  static getCurrentDate() {
    return this.getKoreaTime().getDate();
  }

  static getCurrentHour() {
    return this.getKoreaTime().getHours();
  }

  static getCurrentMinute() {
    return this.getKoreaTime().getMinutes();
  }

  static formatDate(date = null, options = {}) {
    const targetDate = date || this.getKoreaTime();
    const defaultOptions = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    };
    return targetDate.toLocaleDateString("ko-KR", {
      ...defaultOptions,
      ...options,
    });
  }

  static formatTime(date = null, options = {}) {
    const targetDate = date || this.getKoreaTime();
    const defaultOptions = {
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

  static formatDateTime(date = null, options = {}) {
    const targetDate = date || this.getKoreaTime();
    const defaultOptions = {
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

  static addMinutes(date, minutes) {
    const result = new Date(date.getTime());
    result.setMinutes(result.getMinutes() + minutes);
    return result;
  }

  static addHours(date, hours) {
    const result = new Date(date.getTime());
    result.setHours(result.getHours() + hours);
    return result;
  }

  static addDays(date, days) {
    const result = new Date(date.getTime());
    result.setDate(result.getDate() + days);
    return result;
  }

  static isToday(date) {
    const today = this.getKoreaTime();
    const targetDate = new Date(date);

    return (
      today.getFullYear() === targetDate.getFullYear() &&
      today.getMonth() === targetDate.getMonth() &&
      today.getDate() === targetDate.getDate()
    );
  }

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

  // ==================== 🎯 작업 ID 생성 (StandardizedSystem용) ====================

  static generateOperationId(type, userId, additional = "") {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${type}_${userId}_${timestamp}_${random}${additional}`;
  }

  // ==================== 🐛 디버그 정보 ====================

  static getDebugInfo() {
    const koreaTime = this.getKoreaTime();
    const systemTime = new Date();

    return {
      koreaTime: this.getLogTimeString(koreaTime),
      systemTime: systemTime.toISOString(),
      timezone: "Asia/Seoul (UTC+9)",
      offset: systemTime.getTimezoneOffset(),
      railwayEnvironment: !!process.env.RAILWAY_ENVIRONMENT,
    };
  }
}

module.exports = TimeHelper;
