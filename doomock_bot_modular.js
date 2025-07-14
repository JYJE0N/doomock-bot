require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("BOT_TOKEN:", process.env.BOT_TOKEN);

bot.on("polling_error", (err) => {
  console.error("polling error:", err);
  console.error("Error details:", err.message);
  console.error("Error stack:", err.stack);
  console.error("Error code:", err.code);
});

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

  switch (true) {
    case text === '/start':
      bot.sendMessage(chatId, '반가워요! /help로 사용법을 확인하세요.');
      break;
    case text === '/help':
      utils(bot, msg);
      break;
    case text === '/worktime':
      worktime(bot, msg);
      break;
    case text === '/fortune':
      fortune(bot, msg);
      break;
    case text.startsWith('/add '):
      todo(bot, msg);
      break;
    default:
      bot.sendMessage(chatId, '😅 알 수 없는 명령어입니다. /help 를 입력해보세요.');
  }
});
