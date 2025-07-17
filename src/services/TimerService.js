const { TimeHelper } = require('../utils/TimeHelper');
const { Logger } = require('../utils/Logger');

class TimerService {
    constructor() {
        this.timers = new Map(); // userId -> { taskName, startTime }
    }

    start(userId, taskName) {
        try {
            if (this.timers.has(userId)) {
                return {
                    success: false,
                    error: '이미 실행 중인 타이머가 있습니다. 먼저 정지해주세요.'
                };
            }

            this.timers.set(userId, {
                taskName,
                startTime: TimeHelper.getKoreaTime()
            });

            Logger.info(`⏱️ 타이머 시작: 사용자 ${userId}, 작업 "${taskName}"`);

            return {
                success: true,
                data: { taskName }
            };
        } catch (error) {
            Logger.error('⛔ 타이머 시작 오류:', error);
            return {
                success: false,
                error: '타이머 시작 중 오류가 발생했습니다.'
            };
        }
    }

    stop(userId) {
        try {
            const timer = this.timers.get(userId);
            if (!timer) {
                return {
                    success: false,
                    error: '실행 중인 타이머가 없습니다.'
                };
            }

            const duration = Math.floor((TimeHelper.getKoreaTime() - timer.startTime) / 60000);
            this.timers.delete(userId);

            Logger.info(`🛑 타이머 정지: 사용자 ${userId}, 소요시간 ${duration}분`);

            return {
                success: true,
                data: { ...timer, duration }
            };
        } catch (error) {
            Logger.error('⛔ 타이머 정지 오류:', error);
            return {
                success: false,
                error: '타이머 정지 중 오류가 발생했습니다.'
            };
        }
    }

    status(userId) {
        try {
            const timer = this.timers.get(userId);
            if (!timer) {
                return {
                    success: false,
                    error: '실행 중인 타이머가 없습니다.'
                };
            }

            const now = TimeHelper.getKoreaTime();
            const duration = Math.floor((now - timer.startTime) / 60000);

            return {
                success: true,
                data: { ...timer, duration }
            };
        } catch (error) {
            Logger.error('⛔ 타이머 상태 확인 오류:', error);
            return {
                success: false,
                error: '타이머 상태 확인 중 오류가 발생했습니다.'
            };
        }
    }
}

module.exports = { TimerService };
