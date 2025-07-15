require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// 환경변수 디버깅
console.log("=== 환경변수 확인 ===");
console.log("BOT_TOKEN 존재:", !!process.env.BOT_TOKEN);
console.log("BOT_TOKEN 길이:", process.env.BOT_TOKEN ? process.env.BOT_TOKEN.length : 0);
console.log("BOT_TOKEN 앞부분:", process.env.BOT_TOKEN ? process.env.BOT_TOKEN.substring(0, 10) + "..." : "없음");
console.log("🔍 All MONGO env vars:", Object.keys(process.env).filter(k => k.includes('MONGO')));
console.log("========================");

if (!process.env.BOT_TOKEN) {
    console.error("❌ BOT_TOKEN이 설정되지 않았습니다!");
    process.exit(1);
}

bot.on("polling_error", (err) => console.error("polling error:", JSON.stringify(err, null, 2)));

console.log('🤖 두목봇 시작됨...');

// 모듈 불러오기
const fortune = require('./fortune');
const timer = require('./timer');
const todoFunctions = require('./todos'); // todos.js 함수들 import
const utils = require('./utils');
const worktime = require('./worktime');
const MonthlyLeave = require('./monthly_leave'); // 이 줄 추가

// 연차 관리 인스턴스 생성
const leaveManager = new MonthlyLeave(); // 이 줄 추가

// 휴가 관리 메뉴
const leaveMenuKeyboard = {
    inline_keyboard: [
        [
            { text: '📊 연차 현황', callback_data: 'leave_status' },
            { text: '📋 사용 내역', callback_data: 'leave_history' }
        ],
        [
            { text: '🏖️ 연차 사용', callback_data: 'use_leave' },
            { text: '⚙️ 연차 설정', callback_data: 'set_leave' }
        ],
        [
            { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
        ]
    ]
};

// 사용자 상태 관리 (메모리 기반)
const userStates = new Map();

// 운세 메뉴 키보드
const fortuneMenuKeyboard = {
    inline_keyboard: [
        [
            { text: '🌟 일반운세', callback_data: 'fortune_general' },
            { text: '💼 업무운', callback_data: 'fortune_work' }
        ],
        [
            { text: '💕 연애운', callback_data: 'fortune_love' },
            { text: '💰 재물운', callback_data: 'fortune_money' }
        ],
        [
            { text: '🌿 건강운', callback_data: 'fortune_health' },
            { text: '🍻 회식운', callback_data: 'fortune_meeting' }
        ],
        [
            { text: '🃏 타로카드', callback_data: 'fortune_tarot' },
            { text: '🍀 행운정보', callback_data: 'fortune_lucky' }
        ],
        [
            { text: '📋 종합운세', callback_data: 'fortune_all' }
        ],
        [
            { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
        ]
    ]
};
    constructor() {
        this.messages = {
            general: [
                "오늘은 새로운 시작의 기운이 가득한 날입니다 🌅",
                "예상치 못한 좋은 소식이 들려올 수 있어요 📞",
                "주변 사람들과의 관계에서 따뜻함을 느낄 거예요 💝",
                "창의적인 아이디어가 샘솟는 하루가 될 것 같아요 💡",
                "작은 행운들이 연달아 찾아올 징조가 보여요 🍀",
                "평온하고 안정감 있는 하루를 보낼 수 있을 거예요 🕊️",
                "새로운 도전에 대한 용기가 생기는 날이에요 💪",
                "직감이 특히 날카로워지는 하루가 될 것 같아요 🎯",
                "우연한 만남이 인생을 바꿀 수 있는 특별한 날이에요 ✨",
                "내면의 평화를 찾을 수 있는 조용한 하루예요 🧘‍♀️"
            ],
            work: [
                "업무에 집중력이 최고조에 달하는 날이에요 🎯",
                "동료들과의 협업에서 시너지가 폭발할 거예요 🤝",
                "중요한 프로젝트에 돌파구가 보일 수 있어요 🚀",
                "리더십을 발휘할 절호의 기회가 올 거예요 👑",
                "새로운 업무 기회가 문을 두드릴 수 있어요 🚪"
            ],
            love: [
                "연인과의 관계가 한층 더 깊어질 거예요 💕",
                "새로운 만남이 기다리고 있을 수 있어요 💘",
                "마음속 깊은 대화를 나눌 기회가 생겨요 💬",
                "로맨틱한 순간이 예상치 못한 곳에서 찾아와요 🌹",
                "진정한 사랑을 깨닫게 되는 특별한 하루예요 💖"
            ],
            money: [
                "금전적 여유가 생기는 기운이 감지돼요 💰",
                "투자나 부업에 좋은 기회가 올 수 있어요 📊",
                "예상치 못한 수입이 생길 가능성이 높아요 💸",
                "절약 정신이 발동해서 돈을 모을 수 있어요 🏦",
                "재정 관리에 대한 좋은 아이디어가 떠올라요 💡"
            ],
            health: [
                "몸과 마음이 모두 가벼워지는 날이에요 🌿",
                "새로운 운동을 시작하기에 완벽한 타이밍이에요 🏃‍♀️",
                "건강한 식단에 관심이 생길 거예요 🥗",
                "숙면을 취할 수 있는 편안한 밤이 될 거예요 😴",
                "스트레스가 자연스럽게 해소되는 하루예요 🧘‍♀️"
            ],
            meeting: [
                "회식에서 분위기 메이커 역할을 하게 될 거예요 🎉",
                "상사와의 거리감이 좁혀지는 좋은 기회가 될 거예요 👔",
                "동료들과 진솔한 대화를 나눌 수 있을 거예요 🍻",
                "회식 자리에서 새로운 친구를 만날 수 있어요 🤝",
                "평소 어색했던 팀원과 친해질 기회가 생겨요 😊"
            ],
            tarot: [
                { name: "The Fool", meaning: "새로운 시작과 모험", emoji: "🃏", advice: "두려워 말고 첫걸음을 내디디세요." },
                { name: "The Magician", meaning: "의지와 실현", emoji: "🔮", advice: "당신의 능력을 믿으세요." },
                { name: "The High Priestess", meaning: "직감과 내면의 지혜", emoji: "🌙", advice: "논리보다 직감을 따르세요." },
                { name: "The Empress", meaning: "풍요, 돌봄, 창조성", emoji: "👸", advice: "사랑과 돌봄을 나누세요." },
                { name: "The Emperor", meaning: "권위, 리더십, 질서", emoji: "👑", advice: "체계적으로 행동하세요." },
                { name: "The Sun", meaning: "기쁨과 성공", emoji: "☀️", advice: "긍정적으로 임하세요." },
                { name: "The Star", meaning: "희망과 영감", emoji: "⭐", advice: "꿈을 포기하지 마세요." },
                { name: "The World", meaning: "완성과 성취", emoji: "🌍", advice: "노력의 결실을 즐기세요." }
            ]
        };
    }

    getRandomMessage(messages, userId) {
        const today = new Date().toDateString();
        const seed = userId + today.length;
        const index = seed % messages.length;
        return messages[index];
    }

    getGeneral(userId) {
        return this.getRandomMessage(this.messages.general, userId);
    }

    getWork(userId) {
        return this.getRandomMessage(this.messages.work, userId);
    }

    getLove(userId) {
        return this.getRandomMessage(this.messages.love, userId);
    }

    getMoney(userId) {
        return this.getRandomMessage(this.messages.money, userId);
    }

    getHealth(userId) {
        return this.getRandomMessage(this.messages.health, userId);
    }

    getMeeting(userId) {
        return this.getRandomMessage(this.messages.meeting, userId);
    }

    getTarot(userId) {
        const card = this.getRandomMessage(this.messages.tarot, userId);
        return `${card.emoji} **${card.name}**\n\n✨ *의미: ${card.meaning}*\n\n💫 *조언: ${card.advice}*`;
    }

    getLucky(userId) {
        const today = new Date().toDateString();
        const seed = userId + today.length;
        const colors = ["빨간색", "파란색", "노란색", "초록색", "보라색", "분홍색"];
        const numbers = [];
        for (let i = 0; i < 6; i++) {
            const num = ((seed + i * 7) % 46) + 1;
            if (!numbers.includes(num)) numbers.push(num);
        }
        const items = ["커피", "꽃", "책", "음악", "향초", "초콜릿"];
        
        return `🍀 **오늘의 행운 정보**\n\n` +
               `🎨 행운의 색깔: ${colors[seed % colors.length]}\n` +
               `🔢 행운의 번호: ${numbers.slice(0, 6).sort((a, b) => a - b).join(', ')}\n` +
               `🎁 행운의 아이템: ${items[seed % items.length]}`;
    }

    getAll(userId, userName) {
        const general = this.getGeneral(userId);
        const work = this.getWork(userId);
        const love = this.getLove(userId);
        const money = this.getMoney(userId);
        const health = this.getHealth(userId);
        const meeting = this.getMeeting(userId);
        
        return `🔮 **${userName}님의 오늘 종합운세**\n\n` +
               `**🌟 전체운:** ${general}\n\n` +
               `**💼 업무운:** ${work}\n\n` +
               `**💕 연애운:** ${love}\n\n` +
               `**💰 재물운:** ${money}\n\n` +
               `**🌿 건강운:** ${health}\n\n` +
               `**🍻 회식운:** ${meeting}`;
    }
}

// 할일 관리 메뉴
const todoMenuKeyboard = {
    inline_keyboard: [
        [
            { text: '📋 할일 목록', callback_data: 'todo_list' },
            { text: '➕ 할일 추가', callback_data: 'todo_add' }
        ],
        [
            { text: '📊 할일 통계', callback_data: 'todo_stats' },
            { text: '🗑️ 완료된 항목 삭제', callback_data: 'todo_clear_completed' }
        ],
        [
            { text: '⚠️ 모든 할일 삭제', callback_data: 'todo_clear_all' }
        ],
        [
            { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
        ]
    ]
};

// 타이머 메뉴 키보드
const timerMenuKeyboard = {
    inline_keyboard: [
        [
            { text: '▶️ 타이머 시작', callback_data: 'timer_start' },
            { text: '⏹️ 타이머 중지', callback_data: 'timer_stop' }
        ],
        [
            { text: '⏱️ 현재 상태', callback_data: 'timer_status' }
        ],
        [
            { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
        ]
    ]
};

// 리마인더 메뉴 키보드
const reminderMenuKeyboard = {
    inline_keyboard: [
        [
            { text: '⏳ 분 단위 리마인더', callback_data: 'reminder_minutes' },
            { text: '🕐 시간 지정 리마인더', callback_data: 'reminder_time' }
        ],
        [
            { text: '📋 활성 리마인더 목록', callback_data: 'reminder_list' }
        ],
        [
            { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
        ]
    ]
};

// 타이머 관리자
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

// 리마인더 관리자
class ReminderManager {
    constructor() {
        this.reminders = new Map(); // chatId -> [{ id, task, time, timeoutId }]
        this.nextId = 1;
    }
    
    addMinuteReminder(chatId, minutes, task) {
        const timeoutId = setTimeout(() => {
            this.sendReminder(chatId, task);
            this.removeReminder(chatId, this.nextId - 1);
        }, minutes * 60 * 1000);
        
        const reminder = { id: this.nextId++, task, time: `${minutes}분 후`, timeoutId };
        this.addToList(chatId, reminder);
        return reminder.id;
    }
    
    addTimeReminder(chatId, timeStr, task, bot) {
        const [hour, minute] = timeStr.split(':').map(Number);
        const now = new Date();
        const target = new Date();
        target.setHours(hour, minute, 0, 0);
        if (target < now) target.setDate(target.getDate() + 1);
        const delay = target - now;
        
        const timeoutId = setTimeout(() => {
            bot.sendMessage(chatId, `🔔 지금은 ${timeStr}! 리마인드: ${task}`);
            this.removeReminder(chatId, this.nextId - 1);
        }, delay);
        
        const reminder = { id: this.nextId++, task, time: timeStr, timeoutId };
        this.addToList(chatId, reminder);
        return reminder.id;
    }
    
    addToList(chatId, reminder) {
        if (!this.reminders.has(chatId)) {
            this.reminders.set(chatId, []);
        }
        this.reminders.get(chatId).push(reminder);
    }
    
    removeReminder(chatId, id) {
        const userReminders = this.reminders.get(chatId);
        if (userReminders) {
            const index = userReminders.findIndex(r => r.id === id);
            if (index > -1) {
                clearTimeout(userReminders[index].timeoutId);
                userReminders.splice(index, 1);
            }
        }
    }
    
    getReminders(chatId) {
        return this.reminders.get(chatId) || [];
    }
    
    sendReminder(chatId, task) {
        // 이 메서드는 봇 인스턴스가 필요하므로 실제 사용 시 bot을 전달받아야 함
    }
}

const timerManager = new TimerManager();
// 근무시간 메뉴 키보드
const worktimeMenuKeyboard = {
    inline_keyboard: [
        [
            { text: '⏰ 현재 근무 상태', callback_data: 'worktime_status' },
            { text: '📋 근무시간 정보', callback_data: 'worktime_info' }
        ],
        [
            { text: '📊 주간 근무 통계', callback_data: 'worktime_weekly' },
            { text: '🎯 근무 목표 설정', callback_data: 'worktime_goal' }
        ],
        [
            { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
        ]
    ]
};

// 근무시간 관리자
const WORK_SCHEDULE = {
    start: { hours: 8, minutes: 30 },
    end: { hours: 17, minutes: 30 }
};

class WorkTimeManager {
    constructor() {
        this.timeToMinutes = (time) => time.hours * 60 + time.minutes;
        this.formatTimeString = (time) => {
            const hours = time.hours.toString().padStart(2, '0');
            const minutes = time.minutes.toString().padStart(2, '0');
            return `${hours}:${minutes}`;
        };
    }
    
    calculateWorkHours() {
        const startMinutes = this.timeToMinutes(WORK_SCHEDULE.start);
        const endMinutes = this.timeToMinutes(WORK_SCHEDULE.end);
        const totalMinutes = endMinutes - startMinutes;
        
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        
        return { hours, minutes, totalMinutes };
    }
    
    getWorkStatus() {
        const now = new Date();
        const koreaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
        
        const currentHours = koreaTime.getHours();
        const currentMinutes = koreaTime.getMinutes();
        const currentTotalMinutes = currentHours * 60 + currentMinutes;
        
        const startTotalMinutes = WORK_SCHEDULE.start.hours * 60 + WORK_SCHEDULE.start.minutes;
        const endTotalMinutes = WORK_SCHEDULE.end.hours * 60 + WORK_SCHEDULE.end.minutes;
        
        const currentTimeStr = `${currentHours.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}`;
        
        if (currentTotalMinutes < startTotalMinutes) {
            const remainingMinutes = startTotalMinutes - currentTotalMinutes;
            const hours = Math.floor(remainingMinutes / 60);
            const minutes = remainingMinutes % 60;
            return { 
                type: 'before_work', 
                hours, 
                minutes,
                currentTime: currentTimeStr,
                message: `⏳ 업무 시작까지: ${hours}시간 ${minutes}분 남음`,
                emoji: '😴'
            };
        } else if (currentTotalMinutes < endTotalMinutes) {
            const remainingMinutes = endTotalMinutes - currentTotalMinutes;
            const hours = Math.floor(remainingMinutes / 60);
            const minutes = remainingMinutes % 60;
            const progress = ((currentTotalMinutes - startTotalMinutes) / (endTotalMinutes - startTotalMinutes) * 100).toFixed(1);
            return { 
                type: 'working', 
                hours, 
                minutes,
                currentTime: currentTimeStr,
                progress,
                message: `💼 업무 종료까지: ${hours}시간 ${minutes}분 남음\n📊 진행률: ${progress}%`,
                emoji: '💪'
            };
        } else {
            return { 
                type: 'after_work',
                currentTime: currentTimeStr,
                message: '🎉 업무 종료! 수고하셨습니다!',
                emoji: '🍻'
            };
        }
    }
    
    formatSchedule() {
        const startTime = this.formatTimeString(WORK_SCHEDULE.start);
        const endTime = this.formatTimeString(WORK_SCHEDULE.end);
        const workHours = this.calculateWorkHours();
        
        return `⏰ **회사 근무시간**\n\n` +
               `🌅 시작: ${startTime}\n` +
               `🌅 종료: ${endTime}\n` +
               `⏱️ 총 근무시간: ${workHours.hours}시간 ${workHours.minutes}분`;
    }
    
    getDetailedStatus() {
        const status = this.getWorkStatus();
        const schedule = this.formatSchedule();
        
        let statusMessage = `📍 **현재 시간: ${status.currentTime}**\n\n`;
        statusMessage += `${status.emoji} ${status.message}\n\n`;
        statusMessage += schedule;
        
        return statusMessage;
    }
    
    getWeeklyStats() {
        const workHours = this.calculateWorkHours();
        const dailyHours = workHours.hours + (workHours.minutes / 60);
        const weeklyHours = dailyHours * 5; // 주 5일 근무
        
        return `📊 **주간 근무 통계**\n\n` +
               `📅 일일 근무시간: ${workHours.hours}시간 ${workHours.minutes}분\n` +
               `📈 주간 근무시간: ${Math.floor(weeklyHours)}시간 ${Math.round((weeklyHours % 1) * 60)}분\n` +
               `🗓️ 월간 근무시간: 약 ${Math.round(weeklyHours * 4.33)}시간\n\n` +
               `💡 **팁**: 규칙적인 근무시간으로 일과 삶의 균형을 맞춰보세요!`;
    }
    
    getMotivationalMessage() {
        const status = this.getWorkStatus();
        const messages = {
            before_work: [
                "☕ 좋은 하루의 시작! 커피 한 잔과 함께 준비해보세요.",
                "🌅 새로운 하루, 새로운 기회! 오늘도 화이팅!",
                "📚 출근 전 간단한 계획을 세우면 더 효율적인 하루가 될 거예요."
            ],
            working: [
                "💪 열심히 일하고 계시네요! 중간중간 휴식도 잊지 마세요.",
                "🎯 목표를 향해 한 걸음씩! 오늘도 좋은 성과 있으시길!",
                "⏰ 시간이 빨리 지나가네요. 집중하고 계신 모습이 멋져요!"
            ],
            after_work: [
                "🎉 오늘 하루도 수고 많으셨습니다! 이제 휴식시간이에요.",
                "🍻 퇴근길에 맛있는 저녁 어떠세요?",
                "💆‍♀️ 오늘 하루의 피로를 날려버리는 편안한 저녁 되세요!"
            ]
        };
        
        const typeMessages = messages[status.type] || messages.after_work;
        const randomMessage = typeMessages[Math.floor(Math.random() * typeMessages.length)];
        
        return randomMessage;
    }
}

// TTS 메뉴 키보드
const ttsMenuKeyboard = {
    inline_keyboard: [
        [
            { text: '🎤 한국어 TTS', callback_data: 'tts_korean' },
            { text: '🗣️ 영어 TTS', callback_data: 'tts_english' }
        ],
        [
            { text: '🇯🇵 일본어 TTS', callback_data: 'tts_japanese' },
            { text: '🇨🇳 중국어 TTS', callback_data: 'tts_chinese' }
        ],
        [
            { text: '⚙️ TTS 설정', callback_data: 'tts_settings' },
            { text: '📋 사용법', callback_data: 'tts_help' }
        ],
        [
            { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
        ]
    ]
};

// TTS 설정 키보드
const ttsSettingsKeyboard = {
    inline_keyboard: [
        [
            { text: '👨 남성 음성', callback_data: 'tts_voice_male' },
            { text: '👩 여성 음성', callback_data: 'tts_voice_female' }
        ],
        [
            { text: '🐌 느린 속도', callback_data: 'tts_speed_slow' },
            { text: '⚡ 빠른 속도', callback_data: 'tts_speed_fast' }
        ],
        [
            { text: '🔙 TTS 메뉴', callback_data: 'tts_menu' }
        ]
    ]
};

// TTS 관리자
class TTSManager {
    constructor() {
        this.userSettings = new Map(); // userId -> { language, voice, speed }
        this.defaultSettings = {
            language: 'ko-KR',
            voice: 'ko-KR-Standard-A',
            speed: 1.0
        };
    }
    
    getUserSettings(userId) {
        return this.userSettings.get(userId) || { ...this.defaultSettings };
    }
    
    setUserSettings(userId, settings) {
        const currentSettings = this.getUserSettings(userId);
        this.userSettings.set(userId, { ...currentSettings, ...settings });
    }
    
    getLanguageSettings() {
        return {
            'ko-KR': {
                name: '한국어',
                voices: {
                    male: 'ko-KR-Standard-C',
                    female: 'ko-KR-Standard-A'
                }
            },
            'en-US': {
                name: '영어',
                voices: {
                    male: 'en-US-Standard-B',
                    female: 'en-US-Standard-C'
                }
            },
            'ja-JP': {
                name: '일본어',
                voices: {
                    male: 'ja-JP-Standard-C',
                    female: 'ja-JP-Standard-A'
                }
            },
            'zh-CN': {
                name: '중국어',
                voices: {
                    male: 'zh-CN-Standard-B',
                    female: 'zh-CN-Standard-A'
                }
            }
        };
    }
    
    async generateTTS(text, settings) {
        try {
            // Google Cloud Text-to-Speech API 설정
            const textToSpeech = require('@google-cloud/text-to-speech');
            const client = new textToSpeech.TextToSpeechClient({
                keyFilename: process.env.GOOGLE_SERVICE_ACCOUNT_PATH, // 서비스 계정 키 파일 경로
                projectId: process.env.GOOGLE_PROJECT_ID
            });

            const request = {
                input: { text: text },
                voice: { 
                    languageCode: settings.language,
                    name: settings.voice 
                },
                audioConfig: { 
                    audioEncoding: 'MP3',
                    speakingRate: settings.speed
                },
            };

            const [response] = await client.synthesizeSpeech(request);
            return response.audioContent;
        } catch (error) {
            console.error('TTS 생성 오류:', error);
            
            // Fallback: 간단한 TTS 응답 (실제 음성 없이)
            return null;
        }
    }
    
    getUsageInfo() {
        return `🎤 **TTS 사용법**\n\n` +
               `**📱 메뉴 방식:**\n` +
               `/start → 🎤 TTS → 언어 선택 → 텍스트 입력\n\n` +
               `**⌨️ 명령어 방식:**\n` +
               `/say 안녕하세요 - 한국어 TTS\n` +
               `/say en Hello - 영어 TTS\n` +
               `/say ja こんにちは - 일본어 TTS\n` +
               `/say zh 你好 - 중국어 TTS\n\n` +
               `**⚙️ 기능:**\n` +
               `• 4개 언어 지원 (한/영/일/중)\n` +
               `• 남성/여성 음성 선택\n` +
               `• 속도 조절 (느림/보통/빠름)\n` +
               `• 개인 설정 저장\n\n` +
               `**💡 팁:**\n` +
               `• 짧은 문장이 더 자연스럽습니다\n` +
               `• 문장부호를 사용하면 더 자연스러워요\n` +
               `• 설정에서 음성과 속도를 변경할 수 있어요`;
    }
}

const ttsManager = new TTSManager();

const workTimeManager = new WorkTimeManager();

const reminderManager = new ReminderManager();

const fortuneManager = new FortuneManager();

// 메인 메뉴 키보드
const mainMenuKeyboard = {
    inline_keyboard: [
        [
            { text: '📝 할일 관리', callback_data: 'todo_menu' },
            { text: '📅 휴가 관리', callback_data: 'leave_menu' }
        ],
        [
            { text: '⏰ 타이머', callback_data: 'timer_menu' },
            { text: '🎯 운세', callback_data: 'fortune_menu' }
        ],
        [
            { text: '🕐 근무시간', callback_data: 'worktime_menu' },
            { text: '🔔 리마인더', callback_data: 'reminder_menu' }
        ],
        [
            { text: '🎤 TTS', callback_data: 'tts_menu' },
            { text: '❓ 도움말', callback_data: 'help_menu' }
        ]
    ]
};

// 운세 메뉴 키보드
const fortuneMenuKeyboard = {
    inline_keyboard: [
        [
            { text: '🌟 일반운세', callback_data: 'fortune_general' },
            { text: '💼 업무운', callback_data: 'fortune_work' }
        ],
        [
            { text: '💕 연애운', callback_data: 'fortune_love' },
            { text: '💰 재물운', callback_data: 'fortune_money' }
        ],
        [
            { text: '🌿 건강운', callback_data: 'fortune_health' },
            { text: '🍻 회식운', callback_data: 'fortune_meeting' }
        ],
        [
            { text: '🃏 타로카드', callback_data: 'fortune_tarot' },
            { text: '🍀 행운정보', callback_data: 'fortune_lucky' }
        ],
        [
            { text: '📋 종합운세', callback_data: 'fortune_all' }
        ],
        [
            { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
        ]
    ]
};

// 메인 메시지 핸들러
bot.on('message', async (msg) => {
    const text = msg.text;
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // 사용자 상태 확인
    const userState = userStates.get(userId);

    try {
        // 취소 명령어 처리
        if (text === '/cancel') {
            userStates.delete(userId);
            bot.sendMessage(chatId, '❌ 작업이 취소되었습니다.');
            return;
        }

        // TTS 상태 처리
        if (userState) {
            if (userState.action === 'tts_input') {
                const settings = ttsManager.getUserSettings(userId);
                const language = userState.language || settings.language;
                
                try {
                    bot.sendMessage(chatId, '🎤 음성을 생성하고 있습니다... 잠시만 기다려주세요.');
                    
                    // 언어별 설정 업데이트
                    const languageSettings = ttsManager.getLanguageSettings();
                    const langConfig = languageSettings[language];
                    const voiceType = settings.voice.includes('Standard-A') || settings.voice.includes('Standard-C') ? 
                                     (settings.voice.includes('A') ? 'female' : 'male') : 'female';
                    
                    const ttsSettings = {
                        language: language,
                        voice: langConfig.voices[voiceType],
                        speed: settings.speed
                    };
                    
                    const audioContent = await ttsManager.generateTTS(text, ttsSettings);
                    
                    if (audioContent) {
                        // 음성 파일을 임시로 저장하고 전송
                        const fs = require('fs');
                        const path = require('path');
                        const tempFileName = `tts_${Date.now()}.mp3`;
                        const tempFilePath = path.join(__dirname, tempFileName);
                        
                        fs.writeFileSync(tempFilePath, audioContent, 'binary');
                        
                        await bot.sendVoice(chatId, tempFilePath, {
                            caption: `🎤 "${text}" (${langConfig.name})`,
                            reply_markup: { 
                                inline_keyboard: [
                                    [{ text: '🔄 다시 생성', callback_data: userState.language ? `tts_${userState.language.split('-')[0]}` : 'tts_korean' }],
                                    [{ text: '🔙 TTS 메뉴', callback_data: 'tts_menu' }]
                                ]
                            }
                        });
                        
                        // 임시 파일 삭제
                        fs.unlinkSync(tempFilePath);
                    } else {
                        bot.sendMessage(chatId, `❌ 음성 생성에 실패했습니다.\n\n📝 입력하신 텍스트: "${text}"\n🌐 언어: ${langConfig.name}`, {
                            reply_markup: { 
                                inline_keyboard: [
                                    [{ text: '🔄 다시 시도', callback_data: userState.language ? `tts_${userState.language.split('-')[0]}` : 'tts_korean' }],
                                    [{ text: '🔙 TTS 메뉴', callback_data: 'tts_menu' }]
                                ]
                            }
                        });
                    }
                } catch (error) {
                    console.error('TTS 처리 오류:', error);
                    bot.sendMessage(chatId, '❌ 음성 생성 중 오류가 발생했습니다.');
                }
                
                userStates.delete(userId);
                return;
            }
        }

        // 타이머 상태 처리
        if (userState) {
            if (userState.action === 'starting_timer') {
                const taskName = text.trim();
                if (taskName) {
                    if (timerManager.start(chatId, taskName)) {
                        bot.sendMessage(chatId, 
                            `⏰ "${taskName}" 타이머를 시작했습니다!`, 
                            { 
                                reply_markup: { 
                                    inline_keyboard: [
                                        [{ text: '⏱️ 현재 상태', callback_data: 'timer_status' }],
                                        [{ text: '⏹️ 타이머 중지', callback_data: 'timer_stop' }],
                                        [{ text: '🔙 타이머 메뉴', callback_data: 'timer_menu' }]
                                    ]
                                }
                            }
                        );
                    } else {
                        bot.sendMessage(chatId, '❌ 이미 실행 중인 타이머가 있습니다.');
                    }
                } else {
                    bot.sendMessage(chatId, '❌ 작업명을 입력해주세요.');
                }
                userStates.delete(userId);
                return;
            }
            
            if (userState.action === 'adding_minute_reminder') {
                const parts = text.trim().split(' ');
                const minutes = parseInt(parts[0]);
                const task = parts.slice(1).join(' ');
                
                if (isNaN(minutes) || minutes <= 0 || !task) {
                    bot.sendMessage(chatId, '❌ 올바른 형식으로 입력해주세요.\n예: 30 독서하기');
                    return;
                }
                
                reminderManager.addMinuteReminder(chatId, minutes, task);
                bot.sendMessage(chatId, 
                    `⏳ ${minutes}분 뒤에 "${task}"를 리마인드 할게요!`, 
                    { 
                        reply_markup: { 
                            inline_keyboard: [
                                [{ text: '📋 리마인더 목록', callback_data: 'reminder_list' }],
                                [{ text: '🔙 리마인더 메뉴', callback_data: 'reminder_menu' }]
                            ]
                        }
                    }
                );
                userStates.delete(userId);
                return;
            }
            
            if (userState.action === 'adding_time_reminder') {
                const parts = text.trim().split(' ');
                const timeStr = parts[0];
                const task = parts.slice(1).join(' ');
                
                if (!/^\d{1,2}:\d{2}$/.test(timeStr) || !task) {
                    bot.sendMessage(chatId, '❌ 올바른 형식으로 입력해주세요.\n예: 14:30 점심약속');
                    return;
                }
                
                reminderManager.addTimeReminder(chatId, timeStr, task, bot);
                bot.sendMessage(chatId, 
                    `⏰ ${timeStr}에 "${task}"를 리마인드 할게요!`, 
                    { 
                        reply_markup: { 
                            inline_keyboard: [
                                [{ text: '📋 리마인더 목록', callback_data: 'reminder_list' }],
                                [{ text: '🔙 리마인더 메뉴', callback_data: 'reminder_menu' }]
                            ]
                        }
                    }
                );
                userStates.delete(userId);
                return;
            }
        }

        // 할일 관리 상태 처리
        if (userState) {
            if (userState.action === 'adding_todo') {
                try {
                    const success = await todoFunctions.addTodo(userId, text);
                    if (success) {
                        bot.sendMessage(chatId, 
                            `✅ 할일이 추가되었습니다!\n\n📝 "${text}"`, 
                            { 
                                reply_markup: { 
                                    inline_keyboard: [[{ text: '📋 할일 목록 보기', callback_data: 'todo_list' }]] 
                                }
                            }
                        );
                    } else {
                        bot.sendMessage(chatId, '❌ 할일 추가 중 오류가 발생했습니다.');
                    }
                    userStates.delete(userId);
                } catch (error) {
                    console.error('할일 추가 오류:', error);
                    bot.sendMessage(chatId, '❌ 할일 추가 중 오류가 발생했습니다.');
                }
                return;
            }
        }

        // 연차 관리 상태 처리
        if (userState) {
            if (userState.action === 'setting_total_leave') {
                const totalLeaves = parseInt(text);
                if (isNaN(totalLeaves) || totalLeaves <= 0 || totalLeaves > 50) {
                    bot.sendMessage(chatId, '❌ 올바른 연차 일수를 입력해주세요. (1-50일)');
                    return;
                }

                try {
                    const result = await leaveManager.setTotalLeaves(userId, totalLeaves);
                    bot.sendMessage(chatId, 
                        `✅ 연차가 설정되었습니다!\n\n` +
                        `📅 총 연차: ${result.totalLeaves}일\n` +
                        `⏳ 남은 연차: ${result.remainingLeaves}일`, 
                        { 
                            reply_markup: { 
                                inline_keyboard: [[{ text: '🔙 휴가 메뉴', callback_data: 'leave_menu' }]] 
                            }
                        }
                    );
                    userStates.delete(userId);
                } catch (error) {
                    console.error('연차 설정 오류:', error);
                    bot.sendMessage(chatId, '❌ 연차 설정 중 오류가 발생했습니다.');
                }
                return;
            }

            if (userState.action === 'using_leave') {
                const days = parseFloat(text);
                if (isNaN(days) || (days !== 0.5 && days !== 1 && days !== parseInt(days)) || days <= 0 || days > 20) {
                    bot.sendMessage(chatId, '❌ 올바른 연차 일수를 입력해주세요.\n예: 1 (하루), 0.5 (반차), 2 (이틀)');
                    return;
                }

                try {
                    const result = await leaveManager.useLeave(userId, days, '사용자 입력');
                    bot.sendMessage(chatId, 
                        `✅ 연차가 사용되었습니다!\n\n` +
                        `🏖️ 사용한 연차: ${days}일\n` +
                        `📊 총 사용: ${result.usedLeaves}일\n` +
                        `⏳ 남은 연차: ${result.remainingLeaves}일`, 
                        { 
                            reply_markup: { 
                                inline_keyboard: [[{ text: '🔙 휴가 메뉴', callback_data: 'leave_menu' }]] 
                            }
                        }
                    );
                    userStates.delete(userId);
                } catch (error) {
                    console.error('연차 사용 오류:', error);
                    bot.sendMessage(chatId, `❌ ${error.message}`);
                }
                return;
            }
        }

        // 일반 명령어 처리
        switch (true) {
            case text === '/start':
                userStates.delete(userId); // 상태 초기화
                bot.sendMessage(chatId, '🤖 두목봇 메인 메뉴\n\n원하는 기능을 선택해주세요:', {
                    reply_markup: mainMenuKeyboard
                });
            case 'tts_menu':
                bot.editMessageText('🎤 TTS (음성 변환) 메뉴\n\n원하는 언어를 선택해주세요:', {
                    chat_id: chatId,
                    message_id: message.message_id,
                    reply_markup: ttsMenuKeyboard
                });
                break;

            case 'tts_korean':
                userStates.set(userId, { action: 'tts_input', language: 'ko-KR' });
                bot.sendMessage(chatId, '🎤 **한국어 TTS**\n\n음성으로 변환할 한국어 텍스트를 입력해주세요.\n\n예: 안녕하세요, 반갑습니다!\n\n취소하려면 /cancel 을 입력하세요.');
                break;

            case 'tts_english':
                userStates.set(userId, { action: 'tts_input', language: 'en-US' });
                bot.sendMessage(chatId, '🗣️ **English TTS**\n\nPlease enter the English text to convert to speech.\n\nExample: Hello, nice to meet you!\n\nType /cancel to cancel.');
                break;

            case 'tts_japanese':
                userStates.set(userId, { action: 'tts_input', language: 'ja-JP' });
                bot.sendMessage(chatId, '🇯🇵 **日本語 TTS**\n\n音声に変換する日本語テキストを入力してください。\n\n例: こんにちは、はじめまして！\n\nキャンセルするには /cancel を入力してください。');
                break;

            case 'tts_chinese':
                userStates.set(userId, { action: 'tts_input', language: 'zh-CN' });
                bot.sendMessage(chatId, '🇨🇳 **中文 TTS**\n\n请输入要转换为语音的中文文本。\n\n例如: 你好，很高兴见到你！\n\n要取消请输入 /cancel');
                break;

            case 'tts_settings':
                const currentSettings = ttsManager.getUserSettings(userId);
                const languageSettings = ttsManager.getLanguageSettings();
                const currentLang = languageSettings[currentSettings.language];
                const isVoiceFemale = currentSettings.voice.includes('A');
                const speedText = currentSettings.speed === 0.8 ? '느린' : 
                                currentSettings.speed === 1.2 ? '빠른' : '보통';
                
                bot.sendMessage(chatId, 
                    `⚙️ **TTS 설정**\n\n` +
                    `🌐 현재 언어: ${currentLang.name}\n` +
                    `🎭 현재 음성: ${isVoiceFemale ? '👩 여성' : '👨 남성'}\n` +
                    `⚡ 현재 속도: ${speedText}\n\n` +
                    `아래 버튼으로 설정을 변경하세요:`, {
                    parse_mode: 'Markdown',
                    reply_markup: ttsSettingsKeyboard
                });
                break;

            case 'tts_voice_male':
                const currentLangMale = ttsManager.getUserSettings(userId).language;
                const langConfigMale = ttsManager.getLanguageSettings()[currentLangMale];
                ttsManager.setUserSettings(userId, { voice: langConfigMale.voices.male });
                bot.sendMessage(chatId, '👨 남성 음성으로 설정되었습니다!', {
                    reply_markup: { 
                        inline_keyboard: [[{ text: '🔙 TTS 설정', callback_data: 'tts_settings' }]] 
                    }
                });
                break;

            case 'tts_voice_female':
                const currentLangFemale = ttsManager.getUserSettings(userId).language;
                const langConfigFemale = ttsManager.getLanguageSettings()[currentLangFemale];
                ttsManager.setUserSettings(userId, { voice: langConfigFemale.voices.female });
                bot.sendMessage(chatId, '👩 여성 음성으로 설정되었습니다!', {
                    reply_markup: { 
                        inline_keyboard: [[{ text: '🔙 TTS 설정', callback_data: 'tts_settings' }]] 
                    }
                });
                break;

            case 'tts_speed_slow':
                ttsManager.setUserSettings(userId, { speed: 0.8 });
                bot.sendMessage(chatId, '🐌 느린 속도로 설정되었습니다!', {
                    reply_markup: { 
                        inline_keyboard: [[{ text: '🔙 TTS 설정', callback_data: 'tts_settings' }]] 
                    }
                });
                break;

            case 'tts_speed_fast':
                ttsManager.setUserSettings(userId, { speed: 1.2 });
                bot.sendMessage(chatId, '⚡ 빠른 속도로 설정되었습니다!', {
                    reply_markup: { 
                        inline_keyboard: [[{ text: '🔙 TTS 설정', callback_data: 'tts_settings' }]] 
                    }
                });
                break;

            case 'tts_help':
                const helpText = ttsManager.getUsageInfo();
                bot.sendMessage(chatId, helpText, {
                    parse_mode: 'Markdown',
                    reply_markup: { 
                        inline_keyboard: [
                            [{ text: '🎤 TTS 시작하기', callback_data: 'tts_korean' }],
                            [{ text: '🔙 TTS 메뉴', callback_data: 'tts_menu' }]
                        ]
                    }
                });
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
                // 기존 /add 명령어도 유지
                const taskText = text.replace('/add ', '');
                if (taskText.trim()) {
                    try {
                        const success = await todoFunctions.addTodo(userId, taskText);
                        if (success) {
                            bot.sendMessage(chatId, 
                                `✅ 할일이 추가되었습니다!\n\n📝 "${taskText}"`, 
                                { 
                                    reply_markup: { 
                                        inline_keyboard: [[{ text: '📋 할일 목록 보기', callback_data: 'todo_list' }]] 
                                    }
                                }
                            );
                        } else {
                            bot.sendMessage(chatId, '❌ 할일 추가 중 오류가 발생했습니다.');
                        }
                    } catch (error) {
                        console.error('할일 추가 오류:', error);
                        bot.sendMessage(chatId, '❌ 할일 추가 중 오류가 발생했습니다.');
                    }
                } else {
                    bot.sendMessage(chatId, '📝 할일 내용을 입력해주세요.\n예: /add 회의 준비하기');
                }
                break;
            default:
                bot.sendMessage(chatId, '😅 알 수 없는 명령어입니다. /start 를 입력해서 메뉴를 확인하세요.');
        }
    } catch (error) {
        console.error('메시지 처리 오류:', error);
        bot.sendMessage(chatId, '❌ 처리 중 오류가 발생했습니다.');
    }
});

// 콜백 쿼리 핸들러 (이 전체 부분이 새로 추가됨)
bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const data = callbackQuery.data;
    const chatId = message.chat.id;
    const userId = callbackQuery.from.id;

    // 콜백 쿼리 응답 (로딩 표시 제거)
    bot.answerCallbackQuery(callbackQuery.id);

    try {
        switch (data) {
            case 'main_menu':
                bot.editMessageText('🤖 두목봇 메인 메뉴\n\n원하는 기능을 선택해주세요:', {
                    chat_id: chatId,
                    message_id: message.message_id,
                    reply_markup: mainMenuKeyboard
                });
                break;

            case 'leave_menu':
                bot.editMessageText('📅 휴가 관리 메뉴\n\n원하는 기능을 선택해주세요:', {
                    chat_id: chatId,
                    message_id: message.message_id,
                    reply_markup: leaveMenuKeyboard
                });
                break;

            case 'leave_status':
                const user = await leaveManager.getUserLeaves(userId);
                const status = leaveManager.formatLeaveStatus(user);
                bot.sendMessage(chatId, status, { 
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [[{ text: '🔙 휴가 메뉴', callback_data: 'leave_menu' }]] }
                });
                break;

            case 'leave_history':
                const history = await leaveManager.getLeaveHistory(userId);
                const historyText = leaveManager.formatLeaveHistory(history);
                bot.sendMessage(chatId, historyText, { 
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [[{ text: '🔙 휴가 메뉴', callback_data: 'leave_menu' }]] }
                });
                break;

            case 'use_leave':
                userStates.set(userId, { action: 'using_leave' });
                bot.sendMessage(chatId, '🏖️ 연차 사용하기\n\n사용할 연차 일수를 입력해주세요.\n예: 1 (하루), 0.5 (반차)\n\n취소하려면 /cancel 을 입력하세요.');
                break;

            case 'set_leave':
                userStates.set(userId, { action: 'setting_total_leave' });
                bot.sendMessage(chatId, '⚙️ 연차 설정하기\n\n총 연차 일수를 입력해주세요.\n예: 15\n\n취소하려면 /cancel 을 입력하세요.');
                break;

            case 'fortune_menu':
                bot.editMessageText('🔮 운세 메뉴\n\n원하는 운세를 선택해주세요:', {
                    chat_id: chatId,
                    message_id: message.message_id,
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '🌟 일반운세', callback_data: 'fortune_general' },
                                { text: '💼 업무운', callback_data: 'fortune_work' }
                            ],
                            [
                                { text: '💕 연애운', callback_data: 'fortune_love' },
                                { text: '💰 재물운', callback_data: 'fortune_money' }
                            ],
                            [
                                { text: '🌿 건강운', callback_data: 'fortune_health' },
                                { text: '🍻 회식운', callback_data: 'fortune_meeting' }
                            ],
                            [
                                { text: '🃏 타로카드', callback_data: 'fortune_tarot' },
                                { text: '🍀 행운정보', callback_data: 'fortune_lucky' }
                            ],
                            [
                                { text: '📋 종합운세', callback_data: 'fortune_all' }
                            ],
                            [
                                { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
                            ]
                        ]
                    }
                });
                break;

            case 'fortune_general':
                // 기존 fortune 모듈 사용
                fortune(bot, { chat: { id: chatId }, from: { id: userId }, text: '/fortune' });
                break;

            case 'fortune_work':
                fortune(bot, { chat: { id: chatId }, from: { id: userId }, text: '/fortune work' });
                break;

            case 'fortune_love':
                fortune(bot, { chat: { id: chatId }, from: { id: userId }, text: '/fortune love' });
                break;

            case 'fortune_money':
                fortune(bot, { chat: { id: chatId }, from: { id: userId }, text: '/fortune money' });
                break;

            case 'fortune_health':
                fortune(bot, { chat: { id: chatId }, from: { id: userId }, text: '/fortune health' });
                break;

            case 'fortune_meeting':
                fortune(bot, { chat: { id: chatId }, from: { id: userId }, text: '/fortune meeting' });
                break;

            case 'fortune_tarot':
                fortune(bot, { chat: { id: chatId }, from: { id: userId }, text: '/fortune tarot' });
                break;

            case 'fortune_lucky':
                fortune(bot, { chat: { id: chatId }, from: { id: userId }, text: '/fortune lucky' });
                break;

            case 'fortune_all':
                fortune(bot, { chat: { id: chatId }, from: { id: userId, first_name: callbackQuery.from.first_name }, text: '/fortune all' });
                break;

            case 'todo_menu':
                bot.editMessageText('📝 할일 관리 메뉴\n\n원하는 기능을 선택해주세요:', {
                    chat_id: chatId,
                    message_id: message.message_id,
                    reply_markup: todoMenuKeyboard
                });
                break;

            case 'todo_list':
                try {
                    const todos = await todoFunctions.getTodos(userId);
                    if (todos.length === 0) {
                        bot.sendMessage(chatId, '📝 할일이 없습니다.\n\n새로운 할일을 추가해보세요!', {
                            reply_markup: { 
                                inline_keyboard: [
                                    [{ text: '➕ 할일 추가', callback_data: 'todo_add' }],
                                    [{ text: '🔙 할일 메뉴', callback_data: 'todo_menu' }]
                                ]
                            }
                        });
                    } else {
                        let todoText = '📋 **할일 목록**\n\n';
                        const todoButtons = [];
                        
                        todos.forEach((todo, index) => {
                            const status = todo.done ? '✅' : '⭕';
                            const strikethrough = todo.done ? '~~' : '';
                            todoText += `${index + 1}. ${status} ${strikethrough}${todo.task}${strikethrough}\n`;
                            
                            // 각 할일마다 토글/삭제 버튼 추가
                            todoButtons.push([
                                { text: `${todo.done ? '↩️' : '✅'} ${index + 1}`, callback_data: `todo_toggle_${index}` },
                                { text: `🗑️ ${index + 1}`, callback_data: `todo_delete_${index}` }
                            ]);
                        });
                        
                        todoButtons.push([{ text: '🔙 할일 메뉴', callback_data: 'todo_menu' }]);
                        
                        bot.sendMessage(chatId, todoText, {
                            parse_mode: 'Markdown',
                            reply_markup: { inline_keyboard: todoButtons }
                        });
                    }
                } catch (error) {
                    console.error('할일 목록 조회 오류:', error);
                    bot.sendMessage(chatId, '❌ 할일 목록을 불러오는 중 오류가 발생했습니다.');
                }
                break;

            case 'todo_add':
                userStates.set(userId, { action: 'adding_todo' });
                bot.sendMessage(chatId, '📝 **할일 추가하기**\n\n추가할 할일을 입력해주세요.\n\n취소하려면 /cancel 을 입력하세요.');
                break;

            case 'todo_stats':
                try {
                    const stats = await todoFunctions.getTodoStats(userId);
                    const statsText = `📊 **할일 통계**\n\n` +
                                    `📝 전체 할일: ${stats.total}개\n` +
                                    `✅ 완료된 할일: ${stats.completed}개\n` +
                                    `⭕ 미완료 할일: ${stats.pending}개\n` +
                                    `📈 완료율: ${stats.completionRate}%`;
                    
                    bot.sendMessage(chatId, statsText, {
                        parse_mode: 'Markdown',
                        reply_markup: { 
                            inline_keyboard: [[{ text: '🔙 할일 메뉴', callback_data: 'todo_menu' }]] 
                        }
                    });
                } catch (error) {
                    console.error('할일 통계 조회 오류:', error);
                    bot.sendMessage(chatId, '❌ 할일 통계를 불러오는 중 오류가 발생했습니다.');
                }
                break;

            case 'todo_clear_completed':
                try {
                    const success = await todoFunctions.clearCompletedTodos(userId);
                    if (success) {
                        bot.sendMessage(chatId, '✅ 완료된 할일들이 삭제되었습니다!', {
                            reply_markup: { 
                                inline_keyboard: [
                                    [{ text: '📋 할일 목록 보기', callback_data: 'todo_list' }],
                                    [{ text: '🔙 할일 메뉴', callback_data: 'todo_menu' }]
                                ]
                            }
                        });
                    } else {
                        bot.sendMessage(chatId, '❌ 완료된 할일 삭제 중 오류가 발생했습니다.');
                    }
                } catch (error) {
                    console.error('완료된 할일 삭제 오류:', error);
                    bot.sendMessage(chatId, '❌ 완료된 할일 삭제 중 오류가 발생했습니다.');
                }
                break;

            case 'todo_clear_all':
                bot.sendMessage(chatId, '⚠️ **모든 할일 삭제**\n\n정말로 모든 할일을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.', {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '✅ 예, 삭제합니다', callback_data: 'todo_clear_all_confirm' },
                                { text: '❌ 취소', callback_data: 'todo_menu' }
                            ]
                        ]
                    }
                });
                break;

            case 'todo_clear_all_confirm':
                try {
                    const success = await todoFunctions.clearTodos(userId);
                    if (success) {
                        bot.sendMessage(chatId, '✅ 모든 할일이 삭제되었습니다!', {
                            reply_markup: { 
                                inline_keyboard: [
                                    [{ text: '➕ 새 할일 추가', callback_data: 'todo_add' }],
                                    [{ text: '🔙 할일 메뉴', callback_data: 'todo_menu' }]
                                ]
                            }
                        });
                    } else {
                        bot.sendMessage(chatId, '❌ 할일 삭제 중 오류가 발생했습니다.');
                    }
                } catch (error) {
                    console.error('모든 할일 삭제 오류:', error);
                    bot.sendMessage(chatId, '❌ 할일 삭제 중 오류가 발생했습니다.');
                }
                break;

            case 'timer_menu':
                bot.sendMessage(chatId, '⏰ 타이머 기능\n\n타이머를 사용하려면:\n/timer 분\n\n예: /timer 25');
                break;

            case 'help_menu':
                utils(bot, { chat: { id: chatId } });
                break;

            case 'worktime_menu':
                bot.editMessageText('💼 근무시간 메뉴\n\n원하는 기능을 선택해주세요:', {
                    chat_id: chatId,
                    message_id: message.message_id,
                    reply_markup: worktimeMenuKeyboard
                });
                break;

            case 'worktime_status':
                const detailedStatus = workTimeManager.getDetailedStatus();
                const motivationalMsg = workTimeManager.getMotivationalMessage();
                
                bot.sendMessage(chatId, `${detailedStatus}\n\n💬 ${motivationalMsg}`, {
                    parse_mode: 'Markdown',
                    reply_markup: { 
                        inline_keyboard: [
                            [{ text: '🔄 상태 새로고침', callback_data: 'worktime_status' }],
                            [{ text: '📊 주간 통계', callback_data: 'worktime_weekly' }],
                            [{ text: '🔙 근무시간 메뉴', callback_data: 'worktime_menu' }]
                        ]
                    }
                });
                break;

            case 'worktime_info':
                const scheduleInfo = workTimeManager.formatSchedule();
                bot.sendMessage(chatId, `${scheduleInfo}\n\n💡 **근무시간 안내**\n\n` +
                    `• 정규 근무시간은 9시간입니다.\n` +
                    `• 점심시간은 별도로 포함되지 않습니다.\n` +
                    `• 한국 시간(KST) 기준으로 계산됩니다.\n` +
                    `• 실시간으로 남은 시간을 확인할 수 있어요!`, {
                    parse_mode: 'Markdown',
                    reply_markup: { 
                        inline_keyboard: [
                            [{ text: '⏰ 현재 상태 확인', callback_data: 'worktime_status' }],
                            [{ text: '🔙 근무시간 메뉴', callback_data: 'worktime_menu' }]
                        ]
                    }
                });
                break;

            case 'worktime_weekly':
                const weeklyStats = workTimeManager.getWeeklyStats();
                bot.sendMessage(chatId, weeklyStats, {
                    parse_mode: 'Markdown',
                    reply_markup: { 
                        inline_keyboard: [
                            [{ text: '⏰ 현재 상태', callback_data: 'worktime_status' }],
                            [{ text: '🎯 목표 설정', callback_data: 'worktime_goal' }],
                            [{ text: '🔙 근무시간 메뉴', callback_data: 'worktime_menu' }]
                        ]
                    }
                });
                break;

            case 'worktime_goal':
                bot.sendMessage(chatId, `🎯 **근무 목표 설정**\n\n` +
                    `현재는 기본 근무시간 관리 기능을 제공하고 있습니다.\n\n` +
                    `**앞으로 추가될 기능들:**\n` +
                    `• 개인별 근무시간 목표 설정\n` +
                    `• 업무 효율성 트래킹\n` +
                    `• 휴식시간 알림\n` +
                    `• 주간/월간 근무 리포트\n\n` +
                    `더 나은 근무시간 관리를 위해 지속적으로 업데이트할 예정입니다! 💪`, {
                    parse_mode: 'Markdown',
                    reply_markup: { 
                        inline_keyboard: [
                            [{ text: '📊 현재 통계 보기', callback_data: 'worktime_weekly' }],
                            [{ text: '🔙 근무시간 메뉴', callback_data: 'worktime_menu' }]
                        ]
                    }
                });
                break;

            default:
                bot.sendMessage(chatId, '❌ 알 수 없는 명령입니다.');
        }
    } catch (error) {
        console.error('콜백 처리 오류:', error);
        bot.sendMessage(chatId, '❌ 연차 정보를 불러오는 중 오류가 발생했습니다.');
    }
});

// 리마인더에서 실제로 알림을 보내는 함수 개선
reminderManager.sendReminder = function(chatId, task) {
    bot.sendMessage(chatId, `🔔 **리마인드**\n\n${task}`, {
        reply_markup: { 
            inline_keyboard: [
                [{ text: '✅ 확인', callback_data: 'reminder_menu' }]
            ]
        }
    });
};
    console.log('봇 종료 중...');
    await leaveManager.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('봇 종료 중...');
    await leaveManager.close();
    process.exit(0);
});
