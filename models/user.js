// models/user.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// 用户Schema定义
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true, // 用户名唯一
    trim: true,
    minlength: 2,
    maxlength: 20
  },
  email: {
    type: String,
    required: true,
    unique: true, // 邮箱唯一
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ // 邮箱格式验证
  },
  password: {
    type: String,
    required: true,
    minlength: 6 // 密码最小长度
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 保存前加密密码
userSchema.pre('save', async function(next) {
  // 只有密码修改时才重新加密
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.updatedAt = Date.now();
    next();
  } catch (err) {
    next(err);
  }
});

// 验证密码方法
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// 导出模型
module.exports = mongoose.model('User', userSchema);