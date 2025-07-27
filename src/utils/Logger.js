// src/utils/Logger.js
// 🌈 Simple but Powerful Logger v3.0.1
// 복잡한 의존성 제거하고 확실하게 작동하는 버전!

const chalk = require("chalk");

/**
 * 🎯 SimpleLogger - 확실하게 작동하는 간단한 로거
 *
 * 특징:
 * - 의존성 최소화
 * - 모든 필요한 메서드 포함
 * - 즉시 작동 보장
 * - 에러 없는 안정성
 */
class SimpleLogger {
  constructor() {
    this.version = "3.0.1";
    this.initialized = true;
    this.startTime = Date.now();

    // 통계
    this.stats = {
      totalLogs: 0,
      errors: 0,
      warnings: 0,
      infos: 0,
      successes: 0,
    };

    // 초기화 완료 메시지
    this.showWelcome();
  }

  showWelcome() {
    console.log(chalk.rainbow || chalk.blue("🌈 SimpleLogger v3.0.1 활성화!"));
  }

  // ===== 🎨 기본 로그 메서드들 =====

  info(message, data) {
    this.stats.totalLogs++;
    this.stats.infos++;
    // 🛡️ 보안: 메시지도 마스킹 처리
    const maskedMessage = this.maskSensitiveData(message);
    console.log(chalk.blue("ℹ️ ") + maskedMessage);
    if (data) this.printData(data);
  }

  success(message, data) {
    this.stats.totalLogs++;
    this.stats.successes++;
    const maskedMessage = this.maskSensitiveData(message);
    console.log(chalk.green("✅ ") + maskedMessage);
    if (data) this.printData(data);
  }

  warn(message, data) {
    this.stats.totalLogs++;
    this.stats.warnings++;
    const maskedMessage = this.maskSensitiveData(message);
    console.log(chalk.yellow("⚠️ ") + maskedMessage);
    if (data) this.printData(data);
  }

  error(message, data) {
    this.stats.totalLogs++;
    this.stats.errors++;
    const maskedMessage = this.maskSensitiveData(message);
    console.log(chalk.red("❌ ") + maskedMessage);
    if (data) {
      if (data instanceof Error) {
        console.log(chalk.gray("📋 스택 트레이스:"));
        // 🛡️ 보안: 스택 트레이스도 마스킹
        const maskedStack = this.maskSensitiveData(data.stack);
        console.log(chalk.gray(maskedStack));
      } else {
        this.printData(data);
      }
    }
  }

  debug(message, data) {
    if (
      process.env.DEBUG === "true" ||
      process.env.NODE_ENV === "development"
    ) {
      this.stats.totalLogs++;
      const maskedMessage = this.maskSensitiveData(message);
      console.log(chalk.gray("🔍 ") + maskedMessage);
      if (data) this.printData(data);
    }
  }

  // ===== 🚀 특수 메서드들 =====

  startup(appName, version) {
    console.log("\n" + "=".repeat(50));
    console.log(chalk.green(`🚀 ${appName} v${version} 시작됨!`));
    console.log("=".repeat(50) + "\n");
  }

  system(message, data) {
    this.stats.totalLogs++;
    console.log(chalk.magenta("🤖 [SYSTEM] ") + message);
    if (data) this.printData(data);
  }

  fatal(message, error) {
    this.stats.totalLogs++;
    this.stats.errors++;

    console.log(chalk.red.bold("\n💀 ══════════════════════════════════════"));
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
    console.log(chalk.cyan(`\n📊 ═══ ${title} ═══`));
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
    console.log(chalk.green("📡 ") + chalk.cyan(message));
    if (data) this.printData(data);
  }

  module(moduleName, message, data) {
    this.stats.totalLogs++;
    console.log(chalk.blue(`📦 [${moduleName}] ${message}`));
    if (data) this.printData(data);
  }

  // ===== 🎯 모듈별 전용 로그들 =====

  todo(action, task, userName) {
    console.log(chalk.blue(`📝 [TODO] ${action}: ${task} (${userName})`));
  }

  timer(action, duration, userName) {
    console.log(
      chalk.cyan(`⏰ [TIMER] ${action}: ${duration}ms (${userName})`)
    );
  }

  worktime(action, hours, userName) {
    console.log(chalk.green(`🏢 [WORK] ${action}: ${hours}시간 (${userName})`));
  }

  user(action, userName, details = {}) {
    const detailStr =
      Object.keys(details).length > 0 ? JSON.stringify(details) : "";
    console.log(chalk.yellow(`👤 [USER] ${action}: ${userName} ${detailStr}`));
  }

  // ===== 🎨 스타일 메서드들 =====

  rainbow(text) {
    // 간단한 무지개 효과 (chalk rainbow가 없을 경우 대비)
    try {
      return chalk.rainbow ? chalk.rainbow(text) : chalk.blue(text);
    } catch {
      return chalk.blue(text);
    }
  }

  gradient(text, startColor = "blue", endColor = "cyan") {
    // 간단한 그라디언트 효과
    try {
      return chalk[startColor](text);
    } catch {
      return chalk.blue(text);
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  printData(data) {
    if (typeof data === "object") {
      // 🛡️ 보안: 객체 데이터도 마스킹 처리
      const maskedData = this.maskSensitiveData(JSON.stringify(data, null, 2));
      console.log(chalk.gray(maskedData));
    } else {
      // 🛡️ 보안: 문자열 데이터 마스킹 처리
      const maskedStr = this.maskSensitiveData(String(data));
      console.log(chalk.gray(`   ${maskedStr}`));
    }
  }

  // ===== 🛡️ 보안 마스킹 시스템 =====

  maskSensitiveData(text) {
    if (!text || typeof text !== "string") return text;

    // 🔐 민감정보 패턴들
    const patterns = {
      // 토큰 관련
      telegramToken: /(\d{8,10}):([A-Za-z0-9_-]{35})/g,
      bearerToken: /Bearer\s+([A-Za-z0-9\-_\.]{20,})/g,
      jwtToken: /(eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)/g,
      apiKey: /([a-zA-Z0-9_-]{32,})/g,

      // 데이터베이스 URL
      mongoUrl: /(mongodb:\/\/[^:]+):([^@]+)@([^\/]+)/g,
      postgresUrl: /(postgres:\/\/[^:]+):([^@]+)@([^\/]+)/g,

      // 개인정보
      email: /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      phone: /(\b01[0-9])[\s-]?(\d{3,4})[\s-]?(\d{4}\b)/g,
      creditCard: /(\b\d{4})[\s-]?(\d{4})[\s-]?(\d{4})[\s-]?(\d{4}\b)/g,

      // JSON 필드
      passwordField: /"password"\s*:\s*"([^"]*)"/gi,
      tokenField: /"token"\s*:\s*"([^"]*)"/gi,
      secretField: /"secret"\s*:\s*"([^"]*)"/gi,
      keyField: /"(api_?key|access_?key)"\s*:\s*"([^"]*)"/gi,
    };

    let masked = text;
    let maskCount = 0;

    // 🔐 패턴별 마스킹 적용
    for (const [name, pattern] of Object.entries(patterns)) {
      masked = masked.replace(pattern, (match, ...groups) => {
        maskCount++;

        // 마스킹 방식별 처리
        switch (name) {
          case "telegramToken":
            return `${groups[0].substring(0, 3)}***${groups[0].slice(-3)}:***`;

          case "mongoUrl":
          case "postgresUrl":
            return `${groups[0]}:***@***`;

          case "email":
            return `${groups[0].substring(0, 2)}***@${groups[1]}`;

          case "phone":
            return `${groups[0]}***${groups[2]}`;

          case "creditCard":
            return `${groups[0]}****${groups[3]}`;

          case "passwordField":
          case "tokenField":
          case "secretField":
            return match.replace(groups[groups.length - 1], "***MASKED***");

          case "keyField":
            return match.replace(groups[groups.length - 1], "***MASKED***");

          default:
            // 기본 마스킹: 앞 3자리 + *** + 뒤 3자리
            const value = groups[0] || match;
            if (value.length <= 6) {
              return "***";
            }
            return value.substring(0, 3) + "***" + value.slice(-3);
        }
      });
    }

    // 🚨 추가 보안 경고 패턴 감지
    const suspiciousPatterns = [
      {
        name: "SQL Injection",
        pattern: /(union|select|insert|delete|update|drop)\s+/gi,
      },
      { name: "XSS", pattern: /<script[^>]*>.*?<\/script>/gi },
      { name: "Path Traversal", pattern: /\.\.\/|\.\.\\|\.\.\//g },
      { name: "Command Injection", pattern: /[;&|`$()]/g },
    ];

    for (const { name, pattern } of suspiciousPatterns) {
      if (pattern.test(text)) {
        console.log(chalk.red.bold(`🚨 보안 경고: ${name} 패턴 감지!`));
      }
    }

    // 마스킹 통계
    if (maskCount > 0) {
      console.log(chalk.yellow(`🛡️ ${maskCount}개 민감정보 마스킹됨`));
    }

    return masked;
  }

  getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - this.startTime,
      version: this.version,
    };
  }

  showStats() {
    const stats = this.getStats();
    console.log(chalk.cyan("\n📊 ═══ Logger 통계 ═══"));
    console.log(chalk.cyan(`   총 로그: ${stats.totalLogs}`));
    console.log(chalk.cyan(`   성공: ${stats.successes}`));
    console.log(chalk.cyan(`   경고: ${stats.warnings}`));
    console.log(chalk.cyan(`   에러: ${stats.errors}`));
    console.log(chalk.cyan(`   업타임: ${Math.round(stats.uptime / 1000)}초`));
    console.log(chalk.cyan("📊 ══════════════════\n"));
  }

  cleanup() {
    this.showStats();
    console.log(chalk.blue("🌈 SimpleLogger 종료됨"));
  }

  // ===== 📱 텔레그램 메시지 관련 (기본 구현) =====

  async sendMainMenu(bot, chatId, menuData) {
    // 기본 구현 - 필요시 확장
    try {
      await bot.sendMessage(chatId, "📱 메인 메뉴");
      this.info("메인 메뉴 전송됨", { chatId });
    } catch (error) {
      this.error("메인 메뉴 전송 실패", error);
    }
  }

  async sendSuccess(bot, chatId, title, message) {
    try {
      await bot.sendMessage(chatId, `✅ ${title}\n\n${message}`);
      this.success("성공 메시지 전송됨", { chatId, title });
    } catch (error) {
      this.error("성공 메시지 전송 실패", error);
    }
  }

  async sendError(bot, chatId, title, message) {
    try {
      await bot.sendMessage(chatId, `❌ ${title}\n\n${message}`);
      this.error("에러 메시지 전송됨", { chatId, title });
    } catch (error) {
      this.error("에러 메시지 전송 실패", error);
    }
  }

  async sendLoading(bot, chatId, message) {
    try {
      const result = await bot.sendMessage(chatId, `⏳ ${message}...`);
      this.info("로딩 메시지 전송됨", { chatId, message });
      return result;
    } catch (error) {
      this.error("로딩 메시지 전송 실패", error);
      return null;
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
// 🎯 싱글톤 패턴 (기존과 동일)
// ========================================

let loggerInstance = null;

function getInstance() {
  if (!loggerInstance) {
    loggerInstance = new SimpleLogger();
  }
  return loggerInstance;
}

// ========================================
// 🚀 모듈 내보내기 (기존과 동일)
// ========================================

module.exports = getInstance();
