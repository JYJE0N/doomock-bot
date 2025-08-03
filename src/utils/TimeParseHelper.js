// utils/TimeParseHelper.js - 시간 관련 자연어 처리 헬퍼
const moment = require("moment-timezone");
const logger = require("./Logger");

/**
 * 🕐 TimeParseHelper - 시간 자연어 처리 유틸리티
 *
 * 사용자가 입력한 자연어 시간 표현을 정확한 Date 객체로 변환
 * 예: "내일 오후 3시", "다음주 월요일 오전 9시", "30분 후" 등
 */
class TimeParseHelper {
  static TIMEZONE = "Asia/Seoul";

  /**
   * 🎯 메인 파싱 함수
   * @param {string} timeText - 사용자 입력 시간 텍스트
   * @param {Date} baseTime - 기준 시간 (기본값: 현재 시간)
   * @returns {Object} { success, datetime, originalText, parsedInfo }
   */
  static parseTimeText(timeText, baseTime = null) {
    try {
      if (!timeText || typeof timeText !== "string") {
        return this.createErrorResult("시간 텍스트가 필요합니다.");
      }

      const cleanText = timeText.trim().toLowerCase();
      const now = baseTime
        ? moment(baseTime).tz(this.TIMEZONE)
        : moment.tz(this.TIMEZONE);

      logger.debug(`⏰ 시간 파싱 시작: "${cleanText}"`);

      // 파싱 전략들을 순서대로 시도
      const strategies = [
        this.parseRelativeTime, // "30분 후", "2시간 후"
        this.parseTimeToday, // "오후 3시", "15:30"
        this.parseRelativeDay, // "내일", "모레", "다음주"
        this.parseSpecificDate, // "12월 25일", "2024-01-01"
        this.parseWeekday, // "다음 월요일", "이번주 금요일"
        this.parseCombinedDateTime // "내일 오후 3시", "다음주 월요일 9시"
      ];

      for (const strategy of strategies) {
        const result = strategy.call(this, cleanText, now);
        if (result.success) {
          logger.info(
            `✅ 시간 파싱 성공: "${cleanText}" → ${result.datetime.format()}`
          );
          return result;
        }
      }

      return this.createErrorResult(
        `시간 표현을 이해할 수 없습니다: "${timeText}"`
      );
    } catch (error) {
      logger.error("TimeParseHelper 오류:", error);
      return this.createErrorResult("시간 처리 중 오류가 발생했습니다.");
    }
  }

  /**
   * 📅 상대적 시간 파싱 ("30분 후", "2시간 후")
   */
  static parseRelativeTime(text, now) {
    const patterns = [
      { regex: /(\d+)분\s*후/g, unit: "minutes" },
      { regex: /(\d+)시간\s*후/g, unit: "hours" },
      { regex: /(\d+)일\s*후/g, unit: "days" },
      { regex: /(\d+)주\s*후/g, unit: "weeks" },
      { regex: /(\d+)개월\s*후/g, unit: "months" }
    ];

    for (const pattern of patterns) {
      const match = pattern.regex.exec(text);
      if (match) {
        const amount = parseInt(match[1]);
        const targetTime = now.clone().add(amount, pattern.unit);

        return this.createSuccessResult(targetTime, text, {
          type: "relative",
          amount,
          unit: pattern.unit
        });
      }
    }

    return this.createErrorResult();
  }

  /**
   * 🕐 오늘 시간 파싱 ("오후 3시", "15:30")
   */
  static parseTimeToday(text, now) {
    // "오후 3시", "오전 9시 30분" 패턴
    const timePatterns = [
      /오후\s*(\d{1,2})시(\s*(\d{1,2})분)?/,
      /오전\s*(\d{1,2})시(\s*(\d{1,2})분)?/,
      /(\d{1,2}):(\d{2})/,
      /(\d{1,2})시(\s*(\d{1,2})분)?/
    ];

    for (const pattern of timePatterns) {
      const match = text.match(pattern);
      if (match) {
        let hour,
          minute = 0;

        if (text.includes("오후")) {
          hour = parseInt(match[1]);
          if (hour !== 12) hour += 12;
          minute = match[3] ? parseInt(match[3]) : 0;
        } else if (text.includes("오전")) {
          hour = parseInt(match[1]);
          if (hour === 12) hour = 0;
          minute = match[3] ? parseInt(match[3]) : 0;
        } else if (text.includes(":")) {
          hour = parseInt(match[1]);
          minute = parseInt(match[2]);
        } else {
          hour = parseInt(match[1]);
          minute = match[3] ? parseInt(match[3]) : 0;
        }

        if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
          const targetTime = now.clone().hour(hour).minute(minute).second(0);

          // 이미 지난 시간이면 내일로 설정
          if (targetTime.isBefore(now)) {
            targetTime.add(1, "day");
          }

          return this.createSuccessResult(targetTime, text, {
            type: "time_today",
            hour,
            minute
          });
        }
      }
    }

    return this.createErrorResult();
  }

  /**
   * 📆 상대적 날짜 파싱 ("내일", "모레", "다음주")
   */
  static parseRelativeDay(text, now) {
    const dayPatterns = {
      오늘: 0,
      내일: 1,
      모레: 2,
      글피: 3
    };

    for (const [keyword, days] of Object.entries(dayPatterns)) {
      if (text.includes(keyword)) {
        const targetTime = now.clone().add(days, "days");

        return this.createSuccessResult(targetTime, text, {
          type: "relative_day",
          days,
          keyword
        });
      }
    }

    // "다음주", "이번주" 처리
    if (text.includes("다음주")) {
      const targetTime = now.clone().add(1, "week").startOf("week");
      return this.createSuccessResult(targetTime, text, {
        type: "relative_week",
        weeks: 1
      });
    }

    return this.createErrorResult();
  }

  /**
   * 📅 특정 날짜 파싱 ("12월 25일", "2024-01-01")
   */
  static parseSpecificDate(text, now) {
    // "12월 25일" 패턴
    const monthDayPattern = /(\d{1,2})월\s*(\d{1,2})일/;
    const match = text.match(monthDayPattern);

    if (match) {
      const month = parseInt(match[1]) - 1; // moment는 0부터 시작
      const day = parseInt(match[2]);

      let targetTime = now.clone().month(month).date(day).startOf("day");

      // 이미 지난 날짜면 내년으로
      if (targetTime.isBefore(now, "day")) {
        targetTime.add(1, "year");
      }

      return this.createSuccessResult(targetTime, text, {
        type: "specific_date",
        month: month + 1,
        day
      });
    }

    // ISO 날짜 패턴 (YYYY-MM-DD)
    const isoPattern = /(\d{4})-(\d{2})-(\d{2})/;
    const isoMatch = text.match(isoPattern);

    if (isoMatch) {
      const targetTime = moment.tz(`${isoMatch[0]}`, this.TIMEZONE);
      if (targetTime.isValid()) {
        return this.createSuccessResult(targetTime, text, {
          type: "iso_date",
          year: parseInt(isoMatch[1]),
          month: parseInt(isoMatch[2]),
          day: parseInt(isoMatch[3])
        });
      }
    }

    return this.createErrorResult();
  }

  /**
   * 📅 요일 파싱 ("다음 월요일", "이번주 금요일")
   */
  static parseWeekday(text, now) {
    const weekdays = {
      월요일: 1,
      월: 1,
      화요일: 2,
      화: 2,
      수요일: 3,
      수: 3,
      목요일: 4,
      목: 4,
      금요일: 5,
      금: 5,
      토요일: 6,
      토: 6,
      일요일: 0,
      일: 0
    };

    for (const [dayName, dayNumber] of Object.entries(weekdays)) {
      if (text.includes(dayName)) {
        let targetTime;

        if (text.includes("다음")) {
          // 다음 해당 요일
          targetTime = now.clone().add(1, "week").day(dayNumber);
        } else {
          // 이번주 해당 요일
          targetTime = now.clone().day(dayNumber);
          if (targetTime.isSameOrBefore(now)) {
            targetTime.add(1, "week");
          }
        }

        return this.createSuccessResult(targetTime, text, {
          type: "weekday",
          dayName,
          dayNumber,
          isNext: text.includes("다음")
        });
      }
    }

    return this.createErrorResult();
  }

  /**
   * 🕐📅 복합 시간 파싱 ("내일 오후 3시", "다음주 월요일 9시")
   */
  static parseCombinedDateTime(text, now) {
    // 날짜 부분과 시간 부분을 분리
    const _parts = text.split(/\s+/);

    // 날짜 부분 파싱
    let dateResult = null;
    let timeResult = null;

    // 날짜 키워드 찾기
    const dateKeywords = ["내일", "모레", "다음주", "이번주"];
    const dateKeyword = dateKeywords.find((keyword) => text.includes(keyword));

    if (dateKeyword) {
      dateResult =
        this.parseRelativeDay(dateKeyword, now) ||
        this.parseRelativeDay(text, now);
    }

    // 시간 부분 파싱
    if (text.includes("시")) {
      timeResult = this.parseTimeToday(text, now);
    }

    if (dateResult && dateResult.success && timeResult && timeResult.success) {
      const combinedTime = dateResult.datetime
        .clone()
        .hour(timeResult.parsedInfo.hour)
        .minute(timeResult.parsedInfo.minute)
        .second(0);

      return this.createSuccessResult(combinedTime, text, {
        type: "combined_datetime",
        date: dateResult.parsedInfo,
        time: timeResult.parsedInfo
      });
    }

    return this.createErrorResult();
  }

  /**
   * ✅ 성공 결과 생성
   */
  static createSuccessResult(momentTime, originalText, parsedInfo = {}) {
    return {
      success: true,
      datetime: momentTime.toDate(),
      momentTime, // moment 객체도 함께 반환
      originalText,
      parsedInfo,
      formattedTime: momentTime.format("YYYY-MM-DD HH:mm:ss"),
      readableTime: this.formatReadableTime(momentTime)
    };
  }

  /**
   * ❌ 실패 결과 생성
   */
  static createErrorResult(message = null) {
    return {
      success: false,
      datetime: null,
      originalText: null,
      parsedInfo: null,
      error: message
    };
  }

  /**
   * 📝 읽기 쉬운 시간 포맷
   */
  static formatReadableTime(momentTime) {
    const now = moment.tz(this.TIMEZONE);
    const diffDays = momentTime.diff(now, "days");

    let dateStr = "";
    if (diffDays === 0) {
      dateStr = "오늘";
    } else if (diffDays === 1) {
      dateStr = "내일";
    } else if (diffDays === 2) {
      dateStr = "모레";
    } else {
      dateStr = momentTime.format("MM월 DD일 (ddd)");
    }

    const timeStr = momentTime
      .format("A h:mm")
      .replace("AM", "오전")
      .replace("PM", "오후");
    return `${dateStr} ${timeStr}`;
  }

  /**
   * 🔍 시간 텍스트 제안
   */
  static getSuggestions() {
    return [
      "30분 후",
      "1시간 후",
      "내일 오전 9시",
      "내일 오후 3시",
      "다음주 월요일 오전 10시",
      "오늘 오후 6시",
      "모레 오후 2시"
    ];
  }

  /**
   * ✅ 파싱 가능한지 미리 체크
   */
  static canParse(timeText) {
    const result = this.parseTimeText(timeText);
    return result.success;
  }
}

module.exports = TimeParseHelper;
