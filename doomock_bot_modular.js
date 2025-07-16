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
const MonthlyLeave = require('./monthly_leave');

// 연차 관리 인스턴스 생성
const leaveManager = new MonthlyLeave();

// 사용자 상태 관리 (메모리 기반)
const userStates = new Map();


//setCommands 세팅
bot.setMyCommands([
    { command: 'start', description: '📱 메인 메뉴 보기' },
    { command: 'help', description: '❓ 도움말 보기' },
    { command: 'fortune', description: '🔮 오늘의 운세' },
    { command: 'worktime', description: '🕐 근무시간 보기' },
    { command: 'add', description: '➕ 할일 추가하기 (/add 할일내용)' },
    { command: 'cancel', description: '❌ 진행중인 작업 취소' }
]).then(() => {
    console.log('✅ 명령어가 Telegram에 등록되었습니다.');
}).catch(console.error);

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

        // 할일 관리 상태 처리
        if (userState && userState.action === 'adding_todo') {
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
            }
            return;
        }

        // 일반 명령어 처리
        switch (true) {
        case text.startsWith('/start'):
                userStates.delete(userId); // 상태 초기화
                bot.sendMessage(chatId, '🤖 두목봇 메인 메뉴\n\n원하는 기능을 선택해주세요:', {
                    reply_markup: mainMenuKeyboard
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

// 콜백 쿼리 핸들러
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

            case 'help_menu':
                utils(bot, { chat: { id: chatId } });
                break;

            case 'worktime_menu':
                worktime(bot, { chat: { id: chatId } });
                break;

            case 'timer_menu':
                bot.sendMessage(chatId, '⏰ 타이머 기능\n\n타이머를 사용하려면:\n/timer 분\n\n예: /timer 25');
                break;

            case 'reminder_menu':
                bot.sendMessage(chatId, '🔔 리마인더 기능은 곧 추가될 예정입니다.');
                break;

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
                } else {
                    bot.sendMessage(chatId, '❌ 알 수 없는 명령입니다.');
                }
        }
    } catch (error) {
        console.error('콜백 처리 오류:', error);
        bot.sendMessage(chatId, '❌ 처리 중 오류가 발생했습니다.');
    }
});

// 프로세스 종료 시 정리
process.on('SIGINT', async () => {
    console.log('봇 종료 중...');
    await leaveManager.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('봇 종료 중...');
    await leaveManager.close();
    process.exit(0);
});
