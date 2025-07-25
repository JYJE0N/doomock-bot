// src/utils/Logger.js - 통합 로깅 시스템
const winston = require("winston");
const chalk = require("chalk");
const path = require("path");

/**
 * 📊 Logger - 통합 로깅 시스템
 *
 * 비유: 공장의 품질 검사 일지처럼
 * - 모든 작업을 기록하고
 * - 문제가 생기면 즉시 알려주며
 * - 나중에 원인을 추적할 수 있게 해줍니다
 *
 * 특징:
 * - 색상 구분된 콘솔 출력
 * - 파일 로깅 지원
 * - Railway 환경 최적화
 * - 한국 시간 자동 적용
 */
class Logger {
  constructor() {
    this.isProduction = process.env.NODE_ENV === "production";
    this.isRailway = process.env.RAILWAY_ENVIRONMENT !== undefined;

    // 로그 레벨 설정
    this.logLevel =
      process.env.LOG_LEVEL || (this.isProduction ? "info" : "debug");

    // Winston 로거 생성
    this.winston = this.createWinstonLogger();

    // 이모지 맵핑
    this.emojiMap = {
      error: "❌",
      warn: "⚠️",
      info: "📊",
      success: "✅",
      debug: "🔍",
      verbose: "💬",
    };

    // 색상 맵핑
    this.colorMap = {
      error: chalk.red,
      warn: chalk.yellow,
      info: chalk.blue,
      success: chalk.green,
      debug: chalk.gray,
      verbose: chalk.cyan,
    };
  }

  /**
   * Winston 로거 생성
   */
  createWinstonLogger() {
    const formats = [];

    // 타임스탬프 추가 (한국 시간)
    formats.push(
      winston.format.timestamp({
        format: () => {
          const now = new Date();
          const kstOffset = 9 * 60 * 60 * 1000;
          const kstTime = new Date(now.getTime() + kstOffset);
          return kstTime.toISOString().replace("T", " ").slice(0, -1);
        },
      })
    );

    // 기본 포맷
    formats.push(winston.format.json());

    // 프로덕션이 아닌 경우 예쁜 출력
    if (!this.isProduction) {
      formats.push(winston.format.prettyPrint());
    }

    const transports = [];

    // 콘솔 출력
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const emoji = this.emojiMap[level] || "📝";
            const metaStr = Object.keys(meta).length
              ? JSON.stringify(meta, null, 2)
              : "";
            return `${timestamp} ${emoji} [${level}] ${message} ${metaStr}`;
          })
        ),
      })
    );

    // 파일 출력 (프로덕션 환경)
    if (this.isProduction || process.env.LOG_TO_FILE === "true") {
      // 에러 로그
      transports.push(
        new winston.transports.File({
          filename: "logs/error.log",
          level: "error",
          maxsize: 10485760, // 10MB
          maxFiles: 5,
        })
      );

      // 전체 로그
      transports.push(
        new winston.transports.File({
          filename: "logs/combined.log",
          maxsize: 10485760, // 10MB
          maxFiles: 10,
        })
      );
    }

    return winston.createLogger({
      level: this.logLevel,
      format: winston.format.combine(...formats),
      transports,
      exitOnError: false,
    });
  }

  /**
   * 기본 로그 메서드
   */
  log(level, message, ...args) {
    // 객체 처리
    const meta = {};
    const messages = [message];

    args.forEach((arg) => {
      if (typeof arg === "object" && arg !== null) {
        Object.assign(meta, arg);
      } else {
        messages.push(arg);
      }
    });

    const fullMessage = messages.join(" ");

    // Winston 로깅
    this.winston.log(level, fullMessage, meta);

    // 개발 환경에서 예쁜 콘솔 출력
    if (!this.isProduction && !this.isRailway) {
      const color = this.colorMap[level] || chalk.white;
      const emoji = this.emojiMap[level] || "📝";
      console.log(color(`${emoji} ${fullMessage}`));

      if (Object.keys(meta).length > 0) {
        console.log(chalk.gray(JSON.stringify(meta, null, 2)));
      }
    }
  }

  // 편의 메서드들
  error(message, ...args) {
    this.log("error", message, ...args);
  }

  warn(message, ...args) {
    this.log("warn", message, ...args);
  }

  info(message, ...args) {
    this.log("info", message, ...args);
  }

  success(message, ...args) {
    this.log("info", `✅ ${message}`, ...args);
  }

  debug(message, ...args) {
    this.log("debug", message, ...args);
  }

  verbose(message, ...args) {
    this.log("verbose", message, ...args);
  }

  /**
   * 함수 실행 시간 측정
   */
  async time(label, fn) {
    const start = Date.now();
    this.debug(`⏱️ ${label} 시작...`);

    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.success(`${label} 완료 (${duration}ms)`);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(`${label} 실패 (${duration}ms):`, error.message);
      throw error;
    }
  }

  /**
   * 메모리 사용량 로깅
   */
  logMemory() {
    const used = process.memoryUsage();
    const mb = (bytes) => Math.round((bytes / 1024 / 1024) * 100) / 100;

    this.info("💾 메모리 사용량:", {
      rss: `${mb(used.rss)}MB`,
      heapTotal: `${mb(used.heapTotal)}MB`,
      heapUsed: `${mb(used.heapUsed)}MB`,
      external: `${mb(used.external)}MB`,
    });
  }

  /**
   * 시스템 상태 로깅
   */
  logSystemStatus() {
    this.info("🖥️ 시스템 상태:", {
      환경: this.isProduction ? "프로덕션" : "개발",
      Railway: this.isRailway ? "예" : "아니오",
      로그레벨: this.logLevel,
      업타임: `${Math.floor(process.uptime())}초`,
      노드버전: process.version,
      플랫폼: process.platform,
    });
  }
}

// 싱글톤 인스턴스
const logger = new Logger();

module.exports = logger;
