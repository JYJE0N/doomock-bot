// src/utils/TimeHelper.js - 한국 시간 헬퍼
const moment = require("moment-timezone");

/**
 * ⏰ TimeHelper - 한국 시간 헬퍼
 *
 * 비유: 세계 시계를 한국 시간으로 맞춰주는 시계 수리공
 * - 어떤 시간대에서도 정확한 한국 시간을 보여주고
 * - 날짜와 시간을 읽기 쉽게 변환하며
 * - 시간 계산을 쉽게 해줍니다
 *
 * 특징:
 * - 한국 표준시(KST) 자동 변환
 * - 다양한 포맷 지원
 * - 상대적 시간 표현
 * - Railway 환경 최적화
 */
class TimeHelper {
  constructor() {
    // 기본 시간대를 한국으로 설정
    this.timezone = "Asia/Seoul";
    moment.tz.setDefault(this.timezone);

    // 자주 사용하는 포맷
    this.formats = {
      full: "YYYY년 MM월 DD일 HH시 mm분 ss초",
      date: "YYYY년 MM월 DD일",
      time: "HH시 mm분",
      short: "MM/DD HH:mm",
      file: "YYYY-MM-DD_HHmmss",
      log: "YYYY-MM-DD HH:mm:ss",
      day: "YYYY년 MM월 DD일 (ddd)",
      month: "YYYY년 MM월",
      year: "YYYY년",
    };

    // 요일 한글 설정
    moment.locale("ko", {
      weekdays: [
        "일요일",
        "월요일",
        "화요일",
        "수요일",
        "목요일",
        "금요일",
        "토요일",
      ],
      weekdaysShort: ["일", "월", "화", "수", "목", "금", "토"],
      months: [
        "1월",
        "2월",
        "3월",
        "4월",
        "5월",
        "6월",
        "7월",
        "8월",
        "9월",
        "10월",
        "11월",
        "12월",
      ],
    });
  }

  /**
   * 현재 한국 시간 가져오기
   */
  now() {
    return moment().tz(this.timezone);
  }

  /**
   * Date 객체를 한국 시간으로 변환
   */
  toKST(date) {
    return moment(date).tz(this.timezone);
  }

  /**
   * 포맷된 현재 시간 문자열
   */
  getCurrentTime(format = "full") {
    const fmt = this.formats[format] || format;
    return this.now().format(fmt);
  }

  /**
   * 날짜 포맷팅
   */
  format(date, format = "full") {
    const fmt = this.formats[format] || format;
    return this.toKST(date).format(fmt);
  }

  /**
   * 상대적 시간 표현 (예: 3분 전, 2시간 후)
   */
  fromNow(date) {
    return this.toKST(date).fromNow();
  }

  /**
   * 두 날짜 사이의 차이
   */
  diff(date1, date2, unit = "days") {
    const d1 = this.toKST(date1);
    const d2 = this.toKST(date2);
    return d1.diff(d2, unit);
  }

  /**
   * 날짜 더하기/빼기
   */
  add(date, amount, unit) {
    return this.toKST(date).add(amount, unit);
  }

  subtract(date, amount, unit) {
    return this.toKST(date).subtract(amount, unit);
  }

  /**
   * 오늘 날짜 (시간 제외)
   */
  today() {
    return this.now().startOf("day");
  }

  /**
   * 이번 주 시작일 (월요일)
   */
  startOfWeek() {
    return this.now().startOf("isoWeek");
  }

  /**
   * 이번 달 시작일
   */
  startOfMonth() {
    return this.now().startOf("month");
  }

  /**
   * 날짜가 오늘인지 확인
   */
  isToday(date) {
    return this.toKST(date).isSame(this.today(), "day");
  }

  /**
   * 날짜가 이번 주인지 확인
   */
  isThisWeek(date) {
    const weekStart = this.startOfWeek();
    const weekEnd = weekStart.clone().endOf("isoWeek");
    const targetDate = this.toKST(date);
    return targetDate.isBetween(weekStart, weekEnd, "day", "[]");
  }

  /**
   * 날짜가 이번 달인지 확인
   */
  isThisMonth(date) {
    return this.toKST(date).isSame(this.now(), "month");
  }

  /**
   * 영업일 계산 (주말 제외)
   */
  addBusinessDays(date, days) {
    let current = this.toKST(date);
    let added = 0;

    while (added < days) {
      current = current.add(1, "day");
      // 주말이 아니면 카운트
      if (current.day() !== 0 && current.day() !== 6) {
        added++;
      }
    }

    return current;
  }

  /**
   * 두 날짜 사이의 영업일 수
   */
  businessDaysBetween(startDate, endDate) {
    const start = this.toKST(startDate);
    const end = this.toKST(endDate);
    let count = 0;
    let current = start.clone();

    while (current.isSameOrBefore(end, "day")) {
      if (current.day() !== 0 && current.day() !== 6) {
        count++;
      }
      current.add(1, "day");
    }

    return count;
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

    // 자동 파싱 시도
    const formats = [
      "YYYY-MM-DD",
      "YYYY/MM/DD",
      "DD-MM-YYYY",
      "DD/MM/YYYY",
      "YYYY-MM-DD HH:mm:ss",
      "YYYY-MM-DD HH:mm",
      "MM/DD/YYYY",
      "MM-DD-YYYY",
    ];

    return moment.tz(dateString, formats, this.timezone);
  }

  /**
   * 특정 시간대로 변환
   */
  convertTimezone(date, targetTimezone) {
    return this.toKST(date).tz(targetTimezone);
  }

  /**
   * 다음 특정 시간 찾기 (예: 다음 월요일 9시)
   */
  nextOccurrence(dayOfWeek, hour = 0, minute = 0) {
    let next = this.now();

    // 요일 맞추기 (0: 일요일, 1: 월요일, ...)
    while (next.day() !== dayOfWeek) {
      next.add(1, "day");
    }

    // 시간 설정
    next.hour(hour).minute(minute).second(0);

    // 이미 지났으면 다음 주로
    if (next.isSameOrBefore(this.now())) {
      next.add(7, "days");
    }

    return next;
  }

  /**
   * 나이 계산
   */
  getAge(birthDate) {
    return this.now().diff(this.toKST(birthDate), "years");
  }

  /**
   * D-Day 계산
   */
  getDDay(targetDate) {
    const target = this.toKST(targetDate).startOf("day");
    const today = this.today();
    const diff = target.diff(today, "days");

    if (diff === 0) return "D-Day";
    if (diff > 0) return `D-${diff}`;
    return `D+${Math.abs(diff)}`;
  }

  /**
   * 월의 마지막 날
   */
  lastDayOfMonth(date = null) {
    const d = date ? this.toKST(date) : this.now();
    return d.endOf("month").date();
  }

  /**
   * 주차 계산
   */
  getWeekNumber(date = null) {
    const d = date ? this.toKST(date) : this.now();
    return d.isoWeek();
  }
}

// 싱글톤 인스턴스
const timeHelper = new TimeHelper();

module.exports = timeHelper;
