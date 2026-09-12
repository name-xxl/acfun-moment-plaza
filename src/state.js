export const state = {
    // amId 在 state/DB 中为 number，在 DOM dataset 中为 string，比较时用 == 做类型转换是有意为之
    moments: [],          // 当前展示的记录 [{ amId, absTs, data, fetchedAt }]
    latestAmId: 0,        // 已知最大 am 号（向上探测边界，持久化）
    oldestAmId: 0,        // 当前展示最旧 am 号
    _scrollHandler: null,
    _downLoading: false,
    _noMoreDown: false,
    _upRunning: false,    // 正在向上爬取
    _upPollTimer: null,   // 向上定时器
    _upBackoffMs: 0,      // 向上轮询当前退避间隔（空手而归翻倍，命中即复位）
    _upNextAt: 0,         // 早于该时间戳不发起向上爬取
    _upProbedTo: 0,       // 本次会话已向上探测到的最高 am 号（跨空号断层用，页面刷新后重探）
    _upGeneration: 0,     // 向上搜索代数，refresh 时递增使旧搜索回调失效
    emoticonMap: null,    // 表情码→图片 { emotionId: { url, pkg } }
    emoticonPacks: null,  // 表情面板数据 [{ name, items: [{ id, url }] }]
};
