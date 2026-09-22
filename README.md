# AcFun 动态广场

油猴脚本，在 AcFun 个人中心添加「动态广场」功能，用官方 feedSquare 列表接口拉取全站最新动态瀑布流展示，用 IndexedDB 做数据留存。

## 开发与构建

源码按模块拆分在 `src/` 下（config / state / utils / css / db / api / emotpanel / renderer / background / navigation / controller / events / main），用 esbuild 打包成单文件油猴脚本：

```bash
nvm use 24 && npm install
npm run build    # 产出 list/acfun-moment-plaza.user.js
npm run watch    # 监听 src/ 变更自动重建
```

- `list/acfun-moment-plaza.user.js` 是构建产物，**勿手改**；安装/更新用这个文件。
- 脚本头（`@version`、`@grant` 等）唯一来源是 `src/header.txt`，版本号在这里改。
- 改功能请改 `src/` 下对应模块，然后重新 build。

## 功能特性

- 基于 feedSquare 列表接口：进入即拉最新一页，触底按 pcursor 续翻更旧一页（每页固定 20 条）
- 向下翻到「发布 >24 小时」的动态为止；feedSquare 服务端已过滤粉丝可见
- 向上后台定时轮询最新一页，发现新动态提示刷新，空手而归按退避策略调整间隔
- 发布 ≤3 小时的动态互动数字显示加载动画并用 `moment/detail` 后台刷新，>3 小时直接用列表快照
- 评论、回复评论支持表情面板与本地上传图片；表情面板对齐原生样式（底部包切换条），含最近使用（本地记 12 个）、悬停大图预览与图片懒加载
- 评论区对齐原生：赞/回复按钮用原生 13px SVG 图标（含红态）、楼中楼用户名内联彩色、间距与原生一致；头像框（avatarFrameImgInfo）以覆盖层渲染
- 楼中楼回复显示「回复 @用户名 :」前缀（与原生一致）
- 点赞、投蕉、评论、回复评论、评论点赞/取消赞
- @提及、#话题#、ac号 自动转可点击链接
- 数据库保留天数可调（1-7 天），超期自动清除

> v3.3.0 起数据源为 feedSquare，该接口只返回纯动态（实测 1000 条样本 resourceType 全为 10），**转发动态不再出现在广场中**；旧版逐号探测方案已移除。

## 数据源与原理

### feedSquare 列表接口（核心数据源）

```
GET https://api-new.app.acfun.cn/rest/app/feed/feedSquare?pcursor={cursor}
```

- 免登录、免 header，单页固定 20 条（`Num` 参数无效），按发布时间降序
- `pcursor` 是分页游标：首页不传，后续传上一次响应的 `pcursor`；翻到底返回 `"no_more"`
- 游标是 `时间戳:时间戳` 格式，实测手工构造可跳到任意时间点
- 历史深度实测约 53~54 小时，远超「展示 24 小时」的需求
- 服务端已过滤粉丝可见动态；不含转发动态；`isLike`/`isThrowBanana` 不带登录态恒为 false（互动状态以 `moment/detail` 刷新为准）
- **`createTime` 直接是绝对时间戳（毫秒）**，无需反推

feed 顶层的互动数字（`likeCount`/`commentCount`/`bananaCount`）与用户信息（`user`/`userInfo`）由 `_squareFeedToRecord` 映射成 `moment/detail` 的记录结构（`absTs = createTime`），渲染层无需感知数据来源。

### 单条动态接口（互动刷新用）

`moment/detail` 保留两个用途：新鲜动态（≤3h）的互动数字注入（带 cookie 可得真实 `isLike`）、评论展开时的单条刷新。其 `createTime` 仍可能是相对字符串（如 `"13小时前"`），`computeAbsTs` 作为兜底反推。

## 数据存储（IndexedDB）

使用浏览器 IndexedDB 存储动态数据（数据库名 `moment-plaza`）：

- **store `moments`**：key = `amId`（数字），value 结构：
  ```javascript
  {
    amId: 5073277,        // am 号
    absTs: 1720000000000, // 绝对发布时间戳（毫秒）
    data: { ... },        // feedSquare/detail 接口返回的动态数据
    fetchedAt: 1720000000000 // 抓取时刻
  }
  ```
  另建有 `by_absTs` 索引，用于范围删除过期数据。

展示数据流直接走接口实时渲染，IndexedDB 仅作留存（写入 + 按保留天数清理 + 单条更新），不再作为渲染数据源。

另有通过 `GM_setValue` 持久化的轻量配置（不存动态数据）：

| Key | 说明 |
|-----|------|
| `moment_plaza_keep_days` | 数据库保留天数（1-7，默认 3） |
| `moment_plaza_last_discovery` | 最近一次发现新动态的时间戳（计算初始退避间隔） |
| `moment_plaza_auto_enter` | 跳转 feeds 页后自动进入广场的标记 |

## 爬取策略

### 向上（后台定时发现新动态）

- 定时器（`UP_POLL_INTERVAL`，默认 60s）拉一次 feedSquare 第一页。
- 与会话内已知的最大 am 号 diff，出现更大号 → 入库 + 更新基准 + 提示「↑发现 N 条新动态，点击刷新」，退避复位。
- 无新动态时按退避翻倍：60s → 120s → 240s → 480s → 封顶 10 分钟，减少夜间空探测。
- 接口失败与空手而归同样走退避；`lastDiscoveryAt` 持久化，页面刷新后按离线时长计算初始退避。

### 向下（触底翻页）

- 仅由滚动到底触发，用 `state._downCursor` 续翻更旧一页（固定 20 条）。
- 过滤已在列表中的 amId 与「发布 >24 小时」的记录；翻到 `no_more` 或越过 24h 下限即标记无更多。
- 翻页失败不置「无更多」，下次触底自动重试。

### 参数配置

```javascript
CONFIG = {
    FRESH_WINDOW_MS: 3h,   // ≤3h 启用加载动画
    DOWN_STOP_AFTER_MS: 24h, // 向下翻到 >24h 停
    UP_POLL_INTERVAL: 60s, // 向上轮询基准间隔（空手而归翻倍，封顶 10 分钟）
    KEEP_DAYS_DEFAULT: 3,  // 默认保留天数
}
```

## 保留天数

- 数据库默认保留 3 天，可在广场工具栏的下拉框调整为 1-7 天（首次设置框已随旧方案移除）。
- 超期的动态按 `absTs` 自动清除（启动时 + 定时执行）。

## API 接口

### feedSquare 列表（数据源）

```
GET https://api-new.app.acfun.cn/rest/app/feed/feedSquare?pcursor={cursor}
```

**响应字段（节选）：**
```json
{
  "result": 0,
  "pcursor": "1790086372216:1790085315795",
  "feedList": [
    {
      "resourceType": 10,
      "createTime": 1790086372215,
      "likeCount": 7,
      "commentCount": 5,
      "bananaCount": 6,
      "isLike": false,
      "isThrowBanana": false,
      "user": { "userId": 73324359, "userName": "用户名", "userHead": "头像URL", "nameColor": 2 },
      "moment": {
        "momentId": "5093540",
        "text": "动态文字内容（含UBB表情 [emot=acfun,1673/]）",
        "replaceUbbText": "...",
        "visibleForFans": false,
        "originResourceType": 0,
        "imgs": [
          { "url": "缩略图", "originUrl": "原图", "width": 2400, "height": 1080 }
        ]
      }
    }
  ]
}
```

**注意事项：**
- `createTime` 是绝对时间戳（毫秒），不是相对时间字符串
- 互动数字在 feed 顶层，`moment` 内没有 `likeCount`
- `pcursor` 返回 `"no_more"` 表示翻到底；首页请求不传 `pcursor`
- 单页固定 20 条，`Num` 参数无效

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
@connect      api-new.app.acfun.cn
@connect      id.app.acfun.cn
@connect      kuaishouzt.com
```

## 页面匹配

```
@match        https://www.acfun.cn/member*
```

- `/member*`：注入侧边栏 + 后台定时拉最新动态

## 更新日志

### v3.4.0 (2026-09-23)

**表情面板展示层重构 + 评论区对齐原生（数据链路不变）：**

**表情面板（对齐原生评论框表情面板）：**

- 布局改为原生三段式：顶部当前包名、中间 6 列大格子网格（56px 格，独立滚动）、底部灰底包切换条（36px 包缩略图，选中放大到 46px；两端 ‹/› 箭头按滚动位置显隐，各翻一屏）
- 包切换从「所有包竖向堆叠靠滚动翻找」改为单包渲染 + 底部缩略图切换；选中包按包名记忆（不受「最近使用」虚拟包插入影响）
- 最近使用：选中表情记入 localStorage（`plaza_emot_recent_v1`，最多 12 个），作为切换条首个虚拟包展示，多个评论框间同步
- 悬停大图预览：悬停显示 120px 大图 + 表情名（大图取 `emotionImageBigUrl`，原生页缓存无大图时退回小图）
- 图片懒加载：网格与包缩略图均 `loading="lazy"`，不再打开面板即全量请求
- 面板结构改为「头部固定 + 网格区独立滚动 + 底部固定」，新增 `src/emotpanel.js` 模块承载面板逻辑
- 网络失败时不再把面板标记为已加载，下次打开自动重试

**评论区（对照原生 moment 页逐项校正）：**

- 赞/回复按钮改用原生 13px SVG 图标（base64 抄自原生页），灰色/悬停红/已赞红三态齐全；补上点击点赞后的 `[active]` 红色态
- 楼中楼用户名不再强制 #333，与根评论一样按 nameColor 内联彩色（红/紫）
- 间距对齐原生：用户名右距 2px、「发表于」右距 0、楼中楼行去掉左右 10px 内缩（头像贴灰底左缘、文字从 40px 起）
- 头像框：评论数据带 `avatarFrameImgInfo` 时在头像上渲染覆盖层（`.plaza-avatar-frame`，80x70 居中略上移），机制同原生 avatar-bg；楼中楼不展示头像框（同原生）
- 去掉自创的红色「UP主」tag：原生没有的元素不加
- 评论项补上原生就有的 `data-commentid` / `data-userid` 属性，AcFun-Web-IP 等基于原生评论 DOM 的脚本可直接在广场生效

### v3.3.0 (2026-09-22)

**重构：数据源从「逐号探测」切换为官方 feedSquare 列表接口**

- 新增 `fetchFeedSquare`：免登录列表接口，单请求拿 20 条动态，pcursor 链式翻页（实测无页数限制、零重复），`createTime` 直接是绝对时间戳
- 删除整套逐号探测引擎：`crawlMoments`、并发探测、空号断层处理、粉丝可见跳过、`MAX_EMPTY`/`SCAN_LIMIT_MULTIPLIER` 等配置
- 删除 v3.2.8/3.2.9 的快速定位算法（`_fastForward`/`_locateFrontier` 速率外推/探针收敛）：拉第一页即最新，无需定位边界
- 向上轮询改为「拉第一页 + diff 最大 am 号」，退避策略保留
- 向下翻页改为 pcursor 续翻；翻到 `no_more` 或越过 24h 展示下限即止
- 删除首次使用设置框与 `moment_plaza_last_am`：feedSquare 无需 am 号起点，装完即用
- IndexedDB 不再作为渲染数据源（接口单页 <500ms），仅作留存与清理
- 请求量降 95%+（原先抓 20 条需 20~100 个 detail 请求，现在 1 个）
- **行为变化：feedSquare 只返回纯动态（实测 1000 条样本无转发），广场不再展示转发动态**；历史深度依赖接口的 ~53h 缓存（>24h 展示需求仍有 2 倍余量）
- 互动状态（isLike 等）feedSquare 不带登录态不可信，仍由 `moment/detail` 的 `_refreshOneMoment` 管线刷新（≤3h 新鲜动态）

### v3.2.9 (2026-09-12)

**修复：**
- v3.2.8 的快速定位实际找不到最新动态。固定 50k 盲跳步长远超真实增速（实测约 920 号/天，50k 相当于 54 天的号段），第一跳就越过边界，后续 250k → 1.25M 全部落空；回退的逐号爬取扫描上限仅 2500 号，同样够不到边界，于是刷新后仍显示旧数据

**改进：**
- 快速定位改为「时间 → am 号」外推：用本地记录的号差 ÷ 时间差测出增长速率，直接跳到「此刻」对应的 am 号，跳跃距离随实际离线时长自适应，近处不会被一步跨过
- 探针采样宽度按速率换算（覆盖 10 分钟内容），速率未知时才退回 5 个号的最小宽度
- 落空即在 `[已确认有数据, 已确认越界]` 区间内收敛，命中旧数据则用新锚点修正速率继续外推
- 定位到边界后向下收一批（50 条）再渲染，而不是只存命中的那一条
- 实测：速率可测时 1 轮探针 / 0.5s 命中（误差 56 号）；本地时间戳只有日期粒度、速率不可测时 4 轮 / 2.3s 命中

### v3.2.8 (2026-09-12)

**新功能：**
- 刷新时指数跳跃快速定位：数据超过 2 小时未更新时，自动从 `last_am` 起按指数步长（50k → 250k → ...）跳跃探测，每步采样 5 个 ID 避免空号误判，找到最新动态后立即渲染，无需等待逐号爬取

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
