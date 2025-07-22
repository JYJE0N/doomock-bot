// src/utils/Logger.js - 순환 참조 해결 버전

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

    // ✅ TimeHelper 대신 직접 한국시간 계산
    const now = new Date();
    const koreaTime = new Date(
      now.getTime() + 9 * 60 * 60 * 1000 - now.getTimezoneOffset() * 60 * 1000
    );
    const timestamp = koreaTime.toLocaleString("ko-KR");

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
      level: Object.keys(this.levels).find(
        (key) => this.levels[key] === this.currentLevel
      ),
    };
  }
}

const logger = new Logger();
module.exports = logger;
