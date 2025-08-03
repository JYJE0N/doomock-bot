// src/handlers/CommandHandler.js - 🎯 개선된 명령어 핸들러

const logger = require("../utils/Logger");
const { getUserName, getUserId } = require("../utils/UserHelper");

/**
 * ⌨️ CommandHandler - 자연어 명령어 지원 및 불필요한 명령어 정리
 *
 * 🎯 새로운 기능:
 * - "두목", "두목님", "두목아", "두목씨" → 시작메뉴
 * - 불필요한 명령어 제거
 * - 자연어 명령어 우선 처리
 *
 * ✅ SoC 준수: 순수 라우팅 로직만 담당
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
      naturalCommands: 0, // 🆕 추가: 자연어 명령어 통계
      doomockCalls: 0, // 🆕 추가: 두목 호출 통계
      unknownCommands: 0,
      responseTimeMs: [],
      errorCount: 0,
      startTime: Date.now()
    };

    // 👤 사용자 상태 관리 (순수 데이터)
    this.userStates = new Map();

    // ⚙️ 설정
    this.config = {
      maxUserStates: parseInt(process.env.COMMAND_MAX_USER_STATES) || 1000,
      stateTimeoutMs: parseInt(process.env.COMMAND_STATE_TIMEOUT) || 1800000, // 30분
      enableDetailedLogging: process.env.COMMAND_DETAILED_LOGGING === "true",
      enablePerformanceTracking: process.env.COMMAND_PERFORMANCE_TRACKING !== "false",
      enableNaturalLanguage: true // 🆕 자연어 명령어 활성화
    };

    // 🎯 두목 호출 패턴 (다양한 바리에이션)
    this.doomockPatterns = [
      // 기본 호출
      "두목",
      "두목님",
      "두목아",
      "두목씨",

      // 존댓말/반말 혼합
      "두목이야",
      "두목이다",
      "두목인가",
      "두목이지",
      "두목님아",
      "두목님이야",
      "두목님이시죠",
      "두목님이신가요",

      // 부르는 말
      "여기",
      "이리와",
      "이리 와",
      "이리오세요",
      "두목 와",
      "두목님 와",
      "두목 와봐",
      "두목님 오세요",

      // 요청형
      "두목 좀",
      "두목님 좀",
      "두목아 좀",
      "두목씨 좀",
      "두목 부탁",
      "두목님 부탁",
      "두목 도와줘",
      "두목님 도와주세요",

      // 간단한 인사
      "안녕",
      "안녕하세요",
      "하이",
      "하이요",
      "헬로",
      "헬로우",
      "좋은 아침",
      "좋은 오후",
      "좋은 저녁",
      "안녕히 계세요",

      // 관심/호기심
      "뭐해",
      "뭐하세요",
      "뭐 하고 있어",
      "뭐 하고 계세요",
      "어떻게 지내",
      "어떻게 지내세요",
      "잘 지내",
      "잘 지내세요",

      // 시작/메뉴 관련
      "시작",
      "시작해",
      "시작하자",
      "시작해줘",
      "시작해주세요",
      "메뉴",
      "메뉴 보여줘",
      "메뉴 보여주세요",
      "메뉴판",

      // 도움 요청
      "도와줘",
      "도와주세요",
      "도움",
      "도움말",
      "헬프"
    ];

    // 🎯 모듈 자연어 별칭 (완전한 목록)
    this.naturalAliases = {
      // 할일 관리
      할일: "todo",
      투두: "todo",
      태스크: "todo",
      일정: "todo",
      할일목록: "todo",
      "할일 목록": "todo",
      업무: "todo",
      작업: "todo",

      // 타이머
      타이머: "timer",
      시간: "timer",
      알람: "timer",
      뽀모도로: "timer",
      시간측정: "timer",
      타임: "timer",
      타이머켜: "timer",

      // 날씨
      날씨: "weather",
      기상: "weather",
      온도: "weather",
      기온: "weather",
      날씨보기: "weather",
      날씨정보: "weather",
      오늘날씨: "weather",

      // 운세
      운세: "fortune",
      타로: "fortune",
      점: "fortune",
      포춘: "fortune",
      운세보기: "fortune",
      오늘운세: "fortune",
      타로카드: "fortune",

      // 휴가/연차
      휴가: "leave",
      연차: "leave",
      휴무: "leave",
      쉼: "leave",
      휴가신청: "leave",
      연차신청: "leave",
      휴가관리: "leave",
      연가: "leave",

      // 근무시간 (출근/퇴근 추가!)
      근무: "worktime",
      출퇴근: "worktime",
      근무시간: "worktime",
      출근: "worktime",
      퇴근: "worktime",
      근태: "worktime",
      출석: "worktime",
      출근기록: "worktime",
      퇴근기록: "worktime",
      근무관리: "worktime",

      // TTS (추가!)
      음성: "tts",
      변환: "tts",
      읽어줘: "tts",
      읽기: "tts",
      목소리: "tts",
      음성변환: "tts",
      텍스트읽기: "tts",
      말해줘: "tts",
      소리내줘: "tts",
      읽어주세요: "tts",
      음성으로: "tts"
    };

    // 🧹 주기적 정리 (10분마다)
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpiredStates();
      },
      10 * 60 * 1000
    );

    logger.info("⌨️ CommandHandler 초기화 완료 - 두목 자연어 명령어 지원");
    logger.info(`🎯 두목 호출 패턴: ${this.doomockPatterns.length}개 등록됨`);
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
          parseInfo
        });
      }

      // 명령어 분류
      const commandType = this.classifyCommand(command, parseInfo);

      // 라우팅 실행
      let handled = false;

      switch (commandType) {
        case "system":
          handled = await this.routeSystemCommand(bot, msg, command, args, parseInfo);
          this.stats.systemCommands++;
          break;

        case "module":
          handled = await this.routeModuleCommand(bot, msg, command, args, parseInfo);
          this.stats.moduleCommands++;
          break;

        default:
          handled = await this.routeUnknownCommand(bot, msg, command, args, parseInfo);
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
        error: error.message
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
   * 🗣️ 자연어 메시지 처리 (새로운 핵심 메서드!)
   * @param {Object} bot - 봇 인스턴스
   * @param {Object} msg - 메시지 객체
   * @returns {boolean} 처리 여부
   */
  async handleNaturalMessage(bot, msg) {
    const timer = this.createPerformanceTimer();
    const userId = getUserId(msg.from);
    const userName = getUserName(msg.from);
    const messageText = msg.text?.trim();

    if (!messageText) return false;

    try {
      this.stats.commandsProcessed++;

      // 🎯 1단계: 두목 호출 패턴 체크 (최우선!)
      if (this.isDoomockCall(messageText)) {
        logger.info(`🎯 두목 호출 감지: "${messageText}" by ${userName}`);
        this.stats.doomockCalls++;
        this.stats.naturalCommands++;

        // 시작메뉴 표시 (NavigationHandler로 위임)
        const handled = await this.routeToNavigationHandler(bot, msg, "showMainMenu");

        if (this.config.enableDetailedLogging) {
          logger.debug(`✅ 두목 호출 처리 완료: ${userName}`);
        }

        return handled;
      }

      // 🎯 2단계: 모듈 자연어 별칭 체크
      const moduleMatch = this.findModuleByNaturalAlias(messageText);
      if (moduleMatch) {
        logger.debug(`🎯 자연어 모듈 매칭: "${messageText}" → ${moduleMatch.module}`);
        this.stats.naturalCommands++;

        const handled = await this.routeToModule(bot, msg, moduleMatch.module, moduleMatch.args);
        return handled;
      }

      // 🎯 3단계: 기존 명령어 체계로 폴백
      return false;
    } catch (error) {
      this.stats.errorCount++;
      logger.error(`❌ 자연어 메시지 처리 실패: ${messageText}`, {
        userId,
        userName,
        error: error.message
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
   * 🔍 두목 호출 여부 판단
   */
  isDoomockCall(text) {
    if (!text || typeof text !== "string") return false;

    const normalizedText = text.toLowerCase().trim();

    // 정확한 매칭
    if (this.doomockPatterns.includes(normalizedText)) {
      return true;
    }

    // 부분 매칭 (두목으로 시작하는 경우)
    const doomockStarters = ["두목", "두목님", "두목아", "두목씨"];
    for (const starter of doomockStarters) {
      if (normalizedText.startsWith(starter)) {
        return true;
      }
    }

    // 두목이 포함된 짧은 문장 (10글자 이하)
    if (normalizedText.length <= 10 && normalizedText.includes("두목")) {
      return true;
    }

    return false;
  }

  /**
   * 🔍 자연어 별칭으로 모듈 찾기
   */
  findModuleByNaturalAlias(text) {
    if (!text || typeof text !== "string") return null;

    const normalizedText = text.toLowerCase().trim();

    // 정확한 매칭 우선
    for (const [alias, module] of Object.entries(this.naturalAliases)) {
      if (normalizedText === alias) {
        return { module, args: [], exactMatch: true };
      }
    }

    // 시작 매칭 (별칭으로 시작하는 경우)
    for (const [alias, module] of Object.entries(this.naturalAliases)) {
      if (normalizedText.startsWith(alias + " ")) {
        const args = normalizedText
          .substring(alias.length + 1)
          .split(" ")
          .filter((arg) => arg.length > 0);
        return { module, args, exactMatch: false };
      }
    }

    return null;
  }

  /**
   * 🎯 NavigationHandler로 라우팅 (순수 라우팅만!)
   */
  async routeToNavigationHandler(bot, msg, action = "showMainMenu") {
    try {
      if (!this.navigationHandler) {
        logger.warn("⚠️ NavigationHandler가 설정되지 않음");
        return false;
      }

      // NavigationHandler로 완전 위임
      const ctx = {
        message: msg,
        from: msg.from,
        chat: msg.chat,
        reply: (text, extra) => bot.telegram.sendMessage(msg.chat.id, text, extra),
        replyWithMarkdown: (text, extra) => bot.telegram.sendMessage(msg.chat.id, text, { parse_mode: "Markdown", ...extra })
      };

      // 액션에 따라 적절한 NavigationHandler 메서드 호출
      switch (action) {
        case "showMainMenu":
          await this.navigationHandler.showMainMenu(ctx);
          break;
        case "showHelp":
          // NavigationHandler에 showHelp가 있다면 호출, 없으면 기본 처리
          if (typeof this.navigationHandler.showHelp === "function") {
            await this.navigationHandler.showHelp(ctx);
          } else {
            await this.navigationHandler.showMainMenu(ctx); // 폴백
          }
          break;
        default:
          await this.navigationHandler.showMainMenu(ctx);
      }

      return true;
    } catch (error) {
      logger.error(`❌ NavigationHandler 라우팅 실패 (${action}):`, error);
      return false;
    }
  }

  /**
   * 📱 모듈로 라우팅
   */
  async routeToModule(bot, msg, moduleName, args = []) {
    try {
      if (!this.moduleManager) {
        logger.warn("⚠️ ModuleManager가 설정되지 않음");
        return false;
      }

      const moduleInstance = this.moduleManager.getModule(moduleName);
      if (!moduleInstance) {
        logger.debug(`📱 모듈 인스턴스를 찾을 수 없음: ${moduleName}`);
        return false;
      }

      // 📞 모듈의 메시지 핸들러 호출
      if (typeof moduleInstance.onHandleMessage === "function") {
        const enhancedMsg = {
          ...msg,
          commandInfo: {
            command: moduleName,
            args: args,
            originalText: msg.text,
            isNatural: true
          }
        };

        const result = await moduleInstance.onHandleMessage(bot, enhancedMsg);
        return result !== false;
      }

      return false;
    } catch (error) {
      logger.error(`❌ 모듈 라우팅 실패 (${moduleName}):`, error);
      return false;
    }
  }

  /**
   * 🔍 명령어 분류 (기존 로직 유지)
   */
  classifyCommand(command, parseInfo = null) {
    // parseInfo가 있으면 우선 사용
    if (parseInfo?.commandType) {
      return parseInfo.commandType;
    }

    // 🧹 정리된 시스템 명령어 (불필요한 것들 제거)
    const systemCommands = [
      "start",
      "help",
      "status",
      "cancel"
      // "menu", "about", "settings", "ping", "version" 제거
    ];

    if (systemCommands.includes(command)) {
      return "system";
    }

    // 기본적으로 모듈 명령어로 분류
    return "module";
  }

  /**
   * 🏛️ 시스템 명령어 라우팅 (간소화)
   */
  async routeSystemCommand(bot, msg, command, args, parseInfo) {
    const userId = getUserId(msg.from);
    const userName = getUserName(msg.from);

    logger.debug(`🏛️ 시스템 명령어 라우팅: /${command}`);

    try {
      // 🧹 사용자 상태 관리 (순수 데이터만)
      if (command === "start" || command === "cancel") {
        this.clearUserState(userId);
      }

      // ✅ 간소화된 시스템 명령어 처리 (라우팅만!)
      switch (command) {
        case "start": {
          return await this.routeToNavigationHandler(bot, msg, "showMainMenu");
        }

        case "help": {
          return await this.routeToNavigationHandler(bot, msg, "showHelp");
        }

        case "status": {
          return await this.routeToNavigationHandler(bot, msg, "showStatus");
        }

        case "cancel": {
          // 상태만 정리하고 NavigationHandler로 위임
          return await this.routeToNavigationHandler(bot, msg, "handleCancel");
        }

        default: {
          // 기타 명령어는 NavigationHandler로 위임
          if (!this.navigationHandler) {
            return false;
          }

          const routingInfo = {
            type: "system_command",
            command,
            args,
            parseInfo,
            msg,
            userId,
            chatId: msg.chat.id,
            userName
          };

          const result = await this.navigationHandler.handleSystemCommand(bot, routingInfo);
          return result !== false;
        }
      }
    } catch (error) {
      logger.error(`❌ 시스템 명령어 라우팅 실패 (${command}):`, error);
      return false;
    }
  }

  // ===== 🛠️ 기존 헬퍼 메서드들 유지 (순수 라우팅 로직만) =====

  async routeModuleCommand(bot, msg, command, args, parseInfo) {
    const _userId = getUserId(msg.from);
    const _userName = getUserName(msg.from);

    logger.debug(`📱 모듈 명령어 라우팅: /${command}`);

    try {
      if (!this.moduleManager) {
        logger.warn("⚠️ ModuleManager가 설정되지 않음");
        return false;
      }

      let moduleInstance = this.findModuleForCommand(command);

      if (!moduleInstance) {
        logger.debug(`📱 모듈 인스턴스를 찾을 수 없음: ${command}`);
        return false;
      }

      if (typeof moduleInstance.onHandleMessage === "function") {
        const enhancedMsg = {
          ...msg,
          commandInfo: {
            command,
            args,
            parseInfo,
            isCommand: true
          }
        };

        const result = await moduleInstance.onHandleMessage(bot, enhancedMsg);
        return result !== false;
      }

      return false;
    } catch (error) {
      logger.error(`❌ 모듈 명령어 라우팅 실패 (${command}):`, error);
      return false;
    }
  }

  findModuleForCommand(command) {
    if (!this.moduleManager) return null;

    let moduleInstance = this.moduleManager.getModule(command);
    if (moduleInstance) return moduleInstance;

    // 🧹 정리된 별칭 매핑 (불필요한 것들 제거)
    const commandAliases = {
      todo: "todo",
      task: "todo",
      timer: "timer",
      time: "timer",
      weather: "weather",
      fortune: "fortune",
      leave: "leave",
      worktime: "worktime",
      work: "worktime",
      tts: "tts",
      voice: "tts"
    };

    const mappedModule = commandAliases[command];
    if (mappedModule) {
      moduleInstance = this.moduleManager.getModule(mappedModule);
      if (moduleInstance) return moduleInstance;
    }

    return null;
  }

  async routeUnknownCommand(bot, msg, command, args, parseInfo) {
    logger.debug(`❓ 알 수 없는 명령어: /${command}`);

    try {
      if (!this.navigationHandler) {
        return false;
      }

      const routingInfo = {
        type: "unknown_command",
        command,
        args,
        parseInfo,
        msg,
        userId: getUserId(msg.from),
        chatId: msg.chat.id,
        userName: getUserName(msg.from)
      };

      const result = await this.navigationHandler.handleUnknownCommand(bot, routingInfo);
      return result !== false;
    } catch (error) {
      logger.error(`❌ 알 수 없는 명령어 라우팅 실패 (${command}):`, error);
      return false;
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  clearUserState(userId) {
    this.userStates.delete(userId);
    logger.debug(`🧹 사용자 상태 정리: ${userId}`);
  }

  createPerformanceTimer() {
    const startTime = Date.now();
    return {
      end: () => Date.now() - startTime
    };
  }

  updateResponseTimeStats(responseTime) {
    this.stats.responseTimeMs.push(responseTime);
    if (this.stats.responseTimeMs.length > 100) {
      this.stats.responseTimeMs = this.stats.responseTimeMs.slice(-50);
    }
  }

  cleanupExpiredStates() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [userId, state] of this.userStates.entries()) {
      if (state.timestamp && now - state.timestamp > this.config.stateTimeoutMs) {
        this.userStates.delete(userId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`🧹 만료된 상태 ${cleanedCount}개 정리 완료`);
    }
  }

  getDetailedStats() {
    const uptime = Date.now() - this.stats.startTime;
    const avgResponseTime =
      this.stats.responseTimeMs.length > 0
        ? Math.round(this.stats.responseTimeMs.reduce((a, b) => a + b, 0) / this.stats.responseTimeMs.length)
        : 0;

    return {
      commands: {
        total: this.stats.commandsProcessed,
        valid: this.stats.validCommands,
        invalid: this.stats.invalidCommands,
        system: this.stats.systemCommands,
        module: this.stats.moduleCommands,
        natural: this.stats.naturalCommands, // 🆕
        doomockCalls: this.stats.doomockCalls, // 🆕
        unknown: this.stats.unknownCommands,
        successRate: this.stats.commandsProcessed > 0 ? Math.round((this.stats.validCommands / this.stats.commandsProcessed) * 100) : 100
      },
      performance: {
        uptime: uptime,
        averageResponseTime: avgResponseTime,
        errorCount: this.stats.errorCount
      },
      userStates: {
        active: this.userStates.size,
        maxStates: this.config.maxUserStates
      },
      features: {
        naturalLanguage: this.config.enableNaturalLanguage,
        doomockPatterns: this.doomockPatterns.length,
        naturalAliases: Object.keys(this.naturalAliases).length
      }
    };
  }

  /**
   * 🧹 정리 (종료 시 호출)
   */
  async cleanup() {
    try {
      logger.info("🧹 CommandHandler 정리 시작...");

      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }

      const stateCount = this.userStates.size;
      this.userStates.clear();

      const finalStats = this.getDetailedStats();
      logger.info("📊 CommandHandler 최종 통계:", finalStats);

      logger.info(`✅ CommandHandler 정리 완료 (상태 ${stateCount}개 정리됨)`);
    } catch (error) {
      logger.error("❌ CommandHandler 정리 실패:", error);
    }
  }
}

module.exports = CommandHandler;
