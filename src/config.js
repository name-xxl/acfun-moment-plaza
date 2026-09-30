export const CONFIG = {
    FEED_SQUARE_API: 'https://api-new.app.acfun.cn/rest/app/feed/feedSquare', // 动态广场列表（免登录，每页固定 20 条，pcursor 翻页）
    MOMENT_API: 'https://www.acfun.cn/rest/pc-direct/moment/detail',           // 单条动态详情（互动数字刷新用）

    FRESH_WINDOW_MS: 3 * 3600 * 1000,   // 发布 ≤3 小时 → 互动数字用加载动画 + 后台注入
    DOWN_STOP_AFTER_MS: 24 * 3600 * 1000, // 向下翻到「发布 >24 小时」的动态即停

    UP_POLL_INTERVAL: 60 * 1000,            // 向上后台轮询的基准间隔
    UP_POLL_BACKOFF_MAX_MS: 10 * 60 * 1000, // 向上轮询空手而归后的退避上限

    KEEP_DAYS_DEFAULT: 3,               // 数据库默认保留天数（1-7 可调）

    TOKEN_TTL_MS: 30 * 60 * 1000,       // 互动 API token 有效期
    MAX_IMAGES: 9,                      // 单条动态最多展示的图片数
    BACK_TOP_THRESHOLD: 300,            // 距顶部多少像素显示回顶按钮
    SCROLL_BOTTOM_OFFSET: 300,          // 距底部多少像素判定触底
    NAV_POLL_INTERVAL: 500,             // 等待导航栏出现的轮询间隔
    NAV_POLL_TIMEOUT: 10000,            // 等待导航栏出现的超时
    FEEDS_POLL_INTERVAL: 300,           // 等待 feeds 页内容出现的轮询间隔
    PROMOTION_DELAY_MS: 1000,           // feeds 页推广条延迟出现
    TOAST_DURATION_MS: 1500,            // 分享复制成功提示时长
    COMMENT_PAGE_SIZE: 10,              // 评论列表每页条数
    KEEP_DAYS_OPTIONS: [1, 2, 3, 4, 5, 6, 7], // 保留天数可选项
    UPLOAD_CHUNK_SIZE: 1 * 1024 * 1024, // 评论图片上传分片大小（与原生一致 1M）
    MAX_IMAGE_SIZE: 5 * 1024 * 1024,    // 评论图片大小上限（原生提示 5M）

    REQUEST_TIMEOUT_MS: 15 * 1000,      // 普通 API 请求超时（挂起会卡死翻页/轮询状态位）
    UPLOAD_TIMEOUT_MS: 30 * 1000,       // 图片上传分片请求超时（二进制分片放宽）

    // 其余 API 端点集中登记（与顶部 FEED_SQUARE_API/MOMENT_API 同类，api.js 不再散落字面量）
    COMMENT_API_BASE: 'https://www.acfun.cn/rest/pc-direct/comment',        // /list /add /like /unlike
    EMOTION_API: 'https://www.acfun.cn/rest/pc-direct/emotion/getUserEmotion',
    BANANA_API: 'https://www.acfun.cn/rest/pc-direct/banana/throwBanana',
    UPLOAD_TOKEN_API: 'https://www.acfun.cn/rest/pc-direct/image/upload/getToken',
    UPLOAD_FINISH_API: 'https://www.acfun.cn/rest/pc-direct/image/upload/getUrlAfterUpload',
    UPLOAD_GATEWAY: 'https://upload.kuaishouzt.com',                        // /api/upload/fragment /complete
    TOKEN_API: 'https://id.app.acfun.cn/rest/web/token/get',
    INTERACT_API: 'https://kuaishouzt.com/rest/zt/interact',                // /add /delete
};

export const AUTO_ENTER_KEY = 'moment_plaza_auto_enter';

export const SEL_MAIN_FEEDS = '.ac-member-main .ac-member-feeds';

export const NAME_COLOR_PURPLE = '#964cfd';
export const NAME_COLOR_RED = '#fd4c5c';
