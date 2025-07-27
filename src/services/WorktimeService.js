// ===== 💾 Enhanced WorktimeService - 화려한 근무시간 데이터 서비스 =====
// src/services/WorktimeService.js
const BaseService = require("./BaseService");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 💾 Enhanced WorktimeService v3.0.1 - 화려한 근무시간 데이터 서비스
 *
 * 🎯 Enhanced 특징:
 * - MongoDB 네이티브 드라이버
 * - 고급 집계 및 분석
 * - 실시간 세션 추적
 * - 성과 분석 시스템
 * - Enhanced Logger 통합
 */
class WorktimeService extends BaseService {
  constructor(options = {}) {
    super("work_sessions", options);

    // 🎨 Enhanced Logger - 서비스 시작
    logger.moduleStart("WorktimeService", "3.0.1");

    // 📋 비즈니스 규칙 (Enhanced)
    this.rules = {
      maxSessionsPerDay: 3, // 하루 최대 세션 수
      minWorkMinutes: 30, // 최소 근무 시간
      maxWorkHours: 16, // 최대 근무 시간
      maxBreakMinutes: 180, // 최대 휴식 시간 (3시간)
      allowedWorkTypes: [
        "regular",
        "remote",
        "hybrid",
        "business_trip",
        "conference",
      ],
      allowedStatuses: ["working", "break", "completed", "cancelled"],
    };

    // 📊 Enhanced 인덱스 설정
    this.indexes = [
      { userId: 1, date: -1 },
      { userId: 1, status: 1 },
      { userId: 1, startTime: -1 },
      { userId: 1, type: 1, date: -1 },
      { userId: 1, status: 1, startTime: -1 }, // 활성 세션 조회용
      { date: -1, totalHours: -1 }, // 일별 통계용
      { userId: 1, date: -1, totalHours: -1 }, // 사용자별 일별 통계
    ];

    logger.success("💾 Enhanced WorktimeService 생성됨");
  }

  /**
   * 🏢 Enhanced 근무 세션 생성
   */
  async createWorkSession(userId, sessionData) {
    try {
      logger.info("🏢 Enhanced WorkSession 생성 시작", {
        service: "WorktimeService",
        userId,
        type: sessionData.type,
        startTime: TimeHelper.format(sessionData.startTime, "HH:mm"),
      });

      // 검증
      this.validateWorkSessionData(userId, sessionData);

      // 오늘 세션 수 체크
      const todaySessionCount = await this.getTodaySessionCount(userId);
      if (todaySessionCount >= this.rules.maxSessionsPerDay) {
        const error = new Error(
          `하루 최대 ${this.rules.maxSessionsPerDay}개 세션까지만 생성 가능합니다`
        );
        logger.warn("⚠️ 세션 한도 초과", {
          userId,
          todayCount: todaySessionCount,
          maxAllowed: this.rules.maxSessionsPerDay,
        });
        throw error;
      }

      // Enhanced 문서 준비
      const document = {
        userId,
        date: TimeHelper.getKoreanDate(),
        startTime: sessionData.startTime,
        endTime: sessionData.endTime || null,
        type: sessionData.type || "regular",
        status: sessionData.status || "working",
        location: sessionData.location || "office",

        // 시간 계산 필드들
        totalHours: 0,
        totalBreakTime: 0,
        actualWorkTime: 0,

        // 휴식 관리
        breaks: sessionData.breaks || [],

        // 메타데이터
        metadata: {
          userName: sessionData.metadata?.userName,
          source: "telegram",
          version: "3.0.1",
          enhanced: true,
          ...sessionData.metadata,
        },

        // 분석용 필드들
        punctualityScore: null,
        productivityScore: null,
        notes: sessionData.notes || "",

        ...this.getStandardFields(),
      };

      // 저장
      const result = await this.create(document);

      logger.success("✅ Enhanced WorkSession 생성 완료", {
        service: "WorktimeService",
        sessionId: result.insertedId,
        type: document.type,
        startTime: TimeHelper.format(document.startTime, "HH:mm"),
      });

      return {
        id: result.insertedId,
        ...document,
      };
    } catch (error) {
      logger.error("❌ Enhanced WorkSession 생성 실패:", error);
      throw error;
    }
  }

  /**
   * 📊 오늘 통계 조회
   */
  async getTodayStats(userId) {
    try {
      const today = TimeHelper.getKoreanDate();

      logger.debug("📊 오늘 근무 통계 조회", {
        service: "WorktimeService",
        userId,
        date: today,
      });

      const pipeline = [
        {
          $match: {
            userId,
            date: today,
            isActive: true,
          },
        },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            totalHours: { $sum: "$totalHours" },
            totalBreakTime: { $sum: "$totalBreakTime" },
            avgProductivity: { $avg: "$productivityScore" },
            workTypes: { $push: "$type" },
            firstCheckIn: { $min: "$startTime" },
            lastCheckOut: { $max: "$endTime" },
          },
        },
      ];

      const [stats] = await this.aggregate(pipeline);

      if (!stats) {
        return {
          totalSessions: 0,
          totalHours: 0,
          totalBreakTime: 0,
          avgProductivity: 0,
          workTypes: [],
          firstCheckIn: null,
          lastCheckOut: null,
          hasActiveSession: false,
        };
      }

      // 활성 세션 체크
      const activeSession = await this.findOne({
        userId,
        date: today,
        status: { $in: ["working", "break"] },
        isActive: true,
      });

      stats.hasActiveSession = !!activeSession;

      return stats;
    } catch (error) {
      logger.error("❌ 오늘 통계 조회 실패:", error);
      throw error;
    }
  }

  /**
   * 📅 현재 주 통계 조회
   */
  async getCurrentWeekStats(userId) {
    try {
      const weekStart = TimeHelper.getWeekStart();
      const weekEnd = TimeHelper.getWeekEnd();

      logger.debug("📅 현재 주 통계 조회", {
        service: "WorktimeService",
        userId,
        weekStart: TimeHelper.format(weekStart, "YYYY-MM-DD"),
        weekEnd: TimeHelper.format(weekEnd, "YYYY-MM-DD"),
      });

      const pipeline = [
        {
          $match: {
            userId,
            date: { $gte: weekStart, $lte: weekEnd },
            isActive: true,
            status: "completed",
          },
        },
        {
          $group: {
            _id: null,
            totalHours: { $sum: "$totalHours" },
            totalBreakTime: { $sum: "$totalBreakTime" },
            workDays: { $sum: 1 },
            avgDailyHours: { $avg: "$totalHours" },
            maxDailyHours: { $max: "$totalHours" },
            minDailyHours: { $min: "$totalHours" },
            overtimeDays: {
              $sum: { $cond: [{ $gt: ["$totalHours", 8] }, 1, 0] },
            },
          },
        },
      ];

      const [stats] = await this.aggregate(pipeline);

      if (!stats) {
        return {
          totalHours: 0,
          totalBreakTime: 0,
          workDays: 0,
          avgDailyHours: 0,
          maxDailyHours: 0,
          minDailyHours: 0,
          overtimeDays: 0,
        };
      }

      return stats;
    } catch (error) {
      logger.error("❌ 현재 주 통계 조회 실패:", error);
      throw error;
    }
  }

  /**
   * 🗓️ 현재 월 통계 조회
   */
  async getCurrentMonthStats(userId) {
    try {
      const monthStart = TimeHelper.getMonthStart();
      const monthEnd = TimeHelper.getMonthEnd();

      const pipeline = [
        {
          $match: {
            userId,
            date: { $gte: monthStart, $lte: monthEnd },
            isActive: true,
            status: "completed",
          },
        },
        {
          $group: {
            _id: null,
            totalHours: { $sum: "$totalHours" },
            totalWorkDays: { $sum: 1 },
            avgDailyHours: { $avg: "$totalHours" },
            totalOvertimeHours: {
              $sum: {
                $cond: [
                  { $gt: ["$totalHours", 8] },
                  { $subtract: ["$totalHours", 8] },
                  0,
                ],
              },
            },
            perfectDays: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ["$totalHours", 7.5] },
                      { $lte: ["$totalHours", 8.5] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ];

      const [stats] = await this.aggregate(pipeline);

      return (
        stats || {
          totalHours: 0,
          totalWorkDays: 0,
          avgDailyHours: 0,
          totalOvertimeHours: 0,
          perfectDays: 0,
        }
      );
    } catch (error) {
      logger.error("❌ 현재 월 통계 조회 실패:", error);
      throw error;
    }
  }

  /**
   * 🔍 데이터 검증 (Enhanced)
   */
  validateWorkSessionData(userId, data) {
    if (!userId) {
      throw new Error("사용자 ID가 필요합니다");
    }

    if (!data.startTime) {
      throw new Error("시작 시간이 필요합니다");
    }

    if (data.type && !this.rules.allowedWorkTypes.includes(data.type)) {
      throw new Error(`허용되지 않은 근무 유형입니다: ${data.type}`);
    }

    if (data.status && !this.rules.allowedStatuses.includes(data.status)) {
      throw new Error(`허용되지 않은 상태입니다: ${data.status}`);
    }

    // 시간 유효성 검증
    if (data.endTime && data.endTime <= data.startTime) {
      throw new Error("종료 시간은 시작 시간보다 늦어야 합니다");
    }
  }

  /**
   * 🔢 오늘 세션 수 조회
   */
  async getTodaySessionCount(userId) {
    const today = TimeHelper.getKoreanDate();
    return await this.count({
      userId,
      date: today,
      isActive: true,
    });
  }

  /**
   * 🔄 활성 세션들 조회
   */
  async getActiveSessions() {
    try {
      const activeSessions = await this.find({
        status: { $in: ["working", "break"] },
        isActive: true,
      });

      return activeSessions;
    } catch (error) {
      logger.error("❌ 활성 세션 조회 실패:", error);
      throw error;
    }
  }
}

module.exports = WorktimeService;
