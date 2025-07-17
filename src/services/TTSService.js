// src/services/TTSService.js - 수정된 버전

const gtts = require('gtts');
const fs = require('fs');
const path = require('path');
const { TTSService } = require('../services/TTSService')

class TTSService {
    constructor() {
        this.supportedLanguages = {
            'ko': '한국어',
            'en': 'English', 
            'ja': '日本語',
            'zh': '中文',
            'es': 'Español',
            'fr': 'Français'
        };
        
        this.defaultLanguage = 'ko';
        this.tempDir = './temp';
        this.userModes = new Map(); // userId -> mode
        
        // temp 디렉토리 생성
        this.ensureTempDir();
    }

    // temp 디렉토리 확인/생성
    ensureTempDir() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    // TTS 모드 조회
    getTTSMode(userId) {
        return this.userModes.get(userId) || 'OFF';
    }

    // TTS 모드 설정
    setTTSMode(userId, mode) {
        this.userModes.set(userId, mode);
    }

    // TTS 도움말 텍스트
    getTTSHelpText(userId) {
        const mode = this.getTTSMode(userId);
        return `🔊 **TTS 설정**\n\n` +
               `현재 모드: ${mode}\n\n` +
               `**자동 모드**: 채팅 메시지를 자동으로 음성 변환\n` +
               `**수동 모드**: /tts 명령어로만 음성 변환\n` +
               `**OFF**: TTS 기능 비활성화\n\n` +
               `원하는 모드를 선택하세요:`;
    }

    // TTS 메뉴 키보드 생성
    createTTSMenuKeyboard(userId) {
        const mode = this.getTTSMode(userId);
        
        return {
            inline_keyboard: [
                [
                    { 
                        text: mode === 'AUTO' ? '✅ 자동 모드' : '🔊 자동 모드', 
                        callback_data: 'tts_mode_auto' 
                    },
                    { 
                        text: mode === 'MANUAL' ? '✅ 수동 모드' : '📝 수동 모드', 
                        callback_data: 'tts_mode_manual' 
                    }
                ],
                [
                    { 
                        text: mode === 'OFF' ? '✅ OFF' : '❌ OFF', 
                        callback_data: 'tts_mode_off' 
                    },
                    { 
                        text: '❓ 도움말', 
                        callback_data: 'utils_tts_help' 
                    }
                ],
                [
                    { text: '🔙 유틸리티 메뉴', callback_data: 'utils_menu' }
                ]
            ]
        };
    }

    // TTS 명령어 처리
    async handleTTSCommand(bot, chatId, userId, text) {
        try {
            // /tts 제거하고 텍스트 추출
            const ttsText = text.replace('/tts', '').trim();
            
            if (!ttsText) {
                await bot.sendMessage(chatId, 
                    '❌ 변환할 텍스트를 입력해주세요.\n예: /tts 안녕하세요'
                );
                return;
            }

            // 언어 감지 및 TTS 변환
            const language = this.detectLanguage(ttsText);
            const result = await this.convertTextToSpeech(ttsText, language);
            
            if (result.success) {
                // 음성 파일 전송
                await bot.sendVoice(chatId, result.filePath, {
                    caption: `🔊 TTS: "${ttsText}" (${this.supportedLanguages[language]})`
                });
                
                // 임시 파일 삭제
                setTimeout(() => {
                    this.cleanupFile(result.filePath);
                }, 5000);
            } else {
                await bot.sendMessage(chatId, `❌ TTS 변환 실패: ${result.message}`);
            }
            
        } catch (error) {
            console.error('TTS 명령어 처리 오류:', error);
            await bot.sendMessage(chatId, '❌ TTS 처리 중 오류가 발생했습니다.');
        }
    }

    // TTS 콜백 처리
    async handleTTSCallback(bot, callbackQuery, params) {
        const { message: { chat: { id: chatId }, message_id: messageId }, from: { id: userId } } = callbackQuery;
        
        try {
            const action = params[0];
            
            switch (action) {
                case 'mode':
                    const mode = params[1];
                    await this.setTTSModeCallback(bot, chatId, messageId, userId, mode);
                    break;
                    
                case 'lang':
                    const language = params[1];
                    await this.setTTSLanguageCallback(bot, chatId, messageId, userId, language);
                    break;
                    
                default:
                    await bot.answerCallbackQuery(callbackQuery.id, { 
                        text: '❌ 알 수 없는 TTS 명령입니다.' 
                    });
            }
            
        } catch (error) {
            console.error('TTS 콜백 처리 오류:', error);
            await bot.answerCallbackQuery(callbackQuery.id, { 
                text: '❌ TTS 처리 중 오류가 발생했습니다.' 
            });
        }
    }

    // TTS 모드 변경 콜백
    async setTTSModeCallback(bot, chatId, messageId, userId, mode) {
        const modeMap = {
            'auto': 'AUTO',
            'manual': 'MANUAL',
            'off': 'OFF'
        };
        
        const newMode = modeMap[mode];
        if (!newMode) return;
        
        this.setTTSMode(userId, newMode);
        
        const modeText = {
            'AUTO': '자동 모드',
            'MANUAL': '수동 모드',
            'OFF': 'OFF'
        };
        
        const helpText = this.getTTSHelpText(userId);
        const keyboard = this.createTTSMenuKeyboard(userId);
        
        await bot.editMessageText(helpText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
        
        // 알림 메시지
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: `🔊 TTS 모드가 ${modeText[newMode]}로 변경되었습니다.`
        });
    }

    // 자동 TTS 처리
    async handleAutoTTS(bot, msg) {
        const { chat: { id: chatId }, from: { id: userId }, text } = msg;
        
        // 자동 모드가 아니면 처리하지 않음
        if (this.getTTSMode(userId) !== 'AUTO') {
            return false;
        }
        
        // 명령어는 처리하지 않음
        if (text.startsWith('/')) {
            return false;
        }
        
        // 텍스트 길이 체크
        if (text.length > 100) {
            return false;
        }
        
        try {
            const language = this.detectLanguage(text);
            const result = await this.convertTextToSpeech(text, language);
            
            if (result.success) {
                await bot.sendVoice(chatId, result.filePath, {
                    caption: `🔊 자동 TTS (${this.supportedLanguages[language]})`
                });
                
                // 임시 파일 삭제
                setTimeout(() => {
                    this.cleanupFile(result.filePath);
                }, 5000);
                
                return true;
            }
            
        } catch (error) {
            console.error('자동 TTS 처리 오류:', error);
        }
        
        return false;
    }

    // 텍스트를 음성으로 변환
    async convertTextToSpeech(text, language = 'ko') {
        return new Promise((resolve, reject) => {
            try {
                // 텍스트 길이 제한
                if (text.length > 200) {
                    text = text.substring(0, 200) + '...';
                }

                // 언어 검증
                if (!this.supportedLanguages[language]) {
                    language = this.defaultLanguage;
                }

                // GTTS 인스턴스 생성
                const tts = new gtts(text, language);
                
                // 파일명 생성
                const timestamp = Date.now();
                const fileName = `tts_${timestamp}.mp3`;
                const filePath = path.join(this.tempDir, fileName);

                // 음성 파일 생성
                tts.save(filePath, (error) => {
                    if (error) {
                        resolve({
                            success: false,
                            message: `TTS 변환 실패: ${error.message}`
                        });
                    } else {
                        resolve({
                            success: true,
                            filePath: filePath,
                            fileName: fileName,
                            language: language,
                            text: text,
                            size: this.getFileSize(filePath)
                        });
                    }
                });

            } catch (error) {
                resolve({
                    success: false,
                    message: `TTS 처리 중 오류: ${error.message}`
                });
            }
        });
    }

    // 파일 크기 확인
    getFileSize(filePath) {
        try {
            const stats = fs.statSync(filePath);
            return stats.size;
        } catch (error) {
            return 0;
        }
    }

    // 파일 정리
    async cleanupFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                return true;
            }
        } catch (error) {
            console.error('파일 삭제 실패:', error);
        }
        return false;
    }

    // 언어 감지
    detectLanguage(text) {
        // 한글 포함 체크
        if (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text)) {
            return 'ko';
        }
        
        // 일본어 체크
        if (/[ひらがな|カタカナ]/.test(text)) {
            return 'ja';
        }
        
        // 중국어 체크
        if (/[\u4e00-\u9fff]/.test(text)) {
            return 'zh';
        }
        
        // 기본값: 영어
        return 'en';
    }

    // 지원 언어 목록
    getSupportedLanguages() {
        return this.supportedLanguages;
    }

    // 서비스 상태
    getServiceStatus() {
        return {
            status: 'active',
            supportedLanguages: Object.keys(this.supportedLanguages).length,
            tempDir: this.tempDir,
            tempDirExists: fs.existsSync(this.tempDir),
            activeUsers: this.userModes.size
        };
    }

    // 정리
    cleanup() {
        this.userModes.clear();
    }
}

module.exports = { TTSService };