// src/modules/WorktimeModule.js - TimeHelper 메서드 수정 부분
const BaseModule = require("./BaseModule");
const WorktimeService = require("../services/WorktimeService");
const { getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");
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
      const now = TimeHelper.getShortTimeString(); // ✅ getCurrentTime 대신 사용
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
      const checkInTime = TimeHelper.getShortTimeString(); // ✅ getCurrentTime 대신 사용
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
                callback_data: "worktime:add:checkin_note",
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
      const checkOutTime = TimeHelper.getShortTimeString(); // ✅ getCurrentTime 대신 사용
      const result = await this.worktimeService.checkOut(userId, checkOutTime);

      if (result.success) {
        const workHours = this.worktimeService.calculateWorkHours(
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
                callback_data: "worktime:add:checkout_note",
              },
              { text: "📜 오늘 기록", callback_data: "worktime:today:record" },
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

  // 근무 상태 계산
  async calculateWorktimeStatus() {
    const now = TimeHelper.getKoreaTime(); // ✅ Date 객체로 받음
    const dayOfWeek = now.getDay();

    // 주말 체크
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return {
        progress: 100,
        phase: "주말",
        emoji: this.progressEmojis.weekend,
        message: "오늘은 주말입니다! 편안한 휴식 되세요 😊",
      };
    }

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = this.timeToMinutes(this.workSchedule.startTime);
    const lunchStartMinutes = this.timeToMinutes(this.workSchedule.lunchStart);
    const lunchEndMinutes = this.timeToMinutes(this.workSchedule.lunchEnd);
    const endMinutes = this.timeToMinutes(this.workSchedule.endTime);

    let phase, emoji, message;

    if (currentMinutes < startMinutes) {
      phase = "출근 전";
      emoji = this.progressEmojis.morning;
      message = "좋은 아침입니다! 출근 준비하세요 ☕";
    } else if (
      currentMinutes >= startMinutes &&
      currentMinutes < lunchStartMinutes
    ) {
      phase = "오전 근무";
      emoji = this.progressEmojis.working;
      message = "오전 근무 중입니다. 화이팅! 💪";
    } else if (
      currentMinutes >= lunchStartMinutes &&
      currentMinutes < lunchEndMinutes
    ) {
      phase = "점심시간";
      emoji = this.progressEmojis.lunch;
      message = "맛있는 점심 드세요! 🍚";
    } else if (
      currentMinutes >= lunchEndMinutes &&
      currentMinutes < endMinutes
    ) {
      phase = "오후 근무";
      emoji = this.progressEmojis.afternoon;
      message = "오후 근무 중입니다. 조금만 더! 🔥";
    } else if (
      currentMinutes >= endMinutes &&
      currentMinutes < endMinutes + 60
    ) {
      phase = "퇴근 시간";
      emoji = this.progressEmojis.leaving;
      message = "퇴근 시간입니다! 수고하셨어요 👏";
    } else {
      phase = "퇴근 후";
      emoji = this.progressEmojis.done;
      message = "오늘도 수고하셨습니다! 🌙";
    }

    // 진행률 계산
    const totalWorkMinutes =
      endMinutes - startMinutes - (lunchEndMinutes - lunchStartMinutes);
    let workedMinutes = 0;

    if (currentMinutes > startMinutes) {
      workedMinutes = Math.min(
        currentMinutes - startMinutes,
        lunchStartMinutes - startMinutes
      );
    }
    if (currentMinutes > lunchEndMinutes) {
      workedMinutes += Math.min(
        currentMinutes - lunchEndMinutes,
        endMinutes - lunchEndMinutes
      );
    }

    const progress = Math.min(
      100,
      Math.round((workedMinutes / totalWorkMinutes) * 100)
    );

    return { progress, phase, emoji, message };
  }

  // 시간을 분으로 변환
  timeToMinutes(timeString) {
    const [hours, minutes] = timeString.split(":").map(Number);
    return hours * 60 + minutes;
  }

  // 진행률 바 생성
  createProgressBar(progress) {
    const filled = Math.round(progress / 10);
    const empty = 10 - filled;
    const bar = "█".repeat(filled) + "░".repeat(empty);
    return `[${bar}]`;
  }

  // 나머지 메서드들은 그대로 유지...
}

module.exports = WorktimeModule;
