// src/handlers/CommandHandler.js - 순수 명령어 처리 전용 v3.0.1
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");

/**
 * ⌨️ CommandHandler v3.0.1 - 순수 명령어 처리 전용
 *
 * 🎯 올바른 역할:
 * - 명령어 파싱 및 검증
 * - 적절한 핸들러로 라우팅
 * - 사용자 상태 관리
 * - 권한 검증
 *
 * ❌ 하면 안 되는 일:
 * - 인라인키보드 생성 (NavigationHandler 담당)
 * - 메시지 텍스트 구성 (NavigationHandler 담당)
 * - UI 렌더링 (NavigationHandler 담당)
 */
class CommandHandler {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.moduleManager = options.moduleManager;
    this.commandsRegistry = options.commandsRegistry;
    this.navigationHandler = options.navigationHandler; // ✅ NavigationHandler 참조

    // 📊 사용자 입력 상태 관리
    this.userStates = new Map();

    // 📊 통계
    this.stats = {
      commandsProcessed: 0,
      successfulCommands: 0,
      failedCommands: 0,
      unknownCommands: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
    };

    // ⏱️ 상태 정리 스케줄러
    this.startStateCleanupScheduler();

    logger.info("⌨️ CommandHandler v3.0.1 생성됨 (순수 명령어 처리)");
  }

  /**
   * 🎯 명령어 처리 (핵심 메서드)
   */
  async handleCommand(bot, msg, command, args = []) {
    const startTime = Date.now();
    const {
      chat: { id: chatId },
      from: { id: userId },
    } = msg;
    const userName = getUserName(msg);

    try {
      logger.info(
        `⌨️ 명령어 처리: /${command} ${args.join(" ")} (${userName})`
      );
      this.stats.commandsProcessed++;

      // 🏛️ 시스템 명령어 (직접 처리)
      const systemCommands = ["start", "help", "status", "cancel"];
      if (systemCommands.includes(command)) {
        return await this.handleSystemCommand(bot, msg, command, args);
      }

      // 📱 모듈 명령어 (ModuleManager로 위임)
      if (this.moduleManager) {
        const handled = await this.handleModuleCommand(bot, msg, command, args);
        if (handled) {
          this.stats.successfulCommands++;
          return true;
        }
      }

      // ❓ 알 수 없는 명령어
      await this.handleUnknownCommand(bot, msg, command, args);
      this.stats.unknownCommands++;
      return false;
    } catch (error) {
      logger.error("❌ 명령어 처리 오류:", error);
      this.stats.failedCommands++;

      await this.sendCommandError(
        bot,
        chatId,
        `/${command} 명령어 처리 중 오류가 발생했습니다.`
      );
      return false;
    } finally {
      // 응답 시간 통계 업데이트
      const responseTime = Date.now() - startTime;
      this.updateResponseTimeStats(responseTime);
    }
  }

  /**
   * 🏛️ 시스템 명령어 처리 (NavigationHandler로 위임)
   */
  async handleSystemCommand(bot, msg, command, args) {
    const {
      chat: { id: chatId },
    } = msg;

    logger.debug(`🏛️ 시스템 명령어: /${command}`);

    switch (command) {
      case "start":
        return await this.handleStartCommand(bot, msg, args);

      case "help":
        return await this.handleHelpCommand(bot, msg, args);

      case "status":
        return await this.handleStatusCommand(bot, msg, args);

      case "cancel":
        return await this.handleCancelCommand(bot, msg, args);

      default:
        logger.warn(`❓ 알 수 없는 시스템 명령어: /${command}`);
        return false;
    }
  }

  /**
   * 🚀 /start 명령어 처리 (NavigationHandler로 완전 위임)
   */
  async handleStartCommand(bot, msg, args) {
    const {
      chat: { id: chatId },
      from,
    } = msg;
    const userName = getUserName(msg);

    try {
      logger.info(`🚀 Start 명령어: ${userName}`);

      // 사용자 상태 초기화
      this.clearUserState(from.id);

      // ✅ NavigationHandler로 완전 위임 - 메인 메뉴 표시
      if (
        this.navigationHandler &&
        this.navigationHandler.showMainMenuFromCommand
      ) {
        await this.navigationHandler.showMainMenuFromCommand(
          bot,
          chatId,
          userName
        );
      } else {
        // 폴백 - 간단한 환영 메시지만 전송
        await bot.sendMessage(
          chatId,
          `👋 안녕하세요, ${userName}님!\n\n🤖 두목봇 v3.0.1에 오신 것을 환영합니다.`
        );
      }

      logger.info(`✅ Start 명령어 처리 완료: ${userName}`);
      return true;
    } catch (error) {
      logger.error("❌ Start 명령어 처리 오류:", error);
      await bot.sendMessage(
        chatId,
        "봇을 시작하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
      );
      return false;
    }
  }

  /**
   * ❓ /help 명령어 처리 (NavigationHandler로 위임)
   */
  async handleHelpCommand(bot, msg, args) {
    const {
      chat: { id: chatId },
    } = msg;

    try {
      logger.info("❓ Help 명령어 처리");

      // 특정 모듈 도움말
      if (args.length > 0) {
        const moduleName = args[0].toLowerCase();
        return await this.handleModuleHelp(bot, chatId, moduleName);
      }

      // ✅ NavigationHandler로 위임 - 전체 도움말 표시
      if (
        this.navigationHandler &&
        this.navigationHandler.showHelpFromCommand
      ) {
        await this.navigationHandler.showHelpFromCommand(bot, chatId);
      } else {
        // 폴백 - 기본 도움말 텍스트만 전송
        await bot.sendMessage(chatId, this.getBasicHelpText());
      }

      return true;
    } catch (error) {
      logger.error("❌ Help 명령어 처리 오류:", error);
      await bot.sendMessage(
        chatId,
        "도움말을 표시하는 중 오류가 발생했습니다."
      );
      return false;
    }
  }

  /**
   * 📊 /status 명령어 처리 (NavigationHandler로 위임)
   */
  async handleStatusCommand(bot, msg, args) {
    const {
      chat: { id: chatId },
    } = msg;

    try {
      logger.info("📊 Status 명령어 처리");

      // ✅ NavigationHandler로 위임 - 상태 정보 표시
      if (
        this.navigationHandler &&
        this.navigationHandler.showStatusFromCommand
      ) {
        await this.navigationHandler.showStatusFromCommand(bot, chatId);
      } else {
        // 폴백 - 기본 상태 정보만 전송
        await bot.sendMessage(chatId, this.getBasicStatusText());
      }

      return true;
    } catch (error) {
      logger.error("❌ Status 명령어 처리 오류:", error);
      await bot.sendMessage(chatId, "상태 확인 중 오류가 발생했습니다.");
      return false;
    }
  }

  /**
   * ❌ /cancel 명령어 처리 (순수 로직만)
   */
  async handleCancelCommand(bot, msg, args) {
    const {
      chat: { id: chatId },
      from: { id: userId },
    } = msg;
    const userName = getUserName(msg);

    try {
      logger.info(`❌ Cancel 명령어: ${userName}`);

      // 사용자 상태 확인
      const userState = this.getUserState(userId);

      if (!userState || !userState.action) {
        await bot.sendMessage(chatId, "취소할 작업이 없습니다.");
        return true;
      }

      // 상태 초기화
      const canceledAction = userState.action;
      this.clearUserState(userId);

      // ✅ 간단한 확인 메시지만 전송 (키보드는 NavigationHandler에서)
      await bot.sendMessage(
        chatId,
        `✅ "${canceledAction}" 작업이 취소되었습니다.`
      );

      return true;
    } catch (error) {
      logger.error("❌ Cancel 명령어 처리 오류:", error);
      await bot.sendMessage(chatId, "작업 취소 중 오류가 발생했습니다.");
      return false;
    }
  }

  /**
   * 📱 모듈 명령어 처리 (ModuleManager로 위임)
   */
  async handleModuleCommand(bot, msg, command, args) {
    try {
      // CommandsRegistry에서 명령어 정보 조회
      if (this.commandsRegistry && this.commandsRegistry.hasCommand(command)) {
        const commandInfo = this.commandsRegistry.getCommand(command);

        if (commandInfo.module) {
          // 해당 모듈로 명령어 위임
          const moduleInstance = this.moduleManager.getModule(
            commandInfo.module.toLowerCase()
          );

          if (moduleInstance && moduleInstance.handleCommand) {
            return await moduleInstance.handleCommand(bot, msg, command, args);
          }
        }
      }

      // 직접 모듈명으로 시도 (예: /todo, /timer 등)
      const moduleInstance = this.moduleManager.getModule(command);
      if (moduleInstance) {
        if (moduleInstance.onHandleMessage) {
          // 표준 메시지 핸들러로 처리
          return await moduleInstance.onHandleMessage(bot, msg);
        }

        if (moduleInstance.handleMessage) {
          // 레거시 메시지 핸들러로 처리
          return await moduleInstance.handleMessage(bot, msg);
        }

        if (moduleInstance.handleCommand) {
          // 전용 명령어 핸들러로 처리
          return await moduleInstance.handleCommand(bot, msg, command, args);
        }
      }

      return false;
    } catch (error) {
      logger.error(`❌ 모듈 명령어 처리 오류 (/${command}):`, error);
      return false;
    }
  }

  /**
   * 🔍 모듈 도움말 처리
   */
  async handleModuleHelp(bot, chatId, moduleName) {
    try {
      const moduleInstance = this.moduleManager.getModule(moduleName);

      if (moduleInstance && moduleInstance.sendHelp) {
        await moduleInstance.sendHelp(bot, chatId);
        return true;
      }

      // 모듈이 없는 경우
      await bot.sendMessage(
        chatId,
        `❓ "${moduleName}" 모듈을 찾을 수 없습니다.\n\n/help 명령어로 전체 도움말을 확인하세요.`
      );
      return false;
    } catch (error) {
      logger.error(`❌ 모듈 도움말 처리 오류 (${moduleName}):`, error);
      return false;
    }
  }

  /**
   * ❓ 알 수 없는 명령어 처리
   */
  async handleUnknownCommand(bot, msg, command, args) {
    const {
      chat: { id: chatId },
    } = msg;
    const userName = getUserName(msg);

    logger.warn(`❓ 알 수 없는 명령어: /${command} (${userName})`);

    // ✅ 간단한 오류 메시지만 전송 (키보드는 NavigationHandler에서)
    const errorText = `❓ 알 수 없는 명령어: /${command}

사용 가능한 명령어:
• /start - 봇 시작
• /help - 도움말 보기  
• /status - 상태 확인
• /cancel - 작업 취소

/help 명령어로 전체 목록을 확인하세요.`;

    await bot.sendMessage(chatId, errorText, {
      reply_to_message_id: msg.message_id,
    });
  }

  /**
   * ❌ 명령어 에러 전송 (단순화)
   */
  async sendCommandError(bot, chatId, message) {
    try {
      await bot.sendMessage(chatId, `❌ ${message}`);
    } catch (error) {
      logger.error("❌ 명령어 에러 메시지 전송 실패:", error);
    }
  }

  // ===== 🛡️ 폴백 텍스트들 (UI 없는 순수 텍스트만) =====

  /**
   * 📖 기본 도움말 텍스트 (폴백용)
   */
  getBasicHelpText() {
    return `📖 두목봇 도움말

기본 명령어:
• /start - 봇 시작
• /help - 도움말
• /status - 상태 확인
• /cancel - 작업 취소

모듈 명령어:
• /todo - 할일 관리
• /timer - 타이머
• /weather - 날씨 정보

더 자세한 정보는 /start 명령어로 메인 메뉴를 확인하세요.`;
  }

  /**
   * 📊 기본 상태 텍스트 (폴백용)
   */
  getBasicStatusText() {
    const uptime = this.formatUptime(process.uptime());
    const memoryMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

    return `📊 시스템 상태

기본 정보:
• 상태: 정상 동작 중
• 가동시간: ${uptime}
• 메모리: ${memoryMB}MB
• 환경: ${process.env.RAILWAY_ENVIRONMENT ? "Railway" : "Local"}

명령어 통계:
• 처리된 명령어: ${this.stats.commandsProcessed}개
• 성공: ${this.stats.successfulCommands}개
• 실패: ${this.stats.failedCommands}개

마지막 업데이트: ${TimeHelper.getLogTimeString()}`;
  }

  // ===== 📊 사용자 상태 관리 =====

  /**
   * 📝 사용자 상태 설정
   */
  setUserState(userId, state) {
    this.userStates.set(userId.toString(), {
      ...state,
      timestamp: Date.now(),
    });

    logger.debug(
      `📝 사용자 상태 설정: ${userId} -> ${state.action || "unknown"}`
    );
  }

  /**
   * 🔍 사용자 상태 조회
   */
  getUserState(userId) {
    return this.userStates.get(userId.toString()) || null;
  }

  /**
   * 🗑️ 사용자 상태 삭제
   */
  clearUserState(userId) {
    const existed = this.userStates.delete(userId.toString());
    if (existed) {
      logger.debug(`🗑️ 사용자 상태 삭제: ${userId}`);
    }
  }

  /**
   * 🗑️ 모든 사용자 상태 삭제
   */
  clearAllUserStates() {
    const count = this.userStates.size;
    this.userStates.clear();
    logger.info(`🗑️ 모든 사용자 상태 삭제: ${count}개`);
  }

  /**
   * 📊 활성 사용자 상태 수
   */
  getActiveUserStatesCount() {
    return this.userStates.size;
  }

  /**
   * 🧹 상태 정리 스케줄러
   */
  startStateCleanupScheduler() {
    setInterval(() => {
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
    }, 5 * 60 * 1000); // 5분마다 실행
  }

  // ===== 📊 통계 및 유틸리티 =====

  /**
   * 📊 응답 시간 통계 업데이트
   */
  updateResponseTimeStats(responseTime) {
    this.stats.totalResponseTime += responseTime;

    if (this.stats.averageResponseTime === 0) {
      this.stats.averageResponseTime = responseTime;
    } else {
      // 지수 이동 평균 (새로운 값에 10% 가중치)
      this.stats.averageResponseTime =
        this.stats.averageResponseTime * 0.9 + responseTime * 0.1;
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
      return `${days}일 ${hours}시간 ${minutes}분`;
    } else if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else {
      return `${minutes}분`;
    }
  }

  /**
   * 📊 상세 통계 조회
   */
  getDetailedStats() {
    return {
      ...this.stats,
      averageResponseTime: Math.round(this.stats.averageResponseTime),
      activeUserStates: this.userStates.size,
      successRate:
        this.stats.commandsProcessed > 0
          ? Math.round(
              (this.stats.successfulCommands / this.stats.commandsProcessed) *
                100
            )
          : 0,
      uptime: this.formatUptime(process.uptime()),
      memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    };
  }

  /**
   * 📊 기본 통계 조회
   */
  getStats() {
    return {
      commandsProcessed: this.stats.commandsProcessed,
      successfulCommands: this.stats.successfulCommands,
      failedCommands: this.stats.failedCommands,
      unknownCommands: this.stats.unknownCommands,
      averageResponseTime: Math.round(this.stats.averageResponseTime),
      activeUserStates: this.userStates.size,
    };
  }

  /**
   * 🔄 통계 초기화
   */
  resetStats() {
    this.stats = {
      commandsProcessed: 0,
      successfulCommands: 0,
      failedCommands: 0,
      unknownCommands: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
    };

    logger.info("🔄 CommandHandler 통계 초기화됨");
  }

  /**
   * 🧹 정리
   */
  async cleanup() {
    try {
      logger.info("🧹 CommandHandler 정리 시작...");

      // 사용자 상태 정리
      this.clearAllUserStates();

      // 통계 초기화
      this.resetStats();

      logger.info("✅ CommandHandler 정리 완료");
    } catch (error) {
      logger.error("❌ CommandHandler 정리 실패:", error);
    }
  }
}

module.exports = CommandHandler;
