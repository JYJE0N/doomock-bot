// src/modules/SystemModule.js - 완전 수정된 버전 v3.0.1
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");

/**
 * 🏠 SystemModule v3.0.1 - 완전 수정된 시스템 핵심 모듈
 *
 * 🎯 주요 수정사항:
 * - setupActions 메서드 추가 (필수!)
 * - handleCallback 메서드 구현
 * - 표준 액션 등록 시스템 구현
 * - NavigationHandler와 완전 연동
 */
class SystemModule extends BaseModule {
  constructor(bot, options = {}) {
    super("SystemModule", {
      bot,
      serviceBuilder: options.serviceBuilder,
      moduleManager: options.moduleManager,
      moduleKey: options.moduleKey,
      moduleConfig: options.moduleConfig,
      config: options.config,
    });

    // 🎯 시스템 설정 (Railway 환경변수 기반)
    this.config = {
      version: process.env.npm_package_version || "3.0.1",
      environment: process.env.NODE_ENV || "development",
      isRailway: !!process.env.RAILWAY_ENVIRONMENT,
      botName: process.env.BOT_NAME || "doomock_todoBot",
      maxUsersInStatus: parseInt(process.env.MAX_USERS_IN_STATUS) || 10,
      enableDetailedStatus: process.env.ENABLE_DETAILED_STATUS === "true",
      memoryWarningThreshold: parseInt(process.env.MEMORY_WARNING_MB) || 400,
      ...this.config,
    };

    // 📊 시스템 통계
    this.systemStats = {
      startTime: Date.now(),
      totalCallbacks: 0,
      totalMessages: 0,
      totalErrors: 0,
      lastActivity: null,
      systemChecks: 0,
    };

    logger.info("🏠 SystemModule v3.0.1 생성됨 (완전 수정판)");
  }

  /**
   * 🎯 시스템 모듈 초기화
   */
  async onInitialize() {
    try {
      logger.info("🎯 SystemModule 초기화 시작...");

      // 기본 시스템 체크
      await this.performBasicSystemCheck();

      logger.success("✅ SystemModule 초기화 완료");
    } catch (error) {
      logger.error("❌ SystemModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 설정 (필수 메서드!)
   */
  setupActions() {
    this.registerActions({
      // 📋 메인 메뉴 관련
      menu: this.handleMenuAction.bind(this),
      start: this.handleStartAction.bind(this),

      // ❓ 도움말 관련
      help: this.handleHelpAction.bind(this),

      // 📊 상태 관련
      status: this.handleStatusAction.bind(this),

      // ⚙️ 설정 관련
      settings: this.handleSettingsAction.bind(this),
      about: this.handleAboutAction.bind(this),

      // 📖 추가 기능
      version: this.handleVersionAction.bind(this),
      uptime: this.handleUptimeAction.bind(this),
    });

    logger.debug("🏠 SystemModule 액션 등록 완료");
  }

  // ===== 🎯 액션 핸들러들 =====

  /**
   * 🏠 메인 메뉴 액션
   */
  async handleMenuAction(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;
      const userName = getUserName(callbackQuery);

      const menuData = await this.getMainMenuData(moduleManager);
      const menuText = this.buildMainMenuText(userName, menuData);
      const keyboard = this.buildMainMenuKeyboard(menuData);

      await this.editMessage(bot, chatId, messageId, menuText, {
        reply_markup: keyboard,
      });

      // 📊 통계 업데이트
      this.systemStats.totalCallbacks++;
      this.systemStats.lastActivity = TimeHelper.getTimestamp();

      return true;
    } catch (error) {
      logger.error("❌ SystemModule 메인 메뉴 액션 실패:", error);
      return false;
    }
  }

  /**
   * 🚀 시작 액션 (메뉴와 동일)
   */
  async handleStartAction(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    return await this.handleMenuAction(
      bot,
      callbackQuery,
      subAction,
      params,
      moduleManager
    );
  }

  /**
   * ❓ 도움말 액션
   */
  async handleHelpAction(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;

      const helpText = this.buildHelpText();
      const keyboard = this.buildHelpKeyboard();

      await this.editMessage(bot, chatId, messageId, helpText, {
        reply_markup: keyboard,
      });

      this.systemStats.totalCallbacks++;
      return true;
    } catch (error) {
      logger.error("❌ SystemModule 도움말 액션 실패:", error);
      return false;
    }
  }

  /**
   * 📊 상태 액션
   */
  async handleStatusAction(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    try {
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;

      const statusData = await this.getSystemStatusData(moduleManager);
      const statusText = this.buildStatusText(statusData);
      const keyboard = this.buildStatusKeyboard();

      await this.editMessage(bot, chatId, messageId, statusText, {
        reply_markup: keyboard,
      });

      this.systemStats.totalCallbacks++;
      return true;
    } catch (error) {
      logger.error("❌ SystemModule 상태 액션 실패:", error);
      return false;
    }
  }

  /**
   * ⚙️ 설정 액션
   */
  async handleSettingsAction(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    try {
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;

      const settingsText = `⚙️ **시스템 설정**

📱 **현재 설정:**
• 버전: ${this.config.version}
• 환경: ${this.config.environment}
• Railway: ${this.config.isRailway ? "✅" : "❌"}
• 봇 이름: ${this.config.botName}

🔧 **설정 가능 항목:**
• 상세 상태 표시: ${this.config.enableDetailedStatus ? "활성" : "비활성"}
• 메모리 경고 임계값: ${this.config.memoryWarningThreshold}MB

⚠️ 설정 변경 기능은 곧 업데이트될 예정입니다.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📊 상태", callback_data: "system:status" },
            { text: "ℹ️ 정보", callback_data: "system:about" },
          ],
          [{ text: "🔙 메인 메뉴", callback_data: "system:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, settingsText, {
        reply_markup: keyboard,
      });

      this.systemStats.totalCallbacks++;
      return true;
    } catch (error) {
      logger.error("❌ SystemModule 설정 액션 실패:", error);
      return false;
    }
  }

  /**
   * ℹ️ 정보 액션
   */
  async handleAboutAction(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    try {
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;

      const aboutText = `ℹ️ **${this.config.botName} 정보**

📱 **버전**: ${this.config.version}
🏗️ **아키텍처**: 모듈화 설계
🚀 **플랫폼**: ${this.config.isRailway ? "Railway" : "Local"}
⚡ **런타임**: Node.js ${process.version}

🔹 **특징**:
• 모듈화된 구조로 확장 가능
• Railway 환경 최적화
• 실시간 상태 모니터링
• 표준화된 매개변수 체계

🔹 **지원 기능**:
• 할일 관리, 타이머, 근무시간 추적
• 휴가 관리, 리마인더, 날씨 정보
• 음성 변환(TTS), 운세

👨‍💻 **개발자**: 두목`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📱 버전", callback_data: "system:version" },
            { text: "⏰ 업타임", callback_data: "system:uptime" },
          ],
          [{ text: "🔙 메인 메뉴", callback_data: "system:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, aboutText, {
        reply_markup: keyboard,
      });

      this.systemStats.totalCallbacks++;
      return true;
    } catch (error) {
      logger.error("❌ SystemModule 정보 액션 실패:", error);
      return false;
    }
  }

  /**
   * 📱 버전 액션
   */
  async handleVersionAction(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    try {
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;

      const versionText = `📱 **버전 정보**

🤖 **봇 버전**: ${this.config.version}
🟢 **Node.js**: ${process.version}
⚡ **V8 엔진**: ${process.versions.v8}
🔧 **OpenSSL**: ${process.versions.openssl}

📊 **시스템**:
• 플랫폼: ${process.platform}
• 아키텍처: ${process.arch}
• 메모리 사용량: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB

🚀 **환경**:
• 모드: ${this.config.environment}
• Railway: ${this.config.isRailway ? "✅" : "❌"}`;

      const keyboard = {
        inline_keyboard: [[{ text: "🔙 정보", callback_data: "system:about" }]],
      };

      await this.editMessage(bot, chatId, messageId, versionText, {
        reply_markup: keyboard,
      });

      this.systemStats.totalCallbacks++;
      return true;
    } catch (error) {
      logger.error("❌ SystemModule 버전 액션 실패:", error);
      return false;
    }
  }

  /**
   * ⏰ 업타임 액션
   */
  async handleUptimeAction(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    try {
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;

      const uptime = this.getUptime();
      const systemUptime = this.formatUptime(process.uptime());

      const uptimeText = `⏰ **가동 시간 정보**

🤖 **봇 가동 시간**: ${uptime}
💻 **시스템 가동 시간**: ${systemUptime}

📊 **활동 통계**:
• 처리한 콜백: ${this.systemStats.totalCallbacks}개
• 처리한 메시지: ${this.systemStats.totalMessages}개
• 시스템 체크: ${this.systemStats.systemChecks}회
• 마지막 활동: ${this.systemStats.lastActivity || "없음"}

🕐 **시작 시간**: ${TimeHelper.format(
        new Date(this.systemStats.startTime),
        "full"
      )}`;

      const keyboard = {
        inline_keyboard: [[{ text: "🔙 정보", callback_data: "system:about" }]],
      };

      await this.editMessage(bot, chatId, messageId, uptimeText, {
        reply_markup: keyboard,
      });

      this.systemStats.totalCallbacks++;
      return true;
    } catch (error) {
      logger.error("❌ SystemModule 업타임 액션 실패:", error);
      return false;
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 📊 기본 시스템 체크
   */
  async performBasicSystemCheck() {
    try {
      // 메모리 체크
      const memoryUsage = process.memoryUsage();
      const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);

      if (memoryMB > this.config.memoryWarningThreshold) {
        logger.warn(`⚠️ 메모리 사용량 높음: ${memoryMB}MB`);
      }

      // Railway 환경 체크
      if (this.config.isRailway) {
        logger.info("🚂 Railway 환경에서 실행 중");
      }

      this.systemStats.systemChecks++;
      logger.debug("✅ 기본 시스템 체크 완료");
    } catch (error) {
      logger.warn("⚠️ 시스템 체크 중 오류:", error);
    }
  }

  /**
   * 🏠 메인 메뉴 데이터 생성
   */
  async getMainMenuData(moduleManager) {
    try {
      const activeModules = [];
      const inactiveModules = [];

      if (moduleManager && typeof moduleManager.getModuleList === "function") {
        const moduleList = moduleManager.getModuleList();

        for (const module of moduleList) {
          if (module.key === "system") continue; // 시스템 모듈 제외

          const moduleInfo = {
            key: module.key,
            name: module.name,
            emoji: this.getModuleEmoji(module.key),
            active: module.active && module.initialized,
          };

          if (moduleInfo.active) {
            activeModules.push(moduleInfo);
          } else {
            inactiveModules.push({
              ...moduleInfo,
              reason: module.initError || "초기화 실패",
            });
          }
        }
      }

      return {
        activeModules,
        inactiveModules,
        systemInfo: {
          version: this.config.version,
          environment: this.config.environment,
          uptime: this.getUptime(),
        },
        stats: {
          totalModules: activeModules.length + inactiveModules.length,
          activeModules: activeModules.length,
          failedModules: inactiveModules.length,
        },
      };
    } catch (error) {
      logger.error("❌ 메인 메뉴 데이터 생성 실패:", error);
      return {
        activeModules: [],
        inactiveModules: [],
        systemInfo: {
          version: this.config.version,
          environment: "오류 상태",
          uptime: "알 수 없음",
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
   * 📱 모듈 이모지 반환
   */
  getModuleEmoji(moduleKey) {
    const emojiMap = {
      todo: "📝",
      timer: "⏰",
      worktime: "🕐",
      leave: "🏖️",
      reminder: "🔔",
      fortune: "🔮",
      weather: "🌤️",
      tts: "🎤",
    };

    return emojiMap[moduleKey] || "📦";
  }

  /**
   * 📝 메인 메뉴 텍스트 구성
   */
  buildMainMenuText(userName, menuData) {
    let menuText = `🤖 **두목봇 v${menuData.systemInfo.version}**

👋 안녕하세요, **${userName}**님!

📊 **시스템 현황**
• 🟢 활성 모듈: ${menuData.stats.activeModules}개
• ⏱️ 가동 시간: ${menuData.systemInfo.uptime}
• 🌍 환경: ${menuData.systemInfo.environment}`;

    if (menuData.activeModules.length > 0) {
      const moduleList = menuData.activeModules
        .slice(0, 3)
        .map((m) => `${m.emoji} ${m.name}`)
        .join(", ");

      menuText += `\n\n**🎯 주요 기능:** ${moduleList}`;

      if (menuData.activeModules.length > 3) {
        menuText += ` 외 ${menuData.activeModules.length - 3}개`;
      }
    }

    if (menuData.stats.failedModules > 0) {
      menuText += `\n• ⚪ 비활성 모듈: ${menuData.stats.failedModules}개`;
    }

    menuText += `\n\n원하는 기능을 선택해주세요!`;

    return menuText;
  }

  /**
   * ⌨️ 메인 메뉴 키보드 구성
   */
  buildMainMenuKeyboard(menuData) {
    const keyboard = [];
    const activeModules = menuData.activeModules;

    // 활성 모듈들을 2개씩 묶어서 행 생성
    for (let i = 0; i < activeModules.length; i += 2) {
      const row = [];

      // 첫 번째 모듈
      const module1 = activeModules[i];
      row.push({
        text: `${module1.emoji} ${module1.name}`,
        callback_data: `${module1.key}:menu`,
      });

      // 두 번째 모듈 (있으면)
      if (i + 1 < activeModules.length) {
        const module2 = activeModules[i + 1];
        row.push({
          text: `${module2.emoji} ${module2.name}`,
          callback_data: `${module2.key}:menu`,
        });
      }

      keyboard.push(row);
    }

    // 시스템 메뉴
    keyboard.push([
      { text: "📊 시스템 상태", callback_data: "system:status" },
      { text: "❓ 도움말", callback_data: "system:help" },
    ]);

    keyboard.push([
      { text: "⚙️ 설정", callback_data: "system:settings" },
      { text: "ℹ️ 정보", callback_data: "system:about" },
    ]);

    return { inline_keyboard: keyboard };
  }

  /**
   * ❓ 도움말 텍스트 구성
   */
  buildHelpText() {
    return `❓ **도움말**

🔹 **기본 명령어:**
• \`/start\` - 봇 시작
• \`/menu\` - 메인 메뉴
• \`/help\` - 도움말
• \`/status\` - 시스템 상태
• \`/cancel\` - 작업 취소

🔹 **주요 기능:**
• 📝 **할일 관리** - 업무 목록 관리
• ⏰ **타이머** - 집중 시간 측정
• 🕐 **근무시간** - 출퇴근 기록
• 🏖️ **휴가 관리** - 연차/월차 관리

🔹 **사용 팁:**
• 메뉴 버튼을 통해 편리하게 이용하세요
• 작업 중 \`/cancel\`로 언제든 취소 가능
• 문제 발생 시 \`/start\`로 초기화

더 자세한 정보는 각 기능의 도움말을 확인하세요!`;
  }

  /**
   * ⌨️ 도움말 키보드 구성
   */
  buildHelpKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "📝 할일", callback_data: "todo:help" },
          { text: "⏰ 타이머", callback_data: "timer:help" },
        ],
        [
          { text: "📊 상태", callback_data: "system:status" },
          { text: "🏠 메인", callback_data: "system:menu" },
        ],
      ],
    };
  }

  /**
   * 📊 시스템 상태 데이터 수집
   */
  async getSystemStatusData(moduleManager) {
    try {
      const memoryUsage = process.memoryUsage();
      const uptime = this.getUptime();

      return {
        version: this.config.version,
        environment: this.config.environment,
        uptime,
        memoryUsage,
        systemStats: this.systemStats,
        moduleStats: moduleManager ? moduleManager.getStatus() : null,
      };
    } catch (error) {
      logger.error("❌ 시스템 상태 데이터 수집 실패:", error);
      return {
        version: this.config.version,
        environment: "오류 상태",
        uptime: "알 수 없음",
        memoryUsage: process.memoryUsage(),
        systemStats: this.systemStats,
        moduleStats: null,
      };
    }
  }

  /**
   * 📝 시스템 상태 텍스트 구성
   */
  buildStatusText(statusData) {
    const memoryMB = Math.round(statusData.memoryUsage.heapUsed / 1024 / 1024);

    return `📊 **시스템 상태**

🔹 **기본 정보**
• 버전: ${statusData.version}
• 환경: ${statusData.environment}
• 업타임: ${statusData.uptime}

🔹 **성능 지표**
• 메모리 사용량: ${memoryMB}MB
• 처리한 콜백: ${statusData.systemStats.totalCallbacks}개
• 처리한 메시지: ${statusData.systemStats.totalMessages}개
• 에러 발생: ${statusData.systemStats.totalErrors}개

🔹 **모듈 정보**
${
  statusData.moduleStats
    ? `• 전체: ${statusData.moduleStats.totalModules}개\n• 활성: ${statusData.moduleStats.activeModules}개\n• 실패: ${statusData.moduleStats.failedModules}개`
    : "• 모듈 매니저 연결 안됨"
}

🔹 **Railway 정보**
• Railway 환경: ${this.config.isRailway ? "✅" : "❌"}
• 마지막 활동: ${statusData.systemStats.lastActivity || "없음"}

시스템이 정상적으로 작동 중입니다! 🟢`;
  }

  /**
   * ⌨️ 상태 키보드 구성
   */
  buildStatusKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "🔄 새로고침", callback_data: "system:status" },
          { text: "📱 버전", callback_data: "system:version" },
        ],
        [{ text: "🔙 메인 메뉴", callback_data: "system:menu" }],
      ],
    };
  }

  /**
   * ⏰ 업타임 계산
   */
  getUptime() {
    return this.formatUptime((Date.now() - this.systemStats.startTime) / 1000);
  }

  /**
   * ⏰ 업타임 포맷팅
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
   * 📊 상태 조회 (BaseModule 오버라이드)
   */
  getStatus() {
    return {
      ...super.getStatus(),
      systemInfo: {
        version: this.config.version,
        environment: this.config.environment,
        isRailway: this.config.isRailway,
        uptime: this.getUptime(),
      },
      systemStats: this.systemStats,
    };
  }

  // ===== 📬 명령어 처리 메서드들 (호환성) =====

  /**
   * 🏠 메인 메뉴 전송 (명령어용)
   */
  async sendMainMenu(bot, chatId, userName) {
    try {
      const menuData = await this.getMainMenuData(this.moduleManager);
      const menuText = this.buildMainMenuText(userName, menuData);
      const keyboard = this.buildMainMenuKeyboard(menuData);

      await bot.sendMessage(chatId, menuText, {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });

      this.systemStats.totalMessages++;
      this.systemStats.lastActivity = TimeHelper.getTimestamp();
    } catch (error) {
      logger.error("❌ SystemModule 메인 메뉴 전송 실패:", error);
      throw error;
    }
  }

  /**
   * ❓ 도움말 전송 (명령어용)
   */
  async sendHelp(bot, chatId) {
    try {
      const helpText = this.buildHelpText();
      const keyboard = this.buildHelpKeyboard();

      await bot.sendMessage(chatId, helpText, {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });

      this.systemStats.totalMessages++;
    } catch (error) {
      logger.error("❌ SystemModule 도움말 전송 실패:", error);
      throw error;
    }
  }

  /**
   * 📊 상태 전송 (명령어용)
   */
  async sendStatus(bot, chatId) {
    try {
      const statusData = await this.getSystemStatusData(this.moduleManager);
      const statusText = this.buildStatusText(statusData);
      const keyboard = this.buildStatusKeyboard();

      await bot.sendMessage(chatId, statusText, {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });

      this.systemStats.totalMessages++;
    } catch (error) {
      logger.error("❌ SystemModule 상태 전송 실패:", error);
      throw error;
    }
  }
}

module.exports = SystemModule;
