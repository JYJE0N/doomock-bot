require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

// Webhook 방식으로 변경 (Railway 환경)
const bot = new TelegramBot(process.env.BOT_TOKEN, {
  webHook: {
    port: process.env.PORT || 3000
  }
});

// Webhook URL 설정
const webhookUrl = `${process.env.RAILWAY_STATIC_URL || 'https://your-app.up.railway.app'}/bot${process.env.BOT_TOKEN}`;
bot.setWebHook(webhookUrl);

console.log("BOT_TOKEN:", process.env.BOT_TOKEN);

bot.on("polling_error", (err) => {
  // 모든 에러 로그 차단 (409 충돌 때문에)
  return;
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
  let text = msg.text;
  const chatId = msg.chat.id;

  // 명령어가 없으면 무시
  if (!text || !text.startsWith('/')) {
    return;
  }

  // @봇이름 제거 (예: /worktime@doomock_bot → /worktime)
  if (text.includes('@')) {
    text = text.split('@')[0];
  }

  // msg 객체의 text도 수정해서 모듈들이 올바른 명령어를 받도록 함
  const modifiedMsg = { ...msg, text: text };

  console.log(`받은 명령어: ${text} (원본: ${msg.text}) (사용자: ${msg.from.first_name})`);

  // if-else 구조로 변경하여 중복 실행 방지
  if (text === '/start') {
    bot.sendMessage(chatId, '반가워요! /help로 사용법을 확인하세요.');
  
  } else if (text === '/help') {
    utils(bot, modifiedMsg);
  
  } else if (text.startsWith('/worktime')) {
    worktime(bot, modifiedMsg);
  
  } else if (text.startsWith('/fortune')) {
    fortune(bot, modifiedMsg);
  
  } else if (text.startsWith('/timer')) {
    timer(bot, modifiedMsg);
  
  } else if (text.startsWith('/add ') || 
             text === '/todo' || 
             text === '/list' || 
             text.startsWith('/done ') || 
             text.startsWith('/delete ') || 
             text === '/clear') {
    todo(bot, modifiedMsg);
  
  } else {
    bot.sendMessage(chatId, '😅 알 수 없는 명령어입니다. /help 를 입력해보세요.');
  }
});
