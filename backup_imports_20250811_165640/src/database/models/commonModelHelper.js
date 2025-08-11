// src/database/models/commonModelHelper.js
const _mongoose = require("mongoose");

/**
 * 🛠️ 모델 공통 헬퍼
 *
 * 여러 모델에서 공통으로 사용하는 기능들
 */

/**
 * 공통 스키마 옵션
 */
const commonSchemaOptions = {
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform: function (doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      return ret;
    }
  },
  toObject: {
    virtuals: true
  }
};

/**
 * 공통 플러그인 - 소프트 삭제
 */
const softDeletePlugin = function (schema) {
  schema.add({
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    deletedAt: Date
  });

  // 삭제 메서드
  schema.methods.softDelete = function () {
    this.isDeleted = true;
    this.deletedAt = new Date();
    return this.save();
  };

  // 복구 메서드
  schema.methods.restore = function () {
    this.isDeleted = false;
    this.deletedAt = undefined;
    return this.save();
  };

  // 기본 쿼리에서 삭제된 항목 제외
  schema.pre(/^find/, function () {
    if (!this.getOptions().includeDeleted) {
      this.where({ isDeleted: { $ne: true } });
    }
  });
};

/**
 * 공통 플러그인 - 사용자 추적
 */
const userTrackingPlugin = function (schema) {
  schema.add({
    createdBy: String,
    updatedBy: String
  });
};

/**
 * 페이지네이션 헬퍼
 */
const paginatePlugin = function (schema) {
  schema.statics.paginate = async function (filter = {}, options = {}) {
    const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;

    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      this.find(filter).sort(sort).limit(limit).skip(skip),
      this.countDocuments(filter)
    ]);

    return {
      docs,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1
    };
  };
};

module.exports = {
  commonSchemaOptions,
  softDeletePlugin,
  userTrackingPlugin,
  paginatePlugin
};
