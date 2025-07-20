// src/utils/Logger.js - 완전 새로운 간단한 Logger

class Logger {
  constructor() {
    // 싱글톤 체크
    if (Logger.instance) {
      return Logger.instance;
    }

    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      success: 4,
    };

    this.currentLevel = this.levels.info;
    this.emojis = {
      error: "❌",
      warn: "⚠️",
      info: "ℹ️",
      debug: "🐛",
      success: "✅",
    };

    Logger.instance = this;
  }

  _log(level, ...args) {
    if (this.levels[level] > this.currentLevel) return;

    const timestamp = new Date().toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
    });

    const emoji = this.emojis[level] || "📝";
    console.log(`${emoji} [${timestamp}]`, ...args);
  }

  info(...args) {
    this._log("info", ...args);
  }
  error(...args) {
    this._log("error", ...args);
  }
  warn(...args) {
    this._log("warn", ...args);
  }
  debug(...args) {
    this._log("debug", ...args);
  }
  success(...args) {
    this._log("success", ...args);
  }

  setLevel(level) {
    this.currentLevel = this.levels[level] || this.levels.info;
  }

  // 기존 코드 호환성을 위한 추가 메서드들
  trace(...args) {
    this._log("debug", ...args);
  } // trace를 debug로 매핑
  logTimeInfo() {
    this.info("🕐 시간 정보 로딩 완료");
  }
  getStatus() {
    return {
      initialized: true,
      level: Object.keys(this.levels)[this.currentLevel],
    };
  }
}

// 인스턴스 생성 및 내보내기
const logger = new Logger();
module.exports = logger;
