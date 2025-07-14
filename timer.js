class TimerManager {
  constructor() {
    this.timers = new Map(); // chatId -> { taskName, startTime }
  }

  start(chatId, taskName) {
    if (this.timers.has(chatId)) return false;
    this.timers.set(chatId, { taskName, startTime: new Date() });
    return true;
  }

  stop(chatId) {
    const timer = this.timers.get(chatId);
    if (!timer) return null;
    const duration = Math.floor((new Date() - timer.startTime) / 60000);
    this.timers.delete(chatId);
    return { ...timer, duration };
  }

  status(chatId) {
    const timer = this.timers.get(chatId);
    if (!timer) return null;
    const running = Math.floor((new Date() - timer.startTime) / 60000);
    return { ...timer, running };
  }
}
module.exports = new TimerManager();
