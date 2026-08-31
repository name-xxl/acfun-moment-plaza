// ==UserScript==
// @name         AcFun 动态广场
// @namespace    https://www.acfun.cn/
// @version      2.0.0
// @description  按am号查找动态，按时间排序显示
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

    // 配置
    const CONFIG = {
        MOMENT_API: 'https://www.acfun.cn/rest/pc-direct/moment/detail',
        CONCURRENT: 10,       // 并发请求数
        MAX_EMPTY: 30,        // 连续空号上限
        BATCH_SIZE: 20,       // 每批加载数量
        // 密集搜索（不跳跃，逐个检查）
        JUMP_THRESHOLD: 999,  // 不触发跳跃
        JUMP_STEP_SMALL: 1,
        JUMP_STEP_LARGE: 1,
    };

    // 状态
    const state = {
        moments: [],          // 当前显示的动态（临时，不持久化）
        latestAmId: 0,        // 已知最新am号（唯一持久化数据）
        oldestAmId: 0,        // 当前显示的最旧am号
        // 向下滚动
        _scrollHandler: null,
        _downLoading: false,
        _noMoreDown: false,
        // 向上持续查找
        _upRunning: false,
        _upAtCeiling: false,
        _upTimer: null,
        _upLatestAm: 0,       // 向上查找到的最新am号（待发布）
    };

    const LAST_AM_KEY = 'moment_plaza_last_am';

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

    // 工具函数
    const utils = {
        log(...args) {
            console.log('%c[MomentPlaza]', 'color:#ff4b76;font-weight:bold', ...args);
        },

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
            // 1. @提及: [at uid=xxx]@name[/at] → 用户主页
            html = html.replace(/\[at uid=(\d+)\]@?(.*?)\[\/at\]/g, (_, uid, name) => {
                return `<a class="plaza-at-link" href="//www.acfun.cn/u/${uid}" target="_blank">@${utils.escapeHtml(name)}</a>`;
            });
            // 2. #话题# → 搜索
            html = html.replace(/#([^#\s]{1,30}?)#/g, (_, topic) => {
                return `<a class="plaza-topic-link" href="//www.acfun.cn/search?keyword=${encodeURIComponent(topic)}" target="_blank">#${topic}#</a>`;
            });
            // 3. ac号（视频/文章通用，A站自动跳转）
            html = html.replace(/\b(ac\d{4,})\b/gi, (_, id) => {
                return `<a class="plaza-ac-link" href="//www.acfun.cn/a/${id}" target="_blank">${id}</a>`;
            });
            // 4. v/ac号 / a/ac号
            html = html.replace(/\b([va])\/(ac\d{4,})\b/gi, (_, prefix, id) => {
                return `<a class="plaza-ac-link" href="//www.acfun.cn/${prefix}/${id}" target="_blank">${prefix}/${id}</a>`;
            });
            // 5. 手机动态链接 → web端链接
            html = html.replace(/m\.acfun\.cn\/communityCircle\/moment\/(\d+)/g, (_, id) => {
                return `<a class="plaza-ac-link" href="//www.acfun.cn/moment/am${id}" target="_blank">am${id}</a>`;
            });
            // 5. 表情 → [表情]占位
            html = html.replace(/\[emot=(\w+),(\d+)\/?\]/g, '<span style="color:#999;font-size:12px;">[表情]</span>');
            html = html.replace(/\[表情\]/g, '<span style="color:#999;font-size:12px;">[表情]</span>');
            return html;
        },


        // 获取上次am号（首次使用返回0）
        getLastAmId() {
            try {
                return GM_getValue(LAST_AM_KEY, 0);
            } catch {
                return 0;
            }
        },

        // 保存上次am号
        setLastAmId(amId) {
            try {
                GM_setValue(LAST_AM_KEY, amId);
            } catch (e) {}
        }
    };

    // API请求
    const api = {
        // 根据am号获取单条动态
        async fetchMoment(amId) {
            if (!amId || amId <= 0) return null;
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: `${CONFIG.MOMENT_API}?momentId=${amId}`,
                    headers: {
                        'Accept': 'application/json',
                        'Referer': `https://www.acfun.cn/moment/am${amId}`,
                    },
                    onload: (response) => {
                        // 检查是否是JSON
                        const text = response.responseText.trim();
                        if (!text.startsWith('{') && !text.startsWith('[')) {
                            resolve(null);
                            return;
                        }

                        try {
                            const data = JSON.parse(text);
                            if (data.result === 0) {
                                resolve(data);
                            } else {
                                resolve(null);
                            }
                        } catch (e) {
                            resolve(null);
                        }
                    },
                    onerror: () => resolve(null)
                });
            });
        },

        // 获取评论列表
        async fetchComments(amId, count = 10, cursor = '') {
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
                                utils.log('token获取成功');
                            } else {
                                utils.log('token获取失败:', data.error_msg);
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
            if (!token) {
                utils.log('点赞失败: 无法获取token');
                return null;
            }
            const endpoint = isCancel ? 'delete' : 'add';
            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: `https://kuaishouzt.com/rest/zt/interact/${endpoint}`,
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
                    data: `objectId=${momentId}&objectType=10&userId=${userId}&acfun.midground.api_st=${encodeURIComponent(token)}&kpn=ACFUN_APP&kpf=PC_WEB&subBiz=mainApp&interactType=1`,
                    onload: (resp) => {
                        try {
                            const result = JSON.parse(resp.responseText);
                            utils.log(isCancel ? '取消点赞' : '点赞', '结果:', result);
                            resolve(result);
                        } catch { resolve(null); }
                    },
                    onerror: (e) => { utils.log('点赞请求失败:', e); resolve(null); }
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
        async throwBanana(momentId, toUserId) {
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

        // 向上查找新动态 - 智能跳跃查找
        async fetchNewMoments(startId, maxCount = 50) {
            const results = [];
            let currentId = startId + 1;
            let emptyCount = 0;
            let foundCount = 0;           // 连续找到计数
            let totalChecked = 0;
            let currentStep = 1;          // 当前步长
            let jumpBackId = 0;           // 跳跃回退点

            utils.log(`智能查找: 从 am${currentId} 开始，最多 ${maxCount} 个`);

            // 探测函数：批量检查一批am号
            const probeBatch = async (start, count) => {
                const batch = [];
                for (let i = 0; i < count; i++) {
                    batch.push(start + i);
                }

                const promises = batch.map(amId =>
                    this.fetchMoment(amId).then(data => {
                        totalChecked++;
                        // API返回 { result: 0, moment: { momentId, ... } }
                        if (data && data.result === 0 && data.moment) {
                            results.push({ ...data, _amId: amId });
                            return { amId, found: true };
                        }
                        return { amId, found: false };
                    })
                );

                return Promise.all(promises);
            };

            while (totalChecked < maxCount) {
                // 根据当前步长决定探测策略
                if (currentStep === 1) {
                    // 密集查找：逐个检查
                    const batchResults = await probeBatch(currentId, Math.min(CONFIG.CONCURRENT, maxCount - totalChecked));

                    let batchFound = 0;
                    for (const r of batchResults) {
                        if (r.found) {
                            batchFound++;
                            emptyCount = 0;
                        } else {
                            emptyCount++;
                        }
                    }

                    foundCount += batchFound;
                    currentId += batchResults.length;

                    // 连续找到足够多，开始跳跃
                    if (foundCount >= CONFIG.JUMP_THRESHOLD) {
                        jumpBackId = currentId;  // 记录回退点
                        currentStep = CONFIG.JUMP_STEP_SMALL;
                        foundCount = 0;
                        utils.log(`连续找到数据，跳跃步长: ${currentStep}`);
                    }

                } else {
                    // 跳跃查找：只检查一个点
                    const batchResults = await probeBatch(currentId, 1);
                    const found = batchResults[0]?.found;

                    if (found) {
                        // 跳跃点有数据，继续加大跳跃
                        foundCount++;
                        emptyCount = 0;

                        if (currentStep < CONFIG.JUMP_STEP_LARGE) {
                            currentStep = Math.min(currentStep * 3, CONFIG.JUMP_STEP_LARGE);
                            utils.log(`跳跃点有数据，步长增加到: ${currentStep}`);
                        }

                        currentId += currentStep;
                    } else {
                        // 跳跃点无数据，回退到上一个位置，密集查找
                        utils.log(`跳跃点无数据，回退到 am${jumpBackId} 密集查找`);
                        currentId = jumpBackId;
                        currentStep = 1;
                        foundCount = 0;
                        emptyCount++;
                    }
                }

                // 停止条件
                if (emptyCount >= CONFIG.MAX_EMPTY) {
                    utils.log(`连续 ${emptyCount} 个空号，停止`);
                    break;
                }

                if (currentId > startId + 10000) {
                    utils.log('超出范围限制');
                    break;
                }
            }

            utils.log(`查找完成: 检查 ${totalChecked} 个，找到 ${results.length} 条`);

            // 去重 + 按am号排序（大的在前）
            const seen = new Set();
            const unique = results.filter(m => {
                const id = m._amId || m.momentId;
                if (seen.has(id)) return false;
                seen.add(id);
                return true;
            });
            unique.sort((a, b) => (b._amId || b.momentId) - (a._amId || a.momentId));

            return unique;
        },

        // 向下查找历史动态 - 智能跳跃查找
        async fetchOldMoments(startId, maxCount = 50) {
            const results = [];
            let currentId = startId - 1;
            let emptyCount = 0;
            let foundCount = 0;
            let totalChecked = 0;
            let currentStep = 1;
            let jumpBackId = 0;

            utils.log(`智能查找: 从 am${currentId} 向下，最多 ${maxCount} 个`);

            // 探测函数
            const probeBatch = async (start, count) => {
                const batch = [];
                for (let i = 0; i < count; i++) {
                    const amId = start - i;
                    if (amId > 0) batch.push(amId);
                }

                if (batch.length === 0) return [];

                const promises = batch.map(amId =>
                    this.fetchMoment(amId).then(data => {
                        totalChecked++;
                        // API返回 { result: 0, moment: { momentId, ... } }
                        if (data && data.result === 0 && data.moment) {
                            results.push({ ...data, _amId: amId });
                            return { amId, found: true };
                        }
                        return { amId, found: false };
                    })
                );

                return Promise.all(promises);
            };

            while (totalChecked < maxCount && currentId > 0) {
                if (currentStep === 1) {
                    // 密集查找
                    const batchResults = await probeBatch(currentId, Math.min(CONFIG.CONCURRENT, maxCount - totalChecked));

                    if (batchResults.length === 0) break;

                    let batchFound = 0;
                    for (const r of batchResults) {
                        if (r.found) {
                            batchFound++;
                            emptyCount = 0;
                        } else {
                            emptyCount++;
                        }
                    }

                    foundCount += batchFound;
                    currentId -= batchResults.length;

                    // 找到数据，直接大跳（跳过小跳阶段）
                    if (foundCount >= CONFIG.JUMP_THRESHOLD) {
                        jumpBackId = currentId;
                        currentStep = CONFIG.JUMP_STEP_LARGE;
                        foundCount = 0;
                        utils.log(`连续找到数据，直接大跳: ${currentStep}`);
                    }

                } else {
                    // 跳跃查找
                    const batchResults = await probeBatch(currentId, 1);
                    const found = batchResults[0]?.found;

                    if (found) {
                        foundCount++;
                        emptyCount = 0;

                        if (currentStep < CONFIG.JUMP_STEP_LARGE) {
                            currentStep = Math.min(currentStep * 3, CONFIG.JUMP_STEP_LARGE);
                            utils.log(`跳跃点有数据，步长增加到: ${currentStep}`);
                        }

                        currentId -= currentStep;
                    } else {
                        // 回退密集查找
                        utils.log(`跳跃点无数据，回退到 am${jumpBackId}`);
                        currentId = jumpBackId;
                        currentStep = 1;
                        foundCount = 0;
                        emptyCount++;
                    }
                }

                if (emptyCount >= CONFIG.MAX_EMPTY) {
                    utils.log(`连续 ${emptyCount} 个空号，停止`);
                    break;
                }
            }

            utils.log(`查找完成: 检查 ${totalChecked} 个，找到 ${results.length} 条`);

            // 去重 + 按am号排序（大的在前）
            const seen = new Set();
            const unique = results.filter(m => {
                const id = m._amId || m.momentId;
                if (seen.has(id)) return false;
                seen.add(id);
                return true;
            });
            unique.sort((a, b) => (b._amId || b.momentId) - (a._amId || a.momentId));

            return unique;
        }
    };

    // 渲染器
    const renderer = {
        // 从原生页面获取互动区HTML
        _cachedInteractiveHtml: null,

        getInteractiveHtml() {
            if (this._cachedInteractiveHtml) return this._cachedInteractiveHtml;

            // 从原生页面克隆（iconfont字符在克隆时保留）
            const nativeFeed = document.querySelector('.ac-member-feed:not(.moment-plaza-item) .feed-interactive');
            if (nativeFeed) {
                const clone = nativeFeed.cloneNode(true);
                clone.querySelectorAll('.active').forEach(el => el.classList.remove('active'));
                this._cachedInteractiveHtml = clone.outerHTML;
                return this._cachedInteractiveHtml;
            }

            return '';
        },

        renderToolbar() {
            return `
                <div class="moment-plaza-toolbar">
                    <span class="status" id="fetch-status">加载中...</span>
                    <span class="status" id="up-status" style="color:#52c41a;font-size:12px;cursor:pointer;" title="点击刷新"></span>
                </div>
            `;
        },

        renderCard(data) {
            // API返回格式: { moment: { ... } }
            const moment = data.moment || data;
            const user = moment.user || {};

            const userId = user.id || user.userId || '';
            const userName = user.name || '';
            // 头像优先使用headCdnUrls，添加图片处理参数
            const userAvatar = (user.headCdnUrls?.[0]?.url || user.headUrl || '') + '?imageMogr2/auto-orient/format/webp/quality/80!/ignore-error/1';

            // 内容（解析UBB表情）
            const rawText = moment.text || moment.replaceUbbText || '';
            const text = utils.parseContent(rawText);

            // 图片（API字段: imgs）
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

            // 互动数据
            const commentCount = moment.commentCount || 0;
            const bananaCount = moment.bananaCount || 0;
            const likeCount = moment.likeCount || 0;

            // 时间（API返回的是相对时间字符串如"40分钟前"）
            const createTime = moment.createTime || '';
            const amId = moment.momentId || data._amId;

            // 粉丝可见
            const fansOnly = moment.visibleForFans || false;

            // 用户名颜色（根据nameColor）
            const nameColor = user.nameColor;
            let nameColorStyle = '';
            if (nameColor === 2) {
                nameColorStyle = 'color:#964cfd;'; // 紫色
            } else {
                nameColorStyle = 'color:#fd4c5c;'; // 默认红色
            }

            // 从原生页面克隆互动区HTML（含iconfont字符和Vue data-v属性）
            // 评论数：在</span>之后、</div>之前的数字
            // 香蕉数：<span>包裹的数字
            // 点赞数：like div内最后一个数字
            const isLiked = moment.isLike || false;
            const isBanana = moment.isThrowBanana || false;

            let interactiveHtml = this.getInteractiveHtml();

            // 用DOM操作替代正则，更可靠
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = interactiveHtml;

            // 评论数
            const commentDiv = tempDiv.querySelector('.feed-interactive-comment');
            if (commentDiv) {
                const nodes = commentDiv.childNodes;
                for (let i = nodes.length - 1; i >= 0; i--) {
                    if (nodes[i].nodeType === 3 && nodes[i].textContent.trim()) {
                        nodes[i].textContent = utils.formatNumber(commentCount) + '\n    ';
                        break;
                    }
                }
            }

            // 香蕉数
            const bananaDiv = tempDiv.querySelector('.feed-interactive-banana');
            if (bananaDiv) {
                if (isBanana) bananaDiv.setAttribute('active', '');
                const span = bananaDiv.querySelector('span:last-of-type');
                if (span) span.textContent = utils.formatNumber(bananaCount);
            }

            // 点赞数
            const likeDiv = tempDiv.querySelector('.feed-interactive-like');
            if (likeDiv) {
                if (isLiked) likeDiv.setAttribute('active', '');
                const nodes = likeDiv.childNodes;
                for (let i = nodes.length - 1; i >= 0; i--) {
                    if (nodes[i].nodeType === 3 && nodes[i].textContent.trim()) {
                        nodes[i].textContent = utils.formatNumber(likeCount) + '\n    ';
                        break;
                    }
                }
            }

            interactiveHtml = tempDiv.innerHTML;

            // 完全复用原生HTML结构
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

            // 子评论（楼中楼）
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

            // 把子评论挂到父评论上（subCommentsMap[id].subComments）
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

        renderList(moments) {
            if (moments.length === 0) {
                return '<div class="moment-plaza-empty">正在加载动态...</div>';
            }

            // 按am号排序，大的在前（新的在前）
            const sorted = [...moments].sort((a, b) => {
                const idA = parseInt(a.moment?.momentId || a.momentId || a._amId || 0);
                const idB = parseInt(b.moment?.momentId || b.momentId || b._amId || 0);
                return idB - idA;
            });

            return `<div class="moment-plaza-list">${sorted.map(m => this.renderCard(m)).join('')}</div>`;
        }
    };

    // 主控制器
    const app = {
        init() {
            // /member 页面：注入侧边栏 + 后台静默加载
            if (window.location.pathname.startsWith('/member')) {
                this.setupNavigation();
                this.startBackgroundWork();

                if (window.location.pathname.startsWith('/member/feeds')) {
                    this.setupFeedsPage();
                }
            }
        },

        // 启动：有am号就开始向上查找
        startBackgroundWork() {
            const knownAmId = utils.getLastAmId();
            if (!knownAmId || knownAmId <= 0) return;

            state.latestAmId = knownAmId;
            this._startUpwardLoop();
        },

        // ========== 向上查找（找20条新的就停，到顶了提示不足） ==========
        async _startUpwardLoop() {
            if (state._upRunning) return;
            state._upRunning = true;

            let cursor = state.latestAmId + 1;
            let emptyCount = 0;
            let step = 1;
            let foundNew = 0;
            const MAX_NEW = 20;
            let hitCeiling = false;

            utils.log('向上查找启动, 起点 am', cursor);
            const upStatus = document.getElementById('up-status');
            const updateUp = (t) => { if (upStatus) upStatus.textContent = t; };

            updateUp('↑正在查找新动态');

            while (state._upRunning && foundNew < MAX_NEW) {
                const ids = [];
                for (let i = 0; i < step && i < CONFIG.CONCURRENT; i++) {
                    ids.push(cursor + i);
                }

                const results = await Promise.all(ids.map(id =>
                    api.fetchMoment(id).then(data => ({
                        id,
                        found: data && data.result === 0 && data.moment,
                        data: data?.result === 0 ? data : null
                    }))
                ));

                let foundAny = false;
                for (const r of results) {
                    if (r.found) {
                        if (r.id > state._upLatestAm) {
                            state._upLatestAm = r.id;
                            foundNew++;
                        }
                        foundAny = true;
                        emptyCount = 0;
                    }
                }

                if (foundAny) {
                    cursor += ids.length;
                    updateUp(`↑已发现 ${foundNew} 条新动态`);
                    if (foundNew >= MAX_NEW) break;

                    const lastMoment = results.filter(r => r.found).pop()?.data;
                    if (lastMoment) step = this._calcUpStep(lastMoment.moment?.createTime);
                } else {
                    emptyCount += ids.length;
                    cursor += ids.length;

                    if (emptyCount >= 8) {
                        updateUp('↑正在确认是否到顶...');
                        const jumpId = cursor + 20;
                        const probe = await api.fetchMoment(jumpId);
                        if (probe && probe.result === 0 && probe.moment) {
                            cursor = jumpId;
                            emptyCount = 0;
                            step = this._calcUpStep(probe.moment?.createTime);
                        } else {
                            hitCeiling = true;
                            break;
                        }
                    }
                }

                await new Promise(r => setTimeout(r, 80));
            }

            // 查找结束
            if (foundNew > 0) {
                if (hitCeiling && foundNew < MAX_NEW) {
                    updateUp(`↑发现 ${foundNew} 条新动态（已到顶），点击刷新`);
                } else {
                    updateUp(`↑发现 ${foundNew} 条新动态，点击刷新`);
                }
            } else {
                updateUp(hitCeiling ? '已是最新' : '');
            }
            state._upRunning = false;
        },

        // 根据发布时间估算步长
        _calcUpStep(createTime) {
            if (!createTime) return 1;
            const minutes = this._parseTimeToMinutes(createTime);
            if (minutes <= 0) return 1;      // 刚刚/几秒前 → 已到顶，步长1
            if (minutes <= 5) return 1;       // 5分钟内 → 密集区，逐个找
            if (minutes <= 30) return 3;      // 30分钟 → 小跳
            if (minutes <= 120) return 5;     // 2小时内 → 中跳
            if (minutes <= 1440) return 10;   // 24小时内 → 大跳
            return 20;                        // 超过1天 → 最大跳
        },

        // 解析相对时间为分钟数
        _parseTimeToMinutes(text) {
            const m = text.match(/(\d+)\s*(秒|分钟|小时|天)/);
            if (!m) return 0;
            const n = parseInt(m[1]);
            switch (m[2]) {
                case '秒': return 0;
                case '分钟': return n;
                case '小时': return n * 60;
                case '天': return n * 1440;
                default: return 0;
            }
        },

        // 停止向上查找
        _stopUpwardLoop() {
            state._upRunning = false;
            if (state._upTimer) {
                clearTimeout(state._upTimer);
                state._upTimer = null;
            }
            const upStatus = document.getElementById('up-status');
            if (upStatus) upStatus.textContent = '';
        },

        setupNavigation() {
            const checkNav = setInterval(() => {
                // 尝试多种选择器找到侧边栏
                const feedsNav = document.querySelector('.sub-nav-title a[href="/member/feeds"]')
                    || document.querySelector('a[href="/member/feeds"]')
                    || document.querySelector('.ac-member-navigation a[href*="/feeds"]');
                if (feedsNav) {
                    clearInterval(checkNav);
                    this.addPlazaNavItem(feedsNav);
                }
            }, 500);
            // 10秒后停止查找
            setTimeout(() => clearInterval(checkNav), 10000);
        },

        addPlazaNavItem(feedsNav) {
            if (document.querySelector('.plaza-nav-item')) return;

            // 拦截"关注动态"点击：退回原界面并刷新页面
            const feedsLink = feedsNav.querySelector('a[href="/member/feeds"]') || feedsNav;
            if (feedsLink.tagName === 'A') {
                feedsLink.addEventListener('click', (e) => {
                    const mainContent = document.querySelector('.ac-member-main .ac-member-feeds');
                    if (mainContent && mainContent.querySelector('.moment-plaza-container')) {
                        e.preventDefault();
                        e.stopPropagation();
                        location.reload();
                    }
                    // 非广场状态则走默认导航
                });
            }

            // 动态广场按钮
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

                // 点击其他导航时取消动态广场选中
                subNavGroup.querySelectorAll('a:not(.plaza-nav-item)').forEach(link => {
                    link.addEventListener('click', () => {
                        plazaItem.classList.remove('ac-member-navigation-item-active');
                    });
                });
            }

            // 点击"关注动态"主标题也取消选中
            feedsNav.addEventListener('click', () => {
                plazaItem.classList.remove('ac-member-navigation-item-active');
            });
        },

        // 进入/刷新动态广场
        enterPlaza() {
            const mainContent = document.querySelector('.ac-member-main .ac-member-feeds');

            // 非 feeds 页面：跳转并标记自动进入
            if (!mainContent) {
                GM_setValue('moment_plaza_auto_enter', true);
                window.location.href = '/member/feeds';
                return;
            }

            // 始终设置选中样式
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

        // 刷新广场（点击"动态广场"时调用）
        async refreshPlaza() {
            this._stopUpwardLoop();

            const statusEl = document.getElementById('fetch-status');
            const upStatus = document.getElementById('up-status');
            const updateStatus = (t) => { if (statusEl) statusEl.textContent = t; };
            updateStatus('正在刷新...');

            // 取向上查找到的最新am号
            if (state._upLatestAm > state.latestAmId) {
                state.latestAmId = state._upLatestAm;
            }
            utils.setLastAmId(state.latestAmId);
            state._upLatestAm = 0;

            // 实时抓取最新20条（刷新点赞评论等数据）
            state._downLoading = false;
            state._noMoreDown = false;

            const moments = await this._fetchMomentsDown(state.latestAmId);
            state.moments = moments;
            if (moments.length > 0) {
                state.oldestAmId = Math.min(...moments.map(m => m._amId || Infinity));
                // 更新最新am号
                const maxAm = Math.max(...moments.map(m => m._amId || 0));
                if (maxAm > state.latestAmId) {
                    state.latestAmId = maxAm;
                    utils.setLastAmId(maxAm);
                }
            }
            this._renderList();

            updateStatus(`共 ${state.moments.length} 条动态，向下滚动加载更多`);
            if (upStatus) upStatus.textContent = '';

            // 重启向上循环
            this._startUpwardLoop();
        },

        async showPlazaView() {
            const mainContent = document.querySelector('.ac-member-main .ac-member-feeds');
            if (!mainContent) return;

            renderer.getInteractiveHtml();

            if (!this._originalContent) {
                this._originalContent = mainContent.innerHTML;
            }

            // 取_upLatestAm（向上查找找到的）
            if (state._upLatestAm > state.latestAmId) {
                state.latestAmId = state._upLatestAm;
                utils.setLastAmId(state.latestAmId);
            }

            // 没有am号 → 显示链接输入框
            if (!state.latestAmId || state.latestAmId <= 0) {
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
                        </div>
                    </div>
                `;
                this._bindSetupEvents(mainContent);
                return;
            }

            // 有am号 → 正常展示
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

            const statusEl = document.getElementById('fetch-status');
            if (statusEl) statusEl.textContent = '正在加载...';

            const moments = await this._fetchMomentsDown(state.latestAmId);
            state.moments = moments;
            if (moments.length > 0) {
                state.oldestAmId = Math.min(...moments.map(m => m._amId || Infinity));
                const maxAm = Math.max(...moments.map(m => m._amId || 0));
                if (maxAm > state.latestAmId) {
                    state.latestAmId = maxAm;
                    utils.setLastAmId(maxAm);
                }
            }
            this._renderList();
            if (statusEl) statusEl.textContent = `共 ${state.moments.length} 条动态，向下滚动加载更多`;
        },

        // 首次使用：绑定链接输入事件
        _bindSetupEvents(mainContent) {
            const input = document.getElementById('plaza-link-input');
            const btn = document.getElementById('plaza-link-btn');
            if (!input || !btn) return;

            const parseAndStart = () => {
                const value = input.value.trim();
                // 从链接解析am号：https://www.acfun.cn/moment/am5073277
                const match = value.match(/am(\d+)/);
                if (!match) {
                    alert('无法解析链接，请确认格式正确\n示例：https://www.acfun.cn/moment/am5073277');
                    return;
                }
                const amId = parseInt(match[1]);
                state.latestAmId = amId;
                utils.setLastAmId(amId);
                // 重新加载广场
                this.showPlazaView();
            };

            btn.addEventListener('click', parseAndStart);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') parseAndStart();
            });
        },

        _setupScrollListener() {
            // 清理旧监听
            if (state._scrollHandler) {
                window.removeEventListener('scroll', state._scrollHandler);
                document.removeEventListener('scroll', state._scrollHandler);
            }

            state._scrollHandler = () => {
                const scrollTop = window.scrollY || document.documentElement.scrollTop;
                const windowHeight = window.innerHeight;
                const docHeight = document.documentElement.scrollHeight;

                // 回到顶部按钮显隐
                const backTop = document.querySelector('.plaza-back-top');
                if (backTop) {
                    backTop.classList.toggle('visible', scrollTop > 300);
                }

                // 滚动加载
                const nearBottom = scrollTop + windowHeight >= docHeight - 300;
                if (!state._downLoading && !state._noMoreDown && nearBottom) {
                    utils.log('触底加载, scrollTop:', scrollTop, 'windowHeight:', windowHeight, 'docHeight:', docHeight, 'oldestAmId:', state.oldestAmId);
                    this._fetchNextBatch();
                }
            };

            window.addEventListener('scroll', state._scrollHandler, { passive: true });
            // 也监听document的scroll（兼容不同滚动容器）
            document.addEventListener('scroll', state._scrollHandler, { passive: true });
        },

        // 向下加载下一批（滚动触发，实时抓取）
        async _fetchNextBatch() {
            utils.log('_fetchNextBatch called, _downLoading:', state._downLoading, '_noMoreDown:', state._noMoreDown, 'oldestAmId:', state.oldestAmId);
            if (state._downLoading || state._noMoreDown) return;

            const startId = state.oldestAmId;
            if (!startId || startId <= 0) {
                state._noMoreDown = true;
                utils.log('无更多: oldestAmId无效');
                return;
            }

            state._downLoading = true;
            const loadMoreEl = document.getElementById('load-more-status');
            if (loadMoreEl) {
                loadMoreEl.className = 'plaza-load-more loading';
                loadMoreEl.textContent = '加载中...';
            }

            const moments = await this._fetchMomentsDown(startId);
            utils.log('_fetchNextBatch获取到:', moments?.length, '条');

            if (moments.length === 0) {
                state._noMoreDown = true;
                if (loadMoreEl) {
                    loadMoreEl.className = 'plaza-load-more';
                    loadMoreEl.textContent = '已加载全部动态';
                }
            } else {
                // 去重
                const existingIds = new Set(state.moments.map(m => m._amId || m.moment?.momentId));
                const newMoments = moments.filter(m => {
                    const id = m._amId || m.moment?.momentId;
                    return !existingIds.has(id);
                });
                utils.log('去重: 原始', moments.length, '已有', existingIds.size, '新增', newMoments.length);

                if (newMoments.length > 0) {
                    state.moments = [...state.moments, ...newMoments];
                    state.oldestAmId = Math.min(...newMoments.map(m => m._amId || Infinity));
                    utils.log('渲染列表, moments:', state.moments.length, 'oldestAmId:', state.oldestAmId);
                    try {
                        this._renderList();
                        utils.log('渲染完成');
                    } catch (e) {
                        utils.log('渲染失败:', e.message);
                    }
                } else {
                    utils.log('去重后无新数据');
                }
                if (loadMoreEl) {
                    loadMoreEl.className = 'plaza-load-more';
                    loadMoreEl.textContent = '';
                }
            }

            state._downLoading = false;
        },

        // 从API实时获取一批动态（从startId向下）
        async _fetchMomentsDown(startId, count = CONFIG.BATCH_SIZE) {
            if (!startId || startId <= 0) return [];
            try {
                return await api.fetchOldMoments(startId, count);
            } catch (e) {
                utils.log('获取动态失败:', e);
                return [];
            }
        },

        // 更新列表显示
        _renderList() {
            const listEl = document.getElementById('moment-list');
            if (listEl) listEl.innerHTML = renderer.renderList(state.moments);
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

            // 发评论API（用fetch，自动带cookie）
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
                // 点击状态栏刷新
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
                        shareBtn.querySelector('span:last-child').textContent = '已复制';
                        setTimeout(() => {
                            const el = shareBtn.querySelector('span:last-child');
                            if (el) el.textContent = '分享';
                        }, 1500);
                    } catch {
                        // fallback
                        const input = document.createElement('input');
                        input.value = url;
                        document.body.appendChild(input);
                        input.select();
                        document.execCommand('copy');
                        input.remove();
                        shareBtn.querySelector('span:last-child').textContent = '已复制';
                        setTimeout(() => {
                            const el = shareBtn.querySelector('span:last-child');
                            if (el) el.textContent = '分享';
                        }, 1500);
                    }
                    return;
                }

                // 点赞
                const likeBtn = e.target.closest('.feed-interactive-like');
                if (likeBtn) {
                    const card = likeBtn.closest('.moment-plaza-item');
                    if (!card) return;
                    const amId = card.dataset.amId;
                    const moment = state.moments.find(m => (m.moment?.momentId || m._amId) == amId);
                    const authorId = moment?.moment?.user?.id || moment?.moment?.user?.userId;
                    if (!authorId) return;

                    const isLiked = likeBtn.hasAttribute('active');
                    const result = await api.likeMoment(amId, authorId, isLiked);
                    if (result) {
                        if (isLiked) likeBtn.removeAttribute('active');
                        else likeBtn.setAttribute('active', '');
                        // 更新数字
                        const nodes = likeBtn.childNodes;
                        for (let i = nodes.length - 1; i >= 0; i--) {
                            if (nodes[i].nodeType === 3 && nodes[i].textContent.trim()) {
                                const count = parseInt(nodes[i].textContent.trim()) || 0;
                                nodes[i].textContent = (isLiked ? Math.max(0, count - 1) : count + 1) + '\n    ';
                                break;
                            }
                        }
                        // 更新本地数据
                        const m = state.moments.find(m => (m.moment?.momentId || m._amId) == amId);
                        if (m?.moment) {
                            m.moment.isLike = !isLiked;
                            m.moment.likeCount = (m.moment.likeCount || 0) + (isLiked ? -1 : 1);
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
                    const moment = state.moments.find(m => (m.moment?.momentId || m._amId) == amId);
                    const authorId = moment?.moment?.user?.id || moment?.moment?.user?.userId;
                    if (!authorId) return;

                    const result = await api.throwBanana(amId, authorId);
                    if (result) {
                        if (result.result === 0) {
                            bananaBtn.setAttribute('active', '');
                            const numEl = bananaBtn.querySelector('span:last-child');
                            if (numEl) {
                                const count = parseInt(numEl.textContent) || 0;
                                numEl.textContent = count + 1;
                            }
                            // 更新本地数据
                            if (moment?.moment) {
                                moment.moment.isThrowBanana = true;
                                moment.moment.bananaCount = (moment.moment.bananaCount || 0) + 1;
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
                        // 更新点赞数量
                        const text = commentLikeBtn.textContent.trim();
                        const match = text.match(/\d+/);
                        const currentCount = match ? parseInt(match[0]) : 0;
                        const newCount = isLiked ? Math.max(0, currentCount - 1) : currentCount + 1;
                        commentLikeBtn.textContent = newCount > 0 ? `赞 ${newCount}` : '赞';
                    }
                    return;
                }

                // 点击评论数 → 展开/收起评论
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

                    const data = await api.fetchComments(amId);
                    container.innerHTML = renderer.renderComments(data, amId);
                    return;
                }

                // 点击"回复"按钮 → 展开回复输入框（同时关闭其他）
                const replyBtn = e.target.closest('.plaza-reply-btn');
                if (replyBtn) {
                    const commentId = replyBtn.dataset.commentId;
                    const box = document.getElementById(`reply-box-${commentId}`);
                    // 先关闭所有回复框
                    document.querySelectorAll('.plaza-reply-box').forEach(b => b.style.display = 'none');
                    // 再打开当前的（如果之前是关的）
                    if (box && box.style.display === 'none') {
                        box.style.display = 'flex';
                        box.querySelector('input')?.focus();
                    }
                    return;
                }

                // 点击回复"发送"按钮
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
                            // 找到或创建子评论区
                            let secList = commentItem.querySelector('.area-sec-list');
                            if (!secList) {
                                const secDiv = document.createElement('div');
                                secDiv.className = 'area-comment-sec clearfix';
                                secDiv.innerHTML = '<div class="area-sec-list"></div>';
                                // 插入到hr之前
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

                // 点击评论区的"发评论"按钮
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

            // 回复框回车发送
            document.addEventListener('keydown', async (e) => {
                if (e.key !== 'Enter') return;
                const input = e.target.closest('.plaza-reply-input');
                if (input) {
                    e.preventDefault();
                    input.nextElementSibling?.click();
                }
            });

            // 点击/聚焦顶部发评论输入框 → 关闭所有回复框
            document.addEventListener('focusin', (e) => {
                if (e.target.closest('.plaza-editor-input')) {
                    document.querySelectorAll('.plaza-reply-box').forEach(b => b.style.display = 'none');
                }
            });
        },

        setupFeedsPage() {
            // 从其他页面跳转过来，自动进入广场
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
