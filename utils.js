// utils.js - 통합 유틸리티 모듈
const gtts = require('gtts');
const fs = require('fs');
const path = require('path');

// TTS 모드 관리 (사용자별)
const ttsMode = new Map(); // userId -> { active: boolean, language: string }

// 활성 TTS 파일 추적 (사용자별) - 단일 파일만 유지
const activeTTSFiles = new Map(); // userId -> { filePath: string, timestamp: number }

// 한국 시간 가져오기
function getKoreaTime() {
    return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
}

// 🆕 모든 TTS 파일 정리 (사용자별)
function cleanupUserTTSFiles(userId) {
    const existingFile = activeTTSFiles.get(userId);
    if (existingFile && fs.existsSync(existingFile.filePath)) {
        try {
            fs.unlinkSync(existingFile.filePath);
            console.log(`✅ 이전 TTS 파일 삭제: ${existingFile.filePath}`);
        } catch (error) {
            console.error('TTS 파일 삭제 오류:', error);
        }
    }
    activeTTSFiles.delete(userId);
}

// 🆕 오래된 TTS 파일들 일괄 정리
function cleanupAllTTSFiles() {
    const tempDir = path.join(__dirname, 'temp');
    if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        const now = Date.now();
        
        files.forEach(file => {
            if (file.startsWith('tts_') && file.endsWith('.mp3')) {
                const filePath = path.join(tempDir, file);
                try {
                    const stats = fs.statSync(filePath);
                    // 5분 이상 된 파일 삭제
                    if (now - stats.mtime.getTime() > 5 * 60 * 1000) {
                        fs.unlinkSync(filePath);
                        console.log(`🧹 오래된 TTS 파일 정리: ${file}`);
                    }
                } catch (error) {
                    console.error('TTS 파일 정리 오류:', error);
                }
            }
        });
    }
}

// 🆕 TTS 생성 함수 (개선된 버전)
async function generateTTS(text, language, userId) {
    // 기존 파일 먼저 삭제 (중복 방지)
    cleanupUserTTSFiles(userId);
    
    if (!text || text.trim().length === 0) {
        throw new Error('텍스트가 비어있습니다.');
    }
    
    if (text.length > 500) {
        throw new Error('텍스트가 너무 깁니다. (최대 500자)');
    }

    // temp 폴더 확인/생성
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    const fileName = `tts_${userId}_${timestamp}.mp3`;
    const filePath = path.join(tempDir, fileName);

    return new Promise((resolve, reject) => {
        const tts = new gtts(text, language);
        
        tts.save(filePath, (err) => {
            if (err) {
                console.error('TTS 생성 오류:', err);
                reject(new Error('음성 생성 실패'));
            } else {
                // 새 파일을 활성 파일로 등록
                activeTTSFiles.set(userId, {
                    filePath: filePath,
                    timestamp: timestamp
                });
                console.log(`✅ TTS 생성: ${fileName}`);
                resolve(filePath);
            }
        });
    });
}

// 🆕 TTS 모드 토글 함수
function toggleTTSMode(userId, language = 'ko') {
    const currentMode = ttsMode.get(userId) || { active: false, language: 'ko' };
    const newMode = {
        active: !currentMode.active,
        language: language
    };
    
    ttsMode.set(userId, newMode);
    console.log(`🔊 사용자 ${userId} TTS 모드: ${newMode.active ? 'ON' : 'OFF'} (${newMode.language})`);
    
    return newMode;
}

// 🆕 TTS 모드 확인 함수
function getTTSMode(userId) {
    return ttsMode.get(userId) || { active: false, language: 'ko' };
}

// 🆕 자동 TTS 처리 함수
async function handleAutoTTS(bot, chatId, userId, text) {
    try {
        const mode = getTTSMode(userId);
        
        if (!mode.active) {
            return false; // TTS 모드가 아니면 처리하지 않음
        }
        
        // 명령어나 특수 문자로 시작하면 TTS 처리하지 않음
        if (text.startsWith('/') || text.startsWith('!') || text.startsWith('#')) {
            return false;
        }
        
        // 너무 짧은 텍스트도 처리하지 않음
        if (text.trim().length < 2) {
            return false;
        }
        
        console.log(`🔊 자동 TTS 처리: "${text}" (언어: ${mode.language})`);
        
        // 로딩 메시지 (잠시 표시)
        const loadingMsg = await bot.sendMessage(chatId, '🔊 음성 생성 중...');
        
        try {
            // TTS 생성
            const filePath = await generateTTS(text, mode.language, userId);
            
            // 음성 파일 전송
            await bot.sendVoice(chatId, filePath, {
                caption: `🔊 "${text.length > 50 ? text.substring(0, 50) + '...' : text}"`
            });
            
            // 로딩 메시지 삭제
            try {
                await bot.deleteMessage(chatId, loadingMsg.message_id);
            } catch (deleteError) {
                // 삭제 실패는 무시
            }
            
            // 3초 후 파일 삭제 (메모리 절약)
            setTimeout(() => {
                cleanupUserTTSFiles(userId);
            }, 3000);
            
            return true;
            
        } catch (error) {
            console.error('자동 TTS 처리 오류:', error);
            
            try {
                await bot.editMessageText(`❌ 음성 생성 실패: ${error.message}`, {
                    chat_id: chatId,
                    message_id: loadingMsg.message_id
                });
            } catch (editError) {
                await bot.sendMessage(chatId, `❌ 음성 생성 실패: ${error.message}`);
            }
            
            return false;
        }
        
    } catch (error) {
        console.error('자동 TTS 처리 오류:', error);
        return false;
    }
}

// 🆕 TTS 메뉴 키보드
const createTTSMenuKeyboard = (userId) => {
    const mode = getTTSMode(userId);
    
    return {
        inline_keyboard: [
            [
                {
                    text: mode.active ? '🔊 TTS 모드 ON' : '🔇 TTS 모드 OFF',
                    callback_data: 'tts_toggle'
                }
            ],
            [
                { text: '🇰🇷 한국어', callback_data: 'tts_lang_ko' },
                { text: '🇺🇸 English', callback_data: 'tts_lang_en' }
            ],
            [
                { text: '🇯🇵 日本語', callback_data: 'tts_lang_ja' },
                { text: '🇨🇳 中文', callback_data: 'tts_lang_zh' }
            ],
            [
                { text: '🇪🇸 Español', callback_data: 'tts_lang_es' },
                { text: '🇫🇷 Français', callback_data: 'tts_lang_fr' }
            ],
            [
                { text: '🔙 유틸리티 메뉴', callback_data: 'utils_menu' }
            ]
        ]
    };
};

// 🆕 TTS 도움말 생성
function getTTSHelpText(userId) {
    const mode = getTTSMode(userId);
    
    return `🔊 **TTS (음성 변환) 도움말**\n\n` +
           `**현재 상태**\n` +
           `• 모드: ${mode.active ? '🔊 ON' : '🔇 OFF'}\n` +
           `• 언어: ${getLanguageName(mode.language)}\n\n` +
           `**사용 방법**\n` +
           `1️⃣ **자동 모드 (추천)**\n` +
           `• TTS 모드를 ON으로 설정\n` +
           `• 채팅창에 텍스트 입력\n` +
           `• 자동으로 음성 변환됨\n\n` +
           `2️⃣ **수동 모드**\n` +
           `• /tts [텍스트] 명령어 사용\n` +
           `• 예: /tts 안녕하세요\n\n` +
           `**📝 사용 팁**\n` +
           `• 최대 500자까지 입력 가능\n` +
           `• 명령어(/)로 시작하는 텍스트는 자동 변환 안됨\n` +
           `• 언어별 자연스러운 발음 지원\n` +
           `• 이전 음성 파일은 자동 삭제됨\n\n` +
           `**🌍 지원 언어**\n` +
           `• 한국어 (ko) • English (en)\n` +
           `• 日本語 (ja) • 中文 (zh)\n` +
           `• Español (es) • Français (fr)\n\n` +
           `${mode.active ? '🔊 현재 자동 모드 활성화됨!' : '💡 TTS 모드를 ON으로 설정해보세요!'}`;
}

// 언어 이름 반환
function getLanguageName(langCode) {
    const languages = {
        'ko': '🇰🇷 한국어',
        'en': '🇺🇸 English',
        'ja': '🇯🇵 日本語',
        'zh': '🇨🇳 中文',
        'es': '🇪🇸 Español',
        'fr': '🇫🇷 Français',
        'de': '🇩🇪 Deutsch',
        'ru': '🇷🇺 Русский'
    };
    return languages[langCode] || langCode;
}

// 🆕 메인 TTS 핸들러 함수
async function handleTTSMenu(bot, chatId, userId) {
    const helpText = getTTSHelpText(userId);
    const keyboard = createTTSMenuKeyboard(userId);
    
    await bot.sendMessage(chatId, helpText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

// 🆕 TTS 콜백 처리 함수
async function handleTTSCallback(bot, callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;
    
    try {
        switch (data) {
            case 'tts_toggle':
                const newMode = toggleTTSMode(userId);
                const statusText = newMode.active ? 
                    `🔊 **TTS 모드 활성화됨!**\n\n이제 채팅창에 텍스트를 입력하면 자동으로 음성으로 변환됩니다.\n\n언어: ${getLanguageName(newMode.language)}` :
                    `🔇 **TTS 모드 비활성화됨**\n\n수동으로 /tts 명령어를 사용하세요.`;
                
                await bot.editMessageText(statusText, {
                    chat_id: chatId,
                    message_id: callbackQuery.message.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: createTTSMenuKeyboard(userId)
                });
                break;
                
            case 'tts_lang_ko':
            case 'tts_lang_en':
            case 'tts_lang_ja':
            case 'tts_lang_zh':
            case 'tts_lang_es':
            case 'tts_lang_fr':
                const langCode = data.replace('tts_lang_', '');
                const currentMode = getTTSMode(userId);
                ttsMode.set(userId, {
                    active: currentMode.active,
                    language: langCode
                });
                
                const langText = `🌍 **언어 변경됨**\n\n` +
                                `새 언어: ${getLanguageName(langCode)}\n` +
                                `모드: ${currentMode.active ? '🔊 ON' : '🔇 OFF'}\n\n` +
                                `${currentMode.active ? '이제 채팅창에 텍스트를 입력해보세요!' : 'TTS 모드를 활성화해보세요!'}`;
                
                await bot.editMessageText(langText, {
                    chat_id: chatId,
                    message_id: callbackQuery.message.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: createTTSMenuKeyboard(userId)
                });
                break;
        }
    } catch (error) {
        console.error('TTS 콜백 처리 오류:', error);
        await bot.sendMessage(chatId, '❌ 처리 중 오류가 발생했습니다.');
    }
}

// 🆕 기존 TTS 명령어 처리 (기존 방식 유지)
async function handleTTSCommand(bot, chatId, userId, text) {
    try {
        const ttsText = text.replace('/tts ', '').trim();
        if (!ttsText) {
            await bot.sendMessage(chatId, '❌ 텍스트를 입력해주세요.\n예: /tts 안녕하세요');
            return;
        }

        // 언어 파싱
        let language = 'ko';
        let actualText = ttsText;
        
        const parts = ttsText.split(' ');
        const supportedLangs = ['ko', 'en', 'ja', 'zh', 'es', 'fr', 'de', 'ru'];
        
        if (parts.length >= 2 && supportedLangs.includes(parts[0])) {
            language = parts[0];
            actualText = parts.slice(1).join(' ');
        }

        if (!actualText.trim()) {
            await bot.sendMessage(chatId, `❌ ${language} 언어로 변환할 텍스트를 입력해주세요.`);
            return;
        }

        // 로딩 메시지
        const loadingMsg = await bot.sendMessage(chatId, '🔊 음성 생성 중...');

        try {
            // TTS 생성
            const filePath = await generateTTS(actualText, language, userId);
            
            // 음성 파일 전송
            await bot.sendVoice(chatId, filePath, {
                caption: `🔊 "${actualText.length > 50 ? actualText.substring(0, 50) + '...' : actualText}" (${getLanguageName(language)})`
            });

            // 로딩 메시지 삭제
            try {
                await bot.deleteMessage(chatId, loadingMsg.message_id);
            } catch (deleteError) {
                // 삭제 실패는 무시
            }

            // 3초 후 파일 삭제
            setTimeout(() => {
                cleanupUserTTSFiles(userId);
            }, 3000);

        } catch (error) {
            try {
                await bot.editMessageText(`❌ ${error.message}`, {
                    chat_id: chatId,
                    message_id: loadingMsg.message_id
                });
            } catch (editError) {
                await bot.sendMessage(chatId, `❌ ${error.message}`);
            }
        }

    } catch (error) {
        console.error('TTS 명령어 처리 오류:', error);
        await bot.sendMessage(chatId, '❌ TTS 기능을 사용할 수 없습니다.');
    }
}

// 🧹 자동 정리 작업
setInterval(() => {
    cleanupAllTTSFiles();
}, 2 * 60 * 1000); // 2분마다 정리

// 프로세스 종료 시 정리
process.on('exit', () => {
    cleanupAllTTSFiles();
});

process.on('SIGINT', () => {
    cleanupAllTTSFiles();
    process.exit(0);
});

process.on('SIGTERM', () => {
    cleanupAllTTSFiles();
    process.exit(0);
});

// 프로세스 종료 시 정리
process.on('exit', cleanupAllTTSFiles);
process.on('SIGINT', cleanupAllTTSFiles);
process.on('SIGTERM', cleanupAllTTSFiles);

// ========================
// 모듈 내보내기 (통합)
// ========================

module.exports = mainUtilsHandler;

// 추가 함수들을 메인 함수의 속성으로 export
module.exports.handleTTSCommand = handleTTSCommand;
module.exports.cleanupUserTTSFiles = cleanupUserTTSFiles;
module.exports.cleanupAllTTSFiles = cleanupAllTTSFiles;
module.exports.getHelpMessage = getHelpMessage;

// 기본 유틸리티 함수들
module.exports.getKoreaTime = getKoreaTime;
module.exports.getCurrentYear = getCurrentYear;
module.exports.formatDate = formatDate;
module.exports.formatTime = formatTime;
module.exports.formatDateTime = formatDateTime;
module.exports.formatNumber = formatNumber;
module.exports.calculatePercentage = calculatePercentage;
module.exports.truncateText = truncateText;
module.exports.randomChoice = randomChoice;
module.exports.shuffleArray = shuffleArray;
module.exports.delay = delay;
module.exports.logError = logError;
module.exports.logSuccess = logSuccess;
module.exports.isValidNumber = isValidNumber;
module.exports.isValidDate = isValidDate;
