// src/adapters/LegacyBridge.js
class LegacyBridge {
  constructor(eventBus, component) {
    this.eventBus = eventBus;
    this.component = component;
    this.setupBridge();
  }

  setupBridge() {
    // 기존 메서드 호출을 이벤트로 변환
    const originalMethods = {};

    // NavigationHandler 예시
    if (this.component.constructor.name === "NavigationHandler") {
      // showMainMenu 메서드를 이벤트 기반으로 변환
      originalMethods.showMainMenu = this.component.showMainMenu.bind(
        this.component
      );

      this.component.showMainMenu = async (ctx) => {
        // 이벤트 발행
        this.eventBus.publish("render:menu", {
          type: "main",
          userId: ctx.from.id,
          chatId: ctx.chat.id
        });

        // 기존 메서드도 실행 (점진적 마이그레이션)
        return originalMethods.showMainMenu(ctx);
      };

      // handleCallback 메서드 브릿징
      originalMethods.handleCallback = this.component.handleCallback.bind(
        this.component
      );

      this.component.handleCallback = async (ctx) => {
        const data = ctx.callbackQuery.data;

        // 이벤트로 변환
        this.eventBus.publish("user:callback", {
          data,
          userId: ctx.from.id,
          messageId: ctx.callbackQuery.message.message_id
        });

        // 기존 처리도 실행
        return originalMethods.handleCallback(ctx);
      };
    }

    // CommandHandler 브릿징
    if (this.component.constructor.name === "CommandHandler") {
      originalMethods.handleTextMessage = this.component.handleTextMessage.bind(
        this.component
      );

      this.component.handleTextMessage = async (bot, msg) => {
        // 자연어 처리를 이벤트로
        if (this.component.isDoomockCall(msg.text)) {
          this.eventBus.publish("user:natural", {
            text: msg.text,
            userId: msg.from.id,
            chatId: msg.chat.id
          });
        }

        return originalMethods.handleTextMessage(bot, msg);
      };
    }
  }
}

module.exports = LegacyBridge;
