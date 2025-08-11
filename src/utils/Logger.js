// src/utils/Logger.js - 환경별 로거 자동 선택 시스템

const chalk = require("chalk");

/**
 * HybridLogger - 환경별 최적화된 로깅 시스템
 *
 * 로컬/개발: Chalk (컬러풀한 콘솔 로깅)
 * 프로덕션: Winston (구조화된 로그 파일)
 * Railway: Winston + 클라우드 최적화
 */
class HybridLogger {
  constructor() {
    this.environment = this.detectEnvironment();
    this.version = "2.0.0";
    this.startTime = Date.now();

    // 환경별 로거 초기화
    this.initializeLogger();

    // 개인정보 보호 설정
    this.privacyConfig = {
      enablePrivacyMode: process.env.PRIVACY_MODE !== "false",
      logUserIds: process.env.LOG_USER_IDS === "true",
      logUserNames: process.env.LOG_USER_NAMES !== "false",
      logFullNames: process.env.LOG_FULL_NAMES === "true",
      anonymizeProduction: this.environment.isProduction,
      enableDataMasking: true,
      retentionDays: parseInt(process.env.LOG_RETENTION_DAYS) || 30,
      devMode: process.env.DEV_MODE === "true",
      devUsers: new Set(
        (process.env.DEV_USERS || "").split(",").filter(Boolean)
      )
    };

    // 통계
    this.stats = {
      totalLogs: 0,
      maskedData: 0,
      errors: 0,
      warnings: 0
    };

    // 민감 데이터 패턴
    this.sensitivePatterns = [
      /\b\d{9,12}\b/g, // 사용자 ID
      /\d{10}:[\w-]{35}/g, // 텔레그램 토큰
      /Bearer\s+[\w-]+/gi, // Bearer 토큰
      /password['":][\s]*["'][^"']+["']/gi, // 패스워드
      /token['":][\s]*["'][^"']+["']/gi, // 토큰
      /mongodb:\/\/[^@]+@/gi, // MongoDB URI
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g // 이메일
    ];

    // 시스템 키워드 (마스킹 제외)
    this.systemKeywords = new Set([
      "시작",
      "초기화",
      "완료",
      "성공",
      "실패",
      "오류",
      "연결",
      "로딩",
      "처리",
      "전송",
      "수신",
      "생성",
      "삭제",
      "업데이트",
      "조회",
      "저장",
      "봇",
      "모듈",
      "서비스",
      "데이터베이스",
      "시스템",
      "환경",
      "설정"
    ]);

    // 무지개 색상 (특별한 경우에만 사용)
    this.rainbowColors = ["red", "yellow", "green", "cyan", "blue", "magenta"];

    // 초기화 완료 메시지
    this.showInitializationMessage();
  }

  /**
   * 환경 감지
   */
  detectEnvironment() {
    const nodeEnv = process.env.NODE_ENV || "development";
    const isRailway = !!process.env.RAILWAY_ENVIRONMENT;
    const isDocker = !!process.env.DOCKER_CONTAINER;
    const isCI = !!process.env.CI;

    const isProduction = nodeEnv === "production";
    const isDevelopment =
      nodeEnv === "development" || !nodeEnv || nodeEnv === "dev";
    const isTest = nodeEnv === "test";

    // 로거 선택 로직
    let useLogger = "chalk"; // 기본값

    // 1. 강제 설정 확인 (최우선)
    const forceLogger = process.env.FORCE_LOGGER;
    if (forceLogger === "winston" || forceLogger === "chalk") {
      useLogger = forceLogger;
    }
    // 2. 프로덕션/Railway는 Winston
    else if (isProduction || isRailway) {
      useLogger = "winston";
    }
    // 3. 나머지는 Chalk
    else {
      useLogger = "chalk";
    }

    return {
      name: nodeEnv,
      isProduction,
      isDevelopment,
      isTest,
      isRailway,
      isDocker,
      isCI,
      useLogger
    };
  }

  /**
   * 로거 초기화
   */
  initializeLogger() {
    if (this.environment.useLogger === "winston") {
      this.initializeWinston();
    }
  }

  /**
   * Winston 로거 초기화 (프로덕션용)
   */
  initializeWinston() {
    const winston = require("winston");
    const path = require("path");

    // 로그 디렉토리 생성
    const logDir = path.join(process.cwd(), "logs");
    require("fs").mkdirSync(logDir, { recursive: true });

    // 로그 포맷 정의
    const logFormat = winston.format.combine(
      winston.format.timestamp({
        format: () => {
          const now = new Date();
          const kstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
          return kstTime.toISOString().replace("T", " ").substring(0, 19);
        }
      }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        // 개인정보 마스킹 적용
        const safeMessage = this.isSystemMessage(message)
          ? message
          : this.maskSensitiveData(message);

        let logLine = `${timestamp} [${level.toUpperCase().padEnd(7)}] ${safeMessage}`;

        if (stack) {
          logLine += `\n  스택: ${this.maskSensitiveData(stack)}`;
        }

        if (Object.keys(meta).length > 0) {
          logLine += `\n  메타: ${JSON.stringify(this.maskObjectData(meta))}`;
        }

        return logLine;
      })
    );

    // Winston 인스턴스 생성
    this.winston = winston.createLogger({
      level:
        process.env.LOG_LEVEL ||
        (this.environment.isProduction ? "info" : "debug"),
      format: logFormat,
      transports: [
        // 콘솔 출력
        new winston.transports.Console({
          format: winston.format.combine(winston.format.colorize(), logFormat)
        }),
        // 파일 출력 (Railway가 아닌 경우)
        ...(!this.environment.isRailway
          ? [
              new winston.transports.File({
                filename: path.join(logDir, "doomock-bot.log"),
                level: "info",
                maxsize: 10 * 1024 * 1024, // 10MB
                maxFiles: 5,
                tailable: true
              }),
              new winston.transports.File({
                filename: path.join(logDir, "error.log"),
                level: "error",
                maxsize: 10 * 1024 * 1024, // 10MB
                maxFiles: 3,
                tailable: true
              })
            ]
          : [])
      ],
      exitOnError: false
    });

    // Winston 에러 핸들링
    this.winston.on("error", (error) => {
      console.error("Winston Logger Error:", error);
    });
  }

  /**
   * 초기화 메시지 표시
   */
  showInitializationMessage() {
    const envIcon = this.environment.isProduction
      ? "🏭"
      : this.environment.isRailway
        ? "🚂"
        : this.environment.isDevelopment
          ? "🏠"
          : "🧪";

    if (this.environment.useLogger === "chalk") {
      // 간단한 로거 정보만 표시 (메인 배너는 FancyBanner에서 처리)
      console.log(
        chalk.green.bold(`  ${envIcon} Logger v${this.version} 초기화`)
      );
      console.log(
        chalk.cyan(
          `  📍 환경: ${this.environment.name} (${this.environment.useLogger})`
        )
      );
      console.log(
        chalk.yellow(
          `  🛡️  개인정보 보호: ${this.privacyConfig.enablePrivacyMode ? "활성화" : "비활성화"}`
        )
      );
      console.log();
    } else {
      // Winston 환경에서는 간단하게
      console.log(
        `${envIcon} Logger v${this.version} 시작 - ${this.environment.name} 환경 (${this.environment.useLogger})`
      );
    }
  }

  /**
   * 메인 로깅 메서드
   */
  log(level, message, meta = null) {
    this.stats.totalLogs++;

    if (this.environment.useLogger === "winston" && this.winston) {
      this.winston.log(level, message, meta);
    } else {
      this.logWithChalk(level, message, meta);
    }
  }

  /**
   * Chalk 로깅 (개발 환경용)
   */
  logWithChalk(level, message, meta) {
    const timestamp = this.getTimestamp();
    const safeMessage = this.isSystemMessage(message)
      ? message
      : this.maskSensitiveData(message);

    const levelConfig = {
      error: { color: chalk.red, emoji: "❌" },
      warn: { color: chalk.yellow, emoji: "⚠️" },
      info: { color: chalk.cyan, emoji: "ℹ️" },
      success: { color: chalk.green, emoji: "✅" },
      debug: { color: chalk.gray, emoji: "🔍" }
    };

    const config = levelConfig[level] || { color: chalk.white, emoji: "📝" };

    console.log(
      chalk.gray(timestamp) +
        " " +
        config.emoji +
        " " +
        config.color(`[${level.toUpperCase().padEnd(7)}]`) +
        " " +
        config.color(safeMessage)
    );

    if (meta) {
      const maskedMeta = this.maskObjectData(meta);
      console.log(
        chalk.gray(
          "  └─ " +
            JSON.stringify(maskedMeta, null, 2).replace(/\n/g, "\n     ")
        )
      );
    }
  }

  // ===== 표준 로깅 메서드들 =====

  info(message, meta = null) {
    this.log("info", message, meta);
  }

  // 수정된 success 메서드
  success(message, meta = null) {
    if (this.environment.useLogger === "winston" && this.winston) {
      // Winston에서는 info 레벨로 처리
      this.winston.info(`✅ ${message}`, meta);
    } else {
      // Chalk에서는 기존대로
      this.logWithChalk("success", message, meta);
    }
  }

  warn(message, meta = null) {
    this.stats.warnings++;
    this.log("warn", message, meta);
  }

  error(message, error = null) {
    this.stats.errors++;

    if (error instanceof Error) {
      this.log("error", message, {
        error: error.message,
        stack: error.stack
      });
    } else if (error) {
      this.log("error", message, { error });
    } else {
      this.log("error", message);
    }
  }

  debug(message, meta = null) {
    this.log("debug", message, meta);
  }

  // ===== 특별한 로깅 메서드 (무지개는 여기만!) =====

  /**
   * 정말 특별한 축하 메시지용 무지개 효과
   * @param {string} message - 축하 메시지
   * @param {boolean} useRainbow - 무지개 효과 사용 여부 (기본값: false)
   */
  celebration(message, useRainbow = false) {
    if (useRainbow && this.environment.useLogger === "chalk") {
      // 진짜 특별한 경우에만 무지개!
      let coloredMessage = "";
      const colors = this.rainbowColors;

      for (let i = 0; i < message.length; i++) {
        const colorIndex = i % colors.length;
        coloredMessage += chalk[colors[colorIndex]](message[i]);
      }

      console.log(`🎉 ${coloredMessage} 🎉`);
    } else {
      // 일반적인 축하 메시지
      this.success(`🎉 ${message} 🎉`);
    }
  }

  // ===== 유틸리티 메서드들 =====

  getTimestamp() {
    const now = new Date();
    const kstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kstTime.toISOString().replace("T", " ").substring(0, 19);
  }

  isSystemMessage(message) {
    if (typeof message !== "string") return false;

    for (const keyword of this.systemKeywords) {
      if (message.includes(keyword)) return true;
    }

    const systemPatterns = [
      /^\[.*\]/,
      /^🎯|^🔄|^✅|^❌|^📊|^🔧|^🚀/,
      /Logger|Module|Service|Bot|Controller|Handler/i
    ];

    return systemPatterns.some((pattern) => pattern.test(message));
  }

  maskSensitiveData(text) {
    if (typeof text !== "string") return text;

    let maskedText = text;
    let maskedCount = 0;

    this.sensitivePatterns.forEach((pattern) => {
      const matches = maskedText.match(pattern);
      if (matches) {
        maskedCount += matches.length;
        maskedText = maskedText.replace(pattern, "***MASKED***");
      }
    });

    if (maskedCount > 0) {
      this.stats.maskedData += maskedCount;
    }

    return maskedText;
  }

  maskObjectData(obj) {
    if (!obj || typeof obj !== "object") return obj;

    const masked = JSON.parse(JSON.stringify(obj));
    const sensitiveKeys = [
      "password",
      "token",
      "key",
      "secret",
      "userId",
      "id",
      "email"
    ];

    const maskRecursive = (target) => {
      if (!target || typeof target !== "object") return target;

      for (const key of Object.keys(target)) {
        const lowerKey = key.toLowerCase();
        const value = target[key];

        if (
          sensitiveKeys.some((sensitiveKey) => lowerKey.includes(sensitiveKey))
        ) {
          if (typeof value === "string" || typeof value === "number") {
            target[key] = "***MASKED***";
            this.stats.maskedData++;
          }
        }

        if (typeof value === "object" && value !== null) {
          maskRecursive(value);
        }
      }

      return target;
    };

    return maskRecursive(masked);
  }

  safifyUserId(userId) {
    if (!userId) return "unknown";

    if (
      !this.privacyConfig.enablePrivacyMode &&
      this.privacyConfig.logUserIds &&
      !this.privacyConfig.anonymizeProduction
    ) {
      return userId.toString();
    }

    const idStr = userId.toString();
    if (idStr.length <= 3) return `U***`;
    if (idStr.length <= 5) return `U${idStr[1]}***`;
    return `${idStr.slice(0, 2)}***${idStr.slice(-1)}`;
  }

  safifyUserName(input) {
    try {
      let user = null;
      if (input?.from) user = input.from;
      else if (input?.message?.from) user = input.message.from;
      else if (input?.id) user = input;

      if (!user) return "Unknown";
      if (user.is_bot) return `[봇]${user.first_name || "Bot"}`;

      if (user.first_name) {
        if (this.privacyConfig.anonymizeProduction) {
          return this.anonymizeName(user.first_name);
        }
        return user.first_name;
      }

      return `User#${this.safifyUserId(user.id)}`;
    } catch (error) {
      return "Unknown";
    }
  }

  anonymizeName(name) {
    if (!name || typeof name !== "string") return "User";
    const trimmedName = name.trim();

    if (trimmedName.length <= 1) return "U";
    if (trimmedName.length <= 2) return `${trimmedName[0]}*`;

    // 한글 이름
    if (/^[가-힣]+$/.test(trimmedName)) {
      if (trimmedName.length === 2) return `${trimmedName[0]}*`;
      if (trimmedName.length === 3) return `${trimmedName[0]}**`;
      return `${trimmedName[0]}***`;
    }

    // 영문 이름
    if (/^[a-zA-Z]+$/.test(trimmedName)) {
      if (trimmedName.length <= 4) return `${trimmedName[0]}***`;
      return `${trimmedName.slice(0, 2)}***`;
    }

    return `${trimmedName[0]}***`;
  }

  // ===== 도메인별 로깅 메서드들 =====

  module(moduleName, message, data = null) {
    this.info(`[${moduleName}] ${message}`, data);
  }

  system(message, data = null) {
    this.info(`[SYSTEM] ${message}`, data);
  }

  database(message, data = null) {
    this.info(`[DATABASE] ${message}`, data);
  }

  startup(message, data = null) {
    this.success(`[STARTUP] ${message}`, data);
  }

  userAction(action, input, details = null) {
    const userName = this.safifyUserName(input);
    this.info(`[USER] ${action}: ${userName}`, details);
  }

  moduleAction(moduleName, action, input, details = null) {
    const userName = this.safifyUserName(input);
    this.info(`[${moduleName}] ${action}: ${userName}`, details);
  }

  fortuneLog(action, input, cardInfo = null) {
    const userName = this.safifyUserName(input);
    let message = `🔮 [FORTUNE] ${action}: ${userName}`;

    if (cardInfo) {
      if (typeof cardInfo === "string") {
        message += ` - ${cardInfo}`;
      } else if (cardInfo.cardName) {
        message += ` - ${cardInfo.cardName}`;
        if (cardInfo.isReversed !== undefined) {
          message += ` (${cardInfo.isReversed ? "역방향" : "정방향"})`;
        }
      }
    }

    this.info(message);
  }

  // ===== 모니터링 메서드들 =====

  getStats() {
    return {
      ...this.stats,
      environment: this.environment.name,
      loggerType: this.environment.useLogger,
      uptime: Date.now() - this.startTime,
      errorRate:
        this.stats.totalLogs > 0
          ? ((this.stats.errors / this.stats.totalLogs) * 100).toFixed(2) + "%"
          : "0%"
    };
  }

  showStats() {
    const stats = this.getStats();
    const statsMessage = `📊 Logger 통계: ${stats.totalLogs}개 로그, 에러율 ${stats.errorRate}`;

    if (this.environment.useLogger === "chalk") {
      console.log(chalk.cyan("\n" + statsMessage));
      console.log(chalk.gray(`   환경: ${stats.environment}`));
      console.log(chalk.gray(`   로거: ${stats.loggerType}`));
      console.log(chalk.gray(`   마스킹: ${stats.maskedData}개`));
    } else {
      console.log(statsMessage);
    }
  }

  // ===== 정리 작업 =====

  async cleanup() {
    if (this.winston) {
      await new Promise((resolve) => {
        this.winston.close(resolve);
      });
    }

    this.info("🧹 HybridLogger 정리 완료");
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
const hybridLogger = new HybridLogger();
module.exports = hybridLogger;
