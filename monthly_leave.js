const { MongoClient } = require('mongodb');

class MonthlyLeaveManager {
    constructor() {
        this.client = null;
        this.db = null;
        this.collection = null;
    }

    async connect() {
        if (!this.client) {
            this.client = new MongoClient(process.env.MONGODB_URI);
            await this.client.connect();
            this.db = this.client.db('telegram_bot');
            this.collection = this.db.collection('monthly_leaves');
        }
    }

    async initializeUser(userId) {
        await this.connect();
        
        const currentYear = new Date().getFullYear();
        const koreaTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
        
        const existingUser = await this.collection.findOne({ 
            userId: userId.toString(),
            year: currentYear 
        });

        if (!existingUser) {
            await this.collection.insertOne({
                userId: userId.toString(),
                year: currentYear,
                totalLeaves: 15, // 기본 연차 15일
                usedLeaves: 0,
                remainingLeaves: 15,
                leaveHistory: [],
                createdAt: koreaTime,
                updatedAt: koreaTime
            });
        }
    }

    async getUserLeaves(userId) {
        await this.connect();
        const currentYear = new Date().getFullYear();
        
        let user = await this.collection.findOne({ 
            userId: userId.toString(),
            year: currentYear 
        });

        if (!user) {
            await this.initializeUser(userId);
            user = await this.collection.findOne({ 
                userId: userId.toString(),
                year: currentYear 
            });
        }

        return user;
    }

    async setTotalLeaves(userId, totalLeaves) {
        await this.connect();
        const currentYear = new Date().getFullYear();
        const koreaTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
        
        await this.initializeUser(userId);
        
        const user = await this.getUserLeaves(userId);
        const newRemaining = totalLeaves - user.usedLeaves;
        
        await this.collection.updateOne(
            { userId: userId.toString(), year: currentYear },
            { 
                $set: { 
                    totalLeaves: totalLeaves,
                    remainingLeaves: newRemaining,
                    updatedAt: koreaTime
                }
            }
        );
        
        return { totalLeaves, remainingLeaves: newRemaining };
    }

    async useLeave(userId, days, reason = '') {
        await this.connect();
        const currentYear = new Date().getFullYear();
        const koreaTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
        
        const user = await this.getUserLeaves(userId);
        
        if (user.remainingLeaves < days) {
            throw new Error(`잔여 연차가 부족합니다. (잔여: ${user.remainingLeaves}일)`);
        }

        const newUsed = user.usedLeaves + days;
        const newRemaining = user.remainingLeaves - days;
        
        const leaveRecord = {
            date: koreaTime,
            days: days,
            reason: reason,
            type: days === 0.5 ? '반차' : '연차'
        };

        await this.collection.updateOne(
            { userId: userId.toString(), year: currentYear },
            { 
                $set: { 
                    usedLeaves: newUsed,
                    remainingLeaves: newRemaining,
                    updatedAt: koreaTime
                },
                $push: { leaveHistory: leaveRecord }
            }
        );

        return { usedLeaves: newUsed, remainingLeaves: newRemaining, leaveRecord };
    }

    async getLeaveHistory(userId) {
        await this.connect();
        const user = await this.getUserLeaves(userId);
        return user.leaveHistory || [];
    }

    async resetYearlyLeaves(userId) {
        await this.connect();
        const currentYear = new Date().getFullYear();
        const koreaTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
        
        // 새해 초기화
        await this.collection.updateOne(
            { userId: userId.toString(), year: currentYear },
            { 
                $set: { 
                    usedLeaves: 0,
                    remainingLeaves: 15, // 기본값으로 리셋
                    leaveHistory: [],
                    updatedAt: koreaTime
                }
            },
            { upsert: true }
        );
    }

    formatLeaveStatus(user) {
        const percentage = ((user.usedLeaves / user.totalLeaves) * 100).toFixed(1);
        
        return `📅 *${user.year}년 연차 현황*\n\n` +
               `🏖️ 총 연차: ${user.totalLeaves}일\n` +
               `✅ 사용한 연차: ${user.usedLeaves}일\n` +
               `⏳ 남은 연차: ${user.remainingLeaves}일\n` +
               `📊 사용률: ${percentage}%\n\n` +
               `${user.remainingLeaves <= 3 ? '⚠️ 연차가 얼마 남지 않았습니다!' : '✨ 연차를 효율적으로 관리하세요!'}`;
    }

    formatLeaveHistory(history) {
        if (!history || history.length === 0) {
            return '📋 연차 사용 내역이 없습니다.';
        }

        let result = '📋 *연차 사용 내역*\n\n';
        
        history.slice(-10).reverse().forEach((record, index) => {
            const date = new Date(record.date).toLocaleDateString('ko-KR');
            const type = record.type || (record.days === 0.5 ? '반차' : '연차');
            const reason = record.reason ? ` (${record.reason})` : '';
            
            result += `${index + 1}. ${date} - ${type} ${record.days}일${reason}\n`;
        });

        return result;
    }
}

module.exports = MonthlyLeaveManager;
