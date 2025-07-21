// src/services/WorktimeService.js
const { getInstance } = require("../database/DatabaseManager");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const BaseService = require("./BaseService");

class WorktimeService extends BaseService {
  constructor(db) {
    super(db, "worktime");
    this.schedule = {
      start: "08:30",
      lunch: "11:30 ~ 13:00",
      end: "17:30",
      total: "7시간 30분",
    };
  }

  // 🎯 오늘 근무 기록 조회
  async getTodayRecord(userId) {
    try {
      const today = TimeHelper.getKoreaTime();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      const records = await this.db.collection("worktime_records").findOne({
        userId: userId,
        date: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      });

      return records;
    } catch (error) {
      logger.error("오늘 근무 기록 조회 실패:", error);
      return null;
    }
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
      const today = TimeHelper.getKoreaTime();
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
