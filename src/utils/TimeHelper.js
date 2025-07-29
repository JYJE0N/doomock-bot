// src/utils/TimeHelper.js - 🕐 moment-timezone 고급 활용 버전
const moment = require("moment-timezone");
const logger = require("./Logger");

/**
 * 🕐 고급 TimeHelper - moment-timezone의 모든 기능 활용
 *
 * 🎯 새로운 기능들:
 * - 다국가 시간대 지원
 * - 자연어 시간 파싱
 * - 업무 시간 계산
 * - 휴일/공휴일 처리
 * - 시간대별 회의 스케줄링
 * - 고급 포맷팅
 *
 * ✅ 특징:
 * - 전 세계 시간대 지원
 * - 한국어 자연어 처리
 * - 비즈니스 로직 내장
 * - Railway 최적화
 */

class EnhancedTimeHelper {
  constructor() {
    // 기본 시간대 (한국)
    this.defaultTimezone = "Asia/Seoul";

    // 한국어 로케일 설정
    moment.locale("ko");
    moment.tz.setDefault(this.defaultTimezone);

    // 🌏 지원하는 주요 시간대들
    this.supportedTimezones = {
      // 아시아
      KST: "Asia/Seoul", // 한국
      JST: "Asia/Tokyo", // 일본
      CST: "Asia/Shanghai", // 중국
      SGT: "Asia/Singapore", // 싱가포르
      IST: "Asia/Kolkata", // 인도

      // 미주
      PST: "America/Los_Angeles", // 서부
      MST: "America/Denver", // 산악
      CST_US: "America/Chicago", // 중부
      EST: "America/New_York", // 동부

      // 유럽
      GMT: "Europe/London", // 영국
      CET: "Europe/Berlin", // 독일
      EET: "Europe/Helsinki", // 핀란드

      // 오세아니아
      AEST: "Australia/Sydney", // 호주 동부
      NZST: "Pacific/Auckland", // 뉴질랜드
    };

    // 🏢 한국 업무 시간 설정
    this.workingHours = {
      start: 9, // 오전 9시
      end: 18, // 오후 6시
      lunch: {
        start: 12, // 점심시간 시작
        end: 13, // 점심시간 종료
      },
    };

    // 🗓️ 한국 공휴일 (2025년 기준)
    this.holidays2025 = [
      "2025-01-01", // 신정
      "2025-01-28",
      "2025-01-29",
      "2025-01-30", // 설날
      "2025-03-01", // 삼일절
      "2025-05-05", // 어린이날
      "2025-05-06", // 어린이날 대체공휴일
      "2025-06-06", // 현충일
      "2025-08-15", // 광복절
      "2025-09-06",
      "2025-09-07",
      "2025-09-08", // 추석
      "2025-10-03", // 개천절
      "2025-10-09", // 한글날
      "2025-12-25", // 크리스마스
    ];

    // 📋 다양한 포맷 템플릿
    this.formats = {
      // 기본 형식들
      full: "YYYY년 MM월 DD일 dddd HH:mm:ss",
      date: "YYYY-MM-DD",
      time: "HH:mm:ss",
      short: "MM-DD HH:mm",
      log: "YYYY-MM-DD HH:mm:ss",
      display: "MM월 DD일 (ddd) HH:mm",
      korean: "YYYY년 MM월 DD일",
      timestamp: "YYMMDDHHmm",

      // 새로운 고급 형식들
      meeting: "YYYY년 MM월 DD일 dddd A h:mm",
      schedule: "MM/DD (ddd) HH:mm",
      reminder: "MM월 DD일 A h:mm",
      report: "YYYY년 MM월 DD일 dddd",
      international: "MMM DD, YYYY HH:mm z",
      iso: "YYYY-MM-DDTHH:mm:ssZ",

      // 상대 시간
      relative: "relative",
      ago: "ago",
      calendar: "calendar",
    };

    logger.info("🕐 Enhanced TimeHelper 초기화됨 - 전 세계 시간대 지원");
  }

  // ===== 🌏 다국가 시간대 지원 =====

  /**
   * 특정 시간대의 현재 시간
   */
  nowInTimezone(timezone = this.defaultTimezone) {
    return moment.tz(timezone);
  }

  /**
   * 시간대 변환
   */
  convertTimezone(dateTime, fromTimezone, toTimezone) {
    if (!dateTime) return null;

    const momentDate = moment.tz(dateTime, fromTimezone);
    return momentDate.tz(toTimezone);
  }

  /**
   * 🌏 전 세계 주요 도시 시간 표시
   */
  getWorldClocks() {
    const now = moment();
    const worldTimes = {};

    for (const [code, timezone] of Object.entries(this.supportedTimezones)) {
      worldTimes[code] = {
        timezone,
        time: now.tz(timezone).format("HH:mm"),
        date: now.tz(timezone).format("MM-DD"),
        fullTime: now.tz(timezone).format("YYYY-MM-DD HH:mm:ss"),
        offset: now.tz(timezone).format("Z"),
        city: timezone.split("/")[1]?.replace("_", " "),
      };
    }

    return worldTimes;
  }

  /**
   * 🤝 다국가 회의 시간 제안
   */
  suggestMeetingTimes(timezones, preferredHours = [9, 10, 11, 14, 15, 16]) {
    const suggestions = [];
    const baseDate = moment().add(1, "day").startOf("day");

    // 향후 7일간 체크
    for (let day = 0; day < 7; day++) {
      const checkDate = baseDate.clone().add(day, "days");

      // 평일만 체크
      if (checkDate.day() >= 1 && checkDate.day() <= 5) {
        for (const hour of preferredHours) {
          const seoulTime = checkDate.clone().hour(hour);
          const timeSlot = { date: seoulTime.format("YYYY-MM-DD"), times: {} };

          let isGoodForAll = true;

          for (const tz of timezones) {
            const localTime = seoulTime.clone().tz(tz);
            const localHour = localTime.hour();

            timeSlot.times[tz] = {
              time: localTime.format("HH:mm"),
              date: localTime.format("MM-DD"),
              isWorkingHour: localHour >= 9 && localHour <= 18,
            };

            if (localHour < 8 || localHour > 20) {
              isGoodForAll = false;
            }
          }

          if (isGoodForAll) {
            suggestions.push(timeSlot);
          }
        }
      }
    }

    return suggestions.slice(0, 10); // 상위 10개만 반환
  }

  // ===== 🗣️ 자연어 시간 파싱 =====

  /**
   * 🧠 고급 자연어 시간 파싱
   */
  parseNaturalLanguage(input) {
    const text = input.trim().toLowerCase();
    const now = this.now();

    try {
      // === 특수 키워드들 ===
      const specialKeywords = {
        새벽: () => now.clone().add(1, "day").hour(5).minute(0),
        아침: () => now.clone().add(1, "day").hour(8).minute(0),
        점심시간: () => {
          const lunch = now.clone().hour(12).minute(0);
          return lunch.isBefore(now) ? lunch.add(1, "day") : lunch;
        },
        오후: () => {
          const afternoon = now.clone().hour(14).minute(0);
          return afternoon.isBefore(now) ? afternoon.add(1, "day") : afternoon;
        },
        저녁: () => {
          const evening = now.clone().hour(19).minute(0);
          return evening.isBefore(now) ? evening.add(1, "day") : evening;
        },
        밤: () => now.clone().add(1, "day").hour(22).minute(0),
        자정: () => now.clone().add(1, "day").startOf("day"),
        정오: () => {
          const noon = now.clone().hour(12).minute(0);
          return noon.isBefore(now) ? noon.add(1, "day") : noon;
        },
      };

      for (const [keyword, timeFunc] of Object.entries(specialKeywords)) {
        if (text.includes(keyword)) {
          return timeFunc().toDate();
        }
      }

      // === 계절/월 기반 파싱 ===
      const seasonKeywords = {
        봄: () => now.clone().month(2).date(21).hour(9), // 3월 21일
        여름: () => now.clone().month(5).date(21).hour(9), // 6월 21일
        가을: () => now.clone().month(8).date(23).hour(9), // 9월 23일
        겨울: () => now.clone().month(11).date(21).hour(9), // 12월 21일
      };

      for (const [season, timeFunc] of Object.entries(seasonKeywords)) {
        if (text.includes(season)) {
          const seasonTime = timeFunc();
          if (seasonTime.isBefore(now)) {
            seasonTime.add(1, "year");
          }
          return seasonTime.toDate();
        }
      }

      // === 휴일 기반 파싱 ===
      const holidayKeywords = {
        신정: () => moment(`${now.year() + 1}-01-01`),
        설날: () => moment(`${now.year() + 1}-01-29`), // 2025년 기준
        삼일절: () => moment(`${now.year()}-03-01`),
        어린이날: () => moment(`${now.year()}-05-05`),
        현충일: () => moment(`${now.year()}-06-06`),
        광복절: () => moment(`${now.year()}-08-15`),
        추석: () => moment(`${now.year()}-09-07`), // 2025년 기준
        개천절: () => moment(`${now.year()}-10-03`),
        한글날: () => moment(`${now.year()}-10-09`),
        크리스마스: () => moment(`${now.year()}-12-25`),
      };

      for (const [holiday, dateFunc] of Object.entries(holidayKeywords)) {
        if (text.includes(holiday)) {
          let holidayTime = dateFunc().hour(9).minute(0);
          if (holidayTime.isBefore(now)) {
            holidayTime.add(1, "year");
          }
          return holidayTime.toDate();
        }
      }

      // === 업무 관련 키워드 ===
      if (text.includes("회의시간") || text.includes("미팅")) {
        return now.clone().add(1, "day").hour(14).minute(0).toDate();
      }

      if (text.includes("마감일") || text.includes("데드라인")) {
        return now.clone().add(1, "day").hour(17).minute(59).toDate();
      }

      return null;
    } catch (error) {
      logger.warn("자연어 시간 파싱 실패:", error);
      return null;
    }
  }

  // ===== 🏢 업무 시간 관련 =====

  /**
   * 업무 시간 여부 확인 (점심시간 제외)
   */
  isWorkingTime(dateTime = null, includeBreaks = false) {
    const time = dateTime
      ? moment.tz(dateTime, this.defaultTimezone)
      : this.now();
    const hour = time.hour();
    const dayOfWeek = time.day();

    // 주말 체크
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;

    // 공휴일 체크
    if (this.isHoliday(time)) return false;

    // 기본 업무 시간 체크
    if (hour < this.workingHours.start || hour >= this.workingHours.end) {
      return false;
    }

    // 점심시간 체크 (옵션)
    if (!includeBreaks) {
      if (
        hour >= this.workingHours.lunch.start &&
        hour < this.workingHours.lunch.end
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * 🗓️ 공휴일 여부 확인
   */
  isHoliday(dateTime = null) {
    const date = dateTime
      ? moment.tz(dateTime, this.defaultTimezone)
      : this.now();
    const dateString = date.format("YYYY-MM-DD");

    return this.holidays2025.includes(dateString);
  }

  /**
   * 📊 이번 달 업무일 수 계산
   */
  getWorkingDaysInMonth(year = null, month = null) {
    const targetMonth =
      year && month
        ? moment.tz(
            `${year}-${month.toString().padStart(2, "0")}-01`,
            this.defaultTimezone
          )
        : this.now().startOf("month");

    let workingDays = 0;
    const daysInMonth = targetMonth.daysInMonth();

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDay = targetMonth.clone().date(day);

      if (this.isWorkday(currentDay) && !this.isHoliday(currentDay)) {
        workingDays++;
      }
    }

    return workingDays;
  }

  /**
   * ⏰ 다음 업무 시간 찾기
   */
  getNextWorkingTime() {
    let nextTime = this.now().add(1, "hour").startOf("hour");

    while (!this.isWorkingTime(nextTime)) {
      nextTime.add(1, "hour");

      // 무한 루프 방지 (최대 1주일)
      if (nextTime.diff(this.now(), "days") > 7) {
        break;
      }
    }

    return nextTime;
  }

  // ===== 📊 고급 포맷팅 =====

  /**
   * 🎨 컨텍스트별 스마트 포맷팅
   */
  smartFormat(dateTime, context = "default") {
    const time = dateTime
      ? moment.tz(dateTime, this.defaultTimezone)
      : this.now();

    switch (context) {
      case "meeting":
        return `${time.format("MM월 DD일 (ddd)")} ${time.format("A h:mm")}`;

      case "reminder":
        if (time.isSame(this.now(), "day")) {
          return `오늘 ${time.format("A h:mm")}`;
        } else if (time.isSame(this.now().add(1, "day"), "day")) {
          return `내일 ${time.format("A h:mm")}`;
        } else {
          return `${time.format("MM월 DD일")} ${time.format("A h:mm")}`;
        }

      case "deadline":
        const diff = time.diff(this.now(), "hours");
        if (diff < 24) {
          return `${diff}시간 후 (${time.format("A h:mm")})`;
        } else {
          return `${Math.floor(diff / 24)}일 후 (${time.format("MM월 DD일")})`;
        }

      case "international":
        return time.format("MMM DD, YYYY HH:mm z");

      case "calendar":
        return time.calendar();

      case "relative":
        return time.fromNow();

      default:
        return time.format(this.formats.display);
    }
  }

  /**
   * 📈 시간 구간별 통계 포맷
   */
  formatDuration(startTime, endTime, includeSeconds = false) {
    const start = moment.tz(startTime, this.defaultTimezone);
    const end = moment.tz(endTime, this.defaultTimezone);
    const duration = moment.duration(end.diff(start));

    const days = Math.floor(duration.asDays());
    const hours = duration.hours();
    const minutes = duration.minutes();
    const seconds = duration.seconds();

    let result = "";

    if (days > 0) result += `${days}일 `;
    if (hours > 0) result += `${hours}시간 `;
    if (minutes > 0) result += `${minutes}분 `;
    if (includeSeconds && seconds > 0) result += `${seconds}초`;

    return result.trim() || "0분";
  }

  // ===== 🎯 편의 메서드들 =====

  /**
   * 현재 시간 (기본)
   */
  now() {
    return moment.tz(this.defaultTimezone);
  }

  /**
   * 업무일 여부 (주말 + 공휴일 체크)
   */
  isWorkday(dateTime = null) {
    const time = dateTime
      ? moment.tz(dateTime, this.defaultTimezone)
      : this.now();
    const dayOfWeek = time.day();

    return dayOfWeek >= 1 && dayOfWeek <= 5 && !this.isHoliday(time);
  }

  /**
   * 📊 서비스 상태 및 정보
   */
  getEnhancedInfo() {
    const worldClocks = this.getWorldClocks();

    return {
      currentTime: this.now().format(this.formats.full),
      timezone: this.defaultTimezone,
      supportedTimezones: Object.keys(this.supportedTimezones).length,
      isWorkingTime: this.isWorkingTime(),
      isWorkday: this.isWorkday(),
      isHoliday: this.isHoliday(),
      nextWorkingTime: this.getNextWorkingTime().format(this.formats.display),
      workingDaysThisMonth: this.getWorkingDaysInMonth(),
      worldClocks: worldClocks,
      features: [
        "Multi-timezone support",
        "Natural language parsing",
        "Business hours calculation",
        "Holiday detection",
        "Meeting scheduling",
        "Smart formatting",
      ],
    };
  }
}

// 싱글톤 인스턴스
const enhancedTimeHelper = new EnhancedTimeHelper();

module.exports = enhancedTimeHelper;
