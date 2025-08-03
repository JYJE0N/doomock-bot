// src/models/UserLocation.js - 사용자 위치 정보 저장 모델

const mongoose = require("mongoose");

/**
 * 📍 사용자 위치 정보 스키마
 */
const userLocationSchema = new mongoose.Schema(
  {
    // userId: {
    //   type: Number,
    //   required: true,
    //   unique: true,
    //   // index: true,
    // },

    username: {
      type: String,
      required: true
    },

    // 위치 정보
    location: {
      city: {
        type: String,
        required: true
      },
      district: {
        type: String,
        default: ""
      },
      region: {
        type: String,
        required: true
      },
      fullAddress: {
        type: String,
        required: true
      },
      coordinates: {
        lat: {
          type: Number,
          default: null
        },
        lon: {
          type: Number,
          default: null
        }
      }
    },

    // 설정 방법
    method: {
      type: String,
      enum: ["manual", "gps", "search", "default"],
      default: "manual"
    },

    // 설정 시간
    setAt: {
      type: Date,
      default: Date.now
    },

    // 자동 감지 허용
    autoDetectEnabled: {
      type: Boolean,
      default: false
    },

    // 마지막 사용 시간
    lastUsed: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    collection: "user_locations"
  }
);

// 인덱스
userLocationSchema.index({ userId: 1 });
userLocationSchema.index({ "location.city": 1 });
userLocationSchema.index({ lastUsed: -1 });

// 메서드
userLocationSchema.methods.updateLastUsed = function () {
  this.lastUsed = new Date();
  return this.save();
};

userLocationSchema.methods.toSimpleObject = function () {
  return {
    city: this.location.city,
    district: this.location.district,
    region: this.location.region,
    fullAddress: this.location.fullAddress,
    lat: this.location.coordinates.lat,
    lon: this.location.coordinates.lon,
    method: this.method,
    setAt: this.setAt
  };
};

// 정적 메서드
userLocationSchema.statics.setUserLocation = async function (
  userId,
  username,
  locationData
) {
  const updateData = {
    userId,
    username,
    location: {
      city: locationData.city,
      district: locationData.district || "",
      region: locationData.region,
      fullAddress: locationData.fullAddress || locationData.city,
      coordinates: {
        lat: locationData.lat || null,
        lon: locationData.lon || null
      }
    },
    method: locationData.method || "manual",
    setAt: new Date(),
    lastUsed: new Date()
  };

  return await this.findOneAndUpdate({ userId }, updateData, {
    new: true,
    upsert: true,
    runValidators: true
  });
};

userLocationSchema.statics.getUserLocation = async function (userId) {
  const location = await this.findOne({ userId });
  if (location) {
    await location.updateLastUsed();
  }
  return location;
};

userLocationSchema.statics.removeUserLocation = async function (userId) {
  return await this.findOneAndDelete({ userId });
};

const UserLocation = mongoose.model("UserLocation", userLocationSchema);

module.exports = UserLocation;
