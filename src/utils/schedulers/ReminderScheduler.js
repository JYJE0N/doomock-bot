const logger = require("../core/Logger");

class ReminderScheduler {
  constructor(options = {}) {
    this.bot = options.bot;
    this.reminderService = options.reminderService;
    this.isRunning = false;
    this.intervalId = null;
    
    logger.info("📅 ReminderScheduler 생성됨");
  }

  async start() {
    if (this.isRunning) {
      logger.warn("⚠️ ReminderScheduler 이미 실행 중");
      return;
    }

    try {
      this.isRunning = true;
      
      // 30초마다 체크 (나중에 설정 가능하도록)
      this.intervalId = setInterval(() => {
        this.checkReminders().catch(error => {
          logger.error("ReminderScheduler 체크 실패:", error);
        });
      }, 30000);

      logger.success("✅ ReminderScheduler 시작됨");
    } catch (error) {
      logger.error("❌ ReminderScheduler 시작 실패:", error);
      this.isRunning = false;
      throw error;
    }
  }

  async checkReminders() {
    if (!this.reminderService || !this.bot) {
      return;
    }

    try {
      // 기본적인 리마인더 체크 로직
      // 실제 구현은 필요에 따라 추가
      logger.debug("📋 리마인더 체크 중...");
    } catch (error) {
      logger.error("리마인더 체크 실패:", error);
    }
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }

    try {
      this.isRunning = false;
      
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }

      logger.success("✅ ReminderScheduler 정지됨");
    } catch (error) {
      logger.error("❌ ReminderScheduler 정지 실패:", error);
      throw error;
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      hasBot: !!this.bot,
      hasService: !!this.reminderService
    };
  }
}

module.exports = ReminderScheduler;