// src/utils/ReminderScheduler.js - 🔔 리마인더 스케줄링 시스템
const logger = require("../core/Logger");

/**
 * 🔔 ReminderScheduler - 리마인더 자동 발송 시스템
 *
 * 🎯 핵심 기능:
 * - 텔레그램 메시지 발송
 * - 발송 완료 처리
 * - 에러 핸들링 및 재시도
 *
 * ✅ 특징:
 * - Railway 환경 최적화
 * - 메모리 효율성
 * - 안전한 에러 처리
 */

class ReminderScheduler {
  constructor(options = {}) {
    this.bot = options.bot || null;
    this.reminderService = options.reminderService || null;
    this.isRunning = false;
    this.nextCheckTimeout = null; // cronJob 대신 timeout ID를 관리합니다.

    // 설정
    this.config = {
      // 매분 체크 (Railway 환경에서는 부하 고려)
      cronPattern: process.env.REMINDER_CRON_PATTERN || "*/1 * * * *", // 매분
      fallbackCheckInterval: 5 * 60 * 1000, // 5분 (안전장치)

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
   * 🎯 스케줄러 시작 (동적 스케줄링 전용)
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
      this.isRunning = true;
      logger.success(`✅ ReminderScheduler 시작됨 (동적 스케줄링 모드)`);

      // ✨ cron 관련 코드 모두 제거!
      // ✨ 동적 스케줄링 첫 실행
      await this.scheduleNextCheck();

      // ✨ Railway 환경 즉시 체크 로직도 더 이상 필요 없습니다.
      // scheduleNextCheck가 알아서 가장 빠른 다음 작업을 예약합니다.
    } catch (error) {
      logger.error("❌ ReminderScheduler 시작 실패:", error);
      this.isRunning = false; // 실패 시 상태 롤백
      throw error;
    }
  }

  /**
   * 🛑 스케줄러 중지
   */
  async stop() {
    if (!this.isRunning) return;

    // ✨ 예약된 timeout 취소
    if (this.nextCheckTimeout) {
      clearTimeout(this.nextCheckTimeout);
      this.nextCheckTimeout = null;
    }
    this.isRunning = false;
    logger.info("🛑 ReminderScheduler 중지됨");
  }

  /**
   * ✨ 다음 리마인더 체크를 예약하는 핵심 함수
   */
  async scheduleNextCheck() {
    if (!this.isRunning) return;

    // 기존 예약 취소
    if (this.nextCheckTimeout) {
      clearTimeout(this.nextCheckTimeout);
    }

    try {
      const nextReminder = await this.reminderService.getNextReminder();

      if (nextReminder) {
        const now = Date.now();
        const delay = new Date(nextReminder.reminderTime).getTime() - now;

        // 딜레이가 너무 길면 fallback 간격으로 체크
        const finalDelay = Math.max(
          0,
          Math.min(delay, this.config.fallbackCheckInterval)
        );

        logger.info(
          `🔔 다음 리마인더 예약: ${new Date(now + finalDelay).toLocaleString("ko-KR")} (${(finalDelay / 1000).toFixed(1)}초 후)`
        );

        this.nextCheckTimeout = setTimeout(async () => {
          await this.checkAndSendReminders();
        }, finalDelay);
      } else {
        logger.info("📭 예정된 리마인더 없음. 5분 후 다시 확인합니다.");
        // 예약된 리마인더가 없으면 fallback 간격으로 다시 확인
        this.nextCheckTimeout = setTimeout(async () => {
          await this.checkAndSendReminders();
        }, this.config.fallbackCheckInterval);
      }
    } catch (error) {
      logger.error("❌ 다음 리마인더 예약 실패:", error);
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
      logger.debug(`현재 시간: ${now.toISOString()}`);

      // 디버깅: 모든 리마인더 확인
      if (this.reminderService.models && this.reminderService.models.Reminder) {
        const allReminders = await this.reminderService.models.Reminder.find({
          isActive: true
        }).lean();

        logger.debug(`전체 활성 리마인더: ${allReminders.length}개`);

        allReminders.forEach((r) => {
          const reminderTime = new Date(r.reminderTime);
          const isPast = reminderTime <= now;
          logger.debug(
            `리마인더: ${r.text} | 시간: ${reminderTime.toISOString()} | 지났나? ${isPast} | sentAt: ${r.sentAt}`
          );
        });
      }

      // 발송 대상 리마인더 조회
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
    } finally {
      // ✨ 중요: 작업 완료 후 다음 스케줄을 다시 잡습니다.
      if (this.isRunning) {
        await this.scheduleNextCheck();
      }
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
