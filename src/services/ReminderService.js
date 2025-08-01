// src/services/ReminderService.js - Mongoose 전용 버전

const BaseService = require("./BaseService");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🔔 ReminderService - 리마인더 서비스 (Mongoose 버전)
 */
class ReminderService extends BaseService {
  constructor(options = {}) {
    super("ReminderService", options);

    this.config = {
      maxRemindersPerUser: 20,
      ...options.config,
    };

    logger.info("🔔 ReminderService 생성됨");
  }

  /**
   * Mongoose 모델 사용
   */
  getRequiredModels() {
    return ["Reminder"];
  }

  /**
   * 서비스 초기화
   */
  async onInitialize() {
    // logger.success("✅ ReminderService 초기화 완료");
  }

  /**
   * 리마인더 생성
   */
  async createReminder(userId, reminderData) {
    try {
      const ReminderModel = this.models.Reminder;

      // 사용자별 리마인더 수 체크
      const userCount = await ReminderModel.countDocuments({
        userId,
        isActive: true,
      });

      if (userCount >= this.config.maxRemindersPerUser) {
        throw new Error(
          `리마인더는 최대 ${this.config.maxRemindersPerUser}개까지 등록 가능합니다.`
        );
      }

      const reminder = new ReminderModel({
        userId,
        text: reminderData.text.trim(),
        reminderTime: reminderData.reminderTime || null,
        isRecurring: false,
        completed: false,
      });

      await reminder.save();

      logger.info(`🔔 리마인더 생성: ${userId}`);
      return this.createSuccessResponse(reminder, "리마인더가 생성되었습니다.");
    } catch (error) {
      logger.error("리마인더 생성 실패:", error);
      return this.createErrorResponse(error, "리마인더 생성에 실패했습니다.");
    }
  }

  /**
   * 사용자 리마인더 목록 조회
   */
  async getUserReminders(userId) {
    try {
      const ReminderModel = this.models.Reminder;

      const reminders = await ReminderModel.find({ userId, isActive: true })
        .sort({ createdAt: -1 })
        .lean();

      return this.createSuccessResponse(
        reminders,
        "리마인더 목록을 조회했습니다."
      );
    } catch (error) {
      logger.error("리마인더 목록 조회 실패:", error);
      return this.createErrorResponse(
        error,
        "리마인더 목록 조회에 실패했습니다."
      );
    }
  }

  /**
   * 리마인더 삭제
   */
  async deleteReminder(userId, reminderId) {
    try {
      const ReminderModel = this.models.Reminder;

      const result = await ReminderModel.findOneAndUpdate(
        { _id: reminderId, userId, isActive: true },
        {
          $set: {
            isActive: false,
            deletedAt: new Date(),
          },
        },
        { new: true }
      );

      if (!result) {
        throw new Error("리마인더를 찾을 수 없습니다.");
      }

      return this.createSuccessResponse(result, "리마인더가 삭제되었습니다.");
    } catch (error) {
      logger.error("리마인더 삭제 실패:", error);
      return this.createErrorResponse(error, "리마인더 삭제에 실패했습니다.");
    }
  }

  /**
   * 리마인더 완료 처리
   */
  async completeReminder(userId, reminderId) {
    try {
      const ReminderModel = this.models.Reminder;

      const result = await ReminderModel.findOneAndUpdate(
        { _id: reminderId, userId, isActive: true },
        {
          $set: {
            completed: true,
            completedAt: new Date(),
          },
        },
        { new: true }
      );

      if (!result) {
        throw new Error("리마인더를 찾을 수 없습니다.");
      }

      return this.createSuccessResponse(result, "리마인더가 완료되었습니다.");
    } catch (error) {
      logger.error("리마인더 완료 처리 실패:", error);
      return this.createErrorResponse(
        error,
        "리마인더 완료 처리에 실패했습니다."
      );
    }
  }

  /**
   * 예정된 리마인더 조회
   */
  async getUpcomingReminders() {
    try {
      const ReminderModel = this.models.Reminder;

      const now = new Date();
      const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000);

      const reminders = await ReminderModel.find({
        isActive: true,
        completed: false,
        reminderTime: {
          $gte: now,
          $lte: fiveMinutesLater,
        },
      }).lean();

      return this.createSuccessResponse(reminders);
    } catch (error) {
      logger.error("예정된 리마인더 조회 실패:", error);
      return this.createErrorResponse(error);
    }
  }

  /**
   * 상태 정보
   */
  getStatus() {
    return {
      ...super.getStatus(),
      maxRemindersPerUser: this.config.maxRemindersPerUser,
    };
  }
}

module.exports = ReminderService;
