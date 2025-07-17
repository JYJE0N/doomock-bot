class ValidationHelper {
  static isValidNumber(value) {
    return !isNaN(value) && isFinite(value);
  }

  static isValidPositiveNumber(value) {
    return this.isValidNumber(value) && value > 0;
  }

  static isValidInteger(value) {
    return Number.isInteger(value);
  }

  static isValidDate(date) {
    return date instanceof Date && !isNaN(date.getTime());
  }

  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidPhoneNumber(phone) {
    const phoneRegex = /^[0-9]{2,3}-[0-9]{3,4}-[0-9]{4}$/;
    return phoneRegex.test(phone);
  }

  static isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static isValidTelegramUserId(userId) {
    return this.isValidPositiveNumber(userId) && userId < 2147483647; // 32비트 정수 최대값
  }

  static isValidTextLength(text, minLength = 1, maxLength = 1000) {
    if (typeof text !== "string") return false;
    const length = text.trim().length;
    return length >= minLength && length <= maxLength;
  }

  static sanitizeText(text) {
    if (typeof text !== "string") return "";
    return text.trim().replace(/[<>&"']/g, "");
  }

  static validateTodoTask(task) {
    if (!this.isValidTextLength(task, 1, 200)) {
      throw new Error("할일은 1자 이상 200자 이하로 입력해주세요.");
    }
    return this.sanitizeText(task);
  }

  static validateLeaveAmount(amount) {
    const numAmount = parseFloat(amount);
    if (!this.isValidPositiveNumber(numAmount)) {
      throw new Error("올바른 연차 일수를 입력해주세요.");
    }
    if (numAmount > 30) {
      throw new Error("연차 일수는 30일을 초과할 수 없습니다.");
    }
    if (numAmount % 0.5 !== 0) {
      throw new Error("연차는 0.5일 단위로만 사용할 수 있습니다.");
    }
    return numAmount;
  }

  static validateTimerName(name) {
    if (!this.isValidTextLength(name, 1, 50)) {
      throw new Error("타이머 이름은 1자 이상 50자 이하로 입력해주세요.");
    }
    return this.sanitizeText(name);
  }

  static validateReminderTime(timeString) {
    const timeRegex = /^(\d{1,2}):(\d{2})$/;
    const match = timeString.match(timeRegex);

    if (!match) {
      throw new Error("올바른 시간 형식이 아닙니다. (예: 14:30)");
    }

    const hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);

    if (hours < 0 || hours > 23) {
      throw new Error("시간은 0-23 사이의 값이어야 합니다.");
    }

    if (minutes < 0 || minutes > 59) {
      throw new Error("분은 0-59 사이의 값이어야 합니다.");
    }

    return { hours, minutes };
  }

  static validateReminderMinutes(minutes) {
    const numMinutes = parseInt(minutes);
    if (!this.isValidPositiveNumber(numMinutes)) {
      throw new Error("올바른 분 수를 입력해주세요.");
    }
    if (numMinutes > 1440) {
      // 24시간
      throw new Error("리마인더는 최대 24시간(1440분)까지 설정할 수 있습니다.");
    }
    return numMinutes;
  }

  static validateTTSText(text) {
    if (!this.isValidTextLength(text, 1, 500)) {
      throw new Error("TTS 텍스트는 1자 이상 500자 이하로 입력해주세요.");
    }
    return this.sanitizeText(text);
  }

  static validateLanguageCode(langCode) {
    const supportedLanguages = ["ko", "en", "ja", "zh", "es", "fr", "de", "ru"];
    if (!supportedLanguages.includes(langCode)) {
      throw new Error(`지원하지 않는 언어코드입니다: ${langCode}`);
    }
    return langCode;
  }

  static createErrorResponse(error) {
    return {
      success: false,
      error: error.message || "알 수 없는 오류가 발생했습니다.",
      timestamp: new Date().toISOString(),
    };
  }

  static createSuccessResponse(data) {
    return {
      success: true,
      data: data,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { ValidationHelper };
