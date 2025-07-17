// src/services/DatabaseManager.js

const { MongoClient } = require('mongodb');

class DatabaseManager {
    constructor(mongoUrl) {
        this.mongoUrl = mongoUrl;
        this.client = null;
        this.db = null;
    }

    async connect() {
        try {
            this.client = new MongoClient(this.mongoUrl);
            await this.client.connect();
            this.db = this.client.db('test');  // ✅ 형님 MongoDB 이름 정확히 반영
            console.log('✅ [DatabaseManager] MongoDB 연결 성공 (test DB)');
        } catch (error) {
            console.error('❌ [DatabaseManager] MongoDB 연결 실패:', error);
            throw error;
        }
    }

    getCollection(name) {
        if (!this.db) {
            throw new Error('❌ 데이터베이스가 아직 연결되지 않았습니다.');
        }
        return this.db.collection(name);
    }

    async disconnect() {
        if (this.client) {
            await this.client.close();
            console.log('🛑 [DatabaseManager] MongoDB 연결 종료');
        }
    }
}

module.exports = { DatabaseManager };
