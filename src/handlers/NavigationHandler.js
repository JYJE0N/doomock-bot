// src/handlers/NavigationHandler.js - 완전 표준화된 파서
const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const { getEnabledModules } = require("../config/ModuleRegistry");

/**
 * 🎯 NavigationHandler - 완전 표준화된 콜백 파서
 *
 * ✅ 파서 표준 규칙 (절대 변경 금지):
 *
 * 📏 콜백 데이터 형식: "모듈:액션:파라미터"
 *
 * 🔍 파싱 규칙:
 * - 첫 번째 ':' 앞: moduleKey (모듈명)
 * - 두 번째 ':' 앞: subAction (액션명)
 * - 나머지 모든 ':' 포함: params (파라미터들)
 *
 * 📝 예시:
 * - "todo:menu" → { moduleKey: "todo", subAction: "menu", params: "" }
 * - "todo:list:1" → { moduleKey: "todo", subAction: "list", params: "1" }
 * - "todo:delete:confirm:abc123" → { moduleKey: "todo", subAction: "delete", params: "confirm:abc123" }
 * - "timer:start:30:workout:high" → { moduleKey: "timer", subAction: "start", params: "30:workout:high" }
 *
 * 🎯 핵심 원칙:
 * 1. 모든 모듈은 이 규칙을 100% 준수
 * 2. 파라미터 내부의 ':' 는 그대로 유지
 * 3. 모듈과 액션은 필수, 파라미터는 선택
 * 4. 잘못된 형식은 "system:menu"로 폴백
 */
class NavigationHandler {
  constructor() {
    this.bot = null;
    this.moduleManager = null;
    this.renderers = new Map();

    // 📊 통계
    this.stats = {
      callbacksProcessed: 0,
      parseErrors: 0,
      fallbackUsed: 0,
      errorsCount: 0,
      lastActivity: null,
    };

    // 🎯 파서 설정 (표준)
    this.parserConfig = {
      separator: ":",
      fallbackModule: "system",
      fallbackAction: "menu",
      maxPartsLog: 10, // 로그에서 최대 표시할 파트 수
    };
  }

  /**
   * 🎯 초기화
   */
  initialize(bot) {
    this.bot = bot;
    this.registerRenderers();
    this.stats.lastActivity = new Date();

    logger.info("🎹 NavigationHandler 초기화 완료 - 표준 파서 적용");
    logger.info(`📏 파서 규칙: "${this.parserConfig.separator}" 구분자 사용`);
    logger.info(
      `🔄 폴백 규칙: "${this.parserConfig.fallbackModule}:${this.parserConfig.fallbackAction}"`
    );
  }

  /**
   * 📱 렌더러 등록
   */
  registerRenderers() {
    const renderers = [
      [
        "fortune",
        new (require("../renderers/FortuneRenderer"))(this.bot, this),
      ],
      ["todo", new (require("../renderers/TodoRenderer"))(this.bot, this)],
      ["system", new (require("../renderers/SystemRenderer"))(this.bot, this)],
      ["tts", new (require("../renderers/TTSRenderer"))(this.bot, this)],
      [
        "weather",
        new (require("../renderers/WeatherRenderer"))(this.bot, this),
      ],
      ["timer", new (require("../renderers/TimerRenderer"))(this.bot, this)],
      ["leave", new (require("../renderers/LeaveRenderer"))(this.bot, this)],
      [
        "worktime",
        new (require("../renderers/WorktimeRenderer"))(this.bot, this),
      ],
    ];

    renderers.forEach(([name, renderer]) => {
      this.renderers.set(name, renderer);
      logger.debug(`📱 ${name} 렌더러 등록됨`);
    });

    logger.info(`✅ ${this.renderers.size}개 렌더러 등록 완료`);
  }

  setModuleManager(moduleManager) {
    this.moduleManager = moduleManager;
    logger.debug("🔗 ModuleManager 연결됨");
  }

  /**
   * 🔧 표준 콜백 데이터 파서 (핵심!)
   *
   * 이 메서드는 모든 콜백 데이터 해석의 중심입니다.
   * 절대로 수정하지 마세요!
   *
   * @param {string} data - 콜백 데이터 ("모듈:액션:파라미터" 형식)
   * @returns {Object} 파싱된 결과 { moduleKey, subAction, params }
   */
  parseCallbackData(data) {
    try {
      // 1. 입력 검증
      if (!data || typeof data !== "string") {
        logger.warn(
          "⚠️ NavigationHandler: 잘못된 콜백 데이터 타입:",
          typeof data,
          data
        );
        this.stats.parseErrors++;
        return this.getFallbackParsed();
      }

      // 2. 빈 문자열 체크
      if (data.trim() === "") {
        logger.warn("⚠️ NavigationHandler: 빈 콜백 데이터");
        this.stats.parseErrors++;
        return this.getFallbackParsed();
      }

      // 3. 표준 파싱 실행
      const parts = data.split(this.parserConfig.separator);

      const parsed = {
        moduleKey: parts[0] || this.parserConfig.fallbackModule,
        subAction: parts[1] || this.parserConfig.fallbackAction,
        params:
          parts.length > 2
            ? parts.slice(2).join(this.parserConfig.separator)
            : "",
      };

      // 4. 파싱 결과 검증
      if (!parsed.moduleKey || !parsed.subAction) {
        logger.warn("⚠️ NavigationHandler: 필수 요소 누락:", parsed);
        this.stats.parseErrors++;
        return this.getFallbackParsed();
      }

      // 5. 성공 로그 (디버그용)
      if (logger.level === "debug") {
        const logParts =
          parts.length > this.parserConfig.maxPartsLog
            ? [
                ...parts.slice(0, this.parserConfig.maxPartsLog),
                `...(+${parts.length - this.parserConfig.maxPartsLog})`,
              ]
            : parts;

        logger.debug(`🔧 NavigationHandler 파싱 성공:`, {
          원본: data,
          파트수: parts.length,
          파트들: logParts,
          결과: parsed,
        });
      }

      return parsed;
    } catch (error) {
      logger.error("💥 NavigationHandler 파싱 오류:", error, { data });
      this.stats.parseErrors++;
      return this.getFallbackParsed();
    }
  }

  /**
   * 🔄 폴백 파싱 결과 생성
   */
  getFallbackParsed() {
    this.stats.fallbackUsed++;

    const fallback = {
      moduleKey: this.parserConfig.fallbackModule,
      subAction: this.parserConfig.fallbackAction,
      params: "",
    };

    logger.debug(`🔄 NavigationHandler 폴백 사용:`, fallback);
    return fallback;
  }

  /**
   * 🎯 메인 콜백 처리 (표준 흐름)
   */
  async handleCallback(ctx) {
    try {
      // ✅ 텔레그램 표준: 한 번만 응답
      await ctx.answerCbQuery();

      this.stats.callbacksProcessed++;
      this.stats.lastActivity = new Date();

      const callbackQuery = ctx.callbackQuery;
      const data = callbackQuery.data;

      logger.debug(`🎯 콜백 수신: ${data}`);

      // 시스템 메뉴 직접 처리 (최적화)
      if (data === "system:menu") {
        return await this.showMainMenu(ctx);
      }

      // ✅ 표준 파서 사용
      const { moduleKey, subAction, params } = this.parseCallbackData(data);

      logger.debug(`🎯 파싱 완료: ${moduleKey}.${subAction}(${params})`);

      // 1️⃣ 모듈에서 비즈니스 로직 처리
      const result = await this.moduleManager.handleCallback(
        this.bot,
        callbackQuery,
        moduleKey,
        subAction,
        params
      );

      if (!result) {
        logger.warn(`💫 모듈 처리 실패: ${moduleKey}.${subAction}`);
        return await this.renderErrorMessage(ctx, "요청을 처리할 수 없습니다.");
      }

      // 2️⃣ 렌더러로 UI 생성
      const renderer = this.renderers.get(result.module || moduleKey);

      if (renderer) {
        await renderer.render(result, ctx);
        logger.debug(`✅ 렌더링 완료: ${moduleKey}.${subAction}`);
      } else {
        logger.warn(`📱 렌더러 없음: ${result.module || moduleKey}`);
        await this.renderFallbackMessage(ctx, result);
      }
    } catch (error) {
      logger.error("💥 NavigationHandler 콜백 처리 오류:", error);
      this.stats.errorsCount++;

      try {
        await this.sendSafeErrorMessage(ctx, "처리 중 오류가 발생했습니다.");
      } catch (recoveryError) {
        logger.error("💥 오류 복구 실패:", recoveryError);
      }
    }
  }

  /**
   * 🏠 메인 메뉴 표시
   */
  async showMainMenu(ctx) {
    try {
      // ctx에서 사용자 정보 안전하게 가져오기
      const from = ctx.from || ctx.callbackQuery?.from || ctx.message?.from;
      if (!from) {
        throw new Error("사용자 정보를 찾을 수 없습니다");
      }

      const userName = getUserName(from);
      const enabledModules = getEnabledModules();

      const text = `🏠 **메인 메뉴**\n안녕하세요, ${userName}님!`;

      // 표준 형식으로 콜백 데이터 생성
      const keyboard = {
        inline_keyboard: enabledModules
          .filter((module) => module.showInMenu !== false)
          .map((module) => [
            {
              text: `${module.icon} ${
                module.displayName || module.description
              }`,
              callback_data: `${module.key}:menu`,
            },
          ]),
      };

      // 메시지 전송 방식 결정
      if (ctx.callbackQuery) {
        // 콜백 쿼리에서 호출된 경우 - 메시지 수정
        await ctx.editMessageText(text, {
          reply_markup: keyboard,
          parse_mode: "MarkdownV2",
        });
      } else {
        // 명령어에서 호출된 경우 - 새 메시지 전송
        await ctx.reply(text, {
          reply_markup: keyboard,
          parse_mode: "MarkdownV2",
        });
      }

      logger.debug("🏠 메인 메뉴 표시 완료");
      return true;
    } catch (error) {
      logger.error("💥 메인 메뉴 표시 오류:", error);

      // 에러 메시지 전송 방식도 ctx 타입에 따라 분기
      const errorMessage = "메인 메뉴를 표시할 수 없습니다.";

      try {
        if (ctx.callbackQuery) {
          await ctx.answerCbQuery(errorMessage, { show_alert: true });
        } else {
          await ctx.reply(`❌ ${errorMessage}`);
        }
      } catch (e) {
        logger.error("에러 메시지 전송 실패:", e);
      }

      return false;
    }
  }

  /**
   * 📱 모듈 메뉴 전송 (명령어용)
   */
  async sendModuleMenu(bot, chatId, moduleName) {
    try {
      const text = `🎯 ${moduleName} 모듈`;

      // ✅ 표준 형식으로 콜백 데이터 생성
      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "📋 메뉴 열기",
              callback_data: `${moduleName}:menu`, // 표준 형식!
            },
          ],
        ],
      };

      await bot.sendMessage(chatId, text, {
        reply_markup: keyboard,
      });

      logger.debug(`📱 모듈 메뉴 전송 완료: ${moduleName}`);
    } catch (error) {
      logger.error(`💥 모듈 메뉴 전송 실패 (${moduleName}):`, error);
      await bot.sendMessage(
        chatId,
        `❌ ${moduleName} 모듈 메뉴를 열 수 없습니다.`
      );
    }
  }

  /**
   * ⚠️ 폴백 메시지 렌더링
   */
  async renderFallbackMessage(ctx, result) {
    const text = `⚠️ 렌더러 없음\n\n모듈: ${
      result.module || "알 수 없음"
    }\n타입: ${result.type || "알 수 없음"}`;

    try {
      await ctx.editMessageText(text);
    } catch (error) {
      logger.debug("폴백 메시지 렌더링 실패, answerCbQuery로 대체");
      await ctx.answerCbQuery("처리 완료");
    }
  }

  /**
   * ❌ 에러 메시지 렌더링
   */
  async renderErrorMessage(ctx, message) {
    await this.sendSafeErrorMessage(ctx, message);
  }

  /**
   * 🛡️ 안전한 에러 메시지 전송
   */
  async sendSafeErrorMessage(ctx, message) {
    try {
      // 콜백 쿼리인 경우
      if (ctx.callbackQuery) {
        try {
          // 먼저 메시지 수정 시도
          await ctx.editMessageText(`❌ ${message}`);
        } catch (editError) {
          // 수정 실패시 콜백 응답
          await ctx.answerCbQuery(message, { show_alert: true });
        }
      } else {
        // 일반 메시지인 경우
        await ctx.reply(`❌ ${message}`);
      }
    } catch (error) {
      logger.error("💥 에러 응답 전송 실패:", error);
    }
  }

  /**
   * 📊 상태 정보 (표준 형식)
   */
  getStatus() {
    return {
      serviceName: "NavigationHandler",
      isReady: !!(this.bot && this.moduleManager),
      parserConfig: this.parserConfig,
      stats: {
        ...this.stats,
        parseSuccessRate:
          this.stats.callbacksProcessed > 0
            ? Math.round(
                ((this.stats.callbacksProcessed - this.stats.parseErrors) /
                  this.stats.callbacksProcessed) *
                  100
              )
            : 100,
        fallbackRate:
          this.stats.callbacksProcessed > 0
            ? Math.round(
                (this.stats.fallbackUsed / this.stats.callbacksProcessed) * 100
              )
            : 0,
      },
      rendererCount: this.renderers.size,
      registeredRenderers: Array.from(this.renderers.keys()),
    };
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    try {
      logger.info("🧹 NavigationHandler 정리 시작...");

      // 통계 로그
      const finalStats = this.getStatus();
      logger.info("📊 NavigationHandler 최종 통계:", finalStats.stats);

      // 렌더러 정리
      for (const [name, renderer] of this.renderers.entries()) {
        try {
          if (typeof renderer.cleanup === "function") {
            await renderer.cleanup();
            logger.debug(`✅ ${name} 렌더러 정리 완료`);
          }
        } catch (error) {
          logger.warn(`⚠️ ${name} 렌더러 정리 실패:`, error.message);
        }
      }

      this.renderers.clear();
      this.bot = null;
      this.moduleManager = null;

      logger.info("✅ NavigationHandler 정리 완료");
    } catch (error) {
      logger.error("❌ NavigationHandler 정리 실패:", error);
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 📏 콜백 데이터 생성 헬퍼 (표준 형식)
   *
   * @param {string} moduleKey - 모듈명
   * @param {string} subAction - 액션명
   * @param {string|Array} params - 파라미터들
   * @returns {string} 표준 형식의 콜백 데이터
   */
  buildCallbackData(moduleKey, subAction, params = "") {
    let paramsStr = "";

    if (Array.isArray(params)) {
      paramsStr = params.join(this.parserConfig.separator);
    } else if (params) {
      paramsStr = String(params);
    }

    const callbackData = paramsStr
      ? `${moduleKey}${this.parserConfig.separator}${subAction}${this.parserConfig.separator}${paramsStr}`
      : `${moduleKey}${this.parserConfig.separator}${subAction}`;

    logger.debug(`📏 콜백 데이터 생성:`, {
      입력: { moduleKey, subAction, params },
      결과: callbackData,
    });

    return callbackData;
  }

  /**
   * 🛡️ MarkdownV2 이스케이프
   */
  escapeMarkdownV2(text) {
    if (typeof text !== "string") text = String(text);

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
    escapeChars.forEach((char) => {
      const regex = new RegExp("\\" + char, "g");
      escaped = escaped.replace(regex, "\\" + char);
    });

    return escaped;
  }
}

module.exports = NavigationHandler;
