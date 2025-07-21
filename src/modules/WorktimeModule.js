// src/modules/WorktimeModule.js - 표준화된 근무시간 모듈

const BaseModule = require("./BaseModule");
const { WorktimeService } = require("../services/WorktimeService");
const { getUserName } = require("../utils/UserHelper");
const { TimeHelper } = require("../utils/TimeHelper");
const logger = require("../utils/Logger");

class WorktimeModule extends BaseModule {
  constructor(bot, dependencies) {
    super("WorktimeModule", {
      commands: ["worktime", "근무", "출근", "퇴근"],
      callbacks: ["worktime"],
      features: [
        "status",
        "checkin",
        "checkout",
        "progress",
        "history",
        "settings",
      ],
    });

    this.worktimeService = null;

    // 근무 시간 설정 (기본값)
    this.workSchedule = {
      startTime: "08:30",
      lunchStart: "11:30",
      lunchEnd: "13:00",
      endTime: "17:30",
      workDays: [1, 2, 3, 4, 5], // 월-금
      totalWorkHours: 7.5, // 점심시간 제외
    };

    // 진행률 이모지
    this.progressEmojis = {
      morning: "🌅",
      working: "💼",
      lunch: "🍽️",
      afternoon: "☕",
      leaving: "🏃",
      done: "🏠",
      weekend: "🎉",
    };
  }

  // 🎯 모듈별 초기화
  async onInitialize() {
    try {
      this.worktimeService = new WorktimeService(this.db);
      await this.worktimeService.initialize();
      logger.info("🕐 WorktimeService 초기화 성공");
    } catch (error) {
      logger.error("❌ WorktimeService 초기화 실패:", error);
      throw error;
    }
  }

  // 🎯 액션 등록
  registerActions() {
    this.actionMap.set("status", this.showWorktimeStatus);
    this.actionMap.set("checkin", this.processCheckIn);
    this.actionMap.set("checkout", this.processCheckOut);
    this.actionMap.set("progress", this.showDetailedProgress);
    this.actionMap.set("history", this.showWorktimeHistory);
    this.actionMap.set("settings", this.showWorktimeSettings);
    this.actionMap.set("help", this.showWorktimeHelp);

    // 설정 관련 액션
    this.actionMap.set("settings_time", this.startTimeSettings);
    this.actionMap.set("settings_alert", this.toggleAlertSettings);
  }

  // 🎯 메시지 처리
  async onHandleMessage(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;
    const userState = this.userStates.get(userId);

    // 사용자 상태에 따른 처리
    if (userState) {
      switch (userState.action) {
        case "waiting_checkin_note":
          return await this.handleCheckInNote(bot, chatId, userId, text);
        case "waiting_checkout_note":
          return await this.handleCheckOutNote(bot, chatId, userId, text);
        case "waiting_time_setting":
          return await this.handleTimeSetting(bot, chatId, userId, text);
      }
    }

    // 명령어 처리
    const command = this.extractCommand(text);
    switch (command) {
      case "worktime":
      case "근무":
        await this.showMenu(bot, chatId, null, userId);
        return true;
      case "출근":
        await this.processCheckIn(bot, {
          message: { chat: { id: chatId } },
          from: { id: userId },
        });
        return true;
      case "퇴근":
        await this.processCheckOut(bot, {
          message: { chat: { id: chatId } },
          from: { id: userId },
        });
        return true;
    }

    return false;
  }

  // 📋 근무시간 메뉴
  async showMenu(bot, chatId, messageId, userId) {
    const userName = getUserName({ id: userId });
    const currentStatus = await this.getCurrentStatus();

    const menuText =
      `🕐 **근무시간 관리**\n\n` +
      `${userName}님의 근무 현황입니다.\n` +
      `현재: ${currentStatus.emoji} ${currentStatus.status}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📊 현재 상태", callback_data: "worktime:status" },
          { text: "📈 상세 진행률", callback_data: "worktime:progress" },
        ],
        [
          { text: "🏢 출근", callback_data: "worktime:checkin" },
          { text: "🏠 퇴근", callback_data: "worktime:checkout" },
        ],
        [
          { text: "📜 근무 기록", callback_data: "worktime:history" },
          { text: "⚙️ 설정", callback_data: "worktime:settings" },
        ],
        [{ text: "❓ 도움말", callback_data: "worktime:help" }],
        [{ text: "🏠 메인 메뉴", callback_data: "main_menu" }],
      ],
    };

    if (messageId) {
      await this.editMessage(bot, chatId, messageId, menuText, {
        reply_markup: keyboard,
      });
    } else {
      await this.sendMessage(bot, chatId, menuText, {
        reply_markup: keyboard,
      });
    }

    return true;
  }

  // 📊 근무 상태 표시
  async showWorktimeStatus(bot, callbackQuery) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      const now = TimeHelper.getCurrentTime();
      const status = await this.calculateWorktimeStatus();
      const progressBar = this.createProgressBar(status.progress);

      const statusText =
        `📊 **근무 현황**\n\n` +
        `🕐 현재 시각: ${now}\n` +
        `📍 상태: ${status.emoji} ${status.phase}\n\n` +
        `**오늘의 진행률** (${status.progress}%)\n` +
        `${progressBar}\n\n` +
        `⏰ 출근: ${this.workSchedule.startTime}\n` +
        `🍽️ 점심: ${this.workSchedule.lunchStart} - ${this.workSchedule.lunchEnd}\n` +
        `🏠 퇴근: ${this.workSchedule.endTime}\n\n` +
        `${status.message}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 새로고침", callback_data: "worktime:status" },
            { text: "📈 상세 진행률", callback_data: "worktime:progress" },
          ],
          [{ text: "🔙 근무 메뉴", callback_data: "worktime:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, statusText, {
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("근무 상태 조회 실패:", error);
      await this.sendError(bot, chatId, "근무 상태를 조회할 수 없습니다.");
      return true;
    }
  }

  // 🏢 출근 처리
  async processCheckIn(bot, callbackQuery) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      // 이미 출근했는지 확인
      const todayRecord = await this.worktimeService.getTodayRecord(userId);
      if (todayRecord?.checkIn) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "이미 출근하셨습니다!",
          show_alert: true,
        });
        return true;
      }

      // 출근 시간 기록
      const checkInTime = TimeHelper.getCurrentTime();
      const result = await this.worktimeService.checkIn(userId, checkInTime);

      if (result.success) {
        const successText =
          `✅ **출근 완료!**\n\n` +
          `🏢 출근 시간: ${checkInTime}\n` +
          `${result.isLate ? "⚠️ 지각입니다!" : "👍 정시 출근!"}`;

        const keyboard = {
          inline_keyboard: [
            [
              {
                text: "📝 메모 추가",
                callback_data: "worktime:add_checkin_note",
              },
              { text: "📊 상태 보기", callback_data: "worktime:status" },
            ],
            [{ text: "🔙 근무 메뉴", callback_data: "worktime:menu" }],
          ],
        };

        await this.editMessage(bot, chatId, messageId, successText, {
          reply_markup: keyboard,
        });

        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "출근 처리 완료!",
        });
      }

      return true;
    } catch (error) {
      logger.error("출근 처리 실패:", error);
      await this.sendError(bot, chatId, "출근 처리에 실패했습니다.");
      return true;
    }
  }

  // 🏠 퇴근 처리
  async processCheckOut(bot, callbackQuery) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      // 출근 기록 확인
      const todayRecord = await this.worktimeService.getTodayRecord(userId);
      if (!todayRecord?.checkIn) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "출근 기록이 없습니다!",
          show_alert: true,
        });
        return true;
      }

      if (todayRecord.checkOut) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "이미 퇴근하셨습니다!",
          show_alert: true,
        });
        return true;
      }

      // 퇴근 시간 기록
      const checkOutTime = TimeHelper.getCurrentTime();
      const result = await this.worktimeService.checkOut(userId, checkOutTime);

      if (result.success) {
        const workHours = this.calculateWorkHours(
          todayRecord.checkIn,
          checkOutTime
        );

        const successText =
          `✅ **퇴근 완료!**\n\n` +
          `🏢 출근: ${todayRecord.checkIn}\n` +
          `🏠 퇴근: ${checkOutTime}\n` +
          `⏱️ 근무시간: ${workHours.hours}시간 ${workHours.minutes}분\n` +
          `${result.isOvertime ? "💪 야근하셨네요!" : "👍 수고하셨습니다!"}`;

        const keyboard = {
          inline_keyboard: [
            [
              {
                text: "📝 메모 추가",
                callback_data: "worktime:add_checkout_note",
              },
              { text: "📜 오늘 기록", callback_data: "worktime:today_record" },
            ],
            [{ text: "🔙 근무 메뉴", callback_data: "worktime:menu" }],
          ],
        };

        await this.editMessage(bot, chatId, messageId, successText, {
          reply_markup: keyboard,
        });

        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "퇴근 처리 완료! 수고하셨습니다 🏠",
        });
      }

      return true;
    } catch (error) {
      logger.error("퇴근 처리 실패:", error);
      await this.sendError(bot, chatId, "퇴근 처리에 실패했습니다.");
      return true;
    }
  }

  // 📈 상세 진행률
  async showDetailedProgress(bot, callbackQuery) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    try {
      const progress = await this.calculateDetailedProgress();
      const progressText = this.formatDetailedProgress(progress);

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 새로고침", callback_data: "worktime:progress" },
            { text: "📊 간단히 보기", callback_data: "worktime:status" },
          ],
          [{ text: "🔙 근무 메뉴", callback_data: "worktime:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, progressText, {
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("상세 진행률 조회 실패:", error);
      await this.sendError(bot, chatId, "진행률을 조회할 수 없습니다.");
      return true;
    }
  }

  // 📜 근무 기록
  async showWorktimeHistory(bot, callbackQuery) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      const history = await this.worktimeService.getWeeklyHistory(userId);
      const historyText = this.formatWorktimeHistory(history);

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📊 이번 달", callback_data: "worktime:monthly_stats" },
            { text: "📈 통계", callback_data: "worktime:statistics" },
          ],
          [{ text: "🔙 근무 메뉴", callback_data: "worktime:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, historyText, {
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("근무 기록 조회 실패:", error);
      await this.sendError(bot, chatId, "근무 기록을 조회할 수 없습니다.");
      return true;
    }
  }

  // ⚙️ 설정
  async showWorktimeSettings(bot, callbackQuery) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    const settings = await this.worktimeService.getUserSettings(userId);

    const settingsText =
      `⚙️ **근무시간 설정**\n\n` +
      `⏰ 출근 시간: ${settings.startTime || this.workSchedule.startTime}\n` +
      `🍽️ 점심 시간: ${settings.lunchStart || this.workSchedule.lunchStart} - ${settings.lunchEnd || this.workSchedule.lunchEnd}\n` +
      `🏠 퇴근 시간: ${settings.endTime || this.workSchedule.endTime}\n\n` +
      `🔔 알림: ${settings.notifications ? "켜짐" : "꺼짐"}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "⏰ 시간 변경", callback_data: "worktime:settings_time" },
          { text: "🔔 알림 설정", callback_data: "worktime:settings_alert" },
        ],
        [{ text: "🔙 근무 메뉴", callback_data: "worktime:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, settingsText, {
      reply_markup: keyboard,
    });

    return true;
  }

  // ❓ 도움말
  async showWorktimeHelp(bot, callbackQuery) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const helpText =
      `❓ **근무시간 도움말**\n\n` +
      `💼 **기본 근무시간:**\n` +
      `• 출근: 08:30\n` +
      `• 점심: 11:30 - 13:00\n` +
      `• 퇴근: 17:30\n` +
      `• 총 근무: 7시간 30분\n\n` +
      `📊 **제공 기능:**\n` +
      `• 출퇴근 기록\n` +
      `• 실시간 진행률\n` +
      `• 근무 시간 계산\n` +
      `• 주간/월간 통계\n` +
      `• 야근 기록\n\n` +
      `💡 **사용 방법:**\n` +
      `/worktime - 근무 메뉴\n` +
      `/출근 - 출근 처리\n` +
      `/퇴근 - 퇴근 처리\n\n` +
      `🎨 **진행률 표시:**\n` +
      `컬러풀한 게이지로 하루 진행 상황을 한눈에!`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 근무 메뉴", callback_data: "worktime:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, helpText, {
      reply_markup: keyboard,
    });

    return true;
  }

  // 🛠️ 헬퍼 메서드
  async getCurrentStatus() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 60 + minutes;

    const startTime = this.timeToMinutes(this.workSchedule.startTime);
    const lunchStart = this.timeToMinutes(this.workSchedule.lunchStart);
    const lunchEnd = this.timeToMinutes(this.workSchedule.lunchEnd);
    const endTime = this.timeToMinutes(this.workSchedule.endTime);

    if (now.getDay() === 0 || now.getDay() === 6) {
      return { emoji: "🎉", status: "주말입니다!" };
    }

    if (currentTime < startTime - 30) {
      return { emoji: "🌅", status: "출근 전" };
    } else if (currentTime < startTime) {
      return { emoji: "🚶", status: "출근 준비" };
    } else if (currentTime < lunchStart) {
      return { emoji: "💼", status: "오전 근무 중" };
    } else if (currentTime < lunchEnd) {
      return { emoji: "🍽️", status: "점심시간" };
    } else if (currentTime < endTime) {
      return { emoji: "☕", status: "오후 근무 중" };
    } else if (currentTime < endTime + 30) {
      return { emoji: "🏃", status: "퇴근 시간!" };
    } else {
      return { emoji: "🏠", status: "퇴근 완료" };
    }
  }

  async calculateWorktimeStatus() {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const startTime = this.timeToMinutes(this.workSchedule.startTime);
    const endTime = this.timeToMinutes(this.workSchedule.endTime);
    const lunchStart = this.timeToMinutes(this.workSchedule.lunchStart);
    const lunchEnd = this.timeToMinutes(this.workSchedule.lunchEnd);

    // 총 근무 시간 (점심시간 제외)
    const totalWorkMinutes = endTime - startTime - (lunchEnd - lunchStart);

    let workedMinutes = 0;
    let phase = "";
    let emoji = "";
    let message = "";

    if (currentMinutes < startTime) {
      phase = "근무 전";
      emoji = "🌅";
      message = `출근까지 ${startTime - currentMinutes}분 남았습니다.`;
    } else if (currentMinutes >= startTime && currentMinutes < lunchStart) {
      workedMinutes = currentMinutes - startTime;
      phase = "오전 근무";
      emoji = "💼";
      const untilLunch = lunchStart - currentMinutes;
      message = `점심까지 ${untilLunch}분 남았습니다.`;
    } else if (currentMinutes >= lunchStart && currentMinutes < lunchEnd) {
      workedMinutes = lunchStart - startTime;
      phase = "점심시간";
      emoji = "🍽️";
      const lunchRemaining = lunchEnd - currentMinutes;
      message = `점심시간이 ${lunchRemaining}분 남았습니다.`;
    } else if (currentMinutes >= lunchEnd && currentMinutes < endTime) {
      workedMinutes = currentMinutes - startTime - (lunchEnd - lunchStart);
      phase = "오후 근무";
      emoji = "☕";
      const untilEnd = endTime - currentMinutes;
      message = `퇴근까지 ${untilEnd}분 남았습니다.`;
    } else {
      workedMinutes = totalWorkMinutes;
      phase = "퇴근 완료";
      emoji = "🏠";
      message = "오늘 하루도 수고하셨습니다!";
    }

    const progress = Math.min(
      100,
      Math.round((workedMinutes / totalWorkMinutes) * 100)
    );

    return { progress, phase, emoji, message };
  }

  async calculateDetailedProgress() {
    const status = await this.calculateWorktimeStatus();
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const segments = [
      {
        name: "오전 근무",
        start: this.timeToMinutes(this.workSchedule.startTime),
        end: this.timeToMinutes(this.workSchedule.lunchStart),
        emoji: "💼",
      },
      {
        name: "점심시간",
        start: this.timeToMinutes(this.workSchedule.lunchStart),
        end: this.timeToMinutes(this.workSchedule.lunchEnd),
        emoji: "🍽️",
      },
      {
        name: "오후 근무",
        start: this.timeToMinutes(this.workSchedule.lunchEnd),
        end: this.timeToMinutes(this.workSchedule.endTime),
        emoji: "☕",
      },
    ];

    const progressSegments = segments.map((segment) => {
      let segmentProgress = 0;

      if (currentMinutes >= segment.end) {
        segmentProgress = 100;
      } else if (currentMinutes > segment.start) {
        const segmentDuration = segment.end - segment.start;
        const segmentWorked = currentMinutes - segment.start;
        segmentProgress = Math.round((segmentWorked / segmentDuration) * 100);
      }

      return {
        ...segment,
        progress: segmentProgress,
        duration: segment.end - segment.start,
      };
    });

    return {
      overall: status,
      segments: progressSegments,
    };
  }

  formatDetailedProgress(progress) {
    let text = `📈 **상세 진행률**\n\n`;
    text += `전체 진행도: ${progress.overall.progress}%\n`;
    text += `${this.createColorfulProgressBar(progress.overall.progress)}\n\n`;

    text += `**시간대별 진행률**\n`;
    progress.segments.forEach((segment) => {
      text += `\n${segment.emoji} ${segment.name} (${segment.duration}분)\n`;
      text += `${this.createMiniProgressBar(segment.progress)} ${segment.progress}%\n`;
    });

    text += `\n${progress.overall.message}`;

    return text;
  }

  formatWorktimeHistory(history) {
    let text = `📜 **주간 근무 기록**\n\n`;

    const daysOfWeek = ["월", "화", "수", "목", "금"];
    const today = new Date().getDay();

    history.forEach((record, index) => {
      const dayName = daysOfWeek[index];
      const isToday = index + 1 === today;

      text += `**${dayName}요일** ${isToday ? "(오늘)" : ""}\n`;

      if (record) {
        text += `• 출근: ${record.checkIn || "-"}\n`;
        text += `• 퇴근: ${record.checkOut || "-"}\n`;
        if (record.workHours) {
          text += `• 근무: ${record.workHours.hours}시간 ${record.workHours.minutes}분\n`;
        }
      } else {
        text += `• 기록 없음\n`;
      }
      text += "\n";
    });

    return text;
  }

  calculateWorkHours(checkIn, checkOut) {
    const start = this.timeToMinutes(checkIn);
    const end = this.timeToMinutes(checkOut);
    const lunchDuration =
      this.timeToMinutes(this.workSchedule.lunchEnd) -
      this.timeToMinutes(this.workSchedule.lunchStart);

    const totalMinutes = end - start - lunchDuration;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return { hours, minutes, totalMinutes };
  }

  timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
  }

  createProgressBar(percentage) {
    const filled = Math.round(percentage / 10);
    const empty = 10 - filled;
    return "🟦".repeat(filled) + "⬜".repeat(empty);
  }

  createColorfulProgressBar(percentage) {
    const filled = Math.round(percentage / 10);
    const empty = 10 - filled;
    const colors = ["🟥", "🟧", "🟨", "🟩", "🟦", "🟪"];

    let bar = "";
    for (let i = 0; i < filled; i++) {
      bar += colors[i % colors.length];
    }
    bar += "⬜".repeat(empty);

    return bar;
  }

  createMiniProgressBar(percentage) {
    const filled = Math.round(percentage / 20);
    const empty = 5 - filled;
    return "▰".repeat(filled) + "▱".repeat(empty);
  }
}

module.exports = WorktimeModule;
