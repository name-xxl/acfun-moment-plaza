# AcFun 动态广场

油猴脚本，在 AcFun 个人中心添加「动态广场」功能，按 am 号查找动态并瀑布流展示，用 IndexedDB 做预加载缓存。

## 功能特性

- 按 am 号查找动态，向上/向下每次固定加载 20 条
- IndexedDB 本地缓存：预渲染固定内容，赞/评/投蕉数字加载后注入
- 向上后台定时爬取（按绝对时间戳判断落后程度）
- 向下触底懒加载，持续爬到「发布 24 小时」的动态为止
- 发布 ≤3 小时的动态互动数字显示加载动画并后台刷新，>3 小时直接用缓存
- 粉丝可见动态默认跳过
- 点赞、投蕉、评论、回复评论、评论点赞/取消赞
- @提及、#话题#、ac号 自动转可点击链接
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
- **store `meta`**：预留的元数据表。

另有通过 `GM_setValue` 持久化的轻量配置（不存动态数据）：

| Key | 说明 |
|-----|------|
| `moment_plaza_last_am` | 已知最大 am 号（向上探测的坐标） |
| `moment_plaza_keep_days` | 数据库保留天数（1-7，默认 3） |

## 绝对时间戳

`moment/detail` 接口的 `createTime` 是相对字符串（如 `"13小时前"`），**不返回绝对时间**。

脚本用「抓取时刻 − 相对时长」反推绝对时间戳，并在**首次抓取时固化**：

```javascript
absTs = fetchedAt - parseRelativeMs(createTime)
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

- 定时器（`UP_POLL_INTERVAL`，默认 60s）检查数据库最新动态的 `absTs`。
- 与当前时间差距 **>1 小时** 时，启动向上爬取（从 `last_am + 1` 逐个探测）。
- 爬到「发布 ≤1 小时」的动态即停止（说明已够新），之后靠用户点击刷新展示最新。
- 爬取结果存库 + 更新 `last_am`，**不自动插入当前列表**。

### 向下（触底触发）

- 仅由滚动到底触发，每次固定加载 20 条。
- 数据库充足 → 直接取库预渲染；不足 → 实时抓取补足（原来的逐个探测）。
- 持续爬到「发布 >24 小时」的动态为止，之后标记无更多。

### 粉丝可见跳过

`visibleForFans === true` 的动态在爬取时直接跳过，不存库、不展示、不影响空号计数。

### 参数配置

```javascript
CONFIG = {
    CONCURRENT: 10,        // 并发请求数
    MAX_EMPTY: 30,         // 连续空号上限
    BATCH_SIZE: 20,        // 向上/向下每次固定加载条数
    FRESH_WINDOW_MS: 3h,   // ≤3h 启用加载动画
    UP_STOP_AT_MS: 1h,     // 向上爬到 ≤1h 停
    DOWN_STOP_AFTER_MS: 24h, // 向下爬到 >24h 停
    UP_POLL_INTERVAL: 60s, // 向上定时检查间隔
    UP_POLL_GAP_MS: 1h,    // 落后 >1h 才向上爬
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
| `[emot=acfun,1673/]` | `[表情]` 占位 |

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
@match        https://www.acfun.cn/moment/*
```

- `/member*`：注入侧边栏 + 后台定时向上爬取
- `/moment/*`：动态详情页（脚本也可运行）
