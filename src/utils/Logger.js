// src/utils/Logger.js - 통일된 로깅 시스템

class Logger {
  constructor() {
    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4,
    };

    this.emojis = {
      error: "❌",
      warn: "⚠️",
      info: "ℹ️",
      debug: "🐛",
      trace: "🔍",
      success: "✅",
    };

    this.currentLevel = this.logLevels.info;
  }

  // ✅ 통일된 시간 포맷
  getTimestamp() {
    const now = new Date();
    const koreaTime = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Seoul" })
    );
    return koreaTime.toISOString().replace("T", " ").substring(0, 19);
  }

  // ✅ 통일된 로그 포맷
  formatLog(level, message, metadata = {}) {
    const timestamp = this.getTimestamp();
    const emoji = this.emojis[level] || "";
    const levelUpper = level.toUpperCase().padEnd(5);

    let logMessage = `[${timestamp}] [${levelUpper}] ${emoji} ${message}`;

    // 메타데이터가 있으면 간단하게 추가
    if (metadata && Object.keys(metadata).length > 0) {
      const metaString = Object.entries(metadata)
        .map(([key, value]) => `${key}=${value}`)
        .join(", ");
      logMessage += ` | ${metaString}`;
    }

    return logMessage;
  }

  // ✅ 기본 로그 메서드들
  log(level, message, metadata = {}) {
    if (this.logLevels[level] > this.currentLevel) return;

    const formatted = this.formatLog(level, message, metadata);
    console.log(formatted);
  }

  error(message, metadata = {}) {
    this.log("error", message, metadata);
  }

  warn(message, metadata = {}) {
    this.log("warn", message, metadata);
  }

  info(message, metadata = {}) {
    this.log("info", message, metadata);
  }

  debug(message, metadata = {}) {
    this.log("debug", message, metadata);
  }

  success(message, metadata = {}) {
    this.log("success", message, metadata);
  }

  // ✅ 모듈별 로깅 (통일된 형식)
  module(moduleName, event, metadata = {}) {
    const message = `🔧 모듈 ${moduleName}: ${event}`;
    this.info(message, metadata);
  }

  // ✅ 사용자 액션 로깅
  userAction(userId, action, metadata = {}) {
    const message = `👤 사용자 ${userId}: ${action}`;
    this.info(message, metadata);
  }

  // ✅ 봇 이벤트 로깅
  botEvent(event, metadata = {}) {
    const message = `🤖 봇 이벤트: ${event}`;
    this.info(message, metadata);
  }

  // ✅ 성능 측정
  startTimer(label) {
    const start = process.hrtime.bigint();

    return {
      end: (metadata = {}) => {
        const end = process.hrtime.bigint();
        const duration = Number(end - start) / 1000000; // ms

        this.info(`⏱️ ${label}`, {
          duration: `${duration.toFixed(2)}ms`,
          ...metadata,
        });

        return duration;
      },
    };
  }

  // ✅ API 호출 로깅
  apiCall(service, endpoint, status, responseTime, metadata = {}) {
    const level = status >= 400 ? "error" : status >= 300 ? "warn" : "info";
    const message = `🌐 API ${service}/${endpoint}`;

    this.log(level, message, {
      status,
      responseTime: `${responseTime}ms`,
      ...metadata,
    });
  }

  // ✅ 레벨 설정
  setLevel(level) {
    if (Object.prototype.hasOwnProperty.call(this.logLevels, level)) {
      this.currentLevel = this.logLevels[level];
      this.info(`로그 레벨 변경: ${level}`);
    }
  }
}

// 싱글톤 인스턴스
const logger = new Logger();
module.exports = logger;
