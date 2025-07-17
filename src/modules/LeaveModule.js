const BaseModule = require('./BaseModule')
const  LeaveModule  = require('../modules/LeaveModule');
const { getUserName } = require('../utils/UserHelper');
const { ValidationHelper } = require('../utils/ValidationHelper');

class LeaveModule extends BaseModule {
    constructor() {
        super('LeaveModule');
        this.leaveService = new LeaveService();
        this.userStates = new Map();
    }

    async handleMessage(bot, msg) {
        const { chat: { id: chatId }, from: { id: userId }, text } = msg;
        const userState = this.userStates.get(userId);

        if (userState) {
            if (userState.action === 'waiting_leave_input') {
                return await this.handleLeaveInput(bot, chatId, userId, text, userState);
            } else if (userState.action === 'waiting_leave_setting') {
                return await this.handleLeaveSetting(bot, chatId, userId, text, userState);
            }
        }

        if (text === '/leave') {
            await this.showLeaveStatus(bot, chatId, userId);
            return true;
        }

        return false;
    }

    async processCallback(bot, callbackQuery, subAction, params, menuManager) {
        const { message: { chat: { id: chatId }, message_id: messageId }, from: { id: userId } } = callbackQuery;
        const userName = getUserName(callbackQuery.from);

        switch (subAction) {
            case 'menu':
                await this.showLeaveMenu(bot, chatId, messageId, userId, userName, menuManager);
                break;
            case 'status':
                await this.showLeaveStatus(bot, chatId, messageId, userId);
                break;
            case 'use':
                if (params.length > 0) {
                    if (params[0] === 'custom') {
                        await this.startCustomLeaveInput(bot, chatId, messageId, userId);
                    } else {
                        const days = parseFloat(params[0]);
                        await this.processLeaveUsage(bot, chatId, messageId, userId, days);
                    }
                } else {
                    await this.showLeaveUseMenu(bot, chatId, messageId);
                }
                break;
            case 'history':
                await this.showLeaveHistory(bot, chatId, messageId, userId);
                break;
            case 'setting':
                await this.startLeaveSetting(bot, chatId, messageId, userId);
                break;
            default:
                await this.sendMessage(bot, chatId, '❌ 알 수 없는 휴가 관리 명령입니다.');
        }
    }

    async showLeaveMenu(bot, chatId, messageId, userId, userName, menuManager) {
        try {
            const leaveData = await this.leaveService.getUserLeaves(userId);
            const statusText = this.leaveService.formatLeaveStatus(leaveData);
            
            await this.editMessage(bot, chatId, messageId, statusText, {
                parse_mode: 'Markdown',
                reply_markup: menuManager.createKeyboard('leave')
            });
        } catch (error) {
            console.error('연차 메뉴 표시 오류:', error);
            await this.sendMessage(bot, chatId, '❌ 연차 정보를 불러오는 중 오류가 발생했습니다.');
        }
    }

    async showLeaveStatus(bot, chatId, messageId, userId) {
        try {
            const leaveData = await this.leaveService.getUserLeaves(userId);
            const statusText = this.leaveService.formatLeaveStatus(leaveData);
            
            if (messageId) {
                await this.editMessage(bot, chatId, messageId, statusText, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔙 휴가 메뉴', callback_data: 'leave_menu' }]
                        ]
                    }
                });
            } else {
                await this.sendMessage(bot, chatId, statusText, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '📊 연차 현황', callback_data: 'leave_status' },
                                { text: '📝 연차 사용', callback_data: 'leave_use' }
                            ],
                            [
                                { text: '📋 사용 내역', callback_data: 'leave_history' },
                                { text: '⚙️ 연차 설정', callback_data: 'leave_setting' }
                            ]
                        ]
                    }
                });
            }
        } catch (error) {
            console.error('연차 상태 조회 오류:', error);
            await this.sendMessage(bot, chatId, '❌ 연차 정보를 불러오는 중 오류가 발생했습니다.');
        }
    }

    async showLeaveUseMenu(bot, chatId, messageId) {
        const useLeaveKeyboard = {
            inline_keyboard: [
                [
                    { text: '🏖️ 연차 1일', callback_data: 'leave_use_1' },
                    { text: '🌅 반차 0.5일', callback_data: 'leave_use_0.5' }
                ],
                [
                    { text: '✏️ 직접 입력', callback_data: 'leave_use_custom' },
                    { text: '🔙 뒤로가기', callback_data: 'leave_menu' }
                ]
            ]
        };

        await this.editMessage(bot, chatId, messageId,
            '🏖️ **연차 사용하기**\n\n사용할 연차를 선택하세요:',
            {
                parse_mode: 'Markdown',
                reply_markup: useLeaveKeyboard
            }
        );
    }

    async startCustomLeaveInput(bot, chatId, messageId, userId) {
        this.userStates.set(userId, { 
            action: 'waiting_leave_input',
            messageId: messageId,
            chatId: chatId
        });
        
        await this.editMessage(bot, chatId, messageId,
            '📝 **직접 입력**\n\n사용할 연차 일수를 입력하세요.\n예: 1, 0.5, 2.5',
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

    async handleLeaveInput(bot, chatId, userId, text, userState) {
        try {
            const days = ValidationHelper.validateLeaveAmount(text);
            await this.processLeaveUsage(bot, chatId, userState.messageId, userId, days);
            this.userStates.delete(userId);
            return true;
        } catch (error) {
            await this.sendMessage(bot, chatId, `❌ ${error.message}`);
            return true;
        }
    }

    async processLeaveUsage(bot, chatId, messageId, userId, days) {
        try {
            const result = await this.leaveService.useLeave(userId, days);
            
            const successText = `✅ **연차 사용 완료**\n\n` +
                               `📅 사용한 연차: ${days}일\n` +
                               `✅ 총 사용: ${result.usedLeaves}일\n` +
                               `⏳ 남은 연차: ${result.remainingLeaves}일\n\n` +
                               `${result.remainingLeaves <= 3 ? '⚠️ 연차가 얼마 남지 않았습니다!' : '✨ 연차 사용이 기록되었습니다!'}`;
            
            await this.editMessage(bot, chatId, messageId, successText, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: '🔙 연차 메뉴', callback_data: 'leave_menu' }]]
                }
            });
        } catch (error) {
            await this.editMessage(bot, chatId, messageId, `❌ ${error.message}`, {
                reply_markup: {
                    inline_keyboard: [[{ text: '🔙 뒤로가기', callback_data: 'leave_use' }]]
                }
            });
        }
    }

    async showLeaveHistory(bot, chatId, messageId, userId) {
        try {
            const history = await this.leaveService.getLeaveHistory(userId);
            const historyText = this.leaveService.formatLeaveHistory(history);
            
            await this.editMessage(bot, chatId, messageId, historyText, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 휴가 메뉴', callback_data: 'leave_menu' }]
                    ]
                }
            });
        } catch (error) {
            console.error('휴가 내역 조회 오류:', error);
            await this.sendMessage(bot, chatId, '❌ 휴가 내역을 불러오는 중 오류가 발생했습니다.');
        }
    }

    async startLeaveSetting(bot, chatId, messageId, userId) {
        this.userStates.set(userId, { 
            action: 'waiting_leave_setting',
            messageId: messageId,
            chatId: chatId
        });
        
        await this.editMessage(bot, chatId, messageId,
            '⚙️ **연차 설정**\n\n총 연차 일수를 입력하세요.\n예: 15, 20, 25',
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

    async handleLeaveSetting(bot, chatId, userId, text, userState) {
        try {
            const totalLeaves = parseInt(text);
            
            if (isNaN(totalLeaves) || totalLeaves <= 0 || totalLeaves > 30) {
                throw new Error('1일 이상 30일 이하의 숫자를 입력해주세요.');
            }
            
            const result = await this.leaveService.setTotalLeaves(userId, totalLeaves);
            
            const settingText = `✅ **연차 설정 완료**\n\n` +
                               `📅 총 연차: ${result.totalLeaves}일\n` +
                               `⏳ 남은 연차: ${result.remainingLeaves}일\n\n` +
                               `연차 설정이 업데이트되었습니다!`;
            
            await this.editMessage(bot, chatId, userState.messageId, settingText, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: '🔙 연차 메뉴', callback_data: 'leave_menu' }]]
                }
            });
            
            this.userStates.delete(userId);
            return true;
        } catch (error) {
            await this.sendMessage(bot, chatId, `❌ ${error.message}`);
            return true;
        }
    }
}

module.exports =  LeaveModule ;