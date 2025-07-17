const BaseModule = require('./BaseModule')
const { WorktimeService } = require('../services/WorktimeService');
const { getUserName } = require('../utils/UserHelper');

class WorktimeModule extends BaseModule {
    constructor() {
        super('WorktimeModule');
        this.worktimeService = new WorktimeService();
    }

    async handleMessage(bot, msg) {
        const { chat: { id: chatId }, text } = msg;
        
        if (text && text.startsWith('/worktime')) {
            await this.handleWorktimeCommand(bot, msg);
            return true;
        }

        return false;
    }

    async handleCallback(bot, callbackQuery, subAction, params, menuManager) {
        const { message: { chat: { id: chatId }, message_id: messageId }, from } = callbackQuery;
        const userName = getUserName(from);

        switch (subAction) {
            case 'menu':
                await this.showWorktimeInfo(bot, chatId, messageId, from);
                break;
            default:
                await this.showWorktimeInfo(bot, chatId, messageId, from);
        }
    }

    async handleWorktimeCommand(bot, msg) {
        const { chat: { id: chatId }, text, from } = msg;

        if (text === '/worktime') {
            await this.showWorktimeInfo(bot, chatId, null, from);
        } else {
            await this.showWorktimeHelp(bot, chatId);
        }
    }

    async showWorktimeInfo(bot, chatId, messageId, from) {
        try {
            const userName = getUserName(from);
            const worktimeInfo = this.worktimeService.getWorktimeInfo();
            
            const infoText = `💼 **${userName}님의 근무시간 정보**\n\n` +
                            `${worktimeInfo.message}\n\n` +
                            `${worktimeInfo.schedule}`;
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '🔄 새로고침', callback_data: 'worktime_menu' },
                        { text: '📊 진행률', callback_data: 'worktime_progress' }
                    ],
                    [
                        { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
                    ]
                ]
            };

            if (messageId) {
                await this.editMessage(bot, chatId, messageId, infoText, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            } else {
                await this.sendMessage(bot, chatId, infoText, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            }
        } catch (error) {
            console.error('근무시간 정보 조회 오류:', error);
            await this.sendMessage(bot, chatId, '❌ 근무시간 정보를 불러오는 중 오류가 발생했습니다.');
        }
    }

    async showWorktimeHelp(bot, chatId) {
        const helpText = `💼 **근무시간 정보**\n\n` +
                        `⏰ 돈을 벌면 좋읍니다.\n` +
                        `• 출근: 08:30\n` +
                        `• 점심: 11:30 ~ 13:00\n` +
                        `• 퇴근: 17:30\n` +
                        `• 총 근무시간: 7시간 30분\n\n` +
                        `**📊 제공 정보:**\n` +
                        `• 실시간 근무 진행률\n` +
                        `• 현재 시간대별 상태\n` +
                        `• 퇴근까지 남은 시간\n` +
                        `• 컬러풀한 진행도 게이지\n\n` +
                        `/worktime - 현재 근무 상태 확인\n\n` +
                        `실시간 진행도 게이지와 함께 근무 상황을 확인하세요! 📊⏰`;

        await this.sendMessage(bot, chatId, helpText, { parse_mode: 'Markdown' });
    }
}

module.exports = WorktimeModule;