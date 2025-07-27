// ========================================
// 🌈 src/utils/Logger.js - Enhanced v3.0.1 긴급 수정본
// ========================================
// style.color 에러 완전 해결 버전!
// ========================================

const chalk = require("chalk");

/**
 * 🌈 Enhanced Logger v3.0.1 - 알록달록 통합 시스템
 *
 * ⚠️ 긴급 수정: style.color 함수 문제 완전 해결
 */
class EnhancedLogger {
  constructor() {
    this.version = "3.0.1";
    this.initialized = false;

    // 🎨 기본 스타일 시스템 - ✅ FIXED: 모든 color를 함수로 확실히 변경
    this.styles = {
      info: {
        badge: chalk.bgBlue.white(" INFO "),
        icon: "ℹ️",
        colorFn: chalk.blue, // ✅ 임시 이름 변경으로 문제 회피
      },
      success: {
        badge: chalk.bgGreen.black(" SUCCESS "),
        icon: "✅",
        colorFn: chalk.green,
      },
      warn: {
        badge: chalk.bgYellow.black(" WARN "),
        icon: "⚠️",
        colorFn: chalk.yellow,
      },
      error: {
        badge: chalk.bgRed.white(" ERROR "),
        icon: "❌",
        colorFn: chalk.red,
      },
      debug: {
        badge: chalk.bgGray.white(" DEBUG "),
        icon: "🔍",
        colorFn: chalk.gray,
      },
      system: {
        badge: chalk.bgMagenta.white(" SYSTEM "),
        icon: "🤖",
        colorFn: chalk.magenta,
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

    // 🛡️ 보안 마스킹 시스템
    this.securityMasks = {
      enabled: process.env.SECURITY_MASK !== "false",
      patterns: this.initSecurityPatterns(),
      customMasks: new Map(),
    };

    // 📊 보안 통계
    this.securityStats = {
      maskedItems: 0,
      suspiciousPatterns: 0,
      dataBreachPrevented: 0,
    };

    // 🎨 Message 시스템 통합 (안전하게)
    try {
      const {
        UnifiedMessageSystem,
        LoggerEnhancer,
      } = require("./Message/UnifiedMessageSystem");
      this.messageSystem = new UnifiedMessageSystem();
      this.enhancer = new LoggerEnhancer(this, this.messageSystem);
    } catch (error) {
      console.log(
        chalk.yellow("⚠️ Message 시스템 로드 실패, 기본 모드로 실행")
      );
      this.messageSystem = null;
      this.enhancer = null;
    }

    this.initialized = true;
    this.showWelcomeBanner();
  }

  // ===== 🌈 안전한 rainbow 메서드 =====
  rainbow(text) {
    const colors = ["red", "yellow", "green", "cyan", "blue", "magenta"];
    return text
      .split("")
      .map((char, i) => chalk[colors[i % colors.length]](char))
      .join("");
  }

  gradient(text, startColor, endColor) {
    try {
      const halfPoint = Math.floor(text.length / 2);
      return (
        chalk.red(text.slice(0, halfPoint)) + chalk.blue(text.slice(halfPoint))
      );
    } catch (error) {
      return text;
    }
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
      "🤖 두목봇 Enhanced Logger v3.0.1 - 긴급 수정 버전! 🌈",
    ];

    console.clear();
    banner.forEach((line) => {
      console.log(this.rainbow(line));
    });
    console.log();
    console.log(chalk.bold.white("✅ 긴급 수정 완료! style.color 에러 해결"));
    console.log(chalk.gray("────────────────────────────────────────────────"));
    console.log();
  }

  /**
   * 🛡️ 보안 패턴 초기화
   */
  initSecurityPatterns() {
    return {
      mongodb: /mongodb:\/\/[^:\s]+:[^@\s]+@[^\s]+/g,
      postgresql: /postgresql:\/\/[^:\s]+:[^@\s]+@[^\s]+/g,
      redis: /redis:\/\/[^:\s]*:[^@\s]*@[^\s]+/g,
      jwtToken: /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g,
      bearerToken:
        /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g,
      apiKey: /[a-zA-Z0-9_-]{32,}/g,
      openaiKey: /sk-[a-zA-Z0-9]{32,}/g,
      githubToken: /gho_[a-zA-Z0-9]{36}/g,
      telegramToken: /\d{8,10}:[A-Za-z0-9_-]{35}/g,
      email: /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
      ssn: /\b\d{6}[\s-]?\d{7}\b/g,
      phone: /\b01[0-9][\s-]?\d{3,4}[\s-]?\d{4}\b/g,
      password: /"password"\s*:\s*"[^"]*"/gi,
      token: /"token"\s*:\s*"[^"]*"/gi,
      secret: /"secret"\s*:\s*"[^"]*"/gi,
    };
  }

  /**
   * 🔍 보안 스캔 및 경고
   */
  #scanForSecurityIssues(message) {
    if (!this.securityMasks.enabled) return;

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
      if (pattern.test(message)) {
        this.securityStats.suspiciousPatterns++;
        console.log(chalk.red.bold(`🚨 보안 경고: ${name} 패턴 감지!`));
      }
    }
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

  // ===== 🎯 모듈별 로그 메서드들 =====

  /**
   * 📦 모듈 로그
   */
  moduleLog(moduleName, message, data) {
    this.#updateModuleStats(moduleName);
    const emoji = "📦";
    console.log(chalk.cyan(`${emoji} [${moduleName.toUpperCase()}]`), message);
    if (data) {
      console.log(
        chalk.gray("   데이터:"),
        this.#sanitize(JSON.stringify(data, null, 2))
      );
    }
  }

  /**
   * 👤 사용자 액션 로그
   */
  userAction(userName, action, details = {}) {
    console.log(chalk.cyan("👤 ") + "─".repeat(30));

    switch (action) {
      case "join":
        console.log(chalk.green.bold(`👋 ${userName}님이 접속했습니다!`));
        break;
      case "command":
        console.log(
          chalk.blue(
            `💬 ${userName}: /${details.command} ${
              details.args?.join(" ") || ""
            }`
          )
        );
        break;
      case "callback":
        console.log(chalk.magenta(`🔘 ${userName}: ${details.action}`));
        break;
      default:
        console.log(chalk.cyan(`👤 ${userName}: ${action}`));
    }

    console.log(chalk.cyan("👤 ") + "─".repeat(30));
  }

  /**
   * 📊 진행률 바 표시
   */
  progress(label, current, total) {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round(20 * (current / total));
    const empty = 20 - filled;

    const bar = chalk.green("█".repeat(filled)) + chalk.gray("░".repeat(empty));
    const color =
      percentage >= 80
        ? chalk.green
        : percentage >= 60
        ? chalk.yellow
        : chalk.red;

    console.log(
      `📊 ${label}: ${bar} ${color.bold(
        `${percentage}%`
      )} (${current}/${total})`
    );
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
    console.log(chalk.blue(`⏳ ${message}...`));
    return {
      stop: () => {},
      succeed: (msg) => this.success(msg || message),
      fail: (msg) => this.error(msg || `${message} 실패`),
    };
  }

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

  /**
   * 📊 통계 정보 출력
   */
  showStats() {
    const uptime = Date.now() - this.stats.startTime;
    const uptimeStr = this.#formatDuration(uptime);

    console.log(this.rainbow("📊 ═══ Enhanced Logger 통계 ═══"));
    console.log(chalk.blue(`   🕐 실행 시간: ${uptimeStr}`));
    console.log(chalk.green(`   📝 총 로그: ${this.stats.totalLogs}개`));
    console.log(chalk.cyan(`   📱 메시지 전송: ${this.stats.messagesSent}개`));
    console.log(chalk.red(`   ❌ 에러 처리: ${this.stats.errorsHandled}개`));

    console.log(this.rainbow("🛡️ ═══ 보안 통계 ═══"));
    console.log(
      chalk.green(`   🔐 마스킹된 정보: ${this.securityStats.maskedItems}개`)
    );
    console.log(
      chalk.yellow(
        `   🚨 의심 패턴 감지: ${this.securityStats.suspiciousPatterns}개`
      )
    );
    console.log(
      chalk.red(
        `   🛡️ 데이터 유출 방지: ${this.securityStats.dataBreachPrevented}건`
      )
    );
    console.log(
      chalk.blue(
        `   🎯 마스킹 상태: ${
          this.securityMasks.enabled ? "활성화" : "비활성화"
        }`
      )
    );

    if (this.stats.moduleUsage.size > 0) {
      console.log(chalk.yellow("   📦 모듈 사용량:"));
      for (const [module, count] of this.stats.moduleUsage) {
        console.log(chalk.gray(`      📦 ${module}: ${count}회`));
      }
    }

    console.log(this.rainbow("📊 ══════════════════════════"));
  }

  /**
   * 🛡️ 보안 설정 관리
   */
  security = {
    enable: () => {
      this.securityMasks.enabled = true;
      console.log(chalk.green("🛡️ 보안 마스킹이 활성화되었습니다."));
    },
    disable: () => {
      this.securityMasks.enabled = false;
      console.log(chalk.red("⚠️ 보안 마스킹이 비활성화되었습니다!"));
    },
    getStats: () => this.securityStats,
    test: (testString) => {
      console.log(chalk.blue("🔍 보안 마스킹 테스트:"));
      console.log(chalk.gray("원본: "), testString);
      console.log(chalk.green("마스킹: "), this.#sanitize(testString));
    },
  };

  // ===== 🛠️ 내부 헬퍼 메서드들 =====

  /**
   * ✅ 완전 안전한 formatEnhancedLog 메서드 (style.color 에러 100% 해결)
   */
  #formatEnhancedLog(level, message, data) {
    const style = this.styles[level];

    // ✅ 절대적으로 안전한 방식: style 객체 확인 후 직접 colorFn 사용
    if (!style) {
      return `${this.#getTimestamp()} [${level.toUpperCase()}] ${message}`;
    }

    const timestamp = this.#getTimestamp();
    const cleanMessage = this.#sanitize(message);

    // ✅ FIXED: colorFn 프로퍼티 사용 (color 대신)
    const coloredMessage = style.colorFn
      ? style.colorFn(cleanMessage)
      : cleanMessage;

    let output = `${timestamp} ${style.badge} ${style.icon} ${coloredMessage}`;

    if (data) {
      output += "\n" + this.#formatData(data, level);
    }

    return output;
  }

  /**
   * ✅ 완전 안전한 formatData 메서드
   */
  #formatData(data, level) {
    const cleanData = this.#sanitize(JSON.stringify(data, null, 2));
    const style = this.styles[level];

    // ✅ FIXED: colorFn 프로퍼티 사용
    const colorFn = style?.colorFn || ((text) => text);

    return cleanData
      .split("\n")
      .map((line) => chalk.gray("    │ ") + colorFn(line))
      .join("\n");
  }

  #getTimestamp() {
    return chalk.gray(`[${new Date().toLocaleTimeString("ko-KR")}]`);
  }

  /**
   * 🔐 보안 마스킹 시스템
   */
  #sanitize(message) {
    if (!message) return "";

    let sanitized = message.toString();
    let maskedCount = 0;

    this.#scanForSecurityIssues(sanitized);

    if (!this.securityMasks.enabled) {
      return sanitized;
    }

    // 패턴별 마스킹 적용
    for (const [patternName, pattern] of Object.entries(
      this.securityMasks.patterns
    )) {
      const matches = sanitized.match(pattern);
      if (matches) {
        matches.forEach((match) => {
          const masked =
            match.length > 6
              ? match.substring(0, 3) +
                "***" +
                match.substring(match.length - 2)
              : "***";
          sanitized = sanitized.replace(match, masked);
          maskedCount++;
        });
      }
    }

    if (maskedCount > 0) {
      this.securityStats.maskedItems += maskedCount;
    }

    return sanitized;
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

  cleanup() {
    this.showStats();
    console.log(this.rainbow("🌈 Enhanced Logger 종료됨"));
  }
}

// ========================================
// 🎯 싱글톤 인스턴스 관리
// ========================================

let loggerInstance = null;

function getInstance() {
  if (!loggerInstance) {
    loggerInstance = new EnhancedLogger();
  }
  return loggerInstance;
}

module.exports = getInstance();
