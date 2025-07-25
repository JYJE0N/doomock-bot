// src/utils/ValidationHelper.js - 향상된 검증 시스템
const logger = require("./Logger");
const TimeHelper = require("./TimeHelper");

/**
 * 🔧 검증 헬퍼 - 향상된 버전
 * - 할일 모듈 특화 검증
 * - Railway 환경 최적화
 * - 다국어 에러 메시지
 * - 고급 검증 규칙
 */
class ValidationHelper {
  /**
   * 📝 텍스트 검증 (향상된 버전)
   */
  static validateText(text, options = {}) {
    const {
      required = true,
      minLength = 1,
      maxLength = 500,
      allowEmpty = false,
      allowEmoji = true,
      allowLineBreaks = true,
      trimWhitespace = true,
      fieldName = "텍스트",
    } = options;

    const errors = [];

    // null/undefined 체크
    if (text === null || text === undefined) {
      if (required) {
        errors.push(`${fieldName}을(를) 입력해주세요.`);
      }
      return { isValid: !required, errors };
    }

    // 타입 체크
    if (typeof text !== "string") {
      errors.push(`${fieldName}은(는) 문자열이어야 합니다.`);
      return { isValid: false, errors };
    }

    // 공백 제거 (옵션)
    let processedText = trimWhitespace ? text.trim() : text;

    // 빈 문자열 체크
    if (processedText.length === 0) {
      if (required && !allowEmpty) {
        errors.push(`${fieldName}을(를) 입력해주세요.`);
      }
      return { isValid: !required || allowEmpty, errors };
    }

    // 최소 길이 체크
    if (processedText.length < minLength) {
      errors.push(`${fieldName}은(는) 최소 ${minLength}자 이상이어야 합니다.`);
    }

    // 최대 길이 체크
    if (processedText.length > maxLength) {
      errors.push(
        `${fieldName}은(는) 최대 ${maxLength}자까지 입력 가능합니다.`
      );
    }

    // 줄바꿈 체크
    if (!allowLineBreaks && /\n|\r/.test(processedText)) {
      errors.push(`${fieldName}에는 줄바꿈을 사용할 수 없습니다.`);
    }

    // 이모지 체크
    if (!allowEmoji && this.containsEmoji(processedText)) {
      errors.push(`${fieldName}에는 이모지를 사용할 수 없습니다.`);
    }

    // HTML/스크립트 태그 체크 (보안)
    if (this.containsHtmlTags(processedText)) {
      errors.push(`${fieldName}에는 HTML 태그를 사용할 수 없습니다.`);
    }

    // 특수문자 과다 사용 체크
    if (this.hasExcessiveSpecialChars(processedText)) {
      errors.push(`${fieldName}에 특수문자가 너무 많습니다.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      processedText: trimWhitespace ? processedText : text,
    };
  }

  /**
   * 📝 할일 텍스트 특화 검증
   */
  static validateTodoText(text, options = {}) {
    const todoOptions = {
      required: true,
      minLength: 1,
      maxLength: parseInt(process.env.TODO_MAX_TEXT_LENGTH) || 500,
      allowEmpty: false,
      allowEmoji: true,
      allowLineBreaks: true,
      trimWhitespace: true,
      fieldName: "할일 내용",
      ...options,
    };

    const baseValidation = this.validateText(text, todoOptions);

    if (!baseValidation.isValid) {
      return baseValidation;
    }

    const processedText = baseValidation.processedText;
    const errors = [];

    // 할일 특화 검증

    // 1. 의미 있는 내용인지 체크
    if (this.isNonsensicalText(processedText)) {
      errors.push("의미 있는 할일 내용을 입력해주세요.");
    }

    // 2. 반복 문자 체크
    if (this.hasExcessiveRepetition(processedText)) {
      errors.push("같은 문자의 과도한 반복은 피해주세요.");
    }

    // 3. 금지된 단어 체크
    const forbiddenWords = this.checkForbiddenWords(processedText);
    if (forbiddenWords.length > 0) {
      errors.push(
        `사용할 수 없는 단어가 포함되어 있습니다: ${forbiddenWords.join(", ")}`
      );
    }

    // 4. 할일 패턴 검증 (권장사항)
    const recommendations = this.getTodoRecommendations(processedText);

    return {
      isValid: errors.length === 0,
      errors: [...baseValidation.errors, ...errors],
      processedText,
      recommendations,
    };
  }

  /**
   * 🏷️ 카테고리 검증
   */
  static validateCategory(category, availableCategories = []) {
    const errors = [];

    if (!category) {
      return {
        isValid: true,
        category: "general",
        errors: [],
      };
    }

    if (typeof category !== "string") {
      errors.push("카테고리는 문자열이어야 합니다.");
      return { isValid: false, errors };
    }

    const normalizedCategory = category.trim().toLowerCase();

    // 길이 체크
    if (normalizedCategory.length === 0) {
      return {
        isValid: true,
        category: "general",
        errors: [],
      };
    }

    if (normalizedCategory.length > 20) {
      errors.push("카테고리는 20자 이내로 입력해주세요.");
    }

    // 사용 가능한 카테고리 목록이 있으면 확인
    if (availableCategories.length > 0) {
      const validCategory = availableCategories.find(
        (cat) => cat.toLowerCase() === normalizedCategory
      );

      if (!validCategory) {
        errors.push(`사용 가능한 카테고리: ${availableCategories.join(", ")}`);
        return { isValid: false, errors };
      }

      return {
        isValid: true,
        category: validCategory,
        errors: [],
      };
    }

    // 특수문자 체크
    if (!/^[a-zA-Z0-9가-힣\s_-]+$/.test(normalizedCategory)) {
      errors.push("카테고리에는 특수문자를 사용할 수 없습니다.");
    }

    return {
      isValid: errors.length === 0,
      category: normalizedCategory,
      errors,
    };
  }

  /**
   * ⭐ 우선순위 검증
   */
  static validatePriority(priority) {
    const errors = [];

    // undefined/null 처리 (기본값 사용)
    if (priority === undefined || priority === null) {
      return {
        isValid: true,
        priority: 3, // 기본값: 보통
        errors: [],
      };
    }

    // 문자열을 숫자로 변환 시도
    const numPriority = parseInt(priority);

    if (isNaN(numPriority)) {
      errors.push("우선순위는 숫자여야 합니다.");
      return { isValid: false, errors };
    }

    // 범위 체크 (1: 매우 낮음 ~ 5: 매우 높음)
    if (numPriority < 1 || numPriority > 5) {
      errors.push("우선순위는 1~5 사이의 값이어야 합니다.");
      return { isValid: false, errors };
    }

    return {
      isValid: true,
      priority: numPriority,
      errors: [],
    };
  }

  /**
   * 📅 날짜 검증
   */
  static validateDate(date, options = {}) {
    const {
      allowPast = false,
      allowFuture = true,
      maxFutureDays = 365,
      fieldName = "날짜",
    } = options;

    const errors = [];

    // null/undefined 처리
    if (!date) {
      return {
        isValid: true,
        date: null,
        errors: [],
      };
    }

    // Date 객체로 변환
    let dateObj;
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === "string" || typeof date === "number") {
      dateObj = new Date(date);
    } else {
      errors.push(`${fieldName} 형식이 올바르지 않습니다.`);
      return { isValid: false, errors };
    }

    // 유효한 날짜인지 체크
    if (isNaN(dateObj.getTime())) {
      errors.push(`${fieldName} 형식이 올바르지 않습니다.`);
      return { isValid: false, errors };
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const inputDate = new Date(
      dateObj.getFullYear(),
      dateObj.getMonth(),
      dateObj.getDate()
    );

    // 과거 날짜 체크
    if (!allowPast && inputDate < today) {
      errors.push(`${fieldName}은(는) 과거 날짜로 설정할 수 없습니다.`);
    }

    // 미래 날짜 체크
    if (!allowFuture && inputDate > today) {
      errors.push(`${fieldName}은(는) 미래 날짜로 설정할 수 없습니다.`);
    }

    // 최대 미래 날짜 체크
    if (allowFuture && maxFutureDays > 0) {
      const maxFutureDate = new Date();
      maxFutureDate.setDate(maxFutureDate.getDate() + maxFutureDays);

      if (inputDate > maxFutureDate) {
        errors.push(
          `${fieldName}은(는) 최대 ${maxFutureDays}일 후까지만 설정 가능합니다.`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      date: dateObj,
      errors,
      formatted: TimeHelper.formatDate(dateObj, "YYYY-MM-DD"),
    };
  }

  /**
   * 🏷️ 태그 배열 검증
   */
  static validateTags(tags, options = {}) {
    const {
      maxTags = 10,
      maxTagLength = 20,
      allowDuplicates = false,
      allowEmpty = false,
    } = options;

    const errors = [];

    // null/undefined 처리
    if (!tags) {
      return {
        isValid: true,
        tags: [],
        errors: [],
      };
    }

    // 배열 체크
    if (!Array.isArray(tags)) {
      errors.push("태그는 배열 형태여야 합니다.");
      return { isValid: false, errors };
    }

    // 태그 개수 체크
    if (tags.length > maxTags) {
      errors.push(`태그는 최대 ${maxTags}개까지 설정 가능합니다.`);
    }

    const processedTags = [];
    const seenTags = new Set();

    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];

      // 타입 체크
      if (typeof tag !== "string") {
        errors.push(`${i + 1}번째 태그는 문자열이어야 합니다.`);
        continue;
      }

      const trimmedTag = tag.trim();

      // 빈 태그 체크
      if (trimmedTag.length === 0) {
        if (!allowEmpty) {
          errors.push("빈 태그는 사용할 수 없습니다.");
        }
        continue;
      }

      // 태그 길이 체크
      if (trimmedTag.length > maxTagLength) {
        errors.push(`태그는 ${maxTagLength}자 이내로 입력해주세요.`);
        continue;
      }

      // 중복 체크
      const lowerTag = trimmedTag.toLowerCase();
      if (!allowDuplicates && seenTags.has(lowerTag)) {
        errors.push(`중복된 태그가 있습니다: ${trimmedTag}`);
        continue;
      }

      // 특수문자 체크
      if (!/^[a-zA-Z0-9가-힣\s_-]+$/.test(trimmedTag)) {
        errors.push(`태그에는 특수문자를 사용할 수 없습니다: ${trimmedTag}`);
        continue;
      }

      processedTags.push(trimmedTag);
      seenTags.add(lowerTag);
    }

    return {
      isValid: errors.length === 0,
      tags: processedTags,
      errors,
      duplicatesRemoved: tags.length - processedTags.length,
    };
  }

  /**
   * 🔍 검색어 검증
   */
  static validateSearchTerm(searchTerm, options = {}) {
    const {
      minLength = 2,
      maxLength = 100,
      allowSpecialChars = false,
    } = options;

    const errors = [];

    if (!searchTerm || typeof searchTerm !== "string") {
      errors.push("검색어를 입력해주세요.");
      return { isValid: false, errors };
    }

    const trimmed = searchTerm.trim();

    if (trimmed.length < minLength) {
      errors.push(`검색어는 ${minLength}자 이상 입력해주세요.`);
    }

    if (trimmed.length > maxLength) {
      errors.push(`검색어는 ${maxLength}자 이내로 입력해주세요.`);
    }

    // 특수문자 체크
    if (!allowSpecialChars && /[<>{}[\]\\|`~!@#$%^&*()+=]/.test(trimmed)) {
      errors.push("검색어에는 특수문자를 사용할 수 없습니다.");
    }

    // SQL 인젝션 패턴 체크
    if (this.containsSqlInjection(trimmed)) {
      errors.push("안전하지 않은 검색어입니다.");
    }

    return {
      isValid: errors.length === 0,
      searchTerm: trimmed,
      errors,
      suggestions: this.getSearchSuggestions(trimmed),
    };
  }

  /**
   * 📊 페이지네이션 검증
   */
  static validatePagination(page, limit, options = {}) {
    const {
      maxPage = null,
      maxLimit = 100,
      defaultPage = 1,
      defaultLimit = 10,
    } = options;

    const errors = [];
    let validatedPage = defaultPage;
    let validatedLimit = defaultLimit;

    // 페이지 검증
    if (page !== undefined && page !== null) {
      const numPage = parseInt(page);

      if (isNaN(numPage) || numPage < 1) {
        errors.push("페이지 번호는 1 이상이어야 합니다.");
      } else if (maxPage && numPage > maxPage) {
        errors.push(`페이지 번호는 ${maxPage} 이하여야 합니다.`);
      } else {
        validatedPage = numPage;
      }
    }

    // 제한 수 검증
    if (limit !== undefined && limit !== null) {
      const numLimit = parseInt(limit);

      if (isNaN(numLimit) || numLimit < 1) {
        errors.push("제한 수는 1 이상이어야 합니다.");
      } else if (numLimit > maxLimit) {
        errors.push(`제한 수는 ${maxLimit} 이하여야 합니다.`);
      } else {
        validatedLimit = numLimit;
      }
    }

    return {
      isValid: errors.length === 0,
      page: validatedPage,
      limit: validatedLimit,
      errors,
      offset: (validatedPage - 1) * validatedLimit,
    };
  }

  /**
   * 📊 사용자 ID 검증
   */
  static validateUserId(userId) {
    const errors = [];

    if (userId === undefined || userId === null) {
      errors.push("사용자 ID가 필요합니다.");
      return { isValid: false, errors };
    }

    // 숫자 변환
    const numUserId = parseInt(userId);

    if (isNaN(numUserId)) {
      errors.push("사용자 ID는 숫자여야 합니다.");
      return { isValid: false, errors };
    }

    // 텔레그램 사용자 ID 범위 체크
    if (numUserId <= 0 || numUserId > 2147483647) {
      errors.push("올바르지 않은 사용자 ID입니다.");
    }

    return {
      isValid: errors.length === 0,
      userId: numUserId.toString(), // 문자열로 정규화
      errors,
    };
  }

  /**
   * 📊 ObjectId 검증
   */
  static validateObjectId(id, fieldName = "ID") {
    const errors = [];

    if (!id) {
      errors.push(`${fieldName}이(가) 필요합니다.`);
      return { isValid: false, errors };
    }

    if (typeof id !== "string") {
      errors.push(`${fieldName}은(는) 문자열이어야 합니다.`);
      return { isValid: false, errors };
    }

    // ObjectId 형식 체크 (24자리 16진수)
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      errors.push(`올바르지 않은 ${fieldName} 형식입니다.`);
    }

    return {
      isValid: errors.length === 0,
      objectId: id,
      errors,
    };
  }

  // ===== 🔧 헬퍼 메서드들 =====

  /**
   * 이모지 포함 여부 확인
   */
  static containsEmoji(text) {
    const emojiRegex =
      /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    return emojiRegex.test(text);
  }

  /**
   * HTML 태그 포함 여부 확인
   */
  static containsHtmlTags(text) {
    const htmlRegex = /<\/?[a-z][\s\S]*>/i;
    return htmlRegex.test(text);
  }

  /**
   * 특수문자 과다 사용 확인
   */
  static hasExcessiveSpecialChars(text) {
    const specialCharCount = (
      text.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g) || []
    ).length;
    const threshold = Math.max(3, Math.floor(text.length * 0.3)); // 전체 길이의 30% 또는 최소 3개
    return specialCharCount > threshold;
  }

  /**
   * 무의미한 텍스트 확인
   */
  static isNonsensicalText(text) {
    // 1. 같은 문자만 반복
    if (/^(.)\1{4,}$/.test(text)) return true;

    // 2. 키보드 나열
    const keyboardPatterns = [
      "qwertyuiop",
      "asdfghjkl",
      "zxcvbnm",
      "1234567890",
      "ㅁㄴㅇㄹㅎㅗㅓㅏㅣ",
      "ㅂㅈㄷㄱㅅㅛㅕㅑㅖㅔ",
    ];

    for (const pattern of keyboardPatterns) {
      if (
        text.toLowerCase().includes(pattern) &&
        text.length <= pattern.length + 2
      ) {
        return true;
      }
    }

    // 3. 과도한 반복 패턴
    if (/(.{2,})\1{3,}/.test(text)) return true;

    return false;
  }

  /**
   * 과도한 반복 확인
   */
  static hasExcessiveRepetition(text) {
    // 같은 문자 5개 이상 연속
    return /(.)\1{4,}/.test(text);
  }

  /**
   * 금지된 단어 확인
   */
  static checkForbiddenWords(text) {
    const forbiddenWords = [
      // 스팸성 단어들
      "test",
      "TEST",
      "테스트테스트테스트",
      // 부적절한 단어들은 환경변수로 관리
      ...(process.env.FORBIDDEN_WORDS?.split(",") || []),
    ];

    const foundWords = [];
    const lowerText = text.toLowerCase();

    for (const word of forbiddenWords) {
      if (word && lowerText.includes(word.toLowerCase())) {
        foundWords.push(word);
      }
    }

    return foundWords;
  }

  /**
   * 할일 작성 권장사항 생성
   */
  static getTodoRecommendations(text) {
    const recommendations = [];

    // 동사로 시작하는지 체크
    if (
      !/^(하기|만들기|보기|읽기|쓰기|가기|사기|먹기|운동|공부|정리|청소|회의|통화|확인|검토|작성|준비|구매|예약)/.test(
        text
      )
    ) {
      recommendations.push({
        type: "action_verb",
        message: "동사로 시작하면 더 명확한 할일이 됩니다.",
        example: `"${text}" → "${text}하기"`,
      });
    }

    // 너무 짧은 할일
    if (text.length < 5) {
      recommendations.push({
        type: "too_short",
        message: "좀 더 구체적으로 작성해보세요.",
        example: "예: '운동' → '30분간 유산소 운동하기'",
      });
    }

    // 시간이나 수량 정보 추가 권장
    if (!/\d+/.test(text) && !/(오늘|내일|이번|다음)/.test(text)) {
      recommendations.push({
        type: "add_specifics",
        message: "시간이나 수량을 추가하면 더 명확합니다.",
        example: "예: '책 읽기' → '1시간 동안 책 읽기'",
      });
    }

    return recommendations.slice(0, 2); // 최대 2개까지
  }

  /**
   * SQL 인젝션 패턴 확인
   */
  static containsSqlInjection(text) {
    const sqlPatterns = [
      /union\s+select/i,
      /drop\s+table/i,
      /delete\s+from/i,
      /insert\s+into/i,
      /update\s+set/i,
      /script\s*>/i,
      /<\s*script/i,
    ];

    return sqlPatterns.some((pattern) => pattern.test(text));
  }

  /**
   * 검색 제안사항 생성
   */
  static getSearchSuggestions(searchTerm) {
    const suggestions = [];

    // 너무 짧은 검색어
    if (searchTerm.length < 3) {
      suggestions.push("더 구체적인 검색어를 입력해보세요.");
    }

    // 특수문자가 포함된 경우
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(searchTerm)) {
      suggestions.push("특수문자 없이 검색해보세요.");
    }

    // 숫자만 포함된 경우
    if (/^\d+$/.test(searchTerm)) {
      suggestions.push("숫자와 함께 키워드를 추가해보세요.");
    }

    return suggestions;
  }

  /**
   * 색상 코드 검증 (HEX)
   */
  static validateHexColor(color, options = {}) {
    const { allowShort = true, fieldName = "색상" } = options;
    const errors = [];

    if (!color) {
      errors.push(`${fieldName} 코드를 입력해주세요.`);
      return { isValid: false, errors };
    }

    if (typeof color !== "string") {
      errors.push(`${fieldName} 코드는 문자열이어야 합니다.`);
      return { isValid: false, errors };
    }

    const trimmed = color.trim();

    // # 시작 체크
    if (!trimmed.startsWith("#")) {
      errors.push(`${fieldName} 코드는 #으로 시작해야 합니다.`);
      return { isValid: false, errors };
    }

    // 길이 체크
    const hexPart = trimmed.substring(1);
    const validLengths = allowShort ? [3, 6] : [6];

    if (!validLengths.includes(hexPart.length)) {
      const expectedLengths = validLengths
        .map((len) => `${len}자리`)
        .join(" 또는 ");
      errors.push(`${fieldName} 코드는 ${expectedLengths} 16진수여야 합니다.`);
      return { isValid: false, errors };
    }

    // 16진수 체크
    if (!/^[0-9a-fA-F]+$/.test(hexPart)) {
      errors.push(`올바르지 않은 ${fieldName} 코드입니다. (예: #FF0000)`);
    }

    return {
      isValid: errors.length === 0,
      color: trimmed.toUpperCase(),
      errors,
    };
  }

  /**
   * 범위 검증
   */
  static validateRange(value, min, max, options = {}) {
    const { fieldName = "값", inclusive = true, allowFloat = true } = options;

    const errors = [];

    if (value === undefined || value === null || value === "") {
      errors.push(`${fieldName}을(를) 입력해주세요.`);
      return { isValid: false, errors };
    }

    const num = allowFloat ? parseFloat(value) : parseInt(value);

    if (isNaN(num)) {
      errors.push(`유효한 ${fieldName}을(를) 입력해주세요.`);
      return { isValid: false, errors };
    }

    // 범위 체크
    const minCheck = inclusive ? num >= min : num > min;
    const maxCheck = inclusive ? num <= max : num < max;

    if (!minCheck || !maxCheck) {
      const minSymbol = inclusive ? "이상" : "초과";
      const maxSymbol = inclusive ? "이하" : "미만";
      errors.push(
        `${fieldName}은(는) ${min}${minSymbol} ${max}${maxSymbol}여야 합니다.`
      );
    }

    return {
      isValid: errors.length === 0,
      value: allowFloat ? num : Math.floor(num),
      errors,
    };
  }

  /**
   * 필수 필드 검증
   */
  static validateRequired(value, fieldName = "필드") {
    const errors = [];

    if (value === null || value === undefined) {
      errors.push(`${fieldName}은(는) 필수 입력 항목입니다.`);
      return { isValid: false, errors };
    }

    if (typeof value === "string" && value.trim().length === 0) {
      errors.push(`${fieldName}을(를) 입력해주세요.`);
      return { isValid: false, errors };
    }

    if (Array.isArray(value) && value.length === 0) {
      errors.push(`${fieldName}을(를) 하나 이상 선택해주세요.`);
      return { isValid: false, errors };
    }

    return {
      isValid: true,
      value: typeof value === "string" ? value.trim() : value,
      errors: [],
    };
  }

  /**
   * 이메일 검증
   */
  static validateEmail(email, options = {}) {
    const {
      required = true,
      allowInternational = true,
      fieldName = "이메일",
    } = options;

    const errors = [];

    if (!email) {
      if (required) {
        errors.push(`${fieldName}을(를) 입력해주세요.`);
      }
      return { isValid: !required, errors };
    }

    if (typeof email !== "string") {
      errors.push(`${fieldName}은(는) 문자열이어야 합니다.`);
      return { isValid: false, errors };
    }

    const trimmed = email.trim().toLowerCase();

    // 기본 이메일 형식 체크
    const emailRegex = allowInternational
      ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      : /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!emailRegex.test(trimmed)) {
      errors.push(`올바른 ${fieldName} 형식이 아닙니다.`);
    }

    // 길이 체크
    if (trimmed.length > 254) {
      errors.push(`${fieldName}이(가) 너무 깁니다.`);
    }

    return {
      isValid: errors.length === 0,
      email: trimmed,
      errors,
    };
  }

  /**
   * URL 검증
   */
  static validateUrl(url, options = {}) {
    const {
      required = true,
      allowedProtocols = ["http", "https"],
      fieldName = "URL",
    } = options;

    const errors = [];

    if (!url) {
      if (required) {
        errors.push(`${fieldName}을(를) 입력해주세요.`);
      }
      return { isValid: !required, errors };
    }

    if (typeof url !== "string") {
      errors.push(`${fieldName}은(는) 문자열이어야 합니다.`);
      return { isValid: false, errors };
    }

    const trimmed = url.trim();

    try {
      const urlObj = new URL(trimmed);

      // 프로토콜 체크
      const protocol = urlObj.protocol.slice(0, -1); // ':' 제거
      if (!allowedProtocols.includes(protocol)) {
        errors.push(`허용된 프로토콜: ${allowedProtocols.join(", ")}`);
      }
    } catch (error) {
      errors.push(`올바른 ${fieldName} 형식이 아닙니다.`);
    }

    return {
      isValid: errors.length === 0,
      url: trimmed,
      errors,
    };
  }

  /**
   * 복합 검증 (여러 필드 동시 검증)
   */
  static validateMultiple(data, rules) {
    const allErrors = {};
    const validatedData = {};
    let overallValid = true;

    for (const [field, rule] of Object.entries(rules)) {
      const value = data[field];
      let result;

      switch (rule.type) {
        case "text":
          result = this.validateText(value, rule.options || {});
          break;
        case "todo":
          result = this.validateTodoText(value, rule.options || {});
          break;
        case "category":
          result = this.validateCategory(value, rule.availableCategories || []);
          break;
        case "priority":
          result = this.validatePriority(value);
          break;
        case "date":
          result = this.validateDate(value, rule.options || {});
          break;
        case "tags":
          result = this.validateTags(value, rule.options || {});
          break;
        case "email":
          result = this.validateEmail(value, rule.options || {});
          break;
        case "url":
          result = this.validateUrl(value, rule.options || {});
          break;
        case "range":
          result = this.validateRange(
            value,
            rule.min,
            rule.max,
            rule.options || {}
          );
          break;
        case "required":
          result = this.validateRequired(value, rule.fieldName || field);
          break;
        default:
          result = { isValid: true, errors: [] };
      }

      if (!result.isValid) {
        overallValid = false;
        allErrors[field] = result.errors;
      } else {
        // 검증된 값 저장 (정규화된 값)
        if (result.hasOwnProperty("processedText")) {
          validatedData[field] = result.processedText;
        } else if (result.hasOwnProperty("value")) {
          validatedData[field] = result.value;
        } else if (result.hasOwnProperty(rule.type)) {
          validatedData[field] = result[rule.type];
        } else {
          validatedData[field] = value;
        }
      }
    }

    return {
      isValid: overallValid,
      errors: allErrors,
      data: validatedData,
      errorCount: Object.keys(allErrors).length,
    };
  }

  /**
   * 환경변수 기반 제한값 조회
   */
  static getEnvironmentLimits() {
    return {
      maxTodoLength: parseInt(process.env.TODO_MAX_TEXT_LENGTH) || 500,
      maxDescriptionLength:
        parseInt(process.env.TODO_MAX_DESCRIPTION_LENGTH) || 1000,
      maxCategoryLength: parseInt(process.env.TODO_MAX_CATEGORY_LENGTH) || 20,
      maxTagLength: parseInt(process.env.TODO_MAX_TAG_LENGTH) || 20,
      maxTagsCount: parseInt(process.env.TODO_MAX_TAGS_COUNT) || 10,
      maxTodosPerUser: parseInt(process.env.MAX_TODOS_PER_USER) || 50,
      minSearchLength: parseInt(process.env.TODO_MIN_SEARCH_LENGTH) || 2,
      maxSearchLength: parseInt(process.env.TODO_MAX_SEARCH_LENGTH) || 100,
    };
  }

  /**
   * Railway 환경 최적화 설정
   */
  static getRailwayOptimizedLimits() {
    const isRailway = !!process.env.RAILWAY_ENVIRONMENT;
    const baseLimits = this.getEnvironmentLimits();

    if (isRailway) {
      // Railway 환경에서는 제한을 조금 더 보수적으로
      return {
        ...baseLimits,
        maxTodoLength: Math.min(baseLimits.maxTodoLength, 400),
        maxDescriptionLength: Math.min(baseLimits.maxDescriptionLength, 800),
        maxTagsCount: Math.min(baseLimits.maxTagsCount, 8),
      };
    }

    return baseLimits;
  }

  /**
   * 검증 결과 로깅 (디버그용)
   */
  static logValidationResult(field, result, context = "") {
    if (process.env.NODE_ENV === "development") {
      const logLevel = result.isValid ? "debug" : "warn";
      const message = result.isValid ? "검증 성공" : "검증 실패";

      logger[logLevel](
        `🔧 [${field}] ${message}${context ? ` (${context})` : ""}`,
        {
          errors: result.errors || [],
          value: result.value || result.processedText,
        }
      );
    }
  }
}

module.exports = { ValidationHelper };
