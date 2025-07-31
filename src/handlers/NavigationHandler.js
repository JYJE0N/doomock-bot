// src/handlers/NavigationHandler.js - 근본 해결 버전

const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
// ✅ 통합 레지스트리 사용
const {
  getEnabledModules,
  buildNavigationKeyboard,
} = require("../config/ModuleRegistry");

// ✅ 필수 렌더러 import (기존과 동일)
const FortuneRenderer = require("../renderers/FortuneRenderer");
const TodoRenderer = require("../renderers/TodoRenderer");
const SystemRenderer = require("../renderers/SystemRenderer");
const TTSRenderer = require("../renderers/TTSRenderer");
const WeatherRenderer = require("../renderers/WeatherRenderer");
const TimerRenderer = require("../renderers/TimerRenderer");
const LeaveRenderer = require("../renderers/LeaveRenderer");
const WorktimeRenderer = require("../renderers/WorktimeRenderer");

/**
 * 🎯 NavigationHandler v4.0.0 - 근본 해결 버전
 *
 * ✅ 핵심 개선사항:
 * - 통합 ModuleRegistry와 완벽 연동
 * - 단순하고 안정적인 키보드 생성
 * - 에러 처리 강화
 * - 메모리 효율성 개선
 */
class NavigationHandler {
  constructor() {
    this.bot = null;
    this.moduleManager = null;
    this.renderers = new Map();

    // 📊 통계 (선택적)
    this.stats = {
      callbacksProcessed: 0,
      errorsCount: 0,
      lastActivity: null,
      keyboardsGenerated: 0,
    };

    logger.debug("🎹 NavigationHandler v4.0.0 생성됨");
  }

  /**
   * 🎯 초기화
   */
  initialize(bot) {
    this.bot = bot;
    this.registerRenderers();
    this.stats.lastActivity = new Date();
    logger.info("🎹 NavigationHandler v4.0.0 초기화 완료");
  }

  /**
   * 📱 렌더러 등록 (기존과 동일)
   */
  registerRenderers() {
    const renderers = [
      ["fortune", new FortuneRenderer(this.bot, this)],
      ["todo", new TodoRenderer(this.bot, this)],
      ["system", new SystemRenderer(this.bot, this)],
      ["tts", new TTSRenderer(this.bot, this)],
      ["weather", new WeatherRenderer(this.bot, this)],
      ["timer", new TimerRenderer(this.bot, this)],
      ["leave", new LeaveRenderer(this.bot, this)],
      ["worktime", new WorktimeRenderer(this.bot, this)],
    ];

    renderers.forEach(([name, renderer]) => {
      this.renderers.set(name, renderer);
      logger.debug(`📱 ${name} 렌더러 등록됨`);
    });
  }

  setModuleManager(moduleManager) {
    this.moduleManager = moduleManager;
  }

  /**
   * 🔧 콜백 데이터 파싱 (기존과 동일)
   */
  parseCallbackData(data) {
    if (!data || typeof data !== "string") {
      logger.warn("⚠️ 잘못된 콜백 데이터:", data);
      return { moduleKey: "system", subAction: "menu", params: "" };
    }

    const parts = data.split(":");
    return {
      moduleKey: parts[0] || "system",
      subAction: parts[1] || "menu",
      params: parts.length > 2 ? parts.slice(2).join(":") : "",
    };
  }

  /**
   * 🎯 메인 콜백 처리 (기존과 동일)
   */
  async handleCallback(ctx) {
    try {
      await ctx.answerCbQuery();

      this.stats.callbacksProcessed++;
      this.stats.lastActivity = new Date();

      const callbackQuery = ctx.callbackQuery;
      const data = callbackQuery.data;

      logger.debug(`🎯 콜백 수신: ${data}`);

      // 시스템 메뉴는 직접 처리
      if (data === "system:menu") {
        return await this.showMainMenu(ctx);
      }

      const { moduleKey, subAction, params } = this.parseCallbackData(data);

      logger.debug(`🎯 콜백 파싱 결과:`, {
        원본: data,
        moduleKey,
        subAction,
        params,
      });

      // 모듈에서 비즈니스 로직 처리
      const result = await this.moduleManager.handleCallback(
        this.bot,
        callbackQuery,
        moduleKey,
        subAction,
        params
      );

      if (!result) {
        logger.warn(`💫 모듈에서 결과 없음: ${moduleKey}.${subAction}`);
        return await this.renderErrorMessage(ctx, "처리할 수 없는 요청입니다.");
      }

      // 렌더러로 UI 렌더링
      const renderer = this.renderers.get(result.module || moduleKey);

      if (renderer) {
        await renderer.render(result, ctx);
        logger.debug(`✅ ${moduleKey}.${subAction} 렌더링 완료`);
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
   * 🏠 메인 메뉴 표시 - ✅ 근본 해결 버전
   */
  async showMainMenu(ctx) {
    try {
      // ✅ 안전한 컨텍스트 처리
      let user = null;
      let chatId = null;
      let messageId = null;
      let isCallbackQuery = false;

      if (ctx.callbackQuery) {
        user = ctx.callbackQuery.from;
        chatId = ctx.callbackQuery.message.chat.id;
        messageId = ctx.callbackQuery.message.message_id;
        isCallbackQuery = true;
      } else if (ctx.message) {
        user = ctx.message.from || ctx.from;
        chatId = ctx.message.chat.id;
        messageId = null;
        isCallbackQuery = false;
      } else if (ctx.from) {
        user = ctx.from;
        chatId = ctx.chat?.id;
        messageId = ctx.message?.message_id;
        isCallbackQuery = false;
      }

      if (!user || !chatId) {
        logger.error("💥 사용자 정보나 채팅 ID를 찾을 수 없습니다");
        return false;
      }

      const userName = getUserName(user);

      // ✅ 통합 레지스트리에서 모듈 정보 가져오기
      const enabledModules = getEnabledModules();

      logger.debug(
        `📋 활성 모듈 ${enabledModules.length}개 로드됨:`,
        enabledModules.map((m) => `${m.icon} ${m.key}`).join(", ")
      );

      // ✅ 메인 메뉴 텍스트 생성
      const text = this.buildMainMenuText(userName, enabledModules);

      // ✅ 통합 레지스트리에서 키보드 생성
      const keyboard = buildNavigationKeyboard();

      this.stats.keyboardsGenerated++;

      // ✅ 메시지 전송 방식 결정
      if (isCallbackQuery && messageId) {
        await ctx.editMessageText(text, {
          reply_markup: keyboard,
          parse_mode: "HTML",
        });
      } else {
        await ctx.reply(text, {
          reply_markup: keyboard,
          parse_mode: "HTML",
        });
      }

      logger.debug(
        `✅ 메인 메뉴 표시 완료 - 사용자: ${userName}, 모듈 ${
          enabledModules.length
        }개, 타입: ${isCallbackQuery ? "callback" : "message"}`
      );
      return true;
    } catch (error) {
      logger.error("💥 메인 메뉴 표시 오류:", {
        error: error.message,
        stack: error.stack.split("\n").slice(0, 3).join("\n"),
      });

      // 안전한 에러 응답
      try {
        await this.sendSafeErrorMessage(ctx, "메인 메뉴를 표시할 수 없습니다.");
      } catch (safeError) {
        logger.error("💥 안전한 에러 응답도 실패:", safeError.message);

        try {
          await ctx.reply(
            "❌ 시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
          );
        } catch (finalError) {
          logger.error("💥 최종 에러 응답 실패:", finalError.message);
        }
      }

      return false;
    }
  }

  /**
   * 📝 메인 메뉴 텍스트 생성
   */
  buildMainMenuText(userName, enabledModules) {
    let text = `🏠 메인 메뉴\n안녕하세요, ${userName}님!\n\n`;

    if (enabledModules.length > 0) {
      text += `🎯 사용 가능한 기능 (${enabledModules.length}개):\n`;
      enabledModules.forEach((module) => {
        text += `${module.icon} ${module.displayName}\n`;
      });
      text += `\n원하는 기능을 선택해주세요!`;
    } else {
      text += `⚠️ 현재 사용 가능한 모듈이 없습니다.\n잠시 후 다시 시도해주세요.`;
    }

    return text;
  }

  /**
   * 📱 모듈 메뉴 전송 (명령어용)
   */
  async sendModuleMenu(bot, chatId, moduleName) {
    try {
      // 통합 레지스트리에서 모듈 정보 조회
      const { findModuleByKey } = require("../config/ModuleRegistry");
      const moduleInfo = findModuleByKey(moduleName);

      if (!moduleInfo) {
        await bot.sendMessage(
          chatId,
          `❌ "${moduleName}" 모듈을 찾을 수 없습니다.`
        );
        return;
      }

      const text = `🎯 ${moduleInfo.displayName}\n${moduleInfo.description}`;
      const keyboard = {
        inline_keyboard: [
          [{ text: "📋 메뉴 열기", callback_data: `${moduleInfo.key}:menu` }],
        ],
      };

      await bot.sendMessage(chatId, text, { reply_markup: keyboard });
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
    const text = `⚠️ 렌더러 없음!\n\n모듈: ${
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
   * 🛡️ 안전한 에러 메시지 전송 - ✅ 개선된 버전
   */
  async sendSafeErrorMessage(ctx, message) {
    try {
      if (ctx.callbackQuery) {
        try {
          await ctx.editMessageText(`❌ ${message}`);
        } catch (editError) {
          await ctx.answerCbQuery(message, { show_alert: true });
        }
      } else {
        await ctx.reply(`❌ ${message}`);
      }
    } catch (error) {
      logger.error("💥 안전한 에러 메시지 전송 실패:", error.message);

      if (ctx.callbackQuery) {
        try {
          await ctx.answerCbQuery("오류가 발생했습니다.", { show_alert: true });
        } catch (finalError) {
          logger.error("💥 최종 콜백 응답도 실패:", finalError.message);
        }
      }
    }
  }

  /**
   * 📊 상태 정보
   */
  getStatus() {
    return {
      serviceName: "NavigationHandler",
      version: "4.0.0",
      isReady: !!(this.bot && this.moduleManager),
      stats: this.stats,
      rendererCount: this.renderers.size,
      registeredRenderers: Array.from(this.renderers.keys()),
    };
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    try {
      this.renderers.clear();
      this.bot = null;
      this.moduleManager = null;
      logger.info("✅ NavigationHandler 정리 완료");
    } catch (error) {
      logger.error("❌ NavigationHandler 정리 실패:", error);
    }
  }

  // ===== 🛠️ 유틸리티 메서드 (기존과 동일) =====

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
