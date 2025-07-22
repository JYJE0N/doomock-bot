const BaseModule = require("./BaseModule");
const InsightService = require("../services/InsightService");
const { getUserName } = require("../utils/UserHelper");
const logger = require("../utils/Logger");

class InsightModule extends BaseModule {
  constructor() {
    super("insight"); // 부모 생성자 호출
    this.insightService = new InsightService();
  }
  // ✅ BaseModule 표준 액션 등록
  setupActions() {
    this.registerActions({
      menu: this.showInsightMenu,
      full: this.showFullInsight,
      quick: this.showQuickInsight,
      dashboard: this.showDashboard,
      products: this.showProductStrategy,
      pricing: this.showPricingStrategy,
      inventory: this.showInventoryStrategy,
      marketing: this.showMarketingStrategy,
      regional: this.showRegionalStrategy,
      competitor: this.showCompetitorStrategy,
      national: this.showNationalStatus,
      refresh: this.showFullInsight,
    });
    this.insightService = new InsightService();
  }

  async handleMessage(bot, msg) {
    const { text } = msg;
    if (text && text.startsWith("/insight")) {
      await this.handleInsightCommand(bot, msg);
      return true;
    }
    return false;
  }

  async handleCommand(bot, msg, command, args) {
    return await this.handleInsightCommand(bot, msg);
  }

  async handleCallback(bot, callbackQuery, subAction, params, menuManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;
    const userName = getUserName(from);

    try {
      switch (subAction) {
        case "menu":
          return await this.showInsightMenu(bot, chatId, messageId, userName);
        case "full":
          return await this.showFullInsight(bot, chatId, messageId, from);
        case "quick":
          return await this.showQuickInsight(bot, chatId, messageId, from);
        case "dashboard":
          return await this.showDashboard(bot, chatId, messageId, from);
        case "products":
          return await this.showProductStrategy(bot, chatId, messageId, from);
        case "pricing":
          return await this.showPricingStrategy(bot, chatId, messageId, from);
        case "inventory":
          return await this.showInventoryStrategy(bot, chatId, messageId, from);
        case "marketing":
          return await this.showMarketingStrategy(bot, chatId, messageId, from);
        case "regional":
          return await this.showRegionalStrategy(bot, chatId, messageId, from);
        case "competitor":
          return await this.showCompetitorStrategy(
            bot,
            chatId,
            messageId,
            from
          );
        case "national":
          return await this.showNationalStatus(bot, chatId, messageId, from);
        case "refresh":
          return await this.showFullInsight(bot, chatId, messageId, from);
        default:
          await this.sendMessage(
            bot,
            chatId,
            "❌ 알 수 없는 인사이트 명령입니다."
          );
          return false;
      }
    } catch (error) {
      logger.error(`InsightModule 콜백 오류 (${subAction}):`, error);
      await this.sendErrorMessage(bot, chatId, messageId);
      return false;
    }
  }

  async handleInsightCommand(bot, msg) {
    const {
      chat: { id: chatId },
      from,
    } = msg;
    const userName = getUserName(from);

    await this.showInsightMenu(bot, chatId, null, userName);
  }

  async showInsightMenu(bot, chatId, messageId, userName) {
    const menuText =
      `📊 **${userName}님의 인사이트**\n\n` +
      `마케팅 전략과 비즈니스 인사이트를 제공합니다.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📊 종합 인사이트", callback_data: "insight:full" },
          { text: "⚡ 빠른 인사이트", callback_data: "insight:quick" },
        ],
        [
          { text: "📱 대시보드", callback_data: "insight:dashboard" },
          { text: "🗺️ 전국 현황", callback_data: "insight:national" },
        ],
        [
          { text: "🎁 제품 전략", callback_data: "insight:products" },
          { text: "💰 가격 전략", callback_data: "insight:pricing" },
        ],
        [
          { text: "📦 재고 전략", callback_data: "insight:inventory" },
          { text: "🎯 마케팅", callback_data: "insight:marketing" },
        ],
        [{ text: "🔙 메인 메뉴", callback_data: "main:menu" }],
      ],
    };

    if (messageId) {
      await this.editMessage(bot, chatId, messageId, menuText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } else {
      await this.sendMessage(bot, chatId, menuText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    }
  }

  async showFullInsight(bot, chatId, messageId, from) {
    try {
      const userName = getUserName(from);
      const insights = await this.insightService.generateFullInsight(userName);

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📱 대시보드", callback_data: "insight:dashboard" },
            { text: "🗺️ 전국 현황", callback_data: "insight:national" },
          ],
          [
            { text: "🔄 새로고침", callback_data: "insight:refresh" },
            { text: "🔙 메인 메뉴", callback_data: "main:menu" },
          ],
        ],
      };

      await this.editMessage(bot, chatId, messageId, insights, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      await this.sendMessage(
        bot,
        chatId,
        `❌ 인사이트 생성 실패: ${error.message}`
      );
    }
  }

  async showQuickInsight(bot, chatId, messageId, from) {
    const userName = getUserName(from);
    const insight = await this.insightService.generateQuickInsight(userName);
    const keyboard = {
      inline_keyboard: [
        [
          { text: "📊 종합 인사이트", callback_data: "insight:full" },
          { text: "📱 대시보드", callback_data: "insight:dashboard" },
        ],
        [{ text: "🔙 메인 메뉴", callback_data: "main:menu" }],
      ],
    };

    if (messageId) {
      await this.editMessage(bot, chatId, messageId, insight, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } else {
      await this.sendMessage(bot, chatId, insight, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    }
  }

  async showDashboard(bot, chatId, messageId, from) {
    const userName = getUserName(from);
    const dashboard = await this.insightService.generateDashboard(userName);
    await this.sendMessage(bot, chatId, dashboard, {
      parse_mode: "Markdown",
    });
  }

  async showProductStrategy(bot, chatId, messageId, from) {
    const strategy = await this.insightService.generateProductStrategy(
      getUserName(from)
    );
    await this.editMessage(bot, chatId, messageId, strategy, {
      parse_mode: "Markdown",
    });
  }

  async showPricingStrategy(bot, chatId, messageId, from) {
    const strategy = await this.insightService.generatePricingStrategy(
      getUserName(from)
    );
    await this.editMessage(bot, chatId, messageId, strategy, {
      parse_mode: "Markdown",
    });
  }

  async showInventoryStrategy(bot, chatId, messageId, from) {
    const strategy = await this.insightService.generateInventoryStrategy(
      getUserName(from)
    );
    await this.editMessage(bot, chatId, messageId, strategy, {
      parse_mode: "Markdown",
    });
  }

  async showMarketingStrategy(bot, chatId, messageId, from) {
    const strategy = await this.insightService.generateMarketingStrategy(
      getUserName(from)
    );
    await this.editMessage(bot, chatId, messageId, strategy, {
      parse_mode: "Markdown",
    });
  }

  async showRegionalStrategy(bot, chatId, messageId, from) {
    const strategy = await this.insightService.generateRegionalStrategy(
      getUserName(from)
    );
    await this.editMessage(bot, chatId, messageId, strategy, {
      parse_mode: "Markdown",
    });
  }

  async showCompetitorStrategy(bot, chatId, messageId, from) {
    const strategy = await this.insightService.generateCompetitorStrategy(
      getUserName(from)
    );
    await this.editMessage(bot, chatId, messageId, strategy, {
      parse_mode: "Markdown",
    });
  }

  async showNationalStatus(bot, chatId, messageId, from) {
    const status = await this.insightService.generateNationalStatus(
      getUserName(from)
    );
    await this.sendMessage(bot, chatId, status, {
      parse_mode: "Markdown",
    });
  }

  async showInsightHelp(bot, chatId) {
    const helpText =
      "📊 *인사이트 명령어 목록*\n\n" +
      "/insight - 종합 인사이트\n" +
      "/insight quick - 빠른 인사이트\n" +
      "/insight national - 전국 현황\n\n" +
      "*마스크 산업 특화 전략도 포함됩니다.*";

    await this.sendMessage(bot, chatId, helpText, {
      parse_mode: "Markdown",
    });
  }
}

module.exports = InsightModule;
