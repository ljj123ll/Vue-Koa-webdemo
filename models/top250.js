const mongoose = require("./db");
//和数据库的字段映射
const Top250Schema = new mongoose.Schema({
    pic: String,
    title: String,
    slogo: String,
    evaluate: String,
    labels: Array,
    rating: String,
    collected: Boolean
})
//通过model获取数据库中对应的表
const Top250Model = mongoose.model("top250",Top250Schema,"top250");
module.exports = Top250Model;