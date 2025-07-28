// src/utils/Logger.js - 명확한 구조로 정리된 버전

const chalk = require("chalk");
const TimeHelper = require("./TimeHelper");

/**
 * 📊 Logger - 로깅 시스템
 *
 * 주요 기능:
 * - 콘솔 로깅 (색상 지원)
 * - 로그 레벨 관리
 * - 통계 수집
 * - 보안 필터링
 * - Railway 환경 지원
 */
class Logger {
  constructor() {
    // 기본 설정
    this.config = {
      logLevel: process.env.LOG_LEVEL || "info",
      enableColors: process.env.ENABLE_COLOR_LOGS !== "false",
      isRailway: !!process.env.RAILWAY_ENVIRONMENT,
      isDevelopment: process.env.NODE_ENV === "development",
    };

    // 로그 레벨 정의
    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      success: 2,
      debug: 3,
      trace: 4,
    };

    // 통계
    this.stats = {
      totalLogs: 0,
      errors: 0,
      warnings: 0,
      startTime: Date.now(),
    };

    // 보안: 민감한 키워드
    this.sensitiveKeywords = [
      "token",
      "password",
      "key",
      "secret",
      "private",
      "credentials",
      "auth",
    ];
  }

  // ===== 🎯 기본 로깅 메서드 =====

  /**
   * ❌ 에러 로그
   */
  error(message, error = null) {
    this.log("ERROR", message, error, chalk.red);
    this.stats.errors++;
  }

  /**
   * ⚠️ 경고 로그
   */
  warn(message, data = null) {
    this.log("WARN", message, data, chalk.yellow);
    this.stats.warnings++;
  }

  /**
   * ℹ️ 정보 로그
   */
  info(message, data = null) {
    this.log("INFO", message, data, chalk.blue);
  }

  /**
   * ✅ 성공 로그
   */
  success(message, data = null) {
    this.log("SUCCESS", message, data, chalk.green);
  }

  /**
   * 🐛 디버그 로그 (개발 환경에서만)
   */
  debug(message, data = null) {
    if (this.config.isDevelopment) {
      this.log("DEBUG", message, data, chalk.gray);
    }
  }

  // ===== 🎨 특수 로깅 메서드 =====

  /**
   * 🤖 시스템 로그
   */
  system(message, data = null) {
    this.log("SYSTEM", message, data, chalk.cyan);
  }

  /**
   * 📦 모듈 로그
   */
  module(moduleName, message, data = null) {
    const moduleEmojis = {
      TodoModule: "📝",
      TimerModule: "⏰",
      WorktimeModule: "🏢",
      TTSModule: "🔊",
      SystemModule: "⚙️",
    };

    const emoji = moduleEmojis[moduleName] || "📦";
    this.log(
      "MODULE",
      `${emoji} [${moduleName}] ${message}`,
      data,
      chalk.magenta
    );
  }

  /**
   * 🗄️ 데이터베이스 로그
   */
  database(message, data = null) {
    this.log("DB", `🗄️ ${message}`, data, chalk.blue);
  }

  /**
   * 🎯 네비게이션 로그
   */
  navigation(module, action, userId = null) {
    const logData = { module, action, userId };
    this.log("NAV", `🎯 ${module}:${action}`, logData, chalk.cyan);
  }

  /**
   * 🎉 축하 로그
   */
  celebration(message) {
    if (this.config.enableColors) {
      console.log(this.rainbow(`🎉 ${message} 🎉`));
    } else {
      this.log("CELEBRATE", message, null, chalk.magenta);
    }
  }

  // ===== 🎨 스타일 메서드 =====

  /**
   * 🌈 무지개 텍스트
   */
  rainbow(text) {
    if (!this.config.enableColors) return text;

    const colors = [
      chalk.red,
      chalk.yellow,
      chalk.green,
      chalk.cyan,
      chalk.blue,
      chalk.magenta,
    ];

    return text
      .split("")
      .map((char, i) => {
        const color = colors[i % colors.length];
        return color(char);
      })
      .join("");
  }

  /**
   * 🎨 그라디언트 텍스트
   */
  gradient(text, startColor = "blue", endColor = "magenta") {
    if (!this.config.enableColors) return text;

    // 간단한 그라디언트 시뮬레이션
    const half = Math.floor(text.length / 2);
    const firstHalf = chalk[startColor](text.substring(0, half));
    const secondHalf = chalk[endColor](text.substring(half));

    return firstHalf + secondHalf;
  }

  // ===== 🔒 보안 메서드 =====

  /**
   * 민감한 정보 마스킹
   */
  maskSensitiveData(data) {
    if (typeof data === "string") {
      // 이메일 마스킹
      data = data.replace(/([^\s]+)@([^\s]+)/g, "***@$2");

      // 긴 토큰 마스킹
      data = data.replace(
        /[A-Za-z0-9]{32,}/g,
        (match) => match.substring(0, 8) + "...[REDACTED]"
      );
    } else if (typeof data === "object" && data !== null) {
      const masked = {};
      for (const [key, value] of Object.entries(data)) {
        // 민감한 키 확인
        const isSensitive = this.sensitiveKeywords.some((keyword) =>
          key.toLowerCase().includes(keyword)
        );

        if (isSensitive) {
          masked[key] = "[REDACTED]";
        } else if (typeof value === "object") {
          masked[key] = this.maskSensitiveData(value);
        } else {
          masked[key] = value;
        }
      }
      return masked;
    }

    return data;
  }

  // ===== 🎯 핵심 로깅 메서드 =====

  /**
   * 통합 로깅 메서드
   */
  log(level, message, data, colorFn) {
    // 로그 레벨 확인
    const currentLevel = this.logLevels[this.config.logLevel] || 2;
    const messageLevel = this.logLevels[level.toLowerCase()] || 2;

    if (messageLevel > currentLevel) return;

    // 타임스탬프
    const timestamp = TimeHelper.getLogTimeString();

    // 레벨 태그
    const levelTag = `[${level}]`.padEnd(9);

    // 메시지 구성
    let logMessage = `${timestamp} ${levelTag} ${message}`;

    // 데이터 추가 (보안 필터링 적용)
    if (data) {
      const maskedData = this.maskSensitiveData(data);

      if (data instanceof Error) {
        logMessage += `\n${maskedData.message}`;
        if (this.config.isDevelopment && maskedData.stack) {
          logMessage += `\n${maskedData.stack}`;
        }
      } else if (typeof maskedData === "object") {
        logMessage += `\n${JSON.stringify(maskedData, null, 2)}`;
      } else {
        logMessage += ` - ${maskedData}`;
      }
    }

    // 출력 (색상 적용)
    if (this.config.enableColors && colorFn) {
      console.log(colorFn(logMessage));
    } else {
      console.log(logMessage);
    }

    // 통계 업데이트
    this.stats.totalLogs++;
  }

  // ===== 📊 유틸리티 메서드 =====

  /**
   * 통계 조회
   */
  getStats() {
    const uptime = Date.now() - this.stats.startTime;

    return {
      totalLogs: this.stats.totalLogs,
      errors: this.stats.errors,
      warnings: this.stats.warnings,
      errorRate:
        this.stats.totalLogs > 0
          ? ((this.stats.errors / this.stats.totalLogs) * 100).toFixed(2) + "%"
          : "0%",
      uptime: this.formatUptime(uptime),
      environment: this.config.isRailway ? "Railway" : "Local",
      logLevel: this.config.logLevel,
    };
  }

  /**
   * 업타임 포맷
   */
  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}시간 ${minutes % 60}분`;
    } else if (minutes > 0) {
      return `${minutes}분 ${seconds % 60}초`;
    } else {
      return `${seconds}초`;
    }
  }

  /**
   * 통계 표시
   */
  showStats() {
    console.log(chalk.cyan("\n📊 Logger 통계:"));
    const stats = this.getStats();
    Object.entries(stats).forEach(([key, value]) => {
      console.log(chalk.cyan(`   ${key}: ${value}`));
    });
    console.log();
  }

  /**
   * 테스트
   */
  test() {
    console.log(chalk.yellow("\n🧪 Logger 테스트 시작...\n"));

    this.info("정보 메시지 테스트");
    this.success("성공 메시지 테스트");
    this.warn("경고 메시지 테스트");
    this.error("오류 메시지 테스트", new Error("테스트 에러"));
    this.debug("디버그 메시지 테스트");
    this.system("시스템 메시지 테스트");
    this.module("TestModule", "모듈 메시지 테스트");
    this.database("데이터베이스 연결 테스트");
    this.navigation("test", "menu", "user123");

    console.log("\n🎨 스타일 테스트:");
    console.log(this.rainbow("무지개 효과 테스트 🌈"));
    console.log(this.gradient("그라디언트 효과 테스트", "blue", "magenta"));

    this.celebration("축하 메시지 테스트");

    console.log("\n🔒 보안 테스트:");
    this.info("민감한 데이터 테스트", {
      email: "test@example.com",
      token: "abcdefghijklmnopqrstuvwxyz123456789",
      password: "secret123",
      normalData: "일반 데이터",
    });

    this.showStats();
    console.log(chalk.green("\n✅ Logger 테스트 완료!\n"));
  }
}

// ===== 🚀 싱글톤 인스턴스 생성 및 내보내기 =====

const logger = new Logger();

// 개발 환경에서 자동 테스트
if (
  process.env.NODE_ENV === "development" &&
  process.env.TEST_LOGGER === "true"
) {
  logger.test();
}

module.exports = logger;
