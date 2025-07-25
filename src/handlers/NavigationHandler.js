// src/handlers/NavigationHandler.js - ModuleManager 실제 연동 개선 버전
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");

/**
 * 🎹 네비게이션 핸들러 v3.0.1 - ModuleManager 실제 연동
 *
 * 🔧 핵심 개선사항:
 * - ModuleManager의 실제 모듈 상태 사용
 * - getActiveModulesStatus() 메서드 활용
 * - 하드코딩된 모듈 정보 제거
 * - 동적 메뉴 생성 완전 구현
 */
class NavigationHandler {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.moduleManager = options.moduleManager;
    this.commandsRegistry = options.commandsRegistry;

    // 🎨 메뉴 테마 설정
    this.menuThemes = {
      main: {
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

    logger.info("🎹 NavigationHandler v3.0.1 생성됨 (ModuleManager 연동)");
  }

  /**
   * 🎯 네비게이션 처리 (핵심 메서드)
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
   * 🏠 메인 메뉴 표시 (핵심 개선!)
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

      // 🔧 ModuleManager의 실제 데이터 사용 (핵심 개선!)
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
      logger.debug(
        `🏠 메인 메뉴 표시 완료: ${userName} (${menuData.activeModules.length}개 모듈)`
      );

      return true;
    } catch (error) {
      logger.error("❌ 메인 메뉴 표시 오류:", error);
      return false;
    }
  }

  /**
   * 📊 동적 메인 메뉴 데이터 생성 (완전 개선!)
   */
  async generateMainMenuData(moduleManager) {
    try {
      logger.debug("📊 동적 메뉴 데이터 생성 시작...");

      const menuData = {
        activeModules: [],
        inactiveModules: [],
        systemInfo: {
          uptime: this.formatUptime(process.uptime()),
          version: "3.0.1",
          environment: process.env.RAILWAY_ENVIRONMENT ? "Railway" : "Local",
        },
        stats: {
          totalModules: 0,
          activeModules: 0,
          failedModules: 0,
        },
      };

      // ✅ ModuleManager의 실제 데이터 사용
      if (moduleManager && moduleManager.isInitialized) {
        // 실제 활성 모듈 상태 조회
        const activeModulesStatus = moduleManager.getActiveModulesStatus();

        menuData.activeModules = activeModulesStatus.map((module) => ({
          key: module.key,
          name: module.name,
          emoji: module.emoji,
          description: module.description,
          features: module.features,
          priority: module.priority,
          status: module.status,
        }));

        // ModuleManager 통계 정보
        const managerStatus = moduleManager.getStatus();
        menuData.stats = {
          totalModules: managerStatus.stats.totalModules,
          activeModules: managerStatus.stats.activeModules,
          failedModules: managerStatus.stats.failedModules,
        };

        // 등록되었지만 비활성인 모듈들 계산
        const allRegisteredModules = Object.keys(managerStatus.modules || {});
        const activeModuleKeys = menuData.activeModules.map((m) => m.key);

        menuData.inactiveModules = allRegisteredModules
          .filter((key) => !activeModuleKeys.includes(key))
          .map((key) => {
            const moduleInfo = managerStatus.modules[key];
            return {
              key: key,
              name: moduleInfo?.name || key,
              emoji: moduleManager.getModuleEmoji(key),
              reason:
                moduleInfo?.loadError || moduleInfo?.initError || "초기화 실패",
            };
          });

        logger.debug(
          `📊 실제 모듈 데이터: ${menuData.activeModules.length}개 활성, ${menuData.inactiveModules.length}개 비활성`
        );
      } else {
        // ModuleManager가 없거나 초기화되지 않은 경우 폴백
        logger.warn("⚠️ ModuleManager가 없거나 초기화되지 않음 - 폴백 모드");

        menuData.activeModules = [];
        menuData.inactiveModules = this.getFallbackModules();
        menuData.stats.totalModules = menuData.inactiveModules.length;
      }

      return menuData;
    } catch (error) {
      logger.error("❌ 메뉴 데이터 생성 오류:", error);

      // 오류 발생 시 최소한의 폴백 데이터
      return {
        activeModules: [],
        inactiveModules: this.getFallbackModules(),
        systemInfo: {
          uptime: this.formatUptime(process.uptime()),
          version: "3.0.1",
          environment: "오류 상태",
        },
        stats: {
          totalModules: 0,
          activeModules: 0,
          failedModules: 0,
        },
      };
    }
  }

  /**
   * 🛡️ 폴백 모듈 정보 (ModuleManager 실패시)
   */
  getFallbackModules() {
    return [
      {
        key: "todo",
        name: "할일 관리",
        emoji: "📝",
        reason: "모듈 로드 실패",
      },
      {
        key: "timer",
        name: "타이머/뽀모도로",
        emoji: "⏰",
        reason: "모듈 로드 실패",
      },
      {
        key: "worktime",
        name: "근무시간",
        emoji: "🕐",
        reason: "모듈 로드 실패",
      },
    ];
  }

  /**
   * 📝 메인 메뉴 텍스트 구성 (개선!)
   */
  buildMainMenuText(userName, menuData) {
    const theme = this.menuThemes.main;

    let menuText = `${theme.title}

👋 안녕하세요, **${userName}**님!
${theme.subtitle}

**📊 시스템 현황**
- 🟢 활성 모듈: ${menuData.activeModules.length}개
- ⏱️ 가동 시간: ${menuData.systemInfo.uptime}
- 🌍 환경: ${menuData.systemInfo.environment}
- 📱 버전: v${menuData.systemInfo.version}`;

    // 활성 모듈이 있으면 간단히 나열
    if (menuData.activeModules.length > 0) {
      const moduleList = menuData.activeModules
        .slice(0, 3) // 처음 3개만 표시
        .map((m) => `${m.emoji} ${m.name}`)
        .join(", ");

      menuText += `\n\n**🎯 주요 기능:** ${moduleList}`;

      if (menuData.activeModules.length > 3) {
        menuText += ` 외 ${menuData.activeModules.length - 3}개`;
      }
    }

    // 비활성 모듈이 있으면 간단히 표시
    if (menuData.inactiveModules.length > 0) {
      menuText += `\n• ⚪ 비활성 모듈: ${menuData.inactiveModules.length}개`;
    }

    return menuText;
  }

  /**
   * ⌨️ 메인 메뉴 키보드 구성 (개선!)
   */
  buildMainMenuKeyboard(menuData) {
    try {
      const keyboard = { inline_keyboard: [] };

      // 🎯 활성 모듈 버튼들 (실제 ModuleManager 데이터 사용)
      if (menuData.activeModules.length > 0) {
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
      } else {
        // 활성 모듈이 없는 경우 안내
        keyboard.inline_keyboard.push([
          {
            text: "⚠️ 활성 모듈 없음",
            callback_data: "system:status",
          },
        ]);
      }

      // 🛠️ 시스템 메뉴 (항상 표시)
      keyboard.inline_keyboard.push([
        { text: "⚙️ 시스템", callback_data: "system:settings" },
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
            { text: "📊 시스템 상태", callback_data: "system:status" },
            { text: "❓ 도움말", callback_data: "system:help" },
          ],
          [{ text: "🔄 새로고침", callback_data: "system:start" }],
        ],
      };
    }
  }

  /**
   * 📊 시스템 상태 표시 (개선!)
   */
  async showSystemStatus(bot, callbackQuery, params, moduleManager) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      // 실제 시스템 상태 수집
      const systemStatus = this.generateSystemStatusData(moduleManager);
      const statusText = this.buildSystemStatusText(systemStatus);
      const statusKeyboard = this.buildSystemStatusKeyboard();

      await bot.editMessageText(statusText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: statusKeyboard,
      });

      return true;
    } catch (error) {
      logger.error("❌ 시스템 상태 표시 오류:", error);
      return false;
    }
  }

  /**
   * 📊 시스템 상태 데이터 생성
   */
  generateSystemStatusData(moduleManager) {
    const status = {
      system: {
        uptime: this.formatUptime(process.uptime()),
        version: "3.0.1",
        environment: process.env.RAILWAY_ENVIRONMENT ? "Railway" : "Local",
        memory: process.memoryUsage(),
        nodeVersion: process.version,
      },
      modules: {
        total: 0,
        active: 0,
        failed: 0,
        list: [],
      },
      database: "미확인",
      navigationHandler: {
        navigationsHandled: this.stats.navigationsHandled,
        menusGenerated: this.stats.menusGenerated,
        errorsCount: this.stats.errorsCount,
        averageResponseTime: Math.round(this.stats.averageResponseTime),
      },
    };

    // ModuleManager 상태
    if (moduleManager && moduleManager.isInitialized) {
      const managerStatus = moduleManager.getStatus();

      status.modules.total = managerStatus.stats.totalModules;
      status.modules.active = managerStatus.stats.activeModules;
      status.modules.failed = managerStatus.stats.failedModules;

      // 모듈별 상세 상태
      status.modules.list = Object.entries(managerStatus.modules || {}).map(
        ([key, moduleInfo]) => ({
          key,
          name: moduleInfo.name,
          initialized: moduleInfo.initialized,
          status: moduleInfo.initialized ? "✅" : "❌",
          error: moduleInfo.loadError || moduleInfo.initError,
        })
      );

      status.database = managerStatus.centralSystems?.dbManager
        ? "연결됨"
        : "미연결";
    }

    return status;
  }

  /**
   * 📝 시스템 상태 텍스트 구성
   */
  buildSystemStatusText(statusData) {
    const memoryMB = Math.round(
      statusData.system.memory.heapUsed / 1024 / 1024
    );

    let statusText = `📊 **시스템 상태 보고서**

**🤖 시스템 정보**
- 📱 버전: v${statusData.system.version}
- 🌍 환경: ${statusData.system.environment}
- ⏱️ 가동시간: ${statusData.system.uptime}
- 🧠 메모리: ${memoryMB}MB
- 🟢 Node.js: ${statusData.system.nodeVersion}

**📦 모듈 상태**
- 전체: ${statusData.modules.total}개
- 활성: ${statusData.modules.active}개
- 실패: ${statusData.modules.failed}개

**🗄️ 데이터베이스**
- 상태: ${statusData.database}

**🎹 NavigationHandler**
- 처리된 네비게이션: ${statusData.navigationHandler.navigationsHandled}회
- 생성된 메뉴: ${statusData.navigationHandler.menusGenerated}개
- 평균 응답시간: ${statusData.navigationHandler.averageResponseTime}ms
- 오류: ${statusData.navigationHandler.errorsCount}회`;

    // 모듈별 상세 상태 (처음 5개만)
    if (statusData.modules.list.length > 0) {
      statusText += `\n\n**🔧 모듈 상세**`;

      statusData.modules.list.slice(0, 5).forEach((module) => {
        statusText += `\n• ${module.status} ${module.name}`;
        if (module.error) {
          statusText += ` (${module.error.substring(0, 30)}...)`;
        }
      });

      if (statusData.modules.list.length > 5) {
        statusText += `\n• ... 외 ${statusData.modules.list.length - 5}개`;
      }
    }

    return statusText;
  }

  /**
   * ⌨️ 시스템 상태 키보드 구성
   */
  buildSystemStatusKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "🔄 새로고침", callback_data: "system:status" },
          { text: "🏠 메인 메뉴", callback_data: "system:menu" },
        ],
      ],
    };
  }

  /**
   * 📖 시스템 도움말 표시 (기존 유지)
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

**🔧 문제 해결**
- 버튼이 작동하지 않으면 \`/start\` 재시작
- 지속적인 문제는 📊 상태 메뉴에서 확인`;

      const helpKeyboard = {
        inline_keyboard: [
          [
            { text: "📊 시스템 상태", callback_data: "system:status" },
            { text: "🏠 메인 메뉴", callback_data: "system:menu" },
          ],
        ],
      };

      await bot.editMessageText(helpText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: helpKeyboard,
      });

      return true;
    } catch (error) {
      logger.error("❌ 시스템 도움말 표시 오류:", error);
      return false;
    }
  }

  /**
   * ⚙️ 시스템 설정 표시 (새로 추가)
   */
  async showSystemSettings(bot, callbackQuery, params, moduleManager) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const settingsText = `⚙️ **시스템 설정**

**🔧 현재 설정**
- 환경: ${process.env.RAILWAY_ENVIRONMENT ? "Railway" : "Local"}
- 타임존: Asia/Seoul (KST)
- 로그 레벨: ${process.env.LOG_LEVEL || "info"}

**📊 통계 초기화**
시스템 통계를 초기화할 수 있습니다.

**🔄 시스템 재시작**
모든 모듈을 다시 로드합니다.

⚠️ **주의**: 설정 변경은 관리자만 가능합니다.`;

      const settingsKeyboard = {
        inline_keyboard: [
          [
            { text: "📊 통계 초기화", callback_data: "system:reset_stats" },
            { text: "🔄 모듈 재로드", callback_data: "system:reload_modules" },
          ],
          [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
        ],
      };

      await bot.editMessageText(settingsText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: settingsKeyboard,
      });

      return true;
    } catch (error) {
      logger.error("❌ 시스템 설정 표시 오류:", error);
      return false;
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 (기존 유지) =====

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
