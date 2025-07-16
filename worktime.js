// Utils 함수들을 직접 정의
const timeToMinutes = (time) => {
  return time.hours * 60 + time.minutes;
};

const formatTimeString = (time) => {
  const hours = time.hours.toString().padStart(2, '0');
  const minutes = time.minutes.toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

// 🔧 수정된 getUserName 함수 - 안전한 접근
const getUserName = (msg) => {
  if (!msg || !msg.from) {
    return '사용자';
  }
  return msg.from.first_name || msg.from.username || '사용자';
};

// 점심시간을 포함한 근무시간 상수
const WORK_SCHEDULE = {
  start: { hours: 8, minutes: 30 },      // 출근: 08:30
  lunchStart: { hours: 11, minutes: 30 }, // 점심 시작: 11:30
  lunchEnd: { hours: 13, minutes: 0 },    // 점심 종료: 13:00
  end: { hours: 17, minutes: 30 }         // 퇴근: 17:30
};

class WorkTimeManager {
  // 전체 근무시간 계산 (점심시간 제외)
  calculateTotalWorkHours() {
    const morningStart = timeToMinutes(WORK_SCHEDULE.start);
    const morningEnd = timeToMinutes(WORK_SCHEDULE.lunchStart);
    const afternoonStart = timeToMinutes(WORK_SCHEDULE.lunchEnd);
    const afternoonEnd = timeToMinutes(WORK_SCHEDULE.end);
    
    const morningMinutes = morningEnd - morningStart; // 오전 근무시간
    const afternoonMinutes = afternoonEnd - afternoonStart; // 오후 근무시간
    const totalMinutes = morningMinutes + afternoonMinutes;
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return { hours, minutes, totalMinutes };
  }
  
  // 현재까지 실제 근무한 시간 계산
  calculateCurrentWorkTime() {
    const now = new Date();
    const koreaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
    
    const currentHours = koreaTime.getHours();
    const currentMinutes = koreaTime.getMinutes();
    const currentTotalMinutes = currentHours * 60 + currentMinutes;
    
    const startTime = timeToMinutes(WORK_SCHEDULE.start);
    const lunchStartTime = timeToMinutes(WORK_SCHEDULE.lunchStart);
    const lunchEndTime = timeToMinutes(WORK_SCHEDULE.lunchEnd);
    const endTime = timeToMinutes(WORK_SCHEDULE.end);
    
    let workedMinutes = 0;
    let status = '';
    
    if (currentTotalMinutes < startTime) {
      // 출근 전
      status = '출근 전';
      workedMinutes = 0;
    } else if (currentTotalMinutes <= lunchStartTime) {
      // 오전 근무 중
      status = '오전 근무 중';
      workedMinutes = currentTotalMinutes - startTime;
    } else if (currentTotalMinutes < lunchEndTime) {
      // 점심시간 중
      status = '점심시간';
      workedMinutes = lunchStartTime - startTime; // 오전 근무시간만 계산
    } else if (currentTotalMinutes <= endTime) {
      // 오후 근무 중
      status = '오후 근무 중';
      const morningWork = lunchStartTime - startTime; // 오전 근무시간
      const afternoonWork = currentTotalMinutes - lunchEndTime; // 오후 현재까지
      workedMinutes = morningWork + afternoonWork;
    } else {
      // 퇴근 후
      status = '퇴근 완료';
      const morningWork = lunchStartTime - startTime;
      const afternoonWork = endTime - lunchEndTime;
      workedMinutes = morningWork + afternoonWork;
    }
    
    const hours = Math.floor(workedMinutes / 60);
    const minutes = workedMinutes % 60;
    
    return {
      hours,
      minutes,
      status,
      totalMinutes: workedMinutes
    };
  }
  
  // 현재 상태에 따른 메시지
  getCurrentStatusMessage() {
    const now = new Date();
    const koreaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
    
    const currentHours = koreaTime.getHours();
    const currentMinutes = koreaTime.getMinutes();
    const currentTotalMinutes = currentHours * 60 + currentMinutes;
    
    const startTime = timeToMinutes(WORK_SCHEDULE.start);
    const lunchStartTime = timeToMinutes(WORK_SCHEDULE.lunchStart);
    const lunchEndTime = timeToMinutes(WORK_SCHEDULE.lunchEnd);
    const endTime = timeToMinutes(WORK_SCHEDULE.end);
    
    if (currentTotalMinutes < startTime) {
      const remainingMinutes = startTime - currentTotalMinutes;
      const hours = Math.floor(remainingMinutes / 60);
      const minutes = remainingMinutes % 60;
      return `⏰ 출근까지 ${hours}시간 ${minutes}분 남음`;
    } else if (currentTotalMinutes <= lunchStartTime) {
      const remainingMinutes = lunchStartTime - currentTotalMinutes;
      const hours = Math.floor(remainingMinutes / 60);
      const minutes = remainingMinutes % 60;
      return `🍚 점심시간까지 ${hours}시간 ${minutes}분 남음`;
    } else if (currentTotalMinutes < lunchEndTime) {
      const remainingMinutes = lunchEndTime - currentTotalMinutes;
      const hours = Math.floor(remainingMinutes / 60);
      const minutes = remainingMinutes % 60;
      return `😴 점심시간 중 (${hours}시간 ${minutes}분 남음)`;
    } else if (currentTotalMinutes <= endTime) {
      const remainingMinutes = endTime - currentTotalMinutes;
      const hours = Math.floor(remainingMinutes / 60);
      const minutes = remainingMinutes % 60;
      return `💼 퇴근까지 ${hours}시간 ${minutes}분 남음`;
    } else {
      return `🎉 퇴근 완료! 수고하셨습니다!`;
    }
  }
  
  // 전체 정보 포맷팅
  formatSchedule() {
    const startTime = formatTimeString(WORK_SCHEDULE.start);
    const lunchStart = formatTimeString(WORK_SCHEDULE.lunchStart);
    const lunchEnd = formatTimeString(WORK_SCHEDULE.lunchEnd);
    const endTime = formatTimeString(WORK_SCHEDULE.end);
    
    const totalWork = this.calculateTotalWorkHours();
    const currentWork = this.calculateCurrentWorkTime();
    const statusMessage = this.getCurrentStatusMessage();
    
    return `⏰ 회사 근무시간
출근: ${startTime}
점심: ${lunchStart} ~ ${lunchEnd}
퇴근: ${endTime}

📊 근무 현황:
• 총 근무시간: ${totalWork.hours}시간 ${totalWork.minutes}분
• 지금까지: ${currentWork.hours}시간 ${currentWork.minutes}분 일함
• 현재 상태: ${currentWork.status}

${statusMessage}`;
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
    bot.sendMessage(chatId, scheduleText);
    
  } else if (text && text.startsWith('/worktime')) {
    // 도움말
    bot.sendMessage(chatId, 
      '💼 근무시간 정보:\n\n' +
      '⏰ 돈을 벌면 좋읍니다.\n' +
      '• 출근: 08:30\n' +
      '• 점심: 11:30 ~ 13:00\n' +
      '• 퇴근: 17:30\n' +
      '• 총 근무시간: 7시간 30분\n\n' +
      '/worktime - 현재 근무 상태 확인\n\n' +
      '현재 시간을 기준으로 실제 근무한 시간과 남은 시간을 알려드립니다! ⏰'
    );
  } else {
    // 버튼 클릭 시
    const funMessage = '⏰ 돈을 벌면 좋읍니다.\n\n';
    const scheduleText = workTimeManager.formatSchedule();
    
    bot.sendMessage(chatId, `${funMessage}${scheduleText}`);
  }
};
