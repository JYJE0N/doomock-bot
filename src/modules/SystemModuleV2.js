/**
 * 🚇 SystemModuleV2.js - EventBus 기반 시스템 모듈
 * 완전한 이벤트 기반 아키텍처로 구현된 시스템 모듈
 */

const { EVENTS } = require("../events/index");
const logger = require("../utils/core/Logger");

// 🔧 강화된 헬퍼들 import (기존과 동일)
const {
  getCompleteSystemSnapshot,
  // formatMemoryUsage,
  // formatUptime,
  _getSystemHealth
} = require("../utils/core/SystemHelper");

// const { StatusHelper } = require("../utils/StatusHelper");

class SystemModuleV2 {
  constructor(moduleName = "system", options = {}) {
    this.moduleName = moduleName;
    
    // ✅ EventBus 강제 주입 - fallback 제거로 중복 인스턴스 방지
    if (!options.eventBus) {
      throw new Error(`EventBus must be injected via options for module: ${moduleName}`);
    }
    this.eventBus = options.eventBus;
    
    // V2 모듈 필수 속성들
    this.isInitialized = false;
    this.serviceBuilder = options.serviceBuilder || null;

    this.config = {
      maxLogLines: 50,
      botVersion: process.env.BOT_VERSION || "4.0.0",
      enableDetailedStats: true,
      enableHealthScoring: true,
      ...options.config
    };

    this.systemStats = {
      startTime: Date.now(),
      totalCallbacks: 0,
      totalMessages: 0,
      uniqueUsers: new Set(),
      lastHealthCheck: null
    };

    // 🛑 이벤트 중복 처리 방지 플래그
    this.isStartupHandled = false;

    // 🚇 이벤트 리스너 설정
    this.setupEventListeners();

    logger.info("🚇 SystemModuleV2 초기화 완료 (이벤트 기반)");
  }

  /**
   * 🎯 이벤트 리스너 설정 (핵심!)
   */
  setupEventListeners() {
    // 1. 사용자 명령어 처리
    this.eventBus.subscribe(EVENTS.USER.COMMAND, async (event) => {
      await this.handleUserCommand(event);
    });

    // 2. 사용자 콜백 처리 (시스템 관련만)
    this.eventBus.subscribe(EVENTS.USER.CALLBACK, async (event) => {
      await this.handleUserCallback(event);
    });

    // 3. 시스템 시작 이벤트
    this.eventBus.subscribe(EVENTS.SYSTEM.STARTUP, async (event) => {
      await this.handleSystemStartup(event);
    });

    // 4. 시스템 건강도 체크 요청
    this.eventBus.subscribe(EVENTS.SYSTEM.HEALTH_CHECK, async (event) => {
      await this.handleHealthCheck(event);
    });

    // 5. 메뉴 표시 요청 (네비게이션에서 발행)
    this.eventBus.subscribe(EVENTS.NAVIGATION.MENU_SHOW, async (event) => {
      if (event.payload.module === "system") {
        await this.handleMenuRequest(event);
      }
    });
  }

  /**
   * 🎯 ModuleManager 호환 이벤트 핸들러
   */
  async handleEvent(eventName, event) {
    switch (eventName) {
      case EVENTS.USER.COMMAND:
        await this.handleUserCommand(event);
        break;
      case EVENTS.USER.CALLBACK:
        await this.handleUserCallback(event);
        break;
      case EVENTS.SYSTEM.STARTUP:
        await this.handleSystemStartup(event);
        break;
      case EVENTS.SYSTEM.HEALTH_CHECK:
        await this.handleHealthCheck(event);
        break;
      default:
        logger.debug(`🚇 SystemModuleV2에서 처리하지 않는 이벤트: ${eventName}`);
        break;
    }
  }

  /**
   * 🎯 V2 모듈 초기화
   */
  async initialize() {
    try {
      // 이벤트 리스너 설정
      this.setupEventListeners();
      
      // 초기 시스템 스냅샷 수집
      const initialSnapshot = getCompleteSystemSnapshot();
      logger.info("🖥️ SystemModuleV2 초기화 - 시스템 스냅샷:", {
        platform: initialSnapshot.basic?.platform,
        memory: initialSnapshot.memory?.process?.heapUsed + "MB",
        health: initialSnapshot.health?.overall?.score
      });

      // 초기화 완료 표시
      this.isInitialized = true;
      
      logger.success("🚇 SystemModuleV2 초기화 완료 (EventBus 기반)");
      return true;
    } catch (error) {
      logger.error("❌ SystemModuleV2 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🧹 모듈 정리
   */
  async cleanup() {
    try {
      logger.info("🧹 SystemModuleV2 정리 시작...");
      
      // 필요시 이벤트 구독 해제나 정리 작업
      
      logger.success("✅ SystemModuleV2 정리 완료");
    } catch (error) {
      logger.error("❌ SystemModuleV2 정리 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 콜백 처리 (레거시 호환) - ModuleManager에서 호출
   */
  async handleCallback(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = callbackQuery.from.id;
    const chatId = callbackQuery.message.chat.id;
    
    // 레거시 콜백을 처리하는 맵 - SystemModuleV2는 이벤트 기반이므로 최소한만 지원
    const actionMap = {
      'menu': () => this.showMainMenu(userId, chatId),
      'help': () => this.showHelp(userId, chatId),
      'status': () => this.showSystemStatus(userId, chatId),
      'health': () => this.showSystemHealth(userId, chatId)
    };
    
    const handler = actionMap[subAction];
    if (handler) {
      // SystemModuleV2는 이벤트 발행 방식이므로 결과를 반환하지 않음
      await handler();
      return {
        type: subAction,
        module: 'system',
        success: true
      };
    }
    
    logger.debug(`SystemModuleV2: 알 수 없는 액션 - ${subAction}`);
    return null;
  }

  /**
   * 🎯 사용자 명령어 처리
   */
  async handleUserCommand(event) {
    const { command, userId, chatId } = event.payload;

    // 시스템 관련 명령어만 처리
    switch (command) {
      case "start":
      case "menu":
        await this.showMainMenu(userId, chatId);
        break;

      case "help":
        await this.showHelp(userId, chatId);
        break;

      case "status":
        await this.showSystemStatus(userId, chatId);
        break;

      case "ping":
        await this.handlePing(userId, chatId);
        break;

      case "health":
        await this.showSystemHealth(userId, chatId);
        break;

      default:
        // 다른 모듈이 처리하도록 무시
        break;
    }
  }

  /**
   * 🎯 콜백 처리 (시스템 모듈 관련만)
   */
  async handleUserCallback(event) {
    const { data, userId, chatId } = event.payload;

    // 콜백 데이터 파싱: module:action:params
    const [module, action] = data.split(":");

    if (module !== "system") {
      return; // 다른 모듈 콜백은 무시
    }

    // 통계 업데이트
    this.updateStats(userId, "callback");

    switch (action) {
      case "menu":
        await this.showMainMenu(userId, chatId);
        break;

      case "help":
        await this.showHelp(userId, chatId);
        break;

      case "status":
        await this.showSystemStatus(userId, chatId);
        break;

      case "health":
        await this.showSystemHealth(userId, chatId);
        break;

      case "modules":
        await this.showModuleStatus(userId, chatId);
        break;

      default:
        logger.warn(`🚇 알 수 없는 시스템 액션: ${action}`);
        break;
    }
  }

  /**
   * 🏠 메인 메뉴 표시 (이벤트 기반으로 변경!)
   */
  async showMainMenu(userId, chatId) {
    try {
      // 🔧 SystemHelper로 완전한 시스템 정보 수집
      const systemSnapshot = getCompleteSystemSnapshot();

      // 📊 모듈 상태 요청 이벤트 발행
      await this.eventBus.publish(EVENTS.SYSTEM.HEALTH_CHECK, {
        userId,
        requestId: `menu_${Date.now()}`
      });

      // 사용자 이름 가져오기 (이벤트로 처리하거나 캐시 사용)
      // const userName = `사용자${userId}`; // 임시, 나중에 이벤트로 개선

      // 통계 업데이트
      this.updateStats(userId, "menu");

      // 🎨 렌더링 요청 이벤트 발행
      await this.eventBus.publish(EVENTS.RENDER.MENU_REQUEST, {
        chatId,
        menuType: "main",
        data: {
          userName: `사용자${userId}`,
          systemStats: this.getBasicStats(),
          systemHealth: {
            score: systemSnapshot.health?.overall?.score || 0,
            status: systemSnapshot.health?.overall?.status || "알 수 없음"
          },
          moduleCount: 5, // 임시, 나중에 동적으로
          version: this.config.botVersion
        }
      });

      logger.debug(`🏠 메인 메뉴 표시 완료 - 사용자: ${userId}`);
    } catch (error) {
      logger.error("SystemModuleV2.showMainMenu 오류:", error);

      // 에러 렌더링 요청
      await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
        chatId,
        error: "메뉴를 불러오는 중 오류가 발생했습니다."
      });
    }
  }

  /**
   * ❓ 도움말 표시 (이벤트 기반)
   */
  async showHelp(userId, chatId) {
    try {
      // const userName = `사용자${userId}`;

      // 🎨 도움말 렌더링 요청
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: this.generateHelpText(),
        options: {
          reply_markup: this.createHelpKeyboard(),
          parse_mode: "Markdown"
        }
      });

      logger.debug(`❓ 도움말 표시 완료 - 사용자: ${userId}`);
    } catch (error) {
      logger.error("SystemModuleV2.showHelp 오류:", error);

      await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
        chatId,
        error: "도움말을 불러오는 중 오류가 발생했습니다."
      });
    }
  }

  /**
   * 📊 시스템 상태 표시 (이벤트 기반)
   */
  async showSystemStatus(userId, chatId) {
    try {
      // 🔧 완전한 시스템 스냅샷 수집
      const systemSnapshot = getCompleteSystemSnapshot();

      // 🎨 상태 렌더링 요청
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: this.formatSystemStatusText(systemSnapshot),
        options: {
          reply_markup: this.createStatusKeyboard(),
          parse_mode: "Markdown"
        }
      });

      logger.debug(`📊 시스템 상태 표시 완료 - 사용자: ${userId}`);
    } catch (error) {
      logger.error("SystemModuleV2.showSystemStatus 오류:", error);

      await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
        chatId,
        error: "시스템 상태를 불러오는 중 오류가 발생했습니다."
      });
    }
  }

  /**
   * 🏓 핑 처리 (이벤트 기반)
   */
  async handlePing(userId, chatId) {
    try {
      const startTime = Date.now();
      const responseTime = Date.now() - startTime;

      // 통계 업데이트
      this.updateStats(userId, "ping");

      // 🎨 핑 응답 렌더링
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: `🏓 *Pong!*\n\n⚡ 응답 시간: ${responseTime}ms\n🕐 현재 시간: ${new Date().toLocaleString("ko-KR")}\n⏱️ 업타임: ${this.getUptime()}`,
        options: {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }]
            ]
          }
        }
      });

      logger.debug(
        `🏓 핑 처리 완료 - 사용자: ${userId}, 응답시간: ${responseTime}ms`
      );
    } catch (error) {
      logger.error("SystemModuleV2.handlePing 오류:", error);
    }
  }

  /**
   * 🔍 시스템 건강도 표시 (이벤트 기반)
   */
  async showSystemHealth(userId, chatId) {
    try {
      // 🔧 완전한 건강도 체크
      const healthData = await this.performCompleteHealthCheck();

      // 🎨 건강도 렌더링 요청
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: this.formatHealthText(healthData),
        options: {
          reply_markup: this.createHealthKeyboard(),
          parse_mode: "Markdown"
        }
      });

      logger.debug(`🔍 시스템 건강도 표시 완료 - 사용자: ${userId}`);
    } catch (error) {
      logger.error("SystemModuleV2.showSystemHealth 오류:", error);

      await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
        chatId,
        error: "시스템 건강도를 확인하는 중 오류가 발생했습니다."
      });
    }
  }

  /**
   * 🎯 시스템 시작 이벤트 처리
   */
  async handleSystemStartup(event) {
    try {
      // 🛑 중복 처리 방지 - 이미 처리된 이벤트는 무시
      if (this.isStartupHandled) {
        logger.debug("🔄 시스템 시작 이벤트 중복 처리 방지 - 무시");
        return;
      }
      
      this.isStartupHandled = true;
      logger.info("🚀 시스템 시작 이벤트 수신");

      // 초기 시스템 스냅샷 수집
      const initialSnapshot = getCompleteSystemSnapshot();

      logger.info("🖥️ SystemModuleV2 초기화 - 시스템 스냅샷:", {
        platform: initialSnapshot.basic?.platform,
        memory: initialSnapshot.memory?.process?.heapUsed + "MB",
        health: initialSnapshot.health?.overall?.score
      });

      // ✅ 시스템 준비 완료 이벤트 발행 (한 번만)
      await this.eventBus.publish(EVENTS.SYSTEM.READY, {
        module: "system",
        timestamp: new Date().toISOString(),
        health: initialSnapshot.health?.overall
      });
    } catch (error) {
      logger.error("SystemModuleV2.handleSystemStartup 오류:", error);

      // 시스템 에러 이벤트 발행
      await this.eventBus.publish(EVENTS.SYSTEM.ERROR, {
        module: "system",
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 🔍 건강도 체크 이벤트 처리
   */
  async handleHealthCheck(event) {
    try {
      const { requestId } = event.payload;

      // 완전한 건강도 체크 수행
      const healthData = await this.performCompleteHealthCheck();

      logger.debug(
        `🔍 건강도 체크 완료 - 요청 ID: ${requestId}, 점수: ${healthData.overall.score}`
      );

      // 결과는 필요에 따라 다른 이벤트로 발행하거나 내부적으로 사용
    } catch (error) {
      logger.error("SystemModuleV2.handleHealthCheck 오류:", error);
    }
  }

  // --- 유틸리티 메서드들 (기존과 유사하지만 이벤트 기반으로 개선) ---

  /**
   * 📊 기본 통계 정보
   */
  getBasicStats() {
    return {
      uptime: this.getUptime(),
      totalCallbacks: this.systemStats.totalCallbacks,
      totalMessages: this.systemStats.totalMessages,
      uniqueUsers: this.systemStats.uniqueUsers.size,
      startTime: new Date(this.systemStats.startTime).toLocaleString("ko-KR")
    };
  }

  /**
   * ⏱️ 업타임 계산
   */
  getUptime() {
    const uptimeMs = Date.now() - this.systemStats.startTime;
    const hours = Math.floor(uptimeMs / 3600000);
    const minutes = Math.floor((uptimeMs % 3600000) / 60000);
    const seconds = Math.floor((uptimeMs % 60000) / 1000);
    return `${hours}시간 ${minutes}분 ${seconds}초`;
  }

  /**
   * 📈 통계 업데이트
   */
  updateStats(userId, action) {
    if (action === "callback") {
      this.systemStats.totalCallbacks++;
    } else if (action === "message") {
      this.systemStats.totalMessages++;
    }

    this.systemStats.uniqueUsers.add(userId);
  }

  /**
   * 🔍 완전한 건강도 체크
   */
  async performCompleteHealthCheck() {
    const systemSnapshot = getCompleteSystemSnapshot();

    return {
      overall: {
        score: systemSnapshot.health?.overall?.score || 0,
        status: systemSnapshot.health?.overall?.status || "알 수 없음",
        timestamp: new Date().toISOString()
      },
      components: {
        memory: systemSnapshot.memory?.health || {
          score: 0,
          status: "알 수 없음"
        },
        cpu: systemSnapshot.cpu?.health || { score: 0, status: "알 수 없음" },
        disk: systemSnapshot.disk?.health || { score: 0, status: "알 수 없음" },
        eventBus: this.getEventBusHealth()
      },
      recommendations: systemSnapshot.health?.recommendations || []
    };
  }

  /**
   * 🚇 EventBus 건강도 체크
   */
  getEventBusHealth() {
    const stats = this.eventBus.getStats();
    const errorRate = parseFloat(stats.errorRate.replace("%", ""));

    let score = 100;
    let status = "정상";

    if (errorRate > 20) {
      score = 20;
      status = "위험";
    } else if (errorRate > 10) {
      score = 60;
      status = "주의";
    } else if (errorRate > 5) {
      score = 80;
      status = "양호";
    }

    return {
      score,
      status,
      details: {
        totalEvents: stats.totalEvents,
        errorRate: stats.errorRate,
        uptime: stats.uptime,
        listenerCount: stats.listenerCount
      }
    };
  }

  // --- 텍스트 생성 메서드들 ---

  generateHelpText() {
    return (
      `🤖 *DoomockBot 도움말*\n\n` +
      `📋 *주요 명령어:*\n` +
      `• /start - 메인 메뉴\n` +
      `• /help - 도움말\n` +
      `• /status - 시스템 상태\n` +
      `• /ping - 연결 테스트\n\n` +
      `🎯 *주요 기능:*\n` +
      `• 📝 할일 관리\n` +
      `• ⏰ 포모도로 타이머\n` +
      `• 🏢 근무시간 추적\n\n` +
      `💡 *버전:* ${this.config.botVersion}\n` +
      `🚇 *EventBus 기반 아키텍처*`
    );
  }

  formatSystemStatusText(snapshot) {
    const memoryMB = Math.round(
      (snapshot.memory?.process?.heapUsed || 0) / 1024 / 1024
    );
    const memoryPercent = snapshot.memory?.process?.percentage || 0;

    return (
      `📊 *시스템 상태*\n\n` +
      `⏱️ *업타임:* ${this.getUptime()}\n` +
      `🧠 *메모리:* ${memoryMB}MB (${memoryPercent.toFixed(1)}%)\n` +
      `💓 *건강도:* ${snapshot.health?.overall?.score || 0}/100\n` +
      `📈 *총 요청:* ${this.systemStats.totalCallbacks}\n` +
      `👥 *사용자:* ${this.systemStats.uniqueUsers.size}명\n\n` +
      `🚇 *EventBus:* ${this.eventBus.getStats().totalEvents}개 이벤트`
    );
  }

  formatHealthText(healthData) {
    return (
      `🔍 *시스템 건강도 상세*\n\n` +
      `💓 *전체 점수:* ${healthData.overall.score}/100 (${healthData.overall.status})\n\n` +
      `📊 *구성 요소:*\n` +
      `• 🧠 메모리: ${healthData.components.memory.score}/100\n` +
      `• ⚡ CPU: ${healthData.components.cpu.score}/100\n` +
      `• 💽 디스크: ${healthData.components.disk.score}/100\n` +
      `• 🚇 EventBus: ${healthData.components.eventBus.score}/100\n\n` +
      `📝 *추천사항:* ${healthData.recommendations.length}개`
    );
  }

  // --- 키보드 생성 메서드들 ---

  createHelpKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "📊 시스템 상태", callback_data: "system:status" },
          { text: "🔍 건강도", callback_data: "system:health" }
        ],
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }]
      ]
    };
  }

  createStatusKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "🔄 새로고침", callback_data: "system:status" },
          { text: "🔍 건강도", callback_data: "system:health" }
        ],
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }]
      ]
    };
  }

  createHealthKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "🔄 재검사", callback_data: "system:health" },
          { text: "📊 상태", callback_data: "system:status" }
        ],
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }]
      ]
    };
  }
}

module.exports = SystemModuleV2;
