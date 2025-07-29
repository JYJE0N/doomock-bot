// src/handlers/CommandHandler.js - ✨ 완전히 순수한 명령어 처리 전용 v4.0
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName, getUserId } = require("../utils/UserHelper");

/**
 * ⌨️ CommandHandler v4.0 - 완전히 순수한 명령어 처리 전용
 *
 * 🎯 단 하나의 책임: "명령어 라우팅"
 * - 명령어 파싱 및 검증
 * - 적절한 핸들러로 라우팅만!
 * - 사용자 상태 관리
 * - 통계 수집
 *
 * ❌ 절대 하지 않는 일:
 * - 메시지 생성 (NavigationHandler 담당)
 * - UI 렌더링 (NavigationHandler 담당)
 * - 키보드 생성 (NavigationHandler 담당)
 * - 텍스트 포맷팅 (NavigationHandler 담당)
 *
 * 🎪 비유: 교통 경찰 - 방향만 알려주고 끝!
 */
class CommandHandler {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.moduleManager = options.moduleManager;
    this.navigationHandler = options.navigationHandler;

    // 📊 통계
    this.stats = {
      commandsProcessed: 0,
      validCommands: 0,
      invalidCommands: 0,
      systemCommands: 0,
      moduleCommands: 0,
    };
  }

  /**
   * 🎯 핵심 메서드: 이미 파싱된 명령어만 처리 (권장!)
   *
   * BotController에서 파싱한 결과를 받아서 처리
   * 더 이상 파싱 로직을 포함하지 않음
   */
  async handleCommand(bot, msg, command, args = [], parseInfo = null) {
    const timer = this.createPerformanceTimer();

    try {
      logger.info(`⌨️ 명령어 라우팅: /${command} ${args.join(" ")}`);
      this.stats.commandsProcessed++;

      // 명령어 분류 및 라우팅
      const commandType =
        parseInfo?.commandType || this.classifyCommand(command);

      let handled = false;

      switch (commandType) {
        case "system":
          handled = await this.routeSystemCommand(bot, msg, command, args);
          this.stats.systemCommands++;
          break;

        case "module":
          handled = await this.routeModuleCommand(bot, msg, command, args);
          this.stats.moduleCommands++;
          break;

        default:
          handled = await this.routeUnknownCommand(bot, msg, command, args);
          this.stats.unknownCommands++;
      }

      return handled;
    } catch (error) {
      logger.error(`명령어 라우팅 실패: /${command}`, error);
      return false;
    } finally {
      const responseTime = timer.end();
      this.updateResponseTimeStats(responseTime);
    }
  }

  /**
   * 🔍 간단한 명령어 분류 (개선된 버전)
   */
  classifyCommand(command) {
    const systemCommands = ["start", "help", "status", "cancel", "menu"];

    if (systemCommands.includes(command)) {
      return "system";
    }

    return "module";
  }

  /**
   * 🔗 명령어 별칭 매핑
   */
  getCommandAliases() {
    return {
      // 한글 별칭
      할일: "todo",
      타이머: "timer",
      날씨: "weather",
      운세: "fortune",
      휴가: "leave",
      근무: "worktime",

      // 영문 별칭
      todos: "todo",
      task: "todo",
      tasks: "todo",
      time: "timer",
      remind: "reminder",
      tts: "voice",
    };
  }

  /**
   * 🎯 기존 핸들러 (이미 파싱된 명령어 처리)
   */
  async handleCommand(bot, msg, command, args = [], parseInfo = null) {
    const timer = this.createPerformanceTimer();

    try {
      logger.info(`⌨️ 명령어 라우팅: /${command} ${args.join(" ")}`);
      this.stats.commandsProcessed++;

      // 파싱 정보 활용
      const commandType =
        parseInfo?.commandType || this.classifyCommand(command);

      let handled = false;

      switch (commandType) {
        case "system":
          handled = await this.routeSystemCommand(bot, msg, command, args);
          this.stats.systemCommands++;
          break;

        case "module":
          handled = await this.routeModuleCommand(bot, msg, command, args);
          this.stats.moduleCommands++;
          break;

        default:
          handled = await this.routeUnknownCommand(bot, msg, command, args);
          this.stats.unknownCommands++;
      }

      return handled;
    } catch (error) {
      logger.error(`명령어 라우팅 실패: /${command}`, error);
      return false;
    } finally {
      const responseTime = timer.end();
      this.updateResponseTimeStats(responseTime);
    }
  }

  /**
   * 🔍 명령어 분류 (순수 로직)
   */
  classifyCommand(command) {
    const systemCommands = ["start", "help", "status", "cancel", "menu"];

    if (systemCommands.includes(command)) {
      return "system";
    }

    return "module";
  }

  /**
   * 🏛️ 시스템 명령어 라우팅 (NavigationHandler로 완전 위임)
   */
  async routeSystemCommand(bot, msg, command, args) {
    const userId = getUserId(msg.from);
    const chatId = msg.chat.id;
    const userName = getUserName(msg);

    logger.debug(`🏛️ 시스템 명령어 라우팅: /${command}`);

    try {
      // 🧹 사용자 상태 관리 (순수 데이터만)
      if (command === "start" || command === "cancel") {
        this.clearUserState(userId);
      }

      // ✅ NavigationHandler로 완전 위임 - UI는 전혀 건드리지 않음
      if (this.navigationHandler) {
        const routingResult = await this.navigationHandler.handleCommandRouting(
          bot,
          {
            type: "system",
            command,
            args,
            msg,
            userId,
            chatId,
            userName,
          }
        );

        return routingResult !== false;
      }

      // NavigationHandler가 없으면 실패
      logger.warn(
        "⚠️ NavigationHandler가 설정되지 않음 - 시스템 명령어 처리 불가"
      );
      return false;
    } catch (error) {
      logger.error(`❌ 시스템 명령어 라우팅 실패 (${command}):`, error);
      return false;
    }
  }

  /**
   * 📱 모듈 명령어 라우팅 (ModuleManager로 완전 위임)
   */
  async routeModuleCommand(bot, msg, command, args) {
    const userId = getUserId(msg.from);

    logger.debug(`📱 모듈 명령어 라우팅: /${command}`);

    try {
      if (!this.moduleManager) {
        logger.warn("⚠️ ModuleManager가 설정되지 않음");
        return false;
      }

      // 🔍 CommandsRegistry에서 명령어 정보 조회
      let moduleInstance = null;

      if (this.commandsRegistry?.hasCommand(command)) {
        const commandInfo = this.commandsRegistry.getCommand(command);
        if (commandInfo.module) {
          moduleInstance = this.moduleManager.getModule(
            commandInfo.module.toLowerCase()
          );
        }
      }

      // 직접 모듈명으로 시도
      if (!moduleInstance) {
        moduleInstance = this.moduleManager.getModule(command);
      }

      if (!moduleInstance) {
        logger.debug(`📱 모듈 인스턴스를 찾을 수 없음: ${command}`);
        return false;
      }

      // 📞 모듈의 메시지 핸들러 호출 (표준 패턴 우선)
      if (typeof moduleInstance.onHandleMessage === "function") {
        return await moduleInstance.onHandleMessage(bot, msg);
      }

      // 레거시 핸들러 지원
      if (typeof moduleInstance.handleMessage === "function") {
        return await moduleInstance.handleMessage(bot, msg);
      }

      // 전용 명령어 핸들러 지원
      if (typeof moduleInstance.handleCommand === "function") {
        return await moduleInstance.handleCommand(bot, msg, command, args);
      }

      logger.debug(`📱 모듈에 적절한 핸들러가 없음: ${command}`);
      return false;
    } catch (error) {
      logger.error(`❌ 모듈 명령어 라우팅 실패 (${command}):`, error);
      return false;
    }
  }

  /**
   * ❓ 알 수 없는 명령어 라우팅 (NavigationHandler로 위임)
   */
  async routeUnknownCommand(bot, msg, command, args) {
    const userId = getUserId(msg.from);
    const chatId = msg.chat.id;
    const userName = getUserName(msg);

    logger.debug(`❓ 알 수 없는 명령어 라우팅: /${command} (${userName})`);

    // ✅ NavigationHandler로 완전 위임
    if (this.navigationHandler) {
      return await this.navigationHandler.handleCommandRouting(bot, {
        type: "unknown",
        command,
        args,
        msg,
        userId,
        chatId,
        userName,
      });
    }

    // NavigationHandler가 없으면 기본 처리 (최소한만)
    logger.warn("⚠️ NavigationHandler가 설정되지 않음 - 기본 오류 처리");
    return false;
  }

  /**
   * 📢 NavigationHandler에게 알림 (UI 생성 요청)
   */
  async notifyNavigationHandler(eventType, data) {
    if (
      this.navigationHandler &&
      typeof this.navigationHandler.handleCommandEvent === "function"
    ) {
      try {
        await this.navigationHandler.handleCommandEvent(eventType, data);
      } catch (error) {
        logger.error("NavigationHandler 알림 실패:", error);
      }
    }
  }

  // ===== 📊 사용자 상태 관리 (순수 데이터만) =====

  /**
   * 📝 사용자 상태 설정
   */
  setUserState(userId, state) {
    const userKey = String(userId);
    const stateData = {
      ...state,
      timestamp: Date.now(),
      updatedAt: TimeHelper.now().toISOString(),
    };

    this.userStates.set(userKey, stateData);
    logger.debug(
      `📝 사용자 상태 설정: ${userId} -> ${state.action || "unknown"}`
    );

    return stateData;
  }

  /**
   * 🔍 사용자 상태 조회
   */
  getUserState(userId) {
    const userKey = String(userId);
    return this.userStates.get(userKey) || null;
  }

  /**
   * 🗑️ 사용자 상태 삭제
   */
  clearUserState(userId) {
    const userKey = String(userId);
    const existed = this.userStates.delete(userKey);

    if (existed) {
      logger.debug(`🗑️ 사용자 상태 삭제: ${userId}`);
    }

    return existed;
  }

  /**
   * 📊 활성 상태 수 조회
   */
  getActiveUserStatesCount() {
    return this.userStates.size;
  }

  /**
   * 🧹 만료된 상태 정리 (30분 타임아웃)
   */
  cleanupExpiredStates() {
    const now = Date.now();
    const timeout = 30 * 60 * 1000; // 30분
    let cleanedCount = 0;

    for (const [userId, state] of this.userStates.entries()) {
      if (now - state.timestamp > timeout) {
        this.userStates.delete(userId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`🧹 만료된 사용자 상태 정리: ${cleanedCount}개`);
    }

    return cleanedCount;
  }

  /**
   * 🧹 상태 정리 스케줄러 시작
   */
  startStateCleanupScheduler() {
    // 5분마다 만료된 상태 정리
    setInterval(() => {
      this.cleanupExpiredStates();
    }, 5 * 60 * 1000);

    logger.debug("🧹 상태 정리 스케줄러 시작됨 (5분 간격)");
  }

  // ===== 📊 성능 통계 관리 =====

  /**
   * ⏱️ 성능 측정 타이머 생성
   */
  createPerformanceTimer() {
    const start = process.hrtime.bigint();

    return {
      end: () => {
        const end = process.hrtime.bigint();
        const duration = Number(end - start) / 1_000_000; // nanoseconds to milliseconds
        return Math.round(duration * 100) / 100;
      },
    };
  }

  /**
   * 📊 응답 시간 통계 업데이트
   */
  updateResponseTimeStats(responseTime) {
    this.stats.totalResponseTime += responseTime;

    // 지수 이동 평균 계산 (새로운 값에 10% 가중치)
    if (this.stats.averageResponseTime === 0) {
      this.stats.averageResponseTime = responseTime;
    } else {
      this.stats.averageResponseTime =
        this.stats.averageResponseTime * 0.9 + responseTime * 0.1;
    }
  }

  /**
   * 📊 상세 통계 조회
   */
  getDetailedStats() {
    const uptime = Date.now() - this.stats.startTime;
    const memoryUsage = process.memoryUsage();

    return {
      // 명령어 통계
      commands: {
        total: this.stats.commandsProcessed,
        successful: this.stats.successfulCommands,
        failed: this.stats.failedCommands,
        unknown: this.stats.unknownCommands,
        system: this.stats.systemCommands,
        module: this.stats.moduleCommands,
        successRate:
          this.stats.commandsProcessed > 0
            ? Math.round(
                (this.stats.successfulCommands / this.stats.commandsProcessed) *
                  100
              )
            : 0,
      },

      // 성능 통계
      performance: {
        averageResponseTime:
          Math.round(this.stats.averageResponseTime * 100) / 100,
        totalResponseTime: Math.round(this.stats.totalResponseTime * 100) / 100,
        uptime: Math.round(uptime / 1000), // seconds
        memoryUsageMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      },

      // 사용자 상태
      userStates: {
        active: this.userStates.size,
        total: this.userStates.size,
      },

      // 메타 정보
      meta: {
        version: "4.0",
        startTime: new Date(this.stats.startTime).toISOString(),
        lastUpdate: TimeHelper.now().toISOString(),
      },
    };
  }

  /**
   * 📊 기본 통계 조회 (간단한 버전)
   */
  getStats() {
    return {
      commandsProcessed: this.stats.commandsProcessed,
      successfulCommands: this.stats.successfulCommands,
      failedCommands: this.stats.failedCommands,
      unknownCommands: this.stats.unknownCommands,
      averageResponseTime:
        Math.round(this.stats.averageResponseTime * 100) / 100,
      activeUserStates: this.userStates.size,
      successRate:
        this.stats.commandsProcessed > 0
          ? Math.round(
              (this.stats.successfulCommands / this.stats.commandsProcessed) *
                100
            )
          : 0,
    };
  }

  /**
   * 🔄 통계 초기화
   */
  resetStats() {
    const oldStats = { ...this.stats };

    this.stats = {
      commandsProcessed: 0,
      successfulCommands: 0,
      failedCommands: 0,
      unknownCommands: 0,
      systemCommands: 0,
      moduleCommands: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      startTime: Date.now(),
    };

    logger.info("🔄 CommandHandler 통계 초기화됨", {
      previous: oldStats,
      reset: this.stats,
    });

    return oldStats;
  }

  // ===== 🔧 유틸리티 메서드들 =====

  /**
   * ⏱️ 업타임 포맷팅
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}일 ${hours}시간 ${minutes}분`;
    } else if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else {
      return `${minutes}분`;
    }
  }

  /**
   * 🔍 시스템 상태 확인
   */
  getSystemHealth() {
    const stats = this.getDetailedStats();
    const health = {
      status: "healthy",
      issues: [],
      score: 100,
    };

    // 성공율 체크
    if (stats.commands.successRate < 90) {
      health.issues.push("명령어 성공률이 낮음");
      health.score -= 20;
    }

    // 응답 시간 체크
    if (stats.performance.averageResponseTime > 1000) {
      health.issues.push("평균 응답 시간이 느림");
      health.score -= 15;
    }

    // 메모리 사용량 체크
    if (stats.performance.memoryUsageMB > 500) {
      health.issues.push("메모리 사용량이 높음");
      health.score -= 10;
    }

    // 활성 상태 수 체크
    if (stats.userStates.active > 1000) {
      health.issues.push("너무 많은 활성 사용자 상태");
      health.score -= 5;
    }

    // 상태 결정
    if (health.score >= 90) {
      health.status = "healthy";
    } else if (health.score >= 70) {
      health.status = "warning";
    } else {
      health.status = "critical";
    }

    return health;
  }

  /**
   * 🧹 정리 (종료 시 호출)
   */
  async cleanup() {
    try {
      logger.info("🧹 CommandHandler 정리 시작...");

      // 사용자 상태 정리
      const stateCount = this.userStates.size;
      this.userStates.clear();

      // 최종 통계 로그
      const finalStats = this.getDetailedStats();
      logger.info("📊 CommandHandler 최종 통계:", finalStats);

      logger.info(`✅ CommandHandler 정리 완료 (상태 ${stateCount}개 정리됨)`);
    } catch (error) {
      logger.error("❌ CommandHandler 정리 실패:", error);
    }
  }

  /**
   * 📋 현재 상태 요약
   */
  getStatusSummary() {
    const stats = this.getDetailedStats();
    const health = this.getSystemHealth();

    return {
      version: "4.0",
      role: "순수 명령어 라우팅 전용",
      health: health.status,
      stats: {
        totalCommands: stats.commands.total,
        successRate: `${stats.commands.successRate}%`,
        avgResponseTime: `${stats.performance.averageResponseTime}ms`,
        activeStates: stats.userStates.active,
        uptime: this.formatUptime(stats.performance.uptime),
      },
      responsibilities: [
        "명령어 파싱 및 검증",
        "적절한 핸들러로 라우팅",
        "사용자 상태 관리",
        "성능 통계 수집",
      ],
      notResponsible: [
        "UI 생성 및 렌더링",
        "메시지 텍스트 구성",
        "키보드 생성",
        "직접적인 사용자 응답",
      ],
    };
  }
}

module.exports = CommandHandler;
