# AcFun 动态广场

油猴脚本，在 AcFun 个人中心添加「动态广场」功能，按 am 号查找动态并瀑布流展示。

## 功能特性

- 自动从页面提取最新 am 号，持续向上查找新动态
- 向下滚动懒加载历史动态
- 点赞、投蕉、评论、回复评论
- 评论点赞/取消赞
- @提及、#话题#、ac号 自动转可点击链接
- 手机动态链接自动转 web 端链接
- 回到顶部按钮
- 侧边栏导航集成

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

## 智能查找算法

由于 am 号不连续，使用「密集搜索 + 跳跃探测」策略：

1. **密集搜索**：从起始 am 号逐个检查，每批 CONCURRENT(10) 个并行
2. **跳跃探测**：连续找到 JUMP_THRESHOLD(2) 个后，步长增加到 JUMP_STEP_LARGE(20)
3. **空号处理**：连续 MAX_EMPTY(30) 个空号后，跳跃 20 步探测是否有间隔区
4. **到顶判断**：跳跃点也无数据 → 确认到顶，停止查找
5. **结果去重**：返回前按 `_amId` 去重

**参数配置：**
```javascript
CONFIG = {
    CONCURRENT: 10,       // 并发请求数
    MAX_EMPTY: 30,        // 连续空号上限
    BATCH_SIZE: 20,       // 每批加载数量
    JUMP_THRESHOLD: 2,    // 连续N个有数据后开始跳跃
    JUMP_STEP_LARGE: 20,  // 跳跃步长
}
```

## 向上持续查找

- 从已知最大 am 号 +1 开始逐个向上查找
- 找到 20 条新动态后停止
- 到顶后等待 10 秒重试
- 使用发布时间智能调整步长（`createTime` 字段）

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

## 数据存储

仅存储一个值（GM_setValue）：

| Key | 说明 |
|-----|------|
| `moment_plaza_last_am` | 已知最新 am 号 |

所有动态数据实时从 API 获取，不缓存。

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

- `/member*`：注入侧边栏 + 后台向上查找
- `/moment/*`：动态详情页（脚本也可运行）
