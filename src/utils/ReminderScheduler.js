// src/utils/ReminderScheduler.js - 🔔 리마인더 스케줄링 시스템
const cron = require("node-cron");
const logger = require("./Logger");

/**
 * 🔔 ReminderScheduler - 리마인더 자동 발송 시스템
 *
 * 🎯 핵심 기능:
 * - 정기적 리마인더 체크 (매분)
 * - 텔레그램 메시지 발송
 * - 발송 완료 처리
 * - 에러 핸들링 및 재시도
 *
 * ✅ 특징:
 * - node-cron 기반 스케줄링
 * - Railway 환경 최적화
 * - 메모리 효율성
 * - 안전한 에러 처리
 */

class ReminderScheduler {
  constructor(options = {}) {
    this.bot = options.bot || null;
    this.reminderService = options.reminderService || null;
    this.isRunning = false;
    this.cronJob = null;

    // 설정
    this.config = {
      // 매분 체크 (Railway 환경에서는 부하 고려)
      cronPattern: process.env.REMINDER_CRON_PATTERN || "*/1 * * * *", // 매분
      maxRetries: parseInt(process.env.REMINDER_MAX_RETRIES) || 3,
      retryDelay: parseInt(process.env.REMINDER_RETRY_DELAY) || 30000, // 30초
      batchSize: parseInt(process.env.REMINDER_BATCH_SIZE) || 10, // 한 번에 처리할 개수
      enableScheduler: process.env.ENABLE_REMINDER_SCHEDULER !== "false",
      ...options.config
    };

    // 통계
    this.stats = {
      totalChecks: 0,
      remindersSent: 0,
      errors: 0,
      lastCheck: null,
      lastSent: null
    };

    // Railway 환경 감지
    this.isRailway = !!process.env.RAILWAY_ENVIRONMENT;

    logger.info("🔔 ReminderScheduler 생성됨");
  }

  /**
   * 🎯 스케줄러 시작
   */
  async start() {
    if (this.isRunning) {
      logger.warn("ReminderScheduler가 이미 실행 중입니다");
      return;
    }

    if (!this.config.enableScheduler) {
      logger.info("⏸️ ReminderScheduler 비활성화됨 (환경변수)");
      return;
    }

    if (!this.bot) {
      throw new Error("Bot 인스턴스가 필요합니다");
    }

    if (!this.reminderService) {
      throw new Error("ReminderService 인스턴스가 필요합니다");
    }

    try {
      // Cron 작업 생성
      this.cronJob = cron.schedule(
        this.config.cronPattern,
        async () => {
          await this.checkAndSendReminders();
        },
        {
          scheduled: false, // 수동 시작
          timezone: "Asia/Seoul"
        }
      );

      // 스케줄러 시작
      this.cronJob.start();
      this.isRunning = true;

      logger.success(
        `✅ ReminderScheduler 시작됨 (패턴: ${this.config.cronPattern})`
      );

      // Railway 환경에서는 즉시 한 번 체크
      if (this.isRailway) {
        setTimeout(() => {
          this.checkAndSendReminders();
        }, 5000);
      }
    } catch (error) {
      logger.error("❌ ReminderScheduler 시작 실패:", error);
      throw error;
    }
  }

  /**
   * 🛑 스케줄러 중지
   */
  async stop() {
    if (!this.isRunning) {
      logger.warn("ReminderScheduler가 실행되지 않고 있습니다");
      return;
    }

    try {
      if (this.cronJob) {
        this.cronJob.stop();
        this.cronJob.destroy();
        this.cronJob = null;
      }

      this.isRunning = false;
      logger.info("🛑 ReminderScheduler 중지됨");
    } catch (error) {
      logger.error("❌ ReminderScheduler 중지 실패:", error);
    }
  }

  /**
   * 🔍 리마인더 체크 및 발송 (핵심 로직)
   */
  async checkAndSendReminders() {
    if (!this.isRunning) return;

    try {
      this.stats.totalChecks++;
      this.stats.lastCheck = new Date();

      logger.debug("🔍 리마인더 체크 시작...");

      // 현재 시간
      const now = new Date();

      // 발송 대상 리마인더 조회 (배치 처리)
      const pendingReminders = await this.getPendingReminders(now);

      if (pendingReminders.length === 0) {
        logger.debug("📭 발송할 리마인더가 없습니다");
        return;
      }

      logger.info(`🔔 ${pendingReminders.length}개 리마인더 발송 예정`);

      // 배치로 처리
      for (const reminder of pendingReminders) {
        try {
          await this.sendReminder(reminder);
          await this.markReminderSent(reminder);

          this.stats.remindersSent++;
          this.stats.lastSent = new Date();
        } catch (error) {
          logger.error(`❌ 리마인더 발송 실패 (ID: ${reminder._id}):`, error);
          this.stats.errors++;

          // 재시도 로직
          await this.handleReminderError(reminder, error);
        }

        // Railway 환경에서는 부하 분산을 위해 딜레이
        if (this.isRailway) {
          await this.sleep(100);
        }
      }

      logger.success(
        `✅ 리마인더 체크 완료 (발송: ${pendingReminders.length}개)`
      );
    } catch (error) {
      logger.error("❌ 리마인더 체크 중 오류:", error);
      this.stats.errors++;
    }
  }

  async markReminderSent(reminder) {
    try {
      // ReminderService의 모델 직접 사용
      if (this.reminderService.models && this.reminderService.models.Reminder) {
        await this.reminderService.models.Reminder.findByIdAndUpdate(
          reminder._id,
          {
            $set: {
              sentAt: new Date(),
              completed: true,
              isActive: false
            }
          }
        );
        logger.debug(`✅ 리마인더 발송 완료 표시: ${reminder._id}`);
      }
    } catch (error) {
      logger.error(`리마인더 발송 완료 표시 실패: ${reminder._id}`, error);
    }
  }

  /**
   * 🔍 발송 대상 리마인더 조회
   */
  async getPendingReminders(currentTime) {
    try {
      // ReminderService에서 발송 대상 조회
      const reminders = await this.reminderService.getPendingReminders(
        currentTime,
        this.config.batchSize
      );

      return reminders;
    } catch (error) {
      logger.error("발송 대상 리마인더 조회 실패:", error);
      return [];
    }
  }

  /**
   * 📤 리마인더 메시지 발송
   */
  async sendReminder(reminder) {
    try {
      const { userId, text, type, todoId } = reminder;

      // 메시지 구성
      let message = "";

      if (type === "todo_reminder" || todoId) {
        message = `🔔 *리마인더 알림\\!*\n\n📝 ${this.escapeMarkdownV2(text)}\n\n⏰ 설정하신 시간입니다\\!`;
      } else {
        message = `🔔 *리마인더 알림*\n\n${this.escapeMarkdownV2(text)}`;
      }

      // ✅ 수정: bot.telegram.sendMessage 사용
      await this.bot.telegram.sendMessage(userId, message, {
        parse_mode: "MarkdownV2"
      });

      logger.info(`✅ 리마인더 발송 성공: ${reminder._id}`);
    } catch (error) {
      logger.error("리마인더 메시지 발송 실패:", error);
      throw error;
    }
  }

  /**
   * 🔄 리마인더 에러 처리 (재시도 등)
   */
  async handleReminderError(reminder, error) {
    try {
      logger.error(`리마인더 처리 오류 (ID: ${reminder._id}):`, error);

      // 재시도 횟수 증가
      const retryCount = (reminder.retryCount || 0) + 1;

      if (retryCount < this.config.maxRetries) {
        // 재시도 예약
        logger.info(
          `리마인더 재시도 예약 (${retryCount}/${this.config.maxRetries})`
        );

        // ReminderService에 재시도 정보 업데이트
        // updateReminderRetry가 없으므로 직접 구현하거나 다른 방법 사용
        if (
          this.reminderService.models &&
          this.reminderService.models.Reminder
        ) {
          await this.reminderService.models.Reminder.findByIdAndUpdate(
            reminder._id,
            {
              $set: {
                retryCount,
                lastError: error.message,
                lastErrorAt: new Date()
              }
            }
          );
        }
      } else {
        // 최대 재시도 횟수 초과
        logger.error(`리마인더 최대 재시도 횟수 초과: ${reminder._id}`);

        // 리마인더 비활성화
        if (
          this.reminderService.models &&
          this.reminderService.models.Reminder
        ) {
          await this.reminderService.models.Reminder.findByIdAndUpdate(
            reminder._id,
            {
              $set: {
                isActive: false,
                failedAt: new Date(),
                failureReason: `최대 재시도 횟수 초과: ${error.message}`
              }
            }
          );
        }
      }
    } catch (handleError) {
      logger.error("리마인더 에러 처리 실패:", handleError);
    }
  }

  /**
   * 🛠️ 유틸리티 메서드들
   */

  /**
   * MarkdownV2 이스케이프
   */
  escapeMarkdownV2(text) {
    if (typeof text !== "string") text = String(text);

    const escapeChars = [
      "_",
      "*",
      "[",
      "]",
      "(",
      ")",
      "~",
      "`",
      ">",
      "#",
      "+",
      "-",
      "=",
      "|",
      "{",
      "}",
      ".",
      "!"
    ];

    let escaped = text;
    escapeChars.forEach((char) => {
      const regex = new RegExp("\\" + char, "g");
      escaped = escaped.replace(regex, "\\" + char);
    });

    return escaped;
  }

  /**
   * 딜레이 함수
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 📊 스케줄러 상태 조회
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      config: this.config,
      stats: this.stats,
      environment: this.isRailway ? "railway" : "local",
      cronPattern: this.config.cronPattern,
      nextExecution: this.cronJob ? this.cronJob.nextDates() : null
    };
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    try {
      await this.stop();
      logger.info("✅ ReminderScheduler 정리 완료");
    } catch (error) {
      logger.error("❌ ReminderScheduler 정리 실패:", error);
    }
  }
}

module.exports = ReminderScheduler;
