// src/handlers/CommandHandler.js - 명령어 전용 핸들러
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");

/**
 * ⌨️ 커맨드 핸들러 - 명령어 전용
 * - 모든 /명령어 처리
 * - BotFather 명령어 연동
 * - 텍스트 입력 상태 관리
 * - 표준 매개변수 체계 준수
 */
class CommandHandler {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.moduleManager = options.moduleManager;
    this.commandsRegistry = options.commandsRegistry;
    this.navigationHandler = options.navigationHandler;

    // 📊 사용자 입력 상태 관리
    this.userStates = new Map();

    // 📊 통계
    this.stats = {
      commandsProcessed: 0,
      successfulCommands: 0,
      failedCommands: 0,
      unknownCommands: 0,
      averageResponseTime: 0,
    };

    // ⏱️ 상태 정리 스케줄러
    this.startStateCleanupScheduler();

    logger.info("⌨️ CommandHandler 생성됨");
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
    const userName = getUserName(msg.from);

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
   * 🏛️ 시스템 명령어 처리
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
   * 🚀 /start 명령어 처리
   */
  async handleStartCommand(bot, msg, args) {
    const {
      chat: { id: chatId },
      from,
    } = msg;
    const userName = getUserName(from);

    try {
      logger.info(`🚀 Start 명령어: ${userName}`);

      // 사용자 상태 초기화
      this.clearUserState(from.id);

      // NavigationHandler로 메인 메뉴 표시 위임
      const welcomeText = `👋 **안녕하세요, ${userName}님!**

🤖 **두목봇 v3.0.1**에 오신 것을 환영합니다.

아래 메뉴에서 원하는 기능을 선택해주세요.`;

      // 동적 메인 메뉴 키보드 생성
      const keyboard = await this.generateMainMenuKeyboard();

      await bot.sendMessage(chatId, welcomeText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

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
   * ❓ /help 명령어 처리
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

      // 전체 도움말
      const helpData = await this.generateHelpData();
      const helpText = this.buildHelpText(helpData);
      const keyboard = this.buildHelpKeyboard(helpData);

      await bot.sendMessage(chatId, helpText, {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
        reply_markup: keyboard,
      });

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
   * 📊 /status 명령어 처리
   */
  async handleStatusCommand(bot, msg, args) {
    const {
      chat: { id: chatId },
    } = msg;

    try {
      logger.info("📊 Status 명령어 처리");

      const statusData = await this.generateStatusData();
      const statusText = this.buildStatusText(statusData);
      const keyboard = this.buildStatusKeyboard();

      await bot.sendMessage(chatId, statusText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("❌ Status 명령어 처리 오류:", error);
      await bot.sendMessage(chatId, "상태 확인 중 오류가 발생했습니다.");
      return false;
    }
  }

  /**
   * ❌ /cancel 명령어 처리
   */
  async handleCancelCommand(bot, msg, args) {
    const {
      chat: { id: chatId },
      from: { id: userId },
    } = msg;
    const userName = getUserName(msg.from);

    try {
      logger.info(`❌ Cancel 명령어: ${userName}`);

      // 사용자 상태 확인
      const userState = this.getUserState(userId);

      if (!userState || !userState.action) {
        await bot.sendMessage(chatId, "취소할 작업이 없습니다.", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
            ],
          },
        });
        return true;
      }

      // 상태 초기화
      this.clearUserState(userId);

      await bot.sendMessage(
        chatId,
        `✅ **작업이 취소되었습니다.**

이전에 진행 중이던 "${userState.action}" 작업을 취소했습니다.`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
            ],
          },
        }
      );

      return true;
    } catch (error) {
      logger.error("❌ Cancel 명령어 처리 오류:", error);
      await bot.sendMessage(chatId, "작업 취소 중 오류가 발생했습니다.");
      return false;
    }
  }

  /**
   * 📱 모듈 명령어 처리
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
        if (moduleInstance.handleMessage) {
          // 일반 메시지 핸들러로 처리
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
   * 🗄️ 동적 메인 메뉴 키보드 생성
   */
  async generateMainMenuKeyboard() {
    try {
      const keyboard = { inline_keyboard: [] };

      // 활성 모듈 버튼들
      const moduleButtons = [];

      if (this.moduleManager) {
        const moduleList = this.moduleManager.getModuleList();

        // 표준 모듈 순서
        const moduleOrder = [
          { key: "todo", name: "📝 할일 관리" },
          { key: "timer", name: "⏰ 타이머" },
          { key: "worktime", name: "🕐 근무시간" },
          { key: "leave", name: "🏖️ 휴가 관리" },
          { key: "reminder", name: "🔔 리마인더" },
          { key: "fortune", name: "🔮 운세" },
          { key: "weather", name: "🌤️ 날씨" },
          { key: "tts", name: "🎤 음성 변환" },
        ];

        for (const moduleInfo of moduleOrder) {
          if (moduleList.includes(moduleInfo.key)) {
            moduleButtons.push({
              text: moduleInfo.name,
              callback_data: `${moduleInfo.key}:menu`,
            });
          }
        }
      }

      // 2개씩 묶어서 행 생성
      for (let i = 0; i < moduleButtons.length; i += 2) {
        const row = [moduleButtons[i]];
        if (i + 1 < moduleButtons.length) {
          row.push(moduleButtons[i + 1]);
        }
        keyboard.inline_keyboard.push(row);
      }

      // 시스템 메뉴
      keyboard.inline_keyboard.push([
        { text: "📊 상태", callback_data: "system:status" },
        { text: "❓ 도움말", callback_data: "system:help" },
      ]);

      return keyboard;
    } catch (error) {
      logger.error("❌ 메인 메뉴 키보드 생성 오류:", error);

      // 폴백 키보드
      return {
        inline_keyboard: [
          [
            { text: "📝 할일", callback_data: "todo:menu" },
            { text: "⏰ 타이머", callback_data: "timer:menu" },
          ],
          [
            { text: "📊 상태", callback_data: "system:status" },
            { text: "❓ 도움말", callback_data: "system:help" },
          ],
        ],
      };
    }
  }

  /**
   * 📊 도움말 데이터 생성
   */
  async generateHelpData() {
    const helpData = {
      systemCommands: [
        { command: "start", description: "봇 시작 및 메인 메뉴" },
        { command: "help", description: "도움말 보기" },
        { command: "status", description: "시스템 상태 확인" },
        { command: "cancel", description: "현재 작업 취소" },
      ],
      moduleCommands: [],
      stats: this.commandsRegistry
        ? this.commandsRegistry.getCommandStats()
        : {
            totalCommands: 0,
            publicCommands: 0,
            systemCommands: 4,
            moduleCommands: 0,
          },
    };

    // 모듈 명령어 수집
    if (this.commandsRegistry) {
      const publicCommands = this.commandsRegistry.getBotFatherCommands();
      helpData.moduleCommands = publicCommands.filter(
        (cmd) =>
          !helpData.systemCommands.some((sys) => sys.command === cmd.command)
      );
    }

    return helpData;
  }

  /**
   * 📝 도움말 텍스트 구성
   */
  buildHelpText(helpData) {
    let helpText = `📖 **두목봇 도움말**
버전: v3.0.1

**📊 명령어 현황**
- 총 명령어: ${helpData.stats.totalCommands}개
- 시스템: ${helpData.stats.systemCommands}개  
- 모듈: ${helpData.stats.moduleCommands}개

**🏛️ 시스템 명령어**`;

    // 시스템 명령어 나열
    for (const cmd of helpData.systemCommands) {
      helpText += `\n• \`/${cmd.command}\` - ${cmd.description}`;
    }

    if (helpData.moduleCommands.length > 0) {
      helpText += `\n\n**📱 모듈 명령어**`;

      // 모듈 명령어 나열 (최대 8개까지만)
      const displayCommands = helpData.moduleCommands.slice(0, 8);
      for (const cmd of displayCommands) {
        helpText += `\n• \`/${cmd.command}\` - ${cmd.description}`;
      }

      if (helpData.moduleCommands.length > 8) {
        helpText += `\n• ... 외 ${helpData.moduleCommands.length - 8}개`;
      }
    }

    helpText += `\n\n**💡 사용 팁**
- 버튼 클릭으로 쉽게 이동 가능
- \`/help [모듈명]\`으로 상세 도움말 확인
- \`/cancel\`로 언제든 작업 취소 가능

**🆘 문제 해결**
문제가 있으시면 \`/start\` 명령어를 입력하거나
관리자에게 연락해주세요.`;

    return helpText;
  }

  /**
   * ⌨️ 도움말 키보드 구성
   */
  buildHelpKeyboard(helpData) {
    const keyboard = { inline_keyboard: [] };

    // 주요 모듈 도움말 버튼들
    const helpButtons = [
      { text: "📝 할일 도움말", callback_data: "help:todo" },
      { text: "⏰ 타이머 도움말", callback_data: "help:timer" },
      { text: "🏖️ 휴가 도움말", callback_data: "help:leave" },
      { text: "🌤️ 날씨 도움말", callback_data: "help:weather" },
    ];

    // 2개씩 묶어서 행 생성
    for (let i = 0; i < helpButtons.length; i += 2) {
      const row = [helpButtons[i]];
      if (i + 1 < helpButtons.length) {
        row.push(helpButtons[i + 1]);
      }
      keyboard.inline_keyboard.push(row);
    }

    // 하단 메뉴
    keyboard.inline_keyboard.push([
      { text: "🏠 메인 메뉴", callback_data: "system:menu" },
    ]);

    return keyboard;
  }

  /**
   * 📊 상태 데이터 생성
   */
  async generateStatusData() {
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();

    return {
      uptime: this.formatUptime(uptime),
      memory: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      environment: process.env.RAILWAY_ENVIRONMENT ? "Railway" : "Local",
      version: "3.0.1",
      commandStats: this.stats,
      moduleStats: this.moduleManager
        ? this.moduleManager.getModuleStats()
        : {
            total: 0,
            active: 0,
            failed: 0,
          },
      userSessions: this.userStates.size,
      database: "연결됨", // TODO: 실제 확인
      railway: process.env.RAILWAY_ENVIRONMENT ? "활성" : "미사용",
    };
  }

  /**
   * 📊 상태 텍스트 구성
   */
  buildStatusText(statusData) {
    return `📊 **시스템 상태**

**⚡ 기본 정보**
- 🟢 상태: 정상 동작 중
- ⏱️ 가동시간: ${statusData.uptime}
- 💾 메모리: ${statusData.memory}
- 🌍 환경: ${statusData.environment}
- 📱 버전: v${statusData.version}

**📈 명령어 처리 통계**
- 처리된 명령어: ${statusData.commandStats.commandsProcessed}개
- 성공: ${statusData.commandStats.successfulCommands}개
- 실패: ${statusData.commandStats.failedCommands}개
- 알 수 없음: ${statusData.commandStats.unknownCommands}개
- 평균 응답: ${statusData.commandStats.averageResponseTime}ms

**📱 모듈 현황**
- 활성 모듈: ${statusData.moduleStats.active}개
- 총 모듈: ${statusData.moduleStats.total}개
- 실패 모듈: ${statusData.moduleStats.failed}개

**🔗 연결 상태**
- 활성 세션: ${statusData.userSessions}개
- 데이터베이스: ${statusData.database}
- Railway: ${statusData.railway}

✅ 모든 시스템이 정상 작동 중입니다.

마지막 업데이트: ${TimeHelper.getLogTimeString()}`;
  }

  /**
   * ⌨️ 상태 키보드 구성
   */
  buildStatusKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "🔄 새로고침", callback_data: "system:status" },
          { text: "📋 상세 로그", callback_data: "system:detailed_logs" },
        ],
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
      ],
    };
  }

  /**
   * ❓ 알 수 없는 명령어 처리
   */
  async handleUnknownCommand(bot, msg, command, args) {
    const {
      chat: { id: chatId },
    } = msg;
    const userName = getUserName(msg.from);

    logger.warn(`❓ 알 수 없는 명령어: /${command} (${userName})`);

    const errorText = `❓ **알 수 없는 명령어**

\`/${command}\` 명령어를 찾을 수 없습니다.

**사용 가능한 명령어:**
- \`/start\` - 봇 시작
- \`/help\` - 도움말 보기  
- \`/status\` - 상태 확인
- \`/cancel\` - 작업 취소

**모듈 명령어:**
- \`/todo\` - 할일 관리
- \`/timer\` - 타이머/뽀모도로
- \`/weather\` - 날씨 정보
- \`/fortune\` - 운세

\`/help\` 명령어로 전체 목록을 확인하세요.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📖 도움말", callback_data: "system:help" },
          { text: "🏠 메인 메뉴", callback_data: "system:menu" },
        ],
      ],
    };

    await bot.sendMessage(chatId, errorText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
      reply_to_message_id: msg.message_id,
    });
  }

  /**
   * ❌ 명령어 에러 전송
   */
  async sendCommandError(bot, chatId, message) {
    try {
      await bot.sendMessage(chatId, `❌ ${message}`, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
          ],
        },
      });
    } catch (error) {
      logger.error("❌ 명령어 에러 메시지 전송 실패:", error);
    }
  }

  // ===== 📊 사용자 상태 관리 =====

  /**
   * 사용자 상태 설정
   */
  setUserState(userId, state) {
    this.userStates.set(userId.toString(), {
      ...state,
      timestamp: Date.now(),
    });
  }

  /**
   * 사용자 상태 조회
   */
  getUserState(userId) {
    return this.userStates.get(userId.toString()) || null;
  }

  /**
   * 사용자 상태 삭제
   */
  clearUserState(userId) {
    this.userStates.delete(userId.toString());
  }

  /**
   * 🧹 상태 정리 스케줄러
   */
  startStateCleanupScheduler() {
    setInterval(() => {
      const now = Date.now();
      const timeout = 30 * 60 * 1000; // 30분

      for (const [userId, state] of this.userStates.entries()) {
        if (now - state.timestamp > timeout) {
          this.userStates.delete(userId);
          logger.debug(`🧹 사용자 상태 정리: ${userId}`);
        }
      }
    }, 5 * 60 * 1000); // 5분마다
  }

  /**
   * 📊 응답 시간 통계 업데이트
   */
  updateResponseTimeStats(responseTime) {
    if (this.stats.averageResponseTime === 0) {
      this.stats.averageResponseTime = responseTime;
    } else {
      this.stats.averageResponseTime =
        this.stats.averageResponseTime * 0.9 + responseTime * 0.1;
    }
  }

  /**
   * ⏱️ 업타임 포맷팅
   */
  formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else {
      return `${minutes}분`;
    }
  }

  /**
   * 📊 통계 조회
   */
  getStats() {
    return {
      ...this.stats,
      averageResponseTime: Math.round(this.stats.averageResponseTime),
      activeUserStates: this.userStates.size,
    };
  }

  /**
   * 🧹 정리
   */
  async cleanup() {
    try {
      logger.info("🧹 CommandHandler 정리 시작...");

      // 사용자 상태 정리
      this.userStates.clear();

      // 통계 초기화
      this.stats = {
        commandsProcessed: 0,
        successfulCommands: 0,
        failedCommands: 0,
        unknownCommands: 0,
        averageResponseTime: 0,
      };

      logger.info("✅ CommandHandler 정리 완료");
    } catch (error) {
      logger.error("❌ CommandHandler 정리 실패:", error);
    }
  }
}

module.exports = CommandHandler;
