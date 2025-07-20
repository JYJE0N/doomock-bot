const logger = require("./utils/Logger");
// 사용자 관련 기능을 제공하는 유틸리티 클래스

class ValidationHelper {
  // 할일 텍스트 검증
  static validateTodoText(text) {
    if (!text) {
      throw new Error("할일 내용을 입력해주세요.");
    }

    const trimmed = text.trim();

    if (trimmed.length === 0) {
      throw new Error("할일 내용을 입력해주세요.");
    }

    if (trimmed.length > 100) {
      throw new Error("할일은 100자 이내로 입력해주세요.");
    }

    // 금지된 문자 체크
    const forbiddenChars = /[<>\"'&]/g;
    if (forbiddenChars.test(trimmed)) {
      throw new Error("할일에는 특수문자 < > \" ' & 를 사용할 수 없습니다.");
    }

    return trimmed;
  }

  // 할일 인덱스 검증
  static validateTodoIndex(index, maxIndex) {
    const num = parseInt(index);

    if (isNaN(num)) {
      throw new Error("유효하지 않은 할일 번호입니다.");
    }

    if (num < 0 || num >= maxIndex) {
      throw new Error(`할일 번호는 0부터 ${maxIndex - 1} 사이여야 합니다.`);
    }

    return num;
  }

  // 타이머 이름 검증 (기존)
  static validateTimerName(name) {
    if (!name) {
      throw new Error("타이머 이름을 입력해주세요.");
    }

    const trimmed = name.trim();

    if (trimmed.length === 0) {
      throw new Error("타이머 이름을 입력해주세요.");
    }

    if (trimmed.length > 50) {
      throw new Error("타이머 이름은 50자 이내로 입력해주세요.");
    }

    return trimmed;
  }

  // 타이머 시간 검증 (분)
  static validateTimerDuration(duration) {
    const num = parseInt(duration);

    if (isNaN(num)) {
      throw new Error("유효한 시간을 입력해주세요. (숫자만)");
    }

    if (num <= 0) {
      throw new Error("시간은 1분 이상이어야 합니다.");
    }

    if (num > 480) {
      throw new Error("시간은 8시간(480분) 이하여야 합니다.");
    }

    return num;
  }

  // 사용자 ID 검증
  static validateUserId(userId) {
    if (!userId) {
      throw new Error("사용자 ID가 필요합니다.");
    }

    const num = parseInt(userId);

    if (isNaN(num)) {
      throw new Error("유효하지 않은 사용자 ID입니다.");
    }

    return num;
  }

  // 채팅 ID 검증
  static validateChatId(chatId) {
    if (!chatId) {
      throw new Error("채팅 ID가 필요합니다.");
    }

    const num = parseInt(chatId);

    if (isNaN(num)) {
      throw new Error("유효하지 않은 채팅 ID입니다.");
    }

    return num;
  }

  // 메시지 텍스트 검증
  static validateMessageText(text) {
    if (!text) {
      return "";
    }

    const trimmed = text.trim();

    if (trimmed.length > 4096) {
      throw new Error("메시지는 4096자 이내로 입력해주세요.");
    }

    return trimmed;
  }

  // 콜백 데이터 검증
  static validateCallbackData(callbackData) {
    if (!callbackData) {
      throw new Error("콜백 데이터가 필요합니다.");
    }

    if (typeof callbackData !== "string") {
      throw new Error("콜백 데이터는 문자열이어야 합니다.");
    }

    if (callbackData.length > 64) {
      throw new Error("콜백 데이터는 64자 이내여야 합니다.");
    }

    return callbackData.trim();
  }

  // 검색 키워드 검증
  static validateSearchKeyword(keyword) {
    if (!keyword) {
      throw new Error("검색 키워드를 입력해주세요.");
    }

    const trimmed = keyword.trim();

    if (trimmed.length === 0) {
      throw new Error("검색 키워드를 입력해주세요.");
    }

    if (trimmed.length > 50) {
      throw new Error("검색 키워드는 50자 이내로 입력해주세요.");
    }

    return trimmed;
  }

  // 날짜 검증
  static validateDate(date) {
    if (!date) {
      throw new Error("날짜가 필요합니다.");
    }

    const dateObj = new Date(date);

    if (isNaN(dateObj.getTime())) {
      throw new Error("유효하지 않은 날짜 형식입니다.");
    }

    return dateObj;
  }

  // 이메일 검증
  static validateEmail(email) {
    if (!email) {
      throw new Error("이메일을 입력해주세요.");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      throw new Error("유효하지 않은 이메일 형식입니다.");
    }

    return email.toLowerCase().trim();
  }

  // URL 검증
  static validateUrl(url) {
    if (!url) {
      throw new Error("URL을 입력해주세요.");
    }

    try {
      new URL(url);
      return url;
    } catch {
      throw new Error("유효하지 않은 URL 형식입니다.");
    }
  }

  // 파일명 검증
  static validateFilename(filename) {
    if (!filename) {
      throw new Error("파일명을 입력해주세요.");
    }

    const trimmed = filename.trim();

    if (trimmed.length === 0) {
      throw new Error("파일명을 입력해주세요.");
    }

    // 금지된 문자 체크
    const forbiddenChars = /[<>:"/\\|?*]/g;
    if (forbiddenChars.test(trimmed)) {
      throw new Error(
        '파일명에는 다음 문자를 사용할 수 없습니다: < > : " / \\ | ? *'
      );
    }

    if (trimmed.length > 255) {
      throw new Error("파일명은 255자 이내여야 합니다.");
    }

    return trimmed;
  }

  // 포트 번호 검증
  static validatePort(port) {
    const num = parseInt(port);

    if (isNaN(num)) {
      throw new Error("유효한 포트 번호를 입력해주세요.");
    }

    if (num < 1 || num > 65535) {
      throw new Error("포트 번호는 1부터 65535 사이여야 합니다.");
    }

    return num;
  }

  // 페이지 번호 검증
  static validatePageNumber(page, maxPage = null) {
    const num = parseInt(page);

    if (isNaN(num)) {
      throw new Error("유효한 페이지 번호를 입력해주세요.");
    }

    if (num < 1) {
      throw new Error("페이지 번호는 1 이상이어야 합니다.");
    }

    if (maxPage !== null && num > maxPage) {
      throw new Error(`페이지 번호는 ${maxPage} 이하여야 합니다.`);
    }

    return num;
  }

  // 색상 코드 검증 (HEX)
  static validateHexColor(color) {
    if (!color) {
      throw new Error("색상 코드를 입력해주세요.");
    }

    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

    if (!hexRegex.test(color)) {
      throw new Error("유효하지 않은 색상 코드입니다. (예: #FF0000)");
    }

    return color.toUpperCase();
  }

  // 범위 검증
  static validateRange(value, min, max, fieldName = "값") {
    const num = parseFloat(value);

    if (isNaN(num)) {
      throw new Error(`유효한 ${fieldName}을 입력해주세요.`);
    }

    if (num < min || num > max) {
      throw new Error(`${fieldName}은 ${min}부터 ${max} 사이여야 합니다.`);
    }

    return num;
  }

  // 필수 필드 검증
  static validateRequired(value, fieldName) {
    if (
      value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim().length === 0)
    ) {
      throw new Error(`${fieldName}은 필수 입력 항목입니다.`);
    }

    return value;
  }
}

module.exports = { ValidationHelper };
