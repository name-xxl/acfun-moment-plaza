// ==UserScript==
// @name         AcFun 动态广场
// @namespace    https://www.acfun.cn/
// @version      3.0.0
// @description  按am号查找动态，按时间排序显示，IndexedDB 预加载缓存
// @author       name_xxl
// @match        https://www.acfun.cn/member*
// @match        https://www.acfun.cn/moment/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      www.acfun.cn
// @connect      id.app.acfun.cn
// @connect      kuaishouzt.com
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // ===================== 配置 =====================
    const CONFIG = {
        MOMENT_API: 'https://www.acfun.cn/rest/pc-direct/moment/detail',
        CONCURRENT: 10,        // 并发请求数
        MAX_EMPTY: 30,         // 连续空号上限
        BATCH_SIZE: 20,        // 向上/向下每次加载的固定条数

        FRESH_WINDOW_MS: 3 * 3600 * 1000,   // 发布 ≤3 小时 → 互动数字用加载动画 + 后台注入
        UP_STOP_AT_MS: 1 * 3600 * 1000,     // 向上爬到「发布 ≤1 小时」的动态即停
        DOWN_STOP_AFTER_MS: 24 * 3600 * 1000, // 向下爬到「发布 >24 小时」的动态即停

        UP_POLL_INTERVAL: 60 * 1000,        // 向上后台定时检查间隔
        UP_POLL_GAP_MS: 1 * 3600 * 1000,    // 数据库最新动态距今 >1 小时才启动向上爬

        KEEP_DAYS_DEFAULT: 3,               // 数据库默认保留天数（1-7 可调）
    };

    // ===================== 状态 =====================
    const state = {
        moments: [],          // 当前展示的记录 [{ amId, absTs, data, fetchedAt }]
        latestAmId: 0,        // 已知最大 am 号（向上探测边界，持久化）
        oldestAmId: 0,        // 当前展示最旧 am 号
        _scrollHandler: null,
        _downLoading: false,
        _noMoreDown: false,
        _upRunning: false,    // 正在向上爬取
        _upPollTimer: null,   // 向上定时器
        _originalContent: null,
    };

    const LAST_AM_KEY = 'moment_plaza_last_am';
    const KEEP_DAYS_KEY = 'moment_plaza_keep_days';

    // 注入样式 - 完全复用A站原生样式
    const styles = `
        .moment-plaza-container {
            padding: 0 20px;
            width: 870px;
        }

        .moment-plaza-toolbar {
            padding: 10px 16px;
            background: #f8f8f8;
            border-radius: 4px;
            margin-bottom: 20px;
            font-size: 14px;
        }

        .moment-plaza-toolbar .status {
            font-size: 13px;
            color: #999;
        }

        .moment-plaza-list {
            display: flex;
            flex-direction: column;
        }

        /* 完全复用原生 ac-member-feed 样式 */
        .ac-member-feed.moment-plaza-item {
            position: relative;
            margin-top: 30px;
            padding: 0;
            width: 830px;
        }

        .ac-member-feed.moment-plaza-item:first-child {
            margin-top: 0;
        }

        .moment-plaza-item .am-link {
            position: absolute;
            top: 6px;
            right: 0;
            font-size: 12px;
            color: #999;
            text-decoration: none;
            cursor: pointer;
        }

        .moment-plaza-item .am-link:hover {
            color: #fd4c5c;
        }

        /* 原生 feed-up 样式 */
        .member-feed-user .feed-up {
            display: flex;
        }

        .member-feed-user .feed-up-avatar {
            position: relative;
            margin-right: 10px;
        }

        .member-feed-user .feed-up-avatar a {
            display: inline-block;
        }

        .member-feed-user .feed-up-avatar img {
            position: relative;
            width: 50px;
            height: 50px;
            border-radius: 50%;
        }

        .member-feed-user .feed-up-info .up-name {
            display: inline-block;
            margin: 5px 0 6px;
            font-size: 16px;
            color: #333;
            line-height: 18px;
        }

        .member-feed-user .feed-up-info .up-name a {
            max-width: 380px;
            color: inherit;
            text-decoration: none;
        }

        .member-feed-user .feed-up-info .up-name a:hover {
            color: #fd4c5c !important;
        }

        .member-feed-user .feed-up-info .feed-time {
            display: block;
            font-size: 12px;
            color: #999;
            line-height: 12px;
        }

        /* 原生 feed-content 样式 */
        .moment-plaza-item .feed-content {
            padding: 6px 0 0 60px;
        }

        .moment-plaza-item .member-feed-text {
            margin-bottom: 10px;
            font-size: 14px;
            text-align: left;
            color: #333;
            line-height: 21px;
            white-space: pre-line;
        }

        /* 原生图片样式 */
        .moment-plaza-item .member-feed-moment-image {
            margin: 10px 0 -4px;
            width: 342px;
        }

        .moment-plaza-item .member-feed-moment-image img {
            width: 110px;
            height: 110px;
            object-fit: cover;
            border-radius: 3px;
            margin: 0 4px 4px 0;
            cursor: pointer;
        }

        .moment-plaza-item .member-feed-moment-image.member-feed-moment-image-1 {
            width: 299px;
        }

        .moment-plaza-item .member-feed-moment-image.member-feed-moment-image-1 img {
            height: auto;
            width: auto;
            max-width: 299px;
            max-height: 299px;
        }

        .moment-plaza-item .member-feed-moment-image.member-feed-moment-image-2,
        .moment-plaza-item .member-feed-moment-image.member-feed-moment-image-4 {
            width: 228px;
        }

        /* 原生互动区样式 */
        .member-feed-interactive .feed-interactive {
            display: flex;
            height: 48px;
            margin: 4px 0 0 60px;
        }

        .member-feed-interactive .feed-interactive > div {
            margin-right: 42px;
            font-size: 12px;
            color: #999;
            line-height: 48px;
            cursor: pointer;
        }

        .member-feed-interactive .feed-interactive > div:hover {
            color: #fd4c5d;
        }

        .feed-interactive .ac-icon {
            width: 14px;
            height: 14px;
            margin-right: 6px;
            transform: translateY(1px);
        }

        .feed-interactive .ac-icon .iconfont {
            font-size: 14px;
            color: #999;
        }

        .feed-interactive > div:hover .iconfont {
            color: #fd4c5c;
        }

        .feed-interactive-banana:hover .iconfont {
            color: #ffba0d !important;
        }

        /* 互动区图标切换：默认显示icon_path，active时显示icon_fill */
        .feed-interactive-like .icon_fill,
        .feed-interactive-banana .icon_fill {
            display: none !important;
        }
        .feed-interactive-like .icon_path,
        .feed-interactive-banana .icon_path {
            display: inline-block !important;
        }
        /* active属性选择器（原生用属性，不用class） */
        .feed-interactive-like[active] .icon_fill,
        .feed-interactive-like[active] .iconfont {
            display: inline-block !important;
            color: #fd4c5c !important;
        }
        .feed-interactive-like[active] .icon_path {
            display: none !important;
        }
        .feed-interactive-banana[active] .icon_fill,
        .feed-interactive-banana[active] .iconfont {
            display: inline-block !important;
            color: #ffba0d !important;
        }
        .feed-interactive-banana[active] .icon_path {
            display: none !important;
        }
        /* 加载中动画：· → ·· → ··· */
        .plaza-count-loading {
            color: transparent !important;
            position: relative;
        }
        .plaza-count-loading::after {
            content: '·';
            position: absolute;
            left: 0;
            color: #999;
            animation: plaza-dot-anim 1.5s infinite steps(1);
        }
        @keyframes plaza-dot-anim {
            0% { content: '·'; }
            33% { content: '··'; }
            66% { content: '···'; }
        }

        /* 原生分隔线样式 */
        .moment-plaza-item .feed-separate {
            margin-top: 10px;
            width: 830px;
            height: 10px;
            background: #f8f8f8;
        }

        .moment-plaza-empty {
            text-align: center;
            padding: 60px 20px;
            color: #999;
            font-size: 14px;
        }

        .moment-plaza-loading {
            text-align: center;
            padding: 40px;
            color: #999;
        }

        /* 评论区（仿原生） */
        .moment-comments {
            padding: 12px 0 0 0;
            border-top: 1px solid #e6e6e6;
            margin-top: -1px;
        }
        .moment-comments .area-comment-first {
            display: flex;
            padding: 12px 0;
            position: relative;
        }
        .moment-comments .area-comment-left {
            flex-shrink: 0;
        }
        .moment-comments .area-comment-left .thumb {
            display: block;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            overflow: hidden;
        }
        .moment-comments .area-comment-left .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            object-fit: cover;
        }
        .moment-comments .area-comment-right {
            flex: 1;
            margin-left: 12px;
            min-width: 0;
        }
        .moment-comments .area-comment-title {
            font-size: 13px;
            line-height: 1.4;
        }
        .moment-comments .area-comment-title .name {
            text-decoration: none;
            font-weight: 500;
        }
        .moment-comments .area-comment-title .time_day {
            color: #999;
            font-size: 12px;
            margin-left: 4px;
        }
        .moment-comments .area-comment-title .time_times {
            color: #999;
            font-size: 12px;
        }
        .moment-comments .area-comment-des {
            margin-top: 6px;
            font-size: 14px;
            color: #333;
            line-height: 1.6;
            word-break: break-all;
        }
        .moment-comments .area-comment-des-content {
            margin: 0;
        }
        .moment-comments .area-comment-des img.ubb-emotion {
            width: 22px;
            height: 22px;
            vertical-align: middle;
        }
        .moment-comments .area-comment-tool {
            margin-top: 6px;
            font-size: 12px;
            color: #999;
        }
        .moment-comments .area-comment-like {
            color: #999;
            cursor: pointer;
            margin-right: 16px;
        }
        .moment-comments .area-comment-like::before {
            content: '';
            display: inline-block;
            width: 14px;
            height: 14px;
            margin-right: 4px;
            vertical-align: -2px;
            background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23999'%3E%3Cpath d='M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z'/%3E%3C/svg%3E") no-repeat center;
        }
        .moment-comments .area-comment-like:hover {
            color: #fd4c5c;
        }
        .moment-comments .area-comment-like:hover::before {
            background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23fd4c5c'%3E%3Cpath d='M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z'/%3E%3C/svg%3E") no-repeat center;
        }
        .moment-comments .area-comment-like.area-comment-up {
            color: #fd4c5c !important;
        }
        .moment-comments .area-comment-like.area-comment-up::before {
            background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23fd4c5c'%3E%3Cpath d='M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z'/%3E%3C/svg%3E") no-repeat center;
        }
        .moment-comments .area-comment-from {
            color: #ccc;
        }
        .moment-comments .area-comment-from a {
            color: #999;
            text-decoration: none;
        }
        .moment-comments .index-comment {
            position: absolute;
            right: 0;
            top: 12px;
            color: #ddd;
            font-size: 14px;
        }
        .moment-comments .area-comment-top hr {
            border: none;
            border-top: 1px solid #f0f0f0;
            margin: 0;
        }
        /* 楼中楼 */
        .moment-comments .area-comment-sec {
            margin-left: 52px;
            background: #f8f8f8;
            border-radius: 4px;
            padding: 0 12px;
        }
        .moment-comments .area-comment-sec .sec {
            background: transparent;
        }
        .moment-comments .area-comment-sec .avatar {
            width: 28px;
            height: 28px;
        }
        .moment-comments .area-comment-sec .area-comment-left .thumb {
            width: 28px;
            height: 28px;
        }
        .moment-comments .area-comment-sec .area-comment-first {
            padding: 10px 0;
        }
        .moment-comments .area-comment-sec hr {
            border-top-color: #eaeaea;
        }
        .moment-comments .plaza-up-tag {
            background: #fd4c5c;
            color: #fff;
            font-size: 10px;
            padding: 0 4px;
            border-radius: 2px;
            margin-left: 4px;
            vertical-align: middle;
        }
        .plaza-comment-empty, .plaza-comment-load-failed {
            padding: 20px 0;
            color: #999;
            font-size: 13px;
            text-align: center;
        }
        .plaza-comment-more {
            text-align: center;
            padding: 14px;
            color: #fd4c5c;
            font-size: 13px;
            cursor: pointer;
        }
        .plaza-comment-more:hover {
            text-decoration: underline;
        }
        .feed-interactive-comment {
            cursor: pointer;
        }
        /* 首次设置框 */
        .plaza-setup-box {
            max-width: 500px;
            margin: 80px auto;
            padding: 30px;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 12px rgba(0,0,0,.08);
            text-align: left;
        }
        #plaza-link-input:focus {
            border-color: #fd4c5c;
        }
        #plaza-link-btn:hover {
            background: #e8434f;
        }
        /* 内容链接样式 */
        .plaza-at-link, .plaza-topic-link, .plaza-ac-link {
            color: #fd4c5c;
            text-decoration: none;
        }
        .plaza-at-link:hover, .plaza-topic-link:hover, .plaza-ac-link:hover {
            text-decoration: underline;
        }
        /* 侧边栏动态广场选中样式（仿原生） */
        .plaza-nav-item.ac-member-navigation-item-active {
            color: #fd4c5c !important;
            background: #fff !important;
        }
        /* 回到顶部按钮（仿原生） */
        .plaza-back-top {
            width: 44px;
            height: 44px;
            background: #fff;
            border-radius: 5px;
            position: fixed;
            right: 30px;
            bottom: 60px;
            display: none;
            justify-content: center;
            align-items: center;
            box-shadow: 0 3px 6px -4px rgba(0,0,0,.12), 0 6px 16px 0 rgba(0,0,0,.08), 0 9px 28px 8px rgba(0,0,0,.05);
            cursor: pointer;
            z-index: 9999;
            color: #999;
            font-size: 20px;
            transition: color 0.2s;
        }
        .plaza-back-top:hover {
            color: #333;
        }
        .plaza-back-top.visible {
            display: flex;
        }
        /* 底部加载指示器 */
        .plaza-load-more {
            text-align: center;
            padding: 20px 0;
            color: #999;
            font-size: 13px;
        }
        .plaza-load-more.loading::before {
            content: '';
            display: inline-block;
            width: 18px;
            height: 18px;
            border: 2px solid #e5e5e5;
            border-top-color: #fd4c5c;
            border-radius: 50%;
            animation: plaza-spin 0.8s linear infinite;
            vertical-align: -4px;
            margin-right: 6px;
        }
        @keyframes plaza-spin {
            to { transform: rotate(360deg); }
        }
        .plaza-reply-btn {
            color: #999;
            cursor: pointer;
            margin-right: 16px;
            font-size: 12px;
        }
        .plaza-reply-btn::before {
            content: '';
            display: inline-block;
            width: 14px;
            height: 14px;
            margin-right: 4px;
            vertical-align: -2px;
            background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23999'%3E%3Cpath d='M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z'/%3E%3C/svg%3E") no-repeat center;
        }
        .plaza-reply-btn:hover {
            color: #fd4c5c;
        }
        .plaza-reply-btn:hover::before {
            background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23fd4c5c'%3E%3Cpath d='M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z'/%3E%3C/svg%3E") no-repeat center;
        }
        .plaza-reply-box {
            display: flex;
            gap: 8px;
            margin-top: 8px;
            align-items: center;
        }
        .plaza-reply-input {
            flex: 1;
            height: 32px;
            padding: 0 10px;
            border: 1px solid #e5e5e5;
            border-radius: 4px;
            font-size: 13px;
            outline: none;
        }
        .plaza-reply-input:focus {
            border-color: #fd4c5c;
        }
        .plaza-reply-send {
            height: 32px;
            padding: 0 14px;
            background: #fd4c5c;
            color: #fff;
            border: none;
            border-radius: 4px;
            font-size: 13px;
            cursor: pointer;
        }
        .plaza-reply-send:hover {
            background: #e8434f;
        }
        .plaza-reply-send:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        /* 发评论框 */
        .plaza-comment-editor {
            display: flex;
            gap: 8px;
            padding: 12px 0;
            align-items: center;
        }
        .plaza-comment-editor input {
            flex: 1;
            height: 34px;
            padding: 0 10px;
            border: 1px solid #e5e5e5;
            border-radius: 4px;
            font-size: 13px;
            outline: none;
        }
        .plaza-comment-editor input:focus {
            border-color: #fd4c5c;
        }
        .plaza-comment-editor button {
            height: 34px;
            padding: 0 16px;
            background: #fd4c5c;
            color: #fff;
            border: none;
            border-radius: 4px;
            font-size: 13px;
            cursor: pointer;
        }
    `;

    GM_addStyle(styles);

    // ===================== 工具函数 =====================
    const utils = {
        log(...args) {
            console.log('%c[MomentPlaza]', 'color:#ff4b76;font-weight:bold', ...args);
        },

        // 绝对时间戳 → 相对时间 / 日期
        formatTime(timestamp) {
            if (!timestamp) return '';
            const now = Date.now();
            const diff = now - timestamp;
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);
            const days = Math.floor(diff / 86400000);

            if (minutes < 1) return '刚刚';
            if (minutes < 60) return `${minutes}分钟前`;
            if (hours < 24) return `${hours}小时前`;
            if (days < 30) return `${days}天前`;

            const date = new Date(timestamp);
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        },

        // 相对时间字符串 → 毫秒偏移（"40分钟前" → 40*60000）
        parseRelativeMs(text) {
            if (!text) return 0;
            const m = String(text).match(/(\d+)\s*(秒|分钟|小时|天)/);
            if (!m) return 0;
            const n = parseInt(m[1]);
            switch (m[2]) {
                case '秒': return n * 1000;
                case '分钟': return n * 60000;
                case '小时': return n * 3600000;
                case '天': return n * 86400000;
                default: return 0;
            }
        },

        // 由相对时间反推绝对时间戳（API 不返回绝对时间）
        computeAbsTs(createTime, fetchedAt) {
            const offset = this.parseRelativeMs(createTime);
            if (!offset) return fetchedAt || Date.now();
            return (fetchedAt || Date.now()) - offset;
        },

        formatNumber(num) {
            if (!num) return '0';
            if (num >= 10000) return (num / 10000).toFixed(1) + '万';
            return num.toString();
        },

        escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        // 解析动态内容（@提及、#话题#、ac号、表情）
        parseContent(text) {
            if (!text) return '';
            let html = utils.escapeHtml(text);
            html = html.replace(/\[at uid=(\d+)\]@?(.*?)\[\/at\]/g, (_, uid, name) => {
                return `<a class="plaza-at-link" href="//www.acfun.cn/u/${uid}" target="_blank">@${utils.escapeHtml(name)}</a>`;
            });
            html = html.replace(/#([^#\s]{1,30}?)#/g, (_, topic) => {
                return `<a class="plaza-topic-link" href="//www.acfun.cn/search?keyword=${encodeURIComponent(topic)}" target="_blank">#${topic}#</a>`;
            });
            html = html.replace(/\b(ac\d{4,})\b/gi, (_, id) => {
                return `<a class="plaza-ac-link" href="//www.acfun.cn/a/${id}" target="_blank">${id}</a>`;
            });
            html = html.replace(/\b([va])\/(ac\d{4,})\b/gi, (_, prefix, id) => {
                return `<a class="plaza-ac-link" href="//www.acfun.cn/${prefix}/${id}" target="_blank">${prefix}/${id}</a>`;
            });
            html = html.replace(/m\.acfun\.cn\/communityCircle\/moment\/(\d+)/g, (_, id) => {
                return `<a class="plaza-ac-link" href="//www.acfun.cn/moment/am${id}" target="_blank">am${id}</a>`;
            });
            html = html.replace(/\[emot=(\w+),(\d+)\/?\]/g, '<span style="color:#999;font-size:12px;">[表情]</span>');
            html = html.replace(/\[表情\]/g, '<span style="color:#999;font-size:12px;">[表情]</span>');
            return html;
        },

        getLastAmId() {
            try { return GM_getValue(LAST_AM_KEY, 0); } catch { return 0; }
        },

        setLastAmId(amId) {
            try { GM_setValue(LAST_AM_KEY, amId); } catch (e) {}
        },

        getKeepDays() {
            try {
                const d = GM_getValue(KEEP_DAYS_KEY, CONFIG.KEEP_DAYS_DEFAULT);
                return Math.min(7, Math.max(1, parseInt(d) || CONFIG.KEEP_DAYS_DEFAULT));
            } catch { return CONFIG.KEEP_DAYS_DEFAULT; }
        },

        setKeepDays(days) {
            try { GM_setValue(KEEP_DAYS_KEY, Math.min(7, Math.max(1, days || CONFIG.KEEP_DAYS_DEFAULT))); } catch (e) {}
        }
    };

    // ===================== IndexedDB 存储层 =====================
    const DB_NAME = 'moment-plaza';
    const DB_VERSION = 1;
    const STORE_MOMENTS = 'moments';
    const STORE_META = 'meta';

    let _dbPromise = null;

    const db = {
        open() {
            if (_dbPromise) return _dbPromise;
            _dbPromise = new Promise((resolve, reject) => {
                const req = indexedDB.open(DB_NAME, DB_VERSION);
                req.onupgradeneeded = (e) => {
                    const d = e.target.result;
                    if (!d.objectStoreNames.contains(STORE_MOMENTS)) {
                        const store = d.createObjectStore(STORE_MOMENTS, { keyPath: 'amId' });
                        store.createIndex('by_absTs', 'absTs');
                    }
                    if (!d.objectStoreNames.contains(STORE_META)) {
                        d.createObjectStore(STORE_META);
                    }
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            return _dbPromise;
        },

        async putMoment(record) {
            const d = await this.open();
            return new Promise((resolve, reject) => {
                const tx = d.transaction(STORE_MOMENTS, 'readwrite');
                tx.objectStore(STORE_MOMENTS).put(record);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        },

        async putMoments(records) {
            if (!records || !records.length) return;
            const d = await this.open();
            return new Promise((resolve, reject) => {
                const tx = d.transaction(STORE_MOMENTS, 'readwrite');
                const store = tx.objectStore(STORE_MOMENTS);
                records.forEach(r => store.put(r));
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        },

        async getMoment(amId) {
            const d = await this.open();
            return new Promise((resolve, reject) => {
                const req = d.transaction(STORE_MOMENTS, 'readonly').objectStore(STORE_MOMENTS).get(amId);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => reject(req.error);
            });
        },

        // 取 amId < fromId 的 count 条（按 amId 降序，即较新的在前）
        async getOlderThan(fromId, count) {
            const d = await this.open();
            return new Promise((resolve, reject) => {
                const store = d.transaction(STORE_MOMENTS, 'readonly').objectStore(STORE_MOMENTS);
                const range = IDBKeyRange.upperBound(fromId, true);
                const result = [];
                const req = store.openCursor(range, 'prev');
                req.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor && result.length < count) {
                        result.push(cursor.value);
                        cursor.continue();
                    } else {
                        resolve(result);
                    }
                };
                req.onerror = () => reject(req.error);
            });
        },

        // 取最新（amId 最大）的 count 条
        async getLatest(count) {
            const d = await this.open();
            return new Promise((resolve, reject) => {
                const store = d.transaction(STORE_MOMENTS, 'readonly').objectStore(STORE_MOMENTS);
                const result = [];
                const req = store.openCursor(null, 'prev');
                req.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor && result.length < count) {
                        result.push(cursor.value);
                        cursor.continue();
                    } else {
                        resolve(result);
                    }
                };
                req.onerror = () => reject(req.error);
            });
        },

        // 取所有记录里最大的 absTs（用于向上爬取判断落后程度）
        async getLatestAbsTs() {
            const d = await this.open();
            return new Promise((resolve, reject) => {
                const store = d.transaction(STORE_MOMENTS, 'readonly').objectStore(STORE_MOMENTS);
                const index = store.index('by_absTs');
                const req = index.openCursor(null, 'prev');
                req.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) resolve(cursor.value.absTs || 0);
                    else resolve(0);
                };
                req.onerror = () => reject(req.error);
            });
        },

        // 删除 absTs < cutoffTs 的过期记录
        async deleteOlderThan(cutoffTs) {
            const d = await this.open();
            return new Promise((resolve, reject) => {
                const store = d.transaction(STORE_MOMENTS, 'readwrite').objectStore(STORE_MOMENTS);
                const index = store.index('by_absTs');
                const range = IDBKeyRange.upperBound(cutoffTs);
                const req = index.openCursor(range);
                req.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) { cursor.delete(); cursor.continue(); }
                    else resolve();
                };
                req.onerror = () => reject(req.error);
            });
        }
    };

    // ===================== API 请求 =====================
    const api = {
        // 根据am号获取单条动态
        fetchMoment(amId) {
            if (!amId || amId <= 0) return Promise.resolve(null);
            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: `${CONFIG.MOMENT_API}?momentId=${amId}`,
                    headers: {
                        'Accept': 'application/json',
                        'Referer': `https://www.acfun.cn/moment/am${amId}`,
                    },
                    onload: (response) => {
                        const text = response.responseText.trim();
                        if (!text.startsWith('{') && !text.startsWith('[')) {
                            resolve(null);
                            return;
                        }
                        try {
                            const data = JSON.parse(text);
                            resolve(data.result === 0 ? data : null);
                        } catch (e) { resolve(null); }
                    },
                    onerror: () => resolve(null)
                });
            });
        },

        // 获取评论列表
        fetchComments(amId, count = 10, cursor = '') {
            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: `https://www.acfun.cn/rest/pc-direct/comment/list?sourceId=${amId}&sourceType=4&cursor=${cursor}&count=${count}`,
                    headers: { 'Accept': 'application/json', 'Referer': `https://www.acfun.cn/moment/am${amId}` },
                    onload: (response) => {
                        try {
                            const data = JSON.parse(response.responseText);
                            resolve(data.result === 0 ? data : null);
                        } catch { resolve(null); }
                    },
                    onerror: () => resolve(null)
                });
            });
        },

        // 获取API token（点赞用）
        _apiToken: null,
        _tokenExpiry: 0,

        async getApiToken() {
            if (this._apiToken && Date.now() < this._tokenExpiry) return this._apiToken;
            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: 'https://id.app.acfun.cn/rest/web/token/get',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
                    data: 'sid=acfun.midground.api',
                    onload: (resp) => {
                        try {
                            const data = JSON.parse(resp.responseText);
                            if (data.result === 0) {
                                this._apiToken = data['acfun.midground.api_st'] || '';
                                this._tokenExpiry = Date.now() + 30 * 60 * 1000;
                            }
                        } catch {}
                        resolve(this._apiToken);
                    },
                    onerror: () => resolve('')
                });
            });
        },

        // 点赞/取消点赞动态
        async likeMoment(momentId, userId, isCancel = false) {
            const token = await this.getApiToken();
            if (!token) return null;
            const endpoint = isCancel ? 'delete' : 'add';
            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: `https://kuaishouzt.com/rest/zt/interact/${endpoint}`,
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
                    data: `objectId=${momentId}&objectType=10&userId=${userId}&acfun.midground.api_st=${encodeURIComponent(token)}&kpn=ACFUN_APP&kpf=PC_WEB&subBiz=mainApp&interactType=1`,
                    onload: (resp) => {
                        try { resolve(JSON.parse(resp.responseText)); } catch { resolve(null); }
                    },
                    onerror: () => resolve(null)
                });
            });
        },

        // 评论点赞/取消点赞
        async likeComment(sourceId, commentId, isCancel = false) {
            const endpoint = isCancel ? 'unlike' : 'like';
            try {
                const resp = await fetch(`https://www.acfun.cn/rest/pc-direct/comment/${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `sourceId=${sourceId}&sourceType=4&commentId=${commentId}`,
                    credentials: 'include'
                });
                return await resp.json();
            } catch { return null; }
        },

        // 投蕉给动态作者
        throwBanana(momentId) {
            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: 'https://www.acfun.cn/rest/pc-direct/banana/throwBanana',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': `https://www.acfun.cn/moment/am${momentId}` },
                    data: `resourceId=${momentId}&count=1&resourceType=10`,
                    onload: (resp) => {
                        try { resolve(JSON.parse(resp.responseText)); } catch { resolve(null); }
                    },
                    onerror: () => resolve(null)
                });
            });
        },

        // 向上查找新动态（并发逐个探测）
        // opts: { skipFansOnly, stopAtMs }  stopAtMs: 遇到发布时间距今 ≤stopAtMs 的动态即停
        async fetchNewMoments(startId, targetCount = 50, opts = {}) {
            const results = [];
            let currentId = startId + 1;
            let emptyCount = 0;
            let totalChecked = 0;
            const MAX_SCAN = targetCount * 50;

            while (results.length < targetCount && totalChecked < MAX_SCAN && currentId <= startId + MAX_SCAN) {
                const room = targetCount - results.length;
                const batchIds = [];
                for (let i = 0; i < Math.min(CONFIG.CONCURRENT, room); i++) {
                    batchIds.push(currentId + i);
                }
                totalChecked += batchIds.length;

                const batchResults = await Promise.all(batchIds.map(amId =>
                    this.fetchMoment(amId).then(data => {
                        if (data && data.result === 0 && data.moment) {
                            const moment = data.moment;
                            if (opts.skipFansOnly && moment.visibleForFans) {
                                return { amId, fansOnly: true };
                            }
                            const ageMs = utils.parseRelativeMs(moment.createTime);
                            return { amId, found: true, moment: data, hitFresh: opts.stopAtMs != null && ageMs <= opts.stopAtMs };
                        }
                        return { amId, found: false };
                    })
                ));

                let hitFresh = false;
                for (const r of batchResults) {
                    if (r.fansOnly) continue;
                    if (r.found) {
                        emptyCount = 0;
                        results.push({ ...r.moment, _amId: r.amId });
                        if (r.hitFresh) hitFresh = true;
                    } else {
                        emptyCount++;
                    }
                }
                currentId += batchIds.length;

                if (hitFresh) { utils.log('向上爬到最新（≤1h），停止'); break; }
                if (emptyCount >= CONFIG.MAX_EMPTY) { utils.log(`连续 ${emptyCount} 个空号，停止`); break; }
                await new Promise(r => setTimeout(r, 60));
            }

            results.sort((a, b) => b._amId - a._amId);
            return results;
        },

        // 向下查找历史动态（并发逐个探测）
        // opts: { skipFansOnly, stopAfterMs }  stopAfterMs: 遇到发布时间距今 >stopAfterMs 的动态即停（太旧）
        async fetchOldMoments(startId, targetCount = 20, opts = {}) {
            const results = [];
            let currentId = startId - 1;
            let emptyCount = 0;
            let totalChecked = 0;
            const MAX_SCAN = targetCount * 50;

            while (results.length < targetCount && totalChecked < MAX_SCAN && currentId > 0) {
                const room = targetCount - results.length;
                const batchIds = [];
                for (let i = 0; i < Math.min(CONFIG.CONCURRENT, room, currentId); i++) {
                    batchIds.push(currentId - i);
                }
                totalChecked += batchIds.length;

                const batchResults = await Promise.all(batchIds.map(amId =>
                    this.fetchMoment(amId).then(data => {
                        if (data && data.result === 0 && data.moment) {
                            const moment = data.moment;
                            if (opts.skipFansOnly && moment.visibleForFans) {
                                return { amId, fansOnly: true };
                            }
                            const ageMs = utils.parseRelativeMs(moment.createTime);
                            if (opts.stopAfterMs != null && ageMs > opts.stopAfterMs) {
                                return { amId, tooOld: true };
                            }
                            return { amId, found: true, moment: data };
                        }
                        return { amId, found: false };
                    })
                ));

                let shouldStop = false;
                for (const r of batchResults) {
                    if (r.fansOnly) continue;
                    if (r.tooOld) { shouldStop = true; break; }
                    if (r.found) { emptyCount = 0; results.push({ ...r.moment, _amId: r.amId }); }
                    else emptyCount++;
                }
                currentId -= batchIds.length;

                if (shouldStop) { utils.log('向下爬到 >24h，停止'); break; }
                if (emptyCount >= CONFIG.MAX_EMPTY) { utils.log(`连续 ${emptyCount} 个空号，停止`); break; }
                await new Promise(r => setTimeout(r, 60));
            }

            results.sort((a, b) => b._amId - a._amId);
            return results;
        }
    };

    // ===================== 渲染器 =====================
    const renderer = {
        _cachedInteractiveHtml: null,

        getInteractiveHtml() {
            if (this._cachedInteractiveHtml) return this._cachedInteractiveHtml;

            const nativeFeed = document.querySelector('.ac-member-feed:not(.moment-plaza-item) .feed-interactive');
            if (nativeFeed) {
                const clone = nativeFeed.cloneNode(true);
                clone.querySelectorAll('.active').forEach(el => el.classList.remove('active'));
                this._cachedInteractiveHtml = clone.outerHTML;
                return this._cachedInteractiveHtml;
            }
            return '';
        },

        // 把某个互动区元素里的数字（文本节点）替换为加载点
        _replaceNumWithLoading(el) {
            const nodes = el.childNodes;
            for (let i = nodes.length - 1; i >= 0; i--) {
                if (nodes[i].nodeType === 3 && nodes[i].textContent.trim()) {
                    const span = document.createElement('span');
                    span.className = 'plaza-count-loading';
                    nodes[i].parentNode.replaceChild(span, nodes[i]);
                    return;
                }
            }
            const span = document.createElement('span');
            span.className = 'plaza-count-loading';
            el.appendChild(span);
        },

        // 生成互动区 HTML。pending=true 时赞/评/投蕉数字显示加载动画
        fillInteractive(moment, opts = {}) {
            const pending = !!opts.pending;
            const commentCount = moment.commentCount || 0;
            const bananaCount = moment.bananaCount || 0;
            const likeCount = moment.likeCount || 0;
            const isLiked = moment.isLike || false;
            const isBanana = moment.isThrowBanana || false;

            let html = this.getInteractiveHtml();
            if (!html) {
                // 兜底：无原生结构时手写简化互动区
                if (pending) {
                    return `<div class="feed-interactive">
                        <div class="feed-interactive-comment"><span class="plaza-count-loading"></span></div>
                        <div class="feed-interactive-banana"><span class="plaza-count-loading"></span></div>
                        <div class="feed-interactive-like"><span class="plaza-count-loading"></span></div>
                        <div class="feed-interactive-repost"><span>分享</span></div>
                    </div>`;
                }
                return `<div class="feed-interactive">
                    <div class="feed-interactive-comment"><span>评论 ${utils.formatNumber(commentCount)}</span></div>
                    <div class="feed-interactive-banana"><span>投蕉 ${utils.formatNumber(bananaCount)}</span></div>
                    <div class="feed-interactive-like"><span>赞 ${utils.formatNumber(likeCount)}</span></div>
                    <div class="feed-interactive-repost"><span>分享</span></div>
                </div>`;
            }

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;

            // 评论数
            const commentDiv = tempDiv.querySelector('.feed-interactive-comment');
            if (commentDiv) {
                if (pending) {
                    this._replaceNumWithLoading(commentDiv);
                } else {
                    const nodes = commentDiv.childNodes;
                    for (let i = nodes.length - 1; i >= 0; i--) {
                        if (nodes[i].nodeType === 3 && nodes[i].textContent.trim()) {
                            nodes[i].textContent = utils.formatNumber(commentCount) + '\n    ';
                            break;
                        }
                    }
                }
            }

            // 香蕉数
            const bananaDiv = tempDiv.querySelector('.feed-interactive-banana');
            if (bananaDiv) {
                if (isBanana) bananaDiv.setAttribute('active', '');
                const span = bananaDiv.querySelector('span:last-of-type');
                if (span) {
                    if (pending) {
                        span.textContent = '';
                        span.className = 'plaza-count-loading';
                    } else {
                        span.textContent = utils.formatNumber(bananaCount);
                    }
                }
            }

            // 点赞数
            const likeDiv = tempDiv.querySelector('.feed-interactive-like');
            if (likeDiv) {
                if (isLiked) likeDiv.setAttribute('active', '');
                if (pending) {
                    this._replaceNumWithLoading(likeDiv);
                } else {
                    const nodes = likeDiv.childNodes;
                    for (let i = nodes.length - 1; i >= 0; i--) {
                        if (nodes[i].nodeType === 3 && nodes[i].textContent.trim()) {
                            nodes[i].textContent = utils.formatNumber(likeCount) + '\n    ';
                            break;
                        }
                    }
                }
            }

            return tempDiv.innerHTML;
        },

        renderToolbar() {
            const keepDays = utils.getKeepDays();
            const opts = [1, 2, 3, 4, 5, 6, 7].map(d => `<option value="${d}"${d === keepDays ? ' selected' : ''}>${d}</option>`).join('');
            return `
                <div class="moment-plaza-toolbar">
                    <span class="status" id="fetch-status" style="cursor:pointer;" title="点击刷新">加载中...</span>
                    <span class="status" id="up-status" style="color:#52c41a;font-size:12px;cursor:pointer;" title="点击刷新"></span>
                    <span class="status" style="margin-left:12px;">保留 <select id="plaza-keep-days" style="border:1px solid #e5e5e5;border-radius:3px;padding:1px 4px;color:#666;">${opts}</select> 天内的数据</span>
                </div>
            `;
        },

        // record: { amId, absTs, data, fetchedAt }
        renderCard(record, opts = {}) {
            const pending = !!opts.pending;
            const moment = record.data || record.moment || record;
            const user = moment.user || {};

            const userId = user.id || user.userId || '';
            const userName = user.name || '';
            const userAvatar = (user.headCdnUrls?.[0]?.url || user.headUrl || '') + '?imageMogr2/auto-orient/format/webp/quality/80!/ignore-error/1';

            const rawText = moment.text || moment.replaceUbbText || '';
            const text = utils.parseContent(rawText);

            const images = moment.imgs || [];
            let imageHtml = '';
            if (images.length > 0) {
                const imgCount = Math.min(images.length, 9);
                const imgTags = images.slice(0, 9).map(img => {
                    const url = img.url || img.originUrl || '';
                    return url ? `<img src="${url}">` : '';
                }).filter(Boolean).join('');
                imageHtml = `<div class="member-feed-moment-image member-feed-moment-image-${imgCount}">${imgTags}</div>`;
            }

            const amId = record.amId || moment.momentId;
            const fansOnly = moment.visibleForFans || false;

            const nameColor = user.nameColor;
            const nameColorStyle = nameColor === 2 ? 'color:#964cfd;' : 'color:#fd4c5c;';

            // 展示时间：优先用存储的绝对时间戳动态计算，保证准确
            const absTs = record.absTs || utils.computeAbsTs(moment.createTime, Date.now());
            const createTime = utils.formatTime(absTs) || moment.createTime || '';

            const interactiveHtml = this.fillInteractive(moment, { pending });

            return `
                <div class="ac-member-feed moment-plaza-item" data-am-id="${amId}">
                    ${fansOnly ? `
                    <div class="fans-only" style="margin-bottom:20px;padding-left:12px;height:34px;line-height:34px;border-bottom:1px solid #e6e6e6;font-size:12px;color:#999;">
                        粉丝可见
                    </div>` : ''}
                    <a class="am-link" href="//www.acfun.cn/moment/am${amId}" target="_blank" title="am${amId}">am${amId}</a>
                    <div class="member-feed-user">
                        <div class="feed-up">
                            <div class="feed-up-avatar">
                                <a href="//www.acfun.cn/u/${userId}" target="_blank">
                                    <img src="${userAvatar}">
                                </a>
                            </div>
                            <div class="feed-up-info">
                                <div class="up-name">
                                    <a href="//www.acfun.cn/u/${userId}" target="_blank" class="text-overflow" style="${nameColorStyle}">
                                        ${utils.escapeHtml(userName)}
                                    </a>
                                </div>
                                <div class="verify"></div>
                                <span class="feed-time">${createTime}</span>
                            </div>
                        </div>
                    </div>
                    <div class="feed-content">
                        <div class="member-feed-moment">
                            <div class="member-feed-text">${text}</div>
                            ${imageHtml}
                        </div>
                    </div>
                    <div class="member-feed-interactive">
                        ${interactiveHtml}
                    </div>
                    <div class="moment-comments" id="comments-${amId}" style="display:none;"></div>
                    <div class="feed-separate"></div>
                </div>
            `;
        },

        renderComment(comment, amId, isSec) {
            const userName = comment.userName || '';
            const userId = comment.userId || '';
            const avatar = comment.userHeadImgInfo?.thumbnailImageCdnUrl || comment.headUrl?.[0]?.url || '';
            const rawContent = comment.content || '';
            const content = utils.parseContent(rawContent);
            const likeCount = comment.likeCount || 0;
            const time = comment.postDate || '';
            const floor = comment.floor || '';
            const nameColor = comment.nameColor === 2 ? '#964cfd' : '#fd4c5c';
            const device = comment.deviceModel || '';
            const isUp = comment.isUp;
            const isCommentLiked = comment.isLiked || false;

            const subComments = comment.subComments || [];
            const subHtml = subComments.length > 0
                ? `<div class="area-comment-sec clearfix"><div class="area-sec-list">${subComments.map(s => this.renderComment(s, amId, true)).join('')}</div></div>`
                : '';

            const secClass = isSec ? ' sec' : '';

            return `
                <div class="area-comment-top clearfix plaza-comment-item${secClass}">
                    <div class="area-comment-first clearfix">
                        <div class="area-comment-left">
                            <a class="thumb" target="_blank" href="//www.acfun.cn/u/${userId}">
                                <img class="avatar" src="${avatar}">
                            </a>
                        </div>
                        <div class="area-comment-right">
                            <div class="area-comment-title">
                                <a class="name" target="_blank" href="//www.acfun.cn/u/${userId}" style="color:${nameColor}">${utils.escapeHtml(userName)}</a>
                                ${isUp ? '<span class="plaza-up-tag">UP主</span>' : ''}
                                <span class="time_day">发表于</span>
                                <span class="time_times">${time}</span>
                            </div>
                            <div class="area-comment-des">
                                <p class="area-comment-des-content">${content}</p>
                            </div>
                            <div class="area-comment-tool">
                                <a class="area-comment-like${isCommentLiked ? ' area-comment-up' : ''}">${likeCount > 0 ? `赞 ${likeCount}` : '赞'}</a>
                                <a class="plaza-reply-btn" data-comment-id="${comment.commentId}" data-user="${utils.escapeHtml(userName)}">回复</a>
                                <span class="area-comment-from">
                                    ${device ? `<span>来自</span><a class="deviceModel" target="_blank">${utils.escapeHtml(device)}</a>` : ''}
                                </span>
                            </div>
                            <div class="plaza-reply-box" id="reply-box-${comment.commentId}" style="display:none;">
                                <input class="plaza-reply-input" placeholder="回复 ${utils.escapeHtml(userName)}..." />
                                <button class="plaza-reply-send" data-am-id="${amId}" data-reply-to="${comment.commentId}">发送</button>
                            </div>
                        </div>
                        ${floor ? `<span class="index-comment">#${floor}</span>` : ''}
                    </div>
                    ${subHtml}
                    <hr>
                </div>
            `;
        },

        renderComments(data, amId) {
            const editor = `
                <div class="plaza-comment-editor">
                    <input class="plaza-editor-input" placeholder="写评论..." />
                    <button class="plaza-editor-send" data-am-id="${amId}">发送</button>
                </div>
            `;

            if (!data) return editor + '<div class="plaza-comment-load-failed">评论加载失败</div>';
            const comments = data.rootComments || [];
            const subMap = data.subCommentsMap || {};
            if (comments.length === 0) return editor + '<div class="plaza-comment-empty">暂无评论</div>';

            const enriched = comments.map(c => {
                const id = c.commentId?.toString();
                const subEntry = subMap[id];
                const subList = subEntry?.subComments || subEntry || [];
                return { ...c, subComments: Array.isArray(subList) ? subList : [] };
            });

            const html = enriched.map(c => this.renderComment(c, amId)).join('');
            return `
                ${editor}
                <div class="plaza-comment-list">${html}</div>
                <div class="plaza-comment-more"><a href="//www.acfun.cn/moment/am${amId}" target="_blank">查看更多评论</a></div>
            `;
        },

        renderList(records) {
            if (records.length === 0) {
                return '<div class="moment-plaza-empty">正在加载动态...</div>';
            }

            const now = Date.now();
            const sorted = [...records].sort((a, b) => (b.amId || 0) - (a.amId || 0));
            return `<div class="moment-plaza-list">${sorted.map(r => {
                const absTs = r.absTs;
                const pending = !!absTs && (now - absTs) <= CONFIG.FRESH_WINDOW_MS;
                return this.renderCard(r, { pending });
            }).join('')}</div>`;
        }
    };

    // ===================== 主控制器 =====================
    const app = {
        init() {
            if (window.location.pathname.startsWith('/member')) {
                this.setupNavigation();
                this.startBackgroundWork();

                if (window.location.pathname.startsWith('/member/feeds')) {
                    this.setupFeedsPage();
                }
            }
        },

        // 启动：有 am 号就开启向上后台定时爬取 + 过期清理
        startBackgroundWork() {
            const knownAmId = utils.getLastAmId();
            if (!knownAmId || knownAmId <= 0) return;

            state.latestAmId = knownAmId;
            this._startUpwardPoll();
            this._cleanupExpired();
        },

        // ========== 向上爬取（后台定时，按时间差距判断） ==========
        _startUpwardPoll() {
            if (state._upPollTimer) return;
            this._upPollTick();
            state._upPollTimer = setInterval(() => this._upPollTick(), CONFIG.UP_POLL_INTERVAL);
        },

        _stopUpwardPoll() {
            if (state._upPollTimer) {
                clearInterval(state._upPollTimer);
                state._upPollTimer = null;
            }
        },

        async _upPollTick() {
            if (state._upRunning) return;

            // 数据库最新动态距今 > 1 小时才向上爬
            const latestAbsTs = await db.getLatestAbsTs();
            const gap = latestAbsTs ? Date.now() - latestAbsTs : Infinity;
            if (gap <= CONFIG.UP_POLL_GAP_MS) return;

            this._runUpwardSearch();
        },

        async _runUpwardSearch() {
            if (state._upRunning) return;
            state._upRunning = true;

            const upStatus = document.getElementById('up-status');
            const updateUp = (t) => { if (upStatus) upStatus.textContent = t; };
            updateUp('↑查找新动态...');

            try {
                const newMoments = await api.fetchNewMoments(state.latestAmId, 50, {
                    skipFansOnly: true,
                    stopAtMs: CONFIG.UP_STOP_AT_MS
                });

                if (newMoments.length) {
                    const records = await this._storeMoments(newMoments);
                    const maxAm = Math.max(...records.map(r => r.amId));
                    if (maxAm > state.latestAmId) {
                        state.latestAmId = maxAm;
                        utils.setLastAmId(maxAm);
                    }
                    updateUp(`↑发现 ${records.length} 条新动态，点击刷新`);
                } else {
                    updateUp('');
                }
            } finally {
                state._upRunning = false;
            }
        },

        // ========== 过期清理 ==========
        async _cleanupExpired() {
            try {
                const keepDays = utils.getKeepDays();
                const cutoff = Date.now() - keepDays * 86400000;
                await db.deleteOlderThan(cutoff);
            } catch (e) {
                utils.log('清理过期数据失败:', e);
            }
        },

        // ========== 导航注入 ==========
        setupNavigation() {
            const checkNav = setInterval(() => {
                const feedsNav = document.querySelector('.sub-nav-title a[href="/member/feeds"]')
                    || document.querySelector('a[href="/member/feeds"]')
                    || document.querySelector('.ac-member-navigation a[href*="/feeds"]');
                if (feedsNav) {
                    clearInterval(checkNav);
                    this.addPlazaNavItem(feedsNav);
                }
            }, 500);
            setTimeout(() => clearInterval(checkNav), 10000);
        },

        addPlazaNavItem(feedsNav) {
            if (document.querySelector('.plaza-nav-item')) return;

            const feedsLink = feedsNav.querySelector('a[href="/member/feeds"]') || feedsNav;
            if (feedsLink.tagName === 'A') {
                feedsLink.addEventListener('click', (e) => {
                    const mainContent = document.querySelector('.ac-member-main .ac-member-feeds');
                    if (mainContent && mainContent.querySelector('.moment-plaza-container')) {
                        e.preventDefault();
                        e.stopPropagation();
                        location.reload();
                    }
                });
            }

            const plazaItem = document.createElement('a');
            plazaItem.href = 'javascript:void(0)';
            plazaItem.className = 'ac-member-navigation-item ac-member-navigation-sub-item plaza-nav-item';
            plazaItem.textContent = '动态广场';

            plazaItem.addEventListener('click', (e) => {
                e.preventDefault();
                this.enterPlaza();
            });

            const subNavGroup = feedsNav.closest('.member-sub-nav');
            if (subNavGroup) {
                const fansLink = subNavGroup.querySelector('a[href="/member/feeds/fans"]');
                if (fansLink) {
                    fansLink.parentNode.insertBefore(plazaItem, fansLink.nextSibling);
                } else {
                    subNavGroup.appendChild(plazaItem);
                }

                subNavGroup.querySelectorAll('a:not(.plaza-nav-item)').forEach(link => {
                    link.addEventListener('click', () => {
                        plazaItem.classList.remove('ac-member-navigation-item-active');
                    });
                });
            }

            feedsNav.addEventListener('click', () => {
                plazaItem.classList.remove('ac-member-navigation-item-active');
            });
        },

        // 进入/刷新动态广场
        enterPlaza() {
            const mainContent = document.querySelector('.ac-member-main .ac-member-feeds');

            if (!mainContent) {
                GM_setValue('moment_plaza_auto_enter', true);
                window.location.href = '/member/feeds';
                return;
            }

            document.querySelector('a[href="/member/feeds"]')?.classList.remove('ac-member-navigation-item-active');
            document.querySelector('.plaza-nav-item')?.classList.add('ac-member-navigation-item-active');

            const isPlazaOpen = mainContent.querySelector('.moment-plaza-container');

            if (isPlazaOpen) {
                this.refreshPlaza();
            } else {
                this._originalContent = null;
                this.showPlazaView();
            }
        },

        // 刷新广场（点击刷新时调用）：预渲染 DB 最新 20 条
        async refreshPlaza() {
            this._stopUpwardPoll();

            const statusEl = document.getElementById('fetch-status');
            const updateStatus = (t) => { if (statusEl) statusEl.textContent = t; };
            const upStatus = document.getElementById('up-status');
            if (upStatus) upStatus.textContent = '';
            updateStatus('正在刷新...');

            state._downLoading = false;
            state._noMoreDown = false;

            const records = await this._loadBatch(state.latestAmId + 1, CONFIG.BATCH_SIZE);

            state.moments = records;
            if (records.length) {
                state.oldestAmId = Math.min(...records.map(r => r.amId));
                const oldestAbs = records[records.length - 1]?.absTs;
                if (records.length < CONFIG.BATCH_SIZE || (oldestAbs && (Date.now() - oldestAbs) > CONFIG.DOWN_STOP_AFTER_MS)) {
                    state._noMoreDown = true;
                }
            }
            this._renderList();
            updateStatus(`共 ${state.moments.length} 条动态，向下滚动加载更多`);

            // 后台注入 ≤3h 的互动数据
            this._freshnessUpdate(records);

            this._startUpwardPoll();
            this._cleanupExpired();
        },

        async showPlazaView() {
            const mainContent = document.querySelector('.ac-member-main .ac-member-feeds');
            if (!mainContent) return;

            renderer.getInteractiveHtml();
            if (!this._originalContent) {
                this._originalContent = mainContent.innerHTML;
            }

            // 没有 am 号 → 首次设置框
            if (!state.latestAmId || state.latestAmId <= 0) {
                const keepDays = utils.getKeepDays();
                const opts = [1, 2, 3, 4, 5, 6, 7].map(d => `<option value="${d}"${d === keepDays ? ' selected' : ''}>${d}</option>`).join('');
                mainContent.innerHTML = `
                    <div class="moment-plaza-container">
                        <div class="plaza-setup-box">
                            <h3 style="margin:0 0 12px;color:#333;">📌 首次使用</h3>
                            <p style="color:#666;font-size:14px;margin-bottom:12px;">请粘贴一条动态链接来获取 am 号：</p>
                            <p style="color:#999;font-size:12px;margin-bottom:16px;">示例：https://www.acfun.cn/moment/am5073277</p>
                            <div style="display:flex;gap:8px;">
                                <input id="plaza-link-input" type="text" placeholder="粘贴动态链接..." style="flex:1;height:36px;padding:0 10px;border:1px solid #e5e5e5;border-radius:4px;font-size:14px;outline:none;" />
                                <button id="plaza-link-btn" style="height:36px;padding:0 20px;background:#fd4c5c;color:#fff;border:none;border-radius:4px;font-size:14px;cursor:pointer;">确定</button>
                            </div>
                            <div style="margin-top:16px;font-size:13px;color:#666;">保留
                                <select id="plaza-setup-keep-days" style="border:1px solid #e5e5e5;border-radius:3px;padding:2px 4px;">${opts}</select> 天内的数据
                            </div>
                        </div>
                    </div>
                `;
                this._bindSetupEvents(mainContent);
                return;
            }

            state.moments = [];
            mainContent.innerHTML = `
                <div class="moment-plaza-container">
                    ${renderer.renderToolbar()}
                    <div id="moment-list"></div>
                    <div id="load-more-status" class="plaza-load-more"></div>
                </div>
            `;

            if (!document.querySelector('.plaza-back-top')) {
                const backTop = document.createElement('div');
                backTop.className = 'plaza-back-top';
                backTop.innerHTML = '↑';
                backTop.title = '回到顶部';
                backTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
                document.body.appendChild(backTop);
            }
            this.bindEvents();
            this._setupScrollListener();
            this._bindKeepDaysSelect();

            const statusEl = document.getElementById('fetch-status');
            if (statusEl) statusEl.textContent = '正在加载...';

            const records = await this._loadBatch(state.latestAmId + 1, CONFIG.BATCH_SIZE);

            state.moments = records;
            if (records.length) {
                state.oldestAmId = Math.min(...records.map(r => r.amId));
                const oldestAbs = records[records.length - 1]?.absTs;
                if (records.length < CONFIG.BATCH_SIZE || (oldestAbs && (Date.now() - oldestAbs) > CONFIG.DOWN_STOP_AFTER_MS)) {
                    state._noMoreDown = true;
                }
            }
            this._renderList();
            if (statusEl) statusEl.textContent = `共 ${state.moments.length} 条动态，向下滚动加载更多`;

            this._freshnessUpdate(records);
            this._startUpwardPoll();
            this._cleanupExpired();
        },

        // ========== 数据流核心 ==========
        // 从库预渲染 count 条（amId < fromId），不足则实时抓取补足
        async _loadBatch(fromId, count) {
            let records = await db.getOlderThan(fromId, count);
            if (records.length < count) {
                const fetchFrom = records.length ? records[records.length - 1].amId : fromId;
                const need = count - records.length;
                const fetched = await this._fetchAndStoreDown(fetchFrom, need);
                records = records.concat(fetched);
                records.sort((a, b) => b.amId - a.amId);
            }
            return records;
        },

        // 实时抓取一批（跳过粉丝可见、>24h 停），存库并返回记录
        async _fetchAndStoreDown(fromAmId, targetCount) {
            const moments = await api.fetchOldMoments(fromAmId, targetCount, {
                skipFansOnly: true,
                stopAfterMs: CONFIG.DOWN_STOP_AFTER_MS
            });
            return this._storeMoments(moments);
        },

        // moments（含 _amId）→ 记录（含 absTs），存库
        async _storeMoments(moments) {
            const records = [];
            const now = Date.now();
            for (const m of moments) {
                const moment = m.moment || m;
                const amId = parseInt(m._amId || moment.momentId);
                if (!amId) continue;
                if (moment.visibleForFans) continue;
                const absTs = utils.computeAbsTs(moment.createTime, now);
                records.push({ amId, absTs, data: moment, fetchedAt: now });
            }
            if (records.length) {
                await db.putMoments(records);
            }
            return records;
        },

        // 对 ≤3h 的记录后台拉取最新，注入互动数字
        async _freshnessUpdate(records) {
            if (!records || !records.length) return;
            const now = Date.now();
            const fresh = records.filter(r => r.absTs && (now - r.absTs) <= CONFIG.FRESH_WINDOW_MS);
            if (!fresh.length) return;
            await Promise.all(fresh.map(r => this._injectFresh(r.amId)));
        },

        async _injectFresh(amId) {
            amId = parseInt(amId);
            if (!amId) return;
            const data = await api.fetchMoment(amId);
            if (!data || data.result !== 0 || !data.moment) return;
            const moment = data.moment;

            const record = state.moments.find(m => m.amId == amId);
            const absTs = record?.absTs || utils.computeAbsTs(moment.createTime, Date.now());
            await db.putMoment({ amId, absTs, data: moment, fetchedAt: Date.now() });
            if (record) record.data = moment;

            const card = document.querySelector(`.moment-plaza-item[data-am-id="${amId}"]`);
            const interactiveEl = card?.querySelector('.member-feed-interactive');
            if (interactiveEl) {
                interactiveEl.innerHTML = renderer.fillInteractive(moment, { pending: false });
                // 若评论区已展开，恢复评论按钮高亮（替换 HTML 会冲掉 active）
                const commentContainer = document.getElementById(`comments-${amId}`);
                if (commentContainer && commentContainer.style.display !== 'none') {
                    const btn = interactiveEl.querySelector('.feed-interactive-comment');
                    if (btn) btn.classList.add('active');
                }
            }
        },

        _renderList() {
            const listEl = document.getElementById('moment-list');
            if (listEl) listEl.innerHTML = renderer.renderList(state.moments);
        },

        // 首次使用：绑定链接输入 + 保留天数
        _bindSetupEvents(mainContent) {
            const input = document.getElementById('plaza-link-input');
            const btn = document.getElementById('plaza-link-btn');
            const keepDaysSel = document.getElementById('plaza-setup-keep-days');

            if (keepDaysSel) {
                keepDaysSel.addEventListener('change', (e) => {
                    utils.setKeepDays(parseInt(e.target.value) || CONFIG.KEEP_DAYS_DEFAULT);
                });
            }

            if (!input || !btn) return;

            const parseAndStart = () => {
                if (keepDaysSel) {
                    utils.setKeepDays(parseInt(keepDaysSel.value) || CONFIG.KEEP_DAYS_DEFAULT);
                }
                const value = input.value.trim();
                const match = value.match(/am(\d+)/);
                if (!match) {
                    alert('无法解析链接，请确认格式正确\n示例：https://www.acfun.cn/moment/am5073277');
                    return;
                }
                const amId = parseInt(match[1]);
                state.latestAmId = amId;
                utils.setLastAmId(amId);
                this.showPlazaView();
            };

            btn.addEventListener('click', parseAndStart);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') parseAndStart();
            });
        },

        _bindKeepDaysSelect() {
            const sel = document.getElementById('plaza-keep-days');
            if (!sel) return;
            sel.addEventListener('change', (e) => {
                utils.setKeepDays(parseInt(e.target.value) || CONFIG.KEEP_DAYS_DEFAULT);
                this._cleanupExpired();
            });
        },

        _setupScrollListener() {
            if (state._scrollHandler) {
                window.removeEventListener('scroll', state._scrollHandler);
                document.removeEventListener('scroll', state._scrollHandler);
            }

            state._scrollHandler = () => {
                const scrollTop = window.scrollY || document.documentElement.scrollTop;
                const windowHeight = window.innerHeight;
                const docHeight = document.documentElement.scrollHeight;

                const backTop = document.querySelector('.plaza-back-top');
                if (backTop) {
                    backTop.classList.toggle('visible', scrollTop > 300);
                }

                const nearBottom = scrollTop + windowHeight >= docHeight - 300;
                if (!state._downLoading && !state._noMoreDown && nearBottom) {
                    this._fetchNextBatch();
                }
            };

            window.addEventListener('scroll', state._scrollHandler, { passive: true });
            document.addEventListener('scroll', state._scrollHandler, { passive: true });
        },

        // 触底向下加载：固定 20 条，库充足直接预渲染，不足实时抓取
        async _fetchNextBatch() {
            if (state._downLoading || state._noMoreDown) return;

            const fromId = state.oldestAmId;
            if (!fromId || fromId <= 0) {
                state._noMoreDown = true;
                return;
            }

            state._downLoading = true;
            const loadMoreEl = document.getElementById('load-more-status');
            if (loadMoreEl) {
                loadMoreEl.className = 'plaza-load-more loading';
                loadMoreEl.textContent = '加载中...';
            }

            try {
                const cached = await db.getOlderThan(fromId, CONFIG.BATCH_SIZE);
                let fetched = [];
                const need = CONFIG.BATCH_SIZE - cached.length;
                if (need > 0) {
                    const fetchFrom = cached.length ? cached[cached.length - 1].amId : fromId;
                    fetched = await this._fetchAndStoreDown(fetchFrom, need);
                }

                const merged = cached.concat(fetched).sort((a, b) => b.amId - a.amId);
                const existing = new Set(state.moments.map(m => m.amId));
                const newRecords = merged.filter(r => !existing.has(r.amId));

                if (!newRecords.length) {
                    state._noMoreDown = true;
                    if (loadMoreEl) {
                        loadMoreEl.className = 'plaza-load-more';
                        loadMoreEl.textContent = '已加载全部动态';
                    }
                } else {
                    state.moments.push(...newRecords);
                    state.oldestAmId = Math.min(...newRecords.map(r => r.amId));

                    // 实时抓取补不齐，或最旧一条已 >24h → 向下到底
                    const fetchedShort = need > 0 && fetched.length < need;
                    const oldestAbs = newRecords[newRecords.length - 1]?.absTs;
                    if (fetchedShort || (oldestAbs && (Date.now() - oldestAbs) > CONFIG.DOWN_STOP_AFTER_MS)) {
                        state._noMoreDown = true;
                    }

                    this._renderList();
                    this._freshnessUpdate(newRecords);

                    if (loadMoreEl) {
                        loadMoreEl.className = 'plaza-load-more';
                        loadMoreEl.textContent = state._noMoreDown ? '已加载全部动态' : '';
                    }
                }
            } finally {
                state._downLoading = false;
            }
        },

        showOriginalView() {
            const mainContent = document.querySelector('.ac-member-main .ac-member-feeds');
            if (mainContent && this._originalContent) {
                mainContent.innerHTML = this._originalContent;
            }
        },

        _eventsBound: false,

        bindEvents() {
            if (this._eventsBound) return;
            this._eventsBound = true;

            const postComment = async (amId, content, replyToCommentId = 0) => {
                const body = `sourceId=${amId}&sourceType=4&content=${encodeURIComponent(content)}` +
                    (replyToCommentId ? `&replyToCommentId=${replyToCommentId}` : '');
                try {
                    const resp = await fetch('https://www.acfun.cn/rest/pc-direct/comment/add', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body,
                        credentials: 'include'
                    });
                    return await resp.json();
                } catch (e) {
                    utils.log('发评论失败:', e);
                    return null;
                }
            };

            document.addEventListener('click', async (e) => {
                if (e.target.closest('#up-status') || e.target.closest('#fetch-status')) {
                    this.refreshPlaza();
                    return;
                }

                // 分享（复制链接）
                const shareBtn = e.target.closest('.feed-interactive-repost');
                if (shareBtn) {
                    const card = shareBtn.closest('.moment-plaza-item');
                    if (!card) return;
                    const amId = card.dataset.amId;
                    const url = `https://www.acfun.cn/moment/am${amId}`;
                    try {
                        await navigator.clipboard.writeText(url);
                        const el = shareBtn.querySelector('span:last-child');
                        if (el) { el.textContent = '已复制'; setTimeout(() => { el.textContent = '分享'; }, 1500); }
                    } catch {
                        const input = document.createElement('input');
                        input.value = url;
                        document.body.appendChild(input);
                        input.select();
                        document.execCommand('copy');
                        input.remove();
                        const el = shareBtn.querySelector('span:last-child');
                        if (el) { el.textContent = '已复制'; setTimeout(() => { el.textContent = '分享'; }, 1500); }
                    }
                    return;
                }

                // 点赞
                const likeBtn = e.target.closest('.feed-interactive-like');
                if (likeBtn) {
                    const card = likeBtn.closest('.moment-plaza-item');
                    if (!card) return;
                    const amId = card.dataset.amId;
                    const record = state.moments.find(m => m.amId == amId);
                    const authorId = record?.data?.user?.id || record?.data?.user?.userId;
                    if (!authorId) return;

                    const isLiked = likeBtn.hasAttribute('active');
                    const result = await api.likeMoment(amId, authorId, isLiked);
                    if (result) {
                        if (isLiked) likeBtn.removeAttribute('active');
                        else likeBtn.setAttribute('active', '');
                        const nodes = likeBtn.childNodes;
                        for (let i = nodes.length - 1; i >= 0; i--) {
                            if (nodes[i].nodeType === 3 && nodes[i].textContent.trim()) {
                                const count = parseInt(nodes[i].textContent.trim()) || 0;
                                nodes[i].textContent = (isLiked ? Math.max(0, count - 1) : count + 1) + '\n    ';
                                break;
                            }
                        }
                        const m = state.moments.find(x => x.amId == amId);
                        if (m?.data) {
                            m.data.isLike = !isLiked;
                            m.data.likeCount = (m.data.likeCount || 0) + (isLiked ? -1 : 1);
                        }
                    }
                    return;
                }

                // 投蕉
                const bananaBtn = e.target.closest('.feed-interactive-banana');
                if (bananaBtn) {
                    const card = bananaBtn.closest('.moment-plaza-item');
                    if (!card) return;
                    const amId = card.dataset.amId;

                    const result = await api.throwBanana(amId);
                    if (result) {
                        if (result.result === 0) {
                            bananaBtn.setAttribute('active', '');
                            const numEl = bananaBtn.querySelector('span:last-child');
                            if (numEl) {
                                const count = parseInt(numEl.textContent) || 0;
                                numEl.textContent = count + 1;
                            }
                            const m = state.moments.find(x => x.amId == amId);
                            if (m?.data) {
                                m.data.isThrowBanana = true;
                                m.data.bananaCount = (m.data.bananaCount || 0) + 1;
                            }
                        } else if (result.error_msg) {
                            alert(result.error_msg);
                        }
                    }
                    return;
                }

                // 评论点赞
                const commentLikeBtn = e.target.closest('.area-comment-like');
                if (commentLikeBtn && commentLikeBtn.closest('.moment-comments')) {
                    const card = commentLikeBtn.closest('.moment-plaza-item');
                    const amId = card?.dataset.amId;
                    const commentItem = commentLikeBtn.closest('.area-comment-top');
                    const commentId = commentItem?.querySelector('.plaza-reply-btn')?.dataset.commentId;
                    if (!amId || !commentId) return;

                    const isLiked = commentLikeBtn.classList.contains('area-comment-up');
                    const result = await api.likeComment(amId, commentId, isLiked);
                    if (result && result.result === 0) {
                        commentLikeBtn.classList.toggle('area-comment-up');
                        const text = commentLikeBtn.textContent.trim();
                        const match = text.match(/\d+/);
                        const currentCount = match ? parseInt(match[0]) : 0;
                        const newCount = isLiked ? Math.max(0, currentCount - 1) : currentCount + 1;
                        commentLikeBtn.textContent = newCount > 0 ? `赞 ${newCount}` : '赞';
                    }
                    return;
                }

                // 点击评论数 → 展开/收起评论（单条请求更新）
                const commentBtn = e.target.closest('.feed-interactive-comment');
                if (commentBtn) {
                    const card = commentBtn.closest('.moment-plaza-item');
                    if (!card) return;
                    const amId = card.dataset.amId;
                    const container = document.getElementById(`comments-${amId}`);
                    if (!container) return;

                    if (container.style.display !== 'none') {
                        container.style.display = 'none';
                        commentBtn.classList.remove('active');
                        return;
                    }

                    if (container.innerHTML) {
                        container.style.display = '';
                        commentBtn.classList.add('active');
                        return;
                    }

                    container.style.display = '';
                    container.innerHTML = '<div class="plaza-comment-empty">评论加载中...</div>';
                    commentBtn.classList.add('active');

                    // 展开时同时刷新该条互动数据（赞/评/投蕉数字），评论单独拉取
                    this._injectFresh(amId);
                    const data = await api.fetchComments(amId);
                    container.innerHTML = renderer.renderComments(data, amId);
                    return;
                }

                // 点击"回复"按钮
                const replyBtn = e.target.closest('.plaza-reply-btn');
                if (replyBtn) {
                    const commentId = replyBtn.dataset.commentId;
                    const box = document.getElementById(`reply-box-${commentId}`);
                    document.querySelectorAll('.plaza-reply-box').forEach(b => b.style.display = 'none');
                    if (box && box.style.display === 'none') {
                        box.style.display = 'flex';
                        box.querySelector('input')?.focus();
                    }
                    return;
                }

                // 回复"发送"
                const replySend = e.target.closest('.plaza-reply-send');
                if (replySend) {
                    const amId = replySend.dataset.amId;
                    const replyTo = replySend.dataset.replyTo;
                    const input = replySend.previousElementSibling;
                    const content = input?.value?.trim();
                    if (!content) return;

                    replySend.disabled = true;
                    replySend.textContent = '...';
                    const result = await postComment(amId, content, parseInt(replyTo));
                    if (result && result.result === 0) {
                        const newComment = renderer.renderComment(result, amId, true);
                        const commentItem = replySend.closest('.area-comment-top');
                        if (commentItem) {
                            let secList = commentItem.querySelector('.area-sec-list');
                            if (!secList) {
                                const secDiv = document.createElement('div');
                                secDiv.className = 'area-comment-sec clearfix';
                                secDiv.innerHTML = '<div class="area-sec-list"></div>';
                                const hr = commentItem.querySelector('hr');
                                commentItem.insertBefore(secDiv, hr);
                                secList = secDiv.querySelector('.area-sec-list');
                            }
                            secList.insertAdjacentHTML('beforeend', newComment);
                        }
                        input.value = '';
                        replySend.closest('.plaza-reply-box').style.display = 'none';
                    } else {
                        alert('发送失败，请重试');
                    }
                    replySend.disabled = false;
                    replySend.textContent = '发送';
                    return;
                }

                // 发评论
                const editorSend = e.target.closest('.plaza-editor-send');
                if (editorSend) {
                    const amId = editorSend.dataset.amId;
                    const input = editorSend.previousElementSibling;
                    const content = input?.value?.trim();
                    if (!content) return;

                    editorSend.disabled = true;
                    editorSend.textContent = '...';
                    const result = await postComment(amId, content);
                    if (result && result.result === 0) {
                        const container = document.getElementById(`comments-${amId}`);
                        const list = container.querySelector('.plaza-comment-list');
                        if (list) {
                            list.insertAdjacentHTML('afterbegin', renderer.renderComment(result, amId));
                        }
                        input.value = '';
                    } else {
                        alert('发送失败，请重试');
                    }
                    editorSend.disabled = false;
                    editorSend.textContent = '发送';
                }
            });

            document.addEventListener('keydown', async (e) => {
                if (e.key !== 'Enter') return;
                const input = e.target.closest('.plaza-reply-input');
                if (input) {
                    e.preventDefault();
                    input.nextElementSibling?.click();
                }
            });

            document.addEventListener('focusin', (e) => {
                if (e.target.closest('.plaza-editor-input')) {
                    document.querySelectorAll('.plaza-reply-box').forEach(b => b.style.display = 'none');
                }
            });
        },

        setupFeedsPage() {
            if (GM_getValue('moment_plaza_auto_enter', false)) {
                GM_setValue('moment_plaza_auto_enter', false);
                const waitForContent = setInterval(() => {
                    const mainContent = document.querySelector('.ac-member-main .ac-member-feeds');
                    if (mainContent) {
                        clearInterval(waitForContent);
                        this.enterPlaza();
                    }
                }, 300);
                return;
            }

            setTimeout(() => {
                this.addPlazaPromotion();
            }, 1000);
        },

        addPlazaPromotion() {
            if (document.querySelector('.plaza-promotion')) return;

            const header = document.querySelector('.ac-member-feeds-header');
            if (header) {
                const promotion = document.createElement('div');
                promotion.className = 'plaza-promotion';
                promotion.style.cssText = `
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 16px;
                    background: #f5f5f5;
                    margin: 0 16px 16px;
                    border-radius: 4px;
                    font-size: 14px;
                    color: #666;
                `;
                promotion.innerHTML = `
                    <span>按am号查找动态，试试<strong style="color: #ff4b76;">动态广场</strong></span>
                    <button style="background: #ff4b76; color: #fff; border: none; padding: 4px 16px; border-radius: 4px; cursor: pointer;">进入</button>
                `;

                promotion.querySelector('button').addEventListener('click', () => {
                    this.enterPlaza();
                });

                header.parentNode.insertBefore(promotion, header.nextSibling);
            }
        }
    };

    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => app.init());
    } else {
        app.init();
    }

})();
