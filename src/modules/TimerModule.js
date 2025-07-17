const BaseModule = require('./BaseModule')
const { TimerService } = require('../services/TimerService');
const { getUserName } = require('../utils/UserHelper');
const { ValidationHelper } = require('../utils/ValidationHelper');

class TimerModule extends BaseModule {
    constructor() {
        super('TimerModule');
        this.timerService = new TimerService();
        this.userStates = new Map();
    }

    async handleMessage(bot, msg) {
        const { chat: { id: chatId }, from: { id: userId }, text } = msg;
        const userState = this.userStates.get(userId);

        if (userState && userState.action === 'waiting_timer_input') {
            return await this.handleTimerStart(bot, chatId, userId, text);
        }

        if (text && text.startsWith('/timer')) {
            await this.handleTimerCommand(bot, msg);
            return true;
        }

        return false;
    }

    async handleCallback(bot, callbackQuery, subAction, params, menuManager) {
        const { message: { chat: { id: chatId }, message_id: messageId }, from: { id: userId } } = callbackQuery;
        const userName = getUserName(callbackQuery.from);

        switch (subAction) {
            case 'menu':
                await this.showTimerMenu(bot, chatId, messageId, userName, menuManager);
                break;
            case 'start':
                if (params[0] === 'prompt') {
                    await this.startTimerPrompt(bot, chatId, messageId, userId);
                } else {
                    await this.startTimer(bot, chatId, messageId, userId, params.join('_'));
                }
                break;
            case 'stop':
                await this.stopTimer(bot, chatId, messageId, userId);
                break;
            case 'status':
                await this.showTimerStatus(bot, chatId, messageId, userId);
                break;
            default:
                await this.sendMessage(bot, chatId, '❌ 알 수 없는 타이머 명령입니다.');
        }
    }

    async handleTimerCommand(bot, msg) {
        const { chat: { id: chatId }, from: { id: userId }, text } = msg;

        if (text.startsWith('/timer start ')) {
            const taskName = text.substring(13).trim();
            if (!taskName) {
                await this.sendMessage(bot, chatId, '❌ 작업명을 입력해주세요. 예: /timer start 공부하기');
                return;
            }
            await this.startTimer(bot, chatId, null, userId, taskName);
        } else if (text === '/timer stop') {
            await this.stopTimer(bot, chatId, null, userId);
        } else if (text === '/timer status') {
            await this.showTimerStatus(bot, chatId, null, userId);
        } else if (text === '/timer') {
            await this.showTimerHelp(bot, chatId);
        }
    }

    async showTimerMenu(bot, chatId, messageId, userName, menuManager) {
        const menuText = menuManager.getMenuText('timer', userName);
        const keyboard = menuManager.createKeyboard('timer');
        
        await this.editMessage(bot, chatId, messageId, menuText, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    async startTimerPrompt(bot, chatId, messageId, userId) {
        this.userStates.set(userId, { action: 'waiting_timer_input' });
        
        await this.editMessage(bot, chatId, messageId,
            '⏰ **타이머 시작**\n\n작업명을 입력해주세요.\n예: 독서하기, 운동하기',
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '❌ 취소', callback_data: 'cancel_action' }]
                    ]
                }
            }
        );
    }

    async handleTimerStart(bot, chatId, userId, text) {
        try {
            const taskName = ValidationHelper.validateTimerName(text);
            await this.startTimer(bot, chatId, null, userId, taskName);
            this.userStates.delete(userId);
            return true;
        } catch (error) {
            await this.sendMessage(bot, chatId, `❌ ${error.message}`);
            return true;
        }
    }

    async startTimer(bot, chatId, messageId, userId, taskName) {
        const result = this.timerService.start(userId, taskName);
        
        if (result.success) {
            const text = `⏰ "${taskName}" 타이머를 시작했습니다!`;
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '⏹️ 타이머 정지', callback_data: 'timer_stop' },
                        { text: '⏱️ 현재 상태', callback_data: 'timer_status' }
                    ],
                    [
                        { text: '🔙 타이머 메뉴', callback_data: 'timer_menu' }
                    ]
                ]
            };

            if (messageId) {
                await this.editMessage(bot, chatId, messageId, text, { reply_markup: keyboard });
            } else {
                await this.sendMessage(bot, chatId, text, { reply_markup: keyboard });
            }
        } else {
            const text = `❌ ${result.error}`;
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '⏹️ 현재 타이머 정지', callback_data: 'timer_stop' },
                        { text: '⏱️ 현재 상태', callback_data: 'timer_status' }
                    ],
                    [
                        { text: '🔙 타이머 메뉴', callback_data: 'timer_menu' }
                    ]
                ]
            };

            if (messageId) {
                await this.editMessage(bot, chatId, messageId, text, { reply_markup: keyboard });
            } else {
                await this.sendMessage(bot, chatId, text, { reply_markup: keyboard });
            }
        }
    }

    async stopTimer(bot, chatId, messageId, userId) {
        const result = this.timerService.stop(userId);
        
        let text, keyboard;
        if (result.success) {
            text = `⏹️ "${result.data.taskName}" 완료!\n소요시간: ${result.data.duration}분`;
            keyboard = {
                inline_keyboard: [
                    [
                        { text: '▶️ 새 타이머 시작', callback_data: 'timer_start_prompt' },
                        { text: '🔙 타이머 메뉴', callback_data: 'timer_menu' }
                    ]
                ]
            };
        } else {
            text = `❌ ${result.error}`;
            keyboard = {
                inline_keyboard: [
                    [
                        { text: '▶️ 타이머 시작', callback_data: 'timer_start_prompt' },
                        { text: '🔙 타이머 메뉴', callback_data: 'timer_menu' }
                    ]
                ]
            };
        }

        if (messageId) {
            await this.editMessage(bot, chatId, messageId, text, { reply_markup: keyboard });
        } else {
            await this.sendMessage(bot, chatId, text, { reply_markup: keyboard });
        }
    }

    async showTimerStatus(bot, chatId, messageId, userId) {
        const status = this.timerService.status(userId);
        
        let text, keyboard;
        if (status.success) {
            text = `⏱️ "${status.data.taskName}" 진행 중...\n경과시간: ${status.data.running}분`;
            keyboard = {
                inline_keyboard: [
                    [
                        { text: '⏹️ 타이머 정지', callback_data: 'timer_stop' },
                        { text: '🔄 새로고침', callback_data: 'timer_status' }
                    ],
                    [
                        { text: '🔙 타이머 메뉴', callback_data: 'timer_menu' }
                    ]
                ]
            };
        } else {
            text = `❌ ${status.error}`;
            keyboard = {
                inline_keyboard: [
                    [
                        { text: '▶️ 타이머 시작', callback_data: 'timer_start_prompt' },
                        { text: '🔙 타이머 메뉴', callback_data: 'timer_menu' }
                    ]
                ]
            };
        }

        if (messageId) {
            await this.editMessage(bot, chatId, messageId, text, { reply_markup: keyboard });
        } else {
            await this.sendMessage(bot, chatId, text, { reply_markup: keyboard });
        }
    }

    async showTimerHelp(bot, chatId) {
        const helpText = `⏰ **타이머 사용법**\n\n` +
                        `**메뉴 방식:**\n` +
                        `/start → ⏰ 타이머 → 원하는 기능 선택\n\n` +
                        `**명령어 방식:**\n` +
                        `/timer start [작업명] - 타이머 시작\n` +
                        `/timer stop - 타이머 종료\n` +
                        `/timer status - 현재 상태 확인\n\n` +
                        `**예시:**\n` +
                        `• /timer start 독서하기\n` +
                        `• /timer start 운동\n` +
                        `• /timer start 회의 준비\n\n` +
                        `⏱️ 작업 시간을 효율적으로 관리하세요!`;

        await this.sendMessage(bot, chatId, helpText, { parse_mode: 'Markdown' });
    }
}

module.exports = TimerModule;