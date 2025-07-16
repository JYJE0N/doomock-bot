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
const todoFunctions = require('./todos');
const utils = require('./utils');
const worktime = require('./worktime');
const remind = require('./remind');
const MonthlyLeave = require('./monthly_leave');
const weather = require('./weather');
const { getUserName, formatUserInfo } = require('./username_helper');

// 연차 관리 인스턴스 생성
const leaveManager = new MonthlyLeave();

// 사용자 상태 관리 (메모리 기반)
const userStates = new Map();

//setCommands 및 BotMenu 세팅
bot.setMyCommands([
    { command: 'start', description: '📱 메인 메뉴 보기' },
    { command: 'help', description: '❓ 도움말 보기' },
    { command: 'fortune', description: '🔮 오늘의 운세' },
    { command: 'worktime', description: '🕐 근무시간 보기' },
    { command: 'timer', description: '⏰ 타이머 시작/종료' },
    { command: 'add', description: '➕ 할일 추가하기 (/add 할일내용)' },
    { command: 'tts', description: '🔊 텍스트를 음성으로 변환 (/tts 안녕하세요)' },
    { command: 'remind', description: '🔔 리마인더 설정하기 (/remind 30 독서하기)' },
    { command: 'weather', description: '🌤️ 날씨 정보 확인' },
    { command: 'cancel', description: '❌ 진행중인 작업 취소' }
]).then(() => {
    console.log('✅ 명령어가 Telegram에 등록되었습니다.');
}).catch(console.error);

// Bot Menu 설정 (안전한 방법으로 시도)
try {
    if (typeof bot.setMyMenuButton === 'function') {
        bot.setMyMenuButton({
            menu_button: {
                type: 'commands'
            }
        }).then(() => {
            console.log('✅ Bot Menu가 활성화되었습니다.');
        }).catch((err) => {
            console.log('⚠️ Bot Menu 설정 실패 (버전 미지원):', err.message);
        });
    } else {
        console.log('⚠️ setMyMenuButton 메서드가 지원되지 않습니다. 명령어 목록만 사용됩니다.');
    }
} catch (error) {
    console.log('⚠️ Bot Menu 설정을 건너뜁니다:', error.message);
}

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
            { text: '🌤️ 날씨', callback_data: 'weather_menu' } // ← 추가
        ],
        [
            { text: '🔔 리마인더', callback_data: 'reminder_menu' },
            { text: '🛠️ 유틸리티', callback_data: 'utils_menu' }
        ],
        [
            { text: '❓ 도움말', callback_data: 'help_menu' }
        ]
    ]
};

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

// 리마인더 메뉴 키보드
const reminderMenuKeyboard = {
    inline_keyboard: [
        [
            { text: '⏰ 분 단위 설정', callback_data: 'remind_minutes' },
            { text: '🕐 시간 설정', callback_data: 'remind_time' }
        ],
        [
            { text: '❓ 사용법', callback_data: 'remind_help' }
        ],
        [
            { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
        ]
    ]
};
const timerMenuKeyboard = {
    inline_keyboard: [
        [
            { text: '▶️ 타이머 시작', callback_data: 'timer_start_prompt' },
            { text: '⏹️ 타이머 정지', callback_data: 'timer_stop' }
        ],
        [
            { text: '⏱️ 현재 상태', callback_data: 'timer_status' },
            { text: '📋 타이머 기록', callback_data: 'timer_history' }
        ],
        [
            { text: '📊 타이머 통계', callback_data: 'timer_stats' },
            { text: '❓ 사용법', callback_data: 'timer_help' }
        ],
        [
            { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
        ]
    ]
};

// 메시지 핸들러 수정 - default 케이스 문제 해결

bot.on('message', async (msg) => {
    const text = msg.text;
    if (!text) return;  // 🛡️ 텍스트 없는 메시지 방어

    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // 사용자 상태 확인
    const userState = userStates.get(userId);

    try {
        // 취소 명령어 처리
        if (text === '/cancel') {
            userStates.delete(userId);
            bot.sendMessage(chatId, `❌ ${getUserName(msg.from)}님, 작업이 취소되었습니다.`);
            return;
        }

        // 할일 관리 상태 처리
        if (userState && userState.action === 'adding_todo') {
            try {
                const success = await todoFunctions.addTodo(userId, text);
                if (success) {
                    bot.sendMessage(chatId, 
                        `✅ ${getUserName(msg.from)}님, 할일이 추가되었습니다!\n\n📝 "${text}"`, 
                        { 
                            reply_markup: { 
                                inline_keyboard: [[{ text: '📋 할일 목록 보기', callback_data: 'todo_list' }]] 
                            }
                        }
                    );
                } else {
                    bot.sendMessage(chatId, `❌ ${getUserName(msg.from)}님, 할일 추가 중 오류가 발생했습니다.`);
                }
                userStates.delete(userId);
            } catch (error) {
                console.error('할일 추가 오류:', error);
                bot.sendMessage(chatId, '❌ 할일 추가 중 오류가 발생했습니다.');
                userStates.delete(userId);
            }
            return;
        }

        // TTS 관련 상태 처리 (수정됨)
        if (userState && userState.action === 'tts_input') {
            try {
                const language = userState.language || 'ko';
                userStates.delete(userId); // 상태 먼저 삭제
                
                if (typeof utils.handleTTSCommand === 'function') {
                    utils.handleTTSCommand(bot, chatId, userId, `/tts ${language} ${text}`);
                } else {
                    bot.sendMessage(chatId, `📝 TTS 요청: "${text}" (${language})\n⚠️ TTS 패키지가 설치되지 않았습니다.`);
                }
            } catch (error) {
                console.error('TTS 처리 오류:', error);
                bot.sendMessage(chatId, `❌ ${getUserName(msg.from)}님, TTS 처리 중 오류가 발생했습니다.`);
            }
            return;
        }

        // 리마인더 상태 처리
        if (userState && userState.action === 'remind_minutes') {
            try {
                remind(bot, { chat: { id: chatId }, text: `/remind ${text}` });
                userStates.delete(userId);
            } catch (error) {
                console.error('리마인더 설정 오류:', error);
                bot.sendMessage(chatId, '❌ 리마인더 설정 중 오류가 발생했습니다.');
                userStates.delete(userId);
            }
            return;
        }

        if (userState && userState.action === 'remind_time') {
            try {
                remind(bot, { chat: { id: chatId }, text: `/remind ${text}` });
                userStates.delete(userId);
            } catch (error) {
                console.error('리마인더 설정 오류:', error);
                bot.sendMessage(chatId, '❌ 리마인더 설정 중 오류가 발생했습니다.');
                userStates.delete(userId);
            }
            return;
        }

        // 타이머 상태 처리
        if (userState && userState.action === 'timer_start') {
            try {
                timer(bot, { chat: { id: chatId }, text: `/timer start ${text}` });
                userStates.delete(userId);
            } catch (error) {
                console.error('타이머 시작 오류:', error);
                bot.sendMessage(chatId, '❌ 타이머 시작 중 오류가 발생했습니다.');
                userStates.delete(userId);
            }
            return;
        }

        // 연차 관리 상태 처리
        if (userState && userState.action === 'setting_total_leave') {
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
                userStates.delete(userId);
            }
            return;
        }

        if (userState && userState.action === 'using_leave') {
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
                userStates.delete(userId);
            }
            return;
        }

        // 일반 명령어 처리
        if (text.startsWith('/start')) {
            userStates.delete(userId); // 상태 초기화
            bot.sendMessage(chatId, `🤖 안녕하세요 ${getUserName(msg.from)}님!\n\n두목봇 메인 메뉴에서 원하는 기능을 선택해주세요:`, {
                reply_markup: mainMenuKeyboard
            });
        } else if (text === '/help') {
            userStates.delete(userId); // 상태 초기화
            utils(bot, msg);
        } else if (text === '/worktime') {
            userStates.delete(userId); // 상태 초기화
            worktime(bot, msg);
        } else if (text === '/fortune') {
            userStates.delete(userId); // 상태 초기화
            fortune(bot, msg);
        } else if (text.startsWith('/tts')) {
            userStates.delete(userId); // 상태 초기화
            utils(bot, msg);
        } else if (text.startsWith('/remind')) {
            userStates.delete(userId); // 상태 초기화
            remind(bot, msg);
        } else if (text.startsWith('/timer')) {
            userStates.delete(userId); // 상태 초기화
            timer(bot, msg);
            //날씨
        } else if (text.startsWith('/weather') || text.startsWith('/날씨')) {
            userStates.delete(userId);
            weather(bot, msg);
        } else if (text.startsWith('/add ')) {
            userStates.delete(userId); // 상태 초기화
            const taskText = text.replace('/add ', '');
            if (taskText.trim()) {
                try {
                    const success = await todoFunctions.addTodo(userId, taskText);
                    if (success) {
                        bot.sendMessage(chatId, 
                            `✅ ${getUserName(msg.from)}님, 할일이 추가되었습니다!\n\n📝 "${taskText}"`, 
                            { 
                                reply_markup: { 
                                    inline_keyboard: [[{ text: '📋 할일 목록 보기', callback_data: 'todo_list' }]] 
                                }
                            }
                        );
                    } else {
                        bot.sendMessage(chatId, `❌ ${getUserName(msg.from)}님, 할일 추가 중 오류가 발생했습니다.`);
                    }
                } catch (error) {
                    console.error('할일 추가 오류:', error);
                    bot.sendMessage(chatId, '❌ 할일 추가 중 오류가 발생했습니다.');
                }
            } else {
                bot.sendMessage(chatId, `📝 ${getUserName(msg.from)}님, 할일 내용을 입력해주세요.\n예: /add 회의 준비하기`);
            }
        } else {
            // 일반 텍스트 처리 (수정된 부분)
            if (userState) {
                // 알 수 없는 상태라면 상태를 초기화하고 안내
                console.log(`알 수 없는 사용자 상태: ${userState.action}`);
                userStates.delete(userId);
                bot.sendMessage(chatId, `❌ ${getUserName(msg.from)}님, 진행 중이던 작업이 취소되었습니다. /start 를 입력해서 다시 시작해주세요.`);
            } else if (text.startsWith('/')) {
                // 알 수 없는 명령어
                bot.sendMessage(chatId, `😅 ${getUserName(msg.from)}님, 알 수 없는 명령어입니다. /start 를 입력해서 메뉴를 확인하세요.`);
            }
            // 일반 텍스트는 무시 (응답하지 않음)
        }
        
    } catch (error) {
        console.error('메시지 처리 오류:', error);
        userStates.delete(userId); // 오류 시 상태 초기화
        bot.sendMessage(chatId, '❌ 처리 중 오류가 발생했습니다. /start 를 입력해서 다시 시작해주세요.');
    }
});

// 추가: 봇 재시작 시 모든 사용자 상태 초기화
console.log('🔄 봇 시작 시 사용자 상태 초기화...');
userStates.clear();

// 콜백 쿼리 핸들러 수정 - 함수명 오타 수정

// 완전한 콜백 쿼리 핸들러 - 모든 케이스 포함

bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const data = callbackQuery.data;
    const chatId = message.chat.id;
    const userId = callbackQuery.from.id;

    // 디버깅 로그 추가
    console.log(`📞 콜백 쿼리 받음: "${data}" (사용자: ${userId})`);

    // 콜백 쿼리 응답 (올바른 함수명 사용)
    bot.answerCallbackQuery(callbackQuery.id);

    try {
        switch (data) {
            case 'main_menu':
                bot.editMessageText(`🤖 안녕하세요 ${getUserName(callbackQuery.from)}님!\n\n두목봇 메인 메뉴에서 원하는 기능을 선택해주세요:`, {
                    chat_id: chatId,
                    message_id: message.message_id,
                    reply_markup: mainMenuKeyboard
                });
                break;

            // ===== 휴가 관리 관련 =====
            case 'leave_menu':
                bot.editMessageText(`📅 ${getUserName(callbackQuery.from)}님의 휴가 관리 메뉴\n\n원하는 기능을 선택해주세요:`, {
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
                bot.sendMessage(chatId, '🏖️ **연차 사용하기**\n\n사용할 연차 일수를 입력해주세요.\n예: 1 (하루), 0.5 (반차)', {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '❌ 취소', callback_data: 'cancel_action' }]
                        ]
                    }
                });
                break;

            case 'set_leave':
                userStates.set(userId, { action: 'setting_total_leave' });
                bot.sendMessage(chatId, '⚙️ **연차 설정하기**\n\n총 연차 일수를 입력해주세요.\n예: 15', {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '❌ 취소', callback_data: 'cancel_action' }]
                        ]
                    }
                });
                break;

            // ===== 할일 관리 관련 =====
            case 'todo_menu':
                bot.editMessageText(`📝 ${getUserName(callbackQuery.from)}님의 할일 관리 메뉴\n\n원하는 기능을 선택해주세요:`, {
                    chat_id: chatId,
                    message_id: message.message_id,
                    reply_markup: todoMenuKeyboard
                });
                break;

            case 'todo_list':
                try {
                    const todos = await todoFunctions.getTodos(userId);
                    if (todos.length === 0) {
                        bot.sendMessage(chatId, `📝 ${getUserName(callbackQuery.from)}님의 할일이 없습니다.\n\n새로운 할일을 추가해보세요!`, {
                            reply_markup: { 
                                inline_keyboard: [
                                    [{ text: '➕ 할일 추가', callback_data: 'todo_add' }],
                                    [{ text: '🔙 할일 메뉴', callback_data: 'todo_menu' }]
                                ]
                            }
                        });
                    } else {
                        let todoText = `📋 **${getUserName(callbackQuery.from)}님의 할일 목록**\n\n`;
                        const todoButtons = [];
                        
                        todos.forEach((todo, index) => {
                            const status = todo.done ? '✅' : '⭕';
                            const strikethrough = todo.done ? '~~' : '';
                            todoText += `${index + 1}. ${status} ${strikethrough}${todo.task}${strikethrough}\n`;
                            
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
                bot.sendMessage(chatId, '📝 **할일 추가하기**\n\n추가할 할일을 입력해주세요.', {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '❌ 취소', callback_data: 'cancel_action' }]
                        ]
                    }
                });
                break;

            case 'todo_stats':
                try {
                    const stats = await todoFunctions.getTodoStats(userId);
                    const statsText = `📊 **할일 통계**\n\n` +
                                     `📝 전체 할일: ${stats.total}개\n` +
                                     `✅ 완료: ${stats.completed}개\n` +
                                     `⏳ 미완료: ${stats.pending}개\n` +
                                     `📈 완료율: ${stats.completionRate}%\n\n` +
                                     `${stats.completionRate >= 80 ? '🎉 훌륭해요!' : 
                                       stats.completionRate >= 50 ? '💪 좋은 진전이에요!' : 
                                       '🔥 화이팅!'}`
                    
                    bot.sendMessage(chatId, statsText, {
                        parse_mode: 'Markdown',
                        reply_markup: { 
                            inline_keyboard: [[{ text: '🔙 할일 메뉴', callback_data: 'todo_menu' }]] 
                        }
                    });
                } catch (error) {
                    console.error('할일 통계 조회 오류:', error);
                    bot.sendMessage(chatId, '❌ 통계를 불러오는 중 오류가 발생했습니다.');
                }
                break;

            case 'todo_clear_completed':
                try {
                    const success = await todoFunctions.clearCompletedTodos(userId);
                    if (success) {
                        bot.sendMessage(chatId, '🗑️ 완료된 할일들이 삭제되었습니다!', {
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
                    bot.sendMessage(chatId, '❌ 삭제 중 오류가 발생했습니다.');
                }
                break;

            case 'todo_clear_all':
                bot.sendMessage(chatId, 
                    '⚠️ **정말로 모든 할일을 삭제하시겠습니까?**\n\n' +
                    '이 작업은 되돌릴 수 없습니다!', 
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: '✅ 네, 삭제합니다', callback_data: 'todo_clear_all_confirm' },
                                    { text: '❌ 아니오', callback_data: 'todo_menu' }
                                ]
                            ]
                        }
                    }
                );
                break;

            case 'todo_clear_all_confirm':
                try {
                    const success = await todoFunctions.clearTodos(userId);
                    if (success) {
                        bot.sendMessage(chatId, '🗑️ 모든 할일이 삭제되었습니다!', {
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
                    bot.sendMessage(chatId, '❌ 삭제 중 오류가 발생했습니다.');
                }
                break;

            // ===== 운세 관련 =====
            case 'fortune_menu':
                bot.editMessageText('🔮 운세 메뉴\n\n원하는 운세를 선택해주세요:', {
                    chat_id: chatId,
                    message_id: message.message_id,
                    reply_markup: fortuneMenuKeyboard
                });
                break;

            case 'fortune_general':
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
                fortune(bot, { chat: { id: chatId }, from: { id: userId }, text: '/fortune all' });
                break;

            // ===== 근무시간 관련 =====
            case 'worktime_menu':
                worktime(bot, { 
                    chat: { id: chatId }, 
                    from: callbackQuery.from,
                    text: undefined
                });
                break;

            // ===== 타이머 관련 =====
            case 'timer_menu':
                bot.editMessageText('⏰ 타이머 메뉴\n\n원하는 기능을 선택해주세요:', {
                    chat_id: chatId,
                    message_id: message.message_id,
                    reply_markup: timerMenuKeyboard
                });
                break;

            case 'timer_start_prompt':
                userStates.set(userId, { action: 'timer_start' });
                bot.sendMessage(chatId, '⏰ **타이머 시작하기**\n\n작업명을 입력해주세요.\n\n예시:\n• 공부하기\n• [공부] 수학 문제풀이\n• [운동] 헬스장 가기', {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '❌ 취소', callback_data: 'cancel_action' }]
                        ]
                    }
                });
                break;

            case 'timer_stop':
                timer(bot, { chat: { id: chatId }, text: '/timer stop' });
                break;

            case 'timer_status':
                timer(bot, { chat: { id: chatId }, text: '/timer status' });
                break;

            case 'timer_history':
                timer(bot, { chat: { id: chatId }, text: '/timer history' });
                break;

            case 'timer_stats':
                timer(bot, { chat: { id: chatId }, text: '/timer stats' });
                break;

            case 'timer_help':
                timer(bot, { chat: { id: chatId }, text: '/timer' });
                break;

            // ===== 리마인더 관련 =====
            case 'reminder_menu':
                bot.editMessageText('🔔 리마인더 메뉴\n\n원하는 설정 방식을 선택해주세요:', {
                    chat_id: chatId,
                    message_id: message.message_id,
                    reply_markup: reminderMenuKeyboard
                });
                break;

            case 'remind_minutes':
                userStates.set(userId, { action: 'remind_minutes' });
                bot.sendMessage(chatId, '⏰ **분 단위 리마인더 설정**\n\n다음 형식으로 입력해주세요:\n`[분] [내용]`\n\n예시:\n• `30 독서하기`\n• `60 회의 준비`\n• `5 물 마시기`', {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '❌ 취소', callback_data: 'cancel_action' }]
                        ]
                    }
                });
                break;

            case 'remind_time':
                userStates.set(userId, { action: 'remind_time' });
                bot.sendMessage(chatId, '🕐 **시간 지정 리마인더 설정**\n\n다음 형식으로 입력해주세요:\n`[시:분] [내용]`\n\n예시:\n• `14:30 점심약속`\n• `09:00 출근`\n• `18:00 퇴근`', {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '❌ 취소', callback_data: 'cancel_action' }]
                        ]
                    }
                });
                break;

            case 'remind_help':
                bot.sendMessage(chatId, 
                    '🔔 **리마인더 도움말**\n\n' +
                    '**분 단위 설정:**\n• /remind 30 독서하기\n• /remind 5 물 마시기\n\n' +
                    '**시간 지정:**\n• /remind 14:30 점심약속\n• /remind 09:00 출근\n\n' +
                    '설정된 시간이 되면 알림을 보내드립니다!', 
                    {
                        parse_mode: 'Markdown',
                        reply_markup: { inline_keyboard: [[{ text: '🔙 리마인더 메뉴', callback_data: 'reminder_menu' }]] }
                    }
                );
                break;

            // ===== 유틸리티 관련 =====
            case 'utils_menu':
                const utilsKeyboard = {
                    inline_keyboard: [
                        [
                            { text: '🔊 TTS 음성변환', callback_data: 'utils_tts' },
                            { text: '🌍 언어 선택', callback_data: 'utils_language' }
                        ],
                        [
                            { text: '❓ TTS 도움말', callback_data: 'utils_tts_help' },
                            { text: '📋 사용 예시', callback_data: 'utils_examples' }
                        ],
                        [
                            { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
                        ]
                    ]
                };
                
                bot.editMessageText(`🛠️ ${getUserName(callbackQuery.from)}님의 유틸리티 메뉴\n\n원하는 기능을 선택해주세요:`, {
                    chat_id: chatId,
                    message_id: message.message_id,
                    reply_markup: utilsKeyboard
                });
                break;

            case 'utils_tts':
                userStates.set(userId, { action: 'tts_input', language: 'ko' });
                bot.sendMessage(chatId, `🔊 **${getUserName(callbackQuery.from)}님의 TTS 음성 변환**\n\n변환할 텍스트를 입력해주세요.\n\n예시:\n• 안녕하세요\n• 오늘 날씨가 좋네요\n• 두목봇 최고!`, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '❌ 취소', callback_data: 'cancel_action' }]
                        ]
                    }
                });
                break;

            case 'utils_language':
                const languageKeyboard = {
                    inline_keyboard: [
                        [
                            { text: '🇰🇷 한국어 (ko)', callback_data: 'utils_lang_ko' },
                            { text: '🇺🇸 English (en)', callback_data: 'utils_lang_en' }
                        ],
                        [
                            { text: '🇯🇵 日本語 (ja)', callback_data: 'utils_lang_ja' },
                            { text: '🇨🇳 中文 (zh)', callback_data: 'utils_lang_zh' }
                        ],
                        [
                            { text: '🇪🇸 Español (es)', callback_data: 'utils_lang_es' },
                            { text: '🇫🇷 Français (fr)', callback_data: 'utils_lang_fr' }
                        ],
                        [
                            { text: '🇩🇪 Deutsch (de)', callback_data: 'utils_lang_de' },
                            { text: '🇷🇺 Русский (ru)', callback_data: 'utils_lang_ru' }
                        ],
                        [
                            { text: '🔙 유틸 메뉴', callback_data: 'utils_menu' }
                        ]
                    ]
                };
                
                bot.sendMessage(chatId, '🌍 **언어 선택**\n\n사용할 언어를 선택해주세요:', {
                    parse_mode: 'Markdown',
                    reply_markup: languageKeyboard
                });
                break;

            case 'utils_tts_help':
                bot.sendMessage(chatId, 
                    `🔊 **TTS 도움말**\n\n` +
                    `**사용법:**\n• /tts [텍스트] - 한국어 음성\n• /tts [언어] [텍스트] - 특정 언어\n\n` +
                    `**지원 언어:** ko, en, ja, zh, es, fr, de, ru\n\n` +
                    `**예시:**\n• /tts 안녕하세요\n• /tts en Hello\n• /tts ja こんにちは\n\n` +
                    `**제한:** 최대 200자`, 
                    {
                        parse_mode: 'Markdown',
                        reply_markup: { inline_keyboard: [[{ text: '🔙 유틸 메뉴', callback_data: 'utils_menu' }]] }
                    }
                );
                break;

            case 'utils_examples':
                bot.sendMessage(chatId, 
                    `📋 **TTS 예시**\n\n` +
                    `🇰🇷 /tts 안녕하세요\n🇺🇸 /tts en Hello\n🇯🇵 /tts ja こんにちは\n🇨🇳 /tts zh 你好\n\n` +
                    `💡 언어코드 생략 시 한국어로 생성됩니다!`, 
                    {
                        parse_mode: 'Markdown',
                        reply_markup: { inline_keyboard: [[{ text: '🔙 유틸 메뉴', callback_data: 'utils_menu' }]] }
                    }
                );
                break;

                // ===== 날씨 관련 ===== (새로 추가)
            case 'weather_menu':
                const weatherMenuKeyboard = {
                    inline_keyboard: [
                        [
                            { text: '🌤️ 현재 날씨', callback_data: 'weather_current' },
                            { text: '⏰ 시간별 예보', callback_data: 'weather_forecast' }
                        ],
                        [
                            { text: '🏙️ 서울', callback_data: 'weather_seoul' },
                            { text: '🌊 부산', callback_data: 'weather_busan' },
                            { text: '🏔️ 대구', callback_data: 'weather_daegu' }
                        ],
                        [
                            { text: '🌆 인천', callback_data: 'weather_incheon' },
                            { text: '🌄 광주', callback_data: 'weather_gwangju' },
                            { text: '🏛️ 대전', callback_data: 'weather_daejeon' }
                        ],
                        [
                            { text: '🏭 울산', callback_data: 'weather_ulsan' },
                            { text: '🏛️ 세종', callback_data: 'weather_sejong' },
                            { text: '🏝️ 제주', callback_data: 'weather_jeju' }
                        ],
                        [
                            { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
                        ]
                    ]
                };

                bot.editMessageText('🌤️ 날씨 정보 메뉴\n\n원하는 지역의 날씨를 확인해보세요:', {
                    chat_id: chatId,
                    message_id: message.message_id,
                    reply_markup: weatherMenuKeyboard
                });
                break;

            case 'weather_current':
                weather(bot, { chat: { id: chatId }, text: '/weather' });
                break;

            case 'weather_forecast':
                weather(bot, { chat: { id: chatId }, text: '/weather 예보' });
                break;

            // 도시별 날씨
            case 'weather_seoul':
                weather(bot, { chat: { id: chatId }, text: '/weather 서울' });
                break;

            case 'weather_busan':
                weather(bot, { chat: { id: chatId }, text: '/weather 부산' });
                break;

            case 'weather_daegu':
                weather(bot, { chat: { id: chatId }, text: '/weather 대구' });
                break;

            case 'weather_incheon':
                weather(bot, { chat: { id: chatId }, text: '/weather 인천' });
                break;

            case 'weather_gwangju':
                weather(bot, { chat: { id: chatId }, text: '/weather 광주' });
                break;

            case 'weather_daejeon':
                weather(bot, { chat: { id: chatId }, text: '/weather 대전' });
                break;

            case 'weather_ulsan':
                weather(bot, { chat: { id: chatId }, text: '/weather 울산' });
                break;

            case 'weather_sejong':
                weather(bot, { chat: { id: chatId }, text: '/weather 세종' });
                break;

            case 'weather_jeju':
                weather(bot, { chat: { id: chatId }, text: '/weather 제주' });
                break;

            // ===== 도움말 ===== (업데이트됨)
            case 'help_menu':
                bot.sendMessage(chatId, 
                    '❓ **두목봇 도움말**\n\n' +
                    '**📱 주요 기능:**\n' +
                    '• 📝 할일 관리 - 할일 추가/완료/삭제\n' +
                    '• 📅 휴가 관리 - 연차 현황/사용/설정\n' +
                    '• ⏰ 타이머 - 작업 시간 측정\n' +
                    '• 🔔 리마인더 - 알림 설정\n' +
                    '• 🎯 운세 - 다양한 운세 확인\n' +
                    '• 🕐 근무시간 - 출퇴근 시간 확인\n' +
                    '• 🌤️ 날씨 정보 - 실시간 날씨 & 예보\n\n' +
                    '**⌨️ 빠른 명령어:**\n' +
                    '• /start - 메인 메뉴\n' +
                    '• /add [내용] - 할일 추가\n' +
                    '• /timer start [작업명] - 타이머 시작\n' +
                    '• /remind [분] [내용] - 리마인더 설정\n' +
                    '• /fortune - 오늘의 운세\n' +
                    '• /worktime - 근무시간 확인\n' +
                    '• /weather [도시] - 날씨 확인\n\n' +
                    '**🌤️ 날씨 기능:**\n' +
                    '• 전국 주요 도시 날씨 정보\n' +
                    '• 실시간 기온, 습도, 바람\n' +
                    '• 옷차림 추천 & 대기질 정보\n' +
                    '• 24시간 날씨 예보\n\n' +
                    '문의사항이 있으시면 /start 를 입력해서 메뉴를 이용해주세요! 😊',
                    { 
                        parse_mode: 'Markdown',
                        reply_markup: { inline_keyboard: [[{ text: '🔙 메인 메뉴', callback_data: 'main_menu' }]] }
                    }
                );
                break;

            // ===== 취소 액션 =====
            case 'cancel_action':
                const currentState = userStates.get(userId);
                userStates.delete(userId);
                
                let cancelMessage = `❌ ${getUserName(callbackQuery.from)}님, 작업이 취소되었습니다.`;
                let backButton = 'main_menu';
                
                if (currentState) {
                    switch (currentState.action) {
                        case 'adding_todo':
                            cancelMessage = `❌ ${getUserName(callbackQuery.from)}님, 할일 추가가 취소되었습니다.`;
                            backButton = 'todo_menu';
                            break;
                        case 'using_leave':
                        case 'setting_total_leave':
                            cancelMessage = `❌ ${getUserName(callbackQuery.from)}님, 연차 설정이 취소되었습니다.`;
                            backButton = 'leave_menu';
                            break;
                        case 'timer_start':
                            cancelMessage = `❌ ${getUserName(callbackQuery.from)}님, 타이머 시작이 취소되었습니다.`;
                            backButton = 'timer_menu';
                            break;
                        case 'tts_input':
                            cancelMessage = `❌ ${getUserName(callbackQuery.from)}님, TTS 변환이 취소되었습니다.`;
                            backButton = 'utils_menu';
                            break;
                        case 'remind_minutes':
                        case 'remind_time':
                            cancelMessage = `❌ ${getUserName(callbackQuery.from)}님, 리마인더 설정이 취소되었습니다.`;
                            backButton = 'reminder_menu';
                            break;
                    }
                }
                
                bot.sendMessage(chatId, cancelMessage, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔙 돌아가기', callback_data: backButton }]
                        ]
                    }
                });
                break;

            // ===== 기본 케이스 (할일 토글/삭제 등) =====
            default:
                // 할일 토글/삭제 처리
                if (data.startsWith('todo_toggle_')) {
                    const todoIndex = parseInt(data.replace('todo_toggle_', ''));
                    try {
                        const newStatus = await todoFunctions.toggleTodo(userId, todoIndex);
                        if (newStatus !== null) {
                            const statusText = newStatus ? '완료' : '미완료';
                            bot.sendMessage(chatId, `✅ 할일 ${todoIndex + 1}번이 ${statusText}로 변경되었습니다!`, {
                                reply_markup: { 
                                    inline_keyboard: [
                                        [{ text: '📋 할일 목록 보기', callback_data: 'todo_list' }],
                                        [{ text: '🔙 할일 메뉴', callback_data: 'todo_menu' }]
                                    ]
                                }
                            });
                        } else {
                            bot.sendMessage(chatId, '❌ 할일 상태 변경 중 오류가 발생했습니다.');
                        }
                    } catch (error) {
                        console.error('할일 토글 오류:', error);
                        bot.sendMessage(chatId, '❌ 할일 상태 변경 중 오류가 발생했습니다.');
                    }
                } else if (data.startsWith('todo_delete_')) {
                    const todoIndex = parseInt(data.replace('todo_delete_', ''));
                    try {
                        const success = await todoFunctions.deleteTodo(userId, todoIndex);
                        if (success) {
                            bot.sendMessage(chatId, `🗑️ 할일 ${todoIndex + 1}번이 삭제되었습니다!`, {
                                reply_markup: { 
                                    inline_keyboard: [
                                        [{ text: '📋 할일 목록 보기', callback_data: 'todo_list' }],
                                        [{ text: '🔙 할일 메뉴', callback_data: 'todo_menu' }]
                                    ]
                                }
                            });
                        } else {
                            bot.sendMessage(chatId, '❌ 할일 삭제 중 오류가 발생했습니다.');
                        }
                    } catch (error) {
                        console.error('할일 삭제 오류:', error);
                        bot.sendMessage(chatId, '❌ 할일 삭제 중 오류가 발생했습니다.');
                    }
                } else if (data.startsWith('utils_lang_')) {
                    const language = data.replace('utils_lang_', '');
                    userStates.set(userId, { action: 'tts_input', language: language });
                    
                    const langNames = {
                        'ko': '한국어',
                        'en': 'English',
                        'ja': '日本語',
                        'zh': '中文',
                        'es': 'Español',
                        'fr': 'Français',
                        'de': 'Deutsch',
                        'ru': 'Русский'
                    };
                    
                    bot.sendMessage(chatId, `🔊 **TTS 음성 변환 (${langNames[language]})**\n\n변환할 텍스트를 입력해주세요.`, {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '❌ 취소', callback_data: 'cancel_action' }]
                            ]
                        }
                    });
                    } else if (data.startsWith('weather_refresh_')) {
                        const city = data.replace('weather_refresh_', '');
                        weather(bot, { chat: { id: chatId }, text: `/weather ${city}` });
                    } else if (data.startsWith('weather_forecast_')) {
                        const city = data.replace('weather_forecast_', '');
                        weather(bot, { chat: { id: chatId }, text: `/weather ${city} 예보` });
                    // 화성/동탄 맞춤 도시 선택 메뉴

} else if (data === 'weather_cities') {
    const cityListKeyboard = {
        inline_keyboard: [
            [
                { text: '🏡 화성/동탄', callback_data: 'weather_hwaseong' }, // 🌟 가장 먼저!
                { text: '🏙️ 서울', callback_data: 'weather_seoul' }
            ],
            [
                { text: '🌆 인천', callback_data: 'weather_incheon' },
                { text: '🏞️ 수원/경기', callback_data: 'weather_gyeonggi' }
            ],
            [
                { text: '🌊 부산', callback_data: 'weather_busan' },
                { text: '🏔️ 대구', callback_data: 'weather_daegu' }
            ],
            [
                { text: '🌄 광주', callback_data: 'weather_gwangju' },
                { text: '🏛️ 대전', callback_data: 'weather_daejeon' }
            ],
            [
                { text: '🏝️ 제주', callback_data: 'weather_jeju' },
                { text: '📍 더 많은 지역...', callback_data: 'weather_more_cities' }
            ],
            [
                { text: '🔙 날씨 메뉴', callback_data: 'weather_menu' }
            ]
        ]
    };

    bot.sendMessage(chatId, '🏙️ **지역 선택**\n\n🏡 화성/동탄 지역이 맨 위에 있어요! ⚡', {
        parse_mode: 'Markdown',
        reply_markup: cityListKeyboard
    });

// 화성 날씨 처리 (경기도 좌표 사용)
} else if (data === 'weather_hwaseong') {
    weather(bot, { chat: { id: chatId }, text: '/weather 경기' });

// 더보기 메뉴
} else if (data === 'weather_more_cities') {
    const moreCitiesKeyboard = {
        inline_keyboard: [
            [
                { text: '🏛️ 세종', callback_data: 'weather_sejong' },
                { text: '🏭 울산', callback_data: 'weather_ulsan' }
            ],
            [
                { text: '⛰️ 강원', callback_data: 'weather_gangwon' },
                { text: '🌾 충북', callback_data: 'weather_chungbuk' }
            ],
            [
                { text: '🌻 충남', callback_data: 'weather_chungnam' },
                { text: '🌿 전북', callback_data: 'weather_jeonbuk' }
            ],
            [
                { text: '🌺 전남', callback_data: 'weather_jeonnam' },
                { text: '🏯 경북', callback_data: 'weather_gyeongbuk' }
            ],
            [
                { text: '🏮 경남', callback_data: 'weather_gyeongnam' }
            ],
            [
                { text: '⬅️ 주요 지역', callback_data: 'weather_cities' },
                { text: '🔙 날씨 메뉴', callback_data: 'weather_menu' }
            ]
        ]
    };

    bot.sendMessage(chatId, '🗺️ **전체 지역**\n\n원하는 지역을 선택해주세요:', {
        parse_mode: 'Markdown',
        reply_markup: moreCitiesKeyboard
    });

// 기타 도시들
} else if (data === 'weather_gyeonggi') {
    weather(bot, { chat: { id: chatId }, text: '/weather 경기' });
} else if (data === 'weather_gangwon') {
    weather(bot, { chat: { id: chatId }, text: '/weather 강원' });
} else if (data === 'weather_chungbuk') {
    weather(bot, { chat: { id: chatId }, text: '/weather 충북' });
} else if (data === 'weather_chungnam') {
    weather(bot, { chat: { id: chatId }, text: '/weather 충남' });
} else if (data === 'weather_jeonbuk') {
    weather(bot, { chat: { id: chatId }, text: '/weather 전북' });
} else if (data === 'weather_jeonnam') {
    weather(bot, { chat: { id: chatId }, text: '/weather 전남' });
} else if (data === 'weather_gyeongbuk') {
    weather(bot, { chat: { id: chatId }, text: '/weather 경북' });
} else if (data === 'weather_gyeongnam') {
    weather(bot, { chat: { id: chatId }, text: '/weather 경남' });
                    } else {
                    // 정말 알 수 없는 콜백
                    console.log('❓ 알 수 없는 콜백 데이터:', data);
                    bot.sendMessage(chatId, `❌ 알 수 없는 명령입니다. /start 를 입력해서 메뉴를 다시 확인해주세요.`);
                }
                break;
        }
    } catch (error) {
        console.error('콜백 처리 오류:', error);
        bot.sendMessage(chatId, '❌ 처리 중 오류가 발생했습니다.');
    }
});

// 추가 팁: 함수명 확인을 위한 디버깅
console.log('Bot 객체의 answerCallbackQuery 함수 존재 여부:', typeof bot.answerCallbackQuery === 'function');
console.log('Bot 객체의 answercallbackQuery 함수 존재 여부:', typeof bot.answercallbackQuery === 'function');

// 프로세스 종료 시 정리
process.on('SIGINT', async () => {
    console.log('봇 종료 중...');
    
    // TTS 파일 정리
    if (typeof utils.cleanupAllTTSFiles === 'function') {
        utils.cleanupAllTTSFiles();
    }
    
    // 연차 관리 종료
    await leaveManager.close();
    
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('봇 종료 중...');
    
    // TTS 파일 정리  
    if (typeof utils.cleanupAllTTSFiles === 'function') {
        utils.cleanupAllTTSFiles();
    }
    
    // 연차 관리 종료
    await leaveManager.close();
    
    process.exit(0);
});
