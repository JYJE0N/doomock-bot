const BaseService = require("./BaseService");
const logger = require("../utils/Logger");

/**
 * 🍅 TimerService - 타이머 데이터 서비스 (심플 버전)
 */
class TimerService extends BaseService {
  constructor(options = {}) {
    super("TimerService", options);

    // 임시 메모리 저장소 (나중에 Mongoose로 변경)
    this.sessions = new Map();
  }

  getRequiredModels() {
    return ["Timer"]; // 나중에 ["TimerSession"] 추가
  }

  async startSession(userId, sessionData) {
    try {
      const session = {
        _id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: userId.toString(),
        type: sessionData.type,
        duration: sessionData.duration,
        status: "active",
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.sessions.set(session._id, session);

      return this.createSuccessResponse(session, "세션이 시작되었습니다.");
    } catch (error) {
      return this.createErrorResponse(error, "세션 시작 실패");
    }
  }

  async pauseSession(sessionId) {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return this.createErrorResponse(
          new Error("SESSION_NOT_FOUND"),
          "세션을 찾을 수 없습니다."
        );
      }

      session.status = "paused";
      session.pausedAt = new Date();
      session.updatedAt = new Date();

      return this.createSuccessResponse(session, "세션이 일시정지되었습니다.");
    } catch (error) {
      return this.createErrorResponse(error, "세션 일시정지 실패");
    }
  }

  async resumeSession(sessionId) {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return this.createErrorResponse(
          new Error("SESSION_NOT_FOUND"),
          "세션을 찾을 수 없습니다."
        );
      }

      session.status = "active";
      session.resumedAt = new Date();
      session.updatedAt = new Date();

      return this.createSuccessResponse(session, "세션이 재개되었습니다.");
    } catch (error) {
      return this.createErrorResponse(error, "세션 재개 실패");
    }
  }

  async stopSession(sessionId) {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return this.createErrorResponse(
          new Error("SESSION_NOT_FOUND"),
          "세션을 찾을 수 없습니다."
        );
      }

      session.status = "stopped";
      session.stoppedAt = new Date();
      session.updatedAt = new Date();

      return this.createSuccessResponse(session, "세션이 중지되었습니다.");
    } catch (error) {
      return this.createErrorResponse(error, "세션 중지 실패");
    }
  }

  async completeSession(sessionId) {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return this.createErrorResponse(
          new Error("SESSION_NOT_FOUND"),
          "세션을 찾을 수 없습니다."
        );
      }

      session.status = "completed";
      session.completedAt = new Date();
      session.updatedAt = new Date();

      return this.createSuccessResponse(session, "세션이 완료되었습니다.");
    } catch (error) {
      return this.createErrorResponse(error, "세션 완료 실패");
    }
  }

  async getUserSessions(userId, options = {}) {
    try {
      const userSessions = Array.from(this.sessions.values())
        .filter((session) => session.userId === userId.toString())
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const { limit = 10 } = options;
      const recentSessions = userSessions.slice(0, limit);

      return this.createSuccessResponse({
        sessions: recentSessions,
        totalCount: userSessions.length,
      });
    } catch (error) {
      return this.createErrorResponse(error, "세션 조회 실패");
    }
  }
}

module.exports = TimerService;
