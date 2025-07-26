// src/modules/FortuneModule.js - 표준 구조 수정 v3.0.1
const BaseModule = require("../core/BaseModule");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName, getUserId } = require("../utils/UserHelper");
const logger = require("../utils/Logger");

/**
 * 🔮 FortuneModule v3.0.1 - 운세 모듈
 *
 * 🎯 주요 수정사항:
 * - FortuneService에서 직접 생성하지 않고 ServiceBuilder 사용
 * - 모든 운세 데이터는 FortuneService에 위임
 * - 인라인 키보드 제거
 * - 표준 매개변수 체계 준수
 */
class FortuneModule extends BaseModule {
  constructor(bot, options = {}) {
    super("FortuneModule", {
      bot,
      serviceBuilder: options.serviceBuilder,
      moduleManager: options.moduleManager,
      moduleKey: options.moduleKey,
      moduleConfig: options.moduleConfig,
      config: options.config,
    });

    // 🔧 서비스 인스턴스 (onInitialize에서 직접 생성)
    this.fortuneService = null;

    // Railway 환경변수 기반 설정
    this.config = {
      enableDetailedReading: process.env.FORTUNE_DETAILED === "true",
      maxReadingsPerDay: parseInt(process.env.FORTUNE_MAX_PER_DAY) || 3,
      enableTarot: process.env.FORTUNE_TAROT_ENABLED !== "false",
      ...this.config,
    };

    logger.info("🔮 FortuneModule v3.0.1 생성됨");
  }

  /**
   * 🎯 모듈 초기화
   */
  async onInitialize() {
    try {
      logger.info("🔮 FortuneModule 초기화 시작...");

      // FortuneService 직접 생성 (DB 사용 안함)
      const FortuneService = require("../services/FortuneService");
      this.fortuneService = new FortuneService();

      logger.success("✅ FortuneModule 초기화 완료");
    } catch (error) {
      logger.error("❌ FortuneModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 설정
   */
  setupActions() {
    this.registerActions({
      // 메인
      menu: this.showMenu,

      // 운세 카테고리
      general: this.showGeneralFortune,
      work: this.showWorkFortune,
      love: this.showLoveFortune,
      money: this.showMoneyFortune,
      health: this.showHealthFortune,
      meeting: this.showMeetingFortune,

      // 타로
      tarot: this.showTarotMenu,
      oneTarot: this.showOneTarot,
      threeTarot: this.showThreeTarot,

      // 기타
      lucky: this.showLuckyInfo,
      all: this.showAllFortune,
      help: this.showHelp,
    });
  }

  /**
   * 🎯 메인 메뉴 (네비게이션 핸들러가 키보드 관리)
   */
  async showMenu(bot, callbackQuery, params, moduleManager) {
    try {
      const userName = getUserName(callbackQuery);
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const today = TimeHelper.format(new Date(), "dateOnly");

      const menuText = `🔮 **운세**

${userName}님, 오늘의 운세를 확인해보세요!

📅 ${today}

운세를 확인하려면 아래 명령어를 사용하세요:
• 종합운세 보기
• 업무운 보기  
• 연애운 보기
• 금전운 보기
• 건강운 보기
• 회식운 보기
• 타로카드 보기
• 행운 정보 보기`;

      await this.editMessage(bot, chatId, messageId, menuText);
      return true;
    } catch (error) {
      logger.error("FortuneModule 메뉴 표시 오류:", error);
      await this.sendError(bot, callbackQuery, "메뉴를 표시할 수 없습니다.");
      return false;
    }
  }

  /**
   * 🌟 종합운세
   */
  async showGeneralFortune(bot, callbackQuery, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);
      const userName = getUserName(callbackQuery);
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      // FortuneService에서 운세 가져오기
      const fortune = this.fortuneService.getFortune(userId, "general");

      const fortuneText = `🌟 **${userName}님의 오늘 종합운세**

${fortune}

_운세는 재미로 봐주세요! 오늘도 좋은 하루 되세요_ ✨`;

      await this.editMessage(bot, chatId, messageId, fortuneText);
      return true;
    } catch (error) {
      logger.error("FortuneModule 종합운세 표시 오류:", error);
      await this.sendError(bot, callbackQuery, "운세를 표시할 수 없습니다.");
      return false;
    }
  }

  /**
   * 💼 업무운
   */
  async showWorkFortune(bot, callbackQuery, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);
      const userName = getUserName(callbackQuery);
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const fortune = this.fortuneService.getFortune(userId, "work");

      const fortuneText = `💼 **${userName}님의 오늘 업무운**

${fortune}`;

      await this.editMessage(bot, chatId, messageId, fortuneText);
      return true;
    } catch (error) {
      logger.error("FortuneModule 업무운 표시 오류:", error);
      await this.sendError(bot, callbackQuery, "운세를 표시할 수 없습니다.");
      return false;
    }
  }

  /**
   * 💕 연애운
   */
  async showLoveFortune(bot, callbackQuery, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);
      const userName = getUserName(callbackQuery);
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const fortune = this.fortuneService.getFortune(userId, "love");

      const fortuneText = `💕 **${userName}님의 오늘 연애운**

${fortune}`;

      await this.editMessage(bot, chatId, messageId, fortuneText);
      return true;
    } catch (error) {
      logger.error("FortuneModule 연애운 표시 오류:", error);
      await this.sendError(bot, callbackQuery, "운세를 표시할 수 없습니다.");
      return false;
    }
  }

  /**
   * 💰 금전운
   */
  async showMoneyFortune(bot, callbackQuery, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);
      const userName = getUserName(callbackQuery);
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const fortune = this.fortuneService.getFortune(userId, "money");

      const fortuneText = `💰 **${userName}님의 오늘 금전운**

${fortune}`;

      await this.editMessage(bot, chatId, messageId, fortuneText);
      return true;
    } catch (error) {
      logger.error("FortuneModule 금전운 표시 오류:", error);
      await this.sendError(bot, callbackQuery, "운세를 표시할 수 없습니다.");
      return false;
    }
  }

  /**
   * 🏃 건강운
   */
  async showHealthFortune(bot, callbackQuery, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);
      const userName = getUserName(callbackQuery);
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const fortune = this.fortuneService.getFortune(userId, "health");

      const fortuneText = `🏃 **${userName}님의 오늘 건강운**

${fortune}`;

      await this.editMessage(bot, chatId, messageId, fortuneText);
      return true;
    } catch (error) {
      logger.error("FortuneModule 건강운 표시 오류:", error);
      await this.sendError(bot, callbackQuery, "운세를 표시할 수 없습니다.");
      return false;
    }
  }

  /**
   * 🍻 회식운
   */
  async showMeetingFortune(bot, callbackQuery, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);
      const userName = getUserName(callbackQuery);
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const fortune = this.fortuneService.getFortune(userId, "meeting");

      const fortuneText = `🍻 **${userName}님의 오늘 회식운**

${fortune}`;

      await this.editMessage(bot, chatId, messageId, fortuneText);
      return true;
    } catch (error) {
      logger.error("FortuneModule 회식운 표시 오류:", error);
      await this.sendError(bot, callbackQuery, "운세를 표시할 수 없습니다.");
      return false;
    }
  }

  /**
   * 🎴 타로 메뉴
   */
  async showTarotMenu(bot, callbackQuery, params, moduleManager) {
    try {
      const userName = getUserName(callbackQuery);
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const menuText = `🎴 **타로카드**

${userName}님, 타로카드로 운명을 확인해보세요.

타로 점술 방법:
• 1 타로 - 오늘의 카드 한 장
• 3 타로 - 과거, 현재, 미래

마음을 집중하고 선택해주세요.`;

      await this.editMessage(bot, chatId, messageId, menuText);
      return true;
    } catch (error) {
      logger.error("FortuneModule 타로 메뉴 오류:", error);
      await this.sendError(bot, callbackQuery, "메뉴를 표시할 수 없습니다.");
      return false;
    }
  }

  /**
   * 🃏 한장 타로
   */
  async showOneTarot(bot, callbackQuery, params, moduleManager) {
    try {
      const userName = getUserName(callbackQuery);
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      // FortuneService에서 타로카드 가져오기
      const tarot = this.fortuneService.getTarotCard();

      const tarotText = `🃏 **${userName}님의 타로카드**

${tarot}

_카드의 메시지를 깊이 생각해보세요_ 🔮`;

      await this.editMessage(bot, chatId, messageId, tarotText);
      return true;
    } catch (error) {
      logger.error("FortuneModule 한장 타로 오류:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "타로카드를 표시할 수 없습니다."
      );
      return false;
    }
  }

  /**
   * ✨ 세장 타로
   */
  async showThreeTarot(bot, callbackQuery, params, moduleManager) {
    try {
      const userName = getUserName(callbackQuery);
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      // FortuneService에서 3장 스프레드 가져오기
      const spread = this.fortuneService.getTarot3Spread();

      const tarotText = `✨ **${userName}님의 세장 타로**

${spread}

_과거를 이해하고, 현재를 인식하며, 미래를 준비하세요_ 🌟`;

      await this.editMessage(bot, chatId, messageId, tarotText);
      return true;
    } catch (error) {
      logger.error("FortuneModule 세장 타로 오류:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "타로카드를 표시할 수 없습니다."
      );
      return false;
    }
  }

  /**
   * 🍀 행운 정보
   */
  async showLuckyInfo(bot, callbackQuery, params, moduleManager) {
    try {
      const userName = getUserName(callbackQuery);
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      // FortuneService에서 행운 정보 가져오기
      const luckyInfo = this.fortuneService.getLuckyInfo(userName);

      await this.editMessage(bot, chatId, messageId, luckyInfo);
      return true;
    } catch (error) {
      logger.error("FortuneModule 행운 정보 오류:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "행운 정보를 표시할 수 없습니다."
      );
      return false;
    }
  }

  /**
   * 🔮 전체 운세
   */
  async showAllFortune(bot, callbackQuery, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);
      const userName = getUserName(callbackQuery);
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      // FortuneService에서 전체 운세 가져오기
      const allFortune = this.fortuneService.getAllFortune(userId, userName);

      await this.editMessage(bot, chatId, messageId, allFortune);
      return true;
    } catch (error) {
      logger.error("FortuneModule 전체 운세 오류:", error);
      await this.sendError(bot, callbackQuery, "운세를 표시할 수 없습니다.");
      return false;
    }
  }

  /**
   * ❓ 도움말
   */
  async showHelp(bot, callbackQuery, params, moduleManager) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const helpText = `🔮 **운세 도움말**

**사용 가능한 운세:**
• 종합운세 - 오늘의 전반적인 운세
• 업무운 - 직장과 일에 대한 운세
• 연애운 - 사랑과 관계에 대한 운세
• 금전운 - 재물과 돈에 대한 운세
• 건강운 - 건강과 활력에 대한 운세
• 회식운 - 모임과 술자리 운세

**타로카드:**
• 1 타로 - 오늘의 메시지
• 3 타로 - 과거-현재-미래

**기타 정보:**
• 행운 정보 - 색상, 숫자, 아이템 등
• 전체 운세 - 모든 운세 한번에 보기

💡 운세는 재미로 봐주시고, 긍정적인 마음으로 하루를 시작하세요!`;

      await this.editMessage(bot, chatId, messageId, helpText);
      return true;
    } catch (error) {
      logger.error("FortuneModule 도움말 오류:", error);
      await this.sendError(bot, callbackQuery, "도움말을 표시할 수 없습니다.");
      return false;
    }
  }

  /**
   * 📨 메시지 처리 (텍스트 명령)
   */
  async onHandleMessage(bot, msg) {
    try {
      const text = msg.text?.toLowerCase() || "";
      const userId = getUserId(msg);
      const userName = getUserName(msg);
      const chatId = msg.chat.id;

      // 운세 관련 키워드 확인
      if (!this.isFortuneRelated(text)) {
        return false;
      }

      // 종합운세
      if (text.includes("종합") || text.includes("전체")) {
        const fortune = this.fortuneService.getFortune(userId, "general");
        await bot.sendMessage(
          chatId,
          `🌟 **${userName}님의 오늘 종합운세**\n\n${fortune}`,
          { parse_mode: "Markdown" }
        );
        return true;
      }

      // 업무운
      if (
        text.includes("업무") ||
        text.includes("직장") ||
        text.includes("일")
      ) {
        const fortune = this.fortuneService.getFortune(userId, "work");
        await bot.sendMessage(
          chatId,
          `💼 **${userName}님의 오늘 업무운**\n\n${fortune}`,
          { parse_mode: "Markdown" }
        );
        return true;
      }

      // 연애운
      if (text.includes("연애") || text.includes("사랑")) {
        const fortune = this.fortuneService.getFortune(userId, "love");
        await bot.sendMessage(
          chatId,
          `💕 **${userName}님의 오늘 연애운**\n\n${fortune}`,
          { parse_mode: "Markdown" }
        );
        return true;
      }

      // 금전운
      if (
        text.includes("금전") ||
        text.includes("돈") ||
        text.includes("재물")
      ) {
        const fortune = this.fortuneService.getFortune(userId, "money");
        await bot.sendMessage(
          chatId,
          `💰 **${userName}님의 오늘 금전운**\n\n${fortune}`,
          { parse_mode: "Markdown" }
        );
        return true;
      }

      // 타로
      if (text.includes("타로")) {
        const tarot = this.fortuneService.getTarotCard();
        await bot.sendMessage(
          chatId,
          `🃏 **${userName}님의 타로카드**\n\n${tarot}`,
          { parse_mode: "Markdown" }
        );
        return true;
      }

      // 기본 운세 안내
      await bot.sendMessage(
        chatId,
        `🔮 운세를 보려면 구체적으로 말씀해주세요.\n\n예시: "오늘 종합운세", "업무운 알려줘", "타로카드 뽑아줘"`,
        { parse_mode: "Markdown" }
      );

      return true;
    } catch (error) {
      logger.error("FortuneModule 메시지 처리 오류:", error);
      return false;
    }
  }

  /**
   * 운세 관련 텍스트인지 확인
   */
  isFortuneRelated(text) {
    const keywords = [
      "운세",
      "타로",
      "점",
      "오늘운세",
      "내운세",
      "종합운",
      "업무운",
      "연애운",
      "금전운",
      "건강운",
      "회식운",
      "행운",
      "카드",
      "점술",
      "운명",
    ];

    return keywords.some((keyword) => text.includes(keyword));
  }
}

module.exports = FortuneModule;
