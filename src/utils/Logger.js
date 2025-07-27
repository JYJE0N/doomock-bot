// src/utils/Logger.js v3.0.1 - 단순하고 확실한 로거
// ========================================
// 🌈 Simple but Powerful Logger v3.0.1
// 복잡한 의존성 제거하고 확실하게 작동하는 버전!
// ========================================

const chalk = require("chalk");

/**
 * 🎯 SimpleLogger - 확실하게 작동하는 간단한 로거
 *
 * 특징:
 * - 의존성 최소화 (chalk만 사용)
 * - 모든 필요한 메서드 포함
 * - 즉시 작동 보장
 * - 에러 없는 안정성
 * - Railway 환경 최적화
 */
class SimpleLogger {
  constructor() {
    this.version = "3.0.1";
    this.initialized = true;
    this.startTime = Date.now();

    // Railway 환경 감지
    this.isRailway = !!process.env.RAILWAY_ENVIRONMENT;
    this.logLevel = process.env.LOG_LEVEL || "info";

    // 통계
    this.stats = {
      totalLogs: 0,
      errors: 0,
      warnings: 0,
      infos: 0,
      successes: 0,
      startTime: this.startTime,
    };

    // 초기화 완료 메시지 (즉시 출력으로 확인)
    console.log(chalk.green("🌈 SimpleLogger v3.0.1 활성화됨!"));
    console.log(chalk.blue(`🎯 환경: ${this.isRailway ? "Railway" : "Local"}`));
    console.log(chalk.blue(`📊 로그 레벨: ${this.logLevel}`));
  }

  // ===== 🎨 기본 로그 메서드들 =====

  info(message, data) {
    this.stats.totalLogs++;
    this.stats.infos++;

    const maskedMessage = this.maskSensitiveData(message);
    const timestamp = this.getTimestamp();

    console.log(chalk.blue(`${timestamp} ℹ️  ${maskedMessage}`));
    if (data) this.printData(data);
  }

  success(message, data) {
    this.stats.totalLogs++;
    this.stats.successes++;

    const maskedMessage = this.maskSensitiveData(message);
    const timestamp = this.getTimestamp();

    console.log(chalk.green(`${timestamp} ✅ ${maskedMessage}`));
    if (data) this.printData(data);
  }

  warn(message, data) {
    this.stats.totalLogs++;
    this.stats.warnings++;

    const maskedMessage = this.maskSensitiveData(message);
    const timestamp = this.getTimestamp();

    console.log(chalk.yellow(`${timestamp} ⚠️  ${maskedMessage}`));
    if (data) this.printData(data);
  }

  error(message, data) {
    this.stats.totalLogs++;
    this.stats.errors++;

    const maskedMessage = this.maskSensitiveData(message);
    const timestamp = this.getTimestamp();

    console.log(chalk.red(`${timestamp} ❌ ${maskedMessage}`));
    if (data) {
      if (data instanceof Error) {
        console.log(chalk.gray("📋 스택 트레이스:"));
        const maskedStack = this.maskSensitiveData(data.stack);
        console.log(chalk.gray(maskedStack));
      } else {
        this.printData(data);
      }
    }
  }

  debug(message, data) {
    if (this.logLevel === "debug" || process.env.NODE_ENV === "development") {
      this.stats.totalLogs++;
      const maskedMessage = this.maskSensitiveData(message);
      const timestamp = this.getTimestamp();

      console.log(chalk.gray(`${timestamp} 🔍 ${maskedMessage}`));
      if (data) this.printData(data);
    }
  }

  // ===== 🚀 특수 메서드들 =====

  startup(appName, version) {
    console.log("\n" + "=".repeat(50));
    console.log(chalk.green(`🚀 ${appName} v${version} 시작됨!`));
    console.log(
      chalk.blue(
        `⏰ 시작 시간: ${new Date().toLocaleString("ko-KR", {
          timeZone: "Asia/Seoul",
        })}`
      )
    );
    console.log("=".repeat(50) + "\n");
  }

  system(message, data) {
    this.stats.totalLogs++;
    const timestamp = this.getTimestamp();
    console.log(chalk.magenta(`${timestamp} 🤖 [SYSTEM] ${message}`));
    if (data) this.printData(data);
  }

  fatal(message, error) {
    this.stats.totalLogs++;
    this.stats.errors++;

    const timestamp = this.getTimestamp();

    console.log(
      chalk.red.bold(`\n${timestamp} 💀 ══════════════════════════════════════`)
    );
    console.log(chalk.red.bold("💀 FATAL ERROR"));
    console.log(chalk.red(`💀 ${message}`));

    if (error) {
      console.log(chalk.red(`💀 오류: ${error.message}`));
      if (error.stack) {
        console.log(chalk.gray("📋 스택 트레이스:"));
        console.log(chalk.gray(error.stack));
      }
    }

    console.log(chalk.red.bold("💀 ══════════════════════════════════════\n"));
  }

  summary(title, data) {
    const timestamp = this.getTimestamp();
    console.log(chalk.cyan(`\n${timestamp} 📊 ═══ ${title} ═══`));

    if (typeof data === "object" && data !== null) {
      for (const [key, value] of Object.entries(data)) {
        console.log(chalk.cyan(`   ${key}: ${value}`));
      }
    } else {
      console.log(chalk.cyan(`   ${data}`));
    }
    console.log(chalk.cyan("📊 ══════════════════\n"));
  }

  network(message, data) {
    this.stats.totalLogs++;
    const timestamp = this.getTimestamp();
    console.log(chalk.green(`${timestamp} 📡 ${message}`));
    if (data) this.printData(data);
  }

  module(moduleName, message, data) {
    this.stats.totalLogs++;
    const timestamp = this.getTimestamp();
    console.log(chalk.blue(`${timestamp} 📦 [${moduleName}] ${message}`));
    if (data) this.printData(data);
  }

  // ===== 🎯 모듈별 전용 로그들 =====

  todo(action, task, userName) {
    const timestamp = this.getTimestamp();
    console.log(
      chalk.blue(`${timestamp} 📝 [TODO] ${action}: ${task} (${userName})`)
    );
  }

  timer(action, duration, userName) {
    const timestamp = this.getTimestamp();
    console.log(
      chalk.cyan(
        `${timestamp} ⏰ [TIMER] ${action}: ${duration}ms (${userName})`
      )
    );
  }

  worktime(action, hours, userName) {
    const timestamp = this.getTimestamp();
    console.log(
      chalk.green(
        `${timestamp} 🏢 [WORK] ${action}: ${hours}시간 (${userName})`
      )
    );
  }

  user(action, userName, details = {}) {
    const timestamp = this.getTimestamp();
    const detailStr =
      Object.keys(details).length > 0 ? JSON.stringify(details) : "";
    console.log(
      chalk.yellow(`${timestamp} 👤 [USER] ${action}: ${userName} ${detailStr}`)
    );
  }

  // ===== 🎨 스타일 메서드들 =====

  rainbow(text) {
    // 간단한 무지개 효과
    const colors = ["red", "yellow", "green", "cyan", "blue", "magenta"];
    let result = "";

    for (let i = 0; i < text.length; i++) {
      const colorIndex = i % colors.length;
      result += chalk[colors[colorIndex]](text[i]);
    }

    return result;
  }

  gradient(text, startColor = "blue", endColor = "magenta") {
    // 간단한 그라디언트 효과
    const colors = {
      red: 1,
      green: 2,
      yellow: 3,
      blue: 4,
      magenta: 5,
      cyan: 6,
    };

    const start = colors[startColor] || 4;
    const end = colors[endColor] || 5;

    // 색상 전환 효과
    return chalk.rgb(start * 40, 100, end * 40)(text);
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  getTimestamp() {
    const now = new Date();
    const kstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000); // UTC+9
    return kstTime.toISOString().substring(11, 19); // HH:MM:SS 형태
  }

  printData(data) {
    try {
      if (typeof data === "object") {
        const maskedData = this.maskSensitiveData(
          JSON.stringify(data, null, 2)
        );
        console.log(chalk.gray(maskedData));
      } else {
        const maskedData = this.maskSensitiveData(String(data));
        console.log(chalk.gray(maskedData));
      }
    } catch (error) {
      console.log(chalk.gray("[데이터 출력 실패]"));
    }
  }

  maskSensitiveData(text) {
    if (typeof text !== "string") return text;

    // 토큰과 비밀번호 마스킹
    return text
      .replace(/(\d{10}):[\w-]{35}/g, "$1:***MASKED_TOKEN***")
      .replace(/Bearer\s+[\w-]+/gi, "Bearer ***MASKED***")
      .replace(/password['":][\s]*["'][^"']+["']/gi, 'password: "***MASKED***"')
      .replace(/token['":][\s]*["'][^"']+["']/gi, 'token: "***MASKED***"')
      .replace(/mongodb:\/\/[^@]+@/gi, "mongodb://***MASKED***@");
  }

  // ===== 📊 통계 및 상태 메서드들 =====

  getStats() {
    const uptime = Date.now() - this.startTime;
    return {
      version: this.version,
      uptime: `${Math.floor(uptime / 1000)}초`,
      totalLogs: this.stats.totalLogs,
      errors: this.stats.errors,
      warnings: this.stats.warnings,
      infos: this.stats.infos,
      successes: this.stats.successes,
      errorRate:
        this.stats.totalLogs > 0
          ? ((this.stats.errors / this.stats.totalLogs) * 100).toFixed(2) + "%"
          : "0%",
      isRailway: this.isRailway,
      logLevel: this.logLevel,
    };
  }

  showStats() {
    const stats = this.getStats();
    console.log(chalk.cyan("\n📊 Logger 통계:"));
    Object.entries(stats).forEach(([key, value]) => {
      console.log(chalk.cyan(`   ${key}: ${value}`));
    });
    console.log();
  }

  // ===== 🧪 테스트 메서드 =====

  test() {
    console.log(chalk.yellow("\n🧪 Logger 테스트 시작..."));

    this.info("정보 메시지 테스트");
    this.success("성공 메시지 테스트");
    this.warn("경고 메시지 테스트");
    this.error("오류 메시지 테스트");
    this.debug("디버그 메시지 테스트");
    this.system("시스템 메시지 테스트");
    this.module("TestModule", "모듈 메시지 테스트");

    console.log("\n🎨 스타일 테스트:");
    console.log(this.rainbow("🌈 무지개 효과 테스트"));
    console.log(this.gradient("🎨 그라디언트 효과 테스트", "blue", "magenta"));

    this.showStats();
    console.log(chalk.green("✅ Logger 테스트 완료!\n"));
  }
}

// ========================================
// 🎯 싱글톤 패턴
// ========================================

let loggerInstance = null;

function getInstance() {
  if (!loggerInstance) {
    loggerInstance = new SimpleLogger();
  }
  return loggerInstance;
}

// ========================================
// 🚀 모듈 내보내기
// ========================================

module.exports = getInstance();
