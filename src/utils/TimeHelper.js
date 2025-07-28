// src/utils/TimeHelper.js - 수정된 시간 헬퍼
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

  // ===== 추가된 메서드들 =====

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

  // ===== 현재 시간 =====

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
   * 로그용 시간 문자열
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

  // ===== 시간 계산 =====

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

  // ===== 업무 관련 =====

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

  // ===== 상대 시간 =====

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

  // ===== 파싱 =====

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

  // ===== 검증 =====

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

  // ===== 형식 시간 =====

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

  // ===== 디버그 및 정보 =====

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

// 싱글톤 인스턴스
const timeHelper = new TimeHelper();

module.exports = timeHelper;
