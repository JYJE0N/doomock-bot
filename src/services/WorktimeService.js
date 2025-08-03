// src/services/WorktimeService.js - 데이터 처리 개선 버전

const BaseService = require("./BaseService");
const TimeHelper = require("../utils/TimeHelper");
const logger = require("../utils/Logger");

/**
 * 🏢 WorktimeService - 근무시간 데이터 관리 (데이터 처리 개선)
 *
 * 🎯 핵심 개선사항:
 * - 데이터베이스에서 가져온 시간 데이터의 안전한 처리
 * - null/undefined 값에 대한 방어 코드
 * - 일관된 데이터 형식으로 변환
 */
class WorktimeService extends BaseService {
  constructor(options = {}) {
    super("WorktimeService", options); // 🔥 서비스 이름 추가!
    this.activeSessions = new Map();
  }

  // 🔥 이 메서드 추가!
  getRequiredModels() {
    return ["Worktime"];
  }

  /**
   * ⏰ DB 시간 데이터 안전 변환
   * @param {any} dbTimeData - DB에서 가져온 시간 데이터
   * @returns {Date|null} 안전한 Date 객체 또는 null
   */
  safeDateFromDB(dbTimeData) {
    if (!dbTimeData) return null;

    try {
      // MongoDB의 Date 객체 처리
      if (dbTimeData instanceof Date) {
        return dbTimeData;
      }

      // 문자열인 경우
      if (typeof dbTimeData === "string") {
        const parsed = new Date(dbTimeData);
        return isNaN(parsed.getTime()) ? null : parsed;
      }

      // 기타 형식 시도
      const attempt = new Date(dbTimeData);
      return isNaN(attempt.getTime()) ? null : attempt;
    } catch (error) {
      logger.warn("DB 시간 변환 실패:", dbTimeData, error.message);
      return null;
    }
  }

  /**
   * 📋 워크타임 레코드 안전 변환
   * @param {object} record - DB 레코드
   * @returns {object} 안전하게 변환된 레코드
   */
  safeTransformRecord(record) {
    if (!record) return null;

    const transformed = {
      ...(record.toObject ? record.toObject() : record),

      // 시간 필드들을 안전하게 변환
      checkInTime: this.safeDateFromDB(record.checkInTime),
      checkOutTime: this.safeDateFromDB(record.checkOutTime),
      createdAt: this.safeDateFromDB(record.createdAt),
      updatedAt: this.safeDateFromDB(record.updatedAt),

      // 표시용 시간 문자열 추가
      checkInDisplay: TimeHelper.safeDisplayTime(record.checkInTime),
      checkOutDisplay: TimeHelper.safeDisplayTime(record.checkOutTime),

      // 날짜 문자열 (정렬용)
      dateString: record.date || TimeHelper.format(record.createdAt, "date")
    };

    // 근무시간 계산 (안전하게)
    if (transformed.checkInTime && transformed.checkOutTime) {
      const duration = TimeHelper.diffMinutes(
        transformed.checkInTime,
        transformed.checkOutTime
      );
      transformed.workDuration = Math.max(0, duration);
      transformed.workDurationDisplay = this.formatWorkDuration(duration);
    }

    return transformed;
  }

  async checkIn(userId) {
    try {
      const now = new Date();
      const today = TimeHelper.getTodayDateString();

      // 🔥 현재 근무 중인 기록이 있는지만 확인
      const workingRecord = await this.models.Worktime.findOne({
        userId: userId,
        status: "working",
        checkOutTime: null,
        isActive: true
      });

      if (workingRecord) {
        throw new Error("이미 출근 중입니다. 먼저 퇴근을 해주세요!");
      }

      // 🔥 새 출근 기록 생성 (하루에 여러 개 가능)
      const record = await this.models.Worktime.create({
        userId: userId,
        date: today, // 출근 시점의 날짜
        checkInTime: now,
        status: "working",
        isActive: true
      });

      logger.info(`✅ 출근 기록: ${userId} at ${now}`);
      return this.safeTransformRecord(record);
    } catch (error) {
      logger.error("출근 처리 실패:", error);
      throw error;
    }
  }

  /**
   * 🏠 퇴근 처리
   */
  async checkOut(userId) {
    try {
      const now = new Date();

      // 🔥 현재 근무 중인 기록 찾기 (날짜 상관없이)
      const record = await this.models.Worktime.findOne({
        userId: userId,
        status: "working",
        checkOutTime: null,
        isActive: true
      }).sort({ checkInTime: -1 }); // 가장 최근 출근 기록

      if (!record) {
        throw new Error("출근 기록이 없습니다.");
      }

      // 퇴근 처리
      record.checkOutTime = now;
      record.status = "completed";

      // 🔥 근무시간 계산 (자정 넘어도 정확히 계산)
      const workDuration = TimeHelper.diffMinutes(record.checkInTime, now);
      record.workDuration = workDuration;

      // 🔥 야간근무 체크 (22시~06시)
      const checkInHour = record.checkInTime.getHours();
      const checkOutHour = now.getHours();

      if (
        checkOutHour < 6 ||
        checkOutHour >= 22 ||
        checkInHour < 6 ||
        checkInHour >= 22
      ) {
        record.workType = "night"; // 야간근무
      }

      // 초과근무 계산
      const overtimeMinutes = Math.max(0, workDuration - 480);
      record.regularHours = Math.floor(Math.min(workDuration, 480) / 60);
      record.overtimeHours = Math.floor(overtimeMinutes / 60);

      await record.save();

      logger.info(`✅ 퇴근 기록: ${userId} - ${workDuration}분 근무`);

      const transformed = this.safeTransformRecord(record);
      transformed.overtimeMinutes = overtimeMinutes;

      return transformed;
    } catch (error) {
      logger.error("퇴근 처리 실패:", error);
      throw error;
    }
  }

  /**
   * 📅 오늘 근무 기록 조회 (개선됨)
   */
  async getTodayRecord(userId) {
    try {
      const today = TimeHelper.getTodayDateString();

      // 🔥 먼저 현재 근무 중인지 확인 (날짜 무관)
      const workingRecord = await this.models.Worktime.findOne({
        userId: userId,
        status: "working",
        checkOutTime: null,
        isActive: true
      }).sort({ checkInTime: -1 });

      if (workingRecord) {
        const transformed = this.safeTransformRecord(workingRecord);
        const currentDuration = this.calculateCurrentWorkDuration(
          transformed.checkInTime,
          new Date()
        );

        return {
          ...transformed,
          currentWorkDuration: currentDuration,
          isWorking: true
        };
      }

      // 🔥 오늘 완료된 기록들의 합계 계산
      const todayRecords = await this.models.Worktime.find({
        userId: userId,
        date: today,
        status: "completed",
        isActive: true
      });

      if (todayRecords.length === 0) {
        return null;
      }

      // 🔥 오늘 총 근무시간 합산
      const totalWorkDuration = todayRecords.reduce((sum, record) => {
        return sum + (record.workDuration || 0);
      }, 0);

      // 가장 최근 기록 반환
      const lastRecord = todayRecords[todayRecords.length - 1];
      const transformed = this.safeTransformRecord(lastRecord);

      return {
        ...transformed,
        workDuration: totalWorkDuration, // 합산된 시간
        isWorking: false,
        todayRecordCount: todayRecords.length // 오늘 출퇴근 횟수
      };
    } catch (error) {
      logger.error("오늘 기록 조회 실패:", error);
      throw error;
    }
  }

  /**
   * 📊 주간 통계 조회 (개선됨)
   */
  async getWeekStats(userId) {
    try {
      const weekStart = TimeHelper.getWeekStart();
      const weekEnd = TimeHelper.getWeekEnd();

      const records = await this.models.Worktime.find({
        userId: userId,
        date: {
          $gte: TimeHelper.format(weekStart, "date"),
          $lte: TimeHelper.format(weekEnd, "date")
        },
        isActive: true,
        // ✅ 수정: checkOutTime 필터 완화 (출근만 있어도 표시)
        $or: [
          { checkOutTime: { $exists: true, $ne: null } }, // 퇴근 완료
          { checkInTime: { $exists: true, $ne: null } } // 출근만 있어도 표시
        ]
      }).sort({ date: 1 });

      // ✅ 수정: 필터링 조건 완화 - 출근 기록만 있어도 표시
      const safeRecords = records
        .map((record) => this.safeTransformRecord(record))
        .filter((record) => record && record.checkInTime); // workDuration > 0 조건 제거

      const stats = this.calculateWeeklyStats(safeRecords);

      return {
        weekStart: TimeHelper.format(weekStart, "date"),
        weekEnd: TimeHelper.format(weekEnd, "date"),
        workDays: safeRecords.length,
        totalHours: Math.round((stats.totalMinutes / 60) * 10) / 10,
        overtimeHours: Math.round((stats.overtimeMinutes / 60) * 10) / 10,
        avgDailyHours:
          safeRecords.length > 0
            ? Math.round((stats.totalMinutes / safeRecords.length / 60) * 10) / 10
            : 0,
        records: safeRecords,
        analysis: this.analyzeWeeklyPattern(safeRecords)
      };
    } catch (error) {
      logger.error("주간 통계 조회 실패:", error);
      throw error;
    }
  }

  /**
   * 📈 월간 통계 조회 (개선됨)
   */
  async getMonthStats(userId) {
    try {
      const monthStart = TimeHelper.getMonthStart();
      const monthEnd = TimeHelper.getMonthEnd();

      const records = await this.models.Worktime.find({
        userId: userId,
        date: {
          $gte: TimeHelper.format(monthStart, "date"),
          $lte: TimeHelper.format(monthEnd, "date")
        },
        isActive: true,
        // ✅ 수정: 필터링 완화
        $or: [
          { checkOutTime: { $exists: true, $ne: null } },
          { checkInTime: { $exists: true, $ne: null } }
        ]
      }).sort({ date: 1 });

      // ✅ 수정: 출근 기록만 있어도 표시
      const safeRecords = records
        .map((record) => this.safeTransformRecord(record))
        .filter((record) => record && record.checkInTime);

      const stats = this.calculateMonthlyStats(safeRecords);

      return {
        month: TimeHelper.format(monthStart, "MM"),
        year: TimeHelper.format(monthStart, "YYYY"),
        workDays: safeRecords.length,
        totalHours: Math.round((stats.totalMinutes / 60) * 10) / 10,
        overtimeHours: Math.round((stats.overtimeMinutes / 60) * 10) / 10,
        avgDailyHours:
          safeRecords.length > 0
            ? Math.round((stats.totalMinutes / safeRecords.length / 60) * 10) / 10
            : 0,
        records: safeRecords,
        performance: this.analyzeMonthlyPerformance(safeRecords),
        trends: this.analyzeMonthlyTrends(safeRecords)
      };
    } catch (error) {
      logger.error("월간 통계 조회 실패:", error);
      throw error;
    }
  }

  /**
   * ⏱️ 현재 근무시간 계산 (안전)
   * @param {Date} checkInTime - 출근 시간
   * @param {Date} currentTime - 현재 시간
   * @returns {number} 근무 시간(분)
   */
  calculateCurrentWorkDuration(checkInTime, currentTime) {
    if (!checkInTime || !currentTime) return 0;

    const safeCheckIn = this.safeDateFromDB(checkInTime);
    const safeCurrentTime = this.safeDateFromDB(currentTime);

    if (!safeCheckIn || !safeCurrentTime) return 0;

    return Math.max(0, TimeHelper.diffMinutes(safeCheckIn, safeCurrentTime));
  }

  /**
   * 📊 주간 통계 계산
   * @param {Array} records - 안전하게 변환된 레코드들
   * @returns {object} 통계 데이터
   */
  calculateWeeklyStats(records) {
    let totalMinutes = 0;
    let overtimeMinutes = 0;

    records.forEach((record) => {
      // ✅ 수정: workDuration이 0이어도 처리 (출근만 있는 경우)
      if (record.workDuration >= 0) {
        // > 0 에서 >= 0 으로 변경
        totalMinutes += record.workDuration || 0;

        // 8시간(480분) 초과시 초과근무
        if (record.workDuration > 480) {
          overtimeMinutes += record.workDuration - 480;
        }
      }
    });

    return { totalMinutes, overtimeMinutes };
  }

  /**
   * 📊 월간 통계 계산
   * @param {Array} records - 안전하게 변환된 레코드들
   * @returns {object} 통계 데이터
   */
  calculateMonthlyStats(records) {
    return this.calculateWeeklyStats(records); // 같은 로직 재사용
  }

  /**
   * ⏱️ 근무시간 포맷팅
   * @param {number} minutes - 분 단위 시간
   * @returns {string} 포맷된 문자열
   */
  formatWorkDuration(minutes) {
    if (!minutes || minutes <= 0) return "0분";

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours === 0) return `${remainingMinutes}분`;
    if (remainingMinutes === 0) return `${hours}시간`;

    return `${hours}시간 ${remainingMinutes}분`;
  }

  /**
   * 📈 주간 패턴 분석 (기본 구현)
   */
  analyzeWeeklyPattern(records) {
    if (records.length === 0) {
      return {
        trend: "데이터 없음",
        recommendation: "근무 기록을 시작해보세요."
      };
    }

    const avgHours =
      records.reduce((sum, r) => sum + r.workDuration, 0) / records.length / 60;

    if (avgHours >= 8) {
      return {
        trend: "안정적인 근무 패턴",
        recommendation: "현재 패턴을 유지하세요."
      };
    } else {
      return {
        trend: "근무시간 부족",
        recommendation: "목표 시간 달성을 위해 노력해보세요."
      };
    }
  }

  /**
   * 📊 월간 성과 분석 (기본 구현)
   */
  analyzeMonthlyPerformance(records) {
    if (records.length === 0) {
      return { emoji: "📝", txt: "기록이 없습니다." };
    }

    const avgDaily =
      records.reduce((sum, r) => sum + r.workDuration, 0) / records.length / 60;

    if (avgDaily >= 8) {
      return { emoji: "🏆", txt: "우수한 근무 성과" };
    } else if (avgDaily >= 6) {
      return { emoji: "👍", txt: "양호한 근무 성과" };
    } else {
      return { emoji: "📈", txt: "개선이 필요함" };
    }
  }

  /**
   * 📈 월간 트렌드 분석 (기본 구현)
   */
  analyzeMonthlyTrends(records) {
    return {
      weeklyTrend: "안정적",
      monthlyTrend: "증가 추세",
      recommendation: "현재 패턴 유지"
    };
  }
}

module.exports = WorktimeService;
