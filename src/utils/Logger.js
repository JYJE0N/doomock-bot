// src/utils/Logger.js v3.0.1 - 완전 안정화 버전
const chalk = require("chalk");

/**
 * 🎯 CompleteLogger - 안정화된 로거
 *
 * 특징:
 * - 모든 메서드 직접 정의
 * - 순환 참조 없음
 * - 즉시 사용 가능
 */
class CompleteLogger {
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

    // 색상 배열 (rainbow 용)
    this.rainbowColors = ["red", "yellow", "green", "cyan", "blue", "magenta"];

    // 초기화 완료 메시지
    console.log(chalk.green("🌈 CompleteLogger v3.0.1 초기화 완료!"));
  }

  // ===== 🎨 기본 로그 메서드들 =====

  info(message, data) {
    this.stats.totalLogs++;
    this.stats.infos++;

    const maskedMessage = this.maskSensitiveData(message);
    const timestamp = this.getTimestamp();

    console.log(chalk.blue(`${timestamp} [INFO]    ${maskedMessage}`));
    if (data) this.printData(data);
  }

  success(message, data) {
    this.stats.totalLogs++;
    this.stats.successes++;

    const maskedMessage = this.maskSensitiveData(message);
    const timestamp = this.getTimestamp();

    console.log(chalk.green(`${timestamp} [SUCCESS] ${maskedMessage}`));
    if (data) this.printData(data);
  }

  warn(message, data) {
    this.stats.totalLogs++;
    this.stats.warnings++;

    const maskedMessage = this.maskSensitiveData(message);
    const timestamp = this.getTimestamp();

    console.log(chalk.yellow(`${timestamp} [WARN]    ${maskedMessage}`));
    if (data) this.printData(data);
  }

  error(message, data) {
    this.stats.totalLogs++;
    this.stats.errors++;

    const maskedMessage = this.maskSensitiveData(message);
    const timestamp = this.getTimestamp();

    console.log(chalk.red(`${timestamp} [ERROR]   ${maskedMessage}`));
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

      console.log(chalk.gray(`${timestamp} [DEBUG]   ${maskedMessage}`));
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
    console.log(chalk.magenta(`${timestamp} [SYSTEM]  ${message}`));
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
    }

    console.log(chalk.cyan("📊 ═════════════════\n"));
  }

  module(moduleName, message, data) {
    this.stats.totalLogs++;
    const timestamp = this.getTimestamp();
    console.log(chalk.cyan(`${timestamp} [${moduleName}] ${message}`));
    if (data) this.printData(data);
  }

  database(message, data) {
    this.stats.totalLogs++;
    const timestamp = this.getTimestamp();
    console.log(chalk.yellow(`${timestamp} [DB]      ${message}`));
    if (data) this.printData(data);
  }

  user(action, userName, details) {
    this.stats.totalLogs++;
    const timestamp = this.getTimestamp();
    const detailStr = details ? " - " + JSON.stringify(details) : "";
    console.log(
      chalk.cyan(`${timestamp} [USER]    ${action}: ${userName}${detailStr}`)
    );
  }

  // ===== 🎨 스타일 메서드들 =====

  rainbow(text) {
    if (!text) return "";

    let result = "";
    for (let i = 0; i < text.length; i++) {
      const colorIndex = i % this.rainbowColors.length;
      const color = this.rainbowColors[colorIndex];
      result += chalk[color](text[i]);
    }
    return result;
  }

  gradient(text, startColor = "blue", endColor = "magenta") {
    if (!text) return "";

    // 간단한 그라디언트: 시작색과 끝색을 번갈아 사용
    const colors = [startColor, endColor];
    let result = "";

    for (let i = 0; i < text.length; i++) {
      const colorIndex = Math.floor((i / text.length) * 2) % 2;
      const color = colors[colorIndex];

      if (chalk[color]) {
        result += chalk[color](text[i]);
      } else {
        result += chalk.blue(text[i]); // 폴백
      }
    }

    return result;
  }

  celebration(message) {
    console.log(this.rainbow(`🎉 ${message}`));
  }

  moduleLog(moduleName, message, data) {
    this.stats.totalLogs++;
    const timestamp = this.getTimestamp();
    console.log(chalk.cyan(`${timestamp} [${moduleName}] ${message}`));
    if (data) {
      console.log(chalk.gray(JSON.stringify(data, null, 2)));
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  getTimestamp() {
    const now = new Date();
    const kstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000); // UTC+9
    return kstTime.toISOString().replace("T", " ").substring(0, 19); // YYYY-MM-DD HH:MM:SS 형태
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
    console.log(chalk.yellow("\n🧪 CompleteLogger 테스트 시작..."));

    this.info("정보 메시지 테스트");
    this.success("성공 메시지 테스트");
    this.warn("경고 메시지 테스트");
    this.error("오류 메시지 테스트");
    this.debug("디버그 메시지 테스트");
    this.system("시스템 메시지 테스트");
    this.module("TestModule", "모듈 메시지 테스트");
    this.database("데이터베이스 메시지 테스트");

    console.log("\n🎨 스타일 테스트:");
    console.log("🌈 무지개:", this.rainbow("무지개 효과 테스트"));
    console.log(
      "🎨 그라디언트:",
      this.gradient("그라디언트 효과 테스트", "blue", "magenta")
    );

    this.celebration("축하 메시지 테스트");

    this.showStats();
    console.log(chalk.green("✅ CompleteLogger 테스트 완료!\n"));
  }

  // ===== 📱 텔레그램 메시지 메서드들 =====

  async sendLoading(bot, chatId, message = "처리 중...") {
    try {
      const loadingMessage = await bot.sendMessage(chatId, `⏳ ${message}`);
      this.info("로딩 메시지 전송됨", {
        chatId,
        messageId: loadingMessage.message_id,
      });
      return loadingMessage;
    } catch (error) {
      this.error("로딩 메시지 전송 실패", error);
    }
  }

  async updateLoading(bot, chatId, messageId, newMessage, isComplete = false) {
    try {
      const icon = isComplete ? "✅" : "⏳";
      await bot.editMessageText(`${icon} ${newMessage}`, {
        chat_id: chatId,
        message_id: messageId,
      });
      this.info("로딩 메시지 업데이트됨", { chatId, messageId, isComplete });
    } catch (error) {
      this.error("로딩 메시지 업데이트 실패", error);
    }
  }
}

// ========================================
// 🎯 단순한 직접 내보내기 (싱글톤 패턴)
// ========================================

// 하나의 인스턴스 생성
const loggerInstance = new CompleteLogger();

// 직접 내보내기
module.exports = loggerInstance;
