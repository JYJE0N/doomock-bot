// src/handlers/NavigationHandler.js - SoC 원칙 적용 버전

const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const { getEnabledModules } = require("../config/ModuleRegistry");

// 🎯 관심사 분리 - 전문 컴포넌트 import
const ErrorHandler = require("../handlers/ErrorHandler");
const MarkdownHelper = require("../utils/MarkdownHelper");

/**
 * 🎹 NavigationHandler - SoC 원칙 적용 버전
 *
 * 🎯 관심사 분리 (Separation of Concerns):
 * - NavigationHandler: 콜백 파싱 & 라우팅 전담
 * - ErrorHandler: 모든 에러 처리 전담
 * - MarkdownHelper: 마크다운 처리 전담
 *
 * 🔧 비유: 전문 의료진 팀
 * - 내과의사(NavigationHandler): 진단 & 치료 방향 결정
 * - 응급의학과(ErrorHandler): 모든 응급상황 처리
 * - 약사(MarkdownHelper): 처방전 안전 관리
 */
class NavigationHandler {
  constructor() {
    this.bot = null;
    this.moduleManager = null;
    this.renderers = new Map();

    // 🎯 전문 컴포넌트 초기화
    this.errorHandler = new ErrorHandler();
    this.markdownHelper = new MarkdownHelper();

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
      maxPartsLog: 10,
    };
  }

  /**
   * 🎯 초기화
   */
  async initialize(bot) {
    this.bot = bot;

    // 전문 컴포넌트들 초기화
    await this.errorHandler.initialize(bot);
    await this.markdownHelper.initialize();

    this.registerRenderers();
    this.stats.lastActivity = new Date();

    logger.info("🎹 NavigationHandler 초기화 완료 - SoC 원칙 적용");
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
   * 🏠 메인 메뉴 표시 (SoC 적용!)
   */
  async showMainMenu(ctx) {
    try {
      // ctx에서 사용자 정보 안전하게 가져오기
      const from = ctx.from || ctx.callbackQuery?.from || ctx.message?.from;
      if (!from) {
        // 🎯 ErrorHandler 위임
        return await this.errorHandler.handleMissingUserInfo(ctx);
      }

      // 🔧 안전한 getUserName 호출
      let userName;
      try {
        userName = getUserName(from);
      } catch (userNameError) {
        logger.warn("getUserName 실패, 폴백 사용:", userNameError.message);
        userName = from.first_name || from.username || "사용자";
      }

      // 🔧 안전한 getEnabledModules 호출
      let enabledModules;
      try {
        enabledModules = getEnabledModules();
      } catch (modulesError) {
        logger.error("getEnabledModules 실패:", modulesError.message);
        // 🎯 ErrorHandler 위임
        return await this.errorHandler.handleModulesLoadError(
          ctx,
          modulesError
        );
      }

      // 🎯 MarkdownHelper 위임 - 안전한 텍스트 생성
      const safeUserName = this.markdownHelper.escapeForDisplay(userName);
      const text = `🏠 *메인 메뉴*\n안녕하세요, ${safeUserName}님\\!`;

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

      // 🎯 MarkdownHelper 위임 - 안전한 메시지 전송
      const success = await this.markdownHelper.sendSafeMessage(ctx, text, {
        reply_markup: keyboard,
      });

      if (!success) {
        // 🎯 ErrorHandler 위임
        return await this.errorHandler.handleMessageSendError(
          ctx,
          "메인 메뉴 전송 실패"
        );
      }

      logger.debug("🏠 메인 메뉴 표시 완료");
      return true;
    } catch (error) {
      // 🎯 ErrorHandler 위임 - 모든 예외 처리
      return await this.errorHandler.handleUnexpectedError(
        ctx,
        error,
        "showMainMenu"
      );
    }
  }

  /**
   * 🔧 표준 콜백 데이터 파서 (핵심!)
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
   * 🎯 메인 콜백 처리 (SoC 적용!)
   */
  async handleCallback(ctx) {
    try {
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
        // 🎯 ErrorHandler 위임
        return await this.errorHandler.handleModuleProcessingError(
          ctx,
          moduleKey,
          subAction,
          "모듈 처리 실패"
        );
      }

      // 2️⃣ 렌더러로 UI 생성
      const renderer = this.renderers.get(result.module || moduleKey);

      if (renderer) {
        await renderer.render(result, ctx);
        logger.debug(`✅ 렌더링 완료: ${moduleKey}.${subAction}`);
      } else {
        logger.warn(`📱 렌더러 없음: ${result.module || moduleKey}`);
        // 🎯 ErrorHandler 위임
        return await this.errorHandler.handleMissingRenderer(
          ctx,
          result.module || moduleKey,
          result
        );
      }
    } catch (error) {
      logger.error("💥 NavigationHandler 콜백 처리 오류:", error);
      this.stats.errorsCount++;

      // 🎯 ErrorHandler 위임 - 모든 예외 처리
      return await this.errorHandler.handleUnexpectedError(
        ctx,
        error,
        "handleCallback"
      );
    }
  }

  /**
   * 💬 텍스트 메시지 처리
   */
  async handleMessage(ctx) {
    try {
      logger.debug("📨 텍스트 메시지 수신:", ctx.message?.text);

      // 여기에 텍스트 메시지 처리 로직 추가
      // 예: 모듈별 키워드 매칭, 자연어 처리 등
    } catch (error) {
      // 🎯 ErrorHandler 위임
      await this.errorHandler.handleUnexpectedError(
        ctx,
        error,
        "handleMessage"
      );
    }
  }

  /**
   * 📏 콜백 데이터 생성 헬퍼 (표준 형식)
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
   * 📊 상태 정보
   */
  getStatus() {
    return {
      initialized: !!(this.bot && this.moduleManager),
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
      errorHandler: this.errorHandler?.getStatus() || null,
      markdownHelper: this.markdownHelper?.getStatus() || null,
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

      // 전문 컴포넌트들 정리
      if (this.errorHandler?.cleanup) {
        await this.errorHandler.cleanup();
      }
      if (this.markdownHelper?.cleanup) {
        await this.markdownHelper.cleanup();
      }

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
      this.errorHandler = null;
      this.markdownHelper = null;

      logger.info("✅ NavigationHandler 정리 완료");
    } catch (error) {
      logger.error("❌ NavigationHandler 정리 실패:", error);
    }
  }
}

module.exports = NavigationHandler;
