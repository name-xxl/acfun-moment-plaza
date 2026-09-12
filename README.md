# AcFun 动态广场

油猴脚本，在 AcFun 个人中心添加「动态广场」功能，按 am 号查找动态并瀑布流展示，用 IndexedDB 做预加载缓存。

## 开发与构建

源码按模块拆分在 `src/` 下（config / state / utils / css / db / api / renderer / background / navigation / controller / events / main），用 esbuild 打包成单文件油猴脚本：

```bash
nvm use 24 && npm install
npm run build    # 产出 list/acfun-moment-plaza.user.js
npm run watch    # 监听 src/ 变更自动重建
```

- `list/acfun-moment-plaza.user.js` 是构建产物，**勿手改**；安装/更新用这个文件。
- 脚本头（`@version`、`@grant` 等）唯一来源是 `src/header.txt`，版本号在这里改。
- 改功能请改 `src/` 下对应模块，然后重新 build。

## 功能特性

- 按 am 号查找动态，向上/向下每次固定加载 20 条
- IndexedDB 本地缓存：预渲染固定内容，赞/评/投蕉数字加载后注入
- 向上后台定时爬取，命中新动态或空手而归时按退避策略调整间隔
- 向下触底懒加载，持续爬到「发布 >24 小时」的动态为止
- 发布 ≤3 小时的动态互动数字显示加载动画并后台刷新，>3 小时直接用缓存
- 评论、回复评论支持表情面板与本地上传图片
- 楼中楼回复显示「回复 @用户名 :」前缀（与原生一致）
- 点赞、投蕉、评论、回复评论、评论点赞/取消赞
- @提及、#话题#、ac号 自动转可点击链接
- 转发动态渲染内容卡片（视频/文章/漫画：封面 + 标题 + 原作者，可点击跳转）
- 数据库保留天数可调（1-7 天），超期自动清除

## 数据存储（IndexedDB）

使用浏览器 IndexedDB 存储动态数据（数据库名 `moment-plaza`）：

- **store `moments`**：key = `amId`（数字），value 结构：
  ```javascript
  {
    amId: 5073277,        // am 号（坐标）
    absTs: 1720000000000, // 绝对发布时间戳（毫秒）
    data: { ... },        // moment/detail 接口返回的完整数据
    fetchedAt: 1720000000000 // 首次抓取时刻
  }
  ```
  另建有 `by_absTs` 索引，用于范围删除过期数据和查最新发布时间。

另有通过 `GM_setValue` 持久化的轻量配置（不存动态数据）：

| Key | 说明 |
|-----|------|
| `moment_plaza_last_am` | 已知最大 am 号（向上探测的坐标） |
| `moment_plaza_keep_days` | 数据库保留天数（1-7，默认 3） |

## 绝对时间戳

`moment/detail` 接口的 `createTime` 在大多数情况下是相对字符串（如 `"13小时前"`），少数场景会返回标准时间。脚本会先尝试按标准时间解析，再回退到相对时长，统一用「抓取时刻 − 已发布时长」反推绝对时间戳，并在**首次抓取时固化**：

```javascript
absTs = fetchedAt - parseAgeMs(createTime)
```

展示时间时用 `absTs` 动态计算（避免缓存里的相对时间字符串过期失真）。

> 关键原则：**am 号只是查找动态的坐标**（不连续、有空洞），判断「是否最新 / 是否落后」一律参考绝对时间戳。

## 预渲染与加载动画

加载界面时（刷新 / 触底 / 进入广场），优先从 IndexedDB 读数据预渲染：

- **固定内容**（文本、图片、用户信息、am 号）：直接从库拉取，秒出。
- **可变数据**（赞 / 评 / 投蕉数字）：
  - 发布 **≤3 小时**：显示 `· → ·· → ···` 加载动画，后台 `fetchMoment` 拉取最新后注入数字。
  - 发布 **>3 小时**：直接采用库里的快照数据，不额外请求。
- 点击评论时，单独触发该条评论请求更新（单条请求）。

## 爬取策略

### 向上（后台定时）

- 定时器（`UP_POLL_INTERVAL`，默认 60s）从 `last_am + 1` 向上探测新动态。
- 命中新动态时把结果存库 + 更新 `last_am`，轮询间隔立即复位到 60s。
- 空手而归时退避翻倍：60s → 120s → 240s → 480s → 封顶 10 分钟，减少夜间空探测。
- 爬到「发布 ≤1 小时」的动态即停止（说明已够新），之后靠用户点击刷新展示最新。
- am 号存在空号断层，会话内记录已探测边界 `_upProbedTo`，断层分多次逐步跨过。

### 向下（触底触发）

- 仅由滚动到底触发，每次固定加载 20 条。
- 数据库充足 → 直接取库预渲染；不足 → 实时抓取补足（原来的逐个探测）。
- 持续爬到「发布 >24 小时」的动态为止，之后标记无更多。

### 粉丝可见跳过

`visibleForFans === true` 的动态在爬取时直接跳过，不存库、不展示，但视为真实存在的动态（重置空号计数，避免连片粉丝可见被误判为空号断层）。

### 参数配置

```javascript
CONFIG = {
    CONCURRENT: 10,        // 并发请求数
    MAX_EMPTY: 30,         // 连续空号上限
    BATCH_SIZE: 20,        // 向上/向下每次固定加载条数
    FRESH_WINDOW_MS: 3h,   // ≤3h 启用加载动画
    UP_STOP_AT_MS: 1h,     // 向上爬到 ≤1h 停
    DOWN_STOP_AFTER_MS: 24h, // 向下爬到 >24h 停
    UP_POLL_INTERVAL: 60s, // 向上轮询基准间隔（空手而归翻倍，封顶 10 分钟）
    KEEP_DAYS_DEFAULT: 3,  // 默认保留天数
}
```

## 保留天数

- 数据库默认保留 3 天，可在首次设置框或广场工具栏的下拉框调整为 1-7 天。
- 超期的动态按 `absTs` 自动清除（启动时 + 定时执行）。

## API 接口

### 获取单条动态

```
GET https://www.acfun.cn/rest/pc-direct/moment/detail?momentId={amId}
```

**响应字段：**
```json
{
  "result": 0,
  "moment": {
    "momentId": "5073210",
    "text": "动态文字内容（含UBB表情 [emot=acfun,1673/]）",
    "createTime": "40分钟前",
    "likeCount": 7,
    "commentCount": 5,
    "bananaCount": 6,
    "isLike": true,
    "isThrowBanana": false,
    "visibleForFans": false,
    "imgs": [
      {
        "url": "https://tx-free-imgs.acfun.cn/...?imageView2/5/w/224/h/224/q/75",
        "originUrl": "https://tx-free-imgs.acfun.cn/...jpeg",
        "width": 2400,
        "height": 1080
      }
    ],
    "user": {
      "id": "73324359",
      "name": "用户名",
      "headUrl": "头像URL",
      "headCdnUrls": [{"url": "CDN头像URL"}],
      "nameColor": 2
    }
  }
}
```

**注意事项：**
- 带 cookie 请求时返回 `isLike`、`isThrowBanana` 字段
- 不带 cookie 时这两个字段为 `undefined`
- 图片字段为 `imgs`（数组），每项包含 `url`（缩略图）、`originUrl`（原图）
- `nameColor`: 1=红色（默认），2=紫色

### 点赞动态

```
POST https://kuaishouzt.com/rest/zt/interact/add
Content-Type: application/x-www-form-urlencoded
```

**参数：**
```
objectId={am号}
objectType=10          （动态类型，视频=2）
userId={当前用户ID}
interactType=1
kpn=ACFUN_APP
kpf=PC_WEB
subBiz=mainApp
acfun.midground.api_st={token}   （需要先获取）
```

**获取 token：**
```
POST https://id.app.acfun.cn/rest/web/token/get
Content-Type: application/x-www-form-urlencoded

body: sid=acfun.midground.api

响应: { "result": 0, "acfun.midground.api_st": "xxx", "ssecurity": "xxx", "userId": 12345 }
```

- token 有效期约 30 分钟
- 需要带 cookie（登录态）
- `@connect` 需要添加 `id.app.acfun.cn` 和 `kuaishouzt.com`

### 取消点赞

```
POST https://kuaishouzt.com/rest/zt/interact/delete
Content-Type: application/x-www-form-urlencoded
```

参数同点赞接口。

### 投蕉

```
POST https://www.acfun.cn/rest/pc-direct/banana/throwBanana
Content-Type: application/x-www-form-urlencoded
Referer: https://www.acfun.cn/moment/am{amId}
```

**参数：**
```
resourceId={am号}
count=1
resourceType=10        （动态类型，视频=2）
```

**注意事项：**
- 不能给自己投蕉（返回 `result: 170008, error_msg: "禁止投蕉"`）
- 需要带 cookie

### 获取评论列表

```
GET https://www.acfun.cn/rest/pc-direct/comment/list?sourceId={amId}&sourceType=4&cursor=&count=10
```

**响应字段：**
```json
{
  "result": 0,
  "rootComments": [
    {
      "commentId": 807023252,
      "userName": "用户名",
      "userId": 74320663,
      "content": "评论内容 [emot=acfun,2797/]",
      "likeCount": 1,
      "postDate": "3小时前",
      "floor": 5,
      "isLiked": false,
      "isUp": true,
      "nameColor": 1,
      "deviceModel": "iPhone 15",
      "headUrl": [{"url": "头像URL"}],
      "userHeadImgInfo": {"thumbnailImageCdnUrl": "头像CDN URL"}
    }
  ],
  "subCommentsMap": {
    "807023252": {
      "pcursor": "no_more",
      "subComments": [...]
    }
  },
  "pcursor": "no_more"
}
```

**注意事项：**
- `sourceType=4` 是动态类型
- 子评论（楼中楼）在 `subCommentsMap[commentId].subComments`
- `headUrl[0].url` 或 `userHeadImgInfo.thumbnailImageCdnUrl` 获取头像
- 评论内容含 UBB 表情码 `[emot=acfun,2797/]`

### 评论图片上传

评论图片通过 kuaishouzt 网关分片上传，共 4 步：

1. **获取 upload_token**
   ```
   POST https://www.acfun.cn/rest/pc-direct/image/upload/getToken
   Content-Type: application/x-www-form-urlencoded

   fileName=image.png
   ```
   响应：`{ result: 0, info: { token: "..." } }`

2. **分片上传（每片 1MB）**
   ```
   POST https://upload.kuaishouzt.com/api/upload/fragment?upload_token={token}&fragment_id={i}
   Content-Type: application/octet-stream
   Content-Range: bytes {start}-{end}/{total}
   ```
   响应：`{ result: 1 }`

3. **完成上传**
   ```
   POST https://upload.kuaishouzt.com/api/upload/complete?upload_token={token}&fragment_count={N}
   ```
   响应：`{ result: 1 }`

4. **换取可访问 URL**
   ```
   POST https://www.acfun.cn/rest/pc-direct/image/upload/getUrlAfterUpload
   Content-Type: application/x-www-form-urlencoded

   token={token}&bizFlag=web-comment-text
   ```
   响应中的 `url` 带签名参数，**永久 URL 需去掉 query**，只保留 `https://preview.ndcsk.com/ksc2/...` 路径部分。

### 发评论

```
POST https://www.acfun.cn/rest/pc-direct/comment/add
Content-Type: application/x-www-form-urlencoded
```

**参数：**
```
sourceId={am号}
sourceType=4
content={评论内容}
replyToCommentId={回复的评论ID}   （可选，不传则为新评论）
```

需要带 cookie。

### 评论点赞

```
POST https://www.acfun.cn/rest/pc-direct/comment/like
Content-Type: application/x-www-form-urlencoded

body: sourceId={am号}&sourceType=4&commentId={评论ID}
```

### 评论取消赞

```
POST https://www.acfun.cn/rest/pc-direct/comment/unlike
Content-Type: application/x-www-form-urlencoded

body: sourceId={am号}&sourceType=4&commentId={评论ID}
```

## 内容解析

`parseContent()` 函数处理动态/评论文本：

| 格式 | 转换结果 |
|------|---------|
| `[at uid=123]@用户名[/at]` | `<a href="/u/123">@用户名</a>` |
| `#话题#` | `<a href="/search?keyword=话题">#话题#</a>` |
| `ac12345` | `<a href="/a/ac12345">ac12345</a>` |
| `v/ac12345` / `a/ac12345` | 对应链接 |
| `m.acfun.cn/communityCircle/moment/123` | `www.acfun.cn/moment/am123` |
| `[emot=acfun,1673/]` | 有表情映射时为 `<img>`，无映射时显示 `[表情]` |
| `[img=图片]https://...[/img]` | `<img src="https://...">` |

## 跨域配置

油猴脚本需要的 `@connect`：
```
@connect      www.acfun.cn
@connect      id.app.acfun.cn
@connect      kuaishouzt.com
```

## 页面匹配

```
@match        https://www.acfun.cn/member*
```

- `/member*`：注入侧边栏 + 后台定时向上爬取

## 更新日志

### v3.2.7 (2026-09-12)

**修复：**
- 表情请求失败后 `_emoticonPromise` 未重置，导致后续请求永久挂起
- IndexedDB 打开失败后 `_dbPromise` 未重置，导致后续数据库操作永久挂起
- 页面刷新后点击「刷新」可能跳过新动态——向上搜索增加 generation 取消机制
- 侧边栏等待循环定时器未清理（内存泄漏）
- 所有图片 URL 为空时渲染空图片容器

**改进：**
- 持久化 `lastDiscoveryAt`，页面刷新后根据离线时长智能计算初始退避间隔
- 全局 click 事件处理器添加快速路径，容器外点击立即返回
- CSS 拆分为 6 个命名常量，提升可维护性
- 提取 `_refreshOneMoment` 统一单条动态补抓与修复逻辑
- editor 模块常量改为模块私有
