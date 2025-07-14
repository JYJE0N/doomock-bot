class WorkTimeManager {
  constructor() {
    this.schedules = new Map(); // chatId -> { start, end }
    this.default = { start: { hours: 8, minutes: 30 }, end: { hours: 17, minutes: 30 } };
  }

  get(chatId) {
    return this.schedules.get(chatId) || { ...this.default, isDefault: true };
  }

  set(chatId, start, end) {
    this.schedules.set(chatId, { start, end, isDefault: false });
  }

  reset(chatId) {
    this.schedules.delete(chatId);
  }
}
module.exports = new WorkTimeManager();
