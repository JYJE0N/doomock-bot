


class worktimeService {
    constructor() {
        this.schedule = {
            start: '08:30',
            lunch: '11:30 ~ 13:00',
            end: '17:30',
            total: '7시간 30분'
        };
    }

    getWorktimeInfo() {
        return {
            message: '💼 출근 완료! 오늘도 파이팅입니다.',
            schedule: `출근: ${this.schedule.start}\n점심: ${this.schedule.lunch}\n퇴근: ${this.schedule.end}`
        };
    }
}

module.exports = { worktimeService };
