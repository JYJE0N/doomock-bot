// src/services/WorktimeService.js
// ✅ 올바른 임포트
const { getInstance } = require("../database/DatabaseManager");
const dbManager = getInstance();
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const BaseService = require("./BaseService");

class WorktimeService extends BaseService {
  constructor() {
    this.schedule = {
      start: "08:30",
      lunch: "11:30 ~ 13:00",
      end: "17:30",
      total: "7시간 30분",
    };
  }

  getWorktimeInfo() {
    return {
      message: "💼 출근 완료! 오늘도 파이팅입니다.",
      schedule: `출근: ${this.schedule.start}\n점심: ${this.schedule.lunch}\n퇴근: ${this.schedule.end}`,
    };
  }

  async calculateWorkingTime(userName) {
    return `⏰ ${userName}님의 근무시간 정보\n\n${
      this.getWorktimeInfo().schedule
    }\n\n총 근무시간: ${this.schedule.total}`;
  }

  async checkInOut(userName, type) {
    const now = new Date().toLocaleTimeString("ko-KR", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
    });

    if (type === "in") {
      return `✅ ${userName}님 출근 완료!\n시간: ${now}`;
    } else {
      return `🏠 ${userName}님 퇴근 완료!\n시간: ${now}\n오늘도 수고하셨습니다!`;
    }
  }
}

module.exports = { WorktimeService };
