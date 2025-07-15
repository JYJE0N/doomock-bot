module.exports = function(bot, msg) {
  const chatId = msg.chat.id;
  const text = msg.text;

  // /remind 30 독서하기
  const timeMatch = text.match(/\/remind (\d+)\s(.+)/);
  if (timeMatch) {
    const minutes = parseInt(timeMatch[1]);
    const task = timeMatch[2];

    bot.sendMessage(chatId, `⏳ ${minutes}분 뒤에 "${task}" 를 리마인드 할게요.`);

    setTimeout(() => {
      bot.sendMessage(chatId, `🔔 리마인드: ${task}`);
    }, minutes * 60 * 1000);

    return;
  }

  // /remind 14:30 점심약속
  const clockMatch = text.match(/\/remind (\d{1,2}:\d{2})\s(.+)/);
  if (clockMatch) {
    const [hour, minute] = clockMatch[1].split(':').map(Number);
    const task = clockMatch[2];

    const now = new Date();
    const target = new Date();
    target.setHours(hour, minute, 0, 0);

    if (target < now) target.setDate(target.getDate() + 1); // 지나갔으면 내일
    const delay = target - now;

    bot.sendMessage(chatId, `⏰ ${clockMatch[1]}에 "${task}" 리마인드 할게요.`);

    setTimeout(() => {
      bot.sendMessage(chatId, `🔔 지금은 ${clockMatch[1]}! 리마인드: ${task}`);
    }, delay);

    return;
  }

  // 형식 안 맞으면 안내
  bot.sendMessage(chatId, `❗ 사용법:\n/remind [분] 내용\n예: /remind 30 독서하기\n또는\n/remind 14:30 점심약속`);
};
