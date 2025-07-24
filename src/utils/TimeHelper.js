// src/utils/TimeHelper.js - 휴가 관리용 시간 유틸리티 확장

const moment = require("moment-timezone");

/**
 * 🇰🇷 한국 시간 기준 시간 관리 유틸리티
 * Railway 환경변수: 표준 한국시간 적용
 */
class TimeHelper {
  static TIMEZONE = "Asia/Seoul";
  static DATE_FORMATS = {
    ISO: "YYYY-MM-DD",
    KOREAN: "YYYY년 MM월 DD일",
    SIMPLE: "MM-DD",
    FULL: "YYYY-MM-DD HH:mm:ss",
    TIME_ONLY: "HH:mm",
    DATETIME: "YYYY-MM-DD HH:mm",
  };

  // 🕒 기본 시간 함수들
  static getKoreaTime() {
    return moment().tz(this.TIMEZONE).toDate();
  }

  static getKoreaTimeString() {
    return moment().tz(this.TIMEZONE).format("YYYY-MM-DD HH:mm:ss");
  }

  static getCurrentYear() {
    return moment().tz(this.TIMEZONE).year();
  }

  static getCurrentMonth() {
    return moment().tz(this.TIMEZONE).month() + 1; // moment는 0부터 시작
  }

  static getCurrentDate() {
    return moment().tz(this.TIMEZONE).format("YYYY-MM-DD");
  }

  static getCurrentTime() {
    return moment().tz(this.TIMEZONE).format("HH:mm:ss");
  }

  // 📅 날짜 포맷팅
  static formatDate(date, format = "YYYY-MM-DD") {
    if (!date) return "";
    return moment(date).tz(this.TIMEZONE).format(format);
  }

  static formatDateTime(date) {
    if (!date) return "";
    return moment(date).tz(this.TIMEZONE).format("YYYY-MM-DD HH:mm:ss");
  }

  static formatKoreanDate(date) {
    if (!date) return "";
    return moment(date).tz(this.TIMEZONE).format("YYYY년 MM월 DD일");
  }

  static formatKoreanDateTime(date) {
    if (!date) return "";
    return moment(date).tz(this.TIMEZONE).format("YYYY년 MM월 DD일 HH:mm");
  }

  // 🏖️ 휴가 관리 전용 시간 함수들

  /**
   * 📊 월차 자동 지급일 계산
   * 매월 1일에 월차 1일 자동 지급
   */
  static getMonthlyLeaveAllocationDate(year, month) {
    return moment
      .tz(`${year}-${month.toString().padStart(2, "0")}-01`, this.TIMEZONE)
      .toDate();
  }

  /**
   * 📅 현재 연도의 월차 지급 스케줄 생성
   */
  static generateMonthlyLeaveSchedule(year = null) {
    const targetYear = year || this.getCurrentYear();
    const schedule = [];

    for (let month = 1; month <= 12; month++) {
      schedule.push({
        year: targetYear,
        month,
        allocationDate: this.getMonthlyLeaveAllocationDate(targetYear, month),
        amount: 1, // 월차 1일
        description: `${targetYear}년 ${month}월 월차`,
      });
    }

    return schedule;
  }

  /**
   * 🗓️ 휴가 사용 가능한 날짜인지 확인
   * 주말, 공휴일 제외 (선택적)
   */
  static isWorkingDay(date, excludeWeekends = true, excludeHolidays = true) {
    const momentDate = moment(date).tz(this.TIMEZONE);

    // 주말 체크
    if (excludeWeekends) {
      const dayOfWeek = momentDate.day(); // 0: 일요일, 6: 토요일
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return false;
      }
    }

    // 공휴일 체크 (기본 공휴일만 - 확장 가능)
    if (excludeHolidays) {
      const holidays = this.getKoreanHolidays(momentDate.year());
      const dateString = momentDate.format("MM-DD");
      if (holidays.includes(dateString)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 🇰🇷 한국 공휴일 목록 (기본)
   */
  static getKoreanHolidays(year) {
    return [
      "01-01", // 신정
      "03-01", // 삼일절
      "05-05", // 어린이날
      "06-06", // 현충일
      "08-15", // 광복절
      "10-03", // 개천절
      "10-09", // 한글날
      "12-25", // 성탄절
      // 추석, 설날 등은 매년 달라지므로 별도 API 또는 라이브러리 필요
    ];
  }

  /**
   * ⏰ 근무시간 기반 휴가 시간 계산
   */
  static calculateLeaveHours(days, workSchedule = null) {
    const defaultSchedule = {
      startTime: "09:00",
      endTime: "18:00",
      lunchStart: "12:00",
      lunchEnd: "13:00",
    };

    const schedule = workSchedule || defaultSchedule;

    // 하루 총 근무시간 계산 (점심시간 제외)
    const startHour = this.timeStringToMinutes(schedule.startTime);
    const endHour = this.timeStringToMinutes(schedule.endTime);
    const lunchDuration =
      this.timeStringToMinutes(schedule.lunchEnd) -
      this.timeStringToMinutes(schedule.lunchStart);

    const dailyWorkMinutes = endHour - startHour - lunchDuration;
    const dailyWorkHours = dailyWorkMinutes / 60;

    return {
      totalHours: days * dailyWorkHours,
      dailyWorkHours,
      days,
      breakdown: {
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        lunchDuration: lunchDuration / 60, // 시간 단위
        workingMinutesPerDay: dailyWorkMinutes,
      },
    };
  }

  /**
   * 🕐 시간 문자열을 분으로 변환
   */
  static timeStringToMinutes(timeString) {
    const [hours, minutes] = timeString.split(":").map(Number);
    return hours * 60 + minutes;
  }

  /**
   * 📈 월별 휴가 사용 통계 기간 생성
   */
  static getMonthlyPeriods(year = null) {
    const targetYear = year || this.getCurrentYear();
    const periods = [];

    for (let month = 1; month <= 12; month++) {
      const startDate = moment.tz(
        `${targetYear}-${month.toString().padStart(2, "0")}-01`,
        this.TIMEZONE
      );
      const endDate = startDate.clone().endOf("month");

      periods.push({
        year: targetYear,
        month,
        startDate: startDate.toDate(),
        endDate: endDate.toDate(),
        label: `${targetYear}년 ${month}월`,
        daysInMonth: endDate.date(),
      });
    }

    return periods;
  }

  /**
   * 📊 분기별 휴가 사용 통계 기간 생성
   */
  static getQuarterlyPeriods(year = null) {
    const targetYear = year || this.getCurrentYear();
    const quarters = [
      { quarter: 1, months: [1, 2, 3], name: "1분기" },
      { quarter: 2, months: [4, 5, 6], name: "2분기" },
      { quarter: 3, months: [7, 8, 9], name: "3분기" },
      { quarter: 4, months: [10, 11, 12], name: "4분기" },
    ];

    return quarters.map((q) => {
      const startDate = moment.tz(
        `${targetYear}-${q.months[0].toString().padStart(2, "0")}-01`,
        this.TIMEZONE
      );
      const endDate = moment
        .tz(
          `${targetYear}-${q.months[2].toString().padStart(2, "0")}-01`,
          this.TIMEZONE
        )
        .endOf("month");

      return {
        year: targetYear,
        quarter: q.quarter,
        name: q.name,
        months: q.months,
        startDate: startDate.toDate(),
        endDate: endDate.toDate(),
        label: `${targetYear}년 ${q.name}`,
      };
    });
  }

  /**
   * 🎯 휴가 잔여일 기준 권장 사용 일정
   */
  static recommendLeaveSchedule(remainingDays, remainingMonths = null) {
    const currentMonth = this.getCurrentMonth();
    const remainingMonthsInYear = remainingMonths || 12 - currentMonth + 1;

    if (remainingMonthsInYear <= 0 || remainingDays <= 0) {
      return {
        recommendation: "urgent",
        message: "남은 연차를 빠르게 사용하세요!",
        suggestedUsage: remainingDays,
      };
    }

    const monthlyRecommended = Math.ceil(remainingDays / remainingMonthsInYear);

    let recommendation = "normal";
    let message = `월 평균 ${monthlyRecommended}일씩 사용하면 됩니다.`;

    if (remainingDays > remainingMonthsInYear * 2) {
      recommendation = "aggressive";
      message = "남은 연차가 많습니다. 더 적극적으로 사용하세요!";
    } else if (remainingDays < remainingMonthsInYear * 0.5) {
      recommendation = "conservative";
      message = "연차를 절약해서 사용하고 있습니다.";
    }

    return {
      recommendation,
      message,
      remainingDays,
      remainingMonths: remainingMonthsInYear,
      monthlyRecommended,
      currentMonth,
    };
  }

  /**
   * 📅 날짜 범위 생성 (휴가 신청용)
   */
  static generateDateRange(startDate, endDate) {
    const dates = [];
    const currentDate = moment(startDate).tz(this.TIMEZONE);
    const lastDate = moment(endDate).tz(this.TIMEZONE);

    while (currentDate.isSameOrBefore(lastDate)) {
      dates.push({
        date: currentDate.toDate(),
        dateString: currentDate.format("YYYY-MM-DD"),
        koreanDate: currentDate.format("MM월 DD일"),
        dayOfWeek: currentDate.format("dddd"),
        isWorkingDay: this.isWorkingDay(currentDate.toDate()),
      });
      currentDate.add(1, "day");
    }

    return dates;
  }

  /**
   * 🎲 휴가 유형별 시간 범위 생성
   */
  static getLeaveTimeRanges() {
    return {
      fullDay: {
        name: "종일",
        value: 1,
        range: "09:00-18:00",
        description: "하루 전체 휴가",
      },
      morning: {
        name: "오전반차",
        value: 0.5,
        range: "09:00-13:00",
        description: "오전 반나절 휴가",
      },
      afternoon: {
        name: "오후반차",
        value: 0.5,
        range: "14:00-18:00",
        description: "오후 반나절 휴가",
      },
      earlyMorning: {
        name: "출근후반반차",
        value: 0.25,
        range: "09:00-11:00",
        description: "출근 후 2시간 휴가",
      },
      lateAfternoon: {
        name: "퇴근전반반차",
        value: 0.25,
        range: "16:00-18:00",
        description: "퇴근 전 2시간 휴가",
      },
    };
  }

  /**
   * 📊 시간 차이 계산 (휴가 신청 마감일 등)
   */
  static getTimeDifference(targetDate, fromDate = null) {
    const from = moment(fromDate || new Date()).tz(this.TIMEZONE);
    const target = moment(targetDate).tz(this.TIMEZONE);

    const diffDays = target.diff(from, "days");
    const diffHours = target.diff(from, "hours");
    const diffMinutes = target.diff(from, "minutes");

    return {
      days: diffDays,
      hours: diffHours,
      minutes: diffMinutes,
      isPast: diffMinutes < 0,
      isToday: diffDays === 0,
      isTomorrow: diffDays === 1,
      isThisWeek: diffDays >= 0 && diffDays <= 7,
      humanReadable: this.formatTimeDifference(diffMinutes),
    };
  }

  /**
   * 📝 시간 차이를 사람이 읽기 쉬운 형태로 변환
   */
  static formatTimeDifference(minutes) {
    if (minutes < 0) {
      return "지난 시간";
    } else if (minutes < 60) {
      return `${minutes}분 후`;
    } else if (minutes < 1440) {
      // 24시간
      const hours = Math.floor(minutes / 60);
      return `${hours}시간 후`;
    } else {
      const days = Math.floor(minutes / 1440);
      return `${days}일 후`;
    }
  }

  /**
   * 🗓️ 휴가 캘린더 뷰 생성 (월별)
   */
  static generateLeaveCalendar(year, month, leaveHistory = []) {
    const startDate = moment.tz(
      `${year}-${month.toString().padStart(2, "0")}-01`,
      this.TIMEZONE
    );
    const endDate = startDate.clone().endOf("month");
    const calendar = [];

    // 월의 첫 주 시작일 (일요일부터)
    const firstWeekStart = startDate.clone().startOf("week");
    const lastWeekEnd = endDate.clone().endOf("week");

    const currentDate = firstWeekStart.clone();

    while (currentDate.isSameOrBefore(lastWeekEnd)) {
      const dateString = currentDate.format("YYYY-MM-DD");
      const isCurrentMonth = currentDate.month() === month - 1;

      // 해당 날짜의 휴가 기록 찾기
      const dayLeaves = leaveHistory.filter(
        (leave) => moment(leave.date).format("YYYY-MM-DD") === dateString
      );

      calendar.push({
        date: currentDate.toDate(),
        dateString,
        day: currentDate.date(),
        dayOfWeek: currentDate.day(),
        isCurrentMonth,
        isToday: currentDate.format("YYYY-MM-DD") === this.getCurrentDate(),
        isWorkingDay: this.isWorkingDay(currentDate.toDate()),
        leaves: dayLeaves,
        hasLeave: dayLeaves.length > 0,
        leaveType: dayLeaves.length > 0 ? dayLeaves[0].leaveType : null,
      });

      currentDate.add(1, "day");
    }

    return {
      year,
      month,
      monthName: startDate.format("YYYY년 MM월"),
      daysInMonth: endDate.date(),
      calendar,
      weeks: this.groupCalendarByWeeks(calendar),
    };
  }

  /**
   * 📅 캘린더를 주 단위로 그룹화
   */
  static groupCalendarByWeeks(calendar) {
    const weeks = [];
    for (let i = 0; i < calendar.length; i += 7) {
      weeks.push(calendar.slice(i, i + 7));
    }
    return weeks;
  }

  /**
   * ⏰ 현재 시간이 근무시간인지 확인
   */
  static isWorkingHours(workSchedule = null) {
    const schedule = workSchedule || {
      startTime: "09:00",
      endTime: "18:00",
      lunchStart: "12:00",
      lunchEnd: "13:00",
    };

    const currentTime = moment().tz(this.TIMEZONE);
    const currentMinutes = currentTime.hours() * 60 + currentTime.minutes();

    const startMinutes = this.timeStringToMinutes(schedule.startTime);
    const endMinutes = this.timeStringToMinutes(schedule.endTime);
    const lunchStartMinutes = this.timeStringToMinutes(schedule.lunchStart);
    const lunchEndMinutes = this.timeStringToMinutes(schedule.lunchEnd);

    // 근무시간 내이지만 점심시간은 제외
    const isWithinWorkHours =
      currentMinutes >= startMinutes && currentMinutes < endMinutes;
    const isLunchTime =
      currentMinutes >= lunchStartMinutes && currentMinutes < lunchEndMinutes;

    return {
      isWorkingHours: isWithinWorkHours && !isLunchTime,
      isLunchTime,
      currentTime: currentTime.format("HH:mm"),
      phase: this.getWorkPhase(currentMinutes, schedule),
    };
  }

  /**
   * 🕐 현재 근무 단계 파악
   */
  static getWorkPhase(currentMinutes, schedule) {
    const startMinutes = this.timeStringToMinutes(schedule.startTime);
    const endMinutes = this.timeStringToMinutes(schedule.endTime);
    const lunchStartMinutes = this.timeStringToMinutes(schedule.lunchStart);
    const lunchEndMinutes = this.timeStringToMinutes(schedule.lunchEnd);

    if (currentMinutes < startMinutes) {
      return "출근 전";
    } else if (currentMinutes < lunchStartMinutes) {
      return "오전 근무";
    } else if (currentMinutes < lunchEndMinutes) {
      return "점심시간";
    } else if (currentMinutes < endMinutes) {
      return "오후 근무";
    } else {
      return "퇴근 후";
    }
  }
}

module.exports = TimeHelper;
