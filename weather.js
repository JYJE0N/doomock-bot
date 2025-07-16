// weather.js - 날씨 정보 모듈 (화성 기본 설정)

const axios = require('axios');
const { getUserName } = require('./username_helper');

// OpenWeatherMap API 키 (환경변수에서 가져오기)
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || 'YOUR_API_KEY_HERE';
const WEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';

// 한국 주요 도시 좌표 (화성이 맨 위!)
// weather.js의 CITIES 객체에 수원 추가

const CITIES = {
  '화성': { lat: 37.2061, lon: 126.8306 }, // 화성/동탄 (기본값)
  '서울': { lat: 37.5665, lon: 126.9780 },
  '수원': { lat: 37.2636, lon: 127.0286 }, // 🆕 수원 좌표 추가
  '부산': { lat: 35.1796, lon: 129.0756 },
  '대구': { lat: 35.8714, lon: 128.6014 },
  '인천': { lat: 37.4563, lon: 126.7052 },
  '광주': { lat: 35.1595, lon: 126.8526 },
  '대전': { lat: 36.3504, lon: 127.3845 },
  '울산': { lat: 35.5384, lon: 129.3114 },
  '세종': { lat: 36.4800, lon: 127.2890 },
  '경기': { lat: 37.4138, lon: 127.5183 }, // 경기도 일반
  '강원': { lat: 37.8228, lon: 128.1555 },
  '충북': { lat: 36.6356, lon: 127.4917 },
  '충남': { lat: 36.5184, lon: 126.8000 },
  '전북': { lat: 35.7175, lon: 127.1530 },
  '전남': { lat: 34.8679, lon: 126.9910 },
  '경북': { lat: 36.4919, lon: 128.8889 },
  '경남': { lat: 35.4606, lon: 128.2132 },
  '제주': { lat: 33.4996, lon: 126.5312 }
};

class WeatherManager {
  // 날씨 아이콘을 이모지로 변환
  getWeatherEmoji(weatherCode, isDay = true) {
    const weatherEmojis = {
      '01d': '☀️', '01n': '🌙',  // clear sky
      '02d': '⛅', '02n': '☁️',  // few clouds
      '03d': '☁️', '03n': '☁️',  // scattered clouds
      '04d': '☁️', '04n': '☁️',  // broken clouds
      '09d': '🌧️', '09n': '🌧️', // shower rain
      '10d': '🌦️', '10n': '🌧️', // rain
      '11d': '⛈️', '11n': '⛈️',  // thunderstorm
      '13d': '❄️', '13n': '❄️',  // snow
      '50d': '🌫️', '50n': '🌫️'  // mist
    };
    
    return weatherEmojis[weatherCode] || '🌤️';
  }

  // 기온에 따른 옷차림 추천
  getClothingRecommendation(temp) {
    if (temp >= 28) {
      return { emoji: '👕', text: '반팔, 반바지, 샌들' };
    } else if (temp >= 23) {
      return { emoji: '👔', text: '얇은 셔츠, 면바지' };
    } else if (temp >= 20) {
      return { emoji: '👖', text: '긴팔, 얇은 가디건' };
    } else if (temp >= 17) {
      return { emoji: '🧥', text: '니트, 자켓' };
    } else if (temp >= 12) {
      return { emoji: '🧥', text: '트렌치코트, 야상' };
    } else if (temp >= 9) {
      return { emoji: '🧥', text: '코트, 가죽자켓' };
    } else if (temp >= 5) {
      return { emoji: '🧥', text: '두꺼운 코트, 목도리' };
    } else {
      return { emoji: '🧣', text: '패딩, 장갑, 목도리' };
    }
  }

  // 미세먼지 레벨 판단
  getAirQualityLevel(aqi) {
    if (aqi <= 50) {
      return { level: '좋음', emoji: '😊', color: '🟢', advice: '외출하기 좋아요!' };
    } else if (aqi <= 100) {
      return { level: '보통', emoji: '😐', color: '🟡', advice: '괜찮아요' };
    } else if (aqi <= 150) {
      return { level: '나쁨', emoji: '😷', color: '🟠', advice: '마스크 착용 권장' };
    } else {
      return { level: '매우나쁨', emoji: '😵', color: '🔴', advice: '외출 자제, 마스크 필수' };
    }
  }

  // 현재 날씨 가져오기 (🆕 기본값을 화성으로 변경!)
  async getCurrentWeather(city = '화성') {  // 서울 → 화성으로 변경!
    try {
      const cityInfo = CITIES[city];
      if (!cityInfo) {
        throw new Error('지원하지 않는 도시입니다.');
      }

      // 현재 날씨 정보
      const weatherResponse = await axios.get(
        `${WEATHER_BASE_URL}/weather?lat=${cityInfo.lat}&lon=${cityInfo.lon}&appid=${WEATHER_API_KEY}&units=metric&lang=kr`
      );

      // 대기질 정보 (선택사항)
      let airQuality = null;
      try {
        const aqiResponse = await axios.get(
          `${WEATHER_BASE_URL}/air_pollution?lat=${cityInfo.lat}&lon=${cityInfo.lon}&appid=${WEATHER_API_KEY}`
        );
        airQuality = aqiResponse.data.list[0].main.aqi;
      } catch (error) {
        console.log('대기질 정보를 가져올 수 없습니다:', error.message);
      }

      const data = weatherResponse.data;
      const temp = Math.round(data.main.temp);
      const feelsLike = Math.round(data.main.feels_like);
      const humidity = data.main.humidity;
      const windSpeed = data.wind.speed;
      const weatherIcon = data.weather[0].icon;
      const weatherDesc = data.weather[0].description;

      const weatherEmoji = this.getWeatherEmoji(weatherIcon);
      const clothing = this.getClothingRecommendation(temp);
      const airQualityInfo = airQuality ? this.getAirQualityLevel(airQuality) : null;

      return {
        city,
        temp,
        feelsLike,
        humidity,
        windSpeed,
        weatherDesc,
        weatherEmoji,
        clothing,
        airQuality: airQualityInfo,
        uvIndex: data.uvi || null,
        visibility: data.visibility ? Math.round(data.visibility / 1000) : null
      };

    } catch (error) {
      console.error('날씨 정보 가져오기 실패:', error.message);
      throw new Error('날씨 정보를 가져올 수 없습니다. 잠시 후 다시 시도해주세요.');
    }
  }

  // 5일 날씨 예보 (🆕 기본값을 화성으로 변경!)
  async getWeatherForecast(city = '화성') {  // 서울 → 화성으로 변경!
    try {
      const cityInfo = CITIES[city];
      if (!cityInfo) {
        throw new Error('지원하지 않는 도시입니다.');
      }

      const response = await axios.get(
        `${WEATHER_BASE_URL}/forecast?lat=${cityInfo.lat}&lon=${cityInfo.lon}&appid=${WEATHER_API_KEY}&units=metric&lang=kr`
      );

      const forecasts = response.data.list.slice(0, 8); // 24시간 (3시간 간격 x 8)
      
      return forecasts.map(item => {
        // 🔧 시간대 수정: 한국 시간으로 변환
        const utcDate = new Date(item.dt * 1000);
        const koreaDate = new Date(utcDate.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
        const time = koreaDate.getHours();
        const temp = Math.round(item.main.temp);
        const weatherIcon = item.weather[0].icon;
        const weatherEmoji = this.getWeatherEmoji(weatherIcon);
        
        return {
          time: `${time.toString().padStart(2, '0')}:00`,
          temp,
          weatherEmoji,
          desc: item.weather[0].description
        };
      });

    } catch (error) {
      console.error('날씨 예보 가져오기 실패:', error.message);
      throw new Error('날씨 예보를 가져올 수 없습니다.');
    }
  }

  // 🔧 수정: 출근용 날씨 정보 포맷 (화성 특화!)
  formatMorningWeather(weatherData) {
    // 한국 시간으로 수정
    const now = new Date();
    const koreaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
    const timeStr = `${koreaTime.getHours().toString().padStart(2, '0')}:${koreaTime.getMinutes().toString().padStart(2, '0')}`;
    
    let message = `━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🌤️ **${weatherData.city} 날씨** (${timeStr})\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // 🏡 화성일 때 특별 메시지
    if (weatherData.city === '화성') {
        message += `🏡 **동탄/화성 지역**\n\n`;
    }
    
    // 핵심 날씨 정보만
    message += `${weatherData.weatherEmoji} **${weatherData.weatherDesc}**\n\n`;
    
    message += `🌡️ **${weatherData.temp}°C** (체감 ${weatherData.feelsLike}°C)\n`;
    message += `💧 습도: ${weatherData.humidity}%\n`;
    
    // 바람은 강할 때만 표시
    if (weatherData.windSpeed > 3) {
        message += `💨 바람: ${weatherData.windSpeed}m/s\n`;
    }
    
    message += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
    
    // 옷차림 추천
    message += `${weatherData.clothing.emoji} **오늘의 옷차림**\n`;
    message += `${weatherData.clothing.text}\n\n`;
    
    // 대기질은 나쁠 때만 표시
    if (weatherData.airQuality && weatherData.airQuality.level !== '좋음') {
        message += `🏭 **대기질**: ${weatherData.airQuality.color} ${weatherData.airQuality.level}\n`;
        message += `${weatherData.airQuality.emoji} ${weatherData.airQuality.advice}\n\n`;
    }
    
    // 날씨 주의사항
    let alerts = [];
    if (weatherData.weatherDesc.includes('비')) {
        alerts.push('☂️ 우산 필수!');
    }
    if (weatherData.temp <= 5) {
        alerts.push('🧣 따뜻하게!');
    }
    if (weatherData.temp >= 30) {
        alerts.push('🧴 자외선 차단제!');
    }
    
    if (alerts.length > 0) {
        message += `⚠️ **주의사항**\n`;
        alerts.forEach(alert => {
            message += `• ${alert}\n`;
        });
        message += '\n';
    }
    
    // 🏡 화성 지역 통근 TIP (간소화)
    if (weatherData.city === '화성') {
        message += `━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `🚌 **동탄 통근 TIP**\n`;
        
        if (weatherData.temp <= 0) {
            message += `• 버스 대기시간 고려해서 따뜻하게!\n`;
        } else if (weatherData.weatherDesc.includes('비')) {
            message += `• 동탄역 지하보도 이용 추천!\n`;
        } else {
            message += `• 좋은 하루 되세요! 🌈\n`;
        }
    }
    
    return message;
}

  // 24시간 예보 포맷
  formatHourlyForecast(forecasts) {
    let message = `⏰ **24시간 날씨 예보**\n\n`;
    
    forecasts.forEach(forecast => {
      message += `${forecast.time} ${forecast.weatherEmoji} ${forecast.temp}°C\n`;
    });
    
    return message;
  }
}

const weatherManager = new WeatherManager();

// 날씨 기능을 처리하는 메인 함수
module.exports = function(bot, msg) {
  const text = msg.text;
  const chatId = msg.chat.id;
  const userName = getUserName(msg);

  // 도시 추출 (예: /weather 서울, /날씨 부산)
  let city = '화성'; // 🆕 기본값을 화성으로 변경!
  if (text) {
    const cityMatch = text.match(/(?:weather|날씨)\s*(.+)/i);
    if (cityMatch && cityMatch[1]) {
      const inputCity = cityMatch[1].trim();
      if (CITIES[inputCity]) {
        city = inputCity;
      }
    }
  }

  if (text === '/weather' || text === '/날씨' || !text) {
    // 현재 날씨 정보 (화성 기본!)
    weatherManager.getCurrentWeather(city)
      .then(weatherData => {
        const weatherMessage = weatherManager.formatMorningWeather(weatherData);
        
        const keyboard = {
          inline_keyboard: [
            [
              { text: '🏙️ 다른 도시', callback_data: 'weather_cities' },
              { text: '⏰ 시간별 예보', callback_data: `weather_forecast_${city}` }
            ],
            [
              { text: '🔄 새로고침', callback_data: `weather_refresh_${city}` },
              { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
            ]
          ]
        };
        
        bot.sendMessage(chatId, weatherMessage, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      })
      .catch(error => {
        bot.sendMessage(chatId, `❌ ${error.message}`);
      });

  } else if (text && text.includes('예보')) {
    // 시간별 예보
    weatherManager.getWeatherForecast(city)
      .then(forecasts => {
        const forecastMessage = weatherManager.formatHourlyForecast(forecasts);
        bot.sendMessage(chatId, forecastMessage, { parse_mode: 'Markdown' });
      })
      .catch(error => {
        bot.sendMessage(chatId, `❌ ${error.message}`);
      });

  } else {
    // 도움말
    const cityList = Object.keys(CITIES).slice(0, 10).join(', ');
    bot.sendMessage(chatId, 
      `🌤️ **날씨 정보 도움말**\n\n` +
      `**사용법:**\n• /weather 또는 /날씨 - 화성 날씨 (기본!) 🏡\n• /weather 서울 - 서울 날씨\n• /날씨 예보 - 시간별 예보\n\n` +
      `**지원 도시:**\n🏡 화성(동탄), ${cityList.replace('화성, ', '')} 등\n\n` +
      `날씨에 맞는 옷차림과 대기질 정보도 함께 제공합니다! 🌈\n\n` +
      `🏡 **화성/동탄 지역이 기본으로 설정되어 있어요!**`,
      { parse_mode: 'Markdown' }
    );
  }
};
