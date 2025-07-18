// src/modules/BaseModule.js - 완전한 안전 처리 버전
const Logger = require("../utils/Logger");

class BaseModule {
  constructor(name = "BaseModule") {
    this.name = name;
    this.config = {};
    this.isInitialized = false;
    this.isLoaded = false;
    this.lastMessageCache = new Map(); // 메시지 중복 방지용 캐시

    // 통계 정보
    this.stats = {
      commandCount: 0,
      callbackCount: 0,
      messageCount: 0,
      errorCount: 0,
      lastUsed: null,
      createdAt: new Date(),
    };

    Logger.info(`📦 BaseModule 생성: ${this.name}`);
  }

  // 모듈 초기화
  async initialize() {
    try {
      this.isInitialized = true;
      this.isLoaded = true;
      Logger.info(`✅ 모듈 초기화 완료: ${this.name}`);
    } catch (error) {
      Logger.error(`❌ 모듈 초기화 실패: ${this.name}`, error);
      throw error;
    }
  }

  // 정리 작업
  async cleanup() {
    try {
      this.isInitialized = false;
      this.lastMessageCache.clear();
      Logger.info(`🧹 모듈 정리 완료: ${this.name}`);
    } catch (error) {
      Logger.error(`❌ 모듈 정리 실패: ${this.name}`, error);
    }
  }

  // 로깅 헬퍼 메서드들
  info(message, metadata = {}) {
    Logger.info(`[${this.name}] ${message}`, metadata);
  }

  warn(message, metadata = {}) {
    Logger.warn(`[${this.name}] ${message}`, metadata);
  }

  error(message, metadata = {}) {
    Logger.error(`[${this.name}] ${message}`, metadata);
  }

  debug(message, metadata = {}) {
    Logger.debug(`[${this.name}] ${message}`, metadata);
  }

  // 통계 업데이트
  updateStats(type) {
    switch (type) {
      case "command":
        this.stats.commandCount++;
        break;
      case "callback":
        this.stats.callbackCount++;
        break;
      case "message":
        this.stats.messageCount++;
        break;
      case "error":
        this.stats.errorCount++;
        break;
    }
    this.stats.lastUsed = new Date();
  }

  // 🔧 완전히 안전한 메시지 전송
  async sendMessage(bot, chatId, text, options = {}) {
    try {
      this.updateStats("message");
      return await bot.sendMessage(chatId, text, options);
    } catch (error) {
      this.updateStats("error");
      Logger.error(`메시지 전송 실패 [${this.name}]:`, error);
      throw error;
    }
  }

  // 🔧 완전히 안전한 메시지 편집 (핵심 개선!)
  async editMessage(bot, chatId, messageId, text, options = {}) {
    try {
      // 1️⃣ 메시지 ID가 없으면 새 메시지 전송
      if (!messageId) {
        this.debug("메시지 ID가 없어서 새 메시지 전송");
        return await this.sendMessage(bot, chatId, text, options);
      }

      // 2️⃣ 캐시 키 생성
      const cacheKey = `${chatId}_${messageId}`;
      const lastContent = this.lastMessageCache.get(cacheKey);

      // 3️⃣ 메시지 내용이 동일한지 확인
      const currentContent = JSON.stringify({ text, options });
      if (lastContent === currentContent) {
        this.debug("동일한 메시지 감지, 타임스탬프 추가");

        // 타임스탬프 추가하여 고유하게 만들기
        const timestamp = new Date().toLocaleString("ko-KR", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        text = text + `\n\n🕐 ${timestamp}`;
      }

      // 4️⃣ 메시지 편집 시도
      const result = await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        ...options,
      });

      // 5️⃣ 성공시 캐시 업데이트
      this.lastMessageCache.set(cacheKey, JSON.stringify({ text, options }));
      this.updateStats("message");

      return result;
    } catch (error) {
      this.updateStats("error");

      // 6️⃣ 다양한 에러 타입별 처리
      if (this.isEditError(error)) {
        this.warn(`메시지 편집 실패, 새 메시지로 대체: ${error.message}`);

        try {
          // 편집 실패시 새 메시지 전송
          return await this.sendMessage(bot, chatId, text, options);
        } catch (sendError) {
          this.error(`새 메시지 전송도 실패:`, sendError);

          // 최후의 수단: 간단한 메시지
          try {
            return await bot.sendMessage(
              chatId,
              `⚠️ 메시지 업데이트에 문제가 있어 새로 전송합니다.\n\n${text}`
            );
          } catch (finalError) {
            this.error(`최종 메시지 전송 실패:`, finalError);
            throw finalError;
          }
        }
      }

      // 다른 종류의 에러는 그대로 던지기
      this.error(`메시지 편집 실패 [${this.name}]:`, error);
      throw error;
    }
  }

  // 7️⃣ 편집 관련 에러인지 확인
  isEditError(error) {
    const editErrorMessages = [
      "message is not modified",
      "message to edit not found",
      "Bad Request",
      "message can't be edited",
      "MESSAGE_NOT_MODIFIED",
    ];

    return editErrorMessages.some(
      (msg) =>
        error.message && error.message.toLowerCase().includes(msg.toLowerCase())
    );
  }

  // 8️⃣ 안전한 콜백 쿼리 응답
  async answerCallbackQuery(bot, callbackQueryId, options = {}) {
    try {
      return await bot.answerCallbackQuery(callbackQueryId, options);
    } catch (error) {
      // 이미 응답된 콜백은 무시
      if (error.message.includes("query is too old")) {
        this.debug("콜백 쿼리가 너무 오래됨 (무시)");
        return;
      }

      this.warn(`콜백 쿼리 응답 실패:`, error);
      // 콜백 응답 실패는 치명적이지 않으므로 에러를 던지지 않음
    }
  }

  // 오류 메시지 전송
  async sendErrorMessage(bot, chatId, error) {
    try {
      const errorMessage = this.formatErrorMessage(error);
      await this.sendMessage(bot, chatId, errorMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
          ],
        },
      });
    } catch (sendError) {
      this.error(`오류 메시지 전송 실패:`, sendError);
    }
  }

  // 오류 메시지 포맷팅
  formatErrorMessage(error) {
    const errorMessages = {
      VALIDATION_ERROR: "❌ 입력값이 올바르지 않습니다.",
      DATABASE_ERROR: "💾 데이터베이스 오류가 발생했습니다.",
      API_ERROR: "🌐 외부 서비스 오류가 발생했습니다.",
      PERMISSION_DENIED: "🚫 권한이 없습니다.",
      RATE_LIMIT: "⏳ 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.",
      MODULE_DISABLED: "🔧 이 기능은 현재 사용할 수 없습니다.",
    };

    const errorType = error.type || "UNKNOWN";
    const customMessage = errorMessages[errorType];

    if (customMessage) {
      return customMessage;
    }

    // 개발 환경에서는 상세 오류 표시
    if (process.env.NODE_ENV === "development") {
      return `❌ 오류 발생: ${error.message}`;
    }

    return "❌ 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }

  // 사용자 권한 체크
  checkPermission(userId, permission) {
    // 기본적으로 모든 사용자에게 허용
    // 서브클래스에서 오버라이드하여 권한 체크 구현
    return true;
  }

  // 입력값 검증
  validateInput(input, rules) {
    const errors = [];

    for (const [field, rule] of Object.entries(rules)) {
      const value = input[field];

      if (
        rule.required &&
        (value === undefined || value === null || value === "")
      ) {
        errors.push(`${field}은(는) 필수입니다`);
        continue;
      }

      if (value !== undefined && value !== null) {
        if (rule.type && typeof value !== rule.type) {
          errors.push(`${field}의 타입이 올바르지 않습니다`);
        }

        if (rule.min && value < rule.min) {
          errors.push(`${field}은(는) ${rule.min} 이상이어야 합니다`);
        }

        if (rule.max && value > rule.max) {
          errors.push(`${field}은(는) ${rule.max} 이하여야 합니다`);
        }

        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push(`${field}의 형식이 올바르지 않습니다`);
        }
      }
    }

    if (errors.length > 0) {
      const error = new Error(`입력값 검증 실패: ${errors.join(", ")}`);
      error.type = "VALIDATION_ERROR";
      throw error;
    }

    return true;
  }

  // 캐시 키 생성
  getCacheKey(...parts) {
    return `${this.name}:${parts.join(":")}`;
  }

  // 한국 시간 가져오기
  getKoreaTime() {
    return new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })
    );
  }

  // 메뉴 키보드 생성 헬퍼
  createMenuKeyboard(buttons, options = {}) {
    const {
      columns = 2,
      backButton = true,
      backCallback = "main_menu",
    } = options;

    const keyboard = [];

    // 버튼들을 행으로 그룹화
    for (let i = 0; i < buttons.length; i += columns) {
      const row = buttons.slice(i, i + columns);
      keyboard.push(row);
    }

    // 뒤로가기 버튼 추가
    if (backButton) {
      keyboard.push([{ text: "🔙 뒤로가기", callback_data: backCallback }]);
    }

    return { inline_keyboard: keyboard };
  }

  // 캐시 정리 (메모리 절약)
  cleanupCache() {
    if (this.lastMessageCache.size > 100) {
      // 오래된 캐시 50개 제거
      const entries = Array.from(this.lastMessageCache.entries());
      for (let i = 0; i < 50; i++) {
        this.lastMessageCache.delete(entries[i][0]);
      }
      this.debug(`캐시 정리 완료: ${this.lastMessageCache.size}개 남음`);
    }
  }

  // 모듈 상태 정보
  getStatus() {
    return {
      name: this.name,
      isInitialized: this.isInitialized,
      isLoaded: this.isLoaded,
      stats: this.stats,
      cacheSize: this.lastMessageCache.size,
    };
  }

  // 시간 포맷팅
  formatDate(date) {
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // 퍼센트 계산
  calculatePercentage(part, total) {
    return total > 0 ? Math.round((part / total) * 100) : 0;
  }

  // 텍스트 자르기
  truncateText(text, maxLength) {
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  }

  // 지연 함수
  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // toString 오버라이드
  toString() {
    return `[Module: ${this.name}]`;
  }

  // JSON 직렬화를 위한 메서드
  toJSON() {
    return {
      name: this.name,
      config: this.config,
      isInitialized: this.isInitialized,
      isLoaded: this.isLoaded,
      stats: this.stats,
    };
  }
}

module.exports = BaseModule;
