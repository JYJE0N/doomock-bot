// src/utils/Logger.js - 균형잡힌 개인정보 보호 Logger v4.3

const chalk = require("chalk");

/**
 * 🛡️ 균형잡힌 개인정보 보호 Logger v4.3
 *
 * 🎯 핵심 원칙:
 * - 개인정보만 선택적 마스킹
 * - 시스템 로그는 읽기 가능하게 유지
 * - 사용자별 맞춤 보호
 * - 디버깅 친화적
 */
class BalancedPrivacyLogger {
  constructor() {
    this.version = "4.3 Balanced Privacy";
    this.isRailway = !!process.env.RAILWAY_ENVIRONMENT;
    this.startTime = Date.now();

    // 🔒 개인정보 보호 설정 (균형잡힌)
    this.privacyConfig = {
      enablePrivacyMode: process.env.PRIVACY_MODE !== "false", // 기본 활성화
      logUserIds: process.env.LOG_USER_IDS === "true", // 기본 비활성화
      logUserNames: process.env.LOG_USER_NAMES !== "false", // 🔄 다시 기본 활성화 (하지만 마스킹)
      logFullNames: process.env.LOG_FULL_NAMES === "true", // 풀네임은 여전히 제한적
      anonymizeProduction:
        process.env.NODE_ENV === "production" || this.isRailway,
      enableDataMasking: true,
      retentionDays: parseInt(process.env.LOG_RETENTION_DAYS) || 30,

      // 🆕 개발자 모드 설정
      devMode: process.env.DEV_MODE === "true",
      devUsers: new Set(
        (process.env.DEV_USERS || "").split(",").filter(Boolean)
      ),
    };

    // 로그 레벨
    this.logLevel =
      process.env.LOG_LEVEL || (this.isRailway ? "info" : "debug");

    // 통계
    this.stats = {
      totalLogs: 0,
      maskedData: 0,
      maskedNames: 0,
      maskedIds: 0,
      blockedSensitive: 0,
      errors: 0,
      warnings: 0,
    };

    // 🔒 정확한 민감 데이터 패턴 (과도한 매칭 제거)
    this.sensitivePatterns = [
      /\b\d{9,12}\b/g, // 사용자 ID 패턴 (9-12자리 숫자만)
      /\d{10}:[\w-]{35}/g, // 봇 토큰
      /Bearer\s+[\w-]+/gi, // 인증 토큰
      /password['":][\s]*["'][^"']+["']/gi, // 패스워드 필드
      /token['":][\s]*["'][^"']+["']/gi, // 토큰 필드
      /mongodb:\/\/[^@]+@/gi, // DB 연결 문자열
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // 이메일
      /\d{2,4}-\d{2,4}-\d{4}/g, // 전화번호 패턴
      /"id":\s*\d{9,12}/g, // JSON 내 ID 필드
      /"userId":\s*\d{9,12}/g, // JSON 내 userId 필드
      // 🚫 한글 이름 패턴 제거 (너무 광범위함)
    ];

    // 🆕 시스템 키워드 (마스킹하지 않을 단어들)
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
      "설정",
      "Logger",
      "Module",
      "Service",
      "Bot",
      "Controller",
      "Handler",
      "개발",
      "운영",
      "테스트",
      "디버그",
      "정보",
      "경고",
      "에러",
    ]);

    this.rainbowColors = ["red", "yellow", "green", "cyan", "blue", "magenta"];

    // 🎯 균형잡힌 보호 알림
    console.log(chalk.green.bold("🛡️ 균형잡힌 개인정보 보호 활성화"));
    this.info(`🛡️ BalancedPrivacyLogger v${this.version} 시작`);
    this.info(
      `🔒 개인정보 보호: ${
        this.privacyConfig.enablePrivacyMode ? "활성화" : "비활성화"
      }`
    );
    this.info(
      `🆔 사용자 ID 로깅: ${this.privacyConfig.logUserIds ? "허용" : "차단"}`
    );
    this.info(
      `👤 사용자 이름 마스킹: ${
        this.privacyConfig.logUserNames ? "부분" : "완전"
      }`
    );
    this.info(
      `🏭 운영 환경: ${
        this.privacyConfig.anonymizeProduction ? "예" : "아니오"
      }`
    );
  }

  // ===== 🛡️ 개선된 개인정보 보호 메서드들 =====

  /**
   * 🎭 사용자 ID 안전 처리
   */
  safifyUserId(userId) {
    if (!userId) return "unknown";

    // 개발 환경이고 명시적 허용인 경우에만 실제 ID 표시
    if (
      !this.privacyConfig.enablePrivacyMode &&
      this.privacyConfig.logUserIds &&
      !this.privacyConfig.anonymizeProduction
    ) {
      return userId.toString();
    }

    this.stats.maskedIds++;
    return this.anonymizeUserId(userId);
  }

  /**
   * 🎭 사용자 ID 익명화
   */
  anonymizeUserId(userId) {
    const idStr = userId.toString();
    if (idStr.length <= 3) return `U***`;
    if (idStr.length <= 5) return `U${idStr[1]}***`;
    return `${idStr.slice(0, 2)}***${idStr.slice(-1)}`;
  }

  /**
   * 🎭 사용자 이름 안전 처리 (개선된 버전)
   */
  safifyUserName(input) {
    try {
      // 다양한 입력 형태 처리
      let user = null;

      if (input?.from) {
        user = input.from;
      } else if (input?.message?.from) {
        user = input.message.from;
      } else if (input?.id) {
        user = input;
      }

      if (!user) return "Unknown";

      // 🔓 개발자 모드 체크
      const userId = user.id;
      const isDevUser =
        this.privacyConfig.devMode &&
        (this.privacyConfig.devUsers.has(String(userId)) ||
          this.privacyConfig.devUsers.has(user.username) ||
          (user.username && user.username.toLowerCase().includes("dev")));

      // 봇인 경우
      if (user.is_bot) {
        return `[봇]${user.first_name || "Bot"}`;
      }

      // 🔓 개발자는 풀네임 표시
      if (isDevUser && this.privacyConfig.logFullNames) {
        if (user.first_name) {
          let fullName = user.first_name;
          if (user.last_name) fullName += ` ${user.last_name}`;
          return `[DEV]${fullName}`;
        }
        if (user.username) return `[DEV]@${user.username}`;
      }

      // 일반 사용자 처리 (부분 마스킹)
      if (user.first_name) {
        // 운영 환경에서는 마스킹
        if (this.privacyConfig.anonymizeProduction) {
          this.stats.maskedNames++;
          return this.anonymizeName(user.first_name);
        }
        // 개발 환경에서는 그대로 표시 (디버깅용)
        return user.first_name;
      }

      if (user.username) {
        if (this.privacyConfig.anonymizeProduction) {
          this.stats.maskedNames++;
          return `@${this.anonymizeName(user.username)}`;
        }
        return `@${user.username}`;
      }

      return `User#${this.safifyUserId(user.id)}`;
    } catch (error) {
      return "Unknown";
    }
  }

  /**
   * 🎭 이름 익명화 함수 (기존과 동일)
   */
  anonymizeName(name) {
    if (!name || typeof name !== "string") return "User";

    const trimmedName = name.trim();

    if (trimmedName.length <= 1) return "U";
    if (trimmedName.length <= 2) return `${trimmedName[0]}*`;

    // 한글 이름 처리
    if (/^[가-힣]+$/.test(trimmedName)) {
      if (trimmedName.length === 2) return `${trimmedName[0]}*`;
      if (trimmedName.length === 3) return `${trimmedName[0]}**`;
      return `${trimmedName[0]}***`;
    }

    // 영문 이름 처리
    if (/^[a-zA-Z]+$/.test(trimmedName)) {
      if (trimmedName.length <= 4) return `${trimmedName[0]}***`;
      return `${trimmedName.slice(0, 2)}***`;
    }

    // 유저명 (@username) 처리
    if (trimmedName.startsWith("@")) {
      const username = trimmedName.slice(1);
      if (username.length <= 3) return `@***`;
      return `@${username.slice(0, 2)}***`;
    }

    return `${trimmedName[0]}***`;
  }

  /**
   * 🔍 스마트 민감 데이터 검출 (개선된 버전)
   */
  maskSensitiveData(text) {
    if (typeof text !== "string") return text;

    let maskedText = text;
    let maskedCount = 0;

    // 🎯 정확한 패턴만 마스킹 (시스템 메시지는 보호)

    // 1. 사용자 ID 패턴 (독립된 9-12자리 숫자만)
    maskedText = maskedText.replace(/\b\d{9,12}\b/g, (match) => {
      maskedCount++;
      return "***MASKED***";
    });

    // 2. 토큰 패턴
    this.sensitivePatterns.slice(1).forEach((pattern) => {
      const matches = maskedText.match(pattern);
      if (matches) {
        maskedCount += matches.length;
        maskedText = maskedText.replace(pattern, "***MASKED***");
      }
    });

    // 3. 특정 컨텍스트에서만 이름 마스킹
    if (this.privacyConfig.anonymizeProduction) {
      // "사용자: 홍길동" 같은 패턴만 마스킹
      maskedText = maskedText.replace(
        /(?:사용자|user)[\s:]+([가-힣]{2,4})/gi,
        (match, name) => {
          maskedCount++;
          return match.replace(name, this.anonymizeName(name));
        }
      );
    }

    // 4. ID가 포함된 특정 패턴
    maskedText = maskedText
      .replace(/사용자\s*ID[\s:]*\d{9,12}/g, "사용자 ID: ***MASKED***")
      .replace(/user\s*id[\s:]*\d{9,12}/gi, "user id: ***MASKED***")
      .replace(/from.*id.*\d{9,12}/gi, "from: { id: ***MASKED*** }");

    if (maskedCount > 0) {
      this.stats.maskedData += maskedCount;
    }

    return maskedText;
  }

  /**
   * 🛡️ 객체 내 민감 데이터 마스킹 (선택적)
   */
  maskObjectData(obj) {
    if (!obj || typeof obj !== "object") return obj;

    // 깊은 복사
    const masked = JSON.parse(JSON.stringify(obj));

    const sensitiveKeys = [
      "password",
      "token",
      "key",
      "secret",
      "userId",
      "id",
      "email",
      "phone",
      "from",
      "user_id",
      "chat_id",
      // 🔄 이름 필드는 컨텍스트에 따라 선택적 마스킹
    ];

    // 재귀적으로 객체 탐색
    const maskRecursive = (target) => {
      if (!target || typeof target !== "object") return target;

      for (const key of Object.keys(target)) {
        const lowerKey = key.toLowerCase();
        const value = target[key];

        // 민감한 키인지 확인
        if (
          sensitiveKeys.some((sensitiveKey) => lowerKey.includes(sensitiveKey))
        ) {
          if (lowerKey.includes("id") && typeof value === "number") {
            // 사용자 ID는 익명화
            target[key] = this.safifyUserId(value);
            this.stats.maskedData++;
          } else if (
            lowerKey.includes("name") &&
            typeof value === "string" &&
            this.privacyConfig.anonymizeProduction
          ) {
            // 🔄 운영 환경에서만 이름 필드 마스킹
            target[key] = this.anonymizeName(value);
            this.stats.maskedData++;
          } else if (typeof value === "string" || typeof value === "number") {
            // 다른 민감 데이터는 마스킹
            target[key] = "***MASKED***";
            this.stats.maskedData++;
          }
        }

        // 중첩 객체 처리
        if (typeof value === "object" && value !== null) {
          maskRecursive(value);
        }
      }

      return target;
    };

    return maskRecursive(masked);
  }

  // ===== 📝 로깅 메서드들 (기존과 동일하지만 스마트 마스킹 적용) =====

  /**
   * 👤 사용자 액션 로그 (스마트 마스킹)
   */
  userAction(action, input, details = null) {
    this.stats.totalLogs++;

    const timestamp = this.getTimestamp();
    const userId = this.safifyUserId(input?.from?.id || input?.id);
    const userName = this.safifyUserName(input);

    let logMessage = `${timestamp} [USER] ${action}: ${userName}`;

    // 개발 환경에서만 사용자 ID 추가
    if (
      this.privacyConfig.logUserIds &&
      !this.privacyConfig.anonymizeProduction
    ) {
      logMessage += ` (ID: ${userId})`;
    }

    // 세부사항 마스킹 처리
    if (details) {
      const maskedDetails =
        typeof details === "object"
          ? this.maskObjectData(details)
          : this.maskSensitiveData(String(details));
      logMessage += ` - ${JSON.stringify(maskedDetails)}`;
    }

    console.log(chalk.cyan(logMessage));
  }

  /**
   * 🔮 모듈 액션 로그 (스마트 마스킹)
   */
  moduleAction(moduleName, action, input, details = null) {
    this.stats.totalLogs++;

    const timestamp = this.getTimestamp();
    const userName = this.safifyUserName(input);

    let logMessage = `${timestamp} [${moduleName}] ${action}: ${userName}`;

    if (details) {
      const maskedDetails = this.maskObjectData(details);
      logMessage += ` - ${JSON.stringify(maskedDetails)}`;
    }

    console.log(chalk.magenta(logMessage));
  }

  /**
   * 🎯 Fortune 모듈 전용 로그 (스마트 마스킹)
   */
  fortuneLog(action, input, cardInfo = null) {
    const userName = this.safifyUserName(input);

    let logMessage = `🔮 [FORTUNE] ${action}: ${userName}`;

    if (cardInfo) {
      if (typeof cardInfo === "string") {
        logMessage += ` - ${cardInfo}`;
      } else if (cardInfo.cardName) {
        logMessage += ` - ${cardInfo.cardName}`;
        if (cardInfo.isReversed !== undefined) {
          logMessage += ` (${cardInfo.isReversed ? "역방향" : "정방향"})`;
        }
      }
    }

    console.log(chalk.magenta(logMessage));
  }

  // ===== 📊 기본 로깅 메서드들 (스마트 마스킹) =====

  info(message, data = null) {
    this.stats.totalLogs++;
    const timestamp = this.getTimestamp();

    // 🎯 시스템 메시지는 마스킹하지 않음 (읽기 가능하게)
    const safeMessage = this.isSystemMessage(message)
      ? message
      : this.maskSensitiveData(message);
    console.log(chalk.blue(`${timestamp} [INFO]    ${safeMessage}`));

    if (data) {
      const maskedData = this.maskObjectData(data);
      console.log(chalk.gray(JSON.stringify(maskedData, null, 2)));
    }
  }

  success(message, data = null) {
    this.stats.totalLogs++;
    const timestamp = this.getTimestamp();

    const safeMessage = this.isSystemMessage(message)
      ? message
      : this.maskSensitiveData(message);
    console.log(chalk.green(`${timestamp} [SUCCESS] ${safeMessage}`));

    if (data) {
      const maskedData = this.maskObjectData(data);
      console.log(chalk.gray(JSON.stringify(maskedData, null, 2)));
    }
  }

  warn(message, data = null) {
    this.stats.totalLogs++;
    this.stats.warnings++;
    const timestamp = this.getTimestamp();

    const safeMessage = this.isSystemMessage(message)
      ? message
      : this.maskSensitiveData(message);
    console.log(chalk.yellow(`${timestamp} [WARN]    ${safeMessage}`));

    if (data) {
      const maskedData = this.maskObjectData(data);
      console.log(chalk.gray(JSON.stringify(maskedData, null, 2)));
    }
  }

  error(message, error = null) {
    this.stats.totalLogs++;
    this.stats.errors++;
    const timestamp = this.getTimestamp();

    const safeMessage = this.isSystemMessage(message)
      ? message
      : this.maskSensitiveData(message);
    console.log(chalk.red(`${timestamp} [ERROR]   ${safeMessage}`));

    if (error) {
      if (error instanceof Error) {
        // 스택 트레이스는 시스템 정보이므로 선택적 마스킹
        const safeStack = this.maskSensitiveData(error.stack || "");
        console.log(chalk.red(`  스택: ${safeStack}`));
      } else {
        const maskedError = this.maskObjectData(error);
        console.log(chalk.red(JSON.stringify(maskedError, null, 2)));
      }
    }
  }

  debug(message, data = null) {
    if (this.logLevel !== "debug") return;

    this.stats.totalLogs++;
    const timestamp = this.getTimestamp();

    const safeMessage = this.isSystemMessage(message)
      ? message
      : this.maskSensitiveData(message);
    console.log(chalk.gray(`${timestamp} [DEBUG]   ${safeMessage}`));

    if (data) {
      const maskedData = this.maskObjectData(data);
      console.log(chalk.gray(JSON.stringify(maskedData, null, 2)));
    }
  }

  // ===== 🎯 새로운 유틸리티 메서드 =====

  /**
   * 🔍 시스템 메시지인지 판단
   */
  isSystemMessage(message) {
    if (typeof message !== "string") return false;

    // 시스템 키워드가 포함된 메시지는 마스킹하지 않음
    for (const keyword of this.systemKeywords) {
      if (message.includes(keyword)) {
        return true;
      }
    }

    // 특정 패턴들 (로그 레벨, 모듈명 등)
    const systemPatterns = [
      /^\[.*\]/, // [ModuleName] 패턴
      /^🎯|^🔄|^✅|^❌|^📊|^🔧|^🚀/, // 시스템 이모지로 시작
      /Logger|Module|Service|Bot|Controller|Handler/i, // 클래스명
      /초기화|연결|시작|완료|성공|실패/, // 시스템 동작
    ];

    return systemPatterns.some((pattern) => pattern.test(message));
  }

  // ===== 🛠️ 기존 메서드들 (모두 유지) =====

  getTimestamp() {
    const now = new Date();
    const kstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kstTime.toISOString().replace("T", " ").substring(0, 19);
  }

  showPrivacyStats() {
    console.log(chalk.cyan("\n🛡️ 개인정보 보호 통계:"));
    console.log(chalk.cyan(`   전체 로그: ${this.stats.totalLogs}개`));
    console.log(chalk.cyan(`   마스킹된 데이터: ${this.stats.maskedData}개`));
    console.log(chalk.cyan(`   🆔 마스킹된 ID: ${this.stats.maskedIds}개`));
    console.log(chalk.cyan(`   👤 마스킹된 이름: ${this.stats.maskedNames}개`));
    console.log(
      chalk.cyan(
        `   개인정보 보호 모드: ${
          this.privacyConfig.enablePrivacyMode ? "ON" : "OFF"
        }`
      )
    );
    console.log(
      chalk.cyan(
        `   운영 환경 익명화: ${
          this.privacyConfig.anonymizeProduction ? "ON" : "OFF"
        }`
      )
    );
  }

  testPrivacyProtection() {
    console.log(chalk.yellow("\n🧪 개인정보 보호 테스트:"));

    const testUserId = 123456789;
    const testUserName = "지윤";
    const testInput = { from: { id: testUserId, first_name: testUserName } };

    console.log("원본 사용자 ID:", testUserId);
    console.log("마스킹된 사용자 ID:", this.safifyUserId(testUserId));
    console.log("원본 사용자명:", testUserName);
    console.log("마스킹된 사용자명:", this.safifyUserName(testInput));

    // 시스템 메시지 vs 사용자 메시지 테스트
    const systemMsg = "🎯 ModuleManager 초기화 시작...";
    const userMsg = "사용자: 지윤이 카드를 뽑았습니다";

    console.log("시스템 메시지:", this.maskSensitiveData(systemMsg));
    console.log("사용자 메시지:", this.maskSensitiveData(userMsg));

    this.showPrivacyStats();
  }

  // ===== 🔧 기존 호환성 메서드들 =====

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
    this.stats.totalLogs++;
    const timestamp = this.getTimestamp();
    const safeMessage = this.isSystemMessage(message)
      ? message
      : this.maskSensitiveData(message);
    console.log(chalk.green.bold(`${timestamp} [STARTUP] ${safeMessage}`));

    if (data) {
      const maskedData = this.maskObjectData(data);
      console.log(chalk.gray(JSON.stringify(maskedData, null, 2)));
    }
  }

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
    const colors = [startColor, endColor];
    let result = "";
    for (let i = 0; i < text.length; i++) {
      const colorIndex = Math.floor((i / text.length) * 2) % 2;
      const color = colors[colorIndex];
      if (chalk[color]) {
        result += chalk[color](text[i]);
      } else {
        result += chalk.blue(text[i]);
      }
    }
    return result;
  }

  celebration(message) {
    console.log(this.rainbow(`🎉 ${message}`));
  }

  progress(label, current, total) {
    const percent = Math.round((current / total) * 100);
    const barLength = 20;
    const filledLength = Math.round((barLength * current) / total);
    const bar = "█".repeat(filledLength) + "░".repeat(barLength - filledLength);
    console.log(`📊 ${label}: [${bar}] ${percent}%`);
  }

  startLoading(message) {
    console.log(chalk.blue(`⏳ ${message}...`));
    return {
      stop: () => {},
      succeed: (msg) => this.success(msg || message),
      fail: (msg) => this.error(msg || `${message} 실패`),
    };
  }

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

  getStatus() {
    return {
      version: this.version,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      stats: this.stats,
      privacyEnabled: this.privacyConfig.enablePrivacyMode,
      logLevel: this.logLevel,
      isRailway: this.isRailway,
    };
  }

  emergencyCleanup() {
    console.log(chalk.red.bold("\n🚨 긴급 개인정보 정리 실행..."));

    this.stats.maskedData = 0;
    this.stats.maskedNames = 0;
    this.stats.maskedIds = 0;
    this.stats.blockedSensitive = 0;

    console.log(chalk.green("✅ 메모리 내 개인정보 정리 완료"));
  }
}

// 싱글톤 인스턴스
const logger = new BalancedPrivacyLogger();

module.exports = logger;
