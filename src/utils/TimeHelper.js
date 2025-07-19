// src/utils/TimeHelper.js - 정확한 한국시간 처리

class TimeHelper {
  // ⭐ 정확한 한국시간 반환
  static getKoreaTime() {
    // 현재 UTC 시간에 9시간을 더해서 KST 생성
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const koreaTime = new Date(utc + 9 * 3600000); // UTC+9

    return koreaTime;
  }

  // 한국시간 기준 현재 연도
  static getCurrentYear() {
    return this.getKoreaTime().getFullYear();
  }

  // 한국시간 기준 현재 월 (1-12)
  static getCurrentMonth() {
    return this.getKoreaTime().getMonth() + 1;
  }

  // 한국시간 기준 현재 일
  static getCurrentDate() {
    return this.getKoreaTime().getDate();
  }

  // 한국시간 기준 요일 (0=일요일)
  static getCurrentDay() {
    return this.getKoreaTime().getDay();
  }

  // 한국시간 기준 현재 시간
  static getCurrentHour() {
    return this.getKoreaTime().getHours();
  }

  // 한국시간 기준 현재 분
  static getCurrentMinute() {
    return this.getKoreaTime().getMinutes();
  }

  // 날짜 포맷팅 (한국시간 기준)
  static formatDate(date = null, options = {}) {
    const targetDate = date || this.getKoreaTime();

    const defaultOptions = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Seoul",
    };

    return targetDate.toLocaleDateString("ko-KR", {
      ...defaultOptions,
      ...options,
    });
  }

  // 시간 포맷팅 (한국시간 기준)
  static formatTime(date = null, options = {}) {
    const targetDate = date || this.getKoreaTime();

    const defaultOptions = {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Seoul",
      hour12: false, // 24시간 형식
    };

    return targetDate.toLocaleTimeString("ko-KR", {
      ...defaultOptions,
      ...options,
    });
  }

  // 날짜와 시간 함께 포맷팅 (한국시간 기준)
  static formatDateTime(date = null, options = {}) {
    const targetDate = date || this.getKoreaTime();

    const defaultOptions = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Seoul",
      hour12: false,
    };

    return targetDate.toLocaleString("ko-KR", {
      ...defaultOptions,
      ...options,
    });
  }

  // 상대적 시간 표시 (몇 분 전, 몇 시간 전 등)
  static getRelativeTime(date) {
    const now = this.getKoreaTime();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) {
      return "방금 전";
    } else if (diffMinutes < 60) {
      return `${diffMinutes}분 전`;
    } else if (diffHours < 24) {
      return `${diffHours}시간 전`;
    } else if (diffDays < 7) {
      return `${diffDays}일 전`;
    } else {
      return this.formatDate(date);
    }
  }

  // 오늘인지 확인 (한국시간 기준)
  static isToday(date) {
    const today = this.getKoreaTime();
    const targetDate = new Date(date);

    return (
      today.getFullYear() === targetDate.getFullYear() &&
      today.getMonth() === targetDate.getMonth() &&
      today.getDate() === targetDate.getDate()
    );
  }

  // 이번 주인지 확인 (한국시간 기준)
  static isThisWeek(date) {
    const today = this.getKoreaTime();
    const targetDate = new Date(date);

    // 이번 주 시작 (월요일)
    const startOfWeek = new Date(today);
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 일요일은 -6, 나머지는 1-요일
    startOfWeek.setDate(today.getDate() + daysToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    // 이번 주 끝 (일요일)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return targetDate >= startOfWeek && targetDate <= endOfWeek;
  }

  // 날짜에 일수 추가
  static addDays(date, days) {
    const result = new Date(date.getTime());
    result.setDate(result.getDate() + days);
    return result;
  }

  // 날짜에 시간 추가
  static addHours(date, hours) {
    const result = new Date(date.getTime());
    result.setHours(result.getHours() + hours);
    return result;
  }

  // 날짜에 분 추가
  static addMinutes(date, minutes) {
    const result = new Date(date.getTime());
    result.setMinutes(result.getMinutes() + minutes);
    return result;
  }

  // 목표 날짜까지 남은 시간 계산
  static getTimeUntil(targetDate) {
    const now = this.getKoreaTime();
    const diff = targetDate.getTime() - now.getTime();

    if (diff < 0) {
      return { passed: true, text: "이미 지났습니다" };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    let text = "";
    if (days > 0) {
      text += `${days}일 `;
    }
    if (hours > 0) {
      text += `${hours}시간 `;
    }
    if (minutes > 0) {
      text += `${minutes}분 `;
    }
    if (text === "" && seconds > 0) {
      text += `${seconds}초 `;
    }

    return { passed: false, text: text.trim() || "1초 미만" };
  }

  // 시간 문자열 파싱 (HH:MM 형식)
  static parseTime(timeString) {
    const timeRegex = /^(\d{1,2}):(\d{2})$/;
    const match = timeString.match(timeRegex);

    if (!match) {
      throw new Error("올바른 시간 형식이 아닙니다. (예: 14:30)");
    }

    const hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      throw new Error("올바른 시간 범위가 아닙니다.");
    }

    return { hours, minutes };
  }

  // 예약된 시간 생성 (한국시간 기준)
  static createScheduledDate(timeString) {
    const { hours, minutes } = this.parseTime(timeString);
    const now = this.getKoreaTime();
    const scheduledDate = new Date(now);

    scheduledDate.setHours(hours, minutes, 0, 0);

    // 시간이 이미 지났으면 다음 날로 설정
    if (scheduledDate <= now) {
      scheduledDate.setDate(scheduledDate.getDate() + 1);
    }

    return scheduledDate;
  }

  // 근무일 정보 (한국시간 기준)
  static getWorkdayInfo() {
    const now = this.getKoreaTime();
    const dayOfWeek = now.getDay(); // 0=일요일, 6=토요일

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isWorkday = !isWeekend;

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
      isWorkday,
      dayName: dayNames[dayOfWeek],
      dayOfWeek,
      currentTime: now,
    };
  }

  // 한국 공휴일 확인 (기본적인 공휴일들)
  static isKoreanHoliday(date) {
    const targetDate = new Date(date);
    const month = targetDate.getMonth() + 1;
    const day = targetDate.getDate();
    const year = targetDate.getFullYear();

    // 기본 공휴일들
    const fixedHolidays = [
      { month: 1, day: 1 }, // 신정
      { month: 3, day: 1 }, // 삼일절
      { month: 5, day: 5 }, // 어린이날
      { month: 6, day: 6 }, // 현충일
      { month: 8, day: 15 }, // 광복절
      { month: 10, day: 3 }, // 개천절
      { month: 10, day: 9 }, // 한글날
      { month: 12, day: 25 }, // 크리스마스
    ];

    // 고정 공휴일 확인
    const isFixedHoliday = fixedHolidays.some(
      (holiday) => holiday.month === month && holiday.day === day
    );

    if (isFixedHoliday) {
      return true;
    }

    // 여기에 음력 공휴일 계산 로직을 추가할 수 있음
    // (설날, 부처님 오신 날, 추석 등)

    return false;
  }

  // 한국시간 기준 포맷팅된 현재 시간 문자열
  static getNowString(format = "full") {
    const now = this.getKoreaTime();

    switch (format) {
      case "date":
        return this.formatDate(now);
      case "time":
        return this.formatTime(now);
      case "short":
        return this.formatDateTime(now, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      default:
        return this.formatDateTime(now);
    }
  }

  // 타임스탬프를 한국시간으로 변환
  static fromTimestamp(timestamp) {
    const date = new Date(timestamp);
    // 이미 한국시간으로 변환된 Date 객체 반환
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    return new Date(utc + 9 * 3600000);
  }

  // 한국시간을 타임스탬프로 변환
  static toTimestamp(koreaDate = null) {
    const date = koreaDate || this.getKoreaTime();
    return date.getTime();
  }

  // 디버그용: 현재 시간 정보 출력
  static getDebugInfo() {
    const now = this.getKoreaTime();
    const utcNow = new Date();

    return {
      koreaTime: this.formatDateTime(now),
      utcTime: utcNow.toISOString(),
      timezone: "Asia/Seoul (UTC+9)",
      timestamp: now.getTime(),
      workdayInfo: this.getWorkdayInfo(),
    };
  }
}

module.exports = { TimeHelper };
