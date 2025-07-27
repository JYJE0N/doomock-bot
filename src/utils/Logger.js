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

    // 🛡️ 보안 마스킹 시스템
    this.securityMasks = {
      enabled: process.env.SECURITY_MASK !== "false", // 기본 활성화
      patterns: this.initSecurityPatterns(),
      customMasks: new Map(), // 사용자 정의 마스킹 패턴
    };

    // 📊 보안 통계
    this.securityStats = {
      maskedItems: 0,
      suspiciousPatterns: 0,
      dataBreachPrevented: 0,
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

  /**
   * 🛡️ 보안 패턴 초기화
   */
  initSecurityPatterns() {
    return {
      // 데이터베이스 관련
      mongodb: /mongodb:\/\/[^:\s]+:[^@\s]+@[^\s]+/g,
      postgresql: /postgresql:\/\/[^:\s]+:[^@\s]+@[^\s]+/g,
      redis: /redis:\/\/[^:\s]*:[^@\s]*@[^\s]+/g,

      // 토큰 및 키
      jwtToken: /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g,
      bearerToken:
        /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g,
      apiKey: /[a-zA-Z0-9_-]{32,}/g,
      openaiKey: /sk-[a-zA-Z0-9]{32,}/g,
      githubToken: /gho_[a-zA-Z0-9]{36}/g,
      telegramToken: /\d{8,10}:[A-Za-z0-9_-]{35}/g,

      // 개인정보
      email: /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
      ssn: /\b\d{6}[\s-]?\d{7}\b/g, // 한국 주민등록번호
      phone: /\b01[0-9][\s-]?\d{3,4}[\s-]?\d{4}\b/g, // 한국 전화번호

      // JSON 필드
      password: /"password"\s*:\s*"[^"]*"/gi,
      token: /"token"\s*:\s*"[^"]*"/gi,
      secret: /"secret"\s*:\s*"[^"]*"/gi,
    };
  }

  /**
   * 🛡️ 커스텀 마스킹 패턴 추가
   */
  addCustomMask(name, pattern, replacement = "***MASKED***") {
    this.securityMasks.customMasks.set(name, {
      pattern: new RegExp(pattern, "g"),
      replacement,
    });
    console.log(chalk.green(`🛡️ 커스텀 마스킹 패턴 추가: ${name}`));
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
   * 📊 보안 통계 포함 통계 정보 출력
   */
  showStats() {
    const uptime = Date.now() - this.stats.startTime;
    const uptimeStr = this.#formatDuration(uptime);

    console.log(this.rainbow("📊 ═══ Enhanced Logger 통계 ═══"));
    console.log(chalk.blue(`   🕐 실행 시간: ${uptimeStr}`));
    console.log(chalk.green(`   📝 총 로그: ${this.stats.totalLogs}개`));
    console.log(chalk.cyan(`   📱 메시지 전송: ${this.stats.messagesSent}개`));
    console.log(chalk.red(`   ❌ 에러 처리: ${this.stats.errorsHandled}개`));

    // 🛡️ 보안 통계
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
    console.log(
      chalk.cyan(`   🔧 커스텀 패턴: ${this.securityMasks.customMasks.size}개`)
    );

    if (this.stats.moduleUsage.size > 0) {
      console.log(chalk.yellow("   📦 모듈 사용량:"));
      for (const [module, count] of this.stats.moduleUsage) {
        const emoji = this.messageSystem.emojiSets.modules[module] || "📦";
        console.log(chalk.gray(`      ${emoji} ${module}: ${count}회`));
      }
    }

    console.log(this.rainbow("📊 ══════════════════════════"));
  }

  /**
   * 🛡️ 보안 설정 관리
   */
  security = {
    // 마스킹 활성화/비활성화
    enable: () => {
      this.securityMasks.enabled = true;
      console.log(chalk.green("🛡️ 보안 마스킹이 활성화되었습니다."));
    },

    disable: () => {
      this.securityMasks.enabled = false;
      console.log(chalk.red("⚠️ 보안 마스킹이 비활성화되었습니다!"));
    },

    // 커스텀 패턴 추가
    addPattern: (name, pattern, replacement) => {
      this.addCustomMask(name, pattern, replacement);
    },

    // 보안 통계 조회
    getStats: () => this.securityStats,

    // 보안 테스트
    test: (testString) => {
      console.log(chalk.blue("🔍 보안 마스킹 테스트:"));
      console.log(chalk.gray("원본: "), testString);
      console.log(chalk.green("마스킹: "), this.#sanitize(testString));
    },
  };

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

  /**
   * 🔐 Enhanced 보안 마스킹 시스템
   */
  #sanitize(message) {
    if (!message) return "";

    let sanitized = message.toString();
    let maskedCount = 0;

    // 🔍 보안 이슈 스캔
    this.#scanForSecurityIssues(sanitized);

    // 🛡️ 기본 마스킹이 비활성화된 경우 원본 반환
    if (!this.securityMasks.enabled) {
      return sanitized;
    }

    // 🔐 데이터베이스 연결 문자열 마스킹
    if (sanitized.match(/mongodb:\/\/[^:\s]+:[^@\s]+@[^\s]+/g)) {
      sanitized = sanitized.replace(
        /mongodb:\/\/[^:\s]+:[^@\s]+@[^\s]+/g,
        "mongodb://***:***@***"
      );
      maskedCount++;
      this.securityStats.dataBreachPrevented++;
    }

    if (sanitized.match(/postgresql:\/\/[^:\s]+:[^@\s]+@[^\s]+/g)) {
      sanitized = sanitized.replace(
        /postgresql:\/\/[^:\s]+:[^@\s]+@[^\s]+/g,
        "postgresql://***:***@***"
      );
      maskedCount++;
      this.securityStats.dataBreachPrevented++;
    }

    if (sanitized.match(/redis:\/\/[^:\s]*:[^@\s]*@[^\s]+/g)) {
      sanitized = sanitized.replace(
        /redis:\/\/[^:\s]*:[^@\s]*@[^\s]+/g,
        "redis://***:***@***"
      );
      maskedCount++;
      this.securityStats.dataBreachPrevented++;
    }

    // 🔐 JWT 토큰 마스킹
    if (
      sanitized.match(
        /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g
      )
    ) {
      sanitized = sanitized.replace(
        /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g,
        "Bearer ***JWT_TOKEN***"
      );
      maskedCount++;
      this.securityStats.dataBreachPrevented++;
    }

    if (
      sanitized.match(/eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g)
    ) {
      sanitized = sanitized.replace(
        /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g,
        "***JWT_TOKEN***"
      );
      maskedCount++;
      this.securityStats.dataBreachPrevented++;
    }

    // 🔐 특수 API 키 패턴들
    if (sanitized.match(/sk-[a-zA-Z0-9]{32,}/g)) {
      sanitized = sanitized.replace(/sk-[a-zA-Z0-9]{32,}/g, "***OPENAI_KEY***");
      maskedCount++;
      this.securityStats.dataBreachPrevented++;
    }

    if (sanitized.match(/xapp-[a-zA-Z0-9]{32,}/g)) {
      sanitized = sanitized.replace(/xapp-[a-zA-Z0-9]{32,}/g, "***XAPP_KEY***");
      maskedCount++;
      this.securityStats.dataBreachPrevented++;
    }

    if (sanitized.match(/gho_[a-zA-Z0-9]{36}/g)) {
      sanitized = sanitized.replace(
        /gho_[a-zA-Z0-9]{36}/g,
        "***GITHUB_TOKEN***"
      );
      maskedCount++;
      this.securityStats.dataBreachPrevented++;
    }

    // 🔐 Telegram Bot Token 마스킹
    if (sanitized.match(/\d{8,10}:[A-Za-z0-9_-]{35}/g)) {
      sanitized = sanitized.replace(
        /\d{8,10}:[A-Za-z0-9_-]{35}/g,
        "***TELEGRAM_BOT_TOKEN***"
      );
      maskedCount++;
      this.securityStats.dataBreachPrevented++;
    }

    // 🔐 이메일 마스킹 (부분)
    sanitized = sanitized.replace(
      /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      (match, user, domain) => {
        maskedCount++;
        const maskedUser =
          user.length > 2 ? user.substring(0, 2) + "***" : "***";
        return `${maskedUser}@${domain}`;
      }
    );

    // 🔐 신용카드 번호 마스킹
    if (sanitized.match(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g)) {
      sanitized = sanitized.replace(
        /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
        "****-****-****-****"
      );
      maskedCount++;
      this.securityStats.dataBreachPrevented++;
    }

    // 🔐 주민등록번호 마스킹 (한국)
    if (sanitized.match(/\b\d{6}[\s-]?\d{7}\b/g)) {
      sanitized = sanitized.replace(/\b\d{6}[\s-]?\d{7}\b/g, "******-*******");
      maskedCount++;
      this.securityStats.dataBreachPrevented++;
    }

    // 🔐 전화번호 마스킹 (한국)
    if (sanitized.match(/\b01[0-9][\s-]?\d{3,4}[\s-]?\d{4}\b/g)) {
      sanitized = sanitized.replace(
        /\b01[0-9][\s-]?\d{3,4}[\s-]?\d{4}\b/g,
        "010-****-****"
      );
      maskedCount++;
    }

    // 🔐 JSON 필드 마스킹
    const jsonFields = [
      { field: "password", replacement: "***MASKED***" },
      { field: "passwd", replacement: "***MASKED***" },
      { field: "pwd", replacement: "***MASKED***" },
      { field: "token", replacement: "***MASKED***" },
      { field: "access_token", replacement: "***MASKED***" },
      { field: "refresh_token", replacement: "***MASKED***" },
      { field: "api_key", replacement: "***MASKED***" },
      { field: "secret", replacement: "***MASKED***" },
      { field: "private_key", replacement: "***MASKED***" },
    ];

    for (const { field, replacement } of jsonFields) {
      const pattern = new RegExp(`"${field}"\\s*:\\s*"[^"]*"`, "gi");
      if (sanitized.match(pattern)) {
        sanitized = sanitized.replace(pattern, `"${field}": "${replacement}"`);
        maskedCount++;
        this.securityStats.dataBreachPrevented++;
      }
    }

    // 🔐 일반 API 키 패턴 마스킹 (길이 32자 이상)
    sanitized = sanitized.replace(/\b[a-zA-Z0-9_-]{32,}\b/g, (match) => {
      // 이미 마스킹된 것은 건드리지 않음
      if (match.includes("***")) return match;
      maskedCount++;
      return "***API_KEY***";
    });

    // 🔐 긴 숫자 시퀀스 마스킹 (6자리 이상)
    sanitized = sanitized.replace(/\b\d{6,}\b/g, (match) => {
      maskedCount++;
      return match.length > 8
        ? match.substring(0, 3) + "***" + match.substring(match.length - 2)
        : match.substring(0, 3) + "***";
    });

    // 🔐 커스텀 마스킹 패턴 적용
    for (const [name, { pattern, replacement }] of this.securityMasks
      .customMasks) {
      if (sanitized.match(pattern)) {
        sanitized = sanitized.replace(pattern, replacement);
        maskedCount++;
        console.log(chalk.yellow(`🛡️ 커스텀 마스킹 적용: ${name}`));
      }
    }

    // 📊 마스킹 통계 업데이트
    if (maskedCount > 0) {
      this.securityStats.maskedItems += maskedCount;
      console.log(chalk.yellow(`🛡️ ${maskedCount}개 보안 정보 마스킹됨`));
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
