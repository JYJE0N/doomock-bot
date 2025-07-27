// ========================================
// 🌈 src/utils/Logger.js - Enhanced v3.0.1
// ========================================
// Message/ 폴더 기능들이 모두 주입된 알록달록한 Logger!
// ========================================

const chalk = require("chalk");
const {
  UnifiedMessageSystem,
  LoggerEnhancer,
} = require("./Message/UnifiedMessageSystem");

/**
 * 🌈 Enhanced Logger v3.0.1 - 알록달록 통합 시스템
 *
 * ✨ 새로운 기능들:
 * - 🎨 Message/ 폴더 기능들 완전 통합
 * - 🌈 알록달록한 콘솔 출력
 * - 📱 텔레그램 메시지 통합 관리
 * - 🎯 모듈별 전용 로그 스타일
 * - 📊 진행률 바 및 애니메이션
 * - 🛡️ Fallback 메커니즘
 */
class EnhancedLogger {
  constructor() {
    this.version = "3.0.1";
    this.initialized = false;

    // 🎨 기본 스타일 시스템
    this.styles = {
      info: {
        badge: chalk.bgBlue.white(" INFO "),
        icon: "ℹ️",
        color: chalk.blue,
      },
      success: {
        badge: chalk.bgGreen.black(" SUCCESS "),
        icon: "✅",
        color: chalk.green,
      },
      warn: {
        badge: chalk.bgYellow.black(" WARN "),
        icon: "⚠️",
        color: chalk.yellow,
      },
      error: {
        badge: chalk.bgRed.white(" ERROR "),
        icon: "❌",
        color: chalk.red,
      },
      debug: {
        badge: chalk.bgGray.white(" DEBUG "),
        icon: "🔍",
        color: chalk.gray,
      },
      system: {
        badge: chalk.bgMagenta.white(" SYSTEM "),
        icon: "🤖",
        color: chalk.magenta,
      },
    };

    // 📊 통계 시스템
    this.stats = {
      totalLogs: 0,
      messagesSent: 0,
      errorsHandled: 0,
      startTime: Date.now(),
      moduleUsage: new Map(),
    };

    // 🎨 Message 시스템 통합
    this.messageSystem = new UnifiedMessageSystem();
    this.enhancer = new LoggerEnhancer(this, this.messageSystem);

    this.initialized = true;
    this.showWelcomeBanner();
  }

  // ===== 🎉 시작 배너 =====
  showWelcomeBanner() {
    const banner = [
      "██████╗ ██╗   ██╗███╗   ███╗ ██████╗ ██╗  ██╗",
      "██╔══██╗██║   ██║████╗ ████║██╔═══██╗██║ ██╔╝",
      "██║  ██║██║   ██║██╔████╔██║██║   ██║█████╔╝ ",
      "██║  ██║██║   ██║██║╚██╔╝██║██║   ██║██╔═██╗ ",
      "██████╔╝╚██████╔╝██║ ╚═╝ ██║╚██████╔╝██║  ██╗",
      "╚═════╝  ╚═════╝ ╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═╝",
      "                                             ",
      "🤖 두목봇 Enhanced Logger v3.0.1 - 알록달록 모드! 🌈",
    ];

    console.clear();
    banner.forEach((line) => {
      console.log(this.rainbow(line));
    });
    console.log();
    console.log(chalk.bold.white("✨ Message 시스템 통합 완료!"));
    console.log(chalk.gray("────────────────────────────────────────────────"));
    console.log();
  }

  // ===== 🌈 특수 효과들 (Message 시스템에서 주입됨) =====
  rainbow(text) {
    return this.messageSystem.rainbow(text);
  }

  gradient(text, startColor, endColor) {
    return this.messageSystem.gradient(text, startColor, endColor);
  }

  // ===== 🎯 Enhanced 로그 메서드들 =====

  /**
   * 📊 Enhanced Info - 통계 포함
   */
  info(message, data) {
    this.stats.totalLogs++;
    console.log(this.#formatEnhancedLog("info", message, data));
  }

  /**
   * ✅ Enhanced Success - 축하 효과
   */
  success(message, data) {
    this.stats.totalLogs++;
    console.log(this.rainbow("🎉 ================"));
    console.log(this.#formatEnhancedLog("success", message, data));
    console.log(this.rainbow("🎉 ================"));
  }

  /**
   * ⚠️ Enhanced Warning - 주목도 UP
   */
  warn(message, data) {
    this.stats.totalLogs++;
    console.log(chalk.yellow("⚠️ ") + "━".repeat(50));
    console.log(this.#formatEnhancedLog("warn", message, data));
    console.log(chalk.yellow("⚠️ ") + "━".repeat(50));
  }

  /**
   * ❌ Enhanced Error - 상세 에러 처리
   */
  error(message, data) {
    this.stats.totalLogs++;
    this.stats.errorsHandled++;

    console.log(chalk.red("💥 ") + "═".repeat(50));
    console.log(this.#formatEnhancedLog("error", message, data));

    // 에러 스택 트레이스 예쁘게 출력
    if (data instanceof Error) {
      console.log(chalk.red("📋 스택 트레이스:"));
      console.log(chalk.gray(data.stack));
    }

    console.log(chalk.red("💥 ") + "═".repeat(50));
  }

  /**
   * 🔍 Enhanced Debug - 개발 모드 전용
   */
  debug(message, data) {
    if (process.env.DEBUG === "true") {
      this.stats.totalLogs++;
      console.log(this.#formatEnhancedLog("debug", message, data));
    }
  }

  /**
   * 🤖 Enhanced System - 시스템 로그
   */
  system(message, data) {
    this.stats.totalLogs++;
    console.log(this.#formatEnhancedLog("system", message, data));
  }

  // ===== 🎯 모듈별 특화 로그들 =====

  /**
   * 📝 Todo 모듈 전용 로그
   */
  todo(action, task, userName) {
    this.#updateModuleStats("todo");
    console.log(this.messageSystem.consoleStyles.moduleTitle("todo", "📝"));

    switch (action) {
      case "add":
        console.log(
          this.messageSystem.consoleStyles.todoAdd(`${task} (${userName})`)
        );
        break;
      case "complete":
        console.log(
          this.messageSystem.consoleStyles.todoComplete(`${task} (${userName})`)
        );
        break;
      case "delete":
        console.log(
          this.messageSystem.consoleStyles.todoDelete(`${task} (${userName})`)
        );
        break;
      default:
        console.log(chalk.blue(`📝 ${action}: ${task}`));
    }
  }

  /**
   * ⏰ Timer 모듈 전용 로그
   */
  timer(action, duration, userName) {
    this.#updateModuleStats("timer");
    console.log(this.messageSystem.consoleStyles.moduleTitle("timer", "⏰"));

    const timeStr = this.#formatDuration(duration);
    console.log(chalk.cyan(`⏰ ${action}: ${timeStr} (${userName})`));
  }

  /**
   * 🏢 WorkTime 모듈 전용 로그
   */
  worktime(action, hours, userName) {
    this.#updateModuleStats("worktime");
    console.log(this.messageSystem.consoleStyles.moduleTitle("worktime", "🏢"));
    console.log(chalk.green(`🏢 ${action}: ${hours}시간 (${userName})`));
  }

  /**
   * 👤 사용자 액션 로그
   */
  user(action, userName, details = {}) {
    console.log(chalk.cyan("👤 ") + "─".repeat(30));

    switch (action) {
      case "join":
        console.log(this.messageSystem.consoleStyles.userJoin(userName));
        break;
      case "message":
        console.log(
          this.messageSystem.consoleStyles.userMessage(
            userName,
            details.message
          )
        );
        break;
      case "callback":
        console.log(chalk.yellow(`🎯 ${userName}: ${details.action}`));
        break;
      default:
        console.log(chalk.cyan(`👤 ${userName}: ${action}`));
    }

    console.log(chalk.cyan("👤 ") + "─".repeat(30));
  }

  // ===== 📊 진행률 및 애니메이션 =====

  /**
   * 📊 진행률 바 표시
   */
  progress(label, current, total) {
    const progressBar = this.messageSystem.consoleStyles.progressBar(
      current,
      total
    );
    console.log(`📊 ${label}: ${progressBar}`);
  }

  /**
   * 🎉 축하 애니메이션
   */
  celebration(message) {
    console.log(this.rainbow("🎉 ✨ 🎊 ✨ 🎉 ✨ 🎊 ✨ 🎉"));
    console.log(this.rainbow(`     ${message}     `));
    console.log(this.rainbow("🎉 ✨ 🎊 ✨ 🎉 ✨ 🎊 ✨ 🎉"));
  }

  /**
   * ⏳ 로딩 애니메이션 시작
   */
  startLoading(message) {
    try {
      const ora = require("ora");
      return ora({
        text: message,
        spinner: {
          interval: 80,
          frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
        },
        color: "cyan",
      }).start();
    } catch (error) {
      // ora 없으면 심플한 로딩
      console.log(chalk.blue(`⏳ ${message}...`));
      return {
        stop: () => {},
        succeed: (msg) => this.success(msg || message),
        fail: (msg) => this.error(msg || `${message} 실패`),
      };
    }
  }

  // ===== 🌐 네트워크 및 데이터베이스 로그 =====

  /**
   * 💾 데이터베이스 로그
   */
  database(operation, collection, details = {}) {
    console.log(chalk.yellow("💾 ") + "─".repeat(40));
    console.log(chalk.yellow(`💾 DB ${operation}: ${collection}`));

    if (details.query) {
      console.log(chalk.gray(`   쿼리: ${JSON.stringify(details.query)}`));
    }
    if (details.result) {
      console.log(chalk.green(`   결과: ${details.result}`));
    }
    if (details.duration) {
      console.log(chalk.blue(`   소요시간: ${details.duration}ms`));
    }

    console.log(chalk.yellow("💾 ") + "─".repeat(40));
  }

  /**
   * 🌐 네트워크 로그
   */
  network(action, url, status) {
    const statusColor =
      status >= 200 && status < 300
        ? chalk.green
        : status >= 300 && status < 400
        ? chalk.yellow
        : chalk.red;

    console.log(chalk.cyan("🌐 ") + "─".repeat(40));
    console.log(chalk.cyan(`🌐 ${action}: ${url}`));
    console.log(`   ${statusColor(`상태: ${status}`)}`);
    console.log(chalk.cyan("🌐 ") + "─".repeat(40));
  }

  // ===== 📊 통계 및 모니터링 =====

  /**
   * 📊 통계 정보 출력
   */
  showStats() {
    const uptime = Date.now() - this.stats.startTime;
    const uptimeStr = this.#formatDuration(uptime);

    console.log(this.rainbow("📊 ═══ Logger 통계 ═══"));
    console.log(chalk.blue(`   🕐 실행 시간: ${uptimeStr}`));
    console.log(chalk.green(`   📝 총 로그: ${this.stats.totalLogs}개`));
    console.log(chalk.cyan(`   📱 메시지 전송: ${this.stats.messagesSent}개`));
    console.log(chalk.red(`   ❌ 에러 처리: ${this.stats.errorsHandled}개`));

    if (this.stats.moduleUsage.size > 0) {
      console.log(chalk.yellow("   📦 모듈 사용량:"));
      for (const [module, count] of this.stats.moduleUsage) {
        const emoji = this.messageSystem.emojiSets.modules[module] || "📦";
        console.log(chalk.gray(`      ${emoji} ${module}: ${count}회`));
      }
    }

    console.log(this.rainbow("📊 ══════════════════"));
  }

  /**
   * 🎯 Message 시스템 통계
   */
  getMessageStats() {
    return this.messageSystem.getStats();
  }

  // ===== 🛠️ 내부 헬퍼 메서드들 =====

  #formatEnhancedLog(level, message, data) {
    const style = this.styles[level];
    const timestamp = this.#getTimestamp();
    const cleanMessage = this.#sanitize(message);

    let output = `${timestamp} ${style.badge} ${style.icon} ${style.color(
      cleanMessage
    )}`;

    if (data) {
      output += "\n" + this.#formatData(data, level);
    }

    return output;
  }

  #formatData(data, level) {
    const cleanData = this.#sanitize(JSON.stringify(data, null, 2));
    const style = this.styles[level];

    return cleanData
      .split("\n")
      .map((line) => chalk.gray("    │ ") + style.color(line))
      .join("\n");
  }

  #getTimestamp() {
    return chalk.gray(`[${new Date().toLocaleTimeString("ko-KR")}]`);
  }

  #sanitize(message) {
    if (!message) return "";
    return message
      .toString()
      .replace(/mongodb:\/\/[^:\s]+:[^@\s]+@[^\s]+/g, "mongodb://***:***@***")
      .replace(/\d{6,}/g, (match) => match.substring(0, 3) + "***")
      .replace(/[a-zA-Z0-9_-]{32,}/g, "***API_KEY***");
  }

  #formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}시간 ${minutes % 60}분`;
    if (minutes > 0) return `${minutes}분 ${seconds % 60}초`;
    return `${seconds}초`;
  }

  #updateModuleStats(moduleName) {
    const current = this.stats.moduleUsage.get(moduleName) || 0;
    this.stats.moduleUsage.set(moduleName, current + 1);
  }

  // ===== 🎯 봇 메시지 통합 메서드들 (Message 시스템에서 주입됨) =====
  // sendMainMenu, sendTodoList, sendSuccess, sendError, sendLoading, updateLoading
  // 이미 LoggerEnhancer에서 주입됨!

  // ===== 🧹 정리 작업 =====
  cleanup() {
    this.showStats();
    console.log(this.rainbow("🌈 Enhanced Logger 종료됨"));
  }
}

// ========================================
// 🎯 싱글톤 인스턴스 관리
// ========================================

let loggerInstance = null;

/**
 * 🎯 Logger 인스턴스 가져오기 (싱글톤)
 */
function getInstance() {
  if (!loggerInstance) {
    loggerInstance = new EnhancedLogger();
  }
  return loggerInstance;
}

// ========================================
// 🚀 모듈 내보내기
// ========================================

module.exports = getInstance();
