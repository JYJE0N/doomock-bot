// src/services/WeatherService.js
// ✅ 올바른 임포트
const { ensureConnection, getCollection } = require('../database/DatabaseManager');
const axios = require('axios');

class WeatherService {
    constructor(apiKey) {
        this.apiKey = apiKey || process.env.WEATHER_API_KEY;
    }

    async getWeather(city = 'Seoul') {
        try {
            const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${this.apiKey}&units=metric&lang=kr`;
            const response = await axios.get(url);
            const data = response.data;

            return `🌦️ [${data.name} 날씨]\n\n` +
                   `📍 위치: ${data.coord.lat}, ${data.coord.lon}\n` +
                   `🌡️ 기온: ${data.main.temp}°C (체감: ${data.main.feels_like}°C)\n` +
                   `💧 습도: ${data.main.humidity}%\n` +
                   `🌬️ 바람: ${data.wind.speed} m/s\n` +
                   `📝 상태: ${data.weather[0].description}`;
        } catch (error) {
            return `❌ 날씨 정보를 불러오지 못했습니다: ${error.message}`;
        }
    }
}

module.exports = { WeatherService };
