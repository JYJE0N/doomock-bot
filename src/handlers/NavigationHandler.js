// src/handlers/NavigationHandler.js - 콜백 파싱 및 처리 문제 해결 v3.0.1
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");

/**
 * 🎹 NavigationHandler v3.0.1 - 콜백 파싱 및 처리 문제 해결
 *
 * 🎯 해결된 문제들:
 * 1. 콜백 데이터 파싱 오류 수정
 * 2. 모듈별 콜백 라우팅 개선
 * 3. 메시지 업데이트 실패 대응
 * 4. 안전한 fallback 메커니즘
 * 5. 중복 콜백 처리 방지
 */
class NavigationHandler {
  constructor(options = {}) {
    // 📊 통계
    this.stats = {
      navigationsHandled: 0,
      errorsCount: 0,
      systemNavigations: 0,
      moduleNavigations: 0,
      unknownNavigations: 0,
      lastActivity: null,
    };

    // ⚙️ 설정
    this.config = {
      enableLogging: options.enableLogging !== false,
      enableFallback: options.enableFallback !== false,
      cacheTimeout: options.cacheTimeout || 5000,
      maxRetries: options.maxRetries || 3,
      enableSafeMessageUpdate: true,
      ...options,
    };

    // 🗂️ 캐시 및 상태 관리
    this.callbackCache = new Map();
    this.processingCallbacks = new Set();
    this.cacheTimeout = this.config.cacheTimeout;

    logger.info("🎹 NavigationHandler v3.0.1 생성됨 (콜백 처리 문제 해결)");
  }

  /**
   * 🎯 네비게이션 처리 (메인 엔트리포인트)
   */
  async handleNavigation(bot, callbackQuery, subAction, params, moduleManager) {
    const startTime = Date.now();
    const callbackId = callbackQuery?.id || `unknown_${Date.now()}`;

    try {
      // 🔒 중복 처리 방지 (강화됨)
      if (
        this.callbackCache.has(callbackId) ||
        this.processingCallbacks.has(callbackId)
      ) {
        logger.debug(`🔄 중복 네비게이션 콜백 무시: ${callbackId}`);
        return true;
      }

      // 처리 시작 마킹
      this.processingCallbacks.add(callbackId);
      this.callbackCache.set(callbackId, true);

      // 자동 정리 스케줄링
      setTimeout(() => {
        this.callbackCache.delete(callbackId);
        this.processingCallbacks.delete(callbackId);
      }, this.cacheTimeout);

      // 🔍 안전한 콜백 데이터 파싱
      const { moduleKey, action, additionalParams } =
        this.parseCallbackDataSafely(callbackQuery.data);

      // 📊 통계 업데이트
      this.stats.lastActivity = TimeHelper.getLogTimeString();

      logger.debug(
        `🎹 NavigationHandler: ${moduleKey}:${action} ${
          additionalParams.length > 0 ? `(${additionalParams.join(", ")})` : ""
        }`
      );

      // 🏠 시스템 네비게이션 처리 (직접 처리)
      if (this.isSystemNavigation(moduleKey)) {
        const handled = await this.handleSystemNavigationSafely(
          bot,
          callbackQuery,
          action,
          additionalParams,
          moduleManager
        );

        if (handled) {
          this.stats.navigationsHandled++;
          this.stats.systemNavigations++;
          return true;
        }
      }

      // 📦 모듈 네비게이션 처리 (ModuleManager로 위임)
      const moduleHandled = await this.handleModuleNavigationSafely(
        bot,
        callbackQuery,
        moduleKey,
        action,
        additionalParams,
        moduleManager
      );

      if (moduleHandled) {
        this.stats.navigationsHandled++;
        this.stats.moduleNavigations++;
        return true;
      }

      // ❓ 처리되지 않은 네비게이션
      this.stats.unknownNavigations++;
      await this.handleUnknownNavigationSafely(
        bot,
        callbackQuery,
        moduleKey,
        action
      );
      return false;
    } catch (error) {
      logger.error("❌ NavigationHandler 처리 오류:", error);
      this.stats.errorsCount++;

      await this.handleNavigationErrorSafely(bot, callbackQuery, error);
      return false;
    } finally {
      // 처리 완료 정리
      this.processingCallbacks.delete(callbackId);

      const duration = Date.now() - startTime;
      logger.debug(`🎹 Navigation 처리 완료: ${callbackId} (${duration}ms)`);
    }
  }

  /**
   * 🔍 안전한 콜백 데이터 파싱 (강화됨)
   */
  parseCallbackDataSafely(callbackData) {
    try {
      // 기본값 설정
      const defaultResult = {
        moduleKey: "system",
        action: "menu",
        additionalParams: [],
      };

      // 입력 검증
      if (!callbackData || typeof callbackData !== "string") {
        logger.warn("❓ NavigationHandler: 빈 또는 잘못된 콜백 데이터");
        return defaultResult;
      }

      // 공백 제거 및 정규화
      const cleanData = callbackData.trim();
      if (!cleanData) {
        logger.warn("❓ NavigationHandler: 빈 콜백 데이터");
        return defaultResult;
      }

      // 🔍 콜론(:) 기준으로 파싱
      const parts = cleanData.split(":");

      if (parts.length === 0) {
        logger.warn("❓ NavigationHandler: 콜론이 없는 콜백 데이터");
        return defaultResult;
      }

      const result = {
        moduleKey: (parts[0] || "system").toLowerCase().trim(),
        action: (parts[1] || "menu").toLowerCase().trim(),
        additionalParams: parts
          .slice(2)
          .map((param) => param.trim())
          .filter((param) => param.length > 0),
      };

      // 모듈 키 정규화 (별칭 처리)
      result.moduleKey = this.normalizeModuleKey(result.moduleKey);

      // 액션 정규화
      result.action = this.normalizeAction(result.action);

      // 📝 상세 로깅
      if (this.config.enableLogging) {
        logger.debug(
          `🔍 Navigation 파싱: "${cleanData}" → ${result.moduleKey}:${
            result.action
          }${
            result.additionalParams.length > 0
              ? `:${result.additionalParams.join(":")}`
              : ""
          }`
        );
      }

      return result;
    } catch (error) {
      logger.error("❌ NavigationHandler 콜백 파싱 오류:", error);
      return {
        moduleKey: "system",
        action: "menu",
        additionalParams: [],
      };
    }
  }

  /**
   * 🔧 모듈 키 정규화 (별칭 처리)
   */
  normalizeModuleKey(moduleKey) {
    const aliasMap = {
      main: "system",
      home: "system",
      start: "system",
      todo: "TodoModule",
      timer: "TimerModule",
      worktime: "WorktimeModule",
      vacation: "LeaveModule",
      leave: "LeaveModule",
      fortune: "FortuneModule",
      weather: "WeatherModule",
      tts: "TTSModule",
      system: "system",
    };

    return aliasMap[moduleKey] || moduleKey;
  }

  /**
   * 🔧 액션 정규화
   */
  normalizeAction(action) {
    const aliasMap = {
      "": "menu",
      main: "menu",
      home: "menu",
      start: "menu",
    };

    return aliasMap[action] || action;
  }

  /**
   * 🏠 시스템 네비게이션 판별
   */
  isSystemNavigation(moduleKey) {
    const systemKeys = ["system", "main", "home"];
    return systemKeys.includes(moduleKey.toLowerCase());
  }

  /**
   * 🏠 안전한 시스템 네비게이션 처리
   */
  async handleSystemNavigationSafely(
    bot,
    callbackQuery,
    action,
    params,
    moduleManager
  ) {
    try {
      logger.debug(`🏠 시스템 네비게이션: ${action}`);

      // 액션별 처리
      switch (action) {
        case "menu":
        case "start":
          await this.showMainMenuSafely(bot, callbackQuery, moduleManager);
          return true;

        case "status":
          await this.showSystemStatusSafely(bot, callbackQuery, moduleManager);
          return true;

        case "help":
          await this.showHelpMenuSafely(bot, callbackQuery);
          return true;

        default:
          logger.warn(`❓ 알 수 없는 시스템 액션: ${action}`);
          await this.showUnknownActionSafely(bot, callbackQuery, action);
          return false;
      }
    } catch (error) {
      logger.error(`❌ 시스템 네비게이션 처리 오류 (${action}):`, error);
      await this.showSystemErrorSafely(
        bot,
        callbackQuery,
        `시스템 ${action} 처리 중 오류가 발생했습니다.`
      );
      return false;
    }
  }

  /**
   * 📦 안전한 모듈 네비게이션 처리
   */
  async handleModuleNavigationSafely(
    bot,
    callbackQuery,
    moduleKey,
    action,
    params,
    moduleManager
  ) {
    try {
      // ModuleManager 확인
      if (!moduleManager) {
        logger.warn("⚠️ ModuleManager가 없음");
        await this.showSystemErrorSafely(
          bot,
          callbackQuery,
          "모듈 관리자를 찾을 수 없습니다."
        );
        return false;
      }

      // 모듈 존재 확인 (안전한 방식)
      const moduleExists = await this.checkModuleExistsSafely(
        moduleManager,
        moduleKey
      );
      if (!moduleExists) {
        logger.warn(`⚠️ 모듈을 찾을 수 없음: ${moduleKey}`);
        await this.showModuleNotFoundSafely(bot, callbackQuery, moduleKey);
        return false;
      }

      // 모듈 인스턴스 가져오기
      const moduleInstance = await this.getModuleInstanceSafely(
        moduleManager,
        moduleKey
      );
      if (!moduleInstance) {
        logger.warn(`⚠️ 모듈 인스턴스가 없음: ${moduleKey}`);
        await this.showModuleNotAvailableSafely(bot, callbackQuery, moduleKey);
        return false;
      }

      // 모듈 콜백 처리 함수 확인
      if (
        !moduleInstance.handleCallback ||
        typeof moduleInstance.handleCallback !== "function"
      ) {
        logger.warn(`⚠️ ${moduleKey}: handleCallback 함수가 없음`);
        await this.showModuleErrorSafely(
          bot,
          callbackQuery,
          moduleKey,
          "모듈이 콜백 처리를 지원하지 않습니다."
        );
        return false;
      }

      // 🎯 모듈 콜백 처리 실행
      logger.debug(`📦 모듈 콜백 처리: ${moduleKey}:${action}`);

      const handled = await moduleInstance.handleCallback(
        bot,
        callbackQuery,
        action,
        params,
        moduleManager
      );

      if (handled) {
        logger.debug(`✅ ${moduleKey} 콜백 처리 성공`);
        return true;
      } else {
        logger.warn(`⚠️ ${moduleKey} 콜백 처리 실패 또는 미처리`);
        await this.showModuleErrorSafely(
          bot,
          callbackQuery,
          moduleKey,
          "요청을 처리할 수 없습니다."
        );
        return false;
      }
    } catch (error) {
      logger.error(
        `❌ 모듈 네비게이션 처리 오류 (${moduleKey}:${action}):`,
        error
      );
      await this.showModuleErrorSafely(
        bot,
        callbackQuery,
        moduleKey,
        "처리 중 오류가 발생했습니다."
      );
      return false;
    }
  }

  /**
   * 🔍 안전한 모듈 존재 확인
   */
  async checkModuleExistsSafely(moduleManager, moduleKey) {
    try {
      if (typeof moduleManager.hasModule === "function") {
        return moduleManager.hasModule(moduleKey);
      }

      if (moduleManager.moduleInstances && moduleManager.moduleInstances.has) {
        return moduleManager.moduleInstances.has(moduleKey);
      }

      return false;
    } catch (error) {
      logger.debug(`모듈 존재 확인 오류 (${moduleKey}): ${error.message}`);
      return false;
    }
  }

  /**
   * 🔍 안전한 모듈 인스턴스 가져오기
   */
  async getModuleInstanceSafely(moduleManager, moduleKey) {
    try {
      if (typeof moduleManager.getModule === "function") {
        return moduleManager.getModule(moduleKey);
      }

      if (moduleManager.moduleInstances && moduleManager.moduleInstances.get) {
        return moduleManager.moduleInstances.get(moduleKey);
      }

      return null;
    } catch (error) {
      logger.debug(`모듈 인스턴스 조회 오류 (${moduleKey}): ${error.message}`);
      return null;
    }
  }

  /**
   * 🏠 안전한 메인 메뉴 표시
   */
  async showMainMenuSafely(bot, callbackQuery, moduleManager) {
    try {
      const userName = getUserName(callbackQuery.from);
      const currentTime = TimeHelper.format(new Date(), "YYYY-MM-DD HH:mm");

      const menuText = `🏠 **메인 메뉴**

안녕하세요, ${userName}님!
현재 시간: ${currentTime}

어떤 기능을 사용하시겠어요?`;

      const keyboard = this.buildMainMenuKeyboard(moduleManager);

      await this.updateMessageSafely(bot, callbackQuery, menuText, keyboard);
    } catch (error) {
      logger.error("❌ 메인 메뉴 표시 오류:", error);
      await this.showSimpleMenuSafely(bot, callbackQuery);
    }
  }

  /**
   * 📊 안전한 시스템 상태 표시
   */
  async showSystemStatusSafely(bot, callbackQuery, moduleManager) {
    try {
      const uptime = process.uptime();
      const memory = process.memoryUsage();

      const statusText = `📊 **시스템 상태**

🕐 **업타임**: ${this.formatUptime(uptime)}
💾 **메모리**: ${Math.round(memory.heapUsed / 1024 / 1024)}MB
📦 **모듈**: ${moduleManager ? "연결됨" : "연결 안됨"}

🔄 **네비게이션 통계**:
• 처리된 네비게이션: ${this.stats.navigationsHandled}개
• 시스템 네비게이션: ${this.stats.systemNavigations}개  
• 모듈 네비게이션: ${this.stats.moduleNavigations}개
• 알 수 없는 네비게이션: ${this.stats.unknownNavigations}개
• 에러: ${this.stats.errorsCount}개`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 새로고침", callback_data: "system:status" },
            { text: "🏠 메인 메뉴", callback_data: "system:menu" },
          ],
        ],
      };

      await this.updateMessageSafely(bot, callbackQuery, statusText, keyboard);
    } catch (error) {
      logger.error("❌ 시스템 상태 표시 오류:", error);
      await this.showSystemErrorSafely(
        bot,
        callbackQuery,
        "시스템 상태를 가져올 수 없습니다."
      );
    }
  }

  /**
   * 📝 안전한 메시지 업데이트 (핵심!)
   */
  async updateMessageSafely(bot, callbackQuery, text, keyboard) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    try {
      // 1차 시도: Markdown 모드
      try {
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });

        logger.debug("✅ 메시지 업데이트 성공 (Markdown)");
        return;
      } catch (markdownError) {
        // 2차 시도: 일반 텍스트
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: keyboard,
        });

        logger.debug("✅ 메시지 업데이트 성공 (일반 텍스트)");
        return;
      }
    } catch (editError) {
      logger.warn(`⚠️ 메시지 편집 실패: ${editError.message}`);

      // 3차 시도: 새 메시지 전송
      if (this.config.enableFallback) {
        try {
          const fallbackText = `📝 ${text}\n\n⚠️ 메시지 업데이트 중 문제가 발생했습니다.`;

          await bot.sendMessage(chatId, fallbackText, {
            reply_markup: keyboard,
            parse_mode: undefined,
          });

          logger.warn("⚠️ Fallback 메시지 전송됨");
          return;
        } catch (fallbackError) {
          logger.error("❌ Fallback 메시지도 실패:", fallbackError);
        }
      }

      throw editError;
    }

    // 콜백 쿼리 응답
    try {
      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (callbackError) {
      logger.debug("콜백 쿼리 응답 실패:", callbackError.message);
    }
  }

  /**
   * 🏠 메인 메뉴 키보드 생성
   */
  buildMainMenuKeyboard(moduleManager) {
    try {
      const modules = this.getActiveModules(moduleManager);
      const keyboard = { inline_keyboard: [] };

      if (modules.length > 0) {
        // 모듈을 2개씩 묶어서 행 생성
        for (let i = 0; i < modules.length; i += 2) {
          const row = [];

          for (let j = i; j < Math.min(i + 2, modules.length); j++) {
            const module = modules[j];
            row.push({
              text: `${module.emoji} ${module.shortName}`,
              callback_data: `${module.key}:menu`,
            });
          }

          keyboard.inline_keyboard.push(row);
        }
      }

      // 시스템 메뉴
      keyboard.inline_keyboard.push([
        { text: "📊 상태", callback_data: "system:status" },
        { text: "❓ 도움말", callback_data: "system:help" },
      ]);

      return keyboard;
    } catch (error) {
      logger.error("메인 메뉴 키보드 생성 오류:", error);
      return {
        inline_keyboard: [
          [{ text: "🔄 새로고침", callback_data: "system:menu" }],
        ],
      };
    }
  }

  /**
   * 📋 활성 모듈 목록 조회 (안전한 방식)
   */
  getActiveModules(moduleManager) {
    if (!moduleManager) return [];

    try {
      // 여러 방식으로 모듈 목록 시도
      let modules = [];

      if (typeof moduleManager.getActiveModulesStatus === "function") {
        modules = moduleManager.getActiveModulesStatus();
      } else if (moduleManager.moduleInstances) {
        modules = Array.from(moduleManager.moduleInstances.keys()).map(
          (key) => ({
            key: key,
            name: key,
            emoji: this.getModuleEmoji(key),
          })
        );
      }

      return modules
        .map((module) => ({
          key: module.key,
          name: module.name || module.key,
          shortName: (module.name || module.key).substring(0, 4),
          emoji: module.emoji || this.getModuleEmoji(module.key),
          description:
            module.description || `${module.name || module.key} 기능`,
          priority: module.priority || 99,
        }))
        .sort((a, b) => a.priority - b.priority);
    } catch (error) {
      logger.error("활성 모듈 조회 오류:", error);
      return [];
    }
  }

  /**
   * 🎨 모듈 이모지 매핑
   */
  getModuleEmoji(moduleKey) {
    const emojiMap = {
      TodoModule: "📝",
      TimerModule: "⏰",
      WorktimeModule: "🕐",
      LeaveModule: "🏖️",
      FortuneModule: "🔮",
      WeatherModule: "🌤️",
      TTSModule: "🎤",
      SystemModule: "⚙️",
      todo: "📝",
      timer: "⏰",
      worktime: "🕐",
      vacation: "🏖️",
      fortune: "🔮",
      weather: "🌤️",
      tts: "🎤",
      system: "⚙️",
    };

    return emojiMap[moduleKey] || "📦";
  }

  /**
   * ❓ 안전한 알 수 없는 네비게이션 처리
   */
  async handleUnknownNavigationSafely(bot, callbackQuery, moduleKey, action) {
    try {
      logger.warn(`❓ 처리되지 않은 네비게이션: ${moduleKey}:${action}`);

      const errorText = `❓ **처리할 수 없는 요청**

모듈: \`${moduleKey}\`
액션: \`${action}\`

해당 기능이 아직 구현되지 않았거나
모듈이 비활성화되었습니다.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🏠 메인 메뉴", callback_data: "system:menu" },
            { text: "📊 상태 확인", callback_data: "system:status" },
          ],
        ],
      };

      await this.updateMessageSafely(bot, callbackQuery, errorText, keyboard);
    } catch (error) {
      logger.error("❌ 알 수 없는 네비게이션 처리 오류:", error);
      await this.showSimpleMenuSafely(bot, callbackQuery);
    }
  }

  /**
   * 🚨 안전한 네비게이션 에러 처리
   */
  async handleNavigationErrorSafely(bot, callbackQuery, error) {
    try {
      const errorText = `🚨 **네비게이션 오류**

처리 중 오류가 발생했습니다.

에러: \`${error.message || "알 수 없는 오류"}\`

메인 메뉴로 돌아가서 다시 시도해주세요.`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
        ],
      };

      await this.updateMessageSafely(bot, callbackQuery, errorText, keyboard);
    } catch (updateError) {
      logger.error("❌ 에러 메시지 업데이트도 실패:", updateError);
      await this.showSimpleMenuSafely(bot, callbackQuery);
    }
  }

  /**
   * 📝 간단한 메뉴 표시 (최후의 수단)
   */
  async showSimpleMenuSafely(bot, callbackQuery) {
    try {
      const chatId = callbackQuery.message?.chat?.id || callbackQuery.from?.id;

      if (chatId) {
        await bot.sendMessage(
          chatId,
          "🏠 메인 메뉴\n\n/start 명령으로 다시 시작해주세요.",
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔄 다시 시작", callback_data: "system:start" }],
              ],
            },
          }
        );
      }
    } catch (error) {
      logger.error("❌ 간단한 메뉴 표시도 실패:", error);
    }
  }

  /**
   * ⏱️ 업타임 포맷팅
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}일 ${hours}시간`;
    } else if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else {
      return `${minutes}분`;
    }
  }

  /**
   * 🛑 정리
   */
  async cleanup() {
    try {
      logger.info("🛑 NavigationHandler 정리 시작...");

      this.callbackCache.clear();
      this.processingCallbacks.clear();

      logger.info("✅ NavigationHandler 정리 완료");
    } catch (error) {
      logger.error("❌ NavigationHandler 정리 실패:", error);
    }
  }
}

module.exports = NavigationHandler;
