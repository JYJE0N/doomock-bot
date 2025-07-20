// src/utils/Logger.js - TimeHelper 사용으로 수정
class Logger {
  constructor() {
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

    // ✅ TimeHelper 사용 (삭제된 KoreaTimeManager 대신)
    const { TimeHelper } = require("./TimeHelper");
    const timestamp = TimeHelper.getLogTimeString();

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

  // 기존 코드 호환성
  trace(...args) {
    this._log("debug", ...args);
  }
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

const logger = new Logger();
module.exports = logger;
