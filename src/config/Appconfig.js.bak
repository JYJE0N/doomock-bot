// src/config/AppConfig.js
require("dotenv").config();

module.exports = {
  NODE_ENV: process.env.NODE_ENV || "development",
  VERSION: "v1.0.0",
  MONGO_URL: process.env.MONGO_URL,
  BOT_TOKEN: process.env.BOT_TOKEN,
  BOT_USERNAME: process.env.BOT_USERNAME,
  FEATURES: {
    todo: true,
    timer: true,
    worktime: true,
    reminder: true,
    weather: true,
  },
  WEATHER_API_KEY: process.env.WEATHER_API_KEY,
  AIR_KOREA_API_KEY: process.env.AIR_KOREA_API_KEY,
  isRailway: !!process.env.RAILWAY_STATIC_URL,
  RAILWAY: {
    DEPLOYMENT_ID: process.env.RAILWAY_DEPLOYMENT_ID,
    ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
    PUBLIC_DOMAIN: process.env.RAILWAY_STATIC_URL,
    GIT_COMMIT_SHA: process.env.RAILWAY_GIT_COMMIT_SHA,
    GIT_BRANCH: process.env.RAILWAY_GIT_BRANCH,
  },
};
