// src/handlers/CommandHandler.js - ⌨️ 명령어 핸들러 (순수 라우팅 전용)
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName, getUserId } = require("../utils/UserHelper");

/**
 * ⌨️ CommandHandler - 순수 명령어 라우팅 전용 핸들러
 *
 * ✅ SoC 준수: 순수 라우팅 로직만 담당
 * ✅ 표준 매개변수: (bot, msg, command, args, parseInfo)
 * ✅ NavigationHandler와 ModuleManager로 완전 위임
 *
 * 🎯 단 하나의 책임: "명령어 라우팅"
 * - 명령어 분류 및 검증
 * - 적절한 핸들러로 라우팅만!
 * - 사용자 상태 관리 (순수 데이터)
 * - 성능 통계 수집
 *
 * ❌ 절대 하지 않는 일:
 * - 메시지 생성/전송
 * - UI 렌더링
 * - 키보드 생성
 * - 텍스트 포맷팅
 */
class CommandHandler {
  constructor(options = {}) {
    this.moduleManager = options.moduleManager;
    this.navigationHandler = options.navigationHandler;

    // 📊 명령어 처리 통계
    this.stats = {
      commandsProcessed: 0,
      validCommands: 0,
      invalidCommands: 0,
      systemCommands: 0,
      moduleCommands: 0,
      unknownCommands: 0,
      responseTimeMs: [],
      errorCount: 0,
      startTime: Date.now(),
    };

    // 👤 사용자 상태 관리 (순수 데이터)
    this.userStates = new Map();

    // ⚙️ 설정
    this.config = {
      maxUserStates: parseInt(process.env.COMMAND_MAX_USER_STATES) || 1000,
      stateTimeoutMs: parseInt(process.env.COMMAND_STATE_TIMEOUT) || 1800000, // 30분
      enableDetailedLogging: process.env.COMMAND_DETAILED_LOGGING === "true",
      enablePerformanceTracking:
        process.env.COMMAND_PERFORMANCE_TRACKING !== "false",
    };

    // 🧹 주기적 정리 (10분마다)
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredStates();
    }, 10 * 60 * 1000);

    logger.info("⌨️ CommandHandler 초기화 완료 - 순수 라우팅 전용");
  }

  /**
   * 🎯 핵심 메서드: 명령어 라우팅 (표준 매개변수)
   */
  async handleCommand(bot, msg, command, args = [], parseInfo = null) {
    const timer = this.createPerformanceTimer();
    const userId = getUserId(msg.from);
    const userName = getUserName(msg.from);

    try {
      // 통계 업데이트
      this.stats.commandsProcessed++;

      if (this.config.enableDetailedLogging) {
        logger.debug(`⌨️ 명령어 라우팅: /${command} ${args.join(" ")}`, {
          userId,
          userName,
          parseInfo,
        });
      }

      // 명령어 분류
      const commandType = this.classifyCommand(command, parseInfo);

      // 라우팅 실행
      let handled = false;

      switch (commandType) {
        case "system":
          handled = await this.routeSystemCommand(
            bot,
            msg,
            command,
            args,
            parseInfo
          );
          this.stats.systemCommands++;
          break;

        case "module":
          handled = await this.routeModuleCommand(
            bot,
            msg,
            command,
            args,
            parseInfo
          );
          this.stats.moduleCommands++;
          break;

        default:
          handled = await this.routeUnknownCommand(
            bot,
            msg,
            command,
            args,
            parseInfo
          );
          this.stats.unknownCommands++;
      }

      // 결과 처리
      if (handled) {
        this.stats.validCommands++;
      } else {
        this.stats.invalidCommands++;
      }

      return handled;
    } catch (error) {
      this.stats.errorCount++;
      logger.error(`❌ 명령어 라우팅 실패: /${command}`, {
        userId,
        userName,
        error: error.message,
      });
      return false;
    } finally {
      // 성능 측정
      const responseTime = timer.end();
      if (this.config.enablePerformanceTracking) {
        this.updateResponseTimeStats(responseTime);
      }
    }
  }

  /**
   * 🔍 명령어 분류 (순수 로직)
   */
  classifyCommand(command, parseInfo = null) {
    // parseInfo가 있으면 우선 사용
    if (parseInfo?.commandType) {
      return parseInfo.commandType;
    }

    // 시스템 명령어 체크
    const systemCommands = [
      "start",
      "help",
      "status",
      "cancel",
      "menu",
      "about",
      "settings",
      "ping",
      "version",
    ];

    if (systemCommands.includes(command)) {
      return "system";
    }

    // 기본적으로 모듈 명령어로 분류
    return "module";
  }

  /**
   * 🏛️ 시스템 명령어 라우팅 (NavigationHandler로 완전 위임)
   */
  async routeSystemCommand(bot, msg, command, args, parseInfo) {
    const userId = getUserId(msg.from);
    const chatId = msg.chat.id;
    const userName = getUserName(msg.from);

    logger.debug(`🏛️ 시스템 명령어 라우팅: /${command}`);

    try {
      // 🧹 사용자 상태 관리 (순수 데이터만)
      if (command === "start" || command === "cancel") {
        this.clearUserState(userId);
      }

      // ✅ NavigationHandler로 완전 위임
      if (!this.navigationHandler) {
        logger.warn(
          "⚠️ NavigationHandler가 설정되지 않음 - 시스템 명령어 처리 불가"
        );
        return false;
      }

      // 표준 라우팅 정보 구성
      const routingInfo = {
        type: "system_command",
        command,
        args,
        parseInfo,
        msg,
        userId,
        chatId,
        userName,
      };

      // NavigationHandler에 라우팅 위임
      const result = await this.navigationHandler.handleSystemCommand(
        bot,
        routingInfo
      );

      return result !== false;
    } catch (error) {
      logger.error(`❌ 시스템 명령어 라우팅 실패 (${command}):`, error);
      return false;
    }
  }

  /**
   * 📱 모듈 명령어 라우팅 (ModuleManager로 완전 위임)
   */
  async routeModuleCommand(bot, msg, command, args, parseInfo) {
    const userId = getUserId(msg.from);
    const userName = getUserName(msg.from);

    logger.debug(`📱 모듈 명령어 라우팅: /${command}`);

    try {
      if (!this.moduleManager) {
        logger.warn("⚠️ ModuleManager가 설정되지 않음");
        return false;
      }

      // 🔍 모듈 인스턴스 찾기
      let moduleInstance = this.findModuleForCommand(command);

      if (!moduleInstance) {
        logger.debug(`📱 모듈 인스턴스를 찾을 수 없음: ${command}`);
        return false;
      }

      // 📞 모듈의 메시지 핸들러 호출 (표준 패턴)
      if (typeof moduleInstance.onHandleMessage === "function") {
        // 명령어 정보를 메시지에 포함하여 전달
        const enhancedMsg = {
          ...msg,
          commandInfo: {
            command,
            args,
            parseInfo,
            isCommand: true,
          },
        };

        const result = await moduleInstance.onHandleMessage(bot, enhancedMsg);
        return result !== false;
      }

      // 레거시 핸들러 지원
      if (typeof moduleInstance.handleMessage === "function") {
        const result = await moduleInstance.handleMessage(bot, msg);
        return result !== false;
      }

      // 전용 명령어 핸들러 지원
      if (typeof moduleInstance.handleCommand === "function") {
        const result = await moduleInstance.handleCommand(
          bot,
          msg,
          command,
          args
        );
        return result !== false;
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
  async routeUnknownCommand(bot, msg, command, args, parseInfo) {
    logger.debug(`❓ 알 수 없는 명령어: /${command}`);

    try {
      if (!this.navigationHandler) {
        return false;
      }

      // NavigationHandler에 알 수 없는 명령어 처리 위임
      const routingInfo = {
        type: "unknown_command",
        command,
        args,
        parseInfo,
        msg,
        userId: getUserId(msg.from),
        chatId: msg.chat.id,
        userName: getUserName(msg.from),
      };

      const result = await this.navigationHandler.handleUnknownCommand(
        bot,
        routingInfo
      );

      return result !== false;
    } catch (error) {
      logger.error(`❌ 알 수 없는 명령어 라우팅 실패 (${command}):`, error);
      return false;
    }
  }

  // ===== 🛠️ 헬퍼 메서드들 (순수 로직) =====

  /**
   * 🔍 명령어에 대한 모듈 찾기
   */
  findModuleForCommand(command) {
    if (!this.moduleManager) return null;

    // 1. 직접 모듈명으로 시도
    let moduleInstance = this.moduleManager.getModule(command);
    if (moduleInstance) return moduleInstance;

    // 2. 명령어 별칭 매핑 확인 (추후 구현 가능)
    const commandAliases = {
      todo: "todo",
      task: "todo",
      tasks: "todo",
      timer: "timer",
      time: "timer",
      weather: "weather",
      fortune: "fortune",
      leave: "leave",
      worktime: "worktime",
      work: "worktime",
      tts: "tts",
      voice: "tts",
    };

    const mappedModule = commandAliases[command];
    if (mappedModule) {
      moduleInstance = this.moduleManager.getModule(mappedModule);
      if (moduleInstance) return moduleInstance;
    }

    // 3. 한글 명령어 매핑 확인
    const koreanAliases = {
      할일: "todo",
      타이머: "timer",
      날씨: "weather",
      운세: "fortune",
      연차: "leave",
      휴가: "leave",
      근무: "worktime",
      음성: "tts",
    };

    const koreanMapped = koreanAliases[command];
    if (koreanMapped) {
      moduleInstance = this.moduleManager.getModule(koreanMapped);
      if (moduleInstance) return moduleInstance;
    }

    return null;
  }

  /**
   * 🏷️ 사용자 상태 설정 (순수 데이터)
   */
  setUserState(userId, state) {
    // 상태 개수 제한 확인
    if (this.userStates.size >= this.config.maxUserStates) {
      this.cleanupExpiredStates();

      // 여전히 초과하면 가장 오래된 것 제거
      if (this.userStates.size >= this.config.maxUserStates) {
        const oldestKey = this.userStates.keys().next().value;
        this.userStates.delete(oldestKey);
      }
    }

    this.userStates.set(userId.toString(), {
      ...state,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
    });

    logger.debug(`사용자 상태 설정: ${userId}`, state);
  }

  /**
   * 🔍 사용자 상태 조회
   */
  getUserState(userId) {
    const state = this.userStates.get(userId.toString());

    if (!state) return null;

    // 만료 확인
    if (Date.now() - state.timestamp > this.config.stateTimeoutMs) {
      this.clearUserState(userId);
      return null;
    }

    // 최근 접근 시간 업데이트
    state.lastAccessed = Date.now();
    return state;
  }

  /**
   * 🧹 사용자 상태 초기화
   */
  clearUserState(userId) {
    const deleted = this.userStates.delete(userId.toString());
    if (deleted && this.config.enableDetailedLogging) {
      logger.debug(`사용자 상태 초기화: ${userId}`);
    }
    return deleted;
  }

  /**
   * 🧹 만료된 상태 정리
   */
  cleanupExpiredStates() {
    const now = Date.now();
    const expiredUsers = [];

    for (const [userId, state] of this.userStates.entries()) {
      if (now - state.timestamp > this.config.stateTimeoutMs) {
        expiredUsers.push(userId);
      }
    }

    expiredUsers.forEach((userId) => {
      this.userStates.delete(userId);
    });

    if (expiredUsers.length > 0) {
      logger.debug(`만료된 사용자 상태 ${expiredUsers.length}개 정리됨`);
    }
  }

  /**
   * ⏱️ 성능 타이머 생성
   */
  createPerformanceTimer() {
    const startTime = Date.now();

    return {
      end: () => {
        return Date.now() - startTime;
      },
    };
  }

  /**
   * 📊 응답 시간 통계 업데이트
   */
  updateResponseTimeStats(responseTime) {
    this.stats.responseTimeMs.push(responseTime);

    // 최근 1000개만 유지 (메모리 관리)
    if (this.stats.responseTimeMs.length > 1000) {
      this.stats.responseTimeMs = this.stats.responseTimeMs.slice(-1000);
    }
  }

  /**
   * 📊 상세 통계 조회
   */
  getDetailedStats() {
    const uptime = Date.now() - this.stats.startTime;
    const avgResponseTime =
      this.stats.responseTimeMs.length > 0
        ? this.stats.responseTimeMs.reduce((a, b) => a + b, 0) /
          this.stats.responseTimeMs.length
        : 0;

    return {
      commands: {
        total: this.stats.commandsProcessed,
        valid: this.stats.validCommands,
        invalid: this.stats.invalidCommands,
        system: this.stats.systemCommands,
        module: this.stats.moduleCommands,
        unknown: this.stats.unknownCommands,
        successRate:
          this.stats.commandsProcessed > 0
            ? (
                (this.stats.validCommands / this.stats.commandsProcessed) *
                100
              ).toFixed(1)
            : 0,
        errors: this.stats.errorCount,
      },
      performance: {
        uptime: uptime,
        averageResponseTime: Math.round(avgResponseTime),
        totalResponseTimes: this.stats.responseTimeMs.length,
        memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
      userStates: {
        active: this.userStates.size,
        max: this.config.maxUserStates,
        timeoutMs: this.config.stateTimeoutMs,
      },
      config: this.config,
    };
  }

  /**
   * 🏥 시스템 헬스 체크
   */
  getSystemHealth() {
    const stats = this.getDetailedStats();
    const health = {
      status: "healthy",
      issues: [],
      score: 100,
    };

    // 성공률 체크
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
   * ⏱️ 가동 시간 포맷
   */
  formatUptime(uptimeMs) {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}일 ${hours % 24}시간`;
    } else if (hours > 0) {
      return `${hours}시간 ${minutes % 60}분`;
    } else if (minutes > 0) {
      return `${minutes}분 ${seconds % 60}초`;
    } else {
      return `${seconds}초`;
    }
  }

  /**
   * 📋 현재 상태 요약
   */
  getStatusSummary() {
    const stats = this.getDetailedStats();
    const health = this.getSystemHealth();

    return {
      version: "4.1",
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
        "명령어 분류 및 검증",
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

  /**
   * 🧹 정리 (종료 시 호출)
   */
  async cleanup() {
    try {
      logger.info("🧹 CommandHandler 정리 시작...");

      // 인터벌 정리
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }

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
}

module.exports = CommandHandler;
