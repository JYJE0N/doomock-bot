// src/utils/TimeHelper.js - 개선된 버전

const moment = require("moment-timezone");

/**
 * 🕐 TimeHelper - 한국 시간 전용 유틸리티 (개선된 안전 버전)
 *
 * 🎯 핵심 개선사항:
 * - null/undefined 값에 대한 안전한 처리
 * - 다양한 입력 형식 지원 (문자열, Date, moment, timestamp)
 * - 에러 발생 시 기본값 반환
 */
class TimeHelper {
  static TIMEZONE = "Asia/Seoul";

  static FORMATS = {
    full: "YYYY년 MM월 DD일 dddd HH:mm:ss",
    date: "YYYY-MM-DD",
    time: "HH:mm:ss",
    short: "MM-DD HH:mm",
    log: "YYYY-MM-DD HH:mm:ss",
    display: "MM월 DD일 (ddd) HH:mm",
    korean: "YYYY년 MM월 DD일",
    timestamp: "YYMMDDHHmm",
    timeOnly: "HH:mm" // 추가: 시:분만 표시
  };

  static {
    moment.locale("ko");
    moment.tz.setDefault(this.TIMEZONE);
  }

  /**
   * 📅 현재 한국 시간 (moment 객체)
   */
  static now() {
    return moment.tz(this.TIMEZONE);
  }

  /**
   * 🔧 안전한 moment 객체 생성 - 핵심 개선!
   * @param {Date|string|number|moment|null|undefined} input - 변환할 시간
   * @returns {moment|null} moment 객체 또는 null
   */
  static safeMoment(input) {
    // null, undefined 처리
    if (input === null || input === undefined) {
      return null;
    }

    try {
      // 이미 moment 객체인 경우
      if (moment.isMoment(input)) {
        return input.tz(this.TIMEZONE);
      }

      // Date 객체인 경우
      if (input instanceof Date) {
        if (isNaN(input.getTime())) {
          return null; // Invalid Date
        }
        return moment.tz(input, this.TIMEZONE);
      }

      // 문자열인 경우
      if (typeof input === "string") {
        if (input.trim() === "") return null;

        const parsed = moment.tz(input, this.TIMEZONE);
        return parsed.isValid() ? parsed : null;
      }

      // 숫자(timestamp)인 경우
      if (typeof input === "number") {
        const parsed = moment.tz(input, this.TIMEZONE);
        return parsed.isValid() ? parsed : null;
      }

      return null;
    } catch (error) {
      console.warn("TimeHelper.safeMoment 파싱 실패:", input, error.message);
      return null;
    }
  }

  /**
   * 📝 안전한 시간 포맷팅 - 핵심 개선!
   * @param {Date|string|moment|null} date - 포맷할 시간 (null이면 현재 시간)
   * @param {string} formatKey - 형식 키 또는 moment 형식 문자열
   * @param {string} fallback - 실패시 기본값
   * @returns {string} 포맷된 시간 문자열
   */
  static format(date = null, formatKey = "log", fallback = "--:--") {
    try {
      // null이면 현재 시간 사용
      if (date === null || date === undefined) {
        const currentMoment = this.now();
        const format = this.FORMATS[formatKey] || formatKey;
        return currentMoment.format(format);
      }

      // 안전한 moment 객체 생성
      const momentDate = this.safeMoment(date);

      if (!momentDate) {
        return fallback; // 파싱 실패시 기본값 반환
      }

      // 포맷 적용
      const format = this.FORMATS[formatKey] || formatKey;
      return momentDate.format(format);
    } catch (error) {
      console.warn("TimeHelper.format 실패:", date, formatKey, error.message);
      return fallback;
    }
  }

  /**
   * 🔍 시간 데이터 유효성 검사
   * @param {any} input - 검사할 값
   * @returns {boolean} 유효한 시간 데이터면 true
   */
  static isValidTime(input) {
    if (input === null || input === undefined) return false;

    const momentObj = this.safeMoment(input);
    return momentObj !== null && momentObj.isValid();
  }

  /**
   * 🛡️ 안전한 시간 표시 (UI용)
   * @param {any} timeData - 시간 데이터
   * @param {string} format - 표시 형식
   * @returns {string} 안전한 시간 문자열
   */
  static safeDisplayTime(timeData, format = "timeOnly") {
    if (!this.isValidTime(timeData)) {
      return "미기록";
    }

    return this.format(timeData, format, "미기록");
  }

  /**
   * 🔄 기존 메서드들 (호환성 유지)
   */
  static getKoreanDate() {
    return this.now().toDate();
  }

  static getTodayDateString() {
    return this.format(null, "date");
  }

  static getWeekStart() {
    return this.now().startOf("week").toDate();
  }

  static getWeekEnd() {
    return this.now().endOf("week").toDate();
  }

  static getMonthStart() {
    return this.now().startOf("month").toDate();
  }

  static getMonthEnd() {
    return this.now().endOf("month").toDate();
  }

  static addMinutes(date, minutes) {
    const safeMoment = this.safeMoment(date);
    if (!safeMoment) return null;

    return safeMoment.add(minutes, "minutes").toDate();
  }

  static diffMinutes(startTime, endTime) {
    const start = this.safeMoment(startTime);
    const end = this.safeMoment(endTime);

    if (!start || !end) return 0;

    return end.diff(start, "minutes");
  }

  static isToday(date) {
    const safeMoment = this.safeMoment(date);
    if (!safeMoment) return false;

    return safeMoment.isSame(this.now(), "day");
  }

  static isWorkday(date = null) {
    const checkDate = date ? this.safeMoment(date) : this.now();
    if (!checkDate) return false;

    const weekday = checkDate.day();
    return weekday >= 1 && weekday <= 5;
  }

  /**
   * 🔥 로그용 시간 문자열 - 핵심 메서드!
   * @returns {string} 로그 형식 시간 (YYYY-MM-DD HH:mm:ss)
   */
  static getLogTimeString() {
    return this.format(null, "log");
  }

  /**
   * 🎯 디버깅용 시간 정보
   * @param {any} input - 분석할 시간 데이터
   * @returns {object} 디버깅 정보
   */
  static debugTime(input) {
    return {
      original: input,
      type: typeof input,
      isNull: input === null,
      isUndefined: input === undefined,
      isValid: this.isValidTime(input),
      safeMoment: this.safeMoment(input)?.format() || "null",
      formatted: this.safeDisplayTime(input)
    };
  }

  /**
   * ℹ️ TimeHelper 정보 반환 (업데이트됨)
   */
  static getInfo() {
    return {
      timezone: this.TIMEZONE,
      currentTime: this.format(null, "full"),
      formats: this.FORMATS,
      locale: moment.locale(),
      isStaticClass: true,
      version: "2.2.0", // 안전 처리 버전
      improvements: [
        "safeMoment 메서드 추가",
        "null/undefined 안전 처리",
        "safeDisplayTime UI 헬퍼 추가",
        "debugTime 디버깅 도구 추가"
      ]
    };
  }
}

module.exports = TimeHelper;
