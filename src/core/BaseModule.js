// src/core/BaseModule.js - 긴급 수정 v3.0.1
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName, getUserId } = require("../utils/UserHelper");

/**
 * 🏗️ 베이스 모듈 - 모든 모듈의 부모 클래스 (긴급 수정)
 *
 * 🚨 긴급 수정사항:
 * - requireService 메서드 구현
 * - ServiceBuilder 연동 추가
 * - 안전한 초기화 로직
 * - 의존성 주입 체계 완성
 */
class BaseModule {
  constructor(moduleName, options = {}) {
    this.moduleName = moduleName;
    this.bot = options.bot;
    this.db = options.db;
    this.moduleManager = options.moduleManager;
    this.config = options.config || {};

    // 🔧 ServiceBuilder 연결 (긴급 추가!)
    this.serviceBuilder = options.serviceBuilder;
    this.moduleKey = options.moduleKey;
    this.moduleConfig = options.moduleConfig;

    // 🎯 액션 맵 (핵심!)
    this.actionMap = new Map();

    // 📊 사용자 상태 관리
    this.userStates = new Map();

    // 📊 통계
    this.stats = {
      callbacksHandled: 0,
      messagesHandled: 0,
      errorsCount: 0,
      lastActivity: null,
    };

    // ⏱️ 기본 설정
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      cacheEnabled: true,
      ...options.config,
    };

    this.isInitialized = false;
    logger.info(`🏗️ ${moduleName} 베이스 모듈 생성됨`);
  }

  /**
   * 🔧 서비스 요청 (긴급 구현!)
   */
  async requireService(serviceName) {
    try {
      logger.debug(`🔧 ${this.moduleName}: ${serviceName} 서비스 요청 중...`);

      // ServiceBuilder가 없으면 직접 서비스 생성 시도
      if (!this.serviceBuilder) {
        logger.warn(
          `⚠️ ${this.moduleName}: ServiceBuilder가 없어 서비스 직접 생성 시도`
        );
        return await this.createServiceDirectly(serviceName);
      }

      // ServiceBuilder를 통한 서비스 요청
      const service = await this.serviceBuilder.requireService(serviceName);

      if (!service) {
        logger.error(`❌ ${this.moduleName}: ${serviceName} 서비스 요청 실패`);
        // 폴백: 직접 생성 시도
        return await this.createServiceDirectly(serviceName);
      }

      logger.debug(`✅ ${this.moduleName}: ${serviceName} 서비스 획득 완료`);
      return service;
    } catch (error) {
      logger.error(
        `❌ ${this.moduleName}: ${serviceName} 서비스 요청 오류:`,
        error
      );

      // 마지막 수단: 직접 생성
      try {
        return await this.createServiceDirectly(serviceName);
      } catch (fallbackError) {
        logger.error(
          `❌ ${this.moduleName}: ${serviceName} 서비스 직접 생성도 실패:`,
          fallbackError
        );
        return null;
      }
    }
  }

  /**
   * 🆘 서비스 직접 생성 (폴백 방법)
   */
  async createServiceDirectly(serviceName) {
    try {
      logger.warn(
        `🆘 ${this.moduleName}: ${serviceName} 서비스 직접 생성 시도...`
      );

      // 서비스 클래스 매핑
      const serviceMap = {
        todo: "../services/TodoService",
        timer: "../services/TimerService",
        worktime: "../services/WorktimeService",
        leave: "../services/LeaveService",
        reminder: "../services/ReminderService",
        weather: "../services/WeatherService",
        fortune: "../services/FortuneService",
        tts: "../services/TTSService",
      };

      const servicePath = serviceMap[serviceName];
      if (!servicePath) {
        throw new Error(`알 수 없는 서비스: ${serviceName}`);
      }

      // 서비스 클래스 로드
      const ServiceClass = require(servicePath);

      // 서비스 인스턴스 생성
      const serviceInstance = new ServiceClass({
        db: this.db,
        config: this.config,
      });

      // 서비스 초기화
      if (
        serviceInstance.initialize &&
        typeof serviceInstance.initialize === "function"
      ) {
        await serviceInstance.initialize();
      }

      logger.success(
        `✅ ${this.moduleName}: ${serviceName} 서비스 직접 생성 완료`
      );
      return serviceInstance;
    } catch (error) {
      logger.error(
        `❌ ${this.moduleName}: ${serviceName} 서비스 직접 생성 실패:`,
        error
      );
      return null;
    }
  }

  /**
   * 🎯 모듈 초기화 (표준 패턴)
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn(`${this.moduleName} 이미 초기화됨`);
      return;
    }

    try {
      logger.info(`🎯 ${this.moduleName} 초기화 시작...`);

      // 자식 클래스의 초기화 로직
      await this.onInitialize();

      // 액션 설정
      this.setupActions();

      this.isInitialized = true;
      logger.success(`✅ ${this.moduleName} 초기화 완료`);
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 초기화 실패:`, error);

      // 🛡️ 안전 모드 시도
      try {
        logger.warn(`⚠️ ${this.moduleName} 안전 모드 초기화 시도...`);
        await this.safeInitialize();
        logger.warn(`⚠️ ${this.moduleName} 안전 모드로 부분 초기화됨`);
      } catch (safeError) {
        logger.error(
          `❌ ${this.moduleName} 안전 모드 초기화도 실패:`,
          safeError
        );
        throw error;
      }
    }
  }

  /**
   * 🛡️ 안전 모드 초기화
   */
  async safeInitialize() {
    // 최소한의 기능이라도 제공
    this.setupBasicActions();
    this.isInitialized = true; // 부분적으로라도 초기화 표시
  }

  /**
   * 🆘 기본 액션 설정 (안전 모드용)
   */
  setupBasicActions() {
    this.registerActions({
      menu: this.handleBasicMenu.bind(this),
      help: this.handleBasicHelp.bind(this),
      unavailable: this.handleServiceUnavailable.bind(this),
    });
  }

  /**
   * 🆘 기본 메뉴 처리
   */
  async handleBasicMenu(bot, callbackQuery, params, moduleManager) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;

    const menuText =
      `⚠️ **${this.moduleName} - 제한 모드**\n\n` +
      `현재 이 모듈은 제한된 기능만 사용 가능합니다.\n` +
      `시스템 관리자에게 문의하세요.`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 메인 메뉴", callback_data: "system:menu" }],
      ],
    };

    try {
      await bot.editMessageText(menuText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error(`${this.moduleName} 기본 메뉴 전송 실패:`, error);
    }
  }

  /**
   * 🆘 기본 도움말 처리
   */
  async handleBasicHelp(bot, callbackQuery, params, moduleManager) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;

    const helpText =
      `❓ **${this.moduleName} 도움말**\n\n` +
      `⚠️ 현재 이 모듈은 초기화 문제로 인해\n` +
      `정상적으로 작동하지 않습니다.\n\n` +
      `**문제 해결 방법:**\n` +
      `• 봇 재시작 시도\n` +
      `• 시스템 관리자 문의\n` +
      `• 잠시 후 다시 시도`;

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "🔙 메뉴로",
            callback_data: `${this.moduleName.toLowerCase()}:menu`,
          },
        ],
      ],
    };

    try {
      await bot.editMessageText(helpText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error(`${this.moduleName} 기본 도움말 전송 실패:`, error);
    }
  }

  /**
   * 🆘 서비스 사용 불가 처리
   */
  async handleServiceUnavailable(bot, callbackQuery, params, moduleManager) {
    const chatId = callbackQuery.message.chat.id;

    await this.sendMessage(
      bot,
      chatId,
      `❌ **${this.moduleName} 서비스 사용 불가**\n\n` +
        `현재 이 모듈의 서비스가 사용 불가능한 상태입니다.\n` +
        `잠시 후 다시 시도해주세요.`
    );
  }

  /**
   * 🎯 자식 클래스에서 구현할 초기화 메서드
   */
  async onInitialize() {
    // 자식 클래스에서 구현
    // 예: 서비스 연결, DB 초기화 등
  }

  /**
   * 🎯 액션 설정 (자식 클래스에서 구현)
   */
  setupActions() {
    // 자식 클래스에서 구현
    // 예: this.registerActions({ menu: this.showMenu, ... });
  }

  /**
   * 🎯 표준 콜백 처리 (핵심!)
   */
  async handleCallback(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      // 매개변수 검증
      if (
        !this.validateCallbackParams(
          bot,
          callbackQuery,
          subAction,
          params,
          moduleManager
        )
      ) {
        return false;
      }

      // 통계 업데이트
      this.stats.callbacksHandled++;
      this.stats.lastActivity = TimeHelper.getLogTimeString();

      // 액션 실행
      const action = this.actionMap.get(subAction);
      if (!action) {
        logger.warn(`${this.moduleName}: 알 수 없는 액션 - ${subAction}`);
        await this.sendActionNotFound(bot, callbackQuery, subAction);
        return false;
      }

      // 표준 매개변수로 액션 실행
      await action.call(this, bot, callbackQuery, params, moduleManager);

      logger.debug(`✅ ${this.moduleName}.${subAction} 처리 완료`);
      return true;
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 콜백 처리 오류:`, error);
      this.stats.errorsCount++;

      await this.sendError(bot, callbackQuery, "처리 중 오류가 발생했습니다.");
      return false;
    }
  }

  /**
   * 🎯 표준 메시지 처리
   */
  async handleMessage(bot, msg) {
    try {
      // 메시지 검증
      if (!this.validateMessageParams(bot, msg)) {
        return false;
      }

      // 통계 업데이트
      this.stats.messagesHandled++;
      this.stats.lastActivity = TimeHelper.getLogTimeString();

      // 자식 클래스의 메시지 처리 로직
      const handled = await this.onHandleMessage(bot, msg);

      if (handled) {
        logger.debug(`✅ ${this.moduleName} 메시지 처리 완료`);
      }

      return handled;
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 메시지 처리 오류:`, error);
      this.stats.errorsCount++;
      return false;
    }
  }

  /**
   * 🎯 자식 클래스에서 구현할 메시지 처리
   */
  async onHandleMessage(bot, msg) {
    // 자식 클래스에서 구현
    return false;
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 액션 등록
   */
  registerAction(name, handler) {
    if (typeof handler !== "function") {
      throw new Error(`핸들러는 함수여야 합니다: ${name}`);
    }
    this.actionMap.set(name, handler.bind(this));
    logger.debug(`🎯 ${this.moduleName}.${name} 액션 등록됨`);
  }

  /**
   * 여러 액션 한번에 등록
   */
  registerActions(actions) {
    for (const [name, handler] of Object.entries(actions)) {
      this.registerAction(name, handler);
    }
  }

  /**
   * 매개변수 검증 - 콜백
   */
  validateCallbackParams(bot, callbackQuery, subAction, params, moduleManager) {
    if (!bot || !callbackQuery) {
      logger.error(`${this.moduleName}: 필수 매개변수 누락`);
      return false;
    }

    if (!callbackQuery.message || !callbackQuery.from) {
      logger.error(`${this.moduleName}: callbackQuery 구조 오류`);
      return false;
    }

    return true;
  }

  /**
   * 매개변수 검증 - 메시지
   */
  validateMessageParams(bot, msg) {
    if (!bot || !msg) {
      logger.error(`${this.moduleName}: 필수 매개변수 누락`);
      return false;
    }

    if (!msg.chat || !msg.from) {
      logger.error(`${this.moduleName}: 메시지 구조 오류`);
      return false;
    }

    return true;
  }

  /**
   * 명령어 추출
   */
  extractCommand(text) {
    if (!text || !text.startsWith("/")) {
      return null;
    }
    return text.split(" ")[0].substring(1).toLowerCase();
  }

  /**
   * 사용자 상태 관리
   */
  setUserState(userId, state) {
    this.userStates.set(userId.toString(), {
      ...state,
      timestamp: Date.now(),
      module: this.moduleName,
    });
  }

  getUserState(userId) {
    return this.userStates.get(userId.toString()) || null;
  }

  clearUserState(userId) {
    this.userStates.delete(userId.toString());
  }

  /**
   * 메시지 전송 (안전한 버전)
   */
  async sendMessage(bot, chatId, text, options = {}) {
    try {
      return await bot.sendMessage(chatId, text, {
        parse_mode: "Markdown",
        ...options,
      });
    } catch (error) {
      logger.error(`${this.moduleName} 메시지 전송 오류:`, error);

      // 마크다운 실패 시 일반 텍스트로 재시도
      try {
        return await bot.sendMessage(chatId, text, {
          ...options,
          parse_mode: undefined,
        });
      } catch (retryError) {
        logger.error(`${this.moduleName} 메시지 재전송 실패:`, retryError);
        throw retryError;
      }
    }
  }

  /**
   * 메시지 편집 (안전한 버전)
   */
  async editMessage(bot, chatId, messageId, text, options = {}) {
    try {
      return await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        ...options,
      });
    } catch (error) {
      logger.error(`${this.moduleName} 메시지 편집 오류:`, error);

      // 마크다운 실패 시 일반 텍스트로 재시도
      try {
        return await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          ...options,
          parse_mode: undefined,
        });
      } catch (retryError) {
        logger.error(`${this.moduleName} 메시지 재편집 실패:`, retryError);
        throw retryError;
      }
    }
  }

  /**
   * 에러 메시지 전송
   */
  async sendError(bot, callbackQuery, message) {
    try {
      const chatId = callbackQuery.message.chat.id;
      const errorText = `❌ **${this.moduleName} 오류**\n\n${message}`;

      await this.sendMessage(bot, chatId, errorText);
    } catch (error) {
      logger.error(`${this.moduleName} 에러 메시지 전송 실패:`, error);
    }
  }

  /**
   * 액션 없음 메시지 전송
   */
  async sendActionNotFound(bot, callbackQuery, action) {
    try {
      const chatId = callbackQuery.message.chat.id;
      const notFoundText =
        `❓ **알 수 없는 명령**\n\n` + `'${action}' 명령을 찾을 수 없습니다.`;

      await this.sendMessage(bot, chatId, notFoundText);
    } catch (error) {
      logger.error(`${this.moduleName} 액션 없음 메시지 전송 실패:`, error);
    }
  }

  /**
   * 상태 조회
   */
  getStatus() {
    return {
      moduleName: this.moduleName,
      isInitialized: this.isInitialized,
      actionCount: this.actionMap.size,
      userStatesCount: this.userStates.size,
      stats: this.stats,
      config: this.config,
    };
  }

  /**
   * 정리
   */
  async cleanup() {
    try {
      this.actionMap.clear();
      this.userStates.clear();
      this.stats.lastActivity = null;
      this.isInitialized = false;

      logger.info(`✅ ${this.moduleName} 정리 완료`);
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 정리 실패:`, error);
    }
  }
}

module.exports = BaseModule;
