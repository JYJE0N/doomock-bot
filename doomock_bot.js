// doomock_bot.js - 메인 엔트리 포인트

require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const BotController = require('./src/controllers/BotController');
const Logger = require('./src/utils/Logger');

// 전역 에러 핸들러
process.on('uncaughtException', (error) => {
    Logger.error('💥 처리되지 않은 예외:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    Logger.error('🚫 처리되지 않은 Promise 거부:', reason);
});

// 프로세스 종료 핸들러
process.on('SIGINT', async () => {
    Logger.info('🛑 봇을 종료합니다...');
    await cleanup();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    Logger.info('🛑 봇을 종료합니다...');
    await cleanup();
    process.exit(0);
});

// 정리 함수
async function cleanup() {
    try {
        if (botController) {
            await botController.shutdown();
        }
    } catch (error) {
        Logger.error('종료 중 오류:', error);
    }
}

// 메인 봇 컨트롤러
let botController = null;

// 봇 초기화 및 시작
async function startBot() {
    try {
        Logger.info('🚂 두목봇 시작...');
        
        // 환경 변수 확인
        const ENV_CHECK = {
            BOT_TOKEN: process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN,
            MONGO_URL: process.env.MONGO_URL || process.env.MONGODB_URI,
            NODE_ENV: process.env.NODE_ENV || 'production'
        };
        
        if (!ENV_CHECK.BOT_TOKEN) {
            Logger.error('❌ BOT_TOKEN이 없습니다!');
            process.exit(1);
        }
        
        // 환경 로그
        Logger.info(`🌍 환경: ${ENV_CHECK.NODE_ENV}`);
        Logger.info(`📱 토큰 확인: ${ENV_CHECK.BOT_TOKEN ? '✅' : '❌'}`);
        Logger.info(`💾 MongoDB 확인: ${ENV_CHECK.MONGO_URL ? '✅' : '❌'}`);
        
        // Railway 환경 체크
        if (process.env.RAILWAY_DEPLOYMENT_ID) {
            Logger.info(`🚂 Railway 배포 ID: ${process.env.RAILWAY_DEPLOYMENT_ID}`);
        }
        
        // TelegramBot 인스턴스 생성
        const bot = new TelegramBot(ENV_CHECK.BOT_TOKEN, { polling: true });
        
        // BotController 초기화
        botController = new BotController(bot, {
            mongoUrl: ENV_CHECK.MONGO_URL,
            nodeEnv: ENV_CHECK.NODE_ENV
        });
        
        // 봇 시작
        await botController.initialize();
        
        
        
        Logger.success('🎉 두목봇이 성공적으로 시작되었습니다!');
        Logger.info('✅ 모든 핸들러가 등록되었습니다. 메시지를 기다리는 중...');
        
    } catch (error) {
        Logger.error('봇 시작 실패:', error);
        process.exit(1);
    }
}

// 봇 시작
startBot();