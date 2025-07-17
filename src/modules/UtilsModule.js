const BaseModule = require('./BaseModule')
const { TTSHelper } = require('../utils/TTSHelper');
const { getUserName } = require('../utils/UserHelper');
const { ValidationHelper } = require('../utils/ValidationHelper');

class UtilsModule extends BaseModule {
    constructor() {
        super('UtilsModule');
        this.ttsService = new TTSHelper();
        this.userStates = new Map();
    }

    async handleMessage(bot, msg) {
        const { chat: { id: chatId }, from: { id: userId }, text } = msg;

        // TTS 명령어 처리
        if (text && text.startsWith('/tts')) {
            await this.handleTTSCommand(bot, chatId, userId, text);
            return true;
        }

        // 자동 TTS 처리
        if (await this.handleAutoTTS(bot, msg)) {
            return true;
        }

        return false;
    }

    async processCallback(bot, callbackQuery, subAction, params, menuManager) {
        const { message: { chat: { id: chatId }, message_id: messageId }, from: { id: userId } } = callbackQuery;
        const userName = getUserName(callbackQuery.from);

        switch (subAction) {
            case 'menu':
                await this.showUtilsMenu(bot, chatId, messageId, userId, userName, menuManager);
                break;
            case 'tts':
                if (params[0] === 'menu') {
                    await this.showTTSMenu(bot, chatId, messageId, userId);
                } else if (params[0] === 'help') {
                    await this.showTTSHelp(bot, chatId, messageId);
                } else {
                    await this.handleTTSCallback(bot, callbackQuery, params);
                }
                break;
            case 'help':
                await this.showUtilsHelp(bot, chatId, messageId);
                break;
            default:
                await this.sendMessage(bot, chatId, '❌ 알 수 없는 유틸리티 명령입니다.');
        }
    }

    async showUtilsMenu(bot, chatId, messageId, userId, userName, menuManager) {
        const ttsMode = this.ttsService.getTTSMode(userId);
        const menuText = menuManager.getMenuText('utils', userName, ttsMode);
        const keyboard = menuManager.createKeyboard('utils');
        
        await this.editMessage(bot, chatId, messageId, menuText, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    async showTTSMenu(bot, chatId, messageId, userId) {
        const mode = this.ttsService.getTTSMode(userId);
        const helpText = this.ttsService.getTTSHelpText(userId);
        const keyboard = this.ttsService.createTTSMenuKeyboard(userId);
        
        await this.editMessage(bot, chatId, messageId, helpText, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    async showTTSHelp(bot, chatId, messageId) {
        const helpText = `🔊 **TTS (음성 변환) 도움말**\n\n` +
                        `**🎯 두 가지 사용 방법**\n\n` +
                        `**1️⃣ 자동 모드 (추천)**\n` +
                        `• 🛠️ 유틸리티 → 🔊 TTS 설정\n` +
                        `• TTS 모드를 ON으로 설정\n` +
                        `• 채팅창에 텍스트 입력\n` +
                        `• 자동으로 음성 변환! 🎵\n\n` +
                        `**2️⃣ 수동 모드**\n` +
                        `• /tts [텍스트] 명령어 사용\n` +
                        `• 예: /tts 안녕하세요\n\n` +
                        `**🌍 지원 언어**\n` +
                        `• 한국어, English, 日本語\n` +
                        `• 中文, Español, Français\n\n` +
                        `**💡 특징**\n` +
                        `• 최대 500자까지 지원\n` +
                        `• 이전 음성 파일 자동 삭제\n` +
                        `• 자연스러운 음성 합성\n` +
                        `• 실시간 언어 변경 가능\n\n` +
                        `지금 바로 TTS 설정을 해보세요! 🚀`;
        
        await this.editMessage(bot, chatId, messageId, helpText, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🔊 TTS 설정하기', callback_data: 'utils_tts_menu' },
                        { text: '🔙 유틸리티 메뉴', callback_data: 'utils_menu' }
                    ]
                ]
            }
        });
    }

    async showUtilsHelp(bot, chatId, messageId) {
        const helpText = `🛠️ **유틸리티 도움말**\n\n` +
                        `**🔊 TTS (음성 변환)**\n` +
                        `• /tts [텍스트] - 텍스트를 음성으로 변환\n` +
                        `• /tts [언어] [텍스트] - 특정 언어로 음성 변환\n` +
                        `• 자동 모드: 유틸리티 메뉴에서 설정\n\n` +
                        `**⏰ 시간 유틸리티**\n` +
                        `• 한국 시간 기준 동작\n` +
                        `• 날짜/시간 포맷팅 지원\n\n` +
                        `**📊 데이터 유틸리티**\n` +
                        `• 숫자 포맷팅\n` +
                        `• 백분율 계산\n` +
                        `• 텍스트 처리\n\n` +
                        `**🌍 지원 언어**\n` +
                        `• 한국어 (ko) • English (en)\n` +
                        `• 日本語 (ja) • 中文 (zh)\n` +
                        `• Español (es) • Français (fr)\n\n` +
                        `모든 기능은 24시간 사용 가능합니다! 🚀`;

        await this.editMessage(bot, chatId, messageId, helpText, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 유틸리티 메뉴', callback_data: 'utils_menu' }]
                ]
            }
        });
    }

    async handleTTSCommand(bot, chatId, userId, text) {
        await this.ttsService.handleTTSCommand(bot, chatId, userId, text);
    }

    async handleTTSCallback(bot, callbackQuery, params) {
        await this.ttsService.handleTTSCallback(bot, callbackQuery, params);
    }

    async handleAutoTTS(bot, msg) {
        return await this.ttsService.handleAutoTTS(bot, msg);
    }
}

module.exports = UtilsModule;
