// src/services/ReminderService.js - 리마인더 관리 서비스
const logger = require("../utils/Logger");
const BaseService = require("./BaseService");

class ReminderService extends BaseService {
  constructor() {
    super("reminders");
    this.reminders = new Map(); // reminderId -> reminderData
    this.timeouts = new Map(); // reminderId -> timeoutId
    this.nextId = 1;
  }

  // 리마인더 명령어 파싱
  parseReminderCommand(text) {
    try {
      // /remind 제거
      const content = text.replace("/remind", "").trim();

      if (!content) {
        return {
          success: false,
          message:
            "❌ 사용법: /remind [시간] [내용]\n예시: /remind 30 독서하기 또는 /remind 14:30 회의",
        };
      }

      const parts = content.split(" ");
      const timeParam = parts[0];
      const reminderText = parts.slice(1).join(" ");

      if (!reminderText) {
        return {
          success: false,
          message:
            "❌ 리마인더 내용을 입력해주세요.\n예시: /remind 30 독서하기",
        };
      }

      // 시간 파싱
      const timeResult = this.parseTime(timeParam);

      if (!timeResult.success) {
        return {
          success: false,
          message: timeResult.message,
        };
      }

      return {
        success: true,
        data: {
          time: timeResult.time,
          timeType: timeResult.type,
          text: reminderText,
          delay: timeResult.delay,
        },
        message: timeResult.confirmMessage.replace("{text}", reminderText),
      };
    } catch (error) {
      return {
        success: false,
        message: "❌ 리마인더 명령어 처리 중 오류가 발생했습니다.",
      };
    }
  }

  // 시간 파싱 (분 단위 또는 시:분 형식)
  parseTime(timeParam) {
    // 숫자만 있는 경우 (분 단위)
    if (/^\d+$/.test(timeParam)) {
      const minutes = parseInt(timeParam);

      if (minutes < 1) {
        return {
          success: false,
          message: "❌ 1분 이상으로 설정해주세요.",
        };
      }

      if (minutes > 1440) {
        // 24시간
        return {
          success: false,
          message: "❌ 최대 1440분(24시간)까지 설정 가능합니다.",
        };
      }

      const delay = minutes * 60 * 1000; // 밀리초
      const targetTime = new Date(Date.now() + delay);

      return {
        success: true,
        type: "minutes",
        time: timeParam,
        delay: delay,
        targetTime: targetTime,
        confirmMessage: `⏰ {text} 리마인더가 ${minutes}분 후(${this.formatTime(
          targetTime
        )})에 설정되었습니다.`,
      };
    }

    // 시:분 형식 (HH:MM)
    if (/^\d{1,2}:\d{2}$/.test(timeParam)) {
      const [hours, minutes] = timeParam.split(":").map(Number);

      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return {
          success: false,
          message: "❌ 올바른 시간 형식을 입력해주세요 (00:00 ~ 23:59)",
        };
      }

      const now = new Date();
      const targetTime = new Date();
      targetTime.setHours(hours, minutes, 0, 0);

      // 시간이 지났으면 다음 날로 설정
      if (targetTime <= now) {
        targetTime.setDate(targetTime.getDate() + 1);
      }

      const delay = targetTime.getTime() - now.getTime();

      return {
        success: true,
        type: "time",
        time: timeParam,
        delay: delay,
        targetTime: targetTime,
        confirmMessage: `🕐 {text} 리마인더가 ${this.formatTime(
          targetTime
        )}에 설정되었습니다.`,
      };
    }

    return {
      success: false,
      message:
        "❌ 올바른 시간 형식을 입력해주세요.\n• 분 단위: 30\n• 시간 지정: 14:30",
    };
  }

  // 리마인더 설정
  async setReminder(bot, chatId, data) {
    try {
      const reminderId = this.nextId++;

      const reminderData = {
        id: reminderId,
        chatId: chatId,
        text: data.text,
        time: data.time,
        timeType: data.timeType,
        createdAt: new Date(),
        targetTime: new Date(Date.now() + data.delay),
      };

      // 리마인더 저장
      this.reminders.set(reminderId, reminderData);

      // 타이머 설정
      const timeoutId = setTimeout(async () => {
        await this.executeReminder(bot, reminderId);
      }, data.delay);

      this.timeouts.set(reminderId, timeoutId);

      return {
        success: true,
        reminderId: reminderId,
        targetTime: reminderData.targetTime,
      };
    } catch (error) {
      throw new Error(`리마인더 설정 실패: ${error.message}`);
    }
  }

  // 리마인더 실행
  async executeReminder(bot, reminderId) {
    try {
      const reminder = this.reminders.get(reminderId);

      if (!reminder) {
        return;
      }

      // 알림 메시지 발송
      const message =
        "🔔 **리마인더 알림**\n\n" +
        `⏰ ${reminder.text}\n\n` +
        `설정 시간: ${this.formatTime(reminder.targetTime)}\n` +
        `알림 시간: ${this.formatTime(new Date())}`;

      await bot.sendMessage(reminder.chatId, message, {
        parse_mode: "Markdown",
      });

      // 정리
      this.reminders.delete(reminderId);
      this.timeouts.delete(reminderId);
    } catch (error) {
      console.error(`리마인더 실행 오류 (ID: ${reminderId}):`, error);
    }
  }

  // 시간 포맷팅
  formatTime(date) {
    return date.toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  // 활성 리마인더 목록
  getActiveReminders(chatId = null) {
    const reminders = Array.from(this.reminders.values());

    if (chatId) {
      return reminders.filter((r) => r.chatId === chatId);
    }

    return reminders;
  }

  // 리마인더 취소
  cancelReminder(reminderId) {
    try {
      const reminder = this.reminders.get(reminderId);

      if (!reminder) {
        return {
          success: false,
          message: "❌ 해당 리마인더를 찾을 수 없습니다.",
        };
      }

      // 타이머 정리
      const timeoutId = this.timeouts.get(reminderId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.timeouts.delete(reminderId);
      }

      // 리마인더 삭제
      this.reminders.delete(reminderId);

      return {
        success: true,
        message: `✅ "${reminder.text}" 리마인더가 취소되었습니다.`,
      };
    } catch (error) {
      return {
        success: false,
        message: "❌ 리마인더 취소 중 오류가 발생했습니다.",
      };
    }
  }

  // 모든 리마인더 취소
  cancelAllReminders(chatId) {
    try {
      let cancelCount = 0;

      for (const [reminderId, reminder] of this.reminders) {
        if (reminder.chatId === chatId) {
          const timeoutId = this.timeouts.get(reminderId);
          if (timeoutId) {
            clearTimeout(timeoutId);
            this.timeouts.delete(reminderId);
          }

          this.reminders.delete(reminderId);
          cancelCount++;
        }
      }

      return {
        success: true,
        count: cancelCount,
        message: `✅ ${cancelCount}개의 리마인더가 취소되었습니다.`,
      };
    } catch (error) {
      return {
        success: false,
        message: "❌ 리마인더 취소 중 오류가 발생했습니다.",
      };
    }
  }

  // 서비스 상태
  getServiceStatus() {
    return {
      activeReminders: this.reminders.size,
      activeTimeouts: this.timeouts.size,
      nextId: this.nextId,
      uptime: process.uptime(),
    };
  }

  // 정리 (서비스 종료 시)
  cleanup() {
    // 모든 타이머 정리
    for (const timeoutId of this.timeouts.values()) {
      clearTimeout(timeoutId);
    }

    this.timeouts.clear();
    this.reminders.clear();
  }
}

module.exports = ReminderService;
