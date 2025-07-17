// src/services/FortuneService.js - 수정된 버전

// const { FortuneModule } = require('../modules/FortuneModule');

class FortuneService {
    constructor() {
        this.initializeMessages();
    }

    initializeMessages() {
        this.messages = {
            general: [
                "오늘은 새로운 시작의 기운이 가득한 날입니다 🌅",
                "예상치 못한 좋은 소식이 들려올 수 있어요 📞",
                "주변 사람들과의 관계에서 따뜻함을 느낄 거예요 💝",
                "창의적인 아이디어가 샘솟는 하루가 될 것 같아요 💡",
                "작은 행운들이 연달아 찾아올 징조가 보여요 🍀",
                "평온하고 안정감 있는 하루를 보낼 수 있을 거예요 🕊️",
                "새로운 도전에 대한 용기가 생기는 날이에요 💪",
                "직감이 특히 날카로워지는 하루가 될 것 같아요 🎯",
                "우연한 만남이 인생을 바꿀 수 있는 특별한 날이에요 ✨",
                "내면의 평화를 찾을 수 있는 조용한 하루예요 🧘‍♀️"
            ],
            work: [
                "업무에 집중력이 최고조에 달하는 날이에요 🎯",
                "동료들과의 협업에서 시너지가 폭발할 거예요 🤝",
                "중요한 프로젝트에 돌파구가 보일 수 있어요 🚀",
                "리더십을 발휘할 절호의 기회가 올 거예요 👑",
                "새로운 업무 기회가 문을 두드릴 수 있어요 🚪",
                "실력을 인정받아 승진 기회가 생길지도 몰라요 📈",
                "업무 효율성이 평소보다 2배 높아질 거예요 ⚡",
                "상사나 클라이언트로부터 칭찬을 들을 수 있어요 🏆",
                "새로운 스킬을 배우기에 완벽한 타이밍이에요 📚",
                "중요한 미팅에서 좋은 인상을 남길 수 있어요 💼"
            ],
            love: [
                "연인과의 관계가 한층 더 깊어질 거예요 💕",
                "새로운 만남이 기다리고 있을 수 있어요 💘",
                "마음속 깊은 대화를 나눌 기회가 생겨요 💬",
                "로맨틱한 순간이 예상치 못한 곳에서 찾아와요 🌹",
                "진정한 사랑을 깨닫게 되는 특별한 하루예요 💖",
                "썸타는 상대와 진전이 있을 수 있어요 😊",
                "가족이나 친구들의 따뜻한 사랑을 느낄 거예요 🤗",
                "과거의 인연이 다시 연결될 가능성이 보여요 🔄",
                "첫눈에 반할 수 있는 운명적 만남의 날이에요 😍",
                "사랑 고백을 받거나 하기에 좋은 날이에요 💌"
            ],
            money: [
                "금전적 여유가 생기는 기운이 감지돼요 💰",
                "투자나 부업에 좋은 기회가 올 수 있어요 📊",
                "예상치 못한 수입이 생길 가능성이 높아요 💸",
                "절약 정신이 발동해서 돈을 모을 수 있어요 🏦",
                "재정 관리에 대한 좋은 아이디어가 떠올라요 💡",
                "부동산이나 주식에 관심을 가져볼 때예요 🏠",
                "용돈이나 보너스 소식이 들려올 수 있어요 🎁",
                "돈 관리 앱이나 가계부를 시작하기 좋은 날이에요 📱",
                "로또나 복권에 작은 행운이 있을 수 있어요 🎰",
                "부모님이나 친척으로부터 용돈을 받을 수 있어요 👴"
            ],
            health: [
                "몸과 마음이 모두 가벼워지는 날이에요 🌿",
                "새로운 운동을 시작하기에 완벽한 타이밍이에요 🏃‍♀️",
                "건강한 식단에 관심이 생길 거예요 🥗",
                "숙면을 취할 수 있는 편안한 밤이 될 거예요 😴",
                "스트레스가 자연스럽게 해소되는 하루예요 🧘‍♀️",
                "활력이 넘쳐서 하루 종일 에너지가 가득할 거예요 ⚡",
                "건강 검진이나 병원 방문을 고려해보세요 🏥",
                "명상이나 요가로 내면의 평화를 찾을 수 있어요 🕯️",
                "산책이나 자연과의 교감이 도움이 될 거예요 🌳",
                "비타민이나 영양제 섭취를 시작하기 좋은 날이에요 💊"
            ],
            meeting: [
                "회식에서 분위기 메이커 역할을 하게 될 거예요 🎉",
                "상사와의 거리감이 좁혀지는 좋은 기회가 될 거예요 👔",
                "동료들과 진솔한 대화를 나눌 수 있을 거예요 🍻",
                "회식 자리에서 새로운 친구를 만날 수 있어요 🤝",
                "평소 어색했던 팀원과 친해질 기회가 생겨요 😊",
                "회식비가 예상보다 적게 나올 수 있어요 💰",
                "맛있는 음식점을 발견하게 될 거예요 🍜",
                "회식에서 좋은 아이디어나 정보를 얻을 수 있어요 💡",
                "평소보다 일찍 끝나서 여유롭게 집에 갈 수 있어요 🏠",
                "회식 후 2차에서 특별한 추억을 만들 거예요 🎤"
            ]
        };

        // 타로카드 데이터 (간소화)
        this.tarotCards = [
            { name: "The Fool", meaning: "새로운 시작과 모험", emoji: "🃏", advice: "두려워 말고 첫걸음을 내디디세요." },
            { name: "The Magician", meaning: "의지와 실현", emoji: "🔮", advice: "당신의 능력을 믿으세요." },
            { name: "The High Priestess", meaning: "직감과 내면의 지혜", emoji: "🌙", advice: "논리보다 직감을 따르세요." },
            { name: "The Empress", meaning: "풍요, 돌봄, 창조성", emoji: "👸", advice: "사랑과 돌봄을 나누세요." },
            { name: "The Emperor", meaning: "권위, 리더십, 질서", emoji: "👑", advice: "체계적으로 행동하세요." },
            { name: "The Hierophant", meaning: "전통, 규범, 조언", emoji: "⛪", advice: "멘토의 말을 경청하세요." },
            { name: "The Lovers", meaning: "사랑과 선택", emoji: "💕", advice: "진심을 표현하세요." },
            { name: "The Chariot", meaning: "승리, 전진, 결단", emoji: "🏎️", advice: "목표를 향해 밀고 나가세요." },
            { name: "Strength", meaning: "용기와 인내", emoji: "💪", advice: "부드럽게 극복하세요." },
            { name: "The Hermit", meaning: "성찰과 고독", emoji: "🔦", advice: "혼자만의 시간을 가지세요." },
            { name: "The Star", meaning: "희망과 영감", emoji: "⭐", advice: "꿈을 포기하지 마세요." },
            { name: "The Sun", meaning: "기쁨과 성공", emoji: "☀️", advice: "긍정적으로 임하세요." }
        ];
    }

    getRandomMessage(messages, userId) {
        const today = TimeHelper.formatDate ? TimeHelper.formatDate(new Date()) : new Date().toDateString();
        const seed = parseInt(userId.toString() + today.replace(/\D/g, ''));
        const index = seed % messages.length;
        return messages[index];
    }

    getFortune(userId, type) {
        return this.getRandomMessage(this.messages[type], userId);
    }

    getTarot(userId) {
        const card = this.getRandomMessage(this.tarotCards, userId);
        return `${card.emoji} **${card.name}**\n\n✨ *의미: ${card.meaning}*\n\n💫 *조언: ${card.advice}*`;
    }

    getLucky(userId) {
        const today = TimeHelper.formatDate ? TimeHelper.formatDate(new Date()) : new Date().toDateString();
        const seed = parseInt(userId.toString() + today.replace(/\D/g, ''));
        
        return `🍀 **오늘의 행운 정보**\n\n` +
               `🎨 행운의 색깔: ${this.getLuckyColor(seed)}\n` +
               `🔢 행운의 번호: ${this.getLuckyNumbers(seed).join(', ')}\n` +
               `🎁 행운의 아이템: ${this.getLuckyItem(seed)}\n` +
               `🧭 행운의 방향: ${this.getLuckyDirection(seed)}\n` +
               `⏰ 행운의 시간: ${this.getLuckyTime(seed)}\n` +
               `🌟 행운의 음식: ${this.getLuckyFood(seed)}`;
    }

    getAllFortune(userId, userName) {
        const general = this.getFortune(userId, 'general');
        const work = this.getFortune(userId, 'work');
        const love = this.getFortune(userId, 'love');
        const money = this.getFortune(userId, 'money');
        const health = this.getFortune(userId, 'health');
        const meeting = this.getFortune(userId, 'meeting');
        
        return `🔮 **${userName}님의 오늘 종합운세**\n\n` +
               `**🌟 전체운:** ${general}\n\n` +
               `**💼 업무운:** ${work}\n\n` +
               `**💕 연애운:** ${love}\n\n` +
               `**💰 재물운:** ${money}\n\n` +
               `**🌿 건강운:** ${health}\n\n` +
               `**🍻 회식운:** ${meeting}`;
    }

    getLuckyColor(seed) {
        const colors = ["빨간색", "파란색", "노란색", "초록색", "보라색", "분홍색", "주황색", "하얀색"];
        return colors[seed % colors.length];
    }

    getLuckyNumbers(seed) {
        const numbers = [];
        for (let i = 0; i < 6; i++) {
            const num = ((seed + i * 7) % 45) + 1;
            if (!numbers.includes(num)) {
                numbers.push(num);
            }
        }
        return numbers.slice(0, 6).sort((a, b) => a - b);
    }

    getLuckyItem(seed) {
        const items = ["커피", "꽃", "책", "음악", "향초", "초콜릿", "편지", "미소", "동전", "목걸이"];
        return items[seed % items.length];
    }

    getLuckyDirection(seed) {
        const directions = ["동쪽", "서쪽", "남쪽", "북쪽", "동남쪽", "동북쪽", "서남쪽", "서북쪽"];
        return directions[seed % directions.length];
    }

    getLuckyTime(seed) {
        const times = ["오전 8시", "오전 10시", "오후 12시", "오후 2시", "오후 4시", "오후 6시", "저녁 8시", "저녁 10시"];
        return times[seed % times.length];
    }

    getLuckyFood(seed) {
        const foods = ["김치찌개", "라면", "치킨", "피자", "초밥", "파스타", "햄버거", "샐러드", "과일", "아이스크림"];
        return foods[seed % foods.length];
    }
}

module.exports = { FortuneService };