// src/modules/SystemModuleV2.js
class SystemModuleV2 {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.setupListeners();
  }

  setupListeners() {
    // 시스템 상태 요청 이벤트 구독
    this.eventBus.subscribe("system:status:request", async (event) => {
      const status = await this.getSystemStatus();

      // 응답 이벤트 발행
      this.eventBus.publish("render:message", {
        chatId: event.payload.chatId,
        text: this.formatStatus(status),
        parseMode: "Markdown"
      });
    });

    // 도움말 요청 이벤트 구독
    this.eventBus.subscribe("system:help:request", async (event) => {
      const helpText = this.getHelpText();

      this.eventBus.publish("render:message", {
        chatId: event.payload.chatId,
        text: helpText,
        keyboard: this.getHelpKeyboard()
      });
    });
  }

  async getSystemStatus() {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();

    return {
      memory: Math.round(memUsage.heapUsed / 1024 / 1024),
      uptime: Math.round(uptime / 60),
      version: "4.0.1",
      environment: process.env.NODE_ENV
    };
  }

  formatStatus(status) {
    return (
      `🖥️ *시스템 상태*\n\n` +
      `📊 메모리: ${status.memory} MB\n` +
      `⏱️ 가동시간: ${status.uptime} 분\n` +
      `🏷️ 버전: ${status.version}\n` +
      `🌍 환경: ${status.environment}`
    );
  }
}

module.exports = SystemModuleV2;
