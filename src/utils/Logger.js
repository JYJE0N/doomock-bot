// src/utils/Logger.js - 두목봇 v3.0.1 Winston + Chalk 로거
const winston = require("winston");
const chalk = require("chalk");
const path = require("path");
const fs = require("fs");

/**
 * 🎨 두목봇 전용 고급 로깅 시스템
 * - Winston + Chalk 조합
 * - 기존 코드와 100% 호환
 * - Railway 환경 최적화
 * - 한국 시간 지원
 */
class DoomockLogger {
  constructor() {
    if (DoomockLogger.instance) {
      return DoomockLogger.instance;
    }

    // 환경 설정
    this.isProduction = process.env.NODE_ENV === "production";
    this.isRailway = !!process.env.RAILWAY_ENVIRONMENT;
    this.logLevel =
      process.env.LOG_LEVEL || (this.isProduction ? "info" : "debug");

    // 색상 지원 강제 활성화
    if (process.env.FORCE_COLOR !== "0") {
      chalk.level = 3;
    }

    // 로그 디렉토리 (Railway에서는 사용 안 함)
    if (!this.isRailway) {
      this.logDir = process.env.LOG_DIR || "logs";
      this.ensureLogDirectory();
    }

    // Winston 로거 생성
    this.winston = this.createWinstonLogger();

    // 색상 테마
    this.colors = {
      error: chalk.bold.red,
      warn: chalk.bold.yellow,
      info: chalk.bold.cyan,
      debug: chalk.gray,
      success: chalk.bold.green,
      timestamp: chalk.dim.gray,
      module: chalk.bold.blue,
      user: chalk.bold.magenta,
    };

    // 이모지 (기존 코드 호환)
    this.emojis = {
      error: "❌",
      warn: "⚠️",
      info: "ℹ️",
      debug: "🐛",
      success: "✅",
    };

    // 레벨 매핑 (기존 코드 호환)
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      success: 4,
    };
    this.currentLevel = this.levels[this.logLevel] || this.levels.info;

    DoomockLogger.instance = this;
  }

  /**
   * 로그 디렉토리 생성
   */
  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Winston 로거 생성
   */
  createWinstonLogger() {
    const transports = [];

    // 콘솔 Transport
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            return `${timestamp} [${level}] ${message} ${
              Object.keys(meta).length ? JSON.stringify(meta) : ""
            }`;
          })
        ),
        silent: false,
      })
    );

    // 파일 Transport (Railway 제외)
    if (!this.isRailway && !this.isProduction) {
      // 에러 로그
      transports.push(
        new winston.transports.File({
          filename: path.join(this.logDir, "error.log"),
          level: "error",
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        })
      );

      // 전체 로그
      transports.push(
        new winston.transports.File({
          filename: path.join(this.logDir, "combined.log"),
          maxsize: 10485760, // 10MB
          maxFiles: 10,
        })
      );
    }

    return winston.createLogger({
      level: "debug", // Winston은 항상 debug로, 필터링은 우리가 처리
      transports,
      exitOnError: false,
    });
  }

  /**
   * 한국 시간 가져오기 (기존 코드와 동일)
   */
  getKoreaTime() {
    const now = new Date();
    const koreaTime = new Date(
      now.getTime() + 9 * 60 * 60 * 1000 - now.getTimezoneOffset() * 60 * 1000
    );
    return koreaTime.toLocaleString("ko-KR");
  }

  /**
   * 기본 로그 메서드 (기존 _log와 호환)
   */
  _log(level, ...args) {
    // 레벨 체크 (기존 코드 호환)
    if (this.levels[level] > this.currentLevel) return;

    const timestamp = this.getKoreaTime();
    const emoji = this.emojis[level] || "📝";
    const color = this.colors[level] || chalk.white;

    // 메시지와 메타데이터 분리
    let message = "";
    let meta = {};

    args.forEach((arg) => {
      if (typeof arg === "object" && arg !== null && !Array.isArray(arg)) {
        Object.assign(meta, arg);
      } else {
        message += (message ? " " : "") + String(arg);
      }
    });

    // 콘솔 출력 (Chalk 사용)
    const timestampStr = this.colors.timestamp(`[${timestamp}]`);
    const levelStr = color(level.toUpperCase().padEnd(7));

    // 메타데이터 포맷팅
    let metaStr = "";
    if (Object.keys(meta).length > 0) {
      const formattedMeta = [];
      for (const [key, value] of Object.entries(meta)) {
        if (key === "module") {
          formattedMeta.push(this.colors.module(`${key}:${value}`));
        } else if (key === "userId" || key === "userName") {
          formattedMeta.push(this.colors.user(`${key}:${value}`));
        } else {
          formattedMeta.push(chalk.gray(`${key}:${value}`));
        }
      }
      metaStr =
        chalk.gray(" {") +
        formattedMeta.join(chalk.gray(", ")) +
        chalk.gray("}");
    }

    console.log(`${emoji} ${timestampStr} ${levelStr} ${message}${metaStr}`);

    // Winston에도 기록
    this.winston.log(level === "success" ? "info" : level, message, meta);
  }

  // ===== 기존 메서드들 (100% 호환) =====

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

  // 기존 코드 호환성 메서드들
  trace(...args) {
    this._log("debug", ...args);
  }

  logTimeInfo() {
    this.info("🕐 시간 정보 로딩 완료");
  }

  setLevel(level) {
    this.currentLevel = this.levels[level] || this.levels.info;
    this.winston.level = level === "success" ? "info" : level;
  }

  getStatus() {
    return {
      initialized: true,
      level: Object.keys(this.levels).find(
        (key) => this.levels[key] === this.currentLevel
      ),
      winston: {
        transports: this.winston.transports.length,
        level: this.winston.level,
      },
      chalk: {
        level: chalk.level,
        supportsColor: chalk.supportsColor,
      },
    };
  }

  // ===== 추가 유틸리티 메서드 =====

  /**
   * 모듈 시작 로그 (박스 스타일)
   */
  moduleStart(moduleName) {
    const boxWidth = moduleName.length + 10;
    const top = "┌" + "─".repeat(boxWidth) + "┐";
    const middle =
      "│" + chalk.bold.white(` 🚀 ${moduleName} 시작 `.padEnd(boxWidth)) + "│";
    const bottom = "└" + "─".repeat(boxWidth) + "┘";

    console.log(chalk.blue(`\n${top}\n${middle}\n${bottom}\n`));
    this.winston.info(`Module started: ${moduleName}`);
  }

  /**
   * 구분선
   */
  divider(char = "─", length = 50) {
    console.log(chalk.gray(char.repeat(length)));
  }

  /**
   * 테이블 출력
   */
  table(data) {
    console.table(data);
    this.winston.info("Table displayed", { rowCount: data.length });
  }

  /**
   * 메모리 사용량
   */
  memory() {
    const used = process.memoryUsage();
    const format = (bytes) => (bytes / 1024 / 1024).toFixed(2) + " MB";

    this.debug("💾 메모리 사용량", {
      rss: format(used.rss),
      heapTotal: format(used.heapTotal),
      heapUsed: format(used.heapUsed),
    });
  }
}

// 싱글톤 인스턴스 생성
const logger = new DoomockLogger();

// 개발 환경에서 시작 메시지
if (process.env.NODE_ENV !== "production") {
  logger.divider("=", 60);
  logger.success("🎨 두목봇 Logger 초기화 완료", {
    winston: logger.winston.transports.length + " transports",
    chalk: "level " + chalk.level,
    env: process.env.NODE_ENV || "development",
  });
  logger.divider("=", 60);
}

module.exports = logger;
