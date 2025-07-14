require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log('doomock modular bot started!');

// 모듈 불러오기
const fortune = require('./fortune');
const timer = require('./timer');
const todo = require('./todo');
const utils = require('./utils');
const worktime = require('./worktime');

// 메인 메시지 핸들러
bot.on('message', (msg) => {
    const text = msg.text;
    const chatId = msg.chat.id;

    console.log(`Received from ${chatId}: ${text}`);

    // fortune 모듈 예시
    if (text === '/fortune') {
        fortune(bot, msg);
    }
    // timer 모듈 예시
    else if (text === '/timer') {
        timer(bot, msg);
    }
    // 할일 추가 예시
    else if (text.startsWith('/add ')) {
        todo(bot, msg);
    }
    // 근무시간 확인
    else if (text === '/worktime') {
        worktime(bot, msg);
    }
    // 유틸 예시
    else if (text === '/help') {
        utils(bot, msg);
    }
    else {
        bot.sendMessage(chatId, '😅 알 수 없는 명령어입니다. /help 를 입력해보세요.');
    }
});
