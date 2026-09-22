export const state = {
    // amId 在 state/DB 中为 number，在 DOM dataset 中为 string，比较时用 == 做类型转换是有意为之
    moments: [],          // 当前展示的记录 [{ amId, absTs, data, fetchedAt }]
    latestAmId: 0,        // 已知最大 am 号（轮询发现新动态的 diff 基准，会话内维护）
    _downCursor: '',      // feedSquare 向下翻页游标（'' = 第一页）
    _scrollHandler: null,
    _downLoading: false,
    _noMoreDown: false,
    _upRunning: false,    // 正在拉取最新动态
    _upPollTimer: null,   // 向上定时器
    _upBackoffMs: 0,      // 向上轮询当前退避间隔（空手而归翻倍，命中即复位）
    _upNextAt: 0,         // 早于该时间戳不发起向上轮询
    _upGeneration: 0,     // 向上拉取代数，refresh 时递增使旧响应失效
    emoticonMap: null,    // 表情码→图片 { emotionId: { url, big, name, pkg } }
    emoticonPacks: null,  // 表情面板数据 [{ name, items: [{ id, url, big, name }] }]
};
