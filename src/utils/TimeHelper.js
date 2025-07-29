// src/utils/TimeHelper.js - 응급 수정 버전
const moment = require("moment-timezone");

/**
 * 🕐 시간 헬퍼 - 한국 시간 전용
 * - 모든 시간은 KST (Asia/Seoul) 기준
 * - Railway 환경 최적화
 * - 다양한 형식 지원
 */
class TimeHelper {
  constructor() {
    this.timezone = "Asia/Seoul";

    // 한국어 로케일 설정
    moment.locale("ko");
    moment.tz.setDefault(this.timezone);

    // 기본 형식들
    this.formats = {
      full: "YYYY년 MM월 DD일 dddd HH:mm:ss",
      date: "YYYY-MM-DD",
      time: "HH:mm:ss",
      short: "MM-DD HH:mm",
      log: "YYYY-MM-DD HH:mm:ss",
      display: "MM월 DD일 (ddd) HH:mm",
      korean: "YYYY년 MM월 DD일",
      timestamp: "YYMMDDHHmm",
    };
  }

  /**
   * 📅 분 더하기
   */
  static addMinutes(date, minutes) {
    const result = new Date(date);
    result.setMinutes(result.getMinutes() + minutes);
    return result;
  }

  /**
   * 📅 시간 더하기
   */
  static addHours(date, hours) {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
  }

  /**
   * 📅 일 더하기
   */
  static addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * 🇰🇷 한국 시간 문자열 (호환성)
   */
  static getKoreaTimeString() {
    return this.format(this.now(), "full");
  }

  /**
   * ⏱️ 경과 시간 계산
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

  /**
   * 📅 시간 설정
   */
  static setTime(date, hour, minute, second = 0) {
    const result = new Date(date);
    result.setHours(hour, minute, second, 0);
    return result;
  }

  /**
   * 📅 요일 가져오기 (0=일요일, 1=월요일...)
   */
  static getWeekday(date) {
    return date.getDay();
  }

  /**
   * 📅 시간 비교
   */
  static isBefore(date1, date2) {
    return date1.getTime() < date2.getTime();
  }

  static addMinutes(date, minutes) {
    const result = new Date(date);
    result.setMinutes(result.getMinutes() + minutes);
    return result;
  }

  static getKoreaTimeString() {
    return this.format(this.now(), "full");
  }

  /**
   * 현재 타임존 반환
   */
  getTimeZone() {
    return this.timezone;
  }

  /**
   * Date 객체를 지정된 형식으로 포맷
   */
  format(date, formatKey = "log") {
    const momentDate = date ? moment.tz(date, this.timezone) : this.now();

    if (this.formats[formatKey]) {
      return momentDate.format(this.formats[formatKey]);
    }

    return momentDate.format(formatKey);
  }

  /**
   * 현재 KST 시간 (moment 객체)
   */
  now() {
    return moment.tz(this.timezone);
  }

  /**
   * 현재 시간을 다양한 형식으로 반환
   */
  getCurrentTime(format = "log") {
    const now = this.now();

    switch (format) {
      case "full":
        return now.format(this.formats.full);
      case "date":
        return now.format(this.formats.date);
      case "time":
        return now.format(this.formats.time);
      case "short":
        return now.format(this.formats.short);
      case "log":
        return now.format(this.formats.log);
      case "display":
        return now.format(this.formats.display);
      case "korean":
        return now.format(this.formats.korean);
      case "timestamp":
        return now.format(this.formats.timestamp);
      default:
        return now.format(format);
    }
  }

  /**
   * 🔥 로그용 시간 문자열 - 핵심 메서드!
   */
  getLogTimeString() {
    return this.getCurrentTime("log");
  }

  /**
   * 짧은 시간 문자열
   */
  getShortTimeString() {
    return this.getCurrentTime("short");
  }

  /**
   * 타임스탬프
   */
  getTimestamp() {
    return this.now().valueOf();
  }

  /**
   * 임의의 시간을 KST로 변환
   */
  toKST(date) {
    if (!date) return this.now();

    if (moment.isMoment(date)) {
      return date.tz(this.timezone);
    }

    return moment.tz(date, this.timezone);
  }

  /**
   * 오늘 날짜 (00:00:00)
   */
  today() {
    return this.now().startOf("day");
  }

  /**
   * 어제 날짜
   */
  yesterday() {
    return this.now().subtract(1, "day").startOf("day");
  }

  /**
   * 내일 날짜
   */
  tomorrow() {
    return this.now().add(1, "day").startOf("day");
  }

  /**
   * 이번 주 시작 (월요일)
   */
  thisWeekStart() {
    return this.now().startOf("isoWeek");
  }

  /**
   * 이번 달 시작
   */
  thisMonthStart() {
    return this.now().startOf("month");
  }

  /**
   * 두 시간 사이의 차이 계산
   */
  diff(startTime, endTime, unit = "minutes") {
    const start = this.toKST(startTime);
    const end = this.toKST(endTime);

    return end.diff(start, unit);
  }

  /**
   * 시간 더하기
   */
  add(date, amount, unit = "minutes") {
    return this.toKST(date).add(amount, unit);
  }

  /**
   * 시간 빼기
   */
  subtract(date, amount, unit = "minutes") {
    return this.toKST(date).subtract(amount, unit);
  }

  /**
   * 업무일인지 확인 (월~금)
   */
  isWorkday(date = null) {
    const d = date ? this.toKST(date) : this.now();
    const dayOfWeek = d.day();
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  }

  /**
   * 주말인지 확인
   */
  isWeekend(date = null) {
    return !this.isWorkday(date);
  }

  /**
   * 업무 시간대인지 확인
   */
  isWorkTime(date = null, startHour = 9, endHour = 18) {
    const d = date ? this.toKST(date) : this.now();
    const hour = d.hour();

    return this.isWorkday(d) && hour >= startHour && hour < endHour;
  }

  /**
   * 다음 업무일 찾기
   */
  nextWorkday(date = null) {
    let d = date ? this.toKST(date) : this.now();

    do {
      d = d.add(1, "day");
    } while (!this.isWorkday(d));

    return d;
  }

  /**
   * 이전 업무일 찾기
   */
  previousWorkday(date = null) {
    let d = date ? this.toKST(date) : this.now();

    do {
      d = d.subtract(1, "day");
    } while (!this.isWorkday(d));

    return d;
  }

  /**
   * 상대 시간 표시 (예: "3분 전", "2시간 후")
   */
  fromNow(date) {
    return this.toKST(date).fromNow();
  }

  /**
   * 시간을 읽기 쉬운 형태로 변환
   */
  humanize(duration, unit = "milliseconds") {
    return moment.duration(duration, unit).humanize();
  }

  /**
   * 날짜 파싱 (다양한 형식 지원)
   */
  parse(dateString, format = null) {
    if (format) {
      return moment.tz(dateString, format, this.timezone);
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

    return moment.tz(dateString, formats, this.timezone);
  }

  /**
   * 유효한 날짜인지 확인
   */
  isValid(date) {
    return moment(date).isValid();
  }

  /**
   * 오늘인지 확인
   */
  isToday(date) {
    return this.toKST(date).isSame(this.today(), "day");
  }

  /**
   * 어제인지 확인
   */
  isYesterday(date) {
    return this.toKST(date).isSame(this.yesterday(), "day");
  }

  /**
   * 내일인지 확인
   */
  isTomorrow(date) {
    return this.toKST(date).isSame(this.tomorrow(), "day");
  }

  /**
   * 과거인지 확인
   */
  isPast(date) {
    return this.toKST(date).isBefore(this.now());
  }

  /**
   * 미래인지 확인
   */
  isFuture(date) {
    return this.toKST(date).isAfter(this.now());
  }

  /**
   * Date 객체를 한국 시간 문자열로 포맷
   */
  formatTime(date) {
    return this.format(date, "log");
  }

  /**
   * 현재 시간을 표시용으로 포맷
   */
  getDisplayTime() {
    return this.getCurrentTime("display");
  }

  /**
   * 간단한 날짜 형식
   */
  getSimpleDate() {
    return this.getCurrentTime("date");
  }

  /**
   * 현재 시간만 (HH:mm 형식)
   */
  getCurrentTimeOnly() {
    return this.now().format("HH:mm");
  }

  /**
   * 현재 설정 정보
   */
  getInfo() {
    return {
      timezone: this.timezone,
      currentTime: this.getCurrentTime("full"),
      formats: this.formats,
      locale: moment.locale(),
    };
  }
}

// 🔥 싱글톤 인스턴스 생성 및 export
const timeHelper = new TimeHelper();

module.exports = timeHelper;
