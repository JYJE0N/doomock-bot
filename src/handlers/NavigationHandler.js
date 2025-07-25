// src/handlers/NavigationHandler.js - 인라인 키보드 전용 핸들러
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");

/**
 * 🎹 네비게이션 핸들러 - 인라인 키보드 전용
 * - 모든 callback_data 처리
 * - 동적 메뉴 생성
 * - 모듈간 네비게이션 관리
 * - 표준 매개변수 체계 준수
 */
class NavigationHandler {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.moduleManager = options.moduleManager;
    this.commandsRegistry = options.commandsRegistry;

    // 🎨 메뉴 테마 설정
    this.menuThemes = {
      system: {
        title: "🤖 **두목봇 v3.0.1**",
        subtitle: "원하는 기능을 선택해주세요.",
        colors: ["🔵", "🟢", "🟡", "🟠", "🔴", "🟣"],
      },
      system: {
        title: "⚙️ **시스템 메뉴**",
        subtitle: "시스템 관련 기능입니다.",
        colors: ["⚙️", "📊", "🔧", "🛠️"],
      },
    };

    // 📊 통계
    this.stats = {
      navigationsHandled: 0,
      menusGenerated: 0,
      errorsCount: 0,
      averageResponseTime: 0,
    };

    logger.info("🎹 NavigationHandler 생성됨");
  }

  /**
   * 🎯 네비게이션 처리 (핵심 메서드)
   * 모든 callback_data를 여기서 처리
   */
  async handleNavigation(bot, callbackQuery, subAction, params, moduleManager) {
    const startTime = Date.now();

    try {
      // 콜백 데이터 파싱
      const { moduleKey, action, additionalParams } = this.parseNavigationData(
        callbackQuery.data
      );

      logger.debug(
        `🎹 네비게이션: ${moduleKey}.${action}(${additionalParams.join(", ")})`
      );

      // 시스템 네비게이션 (직접 처리)
      if (moduleKey === "system" || moduleKey === "main") {
        return await this.handleSystemNavigation(
          bot,
          callbackQuery,
          action,
          additionalParams,
          moduleManager
        );
      }

      // 모듈 네비게이션 (ModuleManager로 위임)
      if (moduleManager && moduleManager.hasModule(moduleKey)) {
        const moduleInstance = moduleManager.getModule(moduleKey);

        if (moduleInstance && moduleInstance.handleCallback) {
          const handled = await moduleInstance.handleCallback(
            bot,
            callbackQuery,
            action,
            additionalParams,
            moduleManager
          );

          if (handled) {
            this.stats.navigationsHandled++;
            return true;
          }
        }
      }

      // 처리되지 않은 네비게이션
      await this.handleUnknownNavigation(bot, callbackQuery, moduleKey, action);
      return false;
    } catch (error) {
      logger.error("❌ 네비게이션 처리 오류:", error);
      this.stats.errorsCount++;

      await this.sendNavigationError(
        bot,
        callbackQuery,
        "네비게이션 처리 중 오류가 발생했습니다."
      );
      return false;
    } finally {
      // 응답 시간 통계 업데이트
      const responseTime = Date.now() - startTime;
      this.updateResponseTimeStats(responseTime);
    }
  }

  /**
   * 🏛️ 시스템 네비게이션 처리
   */
  async handleSystemNavigation(
    bot,
    callbackQuery,
    action,
    params,
    moduleManager
  ) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;

    logger.debug(`🏛️ 시스템 네비게이션: ${action}`);

    switch (action) {
      case "menu":
      case "start":
        return await this.showMainMenu(
          bot,
          callbackQuery,
          params,
          moduleManager
        );

      case "help":
        return await this.showSystemHelp(
          bot,
          callbackQuery,
          params,
          moduleManager
        );

      case "status":
        return await this.showSystemStatus(
          bot,
          callbackQuery,
          params,
          moduleManager
        );

      case "settings":
        return await this.showSystemSettings(
          bot,
          callbackQuery,
          params,
          moduleManager
        );

      default:
        logger.warn(`❓ 알 수 없는 시스템 액션: ${action}`);
        return false;
    }
  }

  /**
   * 🏠 메인 메뉴 표시 (핵심!)
   */
  async showMainMenu(bot, callbackQuery, params, moduleManager) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
        from,
      } = callbackQuery;
      const userName = getUserName(from);

      // 동적 메뉴 생성
      const menuData = await this.generateMainMenuData(moduleManager);

      // 메뉴 텍스트 구성
      const menuText = this.buildMainMenuText(userName, menuData);

      // 키보드 생성
      const keyboard = this.buildMainMenuKeyboard(menuData);

      // 메시지 업데이트
      await bot.editMessageText(menuText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      this.stats.menusGenerated++;
      logger.debug(`🏠 메인 메뉴 표시 완료: ${userName}`);

      return true;
    } catch (error) {
      logger.error("❌ 메인 메뉴 표시 오류:", error);
      return false;
    }
  }

  /**
   * 📊 동적 메인 메뉴 데이터 생성
   */
  async generateMainMenuData(moduleManager) {
    const menuData = {
      activeModules: [],
      inactiveModules: [],
      systemInfo: {
        uptime: this.formatUptime(process.uptime()),
        activeUsers: 0, // TODO: 실제 데이터 연동
        version: "3.0.1",
      },
    };

    // 🎯 표준 모듈 정의 (우선순위 순)
    const standardModules = [
      {
        key: "todo",
        name: "할일 관리",
        emoji: "📝",
        description: "할일 추가, 완료, 관리",
        priority: 1,
        category: "productivity",
      },
      {
        key: "timer",
        name: "타이머/뽀모도로",
        emoji: "⏰",
        description: "시간 관리 도구",
        priority: 2,
        category: "productivity",
      },
      {
        key: "worktime",
        name: "근무시간",
        emoji: "🕐",
        description: "출퇴근 및 근무시간 관리",
        priority: 3,
        category: "work",
      },
      {
        key: "leave",
        name: "휴가 관리",
        emoji: "🏖️",
        description: "연차, 휴가 신청 관리",
        priority: 4,
        category: "work",
      },
      {
        key: "reminder",
        name: "리마인더",
        emoji: "🔔",
        description: "시간 기반 알림",
        priority: 5,
        category: "utility",
      },
      {
        key: "fortune",
        name: "운세",
        emoji: "🔮",
        description: "일반/업무/타로 운세",
        priority: 6,
        category: "entertainment",
      },
      {
        key: "weather",
        name: "날씨",
        emoji: "🌤️",
        description: "실시간 날씨 정보",
        priority: 7,
        category: "information",
      },
      {
        key: "tts",
        name: "음성 변환",
        emoji: "🎤",
        description: "텍스트를 음성으로 변환",
        priority: 8,
        category: "utility",
      },
    ];

    // 모듈 활성화 상태 확인
    for (const moduleInfo of standardModules) {
      const isActive = moduleManager && moduleManager.hasModule(moduleInfo.key);

      if (isActive) {
        menuData.activeModules.push(moduleInfo);
      } else {
        menuData.inactiveModules.push(moduleInfo);
      }
    }

    // 우선순위 순으로 정렬
    menuData.activeModules.sort((a, b) => a.priority - b.priority);

    return menuData;
  }

  /**
   * 📝 메인 메뉴 텍스트 구성
   */
  buildMainMenuText(userName, menuData) {
    const theme = this.menuThemes.main;

    let menuText = `${theme.title}

👋 안녕하세요, **${userName}**님!
${theme.subtitle}

**📊 시스템 현황**
- 🟢 활성 모듈: ${menuData.activeModules.length}개
- ⏱️ 가동 시간: ${menuData.systemInfo.uptime}
- 📱 버전: v${menuData.systemInfo.version}`;

    // 비활성 모듈이 있으면 표시
    if (menuData.inactiveModules.length > 0) {
      menuText += `\n• ⚪ 비활성 모듈: ${menuData.inactiveModules.length}개`;
    }

    return menuText;
  }

  /**
   * ⌨️ 메인 메뉴 키보드 구성
   */
  buildMainMenuKeyboard(menuData) {
    const keyboard = { inline_keyboard: [] };

    // 🎯 활성 모듈 버튼들 (2열 배치)
    const moduleButtons = menuData.activeModules.map((module) => ({
      text: `${module.emoji} ${module.name}`,
      callback_data: `${module.key}:menu`,
    }));

    // 2개씩 묶어서 행 생성
    for (let i = 0; i < moduleButtons.length; i += 2) {
      const row = [moduleButtons[i]];
      if (i + 1 < moduleButtons.length) {
        row.push(moduleButtons[i + 1]);
      }
      keyboard.inline_keyboard.push(row);
    }

    // 🛠️ 시스템 메뉴 (항상 표시)
    keyboard.inline_keyboard.push([
      { text: "⚙️ 시스템", callback_data: "system:settings" },
      { text: "📊 상태", callback_data: "system:status" },
      { text: "❓ 도움말", callback_data: "system:help" },
    ]);

    return keyboard;
  }

  /**
   * 📖 시스템 도움말 표시
   */
  async showSystemHelp(bot, callbackQuery, params, moduleManager) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const helpText = `📖 **시스템 도움말**

**🎹 네비게이션 사용법**
- 버튼을 눌러 원하는 기능으로 이동
- 🔙 버튼으로 이전 메뉴로 복귀
- 🏠 버튼으로 메인 메뉴로 이동

**⌨️ 명령어 사용법**
- \`/start\` - 봇 시작 및 메인 메뉴
- \`/help\` - 이 도움말 표시
- \`/status\` - 시스템 상태 확인
- \`/cancel\` - 현재 작업 취소

**📱 모듈별 기능**
각 모듈을 선택하면 해당 기능의
상세 도움말을 확인할 수 있습니다.

**🆘 문제 해결**
- 버튼이 응답하지 않으면 \`/start\` 입력
- 오류 발생 시 잠시 후 다시 시도
- 지속적인 문제는 관리자에게 문의`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📱 모듈 도움말", callback_data: "system:module_help" },
            { text: "🔧 설정", callback_data: "system:settings" },
          ],
          [{ text: "🔙 메인 메뉴", callback_data: "system:menu" }],
        ],
      };

      await bot.editMessageText(helpText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("❌ 시스템 도움말 표시 오류:", error);
      return false;
    }
  }

  /**
   * 📊 시스템 상태 표시
   */
  async showSystemStatus(bot, callbackQuery, params, moduleManager) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      // 시스템 상태 수집
      const systemStatus = await this.collectSystemStatus(moduleManager);

      const statusText = `📊 **시스템 상태**

**⚡ 시스템 정보**
- 🟢 상태: ${systemStatus.overall}
- ⏱️ 가동시간: ${systemStatus.uptime}  
- 💾 메모리: ${systemStatus.memory}
- 🌍 환경: ${systemStatus.environment}

**📱 모듈 현황**
- ✅ 활성: ${systemStatus.modules.active}개
- ❌ 비활성: ${systemStatus.modules.inactive}개
- ⚠️ 오류: ${systemStatus.modules.error}개

**📊 처리 통계**
- 네비게이션: ${this.stats.navigationsHandled}회
- 메뉴 생성: ${this.stats.menusGenerated}회
- 평균 응답: ${Math.round(this.stats.averageResponseTime)}ms

**🔗 연결 상태**
- 데이터베이스: ${systemStatus.database}
- Railway: ${systemStatus.railway}

마지막 업데이트: ${TimeHelper.getLogTimeString()}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 새로고침", callback_data: "system:status" },
            { text: "📋 상세 로그", callback_data: "system:detailed_logs" },
          ],
          [{ text: "🔙 메인 메뉴", callback_data: "system:menu" }],
        ],
      };

      await bot.editMessageText(statusText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("❌ 시스템 상태 표시 오류:", error);
      return false;
    }
  }

  /**
   * 📊 시스템 상태 수집
   */
  async collectSystemStatus(moduleManager) {
    const memUsage = process.memoryUsage();

    return {
      overall: "정상",
      uptime: this.formatUptime(process.uptime()),
      memory: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      environment: process.env.RAILWAY_ENVIRONMENT ? "Railway" : "Local",
      modules: {
        active: moduleManager ? moduleManager.getModuleList().length : 0,
        inactive: 0, // TODO: 실제 계산
        error: 0, // TODO: 실제 계산
      },
      database: "연결됨", // TODO: 실제 확인
      railway: process.env.RAILWAY_ENVIRONMENT ? "연결됨" : "미사용",
    };
  }

  /**
   * 🔍 네비게이션 데이터 파싱
   */
  parseNavigationData(callbackData) {
    if (!callbackData || typeof callbackData !== "string") {
      return {
        moduleKey: "system",
        action: "menu",
        additionalParams: [],
      };
    }

    const parts = callbackData.split(":");

    return {
      moduleKey: parts[0] || "system",
      action: parts[1] || "menu",
      additionalParams: parts.slice(2) || [],
    };
  }

  /**
   * ❓ 알 수 없는 네비게이션 처리
   */
  async handleUnknownNavigation(bot, callbackQuery, moduleKey, action) {
    logger.warn(`❓ 알 수 없는 네비게이션: ${moduleKey}.${action}`);

    await this.sendNavigationError(
      bot,
      callbackQuery,
      `"${moduleKey}.${action}" 기능을 찾을 수 없습니다.`
    );
  }

  /**
   * ❌ 네비게이션 에러 전송
   */
  async sendNavigationError(bot, callbackQuery, message) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const errorText = `⚠️ **네비게이션 오류**

${message}

**해결 방법:**
- 메인 메뉴로 돌아가서 다시 시도
- 문제가 지속되면 \`/start\` 명령어 사용
- 그래도 안 되면 관리자에게 문의`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🏠 메인 메뉴", callback_data: "system:menu" },
            { text: "🔄 새로고침", callback_data: "system:start" },
          ],
        ],
      };

      await bot.editMessageText(errorText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("❌ 네비게이션 에러 메시지 전송 실패:", error);
    }
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
    };
  }

  /**
   * 🧹 정리
   */
  async cleanup() {
    try {
      logger.info("🧹 NavigationHandler 정리 시작...");

      // 통계 초기화
      this.stats = {
        navigationsHandled: 0,
        menusGenerated: 0,
        errorsCount: 0,
        averageResponseTime: 0,
      };

      logger.info("✅ NavigationHandler 정리 완료");
    } catch (error) {
      logger.error("❌ NavigationHandler 정리 실패:", error);
    }
  }
}

module.exports = NavigationHandler;
