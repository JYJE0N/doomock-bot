// Utils 함수들을 직접 정의
const timeToMinutes = (time) => {
  return time.hours * 60 + time.minutes;
};

const formatTimeString = (time) => {
  const hours = time.hours.toString().padStart(2, '0');
  const minutes = time.minutes.toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

const getUserName = (msg) => {
  return msg.from.first_name || msg.from.username || '사용자';
};

// 고정된 근무시간 상수
const WORK_SCHEDULE = {
  start: { hours: 8, minutes: 30 },
  end: { hours: 17, minutes: 30 }
};

class WorkTimeManager {
  calculateWorkHours() {
    const startMinutes = timeToMinutes(WORK_SCHEDULE.start);
    const endMinutes = timeToMinutes(WORK_SCHEDULE.end);
    const totalMinutes = endMinutes - startMinutes;
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return { hours, minutes, totalMinutes };
  }
  
  getWorkStatus() {
    // 한국 시간대로 현재 시간 가져오기
    const now = new Date();
    const koreaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
    
    const currentHours = koreaTime.getHours();
    const currentMinutes = koreaTime.getMinutes();
    const currentTotalMinutes = currentHours * 60 + currentMinutes;
    
    const startTotalMinutes = WORK_SCHEDULE.start.hours * 60 + WORK_SCHEDULE.start.minutes;
    const endTotalMinutes = WORK_SCHEDULE.end.hours * 60 + WORK_SCHEDULE.end.minutes;
    
    console.log(`서버시간: ${now.getHours()}:${now.getMinutes()}`);
    console.log(`한국시간: ${currentHours}:${currentMinutes} (${currentTotalMinutes}분)`);
    console.log(`업무시작: ${WORK_SCHEDULE.start.hours}:${WORK_SCHEDULE.start.minutes} (${startTotalMinutes}분)`);
    console.log(`업무종료: ${WORK_SCHEDULE.end.hours}:${WORK_SCHEDULE.end.minutes} (${endTotalMinutes}분)`);
    
    if (currentTotalMinutes < startTotalMinutes) {
      // 아직 업무 시작 전
      const remainingMinutes = startTotalMinutes - currentTotalMinutes;
      const hours = Math.floor(remainingMinutes / 60);
      const minutes = remainingMinutes % 60;
      return { 
        type: 'before_work', 
        hours, 
        minutes,
        message: `⏳ 업무 시작까지: ${hours}시간 ${minutes}분 남음`
      };
    } else if (currentTotalMinutes < endTotalMinutes) {
      // 업무 시간 중
      const remainingMinutes = endTotalMinutes - currentTotalMinutes;
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
    const startTime = formatTimeString(WORK_SCHEDULE.start);
    const endTime = formatTimeString(WORK_SCHEDULE.end);
    const workHours = this.calculateWorkHours();
    
    return `⏰ 회사 근무시간\n시작: ${startTime}\n종료: ${endTime}\n총 근무시간: ${workHours.hours}시간 ${workHours.minutes}분`;
  }
}

const workTimeManager = new WorkTimeManager();

// 워크타임 기능을 처리하는 함수
module.exports = function(bot, msg) {
  const text = msg.text;
  const chatId = msg.chat.id;
  const userName = getUserName(msg);
  
  if (text === '/worktime') {
    // 현재 업무시간 및 상태 보기
    const scheduleText = workTimeManager.formatSchedule();
    const status = workTimeManager.getWorkStatus();
    
    bot.sendMessage(chatId, `${scheduleText}\n\n${status.message}`);
    
  } else if (text && text.startsWith('/worktime')) {
    // 도움말
    bot.sendMessage(chatId, 
      '💼 근무시간 정보:\n\n' +
      '⏰ 돈을 벌면 좋읍니다.\n' +
      '• 시작: 08:30\n' +
      '• 종료: 17:30\n' +
      '• 총 근무시간: 9시간\n\n' +
      '/worktime - 현재 근무 상태 확인\n\n' +
      '현재 시간을 기준으로 업무 시작/종료까지 남은 시간을 알려드립니다! ⏰'
    );
  }
};
