const logger = require("./core/Logger");

class TimeHelper {
  static getKoreanDate() {
    const now = new Date();
    const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
    return kst.toISOString().split('T')[0];
  }

  // 호환성을 위한 별칭
  static getKSTDate() {
    return this.getKoreanDate();
  }

  static getKoreanDateTime() {
    const now = new Date();
    const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    return kst.toISOString().replace('T', ' ').split('.')[0];
  }

  static formatTime(date) {
    if (!date) return '';
    return new Date(date).toLocaleString('ko-KR');
  }

  static getToday() {
    return this.getKoreanDate();
  }

  static getTodayStart() {
    const today = this.getKoreanDate();
    return new Date(`${today}T00:00:00+09:00`);
  }

  static getTodayEnd() {
    const today = this.getKoreanDate();
    return new Date(`${today}T23:59:59+09:00`);
  }
}

module.exports = TimeHelper;