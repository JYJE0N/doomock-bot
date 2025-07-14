require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

// 여기에서 process.env.BOT_TOKEN 사용
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const Utils = require("./utils");
const Todo = require("./todo");
const WorkTime = require("./worktime");
const Timer = require("./timer");
const Fortune = require("./fortune");

// 할일
bot.onText(/\/add (.+)/, (msg, match) => {
  Todo.add(msg.chat.id, match[1]);
  bot.sendMessage(msg.chat.id, `할일 추가: ${match[1]}`);
});

bot.onText(/\/list/, (msg) => {
  const list = Todo.get(msg.chat.id);
  if (!list.length) return bot.sendMessage(msg.chat.id, "할일이 없어요.");
  bot.sendMessage(msg.chat.id, list.map((t, i) => `${i+1}. ${t.completed?"✅":"🕒"} ${t.text}`).join("\n"));
});

// 타이머
bot.onText(/\/timer (.+)/, (msg, match) => {
  if (Timer.start(msg.chat.id, match[1])) {
    bot.sendMessage(msg.chat.id, `타이머 시작: ${match[1]}`);
  } else {
    bot.sendMessage(msg.chat.id, "이미 타이머가 작동중입니다.");
  }
});

bot.onText(/\/stop/, (msg) => {
  const result = Timer.stop(msg.chat.id);
  if (result) {
    bot.sendMessage(msg.chat.id, `타이머 종료: ${result.taskName}, ${result.duration}분 소요`);
  } else {
    bot.sendMessage(msg.chat.id, "타이머가 없습니다.");
  }
});

// 운세
bot.onText(/\/fortune/, (msg) => {
  bot.sendMessage(msg.chat.id, Fortune.getGeneral(msg.from.id));
});

bot.onText(/\/fortune_work/, (msg) => {
  bot.sendMessage(msg.chat.id, Fortune.getWork(msg.from.id));
});

bot.onText(/\/tarot/, (msg) => {
  bot.sendMessage(msg.chat.id, Fortune.getTarot(msg.from.id), { parse_mode: "Markdown" });
});

console.log("✅ doomock modular bot started!");
