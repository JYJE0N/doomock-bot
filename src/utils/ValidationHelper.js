// src/core/ValidationManager.js - v3.0.1 중앙 검증 시스템
const logger = require("./Logger");
const TimeHelper = require("./TimeHelper");

/**
 * 🛡️ 중앙 검증 시스템 v3.0.1
 *
 * 🎯 핵심 개념:
 * - 모든 검증을 한곳에서 중앙 집중식 관리
 * - 스키마 기반 자동 검증
 * - 캐싱을 통한 성능 최적화
 * - 재사용 가능한 검증 규칙
 * - Railway 환경 최적화
 *
 * 📊 장점:
 * - 중복 코드 완전 제거
 * - 일관된 검증 로직
 * - 성능 향상 (캐싱)
 * - 유지보수성 극대화
 * - 확장성 보장
 *
 * 🔧 사용법:
 * ValidationManager.validate('todo', data) // 스키마 기반
 * ValidationManager.validateBatch(requests) // 배치 처리
 * ValidationManager.addSchema(name, schema) // 스키마 추가
 */
class ValidationManager {
  constructor(options = {}) {
    // 🗂️ 검증 스키마 저장소
    this.schemas = new Map();

    // 💾 검증 결과 캐시 (성능 최적화)
    this.cache = new Map();
    this.cacheExpiry = new Map();

    // ⚙️ 설정
    this.config = {
      enableCache: process.env.VALIDATION_CACHE_ENABLED !== "false",
      cacheTimeout: parseInt(process.env.VALIDATION_CACHE_TIMEOUT) || 300000, // 5분
      maxCacheSize: parseInt(process.env.VALIDATION_MAX_CACHE_SIZE) || 1000,
      enableLogging: process.env.VALIDATION_LOGGING_ENABLED === "true",
      strictMode: process.env.VALIDATION_STRICT_MODE === "true",
      ...options,
    };

    // 📊 통계
    this.stats = {
      totalValidations: 0,
      successCount: 0,
      errorCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageValidationTime: 0,
      schemaCount: 0,
    };

    // 🌍 Railway 환경 최적화 제한값
    this.railwayLimits = this.getRailwayOptimizedLimits();

    // 📝 기본 스키마 등록
    this.registerDefaultSchemas();

    logger.info("🛡️ ValidationManager v3.0.1 초기화됨");
  }

  /**
   * 📝 기본 스키마 등록
   */
  registerDefaultSchemas() {
    // 🔹 할일(Todo) 스키마
    this.addSchema("todo", {
      text: {
        type: "text",
        required: true,
        minLength: 1,
        maxLength: this.railwayLimits.maxTodoLength,
        allowEmoji: true,
        allowLineBreaks: true,
        customValidators: [
          this.validators.noExcessiveRepetition,
          this.validators.meaningfulContent,
          this.validators.noForbiddenWords,
        ],
      },
      category: {
        type: "category",
        required: false,
        defaultValue: "general",
        allowedValues: [
          "work",
          "personal",
          "study",
          "health",
          "shopping",
          "family",
          "hobby",
          "general",
        ],
      },
      priority: {
        type: "range",
        required: false,
        min: 1,
        max: 5,
        defaultValue: 3,
      },
      description: {
        type: "text",
        required: false,
        maxLength: this.railwayLimits.maxDescriptionLength,
        allowEmoji: true,
        allowLineBreaks: true,
      },
      tags: {
        type: "tags",
        required: false,
        maxCount: this.railwayLimits.maxTagsCount,
        maxTagLength: this.railwayLimits.maxTagLength,
      },
      dueDate: {
        type: "date",
        required: false,
        futureOnly: true,
      },
    });

    // 🔹 사용자 입력 스키마
    this.addSchema("userInput", {
      text: {
        type: "text",
        required: true,
        minLength: 1,
        maxLength: 1000,
        customValidators: [this.validators.noMaliciousContent],
      },
    });

    // 🔹 검색 스키마
    this.addSchema("search", {
      query: {
        type: "text",
        required: true,
        minLength: this.railwayLimits.minSearchLength,
        maxLength: this.railwayLimits.maxSearchLength,
        allowEmoji: true,
      },
      filters: {
        type: "object",
        required: false,
        properties: {
          category: { type: "category" },
          priority: { type: "range", min: 1, max: 5 },
          completed: { type: "boolean" },
        },
      },
    });

    // 🔹 설정 스키마
    this.addSchema("settings", {
      pageSize: {
        type: "range",
        min: 5,
        max: 50,
        defaultValue: 10,
      },
      notifications: {
        type: "boolean",
        defaultValue: true,
      },
      theme: {
        type: "choice",
        allowedValues: ["light", "dark", "auto"],
        defaultValue: "auto",
      },
    });

    this.stats.schemaCount = this.schemas.size;
    logger.debug(`📝 기본 스키마 등록 완료 (${this.stats.schemaCount}개)`);
  }

  /**
   * 🎯 메인 검증 메서드 (중앙 진입점)
   */
  async validate(schemaName, data, options = {}) {
    const startTime = Date.now();

    try {
      this.stats.totalValidations++;

      // 캐시 확인
      if (this.config.enableCache && !options.skipCache) {
        const cached = this.getCachedResult(schemaName, data);
        if (cached) {
          this.stats.cacheHits++;
          return cached;
        }
        this.stats.cacheMisses++;
      }

      // 스키마 조회
      const schema = this.schemas.get(schemaName);
      if (!schema) {
        throw new Error(`스키마를 찾을 수 없음: ${schemaName}`);
      }

      // 실제 검증 수행
      const result = await this.performValidation(schema, data, options);

      // 검증 시간 계산
      const validationTime = Date.now() - startTime;
      this.updateStats(result.isValid, validationTime);

      // 결과 캐싱
      if (this.config.enableCache && result.isValid && !options.skipCache) {
        this.cacheResult(schemaName, data, result);
      }

      // 로깅
      if (this.config.enableLogging) {
        this.logValidationResult(schemaName, result, validationTime);
      }

      return result;
    } catch (error) {
      logger.error(`❌ 검증 오류 (${schemaName}):`, error);
      this.stats.errorCount++;

      return {
        isValid: false,
        errors: [`검증 시스템 오류: ${error.message}`],
        data: {},
        metadata: {
          schema: schemaName,
          error: error.message,
          timestamp: TimeHelper.getLogTimeString(),
        },
      };
    }
  }

  /**
   * 🔄 배치 검증 (여러 데이터 동시 처리)
   */
  async validateBatch(requests) {
    const results = [];
    const startTime = Date.now();

    try {
      logger.debug(`🔄 배치 검증 시작 (${requests.length}개)`);

      // 병렬 처리로 성능 최적화
      const promises = requests.map(async (request, index) => {
        try {
          const result = await this.validate(request.schema, request.data, {
            ...request.options,
            batchIndex: index,
          });
          return { index, result };
        } catch (error) {
          return {
            index,
            result: {
              isValid: false,
              errors: [`배치 검증 오류: ${error.message}`],
              data: {},
            },
          };
        }
      });

      const batchResults = await Promise.all(promises);

      // 결과 정렬 (원래 순서 유지)
      batchResults.sort((a, b) => a.index - b.index);

      for (const { result } of batchResults) {
        results.push(result);
      }

      const totalTime = Date.now() - startTime;
      logger.debug(`✅ 배치 검증 완료 (${totalTime}ms)`);

      return {
        results,
        summary: {
          total: requests.length,
          valid: results.filter((r) => r.isValid).length,
          invalid: results.filter((r) => !r.isValid).length,
          processingTime: totalTime,
        },
      };
    } catch (error) {
      logger.error("❌ 배치 검증 실패:", error);
      return {
        results: [],
        summary: {
          total: requests.length,
          valid: 0,
          invalid: requests.length,
          processingTime: Date.now() - startTime,
          error: error.message,
        },
      };
    }
  }

  /**
   * 🔧 실제 검증 수행
   */
  async performValidation(schema, data, options = {}) {
    const validatedData = {};
    const allErrors = {};
    let overallValid = true;

    // 스키마의 각 필드 검증
    for (const [fieldName, fieldSchema] of Object.entries(schema)) {
      try {
        const fieldValue = data[fieldName];
        const fieldResult = await this.validateField(
          fieldName,
          fieldValue,
          fieldSchema,
          options
        );

        if (!fieldResult.isValid) {
          overallValid = false;
          allErrors[fieldName] = fieldResult.errors;
        } else {
          // 검증된 값 저장 (정규화/변환된 값)
          validatedData[fieldName] = fieldResult.value;
        }
      } catch (error) {
        logger.error(`필드 검증 오류 (${fieldName}):`, error);
        overallValid = false;
        allErrors[fieldName] = [`필드 검증 시스템 오류: ${error.message}`];
      }
    }

    // 전체 데이터 검증 (필드 간 관계 체크)
    if (overallValid && schema._globalValidators) {
      const globalResult = await this.runGlobalValidators(
        schema._globalValidators,
        validatedData,
        options
      );

      if (!globalResult.isValid) {
        overallValid = false;
        allErrors._global = globalResult.errors;
      }
    }

    return {
      isValid: overallValid,
      errors: allErrors,
      data: validatedData,
      metadata: {
        fieldCount: Object.keys(schema).length,
        errorCount: Object.keys(allErrors).length,
        timestamp: TimeHelper.getLogTimeString(),
        options,
      },
    };
  }

  /**
   * 🔍 개별 필드 검증
   */
  async validateField(fieldName, value, fieldSchema, options = {}) {
    // 기본값 처리
    if (
      (value === undefined || value === null) &&
      fieldSchema.defaultValue !== undefined
    ) {
      value = fieldSchema.defaultValue;
    }

    // 필수 필드 체크
    if (
      fieldSchema.required &&
      (value === undefined || value === null || value === "")
    ) {
      return {
        isValid: false,
        errors: [`${fieldName}은(는) 필수 입력 항목입니다.`],
        value: null,
      };
    }

    // 선택적 필드가 비어있으면 통과
    if (
      !fieldSchema.required &&
      (value === undefined || value === null || value === "")
    ) {
      return {
        isValid: true,
        errors: [],
        value: fieldSchema.defaultValue || null,
      };
    }

    // 타입별 검증
    switch (fieldSchema.type) {
      case "text":
        return this.validateText(value, fieldSchema, fieldName);

      case "category":
        return this.validateCategory(value, fieldSchema, fieldName);

      case "range":
        return this.validateRange(value, fieldSchema, fieldName);

      case "tags":
        return this.validateTags(value, fieldSchema, fieldName);

      case "date":
        return this.validateDate(value, fieldSchema, fieldName);

      case "boolean":
        return this.validateBoolean(value, fieldSchema, fieldName);

      case "choice":
        return this.validateChoice(value, fieldSchema, fieldName);

      case "object":
        return this.validateObject(value, fieldSchema, fieldName, options);

      default:
        logger.warn(`알 수 없는 검증 타입: ${fieldSchema.type}`);
        return {
          isValid: true,
          errors: [],
          value,
        };
    }
  }

  /**
   * 📝 텍스트 검증
   */
  validateText(value, schema, fieldName) {
    const errors = [];

    if (typeof value !== "string") {
      return {
        isValid: false,
        errors: [`${fieldName}은(는) 텍스트여야 합니다.`],
        value: null,
      };
    }

    const trimmed = value.trim();

    // 길이 체크
    if (schema.minLength && trimmed.length < schema.minLength) {
      errors.push(
        `${fieldName}은(는) 최소 ${schema.minLength}자 이상이어야 합니다.`
      );
    }

    if (schema.maxLength && trimmed.length > schema.maxLength) {
      errors.push(
        `${fieldName}은(는) 최대 ${schema.maxLength}자까지 입력 가능합니다.`
      );
    }

    // 줄바꿈 체크
    if (!schema.allowLineBreaks && /\n|\r/.test(trimmed)) {
      errors.push(`${fieldName}에는 줄바꿈을 사용할 수 없습니다.`);
    }

    // 이모지 체크
    if (!schema.allowEmoji && this.containsEmoji(trimmed)) {
      errors.push(`${fieldName}에는 이모지를 사용할 수 없습니다.`);
    }

    // HTML 태그 체크 (보안)
    if (this.containsHtmlTags(trimmed)) {
      errors.push(`${fieldName}에는 HTML 태그를 사용할 수 없습니다.`);
    }

    // 커스텀 검증자 실행
    if (schema.customValidators) {
      for (const validator of schema.customValidators) {
        const customResult = validator(trimmed, fieldName);
        if (!customResult.isValid) {
          errors.push(...customResult.errors);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      value: trimmed,
    };
  }

  /**
   * 🏷️ 카테고리 검증
   */
  validateCategory(value, schema, fieldName) {
    if (typeof value !== "string") {
      return {
        isValid: false,
        errors: [`${fieldName}은(는) 문자열이어야 합니다.`],
        value: null,
      };
    }

    const normalized = value.trim().toLowerCase();

    // 허용된 값 체크
    if (schema.allowedValues && !schema.allowedValues.includes(normalized)) {
      return {
        isValid: false,
        errors: [`허용된 ${fieldName}: ${schema.allowedValues.join(", ")}`],
        value: null,
      };
    }

    return {
      isValid: true,
      errors: [],
      value: normalized,
    };
  }

  /**
   * 🔢 범위 검증
   */
  validateRange(value, schema, fieldName) {
    const num = parseInt(value);

    if (isNaN(num)) {
      return {
        isValid: false,
        errors: [`${fieldName}은(는) 숫자여야 합니다.`],
        value: null,
      };
    }

    const errors = [];

    if (schema.min !== undefined && num < schema.min) {
      errors.push(`${fieldName}은(는) ${schema.min} 이상이어야 합니다.`);
    }

    if (schema.max !== undefined && num > schema.max) {
      errors.push(`${fieldName}은(는) ${schema.max} 이하여야 합니다.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      value: num,
    };
  }

  /**
   * 🏷️ 태그 검증
   */
  validateTags(value, schema, fieldName) {
    if (!Array.isArray(value)) {
      return {
        isValid: false,
        errors: [`${fieldName}은(는) 배열이어야 합니다.`],
        value: null,
      };
    }

    const errors = [];
    const validTags = [];

    // 개수 체크
    if (schema.maxCount && value.length > schema.maxCount) {
      errors.push(
        `${fieldName}은(는) 최대 ${schema.maxCount}개까지 가능합니다.`
      );
    }

    // 각 태그 검증
    for (const tag of value) {
      if (typeof tag !== "string") {
        errors.push("태그는 문자열이어야 합니다.");
        continue;
      }

      const trimmed = tag.trim();

      if (trimmed.length === 0) {
        continue; // 빈 태그 무시
      }

      if (schema.maxTagLength && trimmed.length > schema.maxTagLength) {
        errors.push(`태그는 최대 ${schema.maxTagLength}자까지 가능합니다.`);
        continue;
      }

      if (!/^[a-zA-Z0-9가-힣\s_-]+$/.test(trimmed)) {
        errors.push(
          `태그에 허용되지 않은 문자가 포함되어 있습니다: ${trimmed}`
        );
        continue;
      }

      validTags.push(trimmed);
    }

    return {
      isValid: errors.length === 0,
      errors,
      value: validTags,
    };
  }

  /**
   * 📅 날짜 검증
   */
  validateDate(value, schema, fieldName) {
    if (!value) {
      return {
        isValid: true,
        errors: [],
        value: null,
      };
    }

    const date = new Date(value);

    if (isNaN(date.getTime())) {
      return {
        isValid: false,
        errors: [`${fieldName}이(가) 올바른 날짜 형식이 아닙니다.`],
        value: null,
      };
    }

    const errors = [];
    const now = new Date();

    // 미래 날짜만 허용
    if (schema.futureOnly && date <= now) {
      errors.push(`${fieldName}은(는) 미래 날짜여야 합니다.`);
    }

    // 과거 날짜만 허용
    if (schema.pastOnly && date >= now) {
      errors.push(`${fieldName}은(는) 과거 날짜여야 합니다.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      value: date,
    };
  }

  /**
   * ✅ 불린 검증
   */
  validateBoolean(value, schema, fieldName) {
    if (typeof value === "boolean") {
      return {
        isValid: true,
        errors: [],
        value,
      };
    }

    // 문자열을 불린으로 변환 시도
    if (typeof value === "string") {
      const lower = value.toLowerCase().trim();
      if (["true", "1", "yes", "on", "예", "참"].includes(lower)) {
        return {
          isValid: true,
          errors: [],
          value: true,
        };
      }
      if (["false", "0", "no", "off", "아니오", "거짓"].includes(lower)) {
        return {
          isValid: true,
          errors: [],
          value: false,
        };
      }
    }

    return {
      isValid: false,
      errors: [`${fieldName}은(는) 참/거짓 값이어야 합니다.`],
      value: null,
    };
  }

  /**
   * 🎯 선택 검증
   */
  validateChoice(value, schema, fieldName) {
    if (typeof value !== "string") {
      return {
        isValid: false,
        errors: [`${fieldName}은(는) 문자열이어야 합니다.`],
        value: null,
      };
    }

    const trimmed = value.trim();

    if (!schema.allowedValues || !schema.allowedValues.includes(trimmed)) {
      return {
        isValid: false,
        errors: [
          `허용된 ${fieldName}: ${schema.allowedValues?.join(", ") || "없음"}`,
        ],
        value: null,
      };
    }

    return {
      isValid: true,
      errors: [],
      value: trimmed,
    };
  }

  /**
   * 📦 객체 검증 (중첩 구조)
   */
  async validateObject(value, schema, fieldName, options) {
    if (typeof value !== "object" || value === null) {
      return {
        isValid: false,
        errors: [`${fieldName}은(는) 객체여야 합니다.`],
        value: null,
      };
    }

    if (!schema.properties) {
      return {
        isValid: true,
        errors: [],
        value,
      };
    }

    const validatedObject = {};
    const allErrors = {};
    let isValid = true;

    // 객체의 각 속성 검증
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const propValue = value[propName];
      const propResult = await this.validateField(
        propName,
        propValue,
        propSchema,
        options
      );

      if (!propResult.isValid) {
        isValid = false;
        allErrors[propName] = propResult.errors;
      } else {
        validatedObject[propName] = propResult.value;
      }
    }

    return {
      isValid,
      errors: isValid ? [] : [allErrors],
      value: validatedObject,
    };
  }

  // ===== 🧰 유틸리티 메서드들 =====

  /**
   * 🧰 커스텀 검증자 정의
   */
  get validators() {
    return {
      // 과도한 반복 체크
      noExcessiveRepetition: (text, fieldName) => {
        const repetitionRegex = /(.)\1{4,}/; // 같은 문자 5번 이상 반복
        if (repetitionRegex.test(text)) {
          return {
            isValid: false,
            errors: [`${fieldName}에 같은 문자가 과도하게 반복되었습니다.`],
          };
        }
        return { isValid: true, errors: [] };
      },

      // 의미 있는 내용 체크
      meaningfulContent: (text, fieldName) => {
        // 너무 짧거나 의미 없는 내용 체크
        const meaninglessPatterns = [
          /^[.,;:!?\s]+$/, // 구두점만
          /^[0-9\s]+$/, // 숫자만
          /^[ㅋㅎㅠㅜㅠㅠㅠㅎㅎㅎ\s]+$/, // 한글 자음/모음만
        ];

        for (const pattern of meaninglessPatterns) {
          if (pattern.test(text)) {
            return {
              isValid: false,
              errors: [`${fieldName}에 의미 있는 내용을 입력해주세요.`],
            };
          }
        }

        return { isValid: true, errors: [] };
      },

      // 금지된 단어 체크
      noForbiddenWords: (text, fieldName) => {
        const forbiddenWords = [
          "test",
          "테스트",
          "ㅁㄴㅇㄹ",
          "asdf",
          "qwer",
          "스팸",
          "광고",
          "홍보",
        ];

        const foundWords = forbiddenWords.filter((word) =>
          text.toLowerCase().includes(word.toLowerCase())
        );

        if (foundWords.length > 0) {
          return {
            isValid: false,
            errors: [
              `${fieldName}에 사용할 수 없는 단어가 포함되어 있습니다: ${foundWords.join(
                ", "
              )}`,
            ],
          };
        }

        return { isValid: true, errors: [] };
      },

      // 악성 콘텐츠 체크
      noMaliciousContent: (text, fieldName) => {
        const maliciousPatterns = [
          /<script/i,
          /javascript:/i,
          /on\w+\s*=/i,
          /eval\s*\(/i,
        ];

        for (const pattern of maliciousPatterns) {
          if (pattern.test(text)) {
            return {
              isValid: false,
              errors: [`${fieldName}에 악성 콘텐츠가 감지되었습니다.`],
            };
          }
        }

        return { isValid: true, errors: [] };
      },
    };
  }

  /**
   * 🎨 이모지 감지
   */
  containsEmoji(text) {
    const emojiRegex =
      /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
    return emojiRegex.test(text);
  }

  /**
   * 🏷️ HTML 태그 감지
   */
  containsHtmlTags(text) {
    const htmlRegex = /<[^>]*>/;
    return htmlRegex.test(text);
  }

  /**
   * 💾 캐시 관련 메서드들
   */
  getCachedResult(schemaName, data) {
    if (!this.config.enableCache) return null;

    const cacheKey = this.generateCacheKey(schemaName, data);
    const expiry = this.cacheExpiry.get(cacheKey);

    if (expiry && Date.now() > expiry) {
      this.cache.delete(cacheKey);
      this.cacheExpiry.delete(cacheKey);
      return null;
    }

    return this.cache.get(cacheKey) || null;
  }

  cacheResult(schemaName, data, result) {
    if (!this.config.enableCache) return;

    // 캐시 크기 제한
    if (this.cache.size >= this.config.maxCacheSize) {
      this.clearOldestCacheEntries();
    }

    const cacheKey = this.generateCacheKey(schemaName, data);
    const expiry = Date.now() + this.config.cacheTimeout;

    this.cache.set(cacheKey, result);
    this.cacheExpiry.set(cacheKey, expiry);
  }

  generateCacheKey(schemaName, data) {
    return `${schemaName}:${JSON.stringify(data)}`;
  }

  clearOldestCacheEntries() {
    const entriesToRemove = Math.floor(this.config.maxCacheSize * 0.2); // 20% 제거
    let removed = 0;

    for (const [key, expiry] of this.cacheExpiry.entries()) {
      if (removed >= entriesToRemove) break;

      this.cache.delete(key);
      this.cacheExpiry.delete(key);
      removed++;
    }
  }

  /**
   * 🌍 Railway 환경 최적화 제한값
   */
  getRailwayOptimizedLimits() {
    const isRailway = !!process.env.RAILWAY_ENVIRONMENT;

    const baseLimits = {
      maxTodoLength: parseInt(process.env.TODO_MAX_TEXT_LENGTH) || 500,
      maxDescriptionLength:
        parseInt(process.env.TODO_MAX_DESCRIPTION_LENGTH) || 1000,
      maxTagLength: parseInt(process.env.TODO_MAX_TAG_LENGTH) || 20,
      maxTagsCount: parseInt(process.env.TODO_MAX_TAGS_COUNT) || 10,
      minSearchLength: parseInt(process.env.TODO_MIN_SEARCH_LENGTH) || 2,
      maxSearchLength: parseInt(process.env.TODO_MAX_SEARCH_LENGTH) || 100,
    };

    if (isRailway) {
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
   * 📊 통계 업데이트
   */
  updateStats(isValid, validationTime) {
    if (isValid) {
      this.stats.successCount++;
    } else {
      this.stats.errorCount++;
    }

    // 평균 검증 시간 계산
    const totalTime =
      this.stats.averageValidationTime * (this.stats.totalValidations - 1) +
      validationTime;
    this.stats.averageValidationTime = Math.round(
      totalTime / this.stats.totalValidations
    );
  }

  /**
   * 📝 검증 결과 로깅
   */
  logValidationResult(schemaName, result, validationTime) {
    if (process.env.NODE_ENV === "development") {
      const logLevel = result.isValid ? "debug" : "warn";
      const message = result.isValid ? "검증 성공" : "검증 실패";

      logger[logLevel](`🛡️ [${schemaName}] ${message} (${validationTime}ms)`, {
        errors:
          Object.keys(result.errors).length > 0 ? result.errors : undefined,
        fieldCount: result.metadata?.fieldCount,
      });
    }
  }

  /**
   * 📋 스키마 관리
   */
  addSchema(name, schema) {
    this.schemas.set(name, schema);
    this.stats.schemaCount = this.schemas.size;
    logger.debug(`📋 스키마 추가됨: ${name}`);
  }

  removeSchema(name) {
    const removed = this.schemas.delete(name);
    if (removed) {
      this.stats.schemaCount = this.schemas.size;
      logger.debug(`📋 스키마 제거됨: ${name}`);
    }
    return removed;
  }

  getSchema(name) {
    return this.schemas.get(name);
  }

  listSchemas() {
    return Array.from(this.schemas.keys());
  }

  /**
   * 📊 상태 조회
   */
  getStatus() {
    return {
      stats: this.stats,
      config: this.config,
      schemas: this.listSchemas(),
      cache: {
        size: this.cache.size,
        maxSize: this.config.maxCacheSize,
        hitRate:
          this.stats.totalValidations > 0
            ? Math.round(
                (this.stats.cacheHits / this.stats.totalValidations) * 100
              )
            : 0,
      },
    };
  }

  /**
   * 🧹 정리 작업
   */
  cleanup() {
    this.cache.clear();
    this.cacheExpiry.clear();
    logger.debug("🧹 ValidationManager 정리 완료");
  }
}

module.exports = ValidationManager;
