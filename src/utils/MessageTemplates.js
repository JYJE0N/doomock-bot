// 메시지 템플릿

// src/utils/MessageTemplates.js - 봇 메시지 템플릿 모음

/**
 * 📝 텔레그램 봇 메시지 템플릿
 * - Markdown 형식 지원
 * - 재사용 가능한 메시지 포맷
 * - 이모지 포함
 */
class MessageTemplates {
  constructor() {
    // 기본 템플릿
    this.templates = {
      // ===== 🏠 시스템 메시지 =====
      welcome: (userName) =>
        `
🎉 *환영합니다, ${userName}님!* 🎉

저는 두목봇 v3.0.1입니다. 
무엇을 도와드릴까요?

📋 명령어 보기: /help
      `.trim(),

      help: () =>
        `
📚 *두목봇 사용법*

🔹 *기본 명령어*
/start - 시작하기
/help - 도움말
/status - 상태 확인

🔹 *주요 기능*
📝 /todo - 할일 관리
⏰ /timer - 타이머
🏢 /work - 근무시간
🔮 /fortune - 오늘의 운세
🌤️ /weather - 날씨 정보
🔔 /remind - 리마인더

💡 _각 기능을 선택하면 상세 메뉴가 나타납니다._
      `.trim(),

      // ===== 📝 할일 관리 =====
      todoMenu: (count) =>
        `
📝 *할일 관리*

현재 등록된 할일: *${count}개*

무엇을 하시겠습니까?
      `.trim(),

      todoAdded: (task) =>
        `
✅ *할일이 추가되었습니다!*

📌 ${task}

_목록 보기: /todo list_
      `.trim(),

      todoCompleted: (task) =>
        `
🎊 *축하합니다!*

✓ ~~${task}~~

_완료된 할일입니다._
      `.trim(),

      todoList: (todos, completed, pending) =>
        `
📋 *할일 목록*

✅ 완료: ${completed}개
⏳ 대기: ${pending}개
📊 전체: ${todos.length}개

${todos
  .map((t, i) => `${i + 1}. ${t.completed ? "✓" : "○"} ${t.task}`)
  .join("\n")}
      `.trim(),

      // ===== ⏰ 타이머 =====
      timerStart: (minutes) =>
        `
⏱️ *타이머 시작!*

설정 시간: *${minutes}분*
종료 예정: ${new Date(Date.now() + minutes * 60000).toLocaleTimeString("ko-KR")}

_타이머가 끝나면 알려드릴게요!_
      `.trim(),

      timerEnd: (duration) =>
        `
🔔 *띵동! 시간이 다 되었습니다!*

⏱️ 경과 시간: ${duration}
_수고하셨습니다!_
      `.trim(),

      // ===== 🏢 근무시간 =====
      workCheckIn: (time) =>
        `
🏢 *출근 완료!*

출근 시간: ${time}
오늘도 좋은 하루 되세요! 💪

_퇴근 시간에 알림을 보내드릴게요._
      `.trim(),

      workCheckOut: (time, duration) =>
        `
🏠 *퇴근 완료!*

퇴근 시간: ${time}
근무 시간: ${duration}

오늘도 수고하셨습니다! 🎉
_푹 쉬세요~_
      `.trim(),

      // ===== 🔮 운세 =====
      fortuneResult: (category, fortune, luckyItem) =>
        `
🔮 *오늘의 ${category} 운세*

${fortune}

🍀 행운의 아이템: *${luckyItem}*

_긍정적인 마음으로 하루를 보내세요!_
      `.trim(),

      // ===== 🌤️ 날씨 =====
      weatherCurrent: (city, temp, desc, feels) =>
        `
🌤️ *${city} 현재 날씨*

🌡️ 온도: *${temp}°C* (체감 ${feels}°C)
☁️ 상태: ${desc}

${this.getWeatherAdvice(temp)}
      `.trim(),

      // ===== 🔔 리마인더 =====
      reminderSet: (task, time) =>
        `
🔔 *알림이 설정되었습니다!*

📝 내용: ${task}
⏰ 시간: ${time}

_정해진 시간에 알려드릴게요._
      `.trim(),

      reminderAlert: (task) =>
        `
🔔 *알림!* 🔔

📢 ${task}

_지금 확인해주세요!_
      `.trim(),

      // ===== ❌ 에러 메시지 =====
      error: (message) =>
        `
❌ *오류가 발생했습니다*

${message}

_다시 시도해주세요._
      `.trim(),

      notFound: (item) =>
        `
🔍 *찾을 수 없습니다*

"${item}"을(를) 찾을 수 없어요.

_다시 확인해주세요._
      `.trim(),

      // ===== 📊 상태 메시지 =====
      loading: () => `⏳ _처리 중입니다..._`,

      success: (action) => `✅ *${action}* 완료!`,

      cancelled: () => `❌ _취소되었습니다._`,

      // ===== 🎮 인터랙션 =====
      confirm: (action) =>
        `
❓ *확인해주세요*

정말 ${action} 하시겠습니까?
      `.trim(),

      choose: (options) =>
        `
📋 *선택해주세요*

${options.map((opt, i) => `${i + 1}. ${opt}`).join("\n")}
      `.trim(),
    };

    // 버튼 템플릿
    this.buttons = {
      yesNo: [
        [{ text: "✅ 예", callback_data: "confirm:yes" }],
        [{ text: "❌ 아니오", callback_data: "confirm:no" }],
      ],

      backToMenu: [
        [{ text: "🔙 뒤로", callback_data: "back" }],
        [{ text: "🏠 메인 메뉴", callback_data: "main" }],
      ],

      todoActions: [
        [
          { text: "➕ 추가", callback_data: "todo:add" },
          { text: "📋 목록", callback_data: "todo:list" },
        ],
        [
          { text: "✅ 완료", callback_data: "todo:complete" },
          { text: "🗑️ 삭제", callback_data: "todo:delete" },
        ],
        [{ text: "🔙 뒤로", callback_data: "back" }],
      ],
    };
  }

  // 날씨에 따른 조언
  getWeatherAdvice(temp) {
    if (temp < 0) return "🧥 따뜻하게 입으세요!";
    if (temp < 10) return "🧥 겉옷을 챙기세요!";
    if (temp < 20) return "👔 가벼운 긴팔이 좋아요!";
    if (temp < 28) return "👕 반팔이 적당해요!";
    return "🌊 시원하게 입으세요!";
  }

  // 시간 포맷
  formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
      return `${hours}시간 ${mins}분`;
    }
    return `${mins}분`;
  }

  // 진행률 바
  createProgressBar(current, total, width = 10) {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round(width * (current / total));
    const empty = width - filled;

    const bar = "▓".repeat(filled) + "░".repeat(empty);

    return `[${bar}] ${percentage}%`;
  }

  // 이모지 뱃지
  getBadge(type, value) {
    const badges = {
      level: ["🥉", "🥈", "🥇", "💎", "👑"],
      achievement: ["🎯", "🏆", "🥇", "🌟", "✨"],
      streak: ["🔥", "🔥🔥", "🔥🔥🔥", "🔥🔥🔥🔥", "🔥🔥🔥🔥🔥"],
    };

    return badges[type]?.[Math.min(value - 1, 4)] || "🆕";
  }
}

module.exports = new MessageTemplates();
