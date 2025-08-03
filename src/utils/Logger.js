// src/utils/HybridLogger.js - 환경별 로거 자동 선택 시스템

const chalk = require("chalk");

/**
 * 🎨 HybridLogger - 환경별 최적화된 로깅 시스템
 *
 * 🏠 로컬/개발: Chalk (컬러풀한 콘솔 로깅)
 * 🏭 프로덕션: Winston (구조화된 로그 파일)
 * 🚂 Railway: Winston + 클라우드 최적화
 *
 * 마치 TPO(Time, Place, Occasion)에 맞는 옷차림처럼!
 */
class HybridLogger {
  constructor() {
    this.environment = this.detectEnvironment();
    this.version = "1.0.0 Hybrid";
    this.startTime = Date.now();

    // 환경별 로거 초기화
    this.initializeEnvironmentSpecificLogger();

    // 개인정보 보호 설정 (기존 유지)
    this.privacyConfig = {
      enablePrivacyMode: process.env.PRIVACY_MODE !== "false",
      logUserIds: process.env.LOG_USER_IDS === "true",
      logUserNames: process.env.LOG_USER_NAMES !== "false",
      logFullNames: process.env.LOG_FULL_NAMES === "true",
      anonymizeProduction: this.environment.isProduction,
      enableDataMasking: true,
      retentionDays: parseInt(process.env.LOG_RETENTION_DAYS) || 30,
      devMode: process.env.DEV_MODE === "true",
      devUsers: new Set((process.env.DEV_USERS || "").split(",").filter(Boolean))
    };

    // 통계
    this.stats = {
      totalLogs: 0,
      chalkLogs: 0,
      winstonLogs: 0,
      maskedData: 0,
      errors: 0,
      warnings: 0
    };

    // 민감 데이터 패턴 (기존과 동일)
    this.sensitivePatterns = [
      /\b\d{9,12}\b/g,
      /\d{10}:[\w-]{35}/g,
      /Bearer\s+[\w-]+/gi,
      /password['":][\s]*["'][^"']+["']/gi,
      /token['":][\s]*["'][^"']+["']/gi,
      /mongodb:\/\/[^@]+@/gi,
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
    ];

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

    // 초기화 완료 메시지
    this.showInitializationMessage();
  }

  /**
   * 🔍 환경 감지 (개선된 버전)
   */
  detectEnvironment() {
    const nodeEnv = process.env.NODE_ENV || "development";
    const isRailway = !!process.env.RAILWAY_ENVIRONMENT;
    const isDocker = !!process.env.DOCKER_CONTAINER;
    const isCI = !!process.env.CI;

    // 🎯 더 명확한 환경 판단
    const isProduction = nodeEnv === "production";
    const isDevelopment = nodeEnv === "development" || !nodeEnv || nodeEnv === "dev";
    const isTest = nodeEnv === "test";

    // ✅ 수정된 로거 선택 로직 - 개발환경 최우선!
    let shouldUseWinston = false;
    let shouldUseChalk = false;

    // 1️⃣ 강제 설정 확인 (최우선)
    const forceLogger = process.env.FORCE_LOGGER;
    if (forceLogger === "chalk") {
      shouldUseChalk = true;
    } else if (forceLogger === "winston") {
      shouldUseWinston = true;
    } else {
      // 2️⃣ 환경별 자동 선택
      if (isProduction || isRailway) {
        // 🏭 프로덕션/Railway: Winston 사용
        shouldUseWinston = true;
      } else {
        // 🏠 개발/테스트: Chalk 사용 (Docker/CI 무시!)
        shouldUseChalk = true;
      }
    }

    return {
      name: nodeEnv,
      isProduction,
      isDevelopment,
      isTest,
      isRailway,
      isDocker,
      isCI,
      shouldUseWinston,
      shouldUseChalk
    };
  }

  /**
   * 🎨 환경별 로거 초기화
   */
  initializeEnvironmentSpecificLogger() {
    if (this.environment.shouldUseWinston) {
      this.initializeWinston();
    }

    if (this.environment.shouldUseChalk) {
      this.initializeChalk();
    }
  }

  /**
   * 📝 Winston 로거 초기화 (프로덕션용) - 알록달록 버전! 🎨
   */
  initializeWinston() {
    const winston = require("winston");
    const path = require("path");

    // 🌈 커스텀 로그 레벨 정의 (더 많은 레벨!)
    const customLevels = {
      levels: {
        error: 0,
        warn: 1,
        info: 2,
        success: 3,
        debug: 4,
        celebration: 5 // 🎉 축하 레벨 추가!
      },
      colors: {
        error: "red bold",
        warn: "yellow bold",
        info: "cyan",
        success: "green bold",
        debug: "gray",
        celebration: "rainbow" // 🌈 무지개 색상!
      }
    };

    /**
     * 📊 현재 문제가 있는 코드
     */
    class Logger_Problem {
      detectEnvironment() {
        const nodeEnv = process.env.NODE_ENV || "development";
        const isRailway = !!process.env.RAILWAY_ENVIRONMENT;
        const isDocker = !!process.env.DOCKER_CONTAINER;
        const isCI = !!process.env.CI;

        const isProduction = nodeEnv === "production";
        const isDevelopment = nodeEnv === "development" || !nodeEnv || nodeEnv === "dev";
        const isTest = nodeEnv === "test";

        return {
          // ❌ 문제: Docker나 CI에서도 Winston이 강제 활성화됨
          shouldUseWinston: isProduction || isRailway,
          shouldUseChalk: !isProduction && !isRailway
        };
      }
    }

    /**
     * ✅ 수정된 환경 감지 로직
     */
    class Logger_Fixed {
      detectEnvironment() {
        const nodeEnv = process.env.NODE_ENV || "development";
        const isRailway = !!process.env.RAILWAY_ENVIRONMENT;
        const isDocker = !!process.env.DOCKER_CONTAINER;
        const isCI = !!process.env.CI;

        // 🎯 명시적인 환경 우선순위
        const isProduction = nodeEnv === "production";
        const isDevelopment = nodeEnv === "development" || !nodeEnv || nodeEnv === "dev";
        const isTest = nodeEnv === "test";

        // 🎯 로거 전략 - 개발환경을 최우선으로!
        let shouldUseWinston, shouldUseChalk;

        if (isProduction) {
          // 🏭 프로덕션: 무조건 Winston
          shouldUseWinston = true;
          shouldUseChalk = false;
        } else if (isRailway) {
          // 🚂 Railway: 프로덕션 배포이므로 Winston
          shouldUseWinston = true;
          shouldUseChalk = false;
        } else if (isDevelopment) {
          // 🏠 개발환경: 무조건 Chalk (Docker/CI 무시!)
          shouldUseWinston = false;
          shouldUseChalk = true;
        } else if (isTest) {
          // 🧪 테스트: 간단한 출력
          shouldUseWinston = false;
          shouldUseChalk = true;
        } else {
          // 🤷‍♂️ 알 수 없는 환경: 안전하게 Winston
          shouldUseWinston = true;
          shouldUseChalk = false;
        }

        return {
          name: nodeEnv,
          isProduction,
          isDevelopment,
          isTest,
          isRailway,
          isDocker,
          isCI,
          shouldUseWinston,
          shouldUseChalk
        };
      }
    }

    // 로그 디렉토리 생성
    const logDir = path.join(process.cwd(), "logs");
    require("fs").mkdirSync(logDir, { recursive: true });

    // 🎨 알록달록 커스텀 포맷 정의
    const colorfulFormat = winston.format.combine(
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

        // 🎯 레벨별 이모지 추가
        const levelEmojis = {
          error: "💥",
          warn: "⚠️ ",
          info: "📝",
          success: "✅",
          debug: "🔍",
          celebration: "🎉"
        };

        const emoji = levelEmojis[level] || "📄";
        let logLine = `${timestamp} ${emoji} [${level.toUpperCase().padEnd(11)}] ${safeMessage}`;

        if (stack) {
          logLine += `\n  📚 스택: ${this.maskSensitiveData(stack)}`;
        }

        if (Object.keys(meta).length > 0) {
          logLine += `\n  📊 메타: ${JSON.stringify(this.maskObjectData(meta))}`;
        }

        return logLine;
      })
    );

    // 🎨 파일용 심플 포맷 (이모지 없이)
    const fileFormat = winston.format.combine(
      winston.format.timestamp({
        format: () => {
          const now = new Date();
          const kstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
          return kstTime.toISOString().replace("T", " ").substring(0, 19);
        }
      }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
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

    // 환경별 설정
    const transports = [];

    // 🎨 알록달록 콘솔 출력!
    transports.push(
      new winston.transports.Console({
        level: this.environment.isRailway ? "info" : "debug",
        format: winston.format.combine(
          winston.format.colorize({ all: true, colors: customLevels.colors }), // 🌈 모든 것을 컬러화!
          colorfulFormat
        ),
        // 🎯 콘솔에서만 색깔 강제 활성화
        forceColor: true
      })
    );

    // 파일 출력 (Railway가 아닌 경우)
    if (!this.environment.isRailway) {
      // 일반 로그 파일 (색깔 없이)
      transports.push(
        new winston.transports.File({
          filename: path.join(logDir, "doomock-bot.log"),
          level: "info",
          format: fileFormat,
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
          tailable: true
        })
      );

      // 에러 로그 파일
      transports.push(
        new winston.transports.File({
          filename: path.join(logDir, "error.log"),
          level: "error",
          format: fileFormat,
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 3,
          tailable: true
        })
      );
    }

    this.winston = winston.createLogger({
      levels: customLevels.levels,
      level: process.env.LOG_LEVEL || (this.environment.isProduction ? "info" : "debug"),
      format: colorfulFormat,
      transports,
      exitOnError: false
    });

    // 🌈 Winston 무지개 색상 적용!
    winston.addColors(customLevels.colors);

    // Winston 에러 핸들링
    this.winston.on("error", (error) => {
      console.error("🚨 Winston Logger Error:", error);
    });
  }

  /**
   * 🎨 Chalk 설정 (개발용)
   */
  initializeChalk() {
    this.rainbowColors = ["red", "yellow", "green", "cyan", "blue", "magenta"];
  }

  /**
   * 🎯 환경별 로깅 라우터
   */
  log(level, message, meta = null) {
    this.stats.totalLogs++;

    if (this.environment.shouldUseWinston && this.winston) {
      this.stats.winstonLogs++;
      this.winston.log(level, message, meta);
    }

    if (this.environment.shouldUseChalk) {
      this.stats.chalkLogs++;
      this.logWithChalk(level, message, meta);
    }
  }

  /**
   * 🎨 Chalk 로깅 (개발 환경용)
   */
  logWithChalk(level, message, meta) {
    const timestamp = this.getTimestamp();
    const safeMessage = this.isSystemMessage(message)
      ? message
      : this.maskSensitiveData(message);

    let colorFn;
    let levelLabel;

    switch (level) {
      case "error":
        colorFn = chalk.red;
        levelLabel = "ERROR";
        break;
      case "warn":
        colorFn = chalk.yellow;
        levelLabel = "WARN";
        break;
      case "info":
        colorFn = chalk.blue;
        levelLabel = "INFO";
        break;
      case "debug":
        colorFn = chalk.gray;
        levelLabel = "DEBUG";
        break;
      case "success":
        colorFn = chalk.green;
        levelLabel = "SUCCESS";
        break;
      default:
        colorFn = chalk.white;
        levelLabel = level.toUpperCase();
    }

    console.log(colorFn(`${timestamp} [${levelLabel.padEnd(7)}] ${safeMessage}`));

    if (meta) {
      const maskedMeta = this.maskObjectData(meta);
      console.log(chalk.gray(JSON.stringify(maskedMeta, null, 2)));
    }
  }

  /**
   * 📊 초기화 메시지 표시
   */
  showInitializationMessage() {
    const envIcon = this.environment.isProduction
      ? "🏭"
      : this.environment.isRailway
        ? "🚂"
        : this.environment.isDevelopment
          ? "🏠"
          : "🧪";

    const loggerType = this.environment.shouldUseWinston ? "Winston" : "Chalk";
    const additionalInfo =
      this.environment.shouldUseWinston && this.environment.shouldUseChalk
        ? " + Chalk"
        : "";

    if (this.environment.shouldUseChalk) {
      console.log(chalk.green.bold(`${envIcon} HybridLogger v${this.version} 시작`));
      console.log(chalk.cyan(`🎯 환경: ${this.environment.name}`));
      console.log(chalk.yellow(`📝 로거: ${loggerType}${additionalInfo}`));
      console.log(
        chalk.magenta(
          `🛡️ 개인정보 보호: ${this.privacyConfig.enablePrivacyMode ? "활성화" : "비활성화"}`
        )
      );
    } else {
      // Winston만 사용하는 경우 간단한 메시지
      console.log(
        `${envIcon} HybridLogger v${this.version} 시작 - ${this.environment.name} 환경`
      );
    }
  }

  // ===== 🎯 표준 로깅 메서드들 =====

  info(message, meta = null) {
    this.log("info", message, meta);
  }

  success(message, meta = null) {
    this.log("success", message, meta);
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

  // ===== 🛠️ 유틸리티 메서드들 (기존과 동일) =====

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
      /Logger|Module|Service|Bot|Controller|Handler/i,
      /초기화|연결|시작|완료|성공|실패/
    ];

    return systemPatterns.some((pattern) => pattern.test(message));
  }

  maskSensitiveData(text) {
    if (typeof text !== "string") return text;

    let maskedText = text;
    let maskedCount = 0;

    // 사용자 ID 패턴
    maskedText = maskedText.replace(/\b\d{9,12}\b/g, (match) => {
      maskedCount++;
      return "***MASKED***";
    });

    // 기타 민감 데이터 패턴들
    this.sensitivePatterns.slice(1).forEach((pattern) => {
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
    const sensitiveKeys = ["password", "token", "key", "secret", "userId", "id", "email"];

    const maskRecursive = (target) => {
      if (!target || typeof target !== "object") return target;

      for (const key of Object.keys(target)) {
        const lowerKey = key.toLowerCase();
        const value = target[key];

        if (sensitiveKeys.some((sensitiveKey) => lowerKey.includes(sensitiveKey))) {
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

    if (/^[가-힣]+$/.test(trimmedName)) {
      if (trimmedName.length === 2) return `${trimmedName[0]}*`;
      if (trimmedName.length === 3) return `${trimmedName[0]}**`;
      return `${trimmedName[0]}***`;
    }

    if (/^[a-zA-Z]+$/.test(trimmedName)) {
      if (trimmedName.length <= 4) return `${trimmedName[0]}***`;
      return `${trimmedName.slice(0, 2)}***`;
    }

    return `${trimmedName[0]}***`;
  }

  // ===== 📊 모니터링 메서드들 =====

  getStats() {
    return {
      ...this.stats,
      environment: this.environment.name,
      loggerType: this.environment.shouldUseWinston
        ? this.environment.shouldUseChalk
          ? "Winston + Chalk"
          : "Winston"
        : "Chalk",
      uptime: Date.now() - this.startTime,
      errorRate:
        this.stats.totalLogs > 0
          ? ((this.stats.errors / this.stats.totalLogs) * 100).toFixed(2) + "%"
          : "0%"
    };
  }

  showStats() {
    const stats = this.getStats();

    if (this.environment.shouldUseChalk) {
      console.log(chalk.cyan("\n📊 HybridLogger 통계:"));
      console.log(chalk.cyan(`   환경: ${stats.environment}`));
      console.log(chalk.cyan(`   로거 타입: ${stats.loggerType}`));
      console.log(chalk.cyan(`   전체 로그: ${stats.totalLogs}개`));
      console.log(chalk.cyan(`   Winston 로그: ${stats.winstonLogs}개`));
      console.log(chalk.cyan(`   Chalk 로그: ${stats.chalkLogs}개`));
      console.log(chalk.cyan(`   마스킹된 데이터: ${stats.maskedData}개`));
      console.log(chalk.cyan(`   에러율: ${stats.errorRate}`));
    } else {
      console.log(
        `📊 HybridLogger 통계: ${stats.totalLogs}개 로그, 에러율 ${stats.errorRate}`
      );
    }
  }

  // ===== 🧹 정리 작업 =====

  async cleanup() {
    if (this.winston) {
      await new Promise((resolve) => {
        this.winston.close(resolve);
      });
    }

    this.info("🧹 HybridLogger 정리 완료");
  }

  // ===== 🔄 기존 호환성 메서드들 =====

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

  celebration(message) {
    if (this.environment.shouldUseChalk) {
      const colors = this.rainbowColors;
      let coloredMessage = "";
      for (let i = 0; i < message.length; i++) {
        const colorIndex = i % colors.length;
        coloredMessage += chalk[colors[colorIndex]](message[i]);
      }
      console.log(`🎉 ${coloredMessage} 🎉`);
    } else {
      this.info(`🎉 ${message} 🎉`);
    }
  }

  gradient(text, startColor = "blue", endColor = "magenta") {
    if (this.environment.shouldUseChalk) {
      // 간단한 그라데이션 효과
      const colors = [startColor, endColor];
      const midIndex = Math.floor(text.length / 2);

      return (
        chalk[colors[0]](text.slice(0, midIndex)) + chalk[colors[1]](text.slice(midIndex))
      );
    } else {
      return text;
    }
  }

  /**
   * 🌈 무지개 효과 (기존 코드와 호환성 유지)
   */
  rainbow(text) {
    if (this.environment.shouldUseChalk) {
      const colors = this.rainbowColors;
      let coloredText = "";
      for (let i = 0; i < text.length; i++) {
        const colorIndex = i % colors.length;
        coloredText += chalk[colors[colorIndex]](text[i]);
      }
      return coloredText;
    } else {
      return text;
    }
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
const hybridLogger = new HybridLogger();
module.exports = hybridLogger;
