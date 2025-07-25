// src/utils/ValidationHelper.js - v3.0.1 수정된 중앙 검증 시스템
const logger = require("./Logger");
const TimeHelper = require("./TimeHelper");

/**
 * 🛡️ 중앙 검증 시스템 v3.0.1 (callbackData 스키마 추가)
 *
 * 🎯 핵심 개념:
 * - 모든 검증을 한곳에서 중앙 집중식 관리
 * - 스키마 기반 자동 검증
 * - 캐싱을 통한 성능 최적화
 * - 재사용 가능한 검증 규칙
 * - Railway 환경 최적화
 *
 * ✅ 수정 사항:
 * - callbackData 스키마 추가 (누락된 스키마)
 * - 더 안전한 에러 처리
 * - 기본 스키마 완성
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

    // 🛡️ 기본 검증 규칙들
    this.validators = this.createValidators();

    // 📝 기본 스키마 등록
    this.registerDefaultSchemas();

    logger.info(
      "🛡️ ValidationManager v3.0.1 초기화됨 (callbackData 스키마 포함)"
    );
  }

  /**
   * 🌍 Railway 환경 최적화 제한값
   */
  getRailwayOptimizedLimits() {
    const isRailway = !!process.env.RAILWAY_ENVIRONMENT;

    return {
      maxTodoLength: isRailway ? 500 : 1000,
      maxDescriptionLength: isRailway ? 1000 : 2000,
      maxTagsCount: isRailway ? 5 : 10,
      maxTagLength: isRailway ? 20 : 50,
      minSearchLength: 1,
      maxSearchLength: isRailway ? 100 : 200,
      maxCallbackDataLength: 64, // Telegram 제한
    };
  }

  /**
   * 🛡️ 기본 검증 규칙 생성
   */
  createValidators() {
    return {
      // 텍스트 내용 의미성 검사
      meaningfulContent: (value) => {
        if (typeof value !== "string") return true;
        const meaningfulPattern = /[가-힣a-zA-Z0-9]/;
        return meaningfulPattern.test(value) || "의미있는 내용을 입력해주세요.";
      },

      // 과도한 반복 방지
      noExcessiveRepetition: (value) => {
        if (typeof value !== "string") return true;
        const repetitionPattern = /(.)\1{4,}/;
        return (
          !repetitionPattern.test(value) || "과도한 반복은 허용되지 않습니다."
        );
      },

      // 금지된 단어 체크
      noForbiddenWords: (value) => {
        if (typeof value !== "string") return true;
        const forbiddenWords = ["spam", "test123", "테스트123"];
        const lowerValue = value.toLowerCase();
        const hasForbidden = forbiddenWords.some((word) =>
          lowerValue.includes(word)
        );
        return !hasForbidden || "부적절한 내용이 포함되어 있습니다.";
      },

      // 악성 컨텐츠 방지
      noMaliciousContent: (value) => {
        if (typeof value !== "string") return true;
        const maliciousPatterns = [/<script/i, /javascript:/i, /on\w+\s*=/i];
        const hasMalicious = maliciousPatterns.some((pattern) =>
          pattern.test(value)
        );
        return !hasMalicious || "보안 위험 요소가 감지되었습니다.";
      },
    };
  }

  /**
   * 📝 기본 스키마 등록 (callbackData 포함)
   */
  registerDefaultSchemas() {
    // 🔹 콜백 데이터 스키마 (누락된 중요 스키마!)
    this.addSchema("callbackData", {
      data: {
        type: "text",
        required: true,
        minLength: 1,
        maxLength: this.railwayLimits.maxCallbackDataLength,
        pattern: /^[a-zA-Z0-9_:.-]+$/, // 안전한 콜백 데이터 패턴
        customValidators: [
          (value) => {
            // 콜백 데이터 형식 검증: "module:action" 또는 "module:action:params"
            const validPattern =
              /^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+(?::[a-zA-Z0-9_.-]*)?$/;
            return (
              validPattern.test(value) ||
              "올바르지 않은 콜백 데이터 형식입니다."
            );
          },
        ],
      },
      userId: {
        type: "number",
        required: false,
      },
    });

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
      userId: {
        type: "number",
        required: false,
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
    logger.debug(
      `📝 기본 스키마 등록 완료 (${this.stats.schemaCount}개, callbackData 포함)`
    );
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
    const errors = [];
    let processedValue = value;

    // 기본값 처리
    if (
      (value === undefined || value === null) &&
      fieldSchema.defaultValue !== undefined
    ) {
      processedValue = fieldSchema.defaultValue;
    }

    // 필수 필드 체크
    if (
      fieldSchema.required &&
      (processedValue === undefined ||
        processedValue === null ||
        processedValue === "")
    ) {
      errors.push(`${fieldName}은(는) 필수 항목입니다.`);
      return { isValid: false, errors, value: processedValue };
    }

    // 값이 없으면 더 이상 검증하지 않음
    if (
      processedValue === undefined ||
      processedValue === null ||
      processedValue === ""
    ) {
      return { isValid: true, errors: [], value: processedValue };
    }

    // 타입별 검증
    switch (fieldSchema.type) {
      case "text":
        const textResult = this.validateText(processedValue, fieldSchema);
        if (!textResult.isValid) {
          errors.push(...textResult.errors);
        }
        processedValue = textResult.value;
        break;

      case "number":
      case "range":
        const numberResult = this.validateNumber(processedValue, fieldSchema);
        if (!numberResult.isValid) {
          errors.push(...numberResult.errors);
        }
        processedValue = numberResult.value;
        break;

      case "boolean":
        const boolResult = this.validateBoolean(processedValue, fieldSchema);
        if (!boolResult.isValid) {
          errors.push(...boolResult.errors);
        }
        processedValue = boolResult.value;
        break;

      case "category":
      case "choice":
        const choiceResult = this.validateChoice(processedValue, fieldSchema);
        if (!choiceResult.isValid) {
          errors.push(...choiceResult.errors);
        }
        processedValue = choiceResult.value;
        break;

      case "date":
        const dateResult = this.validateDate(processedValue, fieldSchema);
        if (!dateResult.isValid) {
          errors.push(...dateResult.errors);
        }
        processedValue = dateResult.value;
        break;

      case "tags":
        const tagsResult = this.validateTags(processedValue, fieldSchema);
        if (!tagsResult.isValid) {
          errors.push(...tagsResult.errors);
        }
        processedValue = tagsResult.value;
        break;

      default:
        logger.warn(`알 수 없는 필드 타입: ${fieldSchema.type}`);
    }

    // 커스텀 검증자 실행
    if (
      fieldSchema.customValidators &&
      Array.isArray(fieldSchema.customValidators)
    ) {
      for (const validator of fieldSchema.customValidators) {
        try {
          const result = validator(processedValue);
          if (result !== true) {
            errors.push(
              typeof result === "string" ? result : `${fieldName} 검증 실패`
            );
          }
        } catch (error) {
          errors.push(`커스텀 검증 오류: ${error.message}`);
        }
      }
    }

    // 패턴 검증
    if (fieldSchema.pattern && typeof processedValue === "string") {
      if (!fieldSchema.pattern.test(processedValue)) {
        errors.push(`${fieldName}의 형식이 올바르지 않습니다.`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      value: processedValue,
    };
  }

  /**
   * 📝 텍스트 검증
   */
  validateText(value, schema) {
    const errors = [];
    let processedValue = String(value);

    // 길이 검증
    if (schema.minLength && processedValue.length < schema.minLength) {
      errors.push(`최소 ${schema.minLength}글자 이상 입력해주세요.`);
    }

    if (schema.maxLength && processedValue.length > schema.maxLength) {
      errors.push(`최대 ${schema.maxLength}글자까지 입력 가능합니다.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      value: processedValue,
    };
  }

  /**
   * 🔢 숫자 검증
   */
  validateNumber(value, schema) {
    const errors = [];
    let processedValue = Number(value);

    if (isNaN(processedValue)) {
      errors.push("유효한 숫자를 입력해주세요.");
      return { isValid: false, errors, value: processedValue };
    }

    if (schema.min !== undefined && processedValue < schema.min) {
      errors.push(`최소값은 ${schema.min}입니다.`);
    }

    if (schema.max !== undefined && processedValue > schema.max) {
      errors.push(`최대값은 ${schema.max}입니다.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      value: processedValue,
    };
  }

  /**
   * ✅ 불린 검증
   */
  validateBoolean(value, schema) {
    const errors = [];
    let processedValue = Boolean(value);

    return {
      isValid: true,
      errors,
      value: processedValue,
    };
  }

  /**
   * 🏷️ 선택값 검증
   */
  validateChoice(value, schema) {
    const errors = [];
    let processedValue = String(value);

    if (
      schema.allowedValues &&
      !schema.allowedValues.includes(processedValue)
    ) {
      errors.push(`허용된 값: ${schema.allowedValues.join(", ")}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      value: processedValue,
    };
  }

  /**
   * 📅 날짜 검증
   */
  validateDate(value, schema) {
    const errors = [];
    let processedValue = new Date(value);

    if (isNaN(processedValue.getTime())) {
      errors.push("유효한 날짜를 입력해주세요.");
      return { isValid: false, errors, value: processedValue };
    }

    if (schema.futureOnly && processedValue < new Date()) {
      errors.push("미래 날짜만 선택 가능합니다.");
    }

    return {
      isValid: errors.length === 0,
      errors,
      value: processedValue,
    };
  }

  /**
   * 🏷️ 태그 검증
   */
  validateTags(value, schema) {
    const errors = [];
    let processedValue = Array.isArray(value) ? value : [];

    if (schema.maxCount && processedValue.length > schema.maxCount) {
      errors.push(`태그는 최대 ${schema.maxCount}개까지 가능합니다.`);
    }

    if (schema.maxTagLength) {
      for (const tag of processedValue) {
        if (String(tag).length > schema.maxTagLength) {
          errors.push(
            `각 태그는 최대 ${schema.maxTagLength}글자까지 가능합니다.`
          );
          break;
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      value: processedValue,
    };
  }

  /**
   * 💾 캐시 관련 메서드들
   */
  getCachedResult(schemaName, data) {
    const cacheKey = this.getCacheKey(schemaName, data);
    const expiry = this.cacheExpiry.get(cacheKey);

    if (expiry && Date.now() > expiry) {
      this.cache.delete(cacheKey);
      this.cacheExpiry.delete(cacheKey);
      return null;
    }

    return this.cache.get(cacheKey);
  }

  cacheResult(schemaName, data, result) {
    if (this.cache.size >= this.config.maxCacheSize) {
      // LRU: 가장 오래된 항목 제거
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.cacheExpiry.delete(firstKey);
    }

    const cacheKey = this.getCacheKey(schemaName, data);
    this.cache.set(cacheKey, result);
    this.cacheExpiry.set(cacheKey, Date.now() + this.config.cacheTimeout);
  }

  getCacheKey(schemaName, data) {
    return `${schemaName}_${JSON.stringify(data)}`;
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

    // 평균 검증 시간 업데이트
    this.stats.averageValidationTime = Math.round(
      (this.stats.averageValidationTime * (this.stats.totalValidations - 1) +
        validationTime) /
        this.stats.totalValidations
    );
  }

  /**
   * 📋 로깅
   */
  logValidationResult(schemaName, result, validationTime) {
    if (this.config.enableLogging) {
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
