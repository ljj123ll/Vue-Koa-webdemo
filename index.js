const Koa = require("koa");
const Router = require("@koa/router");
const cors = require("koa2-cors");
const { Types } = require("mongoose");
const Top250Model = require("./models/top250");
const UserModel = require('./models/user');
// 新增必要模块
const { koaBody } = require('koa-body');
const path = require("path"); // 处理路径
const fs = require("fs"); // 处理文件
const static = require("koa-static"); // 静态文件服务


// 实例化应用和路由
const app = new Koa();
const router = new Router();

// 配置静态文件目录（存放上传的海报）
const staticDir = path.join(__dirname, "static");
if (!fs.existsSync(staticDir)) {
  fs.mkdirSync(staticDir, { recursive: true }); // 确保目录存在
}


// 中间件配置（顺序：先处理文件上传，再跨域）
app.use(koaBody({
  multipart: true, // 允许解析multipart/form-data（必须）
  formidable: {
    uploadDir: staticDir, // 临时上传目录
    keepExtensions: true, // 保留文件扩展名
    maxFieldsSize: 2 * 1024 * 1024, // 限制文件大小（2MB）
  }
}));

// 跨域配置
app.use(cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"]
}));

// 静态文件服务（访问上传的图片）
app.use(static(staticDir));

// 全局错误处理
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.status = err.status || 500;
    ctx.body = {
      code: ctx.status,
      msg: err.message || "服务器内部错误"
    };
  }
});

// 其他路由（收藏、取消收藏、删除、分页获取列表）保持不变...
// 路由定义
// 1. 获取电影列表
// router.get("/top250", async ctx => {
//   try {
//     const data = await Top250Model.find();
//     ctx.body = {
//       code: 200,
//       res: data,
//       msg: "GET /top250 success"
//     };
//   } catch (err) {
//     ctx.throw(500, "获取数据失败：" + err.message);
//   }
// });

// 2. 收藏电影
router.post("/collect", async ctx => {
  try {
    const { id } = ctx.request.body;
    if (!id) {
      ctx.throw(400, "缺少电影ID");
    }
    // 关键修复：添加new关键字实例化ObjectId
    const objectId = new Types.ObjectId(id);  // 这里添加new
    const res = await Top250Model.updateOne(
      { _id: objectId, collected: false },
      { collected: true }
    );
    if (res.modifiedCount > 0) {
      ctx.body = { code: 200, msg: "收藏成功" };
    } else {
      ctx.body = { code: 400, msg: "已收藏，无需重复操作" };
    }
  } catch (err) {
    ctx.throw(500, "收藏失败：" + err.message);
  }
});

// 3. 取消收藏
router.post("/collect/cancel", async ctx => {
  try {
    const { id } = ctx.request.body;
    if (!id) {
      ctx.throw(400, "缺少电影ID");
    }
    // 关键修复：添加new关键字
    const objectId = new Types.ObjectId(id);  // 这里添加new
    const res = await Top250Model.updateOne(
      { _id: objectId, collected: true },
      { collected: false }
    );
    if (res.modifiedCount > 0) {
      ctx.body = { code: 200, msg: "取消收藏成功" };
    } else {
      ctx.body = { code: 400, msg: "未收藏，无需取消" };
    }
  } catch (err) {
    ctx.throw(500, "取消收藏失败：" + err.message);
  }
});


// 4. 删除电影
router.post("/delete", async ctx => {
  try {
    const { id } = ctx.request.body;
    if (!id) {
      ctx.throw(400, "缺少电影ID");
    }
    // 转换id为ObjectId（与收藏功能保持一致）
    const objectId = new Types.ObjectId(id);
    // 执行删除操作
    const res = await Top250Model.deleteOne({ _id: objectId });
    
    if (res.deletedCount > 0) {
      ctx.body = { code: 200, msg: "删除成功" };
    } else {
      ctx.throw(404, "电影不存在或已删除");
    }
  } catch (err) {
    ctx.throw(500, "删除失败：" + err.message);
  }
});


// 修改获取电影列表的路由，支持搜索
router.get("/top250", async ctx => {
  try {
    const { start = 0, limit = 15, search = "" } = ctx.query; 
    const skip = Number(start);
    const pageSize = Number(limit);
    const searchQuery = search.trim();

    // 构建查询条件，如果有搜索词则添加模糊匹配
    let query = {};
    if (searchQuery) {
      query.title = { $regex: searchQuery, $options: 'i' }; // i表示不区分大小写
    }

    const data = await Top250Model.find(query)
      .skip(skip)
      .limit(pageSize);

    const total = await Top250Model.countDocuments(query);

    ctx.body = {
      code: 200,
      res: data,
      total: total,
      start: skip,
      limit: pageSize,
      msg: searchQuery ? `搜索"${searchQuery}"成功` : "GET /top250 success"
    };
  } catch (err) {
    ctx.throw(500, "获取数据失败：" + err.message);
  }
});

// 新增电影路由（修正后）
router.post("/doAdd", async ctx => {
  try {
    // 打印表单数据（调试用）
    console.log("表单数据：", ctx.request.body);
    console.log("上传文件：", ctx.request.files);

    // 获取表单字段（现在能正确获取了）
    const { title, slogo, evaluate, rating, collected, year } = ctx.request.body;
    
    // 处理标签：合并年份 + 国家 + 类型
    // 1. 验证年份必填
    if (!year) {
      ctx.throw(400, "上映年份为必填项");
    }
    // 2. 获取国家和类型标签（原label字段）
    let typeLabels = ctx.request.body.label;
    typeLabels = typeLabels ? (Array.isArray(typeLabels) ? typeLabels : [typeLabels]) : [];
    // 3. 合并年份到labels数组（年份放在最前面）
    const labels = [year.toString(), ...typeLabels]; // 年份转为字符串，与其他标签统一格式
    
    // 验证必填项（现在能正确判断了）
    if (!title?.trim() || !rating) {
      ctx.throw(400, "电影名和评分为必填项");
    }
    
    // 处理上传的图片
    const file = ctx.request.files?.file;
    if (!file) {
      ctx.throw(400, "请上传电影海报");
    }
    
    // 重命名文件（避免冲突）
    const extname = path.extname(file.originalFilename);
    const newFilename = `${Date.now()}${extname}`;
    const oldPath = file.filepath; // 临时路径
    const newPath = path.join(staticDir, newFilename);
    fs.renameSync(oldPath, newPath); // 移动文件
    
    // 构建图片URL
    const picUrl = `http://localhost:8080/${newFilename}`;
    
    // 保存到数据库
    const newMovie = new Top250Model({
      title,
      pic: picUrl,
      slogo: slogo || "",
      evaluate: Number(evaluate) || 0,
      rating: Number(rating),
      // 这里存入的是[年份, 国家1, 国家2, 类型1, 类型2...]
      labels,
      collected: collected === "true" // 转换为布尔值
    });
    await newMovie.save();
    
    ctx.body = { code: 200, msg: "添加成功", data: newMovie };
  } catch (err) {
    console.error("添加失败：", err);
    ctx.throw(500, "添加电影失败：" + err.message);
  }
});

// 新增：获取电影详情接口
router.get("/detail", async ctx => {
    try {
        const { id } = ctx.query;  // 从URL参数中获取电影ID
        
        // 验证ID有效性
        if (!id || !Types.ObjectId.isValid(id)) {
            ctx.throw(400, "无效的电影ID");
        }
        
        // 查询数据库
        const movie = await Top250Model.findById(new Types.ObjectId(id));
        
        if (!movie) {
            ctx.throw(404, "电影不存在");
        }
        
        // 返回数据
        ctx.body = {
            code: 200,
            res: movie,
            msg: "获取详情成功"
        };
    } catch (err) {
        console.error("详情接口错误：", err);
        ctx.throw(500, "获取电影详情失败：" + err.message);
    }
});

// 新增：更新电影信息接口（仅更新名称和标语）
router.post("/update", async ctx => {
  try {
    const { id, title, slogo } = ctx.request.body;
    
    // 验证参数
    if (!id) {
      ctx.throw(400, "缺少电影ID");
    }
    if (!title?.trim()) {
      ctx.throw(400, "电影名称不能为空");
    }
    
    // 转换ID为ObjectId
    const objectId = new Types.ObjectId(id);
    
    // 执行更新操作（仅更新title和slogo字段）
    const res = await Top250Model.updateOne(
      { _id: objectId },
      { 
        title: title.trim(), 
        slogo: slogo || ""  // 允许标语为空
      }
    );
    
    if (res.modifiedCount > 0) {
      ctx.body = { code: 200, msg: "更新成功" };
    } else {
      ctx.throw(404, "电影不存在或未做任何修改");
    }
  } catch (err) {
    console.error("更新失败：", err);
    ctx.throw(500, "更新电影信息失败：" + err.message);
  }
});



// 新增注册接口
router.post('/register', async ctx => {
  try {
    const { username, email, password } = ctx.request.body;

    // 基本验证
    if (!username || !email || !password) {
      ctx.throw(400, '用户名、邮箱和密码均为必填项');
    }
    if (password.length < 6) {
      ctx.throw(400, '密码长度不能少于6位');
    }

    // 检查用户名和邮箱是否已存在
    const existingUser = await UserModel.findOne({
      $or: [{ username }, { email }]
    });
    if (existingUser) {
      ctx.throw(400, '用户名或邮箱已被注册');
    }

    // 创建新用户
    const user = new UserModel({
      username,
      email,
      password // 会自动通过pre-save钩子加密
    });
    await user.save();

    // 返回用户信息（不含密码）
    const userObj = user.toObject();
    delete userObj.password;
    ctx.body = {
      code: 200,
      msg: '注册成功',
      data: userObj
    };
  } catch (err) {
    ctx.throw(500, '注册失败: ' + err.message);
  }
});

// 新增登录接口
router.post('/login', async ctx => {
  try {
    const { username, password } = ctx.request.body;

    // 基本验证
    if (!username || !password) {
      ctx.throw(400, '用户名和密码均为必填项');
    }

    // 查找用户（支持用邮箱登录）
    const user = await UserModel.findOne({
      $or: [{ username }, { email: username }]
    });
    if (!user) {
      ctx.throw(401, '用户名或密码错误');
    }

    // 验证密码
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      ctx.throw(401, '用户名或密码错误');
    }

    // 返回用户信息（不含密码）
    const userObj = user.toObject();
    delete userObj.password;
    ctx.body = {
      code: 200,
      msg: '登录成功',
      data: userObj
    };
  } catch (err) {
    ctx.throw(500, '登录失败: ' + err.message);
  }
});

// 应用路由
app.use(router.routes());
app.use(router.allowedMethods());

// 启动服务
app.listen(8080, () => {
  console.log("服务器运行在 http://localhost:8080");
});