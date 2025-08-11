// ===== 2. src/database/schemas/StandardSchema.js - 느슨한 결합 스키마 시스템 =====
const logger = require("../../utils/core/Logger");
const { ObjectId } = require("mongodb");

/**
 * 🗄️ StandardSchema v3.0.1 - 느슨한 결합 스키마 시스템
 *
 * 🎯 역할:
 * 1. 스키마 정의: 각 컬렉션별 표준 구조 정의
 * 2. 검증 로직: 데이터 입력 시 검증 규칙 제공
 * 3. 인덱스 관리: 성능 최적화 인덱스 정의
 * 4. 변환 헬퍼: 데이터 타입 변환 및 정규화
 *
 * 🌟 특징:
 * - DatabaseManager와 느슨하게 결합
 * - 필요시에만 검증 로직 실행
 * - 설정으로 검증 기능 on/off 가능
 */

/**
 * 📋 기본 문서 템플릿 (모든 컬렉션 공통)
 */
const BaseDocumentTemplate = {
  // 🔑 기본 식별자
  _id: { type: "ObjectId", required: false }, // MongoDB 자동 생성

  // 👤 사용자 정보
  userId: { type: "number", required: true, index: true },
  userName: { type: "string", required: false, maxLength: 50 },

  // ⏰ 타임스탬프 (자동 관리)
  createdAt: { type: "date", required: true, default: () => new Date() },
  updatedAt: { type: "date", required: true, default: () => new Date() },

  // 🏷️ 메타데이터
  version: { type: "number", required: true, default: 1 },
  isActive: { type: "boolean", required: true, default: true },

  // 🌍 환경 정보 (자동 설정)
  environment: {
    type: "string",
    required: true,
    default: () => process.env.NODE_ENV || "development"
  },
  timezone: { type: "string", required: true, default: "Asia/Seoul" }
};

/**
 * 📝 컬렉션별 스키마 정의
 */
const SchemaDefinitions = {
  // 📝 할일 컬렉션
  todos: {
    ...BaseDocumentTemplate,

    // 할일 내용
    text: { type: "string", required: true, maxLength: 500, trim: true },
    description: {
      type: "string",
      required: false,
      maxLength: 1000,
      trim: true
    },

    // 완료 상태
    completed: { type: "boolean", required: true, default: false },
    completedAt: { type: "date", required: false },

    // 우선순위 및 분류
    priority: { type: "number", required: true, default: 3, min: 1, max: 5 },
    category: {
      type: "string",
      required: false,
      default: "일반",
      maxLength: 20
    },
    tags: { type: "array", required: false, default: [], maxItems: 10 },

    // 일정
    dueDate: { type: "date", required: false },
    reminderAt: { type: "date", required: false },

    // 통계
    estimatedMinutes: { type: "number", required: false, min: 1 },
    actualMinutes: { type: "number", required: false, min: 1 }
  },

  // ⏰ 타이머 컬렉션
  timers: {
    ...BaseDocumentTemplate,

    // 타이머 정보
    type: {
      type: "string",
      required: true,
      enum: ["pomodoro", "work", "break", "custom"]
    },
    name: { type: "string", required: true, maxLength: 100, trim: true },

    // 시간 설정
    duration: { type: "number", required: true, min: 1, max: 480 }, // 최대 8시간
    remainingTime: { type: "number", required: true, min: 0 },

    // 상태
    status: {
      type: "string",
      required: true,
      enum: ["running", "paused", "completed", "stopped"]
    },
    startedAt: { type: "date", required: false },
    pausedAt: { type: "date", required: false },
    completedAt: { type: "date", required: false },

    // 연결
    linkedTodoId: { type: "ObjectId", required: false }
  },

  // 👤 사용자 설정 컬렉션
  user_settings: {
    ...BaseDocumentTemplate,

    // 일반 설정
    timezone: { type: "string", required: true, default: "Asia/Seoul" },
    language: {
      type: "string",
      required: true,
      default: "ko",
      enum: ["ko", "en"]
    },

    // 알림 설정 (중첩 객체)
    notifications: {
      type: "object",
      required: true,
      properties: {
        enabled: { type: "boolean", default: true },
        sound: { type: "boolean", default: true },
        vibration: { type: "boolean", default: true }
      }
    }
  }
};

/**
 * 🔍 인덱스 정의 (성능 최적화)
 */
const IndexDefinitions = {
  todos: [
    { fields: { userId: 1, createdAt: -1 }, background: true },
    { fields: { userId: 1, completed: 1 }, background: true },
    { fields: { text: "text", description: "text" }, background: true }, // 텍스트 검색
    { fields: { dueDate: 1 }, background: true, sparse: true },
    { fields: { priority: -1 }, background: true }
  ],

  timers: [
    { fields: { userId: 1, createdAt: -1 }, background: true },
    { fields: { userId: 1, status: 1 }, background: true },
    { fields: { type: 1 }, background: true }
  ],

  user_settings: [
    { fields: { userId: 1 }, unique: true },
    { fields: { updatedAt: -1 }, background: true }
  ]
};

/**
 * 🛠️ 스키마 유틸리티 클래스 (느슨한 결합)
 */
class SchemaManager {
  constructor(config = {}) {
    this.config = {
      validationEnabled: config.validationEnabled !== false,
      autoIndexCreation: config.autoIndexCreation !== false,
      cacheValidation: config.cacheValidation !== false,
      strictMode: config.strictMode === true,
      ...config
    };

    // 캐시
    this.validationCache = new Map();
    this.indexCache = new Map();

    logger.debug("🗄️ SchemaManager 초기화됨", {
      validationEnabled: this.config.validationEnabled,
      autoIndexCreation: this.config.autoIndexCreation
    });
  }

  /**
   * 📋 스키마 정의 조회
   */
  getSchema(collectionName) {
    return SchemaDefinitions[collectionName] || null;
  }

  /**
   * 🔍 인덱스 정의 조회
   */
  getIndexes(collectionName) {
    return IndexDefinitions[collectionName] || [];
  }

  /**
   * ✅ 데이터 검증 (선택적)
   */
  async validateDocument(collectionName, document, options = {}) {
    if (!this.config.validationEnabled) {
      return { isValid: true, document }; // 검증 비활성화시 그대로 통과
    }

    const schema = this.getSchema(collectionName);
    if (!schema) {
      logger.warn(`스키마 정의 없음: ${collectionName}`);
      return { isValid: true, document }; // 스키마 없으면 통과
    }

    // 캐시 확인
    const cacheKey = this.generateCacheKey(collectionName, document);
    if (this.config.cacheValidation && this.validationCache.has(cacheKey)) {
      return this.validationCache.get(cacheKey);
    }

    try {
      const result = await this.performValidation(schema, document, options);

      // 캐시 저장
      if (this.config.cacheValidation && result.isValid) {
        this.validationCache.set(cacheKey, result);
      }

      return result;
    } catch (error) {
      logger.error(`검증 오류 (${collectionName}):`, error);
      return {
        isValid: false,
        errors: [`검증 중 오류: ${error.message}`],
        document
      };
    }
  }

  /**
   * 🔄 실제 검증 수행
   */
  async performValidation(schema, document, options) {
    const errors = [];
    const transformedDoc = { ...document };

    for (const [fieldName, fieldSchema] of Object.entries(schema)) {
      const value = document[fieldName];

      // 필수 필드 검증
      if (fieldSchema.required && (value === undefined || value === null)) {
        if (fieldSchema.default !== undefined) {
          // 기본값 적용
          transformedDoc[fieldName] =
            typeof fieldSchema.default === "function"
              ? fieldSchema.default()
              : fieldSchema.default;
        } else {
          errors.push(`필수 필드 누락: ${fieldName}`);
        }
        continue;
      }

      // 값이 있는 경우 타입 및 제약 검증
      if (value !== undefined && value !== null) {
        const fieldErrors = this.validateField(fieldName, value, fieldSchema);
        errors.push(...fieldErrors);

        // 데이터 변환 (trim, 타입 변환 등)
        const transformedValue = this.transformValue(value, fieldSchema);
        if (transformedValue !== value) {
          transformedDoc[fieldName] = transformedValue;
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      document: transformedDoc
    };
  }

  /**
   * 🔍 개별 필드 검증
   */
  validateField(fieldName, value, fieldSchema) {
    const errors = [];

    // 타입 검증
    if (fieldSchema.type && !this.validateType(value, fieldSchema.type)) {
      errors.push(`${fieldName}: 타입 오류 (expected: ${fieldSchema.type})`);
      return errors; // 타입이 틀리면 다른 검증 불가
    }

    // 길이 검증
    if (
      fieldSchema.maxLength &&
      typeof value === "string" &&
      value.length > fieldSchema.maxLength
    ) {
      errors.push(
        `${fieldName}: 최대 길이 초과 (${value.length}/${fieldSchema.maxLength})`
      );
    }

    // 숫자 범위 검증
    if (typeof value === "number") {
      if (fieldSchema.min !== undefined && value < fieldSchema.min) {
        errors.push(
          `${fieldName}: 최소값 미만 (${value} < ${fieldSchema.min})`
        );
      }
      if (fieldSchema.max !== undefined && value > fieldSchema.max) {
        errors.push(
          `${fieldName}: 최대값 초과 (${value} > ${fieldSchema.max})`
        );
      }
    }

    // 열거형 검증
    if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
      errors.push(`${fieldName}: 허용되지 않은 값 (${value})`);
    }

    return errors;
  }

  /**
   * 🔄 데이터 변환
   */
  transformValue(value, fieldSchema) {
    // 문자열 trim
    if (fieldSchema.trim && typeof value === "string") {
      return value.trim();
    }

    // ObjectId 변환
    if (fieldSchema.type === "ObjectId" && typeof value === "string") {
      try {
        return new ObjectId(value);
      } catch (error) {
        return value; // 변환 실패시 원본 유지
      }
    }

    return value;
  }

  /**
   * 🔍 타입 검증
   */
  validateType(value, expectedType) {
    switch (expectedType) {
      case "string":
        return typeof value === "string";
      case "number":
        return typeof value === "number" && !isNaN(value);
      case "boolean":
        return typeof value === "boolean";
      case "date":
        return value instanceof Date || !isNaN(Date.parse(value));
      case "array":
        return Array.isArray(value);
      case "object":
        return (
          typeof value === "object" && value !== null && !Array.isArray(value)
        );
      case "ObjectId":
        return ObjectId.isValid(value);
      default:
        return true; // 알 수 없는 타입은 통과
    }
  }

  /**
   * 🔑 캐시 키 생성
   */
  generateCacheKey(collectionName, document) {
    const keyData = {
      collection: collectionName,
      fields: Object.keys(document).sort(),
      hash: this.simpleHash(JSON.stringify(document))
    };
    return JSON.stringify(keyData);
  }

  /**
   * 🔨 간단한 해시 함수
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 32bit 정수로 변환
    }
    return hash;
  }

  /**
   * 🧹 캐시 정리
   */
  clearCache() {
    this.validationCache.clear();
    this.indexCache.clear();
    logger.debug("스키마 캐시 정리됨");
  }

  /**
   * 📊 상태 조회
   */
  getStatus() {
    return {
      config: this.config,
      cacheSize: this.validationCache.size,
      availableSchemas: Object.keys(SchemaDefinitions),
      indexDefinitions: Object.keys(IndexDefinitions)
    };
  }
}

module.exports = {
  SchemaDefinitions,
  IndexDefinitions,
  BaseDocumentTemplate,
  SchemaManager
};
