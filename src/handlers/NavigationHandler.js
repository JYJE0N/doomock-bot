// src/handlers/NavigationHandler.js - SoC 원칙 적용 버전

const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const { getEnabledModules } = require("../config/ModuleRegistry");

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
  constructor(bot, moduleManager, errorHandler, markdownHelper) {
    this.bot = bot; // 👈 null로 덮어쓰는 대신, 전달받은 bot 객체를 바로 할당합니다.
    this.moduleManager = moduleManager;
    this.renderers = new Map();

    // 직접 생성하는 대신, 주입받은 객체 사용
    this.errorHandler = errorHandler;
    this.markdownHelper = markdownHelper;

    // 📊 통계
    this.stats = {
      callbacksProcessed: 0,
      parseErrors: 0,
      fallbackUsed: 0,
      errorsCount: 0,
      lastActivity: null
    };

    // 🎯 파서 설정 (표준)
    this.parserConfig = {
      separator: ":",
      fallbackModule: "system",
      fallbackAction: "menu",
      maxPartsLog: 10
    };
  }

  /**
   * 🎯 초기화
   */
  async initialize() {
    // this.bot = bot;

    // 전문 컴포넌트들 초기화
    await this.errorHandler.initialize(this.bot);
    await this.markdownHelper.initialize();

    this.registerRenderers();
    this.stats.lastActivity = new Date();

    logger.info("🎹 NavigationHandler 초기화 완료 - SoC 원칙 적용");
    logger.info(`📏 파서 규칙: "${this.parserConfig.separator}" 구분자 사용`);
    logger.info(`🔄 폴백 규칙: "${this.parserConfig.fallbackModule}:${this.parserConfig.fallbackAction}"`);
  }

  /**
   * 📱 렌더러 등록 (의존성 위임 방식)
   */
  registerRenderers() {
    const renderers = [
      [
        "fortune",
        new (require("../renderers/FortuneRenderer"))(
          this.bot,
          this, // NavigationHandler를 통해 ErrorHandler 접근
          this.markdownHelper
        )
      ],
      ["todo", new (require("../renderers/TodoRenderer"))(this.bot, this, this.markdownHelper)],
      ["system", new (require("../renderers/SystemRenderer"))(this.bot, this, this.markdownHelper)],
      ["tts", new (require("../renderers/TTSRenderer"))(this.bot, this, this.markdownHelper)],
      ["weather", new (require("../renderers/WeatherRenderer"))(this.bot, this, this.markdownHelper)],
      ["timer", new (require("../renderers/TimerRenderer"))(this.bot, this, this.markdownHelper)],
      ["leave", new (require("../renderers/LeaveRenderer"))(this.bot, this, this.markdownHelper)],
      [
        "worktime",
        new (require("../renderers/WorktimeRenderer"))(
          this.bot,
          this, // ✅ NavigationHandler 전달 (ErrorHandler는 내부에서 접근)
          this.markdownHelper
        )
      ]
    ];

    renderers.forEach(([name, renderer]) => {
      this.renderers.set(name, renderer);
      logger.debug(`📱 ${name} 렌더러 등록됨 (의존성 위임 방식)`);
    });

    logger.info(`✅ ${this.renderers.size}개 렌더러 등록 완료 - 깔끔한 의존성 구조`);
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
        return await this.errorHandler.handleModulesLoadError(ctx, modulesError);
      }

      // 🎯 수정: MarkdownHelper 메서드를 실제 존재하는 메서드로 변경
      const safeUserName = this.markdownHelper.escapeMarkdownV2(userName); // ✅ 실제 존재하는 메서드
      const text = `🏠 *메인 메뉴*\n\n안녕하세요, ${safeUserName}님\\!`; // ✅ MarkdownV2 형식

      // 🎹 2열 배치 키보드 생성 (ModuleRegistry 함수 활용)
      const { buildNavigationKeyboard } = require("../config/ModuleRegistry");
      const keyboard = buildNavigationKeyboard();

      // 🎯 수정: MarkdownHelper의 실제 메서드 사용
      const success = await this.markdownHelper.sendSafeMessage(ctx, text, {
        reply_markup: keyboard
      });

      if (!success) {
        return await this.errorHandler.handleMessageSendError(ctx, "메인 메뉴 전송 실패");
      }

      logger.debug("🏠 메인 메뉴 표시 완료");
      return true;
    } catch (error) {
      return await this.errorHandler.handleUnexpectedError(ctx, error, "showMainMenu");
    }
  }

  /**
   * 🔧 표준 콜백 데이터 파서 (핵심!)
   */
  parseCallbackData(data) {
    if (!data || typeof data !== "string") {
      logger.warn("⚠️ 잘못된 콜백 데이터:", data);
      this.stats.parseErrors++;
      return { moduleKey: "system", subAction: "menu", params: "" };
    }

    const parts = data.split(":");

    const parsed = {
      moduleKey: parts[0] || "system", // 첫 번째: 모듈
      subAction: parts[1] || "menu", // 두 번째: 액션
      params: parts.slice(2).join(":") || "" // ✅ 문자열로 유지 (각 모듈이 알아서 파싱)
    };

    // ✅ 파싱 로그 개선
    logger.debug(`🎯 콜백 파싱:`, {
      원본: data,
      모듈: parsed.moduleKey,
      액션: parsed.subAction,
      파라미터: parsed.params,
      파라미터길이: parsed.params.length
    });

    return parsed;
  }

  /**
   * 🎯 메인 콜백 처리 (기존 방식 유지)
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

      // ✅ 표준 파서 사용 (params는 문자열로 전달)
      const { moduleKey, subAction, params } = this.parseCallbackData(data);

      logger.debug(`🎯 파싱 완료: ${moduleKey}.${subAction}(${params})`);

      // 1️⃣ 모듈에서 비즈니스 로직 처리
      const result = await this.moduleManager.handleCallback(
        this.bot,
        callbackQuery,
        moduleKey,
        subAction,
        params // ✅ 문자열로 전달 (각 모듈이 알아서 파싱)
      );

      // result가 없거나, result.success가 false인 경우 ErrorHandler에 위임
      if (!result || result.success === false) {
        logger.warn(`💫 모듈 처리 실패: ${moduleKey}.${subAction}`);
        return await this.errorHandler.handleModuleProcessingError(
          ctx,
          moduleKey,
          subAction,
          result?.message || "모듈 처리 중 오류가 발생했습니다."
        );
      }

      // 2️⃣ 렌더러로 UI 생성
      const renderer = this.renderers.get(result.module || moduleKey);

      if (renderer) {
        await renderer.render(result, ctx);
        logger.debug(`✅ 렌더링 완료: ${moduleKey}.${subAction}`);
      } else {
        logger.warn(`📱 렌더러 없음: ${result.module || moduleKey}`);
        return await this.errorHandler.handleMissingRenderer(ctx, result.module || moduleKey, result);
      }
    } catch (error) {
      logger.error("💥 NavigationHandler 콜백 처리 오류:", error);
      this.stats.errorsCount++;

      return await this.errorHandler.handleUnexpectedError(ctx, error, "handleCallback");
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
      params: ""
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
      const result = await this.moduleManager.handleCallback(this.bot, callbackQuery, moduleKey, subAction, params);

      // 👇 이 부분을 수정합니다.
      // result가 없거나, result.success가 false인 경우 ErrorHandler에 위임합니다.
      if (!result || result.success === false) {
        logger.warn(`💫 모듈 처리 실패: ${moduleKey}.${subAction}`);
        return await this.errorHandler.handleModuleProcessingError(
          ctx,
          moduleKey,
          subAction,
          result?.message || "모듈 처리 중 오류가 발생했습니다."
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
        return await this.errorHandler.handleMissingRenderer(ctx, result.module || moduleKey, result);
      }
    } catch (error) {
      logger.error("💥 NavigationHandler 콜백 처리 오류:", error);
      this.stats.errorsCount++;

      // 🎯 ErrorHandler 위임 - 모든 예외 처리
      return await this.errorHandler.handleUnexpectedError(ctx, error, "handleCallback");
    }
  }

  /**
   * 💬 텍스트 메시지 처리
   */
  async handleMessage(ctx) {
    try {
      const messageText = ctx.message?.text;
      logger.debug("📨 텍스트 메시지 수신:", messageText);

      // ✅ 추가: ModuleManager와 모듈 상태 확인
      if (!this.moduleManager) {
        logger.error("❌ NavigationHandler: ModuleManager가 없습니다");
        return;
      }

      const modules = this.moduleManager.modules;
      if (!modules || modules.size === 0) {
        logger.error("❌ NavigationHandler: 로드된 모듈이 없습니다");
        return;
      }

      logger.debug("🔍 NavigationHandler: 모듈 순회 시작", {
        totalModules: modules.size,
        moduleNames: Array.from(modules.keys()),
        messageText
      });

      // 등록된 모든 모듈을 순회합니다.
      for (const [moduleName, module] of modules.entries()) {
        logger.debug(`🔄 NavigationHandler: ${moduleName} 모듈 확인 중`, {
          hasOnHandleMessage: typeof module.onHandleMessage === "function",
          moduleName: module.moduleName,
          isInitialized: module.isInitialized
        });

        // 각 모듈에 메시지를 처리할 기능(onHandleMessage)이 있는지 확인합니다.
        if (typeof module.onHandleMessage === "function") {
          logger.info(`📞 NavigationHandler: ${moduleName} 모듈의 onHandleMessage 호출 중`);

          try {
            const result = await module.onHandleMessage(this.bot, ctx.message);

            logger.debug(`📞 NavigationHandler: ${moduleName} 모듈 응답`, {
              result,
              resultType: typeof result,
              isTrue: result === true,
              isFalse: result === false,
              isNull: result === null,
              isUndefined: result === undefined
            });

            // 모듈이 메시지를 성공적으로 처리했다면
            if (result === true) {
              // ✅ 수정: boolean true는 단순히 "처리됨"을 의미하므로 렌더링하지 않음
              logger.info(`✅ ${moduleName} 모듈이 메시지 처리함 (렌더링 불필요)`);
              logger.info(`🏁 NavigationHandler: 메시지 처리 완료 (${moduleName}이 처리함)`);
              return;
            } else if (result && typeof result === "object") {
              // ✅ 수정: 객체 형태의 결과만 렌더링
              logger.info(`✅ ${moduleName} 모듈이 메시지 처리함`, {
                resultType: result.type,
                hasData: !!result.data
              });

              // 해당 모듈의 렌더러를 찾아 결과를 화면에 표시합니다.
              const renderer = this.renderers.get(result.module || module.moduleName);

              if (renderer) {
                logger.debug(`🎨 NavigationHandler: ${moduleName} 렌더러로 결과 전송`);
                await renderer.render(result, ctx);
                logger.info(`✅ NavigationHandler: ${moduleName} 렌더링 완료`);
              } else {
                logger.warn(`📱 렌더러 없음: ${result.module || module.moduleName}`);
                await this.errorHandler.handleMissingRenderer(ctx, result.module || module.moduleName, result);
              }

              // 메시지 처리를 완료했으므로 루프를 중단합니다.
              logger.info(`🏁 NavigationHandler: 메시지 처리 완료 (${moduleName}이 처리함)`);
              return;
            } else {
              logger.debug(`⏭️ NavigationHandler: ${moduleName} 모듈이 메시지를 처리하지 않음 (${result})`);
            }
          } catch (moduleError) {
            logger.error(`❌ NavigationHandler: ${moduleName} 모듈에서 오류 발생:`, moduleError);
            // 한 모듈에서 오류가 발생해도 다른 모듈들은 계속 시도
            continue;
          }
        } else {
          logger.debug(`⏭️ NavigationHandler: ${moduleName} 모듈에 onHandleMessage 없음`);
        }
      }

      logger.debug("🏁 NavigationHandler: 모든 모듈 순회 완료 - 아무도 메시지를 처리하지 않음");
    } catch (error) {
      logger.error("❌ NavigationHandler: handleMessage 전체 오류:", error);
      // 🎯 ErrorHandler 위임
      await this.errorHandler.handleUnexpectedError(ctx, error, "handleMessage");
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
      결과: callbackData
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
            ? Math.round(((this.stats.callbacksProcessed - this.stats.parseErrors) / this.stats.callbacksProcessed) * 100)
            : 100,
        fallbackRate: this.stats.callbacksProcessed > 0 ? Math.round((this.stats.fallbackUsed / this.stats.callbacksProcessed) * 100) : 0
      },
      rendererCount: this.renderers.size,
      registeredRenderers: Array.from(this.renderers.keys()),
      errorHandler: this.errorHandler?.getStatus() || null,
      markdownHelper: this.markdownHelper?.getStatus() || null
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
