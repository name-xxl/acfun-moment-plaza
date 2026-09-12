export const CONFIG = {
    MOMENT_API: 'https://www.acfun.cn/rest/pc-direct/moment/detail',
    CONCURRENT: 10,        // 并发请求数
    MAX_EMPTY: 30,         // 连续空号上限
    BATCH_SIZE: 20,        // 向上/向下每次加载的固定条数

    FRESH_WINDOW_MS: 3 * 3600 * 1000,   // 发布 ≤3 小时 → 互动数字用加载动画 + 后台注入
    UP_STOP_AT_MS: 1 * 3600 * 1000,     // 向上爬到「发布 ≤1 小时」的动态即停
    DOWN_STOP_AFTER_MS: 24 * 3600 * 1000, // 向下爬到「发布 >24 小时」的动态即停

    UP_POLL_INTERVAL: 60 * 1000,            // 向上后台轮询的基准间隔
    UP_POLL_BACKOFF_MAX_MS: 10 * 60 * 1000, // 向上轮询空手而归后的退避上限

    KEEP_DAYS_DEFAULT: 3,               // 数据库默认保留天数（1-7 可调）

    CRAWL_BATCH_DELAY_MS: 60,           // 爬取批次之间的停顿
    SCAN_LIMIT_MULTIPLIER: 50,          // 单次爬取的扫描上限 = 目标条数 × 此倍数
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
    UP_CRAWL_TARGET: 50,                // 向上后台爬取的目标条数
    KEEP_DAYS_OPTIONS: [1, 2, 3, 4, 5, 6, 7], // 保留天数可选项
    UPLOAD_CHUNK_SIZE: 1 * 1024 * 1024, // 评论图片上传分片大小（与原生一致 1M）
    MAX_IMAGE_SIZE: 5 * 1024 * 1024,    // 评论图片大小上限（原生提示 5M）
};

export const LAST_AM_KEY = 'moment_plaza_last_am';
export const KEEP_DAYS_KEY = 'moment_plaza_keep_days';
export const AUTO_ENTER_KEY = 'moment_plaza_auto_enter';
export const LAST_DISCOVERY_KEY = 'moment_plaza_last_discovery';

export const SEL_MAIN_FEEDS = '.ac-member-main .ac-member-feeds';

export const NAME_COLOR_PURPLE = '#964cfd';
export const NAME_COLOR_RED = '#fd4c5c';
