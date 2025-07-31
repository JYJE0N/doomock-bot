// src/renderers/BaseRenderer.js - 파서 규칙 통일 버전

const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🎨 BaseRenderer - 모든 렌더러의 표준 기반 클래스
 *
 * 🎯 핵심 개선사항:
 * - NavigationHandler와 동일한 파서 규칙 적용
 * - "모듈:액션:파라미터" 형태 표준화
 * - 모든 렌더러가 동일한 콜백 데이터 해석 방식 사용
 * - MarkdownV2 완벽 이스케이프 처리
 * - 표준 매개변수 체계 준수
 *
 * 🔧 비유: 음식점의 통일된 주문 시스템
 * - 모든 점원이 같은 방식으로 주문을 받고 해석
 * - 통일된 포맷으로 주방에 전달
 * - 일관된 서비스 품질 보장
 */
class BaseRenderer {
  constructor(bot, navigationHandler) {
    this.bot = bot;
    this.navigationHandler = navigationHandler;

    // 📊 렌더링 통계
    this.stats = {
      renderCount: 0,
      errorCount: 0,
      markdownErrors: 0,
      fallbackUsed: 0,
      lastActivity: null,
    };

    // ⚙️ 렌더러 설정
    this.config = {
      defaultParseMode: "MarkdownV2",
      fallbackParseMode: "HTML",
      maxRetries: 3,
      enableFallback: true,
    };

    logger.debug(`🎨 BaseRenderer 생성됨`);
  }

  // ===== 🔧 콜백 데이터 파서 (NavigationHandler와 동일한 규칙) =====

  /**
   * 🔧 콜백 데이터 파싱 (NavigationHandler와 100% 동일)
   * "module:action:param1:param2" 형식을 일관되게 파싱합니다.
   *
   * 예시:
   * - "leave:menu" → { moduleKey: "leave", subAction: "menu", params: "" }
   * - "leave:use:full" → { moduleKey: "leave", subAction: "use", params: "full" }
   * - "timer:start:30:workout" → { moduleKey: "timer", subAction: "start", params: "30:workout" }
   *
   * @param {string} data - 콜백 데이터
   * @returns {Object} 파싱된 결과
   */
  parseCallbackData(data) {
    if (!data || typeof data !== "string") {
      logger.warn("⚠️ BaseRenderer: 잘못된 콜백 데이터:", data);
      return { moduleKey: "system", subAction: "menu", params: "" };
    }

    const parts = data.split(":");

    const parsed = {
      moduleKey: parts[0] || "system", // 첫 번째 부분: 모듈명
      subAction: parts[1] || "menu", // 두 번째 부분: 액션명
      params: parts.length > 2 ? parts.slice(2).join(":") : "", // 나머지: 파라미터들
    };

    logger.debug(`🔧 BaseRenderer 콜백 파싱:`, {
      원본: data,
      결과: parsed,
    });

    return parsed;
  }

  /**
   * 🔧 콜백 데이터 생성 (파싱의 역과정)
   * 표준 형식으로 콜백 데이터를 생성합니다.
   *
   * @param {string} moduleKey - 모듈명
   * @param {string} subAction - 액션명
   * @param {string|array} params - 파라미터들
   * @returns {string} 생성된 콜백 데이터
   */
  buildCallbackData(moduleKey, subAction, params = "") {
    let paramsStr = "";

    if (Array.isArray(params)) {
      paramsStr = params.join(":");
    } else if (params) {
      paramsStr = String(params);
    }

    const callbackData = paramsStr
      ? `${moduleKey}:${subAction}:${paramsStr}`
      : `${moduleKey}:${subAction}`;

    logger.debug(`🔧 BaseRenderer 콜백 생성:`, {
      입력: { moduleKey, subAction, params },
      결과: callbackData,
    });

    return callbackData;
  }

  // ===== 🛡️ MarkdownV2 이스케이프 시스템 =====

  /**
   * 🛡️ 강화된 MarkdownV2 이스케이프 (완전한 해결책)
   * 텔레그램 MarkdownV2 400 에러를 완전히 방지합니다.
   */
  escapeMarkdownV2(text) {
    if (typeof text !== "string") text = String(text);

    // 텔레그램 MarkdownV2에서 이스케이프해야 하는 모든 문자
    const escapeChars = [
      "_",
      "*",
      "[",
      "]",
      "(",
      ")",
      "~",
      "`",
      ">",
      "#",
      "+",
      "-",
      "=",
      "|",
      "{",
      "}",
      ".",
      "!",
    ];

    let escaped = text;

    // 각 문자를 개별적으로 이스케이프
    escapeChars.forEach((char) => {
      // 이미 이스케이프된 문자는 건드리지 않음
      const regex = new RegExp(
        `(?<!\\\\)\\${char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
        "g"
      );
      escaped = escaped.replace(regex, `\\${char}`);
    });

    return escaped;
  }

  /**
   * 🔧 일반 마크다운 이스케이프 (폴백용)
   */
  escapeMarkdown(text) {
    if (typeof text !== "string") text = String(text);

    return text
      .replace(/\*/g, "\\*")
      .replace(/_/g, "\\_")
      .replace(/\[/g, "\\[")
      .replace(/\]/g, "\\]")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/~/g, "\\~")
      .replace(/`/g, "\\`")
      .replace(/>/g, "\\>")
      .replace(/#/g, "\\#")
      .replace(/\+/g, "\\+")
      .replace(/-/g, "\\-")
      .replace(/=/g, "\\=")
      .replace(/\|/g, "\\|")
      .replace(/\{/g, "\\{")
      .replace(/\}/g, "\\}")
      .replace(/\./g, "\\.")
      .replace(/!/g, "\\!");
  }

  // ===== 🎨 표준 렌더링 메서드들 =====

  /**
   * 🎯 메인 렌더링 메서드 (자식 클래스에서 구현)
   * 모든 렌더러가 이 패턴을 따라야 합니다.
   *
   * @param {Object} result - 모듈에서 전달받은 결과
   * @param {Object} ctx - 텔레그램 컨텍스트
   */
  async render(result, ctx) {
    throw new Error("render() 메서드는 자식 클래스에서 구현해야 합니다");
  }

  /**
   * 🛡️ 안전한 메시지 전송 (MarkdownV2 + 폴백 시스템)
   */
  async sendSafeMessage(ctx, text, options = {}) {
    this.stats.renderCount++;
    this.stats.lastActivity = TimeHelper.getLogTimeString();

    try {
      // 첫 번째 시도: MarkdownV2
      const escapedText = this.escapeMarkdownV2(text);

      const messageOptions = {
        parse_mode: this.config.defaultParseMode,
        ...options,
      };

      if (ctx.callbackQuery) {
        return await ctx.editMessageText(escapedText, messageOptions);
      } else {
        return await ctx.reply(escapedText, messageOptions);
      }
    } catch (error) {
      logger.warn("🛡️ MarkdownV2 전송 실패, HTML로 폴백:", error.message);
      this.stats.markdownErrors++;

      return await this.sendFallbackMessage(ctx, text, options);
    }
  }

  /**
   * 🔄 폴백 메시지 전송 (HTML 모드)
   */
  async sendFallbackMessage(ctx, text, options = {}) {
    try {
      this.stats.fallbackUsed++;

      // HTML 태그 제거 및 안전한 텍스트로 변환
      const safeText = this.convertToSafeHtml(text);

      const messageOptions = {
        parse_mode: this.config.fallbackParseMode,
        ...options,
      };

      if (ctx.callbackQuery) {
        return await ctx.editMessageText(safeText, messageOptions);
      } else {
        return await ctx.reply(safeText, messageOptions);
      }
    } catch (fallbackError) {
      logger.error("🚨 폴백 메시지 전송도 실패:", fallbackError);
      this.stats.errorCount++;

      // 최종 안전망: 일반 텍스트
      return await this.sendPlainTextMessage(
        ctx,
        "메시지 표시 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 🔄 HTML 안전 변환
   */
  convertToSafeHtml(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>") // **굵게** → <b>굵게</b>
      .replace(/\*(.*?)\*/g, "<i>$1</i>") // *기울임* → <i>기울임</i>
      .replace(/`(.*?)`/g, "<code>$1</code>") // `코드` → <code>코드</code>
      .replace(/~~(.*?)~~/g, "<s>$1</s>") // ~~취소선~~ → <s>취소선</s>
      .replace(/\\(.)/g, "$1"); // 이스케이프 문자 제거
  }

  /**
   * 🔚 최종 안전망: 일반 텍스트 메시지
   */
  async sendPlainTextMessage(ctx, text) {
    try {
      if (ctx.callbackQuery) {
        return await ctx.editMessageText(text);
      } else {
        return await ctx.reply(text);
      }
    } catch (error) {
      logger.error("🚨 일반 텍스트 메시지마저 실패:", error);
      // 이 시점에서는 더 이상 할 수 있는 것이 없음
    }
  }

  // ===== 🎹 표준 키보드 생성 메서드들 =====

  /**
   * 🎹 표준 인라인 키보드 생성
   * 파서 규칙을 준수하는 콜백 데이터로 키보드를 만듭니다.
   *
   * @param {Array} buttons - 버튼 배열
   * @param {string} moduleKey - 현재 모듈명
   * @returns {Object} 인라인 키보드 객체
   */
  createInlineKeyboard(buttons, moduleKey) {
    const keyboard = { inline_keyboard: [] };

    buttons.forEach((row) => {
      if (Array.isArray(row)) {
        // 여러 버튼이 한 줄에 있는 경우
        const buttonRow = row.map((button) =>
          this.createButton(button, moduleKey)
        );
        keyboard.inline_keyboard.push(buttonRow);
      } else {
        // 한 줄에 버튼 하나
        const buttonRow = [this.createButton(row, moduleKey)];
        keyboard.inline_keyboard.push(buttonRow);
      }
    });

    return keyboard;
  }

  /**
   * 🔘 개별 버튼 생성
   *
   * @param {Object} buttonConfig - 버튼 설정
   * @param {string} moduleKey - 모듈명
   * @returns {Object} 버튼 객체
   */
  createButton(buttonConfig, moduleKey) {
    const { text, action, params = "", url } = buttonConfig;

    // URL 버튼인 경우
    if (url) {
      return { text, url };
    }

    // ✅ 수정: moduleKey를 올바르게 전달
    let targetModuleKey = moduleKey;

    // 특별한 경우들 처리
    if (action === "menu" && text.includes("메인 메뉴")) {
      targetModuleKey = "system"; // 메인 메뉴는 항상 system
    }

    const callback_data = this.buildCallbackData(
      targetModuleKey,
      action,
      params
    );

    logger.debug(`🔘 버튼 생성:`, {
      text,
      action,
      params,
      원본모듈: moduleKey,
      대상모듈: targetModuleKey,
      콜백데이터: callback_data,
    });

    return { text, callback_data };
  }

  /**
   * 🏠 홈 버튼 생성 (표준)
   */
  createHomeButton() {
    return {
      text: "🏠 메인 메뉴",
      callback_data: "system:menu",
    };
  }

  /**
   * ◀️ 뒤로가기 버튼 생성 (표준)
   */
  createBackButton(moduleKey) {
    return {
      text: "◀️ 뒤로가기",
      callback_data: this.buildCallbackData(moduleKey, "menu"),
    };
  }

  // ===== 📊 페이지네이션 헬퍼 =====

  /**
   * 📄 페이지네이션 키보드 생성
   *
   * @param {number} currentPage - 현재 페이지
   * @param {number} totalPages - 전체 페이지
   * @param {string} moduleKey - 모듈명
   * @param {string} action - 페이지 액션명
   * @returns {Array} 페이지네이션 버튼들
   */
  createPaginationButtons(currentPage, totalPages, moduleKey, action = "page") {
    const buttons = [];

    if (totalPages <= 1) return buttons;

    const row = [];

    // 이전 페이지
    if (currentPage > 1) {
      row.push({
        text: "◀️",
        callback_data: this.buildCallbackData(
          moduleKey,
          action,
          currentPage - 1
        ),
      });
    }

    // 페이지 정보
    row.push({
      text: `${currentPage}/${totalPages}`,
      callback_data: "noop", // 클릭해도 아무것도 안 함
    });

    // 다음 페이지
    if (currentPage < totalPages) {
      row.push({
        text: "▶️",
        callback_data: this.buildCallbackData(
          moduleKey,
          action,
          currentPage + 1
        ),
      });
    }

    buttons.push(row);
    return buttons;
  }

  // ===== 📊 통계 및 상태 관리 =====

  /**
   * 📊 렌더러 통계 조회
   */
  getStats() {
    return {
      ...this.stats,
      성공률:
        this.stats.renderCount > 0
          ? (
              ((this.stats.renderCount - this.stats.errorCount) /
                this.stats.renderCount) *
              100
            ).toFixed(2) + "%"
          : "0%",
      마크다운오류율:
        this.stats.renderCount > 0
          ? (
              (this.stats.markdownErrors / this.stats.renderCount) *
              100
            ).toFixed(2) + "%"
          : "0%",
    };
  }

  /**
   * 📊 통계 리셋
   */
  resetStats() {
    this.stats = {
      renderCount: 0,
      errorCount: 0,
      markdownErrors: 0,
      fallbackUsed: 0,
      lastActivity: null,
    };
    logger.info(`🔄 ${this.constructor.name} 통계 리셋됨`);
  }

  // ===== 🧪 표준 에러 처리 =====

  /**
   * ❌ 표준 에러 메시지 렌더링
   */
  async renderError(message, ctx) {
    const errorText = `❌ **오류**\n\n${this.escapeMarkdownV2(message)}`;

    const keyboard = this.createInlineKeyboard(
      [{ text: "🏠 메인 메뉴", action: "menu", params: "" }],
      "system"
    );

    await this.sendSafeMessage(ctx, errorText, {
      reply_markup: keyboard,
    });
  }

  /**
   * 💡 표준 정보 메시지 렌더링
   */
  async renderInfo(message, ctx, moduleKey = "system") {
    const infoText = `💡 **안내**\n\n${this.escapeMarkdownV2(message)}`;

    const keyboard = this.createInlineKeyboard(
      [this.createBackButton(moduleKey)],
      moduleKey
    );

    await this.sendSafeMessage(ctx, infoText, {
      reply_markup: keyboard,
    });
  }

  // ===== 🔧 디버깅 및 개발 도구 =====

  /**
   * 🔍 디버그 정보 출력
   */
  debug(message, data = null) {
    logger.debug(`🎨 ${this.constructor.name}: ${message}`, data);
  }

  /**
   * ⚠️ 경고 출력
   */
  warn(message, data = null) {
    logger.warn(`🎨 ${this.constructor.name}: ${message}`, data);
  }

  /**
   * ❌ 에러 출력
   */
  error(message, error = null) {
    this.stats.errorCount++;
    logger.error(`🎨 ${this.constructor.name}: ${message}`, error);
  }
}

module.exports = BaseRenderer;
