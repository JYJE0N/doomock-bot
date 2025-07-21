const BaseModule = require("./BaseModule");
const InsightService = require("../services/InsightService");
const { getUserName } = require("../utils/UserHelper");

// ✅ 새로운 해결책 (logger를 함수로 가져오기)
const logger = require("../utils/Logger");

class InsightModule extends BaseModule {
  constructor() {
    super("InsightModule");
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

  async handleCallback(bot, callbackQuery) {
    const data = callbackQuery.data;
    const action = data.split("_")[1] || "menu";
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;
    const userName = getUserName(from);

    switch (action) {
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
        return await this.showCompetitorStrategy(bot, chatId, messageId, from);
      case "national":
        return await this.showNationalStatus(bot, chatId, messageId, from);
      case "refresh":
        return await this.showFullInsight(bot, chatId, messageId, from);
      default:
        return await this.sendMessage(
          bot,
          chatId,
          "❌ 알 수 없는 인사이트 명령입니다."
        );
    }
  }

  async handleInsightCommand(bot, msg) {
    const {
      text,
      chat: { id: chatId },
      from,
    } = msg;

    if (text === "/insight" || text === "/인사이트") {
      return await this.showFullInsight(bot, chatId, null, from);
    } else if (text === "/insight quick") {
      return await this.showQuickInsight(bot, chatId, null, from);
    } else if (text === "/insight national") {
      return await this.showNationalStatus(bot, chatId, null, from);
    } else {
      return await this.showInsightHelp(bot, chatId);
    }
  }

  async showInsightMenu(bot, chatId, messageId, userName) {
    const message = `📊 *${userName}님의 인사이트 메뉴*`;
    const keyboard = {
      inline_keyboard: [
        [
          { text: "📈 종합 인사이트", callback_data: "insight_full" },
          { text: "⚡ 빠른 인사이트", callback_data: "insight_quick" },
        ],
        [
          { text: "📱 대시보드", callback_data: "insight_dashboard" },
          { text: "🗺️ 전국 현황", callback_data: "insight_national" },
        ],
        [{ text: "🔙 메인 메뉴", callback_data: "main:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, message, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  async showFullInsight(bot, chatId, messageId, from) {
    try {
      const userName = getUserName(from);
      const insights = await this.insightService.generateFullInsight(userName);
      const keyboard = {
        inline_keyboard: [
          [
            { text: "🎁 제품 전략", callback_data: "insight_products" },
            { text: "💰 가격 전략", callback_data: "insight_pricing" },
          ],
          [
            { text: "📦 재고 전략", callback_data: "insight_inventory" },
            { text: "🎯 마케팅 전략", callback_data: "insight_marketing" },
          ],
          [
            { text: "🏙️ 지역 전략", callback_data: "insight_regional" },
            { text: "⚔️ 경쟁사 분석", callback_data: "insight_competitor" },
          ],
          [
            { text: "📱 대시보드", callback_data: "insight_dashboard" },
            { text: "🗺️ 전국 현황", callback_data: "insight_national" },
          ],
          [
            { text: "🔄 새로고침", callback_data: "insight_refresh" },
            { text: "🔙 메인 메뉴", callback_data: "main:menu" },
          ],
        ],
      };

      if (messageId) {
        await this.editMessage(bot, chatId, messageId, insights, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      } else {
        await this.sendMessage(bot, chatId, insights, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      }
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
          { text: "📊 종합 인사이트", callback_data: "insight_full" },
          { text: "📱 대시보드", callback_data: "insight_dashboard" },
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
