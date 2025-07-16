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
  
  // 🆕 진행도 게이지 생성 메서드
  createProgressBar(percentage, length = 10) {
    const filled = Math.floor((percentage / 100) * length);
    const empty = length - filled;
    const bar = '■'.repeat(filled) + '□'.repeat(empty);
    return `[${bar}] ${percentage}%`;
  }
  
  // 🆕 컬러풀한 진행도 바 (이모지 버전)
  createColorProgressBar(percentage) {
    const segments = 10;
    const filled = Math.floor((percentage / 100) * segments);
    let bar = '';
    
    for (let i = 0; i < segments; i++) {
      if (i < filled) {
        // 진행 상황에 따라 색상 변경
        if (percentage < 25) {
          bar += '🟥'; // 빨강 (시작)
        } else if (percentage < 50) {
          bar += '🟧'; // 주황 (초반)
        } else if (percentage < 75) {
          bar += '🟨'; // 노랑 (중반)
        } else {
          bar += '🟩'; // 초록 (거의 완료)
        }
      } else {
        bar += '⬜'; // 빈 칸
      }
    }
    
    return `${bar} ${percentage}%`;
  }
  
  // 🆕 시간별 상세 진행도
  getDetailedProgress() {
    const currentWork = this.calculateCurrentWorkTime();
    const totalWork = this.calculateTotalWorkHours();
    
    if (totalWork.totalMinutes === 0) {
      return { percentage: 0, message: '근무 시작 전' };
    }
    
    const percentage = Math.floor((currentWork.totalMinutes / totalWork.totalMinutes) * 100);
    
    let emoji = '';
    let message = '';
    
    if (percentage === 0) {
      emoji = '🌅';
      message = '출근! 화이팅!';
    } else if (percentage < 25) {
      emoji = '☕';
      message = '아직 시작이에요!';
    } else if (percentage < 50) {
      emoji = '💪';
      message = '열심히 하고 있어요!';
    } else if (percentage < 75) {
      emoji = '🔥';
      message = '절반 넘었네요!';
    } else if (percentage < 90) {
      emoji = '🎯';
      message = '거의 다 왔어요!';
    } else if (percentage < 100) {
      emoji = '🏁';
      message = '조금만 더!';
    } else {
      emoji = '🎉';
      message = '수고하셨습니다!';
    }
    
    return {
      percentage: Math.min(percentage, 100), // 100% 넘지 않도록
      emoji,
      message
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
  
  // 🔧 수정된 formatSchedule 메서드 (진행도 포함)
  formatSchedule() {
    const startTime = formatTimeString(WORK_SCHEDULE.start);
    const lunchStart = formatTimeString(WORK_SCHEDULE.lunchStart);
    const lunchEnd = formatTimeString(WORK_SCHEDULE.lunchEnd);
    const endTime = formatTimeString(WORK_SCHEDULE.end);
    
    const totalWork = this.calculateTotalWorkHours();
    const currentWork = this.calculateCurrentWorkTime();
    const statusMessage = this.getCurrentStatusMessage();
    const progress = this.getDetailedProgress();
    
    // 현재 시간 표시
    const now = new Date();
    const koreaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
    const currentTime = `${koreaTime.getHours().toString().padStart(2, '0')}:${koreaTime.getMinutes().toString().padStart(2, '0')}`;
    
    return `⏰ 회사 근무시간
출근: ${startTime} | 퇴근: ${endTime}
점심: ${lunchStart} ~ ${lunchEnd}
현재: ${currentTime}

📊 근무 진행도:
${this.createColorProgressBar(progress.percentage)}
${progress.emoji} ${progress.message}

⏱️ 근무 현황:
• 총 근무시간: ${totalWork.hours}시간 ${totalWork.minutes}분
• 지금까지: ${currentWork.hours}시간 ${currentWork.minutes}분 일함
• 현재 상태: ${currentWork.status}

${statusMessage}`;
  }
  
  // 🆕 간단한 버전 (메인 메뉴용)
  formatSimpleSchedule() {
    const progress = this.getDetailedProgress();
    const currentWork = this.calculateCurrentWorkTime();
    const statusMessage = this.getCurrentStatusMessage();
    
    return `⏰ 회사 근무시간
출근: 08:30 | 퇴근: 17:30

📊 ${this.createProgressBar(progress.percentage)}
${progress.emoji} 지금까지 ${currentWork.hours}시간 ${currentWork.minutes}분 일함

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
      '실시간 진행도 게이지와 함께 근무 상황을 확인하세요! 📊⏰'
    );
  } else {
    // 버튼 클릭 시
    const funMessage = '💸 돈을 벌면 좋읍니다.\n\n';
    const scheduleText = workTimeManager.formatSchedule();
    
    bot.sendMessage(chatId, `${funMessage}${scheduleText}`);
  }
};
