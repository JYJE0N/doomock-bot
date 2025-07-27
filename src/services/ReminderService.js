class ReminderService {
  constructor(options = {}) {
    this.collectionName = "reminders";
    this.db = options.db || null;
    this.collection = null;
    this.config = {
      maxRemindersPerUser: 20,
      ...options.config,
    };

    logger.service("ReminderService", "서비스 생성");
  }

  async initialize() {
    if (!this.db) {
      throw new Error("Database connection required");
    }

    this.collection = this.db.collection(this.collectionName);
    await this.createIndexes();
    logger.success("ReminderService 초기화 완료");
  }

  async createIndexes() {
    try {
      await this.collection.createIndex({ userId: 1, createdAt: -1 });
      await this.collection.createIndex({ userId: 1, reminderTime: 1 });
    } catch (error) {
      logger.warn("리마인더 인덱스 생성 실패", error.message);
    }
  }

  async createReminder(userId, reminderData) {
    try {
      const userCount = await this.collection.countDocuments({
        userId,
        isActive: true,
      });

      if (userCount >= this.config.maxRemindersPerUser) {
        throw new Error(
          `리마인더는 최대 ${this.config.maxRemindersPerUser}개까지 등록 가능합니다.`
        );
      }

      const reminder = {
        userId,
        text: reminderData.text.trim(),
        reminderTime: reminderData.reminderTime || null,
        isRecurring: false,
        completed: false,

        // 표준 필드
        createdAt: TimeHelper.now(),
        updatedAt: TimeHelper.now(),
        version: 1,
        isActive: true,
      };

      const result = await this.collection.insertOne(reminder);
      const createdReminder = await this.collection.findOne({
        _id: result.insertedId,
      });

      logger.data("reminder", "create", userId, { text: reminder.text });
      return createdReminder;
    } catch (error) {
      logger.error("리마인더 생성 실패", error);
      throw error;
    }
  }

  async getUserReminders(userId) {
    try {
      const reminders = await this.collection
        .find({ userId, isActive: true })
        .sort({ createdAt: -1 })
        .toArray();

      logger.data("reminder", "list", userId, { count: reminders.length });
      return reminders;
    } catch (error) {
      logger.error("리마인더 목록 조회 실패", error);
      throw error;
    }
  }

  async deleteReminder(userId, reminderId) {
    try {
      const { ObjectId } = require("mongodb");
      const objectId = new ObjectId(reminderId);

      const result = await this.collection.updateOne(
        { _id: objectId, userId, isActive: true },
        {
          $set: {
            isActive: false,
            deletedAt: TimeHelper.now(),
            updatedAt: TimeHelper.now(),
            $inc: { version: 1 },
          },
        }
      );

      if (result.modifiedCount === 0) {
        throw new Error("리마인더를 찾을 수 없습니다.");
      }

      logger.data("reminder", "delete", userId, { reminderId });
      return true;
    } catch (error) {
      logger.error("리마인더 삭제 실패", error);
      throw error;
    }
  }

  async getUserStats(userId) {
    try {
      const total = await this.collection.countDocuments({
        userId,
        isActive: true,
      });

      const completed = await this.collection.countDocuments({
        userId,
        isActive: true,
        completed: true,
      });

      return {
        total,
        active: total - completed,
        completed,
      };
    } catch (error) {
      logger.error("리마인더 통계 조회 실패", error);
      return { total: 0, active: 0, completed: 0 };
    }
  }

  async cleanup() {
    logger.info("ReminderService 정리 완료");
  }
}
module.exports = ReminderService;
