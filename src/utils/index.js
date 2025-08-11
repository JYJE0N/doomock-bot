// src/utils/index.js
// 모든 유틸리티를 한 곳에서 관리하는 통합 파일

/**
 * 🕒 시간 관련 유틸리티
 */
const TimeUtils = {
  // 딜레이 함수
  delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

  // 타임스탬프 생성
  timestamp: () => new Date().toISOString(),

  // 시간 포맷팅
  formatTime: (date = new Date()) => {
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  },

  // 실행 시간 측정
  measureTime: async (fn, label = "Execution") => {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    console.log(`⏱️ ${label}: ${duration}ms`);
    return result;
  }
};

/**
 * 🆔 ID 생성 유틸리티
 */
const IdUtils = {
  // 고유 ID 생성
  generateId: (prefix = "id") => {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  // UUID v4 스타일 ID 생성
  generateUUID: () => {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },

  // 짧은 해시 생성
  shortHash: (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
};

/**
 * 📝 로깅 유틸리티
 */
const LogUtils = {
  // 컬러 로그
  colors: {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m"
  },

  // 레벨별 로그
  log: (level, message, data = null) => {
    const timestamp = TimeUtils.formatTime();
    const levelEmoji = {
      debug: "🔍",
      info: "ℹ️",
      warn: "⚠️",
      error: "❌",
      success: "✅"
    };

    const levelColor = {
      debug: LogUtils.colors.cyan,
      info: LogUtils.colors.blue,
      warn: LogUtils.colors.yellow,
      error: LogUtils.colors.red,
      success: LogUtils.colors.green
    };

    const emoji = levelEmoji[level] || "📝";
    const color = levelColor[level] || LogUtils.colors.reset;

    console.log(
      `${color}[${timestamp}] ${emoji} ${level.toUpperCase()}: ${message}${LogUtils.colors.reset}`
    );

    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  },

  // 단축 메서드들
  debug: (msg, data) => LogUtils.log("debug", msg, data),
  info: (msg, data) => LogUtils.log("info", msg, data),
  warn: (msg, data) => LogUtils.log("warn", msg, data),
  error: (msg, data) => LogUtils.log("error", msg, data),
  success: (msg, data) => LogUtils.log("success", msg, data)
};

/**
 * 🔧 객체 유틸리티
 */
const ObjectUtils = {
  // 깊은 복사
  deepClone: (obj) => {
    if (obj === null || typeof obj !== "object") return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array)
      return obj.map((item) => ObjectUtils.deepClone(item));

    const cloned = {};
    for (const key in obj) {
      if (Object.hasOwn(obj, key)) {
        cloned[key] = ObjectUtils.deepClone(obj[key]);
      }
    }
    return cloned;
  },

  // 깊은 병합
  deepMerge: (target, source) => {
    const output = { ...target };

    if (isObject(target) && isObject(source)) {
      Object.keys(source).forEach((key) => {
        if (isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = ObjectUtils.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }

    return output;

    function isObject(obj) {
      return obj && typeof obj === "object" && !Array.isArray(obj);
    }
  },

  // 객체 평탄화
  flatten: (obj, prefix = "") => {
    const flattened = {};

    Object.keys(obj).forEach((key) => {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (
        typeof obj[key] === "object" &&
        obj[key] !== null &&
        !Array.isArray(obj[key])
      ) {
        Object.assign(flattened, ObjectUtils.flatten(obj[key], newKey));
      } else {
        flattened[newKey] = obj[key];
      }
    });

    return flattened;
  },

  // 안전한 프로퍼티 접근
  safeGet: (obj, path, defaultValue = undefined) => {
    const keys = path.split(".");
    let result = obj;

    for (const key of keys) {
      if (result == null) return defaultValue;
      result = result[key];
    }

    return result ?? defaultValue;
  }
};

/**
 * 🔄 배열 유틸리티
 */
const ArrayUtils = {
  // 청크로 나누기
  chunk: (array, size) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  },

  // 중복 제거
  unique: (array, key) => {
    if (key) {
      const seen = new Set();
      return array.filter((item) => {
        const val = item[key];
        if (seen.has(val)) return false;
        seen.add(val);
        return true;
      });
    }
    return [...new Set(array)];
  },

  // 그룹화
  groupBy: (array, key) => {
    return array.reduce((groups, item) => {
      const group = item[key];
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
      return groups;
    }, {});
  },

  // 셔플
  shuffle: (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
};

/**
 * 🔐 검증 유틸리티
 */
const ValidationUtils = {
  // 이메일 검증
  isEmail: (str) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(str);
  },

  // URL 검증
  isURL: (str) => {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  },

  // 빈 값 체크
  isEmpty: (value) => {
    if (value == null) return true;
    if (typeof value === "string") return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === "object") return Object.keys(value).length === 0;
    return false;
  },

  // 타입 체크
  isType: (value, type) => {
    const typeMap = {
      string: (v) => typeof v === "string",
      number: (v) => typeof v === "number" && !isNaN(v),
      boolean: (v) => typeof v === "boolean",
      array: (v) => Array.isArray(v),
      object: (v) => v !== null && typeof v === "object" && !Array.isArray(v),
      function: (v) => typeof v === "function",
      date: (v) => v instanceof Date
    };

    return typeMap[type] ? typeMap[type](value) : false;
  }
};

/**
 * ⚡ 함수 유틸리티
 */
const FunctionUtils = {
  // 디바운스
  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // 쓰로틀
  throttle: (func, limit) => {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  // 재시도 로직
  retry: async (fn, options = {}) => {
    const {
      retries = 3,
      delay = 1000,
      backoff = 2,
      onRetry = () => {}
    } = options;

    let lastError;

    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (i < retries - 1) {
          const waitTime = delay * Math.pow(backoff, i);
          onRetry(i + 1, waitTime, error);
          await TimeUtils.delay(waitTime);
        }
      }
    }

    throw lastError;
  },

  // 메모이제이션
  memoize: (fn) => {
    const cache = new Map();
    return (...args) => {
      const key = JSON.stringify(args);
      if (cache.has(key)) {
        return cache.get(key);
      }
      const result = fn(...args);
      cache.set(key, result);
      return result;
    };
  }
};

/**
 * 📊 통계 유틸리티
 */
const StatsUtils = {
  // 평균
  average: (numbers) => {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  },

  // 중앙값
  median: (numbers) => {
    if (numbers.length === 0) return 0;
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  },

  // 퍼센타일
  percentile: (numbers, p) => {
    if (numbers.length === 0) return 0;
    const sorted = [...numbers].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (lower === upper) return sorted[lower];
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }
};

// 모든 유틸리티 내보내기
module.exports = {
  TimeUtils,
  IdUtils,
  LogUtils,
  ObjectUtils,
  ArrayUtils,
  ValidationUtils,
  FunctionUtils,
  StatsUtils,

  // 자주 사용하는 것들은 직접 내보내기
  delay: TimeUtils.delay,
  generateId: IdUtils.generateId,
  log: LogUtils,
  deepClone: ObjectUtils.deepClone,
  isEmpty: ValidationUtils.isEmpty,
  retry: FunctionUtils.retry
};
