// src/database/models/Todo.js
const mongoose = require("mongoose");

// Todo 스키마 생성 (독립적인 스키마)
const todoSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    text: { type: String, required: true, trim: true, maxlength: 500 },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    priority: { type: Number, default: 3, min: 1, max: 5 },
    category: { type: String, default: "일반" },
    tags: [String],
    dueDate: Date,
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
    // collation: "todo",
  }
);

// ===== 인덱스 =====
todoSchema.index({ userId: 1, createdAt: -1 });
todoSchema.index({ userId: 1, completed: 1 });
todoSchema.index({ text: "text", description: "text" }); // 텍스트 검색
todoSchema.index({ userId: 1, dueDate: 1 }, { sparse: true });
todoSchema.index({ tags: 1 });

// ===== 가상 속성 =====

// 마감일까지 남은 시간
todoSchema.virtual("daysUntilDue").get(function () {
  if (!this.dueDate) return null;
  const now = new Date();
  const diff = this.dueDate - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// 지연 여부
todoSchema.virtual("isOverdue").get(function () {
  if (!this.dueDate || this.completed) return false;
  return this.dueDate < new Date();
});

// ===== 미들웨어 =====

// 저장 전 버전 증가
todoSchema.pre("save", function (next) {
  if (this.isModified() && !this.isNew) {
    this.version += 1;
  }

  // 완료 시 completedAt 자동 설정
  if (this.isModified("completed")) {
    if (this.completed && !this.completedAt) {
      this.completedAt = new Date();
    } else if (!this.completed) {
      this.completedAt = null;
    }
  }

  next();
});

// 업데이트 시 version 증가
todoSchema.pre(["updateOne", "findOneAndUpdate"], function (next) {
  this.set({
    $inc: { version: 1 },
  });
  next();
});

// ===== 인스턴스 메서드 =====

/**
 * 할일 완료/미완료 토글
 */
todoSchema.methods.toggle = async function () {
  this.completed = !this.completed;
  return await this.save();
};

/**
 * 우선순위 변경
 */
todoSchema.methods.setPriority = async function (priority) {
  this.priority = priority;
  return await this.save();
};

/**
 * 태그 추가
 */
todoSchema.methods.addTag = async function (tag) {
  if (!this.tags.includes(tag.toLowerCase())) {
    this.tags.push(tag.toLowerCase());
    return await this.save();
  }
  return this;
};

/**
 * 태그 제거
 */
todoSchema.methods.removeTag = async function (tag) {
  this.tags = this.tags.filter((t) => t !== tag.toLowerCase());
  return await this.save();
};

/**
 * 소프트 삭제
 */
todoSchema.methods.softDelete = function () {
  this.isActive = false;
  return this.save();
};

/**
 * 복원
 */
todoSchema.methods.restore = function () {
  this.isActive = true;
  return this.save();
};

// ===== 정적 메서드 =====

/**
 * 사용자의 할일 목록 조회
 */
todoSchema.statics.findByUser = function (userId, options = {}) {
  const query = this.find({
    userId: String(userId),
    isActive: true,
  });

  if (options.completed !== undefined) {
    query.where("completed", options.completed);
  }

  if (options.priority) {
    query.where("priority", options.priority);
  }

  if (options.category) {
    query.where("category", options.category);
  }

  if (options.tags && options.tags.length > 0) {
    query.where("tags").in(options.tags);
  }

  return query
    .sort(options.sort || { createdAt: -1 })
    .limit(options.limit || 0);
};

/**
 * 오늘 마감인 할일 조회
 */
todoSchema.statics.findDueToday = function (userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return this.find({
    userId: String(userId),
    isActive: true,
    completed: false,
    dueDate: {
      $gte: today,
      $lt: tomorrow,
    },
  }).sort("dueDate");
};

/**
 * 지연된 할일 조회
 */
todoSchema.statics.findOverdue = function (userId) {
  return this.find({
    userId: String(userId),
    isActive: true,
    completed: false,
    dueDate: { $lt: new Date() },
  }).sort("dueDate");
};

/**
 * 카테고리별 통계
 */
todoSchema.statics.getCategoryStats = async function (userId) {
  return await this.aggregate([
    {
      $match: {
        userId: String(userId),
        isActive: true,
      },
    },
    {
      $group: {
        _id: "$category",
        total: { $sum: 1 },
        completed: {
          $sum: { $cond: ["$completed", 1, 0] },
        },
        pending: {
          $sum: { $cond: ["$completed", 0, 1] },
        },
      },
    },
    {
      $project: {
        category: "$_id",
        total: 1,
        completed: 1,
        pending: 1,
        completionRate: {
          $multiply: [{ $divide: ["$completed", "$total"] }, 100],
        },
      },
    },
  ]);
};

todoSchema.methods.toggle = async function () {
  this.completed = !this.completed;
  return await this.save();
};

module.exports = mongoose.model("Todo", todoSchema);
