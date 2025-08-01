// src/handlers/NavigationHandler.js - showMainMenu 메서드 수정
const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const { getEnabledModules } = require("../config/ModuleRegistry");

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
      maxPartsLog: 10,
    };
  }

  /**
   * 🎯 초기화
   */
  async initialize(bot) {
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
   * 🏠 메인 메뉴 표시 (핵심 수정!)
   */
  async showMainMenu(ctx) {
    try {
      // ctx에서 사용자 정보 안전하게 가져오기
      const from = ctx.from || ctx.callbackQuery?.from || ctx.message?.from;
      if (!from) {
        throw new Error("사용자 정보를 찾을 수 없습니다");
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
        // 폴백 모듈 목록
        enabledModules = [
          {
            key: "system",
            icon: "🖥️",
            displayName: "시스템",
            showInMenu: true,
          },
        ];
      }

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
   * 🎯 메인 콜백 처리 (표준 흐름)
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
   * 💬 텍스트 메시지 처리
   */
  async handleMessage(ctx) {
    try {
      // 기본 메시지 처리 로직
      logger.debug("📨 텍스트 메시지 수신:", ctx.message?.text);

      // 여기에 텍스트 메시지 처리 로직 추가
      // 예: 모듈별 키워드 매칭, 자연어 처리 등
    } catch (error) {
      logger.error("💥 메시지 처리 오류:", error);
    }
  }

  /**
   * 💥 안전한 에러 메시지 전송
   */
  async sendSafeErrorMessage(ctx, message) {
    try {
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery(message, { show_alert: true });
      } else {
        await ctx.reply(`❌ ${message}`);
      }
    } catch (error) {
      logger.error("에러 메시지 전송 실패:", error);
    }
  }

  /**
   * 📊 상태 정보
   */
  getStatus() {
    return {
      stats: this.stats,
      renderersCount: this.renderers.size,
      parserConfig: this.parserConfig,
    };
  }
}

module.exports = NavigationHandler;
