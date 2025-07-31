// src/utils/TimeHelper.js - getKoreanDate 메서드 추가 버전

const moment = require("moment-timezone");

/**
 * 🕐 TimeHelper - 한국 시간 전용 유틸리티 (완전 Static 클래스)
 *
 * 🎯 한 가지 책임: 한국 시간대 기반 시간 처리
 * ✅ 모든 메서드가 static으로 통일
 * 🔧 표준 매개변수 구조
 */
class TimeHelper {
  // 🌏 한국 시간대 상수
  static TIMEZONE = "Asia/Seoul";

  // 📋 표준 형식 정의
  static FORMATS = {
    full: "YYYY년 MM월 DD일 dddd HH:mm:ss",
    date: "YYYY-MM-DD",
    time: "HH:mm:ss",
    short: "MM-DD HH:mm",
    log: "YYYY-MM-DD HH:mm:ss",
    display: "MM월 DD일 (ddd) HH:mm",
    korean: "YYYY년 MM월 DD일",
    timestamp: "YYMMDDHHmm",
  };

  /**
   * 🏗️ 클래스 초기화 (한 번만 실행)
   */
  static {
    // 한국어 로케일 설정
    moment.locale("ko");
    moment.tz.setDefault(this.TIMEZONE);
  }

  // ===== 🕐 핵심 시간 메서드 =====

  /**
   * 📅 현재 한국 시간 (moment 객체)
   */
  static now() {
    return moment.tz(this.TIMEZONE);
  }

  /**
   * 📝 시간 포맷팅
   * @param {Date|moment|null} date - 포맷할 시간 (null이면 현재 시간)
   * @param {string} formatKey - 형식 키 또는 moment 형식 문자열
   * @returns {string} 포맷된 시간 문자열
   */
  static format(date = null, formatKey = "log") {
    const momentDate = date ? moment.tz(date, this.TIMEZONE) : this.now();

    // 미리 정의된 형식이 있으면 사용
    if (this.FORMATS[formatKey]) {
      return momentDate.format(this.FORMATS[formatKey]);
    }

    // 아니면 직접 moment 형식으로 사용
    return momentDate.format(formatKey);
  }

  /**
   * 📅 현재 한국 날짜 (Date 객체) - ✅ 누락된 메서드 추가!
   * @returns {Date} 현재 한국 시간의 Date 객체
   */
  static getKoreanDate() {
    return this.now().toDate();
  }

  /**
   * 📅 오늘의 한국 날짜 (YYYY-MM-DD 형식) - ✅ 편의 메서드
   * @returns {string} 오늘 날짜 문자열
   */
  static getTodayDateString() {
    return this.format(null, "date");
  }

  // ===== ➕ 시간 연산 메서드 =====

  /**
   * 📅 분 더하기
   * @param {Date|moment} date - 기준 날짜
   * @param {number} minutes - 더할 분 수
   * @returns {Date} 결과 Date 객체
   */
  static addMinutes(date, minutes) {
    const result = new Date(date);
    result.setMinutes(result.getMinutes() + minutes);
    return result;
  }

  /**
   * 📅 시간 더하기
   * @param {Date|moment} date - 기준 날짜
   * @param {number} hours - 더할 시간 수
   * @returns {Date} 결과 Date 객체
   */
  static addHours(date, hours) {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
  }

  /**
   * 📅 일 더하기
   * @param {Date|moment} date - 기준 날짜
   * @param {number} days - 더할 일 수
   * @returns {Date} 결과 Date 객체
   */
  static addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * 📅 시간 설정
   * @param {Date|moment} date - 기준 날짜
   * @param {number} hour - 시 (0-23)
   * @param {number} minute - 분 (0-59)
   * @param {number} second - 초 (0-59)
   * @returns {Date} 결과 Date 객체
   */
  static setTime(date, hour, minute, second = 0) {
    const result = new Date(date);
    result.setHours(hour, minute, second, 0);
    return result;
  }

  // ===== 🔍 시간 비교 메서드 =====

  /**
   * 📅 시간 비교 (date1이 date2보다 이전인가?)
   * @param {Date|moment} date1 - 첫 번째 날짜
   * @param {Date|moment} date2 - 두 번째 날짜
   * @returns {boolean} date1이 date2보다 이전이면 true
   */
  static isBefore(date1, date2) {
    return new Date(date1).getTime() < new Date(date2).getTime();
  }

  /**
   * 📅 요일 가져오기 (0=일요일, 1=월요일...)
   * @param {Date|moment} date - 날짜
   * @returns {number} 요일 (0-6)
   */
  static getWeekday(date) {
    return new Date(date).getDay();
  }

  /**
   * 📅 오늘인지 확인
   * @param {Date|moment} date - 확인할 날짜
   * @returns {boolean} 오늘이면 true
   */
  static isToday(date) {
    const today = this.now().startOf("day");
    const checkDate = moment.tz(date, this.TIMEZONE).startOf("day");
    return today.isSame(checkDate);
  }

  // ===== 🏢 업무 시간 관련 메서드 =====

  /**
   * 📅 업무일인지 확인 (월~금)
   * @param {Date|moment|null} date - 확인할 날짜 (null이면 현재)
   * @returns {boolean} 업무일이면 true
   */
  static isWorkday(date = null) {
    const checkDate = date ? moment.tz(date, this.TIMEZONE) : this.now();
    const weekday = checkDate.day(); // 0=일요일, 6=토요일
    return weekday >= 1 && weekday <= 5; // 월~금
  }

  /**
   * 📅 다음 업무일 가져오기
   * @param {Date|moment|null} date - 기준 날짜 (null이면 현재)
   * @returns {moment} 다음 업무일
   */
  static getNextWorkday(date = null) {
    let checkDate = date ? moment.tz(date, this.TIMEZONE) : this.now();

    do {
      checkDate = checkDate.add(1, "day");
    } while (!this.isWorkday(checkDate));

    return checkDate;
  }

  // ===== 🔧 유틸리티 메서드 =====

  /**
   * 📊 두 시간 사이의 차이 계산
   * @param {Date|moment} startTime - 시작 시간
   * @param {Date|moment} endTime - 종료 시간
   * @param {string} unit - 단위 ('minutes', 'hours', 'days' 등)
   * @returns {number} 차이값
   */
  static diff(startTime, endTime, unit = "minutes") {
    const start = moment.tz(startTime, this.TIMEZONE);
    const end = moment.tz(endTime, this.TIMEZONE);
    return end.diff(start, unit);
  }

  /**
   * ⏱️ 경과 시간 계산
   * @param {Date|number} startTime - 시작 시간 (Date 객체 또는 timestamp)
   * @returns {string} 경과 시간 문자열
   */
  static getElapsedTime(startTime) {
    if (!startTime) return "측정 불가";

    const now = Date.now();
    const elapsed =
      now - (startTime instanceof Date ? startTime.getTime() : startTime);

    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}일 전`;
    if (hours > 0) return `${hours}시간 전`;
    if (minutes > 0) return `${minutes}분 전`;
    return `${seconds}초 전`;
  }

  /**
   * ⏳ 기간 포맷팅
   * @param {number} milliseconds - 밀리초
   * @returns {string} 포맷된 기간 문자열
   */
  static formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}일 ${hours % 24}시간`;
    if (hours > 0) return `${hours}시간 ${minutes % 60}분`;
    if (minutes > 0) return `${minutes}분 ${seconds % 60}초`;
    return `${seconds}초`;
  }

  // ===== 🔄 호환성 메서드 (기존 코드 지원) =====

  /**
   * 🇰🇷 한국 시간 문자열 (호환성)
   * @returns {string} 전체 형식 한국 시간
   */
  static getKoreaTimeString() {
    return this.format(null, "full");
  }

  /**
   * 🔥 로그용 시간 문자열 - 핵심 메서드!
   * @returns {string} 로그 형식 시간 (YYYY-MM-DD HH:mm:ss)
   */
  static getLogTimeString() {
    return this.format(null, "log");
  }

  /**
   * 현재 시간을 다양한 형식으로 반환 (호환성)
   * @param {string} format - 형식 키
   * @returns {string} 포맷된 시간 문자열
   */
  static getCurrentTime(format = "log") {
    return this.format(null, format);
  }

  /**
   * 짧은 시간 문자열 (호환성)
   * @returns {string} 짧은 형식 시간
   */
  static getShortTimeString() {
    return this.format(null, "short");
  }

  /**
   * 타임스탬프 반환 (호환성)
   * @returns {number} 현재 타임스탬프
   */
  static getTimestamp() {
    return this.now().valueOf();
  }

  /**
   * 상대 시간 표시 (호환성)
   * @param {Date|moment} date - 기준 날짜
   * @returns {string} 상대 시간 문자열 ("3분 전", "2시간 후" 등)
   */
  static fromNow(date) {
    return moment.tz(date, this.TIMEZONE).fromNow();
  }

  /**
   * 📅 날짜 파싱 (다양한 형식 지원)
   * @param {string} dateString - 파싱할 날짜 문자열
   * @param {string|null} format - 특정 형식 (null이면 자동 감지)
   * @returns {moment} 파싱된 moment 객체
   */
  static parse(dateString, format = null) {
    if (format) {
      return moment.tz(dateString, format, this.TIMEZONE);
    }

    const formats = [
      "YYYY-MM-DD",
      "YYYY/MM/DD",
      "DD-MM-YYYY",
      "DD/MM/YYYY",
      "YYYY-MM-DD HH:mm:ss",
      "YYYY-MM-DD HH:mm",
      "MM/DD/YYYY",
      "MM-DD-YYYY",
      "HH:mm",
      "HH:mm:ss",
    ];

    return moment.tz(dateString, formats, this.TIMEZONE);
  }

  /**
   * 📊 유효한 날짜인지 확인
   * @param {any} date - 확인할 값
   * @returns {boolean} 유효한 날짜면 true
   */
  static isValid(date) {
    return moment(date).isValid();
  }

  /**
   * ℹ️ TimeHelper 정보 반환
   * @returns {object} 설정 정보 객체
   */
  static getInfo() {
    return {
      timezone: this.TIMEZONE,
      currentTime: this.format(null, "full"),
      formats: this.FORMATS,
      locale: moment.locale(),
      isStaticClass: true,
      version: "2.1.0", // getKoreanDate 추가로 버전 업
      newMethods: ["getKoreanDate", "getTodayDateString"],
    };
  }
}

module.exports = TimeHelper;
