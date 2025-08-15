// const mongoose = require("mongoose");
// mongoose.connect('mongodb://localhost:27017/movies', {useNewUrlParser: true,useUnifiedTopology: true});
// module.exports = mongoose;

const mongoose = require("mongoose");

// 连接MongoDB数据库
mongoose.connect('mongodb://localhost:27017/movies', {
  // 新版Mongoose中这些选项大多已默认启用，可根据实际版本调整
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// 获取数据库连接实例
const db = mongoose.connection;

// 监听连接成功
db.on('connected', () => {
  console.log('Mongoose 连接成功');
});

// 监听连接错误
db.on('error', (err) => {
  console.error('Mongoose 连接错误:', err);
});

// 监听连接断开
db.on('disconnected', () => {
  console.log('Mongoose 连接断开');
});

// 处理应用退出时的连接关闭
process.on('SIGINT', () => {
  db.close(() => {
    console.log('应用退出，关闭Mongoose连接');
    process.exit(0);
  });
});

module.exports = mongoose;
