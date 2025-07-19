class TimeHelper {
  static getKoreaTime() {
    return new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
    );
  }

  static getCurrentYear() {
    return this.getKoreaTime().getFullYear();
  }

  static formatDate(date, options = {}) {
    const defaultOptions = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Seoul",
    };

    return date.toLocaleDateString("ko-KR", { ...defaultOptions, ...options });
  }

  static formatTime(date, options = {}) {
    const defaultOptions = {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Seoul",
    };

    return date.toLocaleTimeString("ko-KR", { ...defaultOptions, ...options });
  }

  static formatDateTime(date, options = {}) {
    const defaultOptions = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Seoul",
    };

    return date.toLocaleString("ko-KR", { ...defaultOptions, ...options });
  }

  static isToday(date) {
    const today = this.getKoreaTime();
    return date.toDateString() === today.toDateString();
  }

  static isThisWeek(date) {
    const today = this.getKoreaTime();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return date >= startOfWeek && date <= endOfWeek;
  }

  static addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  static addHours(date, hours) {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
  }

  static addMinutes(date, minutes) {
    const result = new Date(date);
    result.setMinutes(result.getMinutes() + minutes);
    return result;
  }

  static getTimeUntil(targetDate) {
    const now = this.getKoreaTime();
    const diff = targetDate.getTime() - now.getTime();

    if (diff < 0) {
      return { passed: true, text: "이미 지났습니다" };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    let text = "";
    if (days > 0) {
      text += `${days}일 `;
    }
    if (hours > 0) {
      text += `${hours}시간 `;
    }
    if (minutes > 0) {
      text += `${minutes}분`;
    }

    return { passed: false, text: text.trim() || "1분 미만" };
  }

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

  static getWorkdayInfo() {
    const now = this.getKoreaTime();
    const dayOfWeek = now.getDay(); // 0=일요일, 6=토요일

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isWorkday = !isWeekend;

    return {
      isWeekend,
      isWorkday,
      dayName: [
        "일요일",
        "월요일",
        "화요일",
        "수요일",
        "목요일",
        "금요일",
        "토요일",
      ][dayOfWeek],
    };
  }
}

module.exports = { TimeHelper };
