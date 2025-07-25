const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const BaseService = require("./BaseService");

class WorktimeService extends BaseService {
  constructor(db) {
    super("worktime", {
      db: db, // ✅ db를 options 객체에 포함
      enableCache: true,
      cacheTimeout: 60000,
    });

    // 설정
    this.workHours = {
      start: 9, // 9시
      end: 18, // 18시
      lunchStart: 12,
      lunchEnd: 13,
    };

    logger.info("🕐 WorktimeService 생성됨");
  }

  async initialize() {
    try {
      // BaseService의 initialize 호출 (중요!)
      await super.initialize();

      // collection 확인
      if (!this.collection) {
        logger.warn(
          "⚠️ WorktimeService: collection이 없습니다. DB 연결 확인 필요"
        );
      }

      logger.info("✅ WorktimeService 초기화 성공");
      return true;
    } catch (error) {
      logger.error("❌ WorktimeService 초기화 실패:", error);
      return false;
    }
  }
  // 🎯 오늘 근무 기록 조회
  async getTodayRecord(userId) {
    try {
      // collection 체크
      if (!this.collection) {
        logger.error("WorktimeService: collection이 초기화되지 않음");
        return null;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const record = await this.collection.findOne({
        userId: userId,
        date: {
          $gte: today,
          $lt: tomorrow,
        },
      });

      return record;
    } catch (error) {
      logger.error("오늘 근무 기록 조회 실패:", error);
      return null;
    }
  }
  // WorktimeService에 추가할 메서드
  async getRecentHistory(userId, days = 7) {
    try {
      // DB 모드
      if (this.collection) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);

        const records = await this.collection
          .find({
            userId: userId,
            date: {
              $gte: startDate,
              $lte: endDate,
            },
          })
          .sort({ date: -1 })
          .toArray();

        return records;
      }
      // 메모리 모드
      else {
        const records = [];
        const endDate = new Date();

        for (let i = 0; i < days; i++) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const key = `${userId}_${date.toDateString()}`;
          const record = this.memoryStorage.get(key);
          if (record) {
            records.push(record);
          }
        }

        return records;
      }
    } catch (error) {
      logger.error("근무 기록 조회 실패:", error);
      return [];
    }
  }

  // 주간 통계 조회 메서드
  async getWeeklyStats(userId) {
    try {
      const records = await this.getRecentHistory(userId, 7);

      let totalMinutes = 0;
      let workDays = 0;
      let avgCheckIn = 0;
      let avgCheckOut = 0;

      records.forEach((record) => {
        if (record.checkIn) {
          workDays++;
          totalMinutes += record.totalMinutes || 0;

          const checkInHour = new Date(record.checkIn).getHours();
          const checkInMinute = new Date(record.checkIn).getMinutes();
          avgCheckIn += checkInHour + checkInMinute / 60;

          if (record.checkOut) {
            const checkOutHour = new Date(record.checkOut).getHours();
            const checkOutMinute = new Date(record.checkOut).getMinutes();
            avgCheckOut += checkOutHour + checkOutMinute / 60;
          }
        }
      });

      if (workDays > 0) {
        avgCheckIn = avgCheckIn / workDays;
        avgCheckOut = avgCheckOut / workDays;
      }

      return {
        totalMinutes,
        workDays,
        avgCheckIn: this.formatTime(avgCheckIn),
        avgCheckOut: this.formatTime(avgCheckOut),
        avgWorkHours: Math.round((totalMinutes / workDays / 60) * 10) / 10,
      };
    } catch (error) {
      logger.error("주간 통계 조회 실패:", error);
      return null;
    }
  }

  // 시간 포맷 헬퍼
  formatTime(decimalHours) {
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  }

  // 🎯 주간 근무 기록 조회
  async getWeeklyHistory(userId) {
    try {
      const today = TimeHelper.getKoreaTime();
      const dayOfWeek = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
      monday.setHours(0, 0, 0, 0);

      const records = await this.db
        .collection("worktime_records")
        .find({
          userId: userId,
          date: { $gte: monday },
        })
        .sort({ date: 1 })
        .toArray();

      // 주간 데이터 포맷팅
      const weekData = [];
      for (let i = 0; i < 5; i++) {
        // 월-금
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);

        const record = records.find((r) => {
          const recordDate = new Date(r.date);
          return recordDate.toDateString() === date.toDateString();
        });

        weekData.push({
          date: date,
          dayName: ["월", "화", "수", "목", "금"][i],
          checkIn: record?.checkIn || null,
          checkOut: record?.checkOut || null,
          workHours: record
            ? this.calculateWorkHours(record.checkIn, record.checkOut)
            : null,
          memo: record?.memo || null,
        });
      }

      return weekData;
    } catch (error) {
      logger.error("주간 근무 기록 조회 실패:", error);
      return [];
    }
  }

  // 🎯 출근 처리
  async checkIn(userId, checkInTime) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 이미 출근했는지 확인
      const existingRecord = await this.getTodayRecord(userId);
      if (existingRecord?.checkIn) {
        return {
          success: false,
          error: "이미 출근하셨습니다.",
        };
      }

      // 출근 시간 체크 (08:30 기준)
      const checkInDate = new Date(`${today.toDateString()} ${checkInTime}`);
      const startTime = new Date(
        `${today.toDateString()} ${this.schedule.start}`
      );
      const isLate = checkInDate > startTime;

      // 출근 기록 저장
      const result = await this.db.collection("worktime_records").insertOne({
        userId: userId,
        date: today,
        checkIn: checkInTime,
        checkOut: null,
        isLate: isLate,
        createdAt: TimeHelper.getKoreaTime(),
        updatedAt: TimeHelper.getKoreaTime(),
      });

      return {
        success: true,
        isLate: isLate,
        recordId: result.insertedId,
      };
    } catch (error) {
      logger.error("출근 처리 실패:", error);
      return {
        success: false,
        error: "출근 처리 중 오류가 발생했습니다.",
      };
    }
  }

  // 🎯 퇴근 처리
  async checkOut(userId, checkOutTime) {
    try {
      const todayRecord = await this.getTodayRecord(userId);

      if (!todayRecord) {
        return {
          success: false,
          error: "출근 기록이 없습니다.",
        };
      }

      if (todayRecord.checkOut) {
        return {
          success: false,
          error: "이미 퇴근하셨습니다.",
        };
      }

      // 퇴근 시간 체크 (17:30 기준)
      const today = TimeHelper.getKoreaTime();
      const checkOutDate = new Date(`${today.toDateString()} ${checkOutTime}`);
      const endTime = new Date(`${today.toDateString()} ${this.schedule.end}`);
      const isOvertime = checkOutDate > endTime;

      // 퇴근 기록 업데이트
      const result = await this.db.collection("worktime_records").updateOne(
        { _id: todayRecord._id },
        {
          $set: {
            checkOut: checkOutTime,
            isOvertime: isOvertime,
            updatedAt: TimeHelper.getKoreaTime(),
          },
        }
      );

      return {
        success: true,
        isOvertime: isOvertime,
      };
    } catch (error) {
      logger.error("퇴근 처리 실패:", error);
      return {
        success: false,
        error: "퇴근 처리 중 오류가 발생했습니다.",
      };
    }
  }

  // 🎯 근무 시간 계산
  calculateWorkHours(checkIn, checkOut) {
    if (!checkIn || !checkOut) return null;

    const today = TimeHelper.getKoreaTime().toDateString();
    const checkInTime = new Date(`${today} ${checkIn}`);
    const checkOutTime = new Date(`${today} ${checkOut}`);

    // 점심시간 제외 (11:30 ~ 13:00)
    const lunchStart = new Date(`${today} 11:30`);
    const lunchEnd = new Date(`${today} 13:00`);

    let totalMinutes = (checkOutTime - checkInTime) / (1000 * 60);

    // 점심시간이 근무시간에 포함되는 경우 제외
    if (checkInTime < lunchEnd && checkOutTime > lunchStart) {
      const lunchOverlapStart = Math.max(checkInTime, lunchStart);
      const lunchOverlapEnd = Math.min(checkOutTime, lunchEnd);
      const lunchMinutes = (lunchOverlapEnd - lunchOverlapStart) / (1000 * 60);
      totalMinutes -= lunchMinutes;
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);

    return { hours, minutes, totalMinutes };
  }

  // 기존 메서드들 유지
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

  // 기존 checkInOut 메서드는 폐기 (checkIn, checkOut으로 분리)
}

module.exports = WorktimeService;
