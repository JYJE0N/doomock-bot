class Utils {
  static getUserName(msg) {
    return msg.from.first_name || "사용자";
  }
  
  static parseTime(timeStr) {
    if (!timeStr.includes(":")) return null;
    const [hours, minutes] = timeStr.split(":").map(Number);
    if (hours > 23 || minutes > 59) return null;
    return { hours, minutes };
  }
  
  static timeToMinutes({ hours, minutes }) {
    return hours * 60 + minutes;
  }
  
  static formatTimeString({ hours, minutes }) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  }
  
  static getCurrentTime() {
    const now = new Date();
    return {
      hours: now.getHours(),
      minutes: now.getMinutes()
    };
  }
  
  static formatDate(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  
  static getGreeting() {
    const hour = new Date().getHours();
    if (hour < 6) return "새벽";
    if (hour < 12) return "아침";
    if (hour < 18) return "오후";
    if (hour < 22) return "저녁";
    return "밤";
  }
}

// 도움말 기능을 처리하는 함수
module.exports = function(bot, msg) {
  const chatId = msg.chat.id;
  const userName = Utils.getUserName(msg);
  const greeting = Utils.getGreeting();
  
  const helpMessage = 
    `👋 안녕하세요, ${userName}님! ${greeting}에도 열심히 활동하시는군요!\n\n` +
    '🤖 두목봇 사용법:\n\n' +
    
    '📝 **할 일 관리**\n' +
    '/add [할 일] - 할 일 추가\n' +
    '/todo - 할 일 목록 보기\n' +
    '/done [번호] - 할 일 완료\n' +
    '/delete [번호] - 할 일 삭제\n' +
    '/clear - 모든 할 일 삭제\n\n' +
    
    '⏰ **타이머**\n' +
    '/timer start [작업명] - 타이머 시작\n' +
    '/timer stop - 타이머 종료\n' +
    '/timer status - 현재 상태 확인\n\n' +
    
    '🔮 **운세**\n' +
    '/fortune - 오늘의 일반 운세\n' +
    '/fortune work - 오늘의 업무운\n' +
    '/fortune tarot - 오늘의 타로카드\n\n' +
    
    '💼 **업무시간**\n' +
    '/worktime - 업무시간 관리\n\n' +
    
    '❓ **기타**\n' +
    '/help - 이 도움말 보기\n' +
    '/start - 봇 시작하기\n\n' +
    
    '💡 **사용 예시:**\n' +
    '• `/add 프로젝트 마무리하기`\n' +
    '• `/timer start 독서`\n' +
    '• `/fortune work`\n\n' +
    
    '궁금한 점이 있으시면 언제든 명령어를 입력해보세요! 😊';
    
  bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
};

// Utils 클래스도 함께 export (다른 모듈에서 사용할 수 있도록)
module.exports.Utils = Utils;
