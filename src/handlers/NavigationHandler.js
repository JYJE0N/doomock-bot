// src/handlers/NavigationHandler.js - 키보드 생성 통합 v3.0.1
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");

/**
 * 🎹 NavigationHandler v3.0.1 - 모든 UI 책임 통합
 *
 * 🎯 핵심 책임:
 * - 모든 인라인키보드 생성
 * - 메시지 편집/전송
 * - 시스템 네비게이션 처리
 * - SystemModule과 데이터 연동
 * - 일관성 있는 UI 제공
 */
class NavigationHandler {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.moduleManager = options.moduleManager;
    this.commandsRegistry = options.commandsRegistry;

    // 🎨 UI 테마 설정
    this.uiThemes = {
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
      keyboardsGenerated: 0,
      messagesEdited: 0,
      errorsCount: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
    };

    logger.info("🎹 NavigationHandler v3.0.1 생성됨 (UI 통합)");
  }

  /**
   * 🎯 네비게이션 처리 (핵심 메서드)
   */
  async handleNavigation(bot, callbackQuery) {
    const startTime = Date.now();

    try {
      // 콜백 데이터 파싱
      const { moduleKey, action, params } = this.parseCallbackData(
        callbackQuery.data
      );

      logger.debug(
        `🎹 네비게이션: ${moduleKey}.${action}(${params.join(", ")})`
      );

      // 시스템 네비게이션 (직접 처리)
      if (moduleKey === "system" || moduleKey === "main") {
        return await this.handleSystemNavigation(
          bot,
          callbackQuery,
          action,
          params
        );
      }

      // 모듈 네비게이션 (ModuleManager로 위임)
      if (this.moduleManager && this.moduleManager.hasModule(moduleKey)) {
        const moduleInstance = this.moduleManager.getModule(moduleKey);

        if (moduleInstance && moduleInstance.handleCallback) {
          const handled = await moduleInstance.handleCallback(
            bot,
            callbackQuery,
            action,
            params,
            this.moduleManager
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

      await this.showNavigationError(
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
   * 🏛️ 시스템 네비게이션 처리 (수정됨)
   */
  async handleSystemNavigation(bot, callbackQuery, action, params) {
    logger.debug(`🏛️ 시스템 네비게이션: ${action}`);

    try {
      // ✅ 수정: "system" 키로 모듈 확인
      if (this.moduleManager && this.moduleManager.hasModule("system")) {
        const systemModule = this.moduleManager.getModule("system");

        if (systemModule && systemModule.handleCallback) {
          logger.debug(`🔄 SystemModule로 데이터 요청: ${action}`);

          // SystemModule에서 데이터 받기
          const result = await systemModule.handleCallback(
            bot,
            callbackQuery,
            action,
            params,
            this.moduleManager
          );

          if (result && result.success) {
            // 데이터 타입에 따라 UI 생성 및 표시
            return await this.renderSystemUI(bot, callbackQuery, result.data);
          }
        }
      }

      // ✅ 폴백: SystemModule이 없으면 직접 처리
      logger.warn("⚠️ SystemModule이 없음 - NavigationHandler에서 직접 처리");

      switch (action) {
        case "menu":
        case "start":
          return await this.showFallbackMainMenu(bot, callbackQuery);

        case "help":
          return await this.showFallbackHelp(bot, callbackQuery);

        case "status":
          return await this.showFallbackStatus(bot, callbackQuery);

        default:
          logger.warn(`❓ 알 수 없는 시스템 액션: ${action}`);
          await this.showUnknownAction(bot, callbackQuery, action);
          return false;
      }
    } catch (error) {
      logger.error("❌ 시스템 네비게이션 처리 오류:", error);
      await this.showNavigationError(
        bot,
        callbackQuery,
        "시스템 메뉴 처리 중 오류가 발생했습니다."
      );
      return false;
    }
  }

  /**
   * 🎨 시스템 UI 렌더링 (SystemModule 데이터 기반)
   */
  async renderSystemUI(bot, callbackQuery, data) {
    try {
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;

      let text, keyboard;

      switch (data.type) {
        case "main_menu":
          text = this.buildMainMenuText(data.userName, data.menuData);
          keyboard = this.createMainMenuKeyboard(data.menuData.activeModules);
          break;

        case "help":
          text = this.buildHelpText(data.helpContent);
          keyboard = this.createHelpKeyboard(data.availableModules);
          break;

        case "status":
          text = this.buildStatusText(data.statusInfo);
          keyboard = this.createStatusKeyboard();
          break;

        case "settings":
          text = this.buildSettingsText(
            data.currentSettings,
            data.availableSettings
          );
          keyboard = this.createSettingsKeyboard(data.availableSettings);
          break;

        case "about":
          text = this.buildAboutText(data.aboutInfo);
          keyboard = this.createAboutKeyboard();
          break;

        case "version":
          text = this.buildVersionText(data.versionInfo);
          keyboard = this.createVersionKeyboard();
          break;

        case "uptime":
          text = this.buildUptimeText(data.uptimeInfo);
          keyboard = this.createUptimeKeyboard();
          break;

        default:
          logger.warn(`❓ 알 수 없는 데이터 타입: ${data.type}`);
          return false;
      }

      // 메시지 편집
      await this.editMessage(bot, chatId, messageId, text, {
        reply_markup: keyboard,
      });

      this.stats.keyboardsGenerated++;
      this.stats.messagesEdited++;
      return true;
    } catch (error) {
      logger.error("❌ 시스템 UI 렌더링 실패:", error);
      return false;
    }
  }

  // ===== 🎨 텍스트 생성 메서드들 =====

  /**
   * 🏠 메인 메뉴 텍스트 구성
   */
  buildMainMenuText(userName, menuData) {
    let text = `🤖 **두목봇 v${menuData.systemInfo.version}**

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

      text += `\n\n**🎯 주요 기능:** ${moduleList}`;

      if (menuData.activeModules.length > 3) {
        text += ` 외 ${menuData.activeModules.length - 3}개`;
      }
    }

    if (menuData.stats.failedModules > 0) {
      text += `\n• ⚪ 비활성 모듈: ${menuData.stats.failedModules}개`;
    }

    text += `\n\n원하는 기능을 선택해주세요!`;
    return text;
  }

  /**
   * ❓ 도움말 텍스트 구성
   */
  buildHelpText(helpContent) {
    let text = `${helpContent.title}

🔹 **기본 명령어:**`;

    helpContent.basicCommands.forEach((cmd) => {
      text += `\n• \`${cmd.command}\` - ${cmd.description}`;
    });

    text += `\n\n🔹 **주요 기능:**`;
    helpContent.mainFeatures.forEach((feature) => {
      text += `\n• ${feature.emoji} **${feature.name}** - ${feature.description}`;
    });

    text += `\n\n🔹 **사용 팁:**`;
    helpContent.tips.forEach((tip) => {
      text += `\n• ${tip}`;
    });

    text += `\n\n더 자세한 정보는 각 기능의 도움말을 확인하세요!`;
    return text;
  }

  /**
   * 📊 상태 텍스트 구성
   */
  buildStatusText(statusInfo) {
    const memoryMB = statusInfo.performance.memoryUsageMB;

    let text = `📊 **시스템 상태**

🔹 **기본 정보**
• 버전: ${statusInfo.basicInfo.version}
• 환경: ${statusInfo.basicInfo.environment}
• 업타임: ${statusInfo.basicInfo.uptime}

🔹 **성능 지표**
• 메모리 사용량: ${memoryMB}MB
• 처리한 콜백: ${statusInfo.performance.totalCallbacks}개
• 처리한 메시지: ${statusInfo.performance.totalMessages}개
• 에러 발생: ${statusInfo.performance.totalErrors}개

🔹 **모듈 정보**`;

    if (statusInfo.moduleInfo) {
      text += `\n• 전체: ${statusInfo.moduleInfo.totalModules}개`;
      text += `\n• 활성: ${statusInfo.moduleInfo.activeModules}개`;
      text += `\n• 실패: ${statusInfo.moduleInfo.failedModules}개`;
    } else {
      text += `\n• 모듈 매니저 연결 안됨`;
    }

    text += `\n\n🔹 **Railway 정보**
• Railway 환경: ${statusInfo.basicInfo.isRailway ? "✅" : "❌"}
• 마지막 활동: ${statusInfo.lastActivity || "없음"}

시스템이 정상적으로 작동 중입니다! 🟢`;

    return text;
  }

  /**
   * ⚙️ 설정 텍스트 구성
   */
  buildSettingsText(currentSettings, availableSettings) {
    let text = `⚙️ **시스템 설정**

📱 **현재 설정:**
• 버전: ${currentSettings.version}
• 환경: ${currentSettings.environment}
• Railway: ${currentSettings.isRailway ? "✅" : "❌"}
• 봇 이름: ${currentSettings.botName}

🔧 **설정 가능 항목:**`;

    availableSettings.forEach((setting) => {
      const status = setting.current ? "활성" : "비활성";
      text += `\n• ${setting.name}: ${status}`;
      if (setting.unit) {
        text += ` (${setting.current}${setting.unit})`;
      }
    });

    text += `\n\n⚠️ 설정 변경 기능은 곧 업데이트될 예정입니다.`;
    return text;
  }

  /**
   * ℹ️ 정보 텍스트 구성
   */
  buildAboutText(aboutInfo) {
    let text = `ℹ️ **${aboutInfo.botName} 정보**

📱 **버전**: ${aboutInfo.version}
🏗️ **아키텍처**: ${aboutInfo.architecture}
🚀 **플랫폼**: ${aboutInfo.platform}
⚡ **런타임**: ${aboutInfo.runtime}

🔹 **특징**:`;

    aboutInfo.features.forEach((feature) => {
      text += `\n• ${feature}`;
    });

    text += `\n\n🔹 **지원 기능**:`;
    aboutInfo.supportedModules.forEach((module) => {
      text += `\n• ${module}`;
    });

    text += `\n\n👨‍💻 **개발자**: ${aboutInfo.developer}`;
    return text;
  }

  /**
   * 📱 버전 텍스트 구성
   */
  buildVersionText(versionInfo) {
    return `📱 **버전 정보**

🤖 **봇 버전**: ${versionInfo.botVersion}
🟢 **Node.js**: ${versionInfo.nodeVersion}
⚡ **V8 엔진**: ${versionInfo.v8Version}
🔧 **OpenSSL**: ${versionInfo.opensslVersion}

📊 **시스템**:
• 플랫폼: ${versionInfo.platform}
• 아키텍처: ${versionInfo.architecture}
• 메모리 사용량: ${versionInfo.memoryUsageMB}MB

🚀 **환경**:
• 모드: ${versionInfo.environment}
• Railway: ${versionInfo.isRailway ? "✅" : "❌"}`;
  }

  /**
   * ⏰ 업타임 텍스트 구성
   */
  buildUptimeText(uptimeInfo) {
    return `⏰ **가동 시간 정보**

🤖 **봇 가동 시간**: ${uptimeInfo.botUptime}
💻 **시스템 가동 시간**: ${uptimeInfo.systemUptime}

📊 **활동 통계**:
• 처리한 콜백: ${uptimeInfo.activityStats.totalCallbacks}개
• 처리한 메시지: ${uptimeInfo.activityStats.totalMessages}개
• 시스템 체크: ${uptimeInfo.activityStats.systemChecks}회
• 마지막 활동: ${uptimeInfo.activityStats.lastActivity || "없음"}

🕐 **시작 시간**: ${TimeHelper.format(uptimeInfo.startTime, "full")}`;
  }

  // ===== ⌨️ 키보드 생성 메서드들 =====

  /**
   * 🏠 메인 메뉴 키보드 생성
   */
  createMainMenuKeyboard(activeModules = []) {
    try {
      const keyboard = [];

      // 활성 모듈들을 2개씩 묶어서 행 생성
      for (let i = 0; i < activeModules.length; i += 2) {
        const row = [];

        // 첫 번째 모듈
        const module1 = activeModules[i];
        if (module1) {
          row.push({
            text: `${module1.emoji} ${module1.name}`,
            callback_data: `${module1.key}:menu`,
          });
        }

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

      this.stats.keyboardsGenerated++;
      return { inline_keyboard: keyboard };
    } catch (error) {
      logger.error("❌ 메인 메뉴 키보드 생성 실패:", error);
      return this.createFallbackKeyboard();
    }
  }

  /**
   * ❓ 도움말 키보드 생성
   */
  createHelpKeyboard(availableModules = []) {
    try {
      const keyboard = [];

      // 활성 모듈들의 도움말 버튼 생성 (최대 4개)
      const activeModules = availableModules
        .filter((m) => m.active)
        .slice(0, 4);

      for (let i = 0; i < activeModules.length; i += 2) {
        const row = [];

        const module1 = activeModules[i];
        if (module1) {
          row.push({
            text: `${module1.emoji} ${module1.name}`,
            callback_data: `${module1.key}:help`,
          });
        }

        if (i + 1 < activeModules.length) {
          const module2 = activeModules[i + 1];
          row.push({
            text: `${module2.emoji} ${module2.name}`,
            callback_data: `${module2.key}:help`,
          });
        }

        keyboard.push(row);
      }

      // 시스템 메뉴
      keyboard.push([
        { text: "📊 상태", callback_data: "system:status" },
        { text: "🏠 메인", callback_data: "system:menu" },
      ]);

      this.stats.keyboardsGenerated++;
      return { inline_keyboard: keyboard };
    } catch (error) {
      logger.error("❌ 도움말 키보드 생성 실패:", error);
      return this.createBasicNavigationKeyboard();
    }
  }

  /**
   * 📊 상태 키보드 생성
   */
  createStatusKeyboard() {
    try {
      this.stats.keyboardsGenerated++;
      return {
        inline_keyboard: [
          [
            { text: "🔄 새로고침", callback_data: "system:status" },
            { text: "📱 버전", callback_data: "system:version" },
          ],
          [{ text: "🔙 메인 메뉴", callback_data: "system:menu" }],
        ],
      };
    } catch (error) {
      logger.error("❌ 상태 키보드 생성 실패:", error);
      return this.createBasicNavigationKeyboard();
    }
  }

  /**
   * ⚙️ 설정 키보드 생성
   */
  createSettingsKeyboard(availableSettings = []) {
    try {
      const keyboard = [];

      // 설정 항목들 (최대 6개까지 표시)
      const displaySettings = availableSettings.slice(0, 6);

      for (const setting of displaySettings) {
        keyboard.push([
          {
            text: `${setting.current ? "✅" : "❌"} ${setting.name}`,
            callback_data: `system:setting:${setting.key}`,
          },
        ]);
      }

      // 하단 네비게이션
      keyboard.push([
        { text: "📊 상태", callback_data: "system:status" },
        { text: "ℹ️ 정보", callback_data: "system:about" },
      ]);

      keyboard.push([{ text: "🔙 메인 메뉴", callback_data: "system:menu" }]);

      this.stats.keyboardsGenerated++;
      return { inline_keyboard: keyboard };
    } catch (error) {
      logger.error("❌ 설정 키보드 생성 실패:", error);
      return this.createBasicNavigationKeyboard();
    }
  }

  /**
   * ℹ️ 정보 키보드 생성
   */
  createAboutKeyboard() {
    try {
      this.stats.keyboardsGenerated++;
      return {
        inline_keyboard: [
          [
            { text: "📱 버전", callback_data: "system:version" },
            { text: "⏰ 업타임", callback_data: "system:uptime" },
          ],
          [
            { text: "⚙️ 설정", callback_data: "system:settings" },
            { text: "📊 상태", callback_data: "system:status" },
          ],
          [{ text: "🔙 메인 메뉴", callback_data: "system:menu" }],
        ],
      };
    } catch (error) {
      logger.error("❌ 정보 키보드 생성 실패:", error);
      return this.createBasicNavigationKeyboard();
    }
  }

  /**
   * 📱 버전 키보드 생성
   */
  createVersionKeyboard() {
    this.stats.keyboardsGenerated++;
    return {
      inline_keyboard: [[{ text: "🔙 정보", callback_data: "system:about" }]],
    };
  }

  /**
   * ⏰ 업타임 키보드 생성
   */
  createUptimeKeyboard() {
    this.stats.keyboardsGenerated++;
    return {
      inline_keyboard: [[{ text: "🔙 정보", callback_data: "system:about" }]],
    };
  }

  /**
   * 🔙 기본 네비게이션 키보드 생성
   */
  createBasicNavigationKeyboard(options = {}) {
    const keyboard = [];

    // 기본 네비게이션
    if (options.showBack !== false) {
      keyboard.push([
        { text: "🔙 뒤로", callback_data: options.backAction || "system:menu" },
      ]);
    }

    // 홈 버튼
    if (options.showHome !== false) {
      keyboard.push([{ text: "🏠 메인 메뉴", callback_data: "system:menu" }]);
    }

    this.stats.keyboardsGenerated++;
    return { inline_keyboard: keyboard };
  }

  /**
   * 🛡️ 폴백 키보드 생성 (오류 시 사용)
   */
  createFallbackKeyboard() {
    this.stats.keyboardsGenerated++;
    return {
      inline_keyboard: [
        [
          { text: "📊 상태", callback_data: "system:status" },
          { text: "❓ 도움말", callback_data: "system:help" },
        ],
        [{ text: "🔄 다시 시도", callback_data: "system:menu" }],
      ],
    };
  }

  // ===== 🛡️ 폴백 메서드들 =====

  /**
   * 🏠 폴백 메인 메뉴 (SystemModule이 없을 때)
   */
  async showFallbackMainMenu(bot, callbackQuery) {
    try {
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;
      const userName = getUserName(callbackQuery);

      const menuText = `🤖 **두목봇 v3.0.1**

👋 안녕하세요, **${userName}**님!

⚠️ 시스템이 초기화 중입니다.
잠시 후 다시 시도해주세요.

📊 **현재 상태:**
• 모듈 로딩 중...
• 서비스 연결 중...

🔄 자동으로 복구를 시도하고 있습니다.`;

      const keyboard = this.createFallbackKeyboard();

      await this.editMessage(bot, chatId, messageId, menuText, {
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("❌ 폴백 메인 메뉴 오류:", error);
      return false;
    }
  }

  /**
   * ❓ 폴백 도움말 (SystemModule이 없을 때)
   */
  async showFallbackHelp(bot, callbackQuery) {
    try {
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;

      const helpText = `❓ **도움말** (제한 모드)

⚠️ 시스템이 완전히 로드되지 않아 기본 도움말만 표시됩니다.

🔹 **기본 명령어:**
• \`/start\` - 봇 시작
• \`/help\` - 도움말
• \`/status\` - 시스템 상태

🔧 **문제 해결:**
• 잠시 후 다시 시도해주세요
• /start 명령어로 재시작
• 문제가 지속되면 관리자에게 문의

시스템이 복구되면 모든 기능을 사용하실 수 있습니다.`;

      const keyboard = this.createBasicNavigationKeyboard();

      await this.editMessage(bot, chatId, messageId, helpText, {
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("❌ 폴백 도움말 오류:", error);
      return false;
    }
  }

  /**
   * 📊 폴백 상태 (SystemModule이 없을 때)
   */
  async showFallbackStatus(bot, callbackQuery) {
    try {
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;

      const memoryMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

      const statusText = `📊 **시스템 상태** (제한 모드)

⚠️ **현재 상태**: 부분적 작동
🔧 **문제**: SystemModule 연결 실패

🔹 **기본 정보**
• Node.js: ${process.version}
• 메모리: ${memoryMB}MB
• 플랫폼: ${process.platform}

🔹 **복구 시도**
• 자동 복구 진행 중...
• 잠시 후 다시 확인해주세요

관리자가 문제를 해결하고 있습니다.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 다시 확인", callback_data: "system:status" },
            { text: "🏠 메인", callback_data: "system:menu" },
          ],
        ],
      };

      await this.editMessage(bot, chatId, messageId, statusText, {
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("❌ 폴백 상태 오류:", error);
      return false;
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 📝 콜백 데이터 파싱
   */
  parseCallbackData(callbackData) {
    try {
      const parts = callbackData.split(":");
      const moduleKey = parts[0] || "";
      const action = parts[1] || "";
      const params = parts.slice(2) || [];

      return { moduleKey, action, params };
    } catch (error) {
      logger.error("❌ 콜백 데이터 파싱 실패:", error);
      return { moduleKey: "", action: "", params: [] };
    }
  }

  /**
   * ✏️ 메시지 편집
   */
  async editMessage(bot, chatId, messageId, text, options = {}) {
    try {
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
        ...options,
      });

      this.stats.messagesEdited++;
    } catch (error) {
      // 메시지가 변경되지 않은 경우는 무시
      if (!error.message.includes("message is not modified")) {
        logger.error("❌ 메시지 편집 실패:", error);
        throw error;
      }
    }
  }

  /**
   * ❓ 알 수 없는 네비게이션 처리
   */
  async handleUnknownNavigation(bot, callbackQuery, moduleKey, action) {
    logger.warn(`❓ 처리되지 않은 콜백: ${moduleKey}:${action}`);

    try {
      await this.showNavigationError(
        bot,
        callbackQuery,
        `알 수 없는 기능입니다: ${moduleKey}:${action}`
      );
    } catch (error) {
      logger.error("❌ 알 수 없는 네비게이션 처리 실패:", error);
    }
  }

  /**
   * ❌ 네비게이션 에러 표시
   */
  async showNavigationError(bot, callbackQuery, errorMessage) {
    try {
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;

      const errorText = `❌ **오류 발생**

${errorMessage}

🔧 **해결 방법:**
• 잠시 후 다시 시도해주세요
• 메인 메뉴에서 다시 시작
• 문제가 지속되면 /start 입력

죄송합니다. 곧 해결하겠습니다.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 다시 시도", callback_data: "system:menu" },
            { text: "🏠 메인", callback_data: "system:menu" },
          ],
        ],
      };

      await this.editMessage(bot, chatId, messageId, errorText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("❌ 네비게이션 에러 표시 실패:", error);
    }
  }

  /**
   * ❓ 알 수 없는 액션 표시
   */
  async showUnknownAction(bot, callbackQuery, action) {
    await this.showNavigationError(
      bot,
      callbackQuery,
      `알 수 없는 액션: ${action}`
    );
  }

  /**
   * 📊 응답 시간 통계 업데이트
   */
  updateResponseTimeStats(responseTime) {
    this.stats.totalResponseTime += responseTime;
    this.stats.averageResponseTime = Math.round(
      this.stats.totalResponseTime / Math.max(this.stats.navigationsHandled, 1)
    );
  }

  /**
   * 📊 상태 조회
   */
  getStatus() {
    return {
      ...this.stats,
      isReady: !!this.moduleManager,
      moduleManagerConnected: !!this.moduleManager,
      lastActivity: TimeHelper.getTimestamp(),
    };
  }

  // ===== 📬 CommandHandler 전용 메서드들 =====

  /**
   * 🏠 메인 메뉴 표시 (CommandHandler에서 호출)
   */
  async showMainMenuFromCommand(bot, chatId, userName) {
    try {
      // SystemModule에서 데이터 수집
      let menuData;

      if (this.moduleManager && this.moduleManager.hasModule("system")) {
        const systemModule = this.moduleManager.getModule("system");
        const result = await systemModule.collectMainMenuData(
          this.moduleManager
        );
        menuData = result || this.getFallbackMenuData();
      } else {
        menuData = this.getFallbackMenuData();
      }

      // 텍스트 및 키보드 생성
      const text = this.buildMainMenuText(userName, menuData);
      const keyboard = this.createMainMenuKeyboard(menuData.activeModules);

      // 메시지 전송
      await bot.sendMessage(chatId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      this.stats.keyboardsGenerated++;
      logger.info(`🏠 메인 메뉴 전송 완료: ${userName}`);
    } catch (error) {
      logger.error("❌ 메인 메뉴 표시 실패:", error);

      // 폴백 메시지
      await bot.sendMessage(
        chatId,
        `👋 안녕하세요, ${userName}님!\n\n🤖 두목봇 v3.0.1에 오신 것을 환영합니다.\n\n메뉴를 불러오는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.`
      );
    }
  }

  /**
   * ❓ 도움말 표시 (CommandHandler에서 호출)
   */
  async showHelpFromCommand(bot, chatId) {
    try {
      // SystemModule에서 도움말 데이터 수집
      let helpContent;

      if (this.moduleManager && this.moduleManager.hasModule("system")) {
        const systemModule = this.moduleManager.getModule("system");
        helpContent = systemModule.buildHelpContent();
      } else {
        helpContent = this.getFallbackHelpContent();
      }

      // 사용 가능한 모듈 목록 수집
      const availableModules = this.getAvailableModules();

      // 텍스트 및 키보드 생성
      const text = this.buildHelpText(helpContent);
      const keyboard = this.createHelpKeyboard(availableModules);

      // 메시지 전송
      await bot.sendMessage(chatId, text, {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
        reply_markup: keyboard,
      });

      this.stats.keyboardsGenerated++;
      logger.info("❓ 도움말 전송 완료");
    } catch (error) {
      logger.error("❌ 도움말 표시 실패:", error);

      // 폴백 메시지
      await bot.sendMessage(chatId, this.getBasicHelpText());
    }
  }

  /**
   * 📊 상태 표시 (CommandHandler에서 호출)
   */
  async showStatusFromCommand(bot, chatId) {
    try {
      // SystemModule에서 상태 데이터 수집
      let statusInfo;

      if (this.moduleManager && this.moduleManager.hasModule("system")) {
        const systemModule = this.moduleManager.getModule("system");
        statusInfo = await systemModule.collectSystemStatus(this.moduleManager);
      } else {
        statusInfo = this.getFallbackStatusInfo();
      }

      // 텍스트 및 키보드 생성
      const text = this.buildStatusText(statusInfo);
      const keyboard = this.createStatusKeyboard();

      // 메시지 전송
      await bot.sendMessage(chatId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      this.stats.keyboardsGenerated++;
      logger.info("📊 상태 정보 전송 완료");
    } catch (error) {
      logger.error("❌ 상태 표시 실패:", error);

      // 폴백 메시지
      await bot.sendMessage(chatId, this.getBasicStatusText());
    }
  }

  // ===== 🛡️ 폴백 데이터 메서드들 =====

  /**
   * 🛡️ 폴백 메뉴 데이터
   */
  getFallbackMenuData() {
    return {
      activeModules: [
        { key: "todo", name: "할일 관리", emoji: "📝", priority: 2 },
        { key: "timer", name: "타이머", emoji: "⏰", priority: 3 },
      ],
      inactiveModules: [],
      systemInfo: {
        version: "3.0.1",
        environment: "제한 모드",
        uptime: "알 수 없음",
      },
      stats: {
        totalModules: 2,
        activeModules: 2,
        failedModules: 0,
      },
    };
  }

  /**
   * 🛡️ 폴백 도움말 콘텐츠
   */
  getFallbackHelpContent() {
    return {
      title: "❓ 도움말",
      basicCommands: [
        { command: "/start", description: "봇 시작" },
        { command: "/help", description: "도움말" },
        { command: "/status", description: "시스템 상태" },
        { command: "/cancel", description: "작업 취소" },
      ],
      mainFeatures: [
        { emoji: "📝", name: "할일 관리", description: "업무 목록 관리" },
        { emoji: "⏰", name: "타이머", description: "집중 시간 측정" },
      ],
      tips: [
        "메뉴 버튼을 통해 편리하게 이용하세요",
        "문제 발생 시 /start로 초기화",
      ],
    };
  }

  /**
   * 🛡️ 폴백 상태 정보
   */
  getFallbackStatusInfo() {
    return {
      basicInfo: {
        version: "3.0.1",
        environment: "제한 모드",
        uptime: this.formatUptime(process.uptime()),
        isRailway: !!process.env.RAILWAY_ENVIRONMENT,
      },
      performance: {
        memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        totalCallbacks: this.stats.navigationsHandled,
        totalMessages: this.stats.messagesEdited,
        totalErrors: this.stats.errorsCount,
      },
      moduleInfo: null,
      lastActivity: TimeHelper.getTimestamp(),
    };
  }

  /**
   * 📋 사용 가능한 모듈 목록
   */
  getAvailableModules() {
    const modules = [];

    if (this.moduleManager && this.moduleManager.getModuleList) {
      try {
        const moduleList = this.moduleManager.getModuleList();

        for (const module of moduleList) {
          if (module.key !== "system") {
            modules.push({
              key: module.key,
              name: module.name,
              active: module.active && module.initialized,
              emoji: this.getModuleEmoji(module.key),
            });
          }
        }
      } catch (error) {
        logger.warn("모듈 목록 수집 실패:", error);
      }
    }

    // 폴백 모듈들
    if (modules.length === 0) {
      modules.push(
        { key: "todo", name: "할일 관리", active: false, emoji: "📝" },
        { key: "timer", name: "타이머", active: false, emoji: "⏰" }
      );
    }

    return modules;
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
   * 📖 기본 도움말 텍스트
   */
  getBasicHelpText() {
    return `📖 **두목봇 도움말**

**기본 명령어:**
• \`/start\` - 봇 시작
• \`/help\` - 도움말
• \`/status\` - 상태 확인
• \`/cancel\` - 작업 취소

**모듈 명령어:**
• \`/todo\` - 할일 관리
• \`/timer\` - 타이머

더 자세한 정보는 /start 명령어로 메인 메뉴를 확인하세요.`;
  }

  /**
   * 📊 기본 상태 텍스트
   */
  getBasicStatusText() {
    const memoryMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    const uptime = this.formatUptime(process.uptime());

    return `📊 **시스템 상태**

**기본 정보**
• 상태: 제한 모드
• 가동시간: ${uptime}
• 메모리: ${memoryMB}MB
• 환경: ${process.env.RAILWAY_ENVIRONMENT ? "Railway" : "Local"}

**NavigationHandler 통계**
• 처리된 네비게이션: ${this.stats.navigationsHandled}개
• 생성된 키보드: ${this.stats.keyboardsGenerated}개
• 편집된 메시지: ${this.stats.messagesEdited}개

마지막 업데이트: ${TimeHelper.getTimestamp()}`;
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
   * 🧹 정리
   */
  async cleanup() {
    try {
      // 통계 초기화
      this.stats = {
        navigationsHandled: 0,
        keyboardsGenerated: 0,
        messagesEdited: 0,
        errorsCount: 0,
        averageResponseTime: 0,
        totalResponseTime: 0,
      };

      logger.info("✅ NavigationHandler 정리 완료");
    } catch (error) {
      logger.error("❌ NavigationHandler 정리 실패:", error);
    }
  }
}

module.exports = NavigationHandler;
