class TimerManager {
  constructor() {
    this.timers = new Map(); // chatId -> { taskName, startTime }
  }
  
  start(chatId, taskName) {
    if (this.timers.has(chatId)) return false;
    this.timers.set(chatId, { taskName, startTime: new Date() });
    return true;
  }
  
  stop(chatId) {
    const timer = this.timers.get(chatId);
    if (!timer) return null;
    const duration = Math.floor((new Date() - timer.startTime) / 60000);
    this.timers.delete(chatId);
    return { ...timer, duration };
  }
  
  status(chatId) {
    const timer = this.timers.get(chatId);
    if (!timer) return null;
    const running = Math.floor((new Date() - timer.startTime) / 60000);
    return { ...timer, running };
  }
}

const timerManager = new TimerManager();

// 타이머 기능을 처리하는 함수
module.exports = function(bot, msg) {
  const text = msg.text;
  const chatId = msg.chat.id;
  
  if (text.startsWith('/timer start ')) {
    const taskName = text.substring(13).trim();
    if (!taskName) {
      bot.sendMessage(chatId, '❌ 작업명을 입력해주세요. 예: /timer start 공부하기');
      return;
    }
    
    if (timerManager.start(chatId, taskName)) {
      bot.sendMessage(chatId, `⏰ "${taskName}" 타이머를 시작했습니다!`);
    } else {
      bot.sendMessage(chatId, '❌ 이미 실행 중인 타이머가 있습니다. /timer stop 으로 먼저 종료해주세요.');
    }
    
  } else if (text === '/timer stop') {
    const result = timerManager.stop(chatId);
    if (result) {
      bot.sendMessage(chatId, `⏹️ "${result.taskName}" 완료!\n소요시간: ${result.duration}분`);
    } else {
      bot.sendMessage(chatId, '❌ 실행 중인 타이머가 없습니다.');
    }
    
  } else if (text === '/timer status') {
    const status = timerManager.status(chatId);
    if (status) {
      bot.sendMessage(chatId, `⏱️ "${status.taskName}" 진행 중...\n경과시간: ${status.running}분`);
    } else {
      bot.sendMessage(chatId, '❌ 실행 중인 타이머가 없습니다.');
    }
    
  } else if (text === '/timer') {
    bot.sendMessage(chatId, 
      '⏰ 타이머 사용법:\n' +
      '/timer start [작업명] - 타이머 시작\n' +
      '/timer stop - 타이머 종료\n' +
      '/timer status - 현재 상태 확인\n\n' +
      '예시: /timer start 독서하기'
    );
  }
};
