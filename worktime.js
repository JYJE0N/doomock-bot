const { Utils } = require('./utils');

// 고정된 근무시간 상수
const WORK_SCHEDULE = {
  start: { hours: 8, minutes: 30 },
  end: { hours: 17, minutes: 30 }
};

class WorkTimeManager {
  calculateWorkHours() {
    const startMinutes = Utils.timeToMinutes(WORK_SCHEDULE.start);
    const endMinutes = Utils.timeToMinutes(WORK_SCHEDULE.end);
    const totalMinutes = endMinutes - startMinutes;
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return { hours, minutes, totalMinutes };
  }
  
  getWorkStatus() {
    const now = new Date();
    const currentMinutes = Utils.timeToMinutes(Utils.getCurrentTime());
    const startMinutes = Utils.timeToMinutes(WORK_SCHEDULE.start);
    const endMinutes = Utils.timeToMinutes(WORK_SCHEDULE.end);
    
    if (currentMinutes < startMinutes) {
      // 아직 업무 시작 전
      const remainingMinutes = startMinutes - currentMinutes;
      const hours = Math.floor(remainingMinutes / 60);
      const minutes = remainingMinutes % 60;
      return { 
        type: 'before_work', 
        hours, 
        minutes,
        message: `⏳ 업무 시작까지: ${hours}시간 ${minutes}분 남음`
      };
    } else if (currentMinutes < endMinutes) {
      // 업무 시간 중
      const remainingMinutes = endMinutes - currentMinutes;
      const hours = Math.floor(remainingMinutes / 60);
      const minutes = remainingMinutes % 60;
      return { 
        type: 'working', 
        hours, 
        minutes,
        message: `💼 업무 종료까지: ${hours}시간 ${minutes}분 남음`
      };
    } else {
      // 업무 종료 후
      return { 
        type: 'after_work',
        message: '🎉 업무 종료! 수고하셨습니다!'
      };
    }
  }
  
  formatSchedule() {
    const startTime = Utils.formatTimeString(WORK_SCHEDULE.start);
    const endTime = Utils.formatTimeString(WORK_SCHEDULE.end);
    const workHours = this.calculateWorkHours();
    
    return `⏰ 회사 근무시간\n시작: ${startTime}\n종료: ${endTime}\n총 근무시간: ${workHours.hours}시간 ${workHours.minutes}분`;
  }
}

const workTimeManager = new WorkTimeManager();

// 워크타임 기능을 처리하는 함수
module.exports = function(bot, msg) {
  const text = msg.text;
  const chatId = msg.chat.id;
  const userName = Utils.getUserName(msg);
  
  if (text === '/worktime') {
    // 현재 업무시간 및 상태 보기
    const scheduleText = workTimeManager.formatSchedule();
    const status = workTimeManager.getWorkStatus();
    
    bot.sendMessage(chatId, `${scheduleText}\n\n${status.message}`);
    
  } else if (text.startsWith('/worktime')) {
    // 도움말
    bot.sendMessage(chatId, 
      '💼 근무시간 정보:\n\n' +
      '⏰ 회사 근무시간은 고정되어 있습니다.\n' +
      '• 시작: 08:30\n' +
      '• 종료: 17:30\n' +
      '• 총 근무시간: 9시간\n\n' +
      '/worktime - 현재 근무 상태 확인\n\n' +
      '현재 시간을 기준으로 업무 시작/종료까지 남은 시간을 알려드립니다! ⏰'
    );
  }
};
