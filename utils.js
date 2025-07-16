// utils.js - 통합 유틸리티 모듈

const gtts = require('gtts');
const fs = require('fs');
const path = require('path');

// ========================
// 기본 유틸리티 함수들
// ========================

// 한국 시간 가져오기
function getKoreaTime() {
    return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
}

// 현재 년도 가져오기
function getCurrentYear() {
    return getKoreaTime().getFullYear();
}

// 날짜 포맷팅 (YYYY-MM-DD)
function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('ko-KR');
}

// 시간 포맷팅 (HH:MM)
function formatTime(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
    });
}

// 날짜와 시간 포맷팅
function formatDateTime(date) {
    if (!date) return '';
    return `${formatDate(date)} ${formatTime(date)}`;
}

// 숫자를 소수점 1자리까지 표시
function formatNumber(num, decimals = 1) {
    return parseFloat(num).toFixed(decimals);
}

// 퍼센트 계산
function calculatePercentage(used, total) {
    if (total === 0) return 0;
    return ((used / total) * 100).toFixed(1);
}

// 텍스트 자르기
function truncateText(text, maxLength = 100) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// 랜덤 선택
function randomChoice(array) {
    if (!Array.isArray(array) || array.length === 0) return null;
    return array[Math.floor(Math.random() * array.length)];
}

// 배열 섞기
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// 지연 함수
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 에러 로깅
function logError(error, context = '') {
    console.error(`[${getKoreaTime().toISOString()}] ${context}:`, error);
}

// 성공 로깅
function logSuccess(message, context = '') {
    console.log(`[${getKoreaTime().toISOString()}] ${context}: ${message}`);
}

// 유효한 숫자인지 확인
function isValidNumber(value) {
    return !isNaN(value) && isFinite(value) && value >= 0;
}

// 유효한 날짜인지 확인
function isValidDate(date) {
    return date instanceof Date && !isNaN(date);
}

// ========================
// TTS 관련 함수들
// ========================

// 활성 TTS 파일 추적 (사용자별)
const activeTTSFiles = new Map(); // userId -> filePath

// TTS 파일 정리 함수
function cleanupUserTTSFiles(userId) {
    const existingFile = activeTTSFiles.get(userId);
    if (existingFile && fs.existsSync(existingFile)) {
        try {
            fs.unlinkSync(existingFile);
            logSuccess(`이전 TTS 파일 삭제: ${existingFile}`, 'TTS');
        } catch (error) {
            logError(error, 'TTS 파일 삭제');
        }
    }
    activeTTSFiles.delete(userId);
}

// 모든 임시 파일 정리
function cleanupAllTTSFiles() {
    const tempDir = path.join(__dirname, 'temp');
    if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        files.forEach(file => {
            if (file.startsWith('tts_') && file.endsWith('.mp3')) {
                try {
                    fs.unlinkSync(path.join(tempDir, file));
                    logSuccess(`정리된 TTS 파일: ${file}`, 'TTS');
                } catch (error) {
                    logError(error, 'TTS 파일 정리');
                }
            }
        });
    }
}

// TTS 생성 함수
async function generateTTS(text, language, userId) {
    // 기존 파일 먼저 삭제
    cleanupUserTTSFiles(userId);
    
    if (!text || text.trim().length === 0) {
        throw new Error('텍스트가 비어있습니다.');
    }
    
    if (text.length > 200) {
        throw new Error('텍스트가 너무 깁니다. (최대 200자)');
    }

    // temp 폴더 확인/생성
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName = `tts_${userId}_${Date.now()}.mp3`;
    const filePath = path.join(tempDir, fileName);

    return new Promise((resolve, reject) => {
        const tts = new gtts(text, language);
        
        tts.save(filePath, (err) => {
            if (err) {
                logError(err, 'TTS 생성');
                reject(new Error('음성 생성 실패'));
            } else {
                // 새 파일을 활성 파일로 등록
                activeTTSFiles.set(userId, filePath);
                logSuccess(`TTS 생성: ${fileName}`, 'TTS');
                resolve(filePath);
            }
        });
    });
}

// TTS 명령어 처리
async function handleTTSCommand(bot, chatId, userId, text) {
    try {
        const ttsText = text.replace('/tts ', '').trim();
        if (!ttsText) {
            bot.sendMessage(chatId, '❌ 텍스트를 입력해주세요.\n예: /tts 안녕하세요');
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
            bot.sendMessage(chatId, `❌ ${language} 언어로 변환할 텍스트를 입력해주세요.`);
            return;
        }

        // 로딩 메시지
        const loadingMsg = await bot.sendMessage(chatId, '🔊 음성 생성 중...');

        try {
            // TTS 생성
            const filePath = await generateTTS(actualText, language, userId);
            
            // 음성 파일 전송
            await bot.sendVoice(chatId, filePath, {
                caption: `🔊 "${truncateText(actualText, 50)}" (${language})`
            });

            // 로딩 메시지 삭제
            try {
                await bot.deleteMessage(chatId, loadingMsg.message_id);
            } catch (deleteError) {
                // 메시지 삭제 실패는 무시 (이미 삭제되었을 수 있음)
            }

            // 5초 후 파일 삭제
            setTimeout(() => {
                cleanupUserTTSFiles(userId);
            }, 5000);

        } catch (error) {
            try {
                await bot.editMessageText(`❌ ${error.message}`, {
                    chat_id: chatId,
                    message_id: loadingMsg.message_id
                });
            } catch (editError) {
                // 메시지 수정 실패 시 새 메시지 전송
                bot.sendMessage(chatId, `❌ ${error.message}`);
            }
        }

    } catch (error) {
        logError(error, 'TTS 처리');
        bot.sendMessage(chatId, '❌ TTS 기능을 사용할 수 없습니다. 관리자에게 문의해주세요.');
    }
}

// 도움말 메시지
function getHelpMessage() {
    return `❓ **두목봇 도움말**\n\n` +
           `**📱 주요 기능:**\n` +
           `• 📝 할일 관리\n• 📅 휴가 관리\n• ⏰ 타이머\n• 🔔 리마인더\n• 🎯 운세\n• 🕐 근무시간\n• 🔊 TTS\n\n` +
           `**⌨️ 빠른 명령어:**\n` +
           `• /start - 메인 메뉴\n• /tts [텍스트] - 음성 변환\n• /add [할일] - 할일 추가\n\n` +
           `**🔊 TTS 사용법:**\n` +
           `• /tts 안녕하세요\n• /tts en Hello\n• /tts ja こんにちは\n\n` +
           `지원 언어: ko, en, ja, zh, es, fr, de, ru`;
}

// ========================
// 메인 함수
// ========================

function mainUtilsHandler(bot, msg) {
    const text = msg.text || '';
    const chatId = msg.chat.id;
    const userId = msg.from?.id || chatId;

    if (text.startsWith('/tts ')) {
        handleTTSCommand(bot, chatId, userId, text);
    } else {
        bot.sendMessage(chatId, getHelpMessage(), { parse_mode: 'Markdown' });
    }
}

// ========================
// 자동 정리 및 이벤트 처리
// ========================

// 30초마다 오래된 파일 정리
setInterval(() => {
    cleanupAllTTSFiles();
}, 30000);

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
