// ==UserScript==
// @name         AcFun 动态广场
// @namespace    https://www.acfun.cn/
// @version      3.2.9
// @description  按am号查找动态，按时间排序显示，IndexedDB 预加载缓存
// @author       name_xxl
// @match        https://www.acfun.cn/member*
// @downloadURL  https://raw.githubusercontent.com/name-xxl/acfun-moment-plaza/main/list/acfun-moment-plaza.user.js
// @updateURL    https://raw.githubusercontent.com/name-xxl/acfun-moment-plaza/main/list/acfun-moment-plaza.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      www.acfun.cn
// @connect      id.app.acfun.cn
// @connect      kuaishouzt.com
// @run-at       document-idle
// ==/UserScript==

"use strict";
(() => {
  // src/css.js
  var layoutStyles = `
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
`;
  var interactiveStyles = `
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

    .feed-interactive-comment {
        cursor: pointer;
    }
`;
  var commentStyles = `
    /* 评论区（仿原生） */
    .moment-comments {
        border-top: 1px solid #e6e6e6;
        margin-top: -1px;
    }
    .plaza-comment-title {
        padding-top: 18px;
        font-size: 12px;
        color: #666;
        line-height: 20px;
    }
    .moment-comments .area-comment-first {
        display: flex;
        padding: 15px 0 0;
        position: relative;
    }
    .moment-comments .area-comment-left {
        flex-shrink: 0;
        width: 58px;
    }
    .moment-comments .area-comment-left .thumb {
        display: block;
        width: 50px;
        height: 50px;
    }
    .moment-comments .area-comment-left .avatar {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        object-fit: cover;
    }
    .moment-comments .area-comment-right {
        flex: 1;
        margin-left: 30px;
        min-width: 0;
    }
    .moment-comments .area-comment-title {
        display: flex;
        align-items: center;
        height: 20px;
        line-height: 20px;
        font-size: 12px;
    }
    .moment-comments .area-comment-title .name {
        text-decoration: none;
        margin-right: 6px;
    }
    .moment-comments .area-comment-title .time_day {
        color: #999;
        font-size: 12px;
        margin-right: 4px;
    }
    .moment-comments .area-comment-title .time_times {
        color: #999;
        font-size: 12px;
    }
    .moment-comments .area-comment-des {
        margin: 8px 0 13px;
        font-size: 14px;
        color: #333;
        line-height: 1.4;
        word-break: break-all;
    }
    .moment-comments .area-comment-des-content {
        margin: 0;
    }
    .moment-comments .area-comment-tool {
        margin: 0 0 17px;
        font-size: 12px;
        color: #999;
    }
    .moment-comments .area-comment-like {
        color: #999;
        cursor: pointer;
        margin-right: 13px;
    }
    .moment-comments .area-comment-like::before {
        content: '';
        display: inline-block;
        width: 13px;
        height: 13px;
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
        color: #999;
    }
    .moment-comments .area-comment-from a {
        color: #999;
        text-decoration: none;
    }
    .moment-comments .index-comment {
        position: absolute;
        right: 10px;
        top: 15px;
        color: #999;
        font-size: 12px;
    }
    .moment-comments .area-comment-top hr {
        border: none;
        border-top: 1px solid #e6e6e6;
        margin: 3px 0;
    }
    /* 楼中楼 */
    .moment-comments .area-comment-sec {
        margin: 0 0 20px 88px;
        background: #f7f7f7;
        padding: 20px 0 0;
    }
    .moment-comments .area-comment-sec .area-comment-left {
        width: 40px;
    }
    .moment-comments .area-comment-sec .area-comment-left .thumb {
        width: 40px;
        height: 30px;
    }
    .moment-comments .area-comment-sec .avatar {
        width: 30px;
        height: 30px;
    }
    .moment-comments .area-comment-sec .area-comment-right {
        margin-left: 0;
        padding-right: 10px;
    }
    .moment-comments .area-comment-sec .area-comment-first {
        padding: 0 10px 0;
        margin: 15px 0 0;
    }
    .moment-comments .area-comment-sec .sec:first-child .area-comment-first {
        margin-top: 0;
    }
    .moment-comments .area-comment-sec .name {
        color: #333;
        font-weight: 700;
    }
    .moment-comments .area-comment-sec hr {
        display: none;
    }
    .plaza-reply-prefix {
        color: #999;
        font-size: 14px;
    }
    .moment-comments .plaza-up-tag {
        background: #fd4c5c;
        color: #fff;
        font-size: 10px;
        padding: 0 4px;
        border-radius: 2px;
        margin-right: 6px;
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
`;
  var editorStyles = `
    /* 发评论框（还原原生 fold 态：白框 + 大占位文案，聚焦后展开工具行） */
    .plaza-comment-editor {
        position: relative;
        margin-top: 12px;
        border: 1px solid #e6e6e6;
        border-radius: 4px;
    }
    .plaza-comment-editor:focus-within {
        border-color: #fd4c5c;
    }
    .plaza-comment-editor textarea {
        display: block;
        width: 100%;
        height: 67px;
        padding: 10px 12px;
        border: none;
        box-sizing: border-box;
        background: transparent;
        font-family: inherit;
        font-size: 14px;
        line-height: 1.5;
        resize: none;
        outline: none;
    }
    .plaza-comment-editor textarea::placeholder {
        color: #999;
    }
    .plaza-editor-actions {
        display: none;
        align-items: center;
        border-top: 1px solid #e6e6e6;
        padding: 6px 10px;
    }
    .plaza-comment-editor.expanded .plaza-editor-actions {
        display: flex;
    }
    .plaza-editor-tool {
        width: 26px;
        height: 26px;
        margin-right: 6px;
        border-radius: 3px;
        cursor: pointer;
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23999'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm-7 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z'/%3E%3C/svg%3E") no-repeat center;
    }
    .plaza-editor-tool:hover {
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23fd4c5c'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm-7 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z'/%3E%3C/svg%3E") no-repeat center;
    }
    .plaza-editor-img {
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23999'%3E%3Cpath d='M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z'/%3E%3C/svg%3E") no-repeat center;
    }
    .plaza-editor-img:hover {
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23fd4c5c'%3E%3Cpath d='M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z'/%3E%3C/svg%3E") no-repeat center;
    }
    .plaza-editor-send {
        margin-left: auto;
    }
    .plaza-comment-editor button {
        height: 28px;
        padding: 0 18px;
        background: #fd4c5c;
        color: #fff;
        border: none;
        border-radius: 3px;
        font-size: 13px;
        cursor: pointer;
    }
    .plaza-comment-editor button:disabled {
        opacity: .6;
        cursor: default;
    }
    /* 待发送图片预览 */
    .plaza-editor-pending {
        display: flex;
        align-items: flex-start;
        gap: 6px;
        margin: 0 12px 8px;
    }
    .plaza-editor-pending img {
        max-width: 120px;
        max-height: 90px;
        border-radius: 3px;
        border: 1px solid #e6e6e6;
    }
    .plaza-editor-pending-del {
        cursor: pointer;
        color: #999;
        font-size: 16px;
        line-height: 1;
        padding: 2px 4px;
    }
    .plaza-editor-pending-del:hover {
        color: #fd4c5c;
    }
    /* 表情面板 */
    .plaza-emot-panel {
        position: absolute;
        bottom: calc(100% + 6px);
        left: 0;
        width: 360px;
        max-height: 300px;
        overflow-y: auto;
        background: #fff;
        border: 1px solid #e6e6e6;
        border-radius: 6px;
        box-shadow: 0 4px 16px rgba(0,0,0,.12);
        padding: 10px 12px;
        z-index: 100;
    }
    .plaza-emot-pack-name {
        font-size: 12px;
        color: #999;
        margin: 8px 0 6px;
    }
    .plaza-emot-pack:first-child .plaza-emot-pack-name {
        margin-top: 0;
    }
    .plaza-emot-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, 34px);
        gap: 4px;
    }
    .plaza-emot-item {
        width: 30px;
        height: 30px;
        object-fit: contain;
        cursor: pointer;
    }
    .plaza-emot-item[data-pkg="AC娘迷你版"] {
        width: 26px;
        height: 26px;
    }
    .plaza-emot-empty {
        color: #999;
        font-size: 12px;
        padding: 8px 0;
    }
    /* 回复按钮与回复框 */
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
        flex-direction: column;
        gap: 8px;
        margin-top: 8px;
    }
    .plaza-reply-box .plaza-comment-editor {
        margin-top: 0;
    }
    /* 楼层回复框没有 fold 态，一显示就展开工具行 */
    .plaza-reply-box .plaza-editor-actions {
        display: flex;
    }
`;
  var contentStyles = `
    /* 转发内容卡片（视频/文章/漫画） */
    .plaza-repost-card {
        display: flex;
        margin-top: 10px;
        padding: 10px;
        background: #f8f8f8;
        border-radius: 4px;
        text-decoration: none;
    }
    .plaza-repost-card:hover {
        background: #f0f0f0;
    }
    .plaza-repost-cover {
        flex-shrink: 0;
        width: 120px;
        height: 68px;
        object-fit: cover;
        border-radius: 3px;
        margin-right: 10px;
    }
    .plaza-repost-info {
        flex: 1;
        min-width: 0;
    }
    .plaza-repost-title {
        font-size: 14px;
        color: #333;
        line-height: 20px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
    .plaza-repost-meta {
        margin-top: 8px;
        font-size: 12px;
        color: #999;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .plaza-repost-tag {
        color: #fd4c5c;
        border: 1px solid #fd4c5c;
        border-radius: 2px;
        font-size: 10px;
        line-height: 16px;
        padding: 0 4px;
    }
    /* UBB [img] 行内图片 */
    .plaza-ubb-img {
        max-width: 100%;
        border-radius: 3px;
        margin: 4px 0;
    }
    /* 正文链接（@提及/#话题#/ac/am 号）用原生蓝 */
    .plaza-at-link,
    .plaza-topic-link,
    .plaza-ac-link {
        color: #409bef;
        text-decoration: none;
    }
    .plaza-at-link:hover,
    .plaza-topic-link:hover,
    .plaza-ac-link:hover {
        color: #409bef;
        text-decoration: underline;
    }
    .ubb-emotion {
        max-width: 48px;
        max-height: 48px;
        vertical-align: bottom;
        margin: 2px 0;
    }
    .ubb-emotion[data-pkgname="AC娘迷你版"] {
        max-width: 26px;
        max-height: 26px;
    }
`;
  var uiStyles = `
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
`;
  var styles = layoutStyles + interactiveStyles + commentStyles + editorStyles + contentStyles + uiStyles;
  function injectStyles() {
    GM_addStyle(styles);
  }

  // src/config.js
  var CONFIG = {
    MOMENT_API: "https://www.acfun.cn/rest/pc-direct/moment/detail",
    CONCURRENT: 10,
    // 并发请求数
    MAX_EMPTY: 30,
    // 连续空号上限
    BATCH_SIZE: 20,
    // 向上/向下每次加载的固定条数
    FRESH_WINDOW_MS: 3 * 3600 * 1e3,
    // 发布 ≤3 小时 → 互动数字用加载动画 + 后台注入
    UP_STOP_AT_MS: 1 * 3600 * 1e3,
    // 向上爬到「发布 ≤1 小时」的动态即停
    DOWN_STOP_AFTER_MS: 24 * 3600 * 1e3,
    // 向下爬到「发布 >24 小时」的动态即停
    UP_POLL_INTERVAL: 60 * 1e3,
    // 向上后台轮询的基准间隔
    UP_POLL_BACKOFF_MAX_MS: 10 * 60 * 1e3,
    // 向上轮询空手而归后的退避上限
    KEEP_DAYS_DEFAULT: 3,
    // 数据库默认保留天数（1-7 可调）
    CRAWL_BATCH_DELAY_MS: 60,
    // 爬取批次之间的停顿
    SCAN_LIMIT_MULTIPLIER: 50,
    // 单次爬取的扫描上限 = 目标条数 × 此倍数
    TOKEN_TTL_MS: 30 * 60 * 1e3,
    // 互动 API token 有效期
    MAX_IMAGES: 9,
    // 单条动态最多展示的图片数
    BACK_TOP_THRESHOLD: 300,
    // 距顶部多少像素显示回顶按钮
    SCROLL_BOTTOM_OFFSET: 300,
    // 距底部多少像素判定触底
    NAV_POLL_INTERVAL: 500,
    // 等待导航栏出现的轮询间隔
    NAV_POLL_TIMEOUT: 1e4,
    // 等待导航栏出现的超时
    FEEDS_POLL_INTERVAL: 300,
    // 等待 feeds 页内容出现的轮询间隔
    PROMOTION_DELAY_MS: 1e3,
    // feeds 页推广条延迟出现
    TOAST_DURATION_MS: 1500,
    // 分享复制成功提示时长
    COMMENT_PAGE_SIZE: 10,
    // 评论列表每页条数
    UP_CRAWL_TARGET: 50,
    // 向上后台爬取的目标条数
    FF_STALE_THRESHOLD_MS: 2 * 3600 * 1e3,
    // 数据超过此时间视为旧，触发快速定位
    FF_PROBE_SPAN_MS: 10 * 60 * 1e3,
    // 探针采样宽度覆盖的时间跨度（按速率换算成 ID 数）
    FF_PROBE_SIZE: 5,
    // 探针最少采样的连续 am 号数（速率未知时）
    FF_PROBE_MAX: 30,
    // 探针最多采样的连续 am 号数
    FF_CONVERGE_GAP: 20,
    // 上下界收敛到此间隔即停止，交给逐号补抓
    FF_MAX_PROBES: 24,
    // 最大探针轮数
    FF_INITIAL_STEP: 2e3,
    // 速率未知时的盲跳初始步长
    FF_STEP_MULTIPLIER: 4,
    // 盲跳命中后的步长倍率
    FF_MIN_STEP: 50,
    // 盲跳落空则减半，低于此值即认定越过边界
    KEEP_DAYS_OPTIONS: [1, 2, 3, 4, 5, 6, 7],
    // 保留天数可选项
    UPLOAD_CHUNK_SIZE: 1 * 1024 * 1024,
    // 评论图片上传分片大小（与原生一致 1M）
    MAX_IMAGE_SIZE: 5 * 1024 * 1024
    // 评论图片大小上限（原生提示 5M）
  };
  var LAST_AM_KEY = "moment_plaza_last_am";
  var KEEP_DAYS_KEY = "moment_plaza_keep_days";
  var AUTO_ENTER_KEY = "moment_plaza_auto_enter";
  var LAST_DISCOVERY_KEY = "moment_plaza_last_discovery";
  var SEL_MAIN_FEEDS = ".ac-member-main .ac-member-feeds";
  var NAME_COLOR_PURPLE = "#964cfd";
  var NAME_COLOR_RED = "#fd4c5c";

  // src/state.js
  var state = {
    // amId 在 state/DB 中为 number，在 DOM dataset 中为 string，比较时用 == 做类型转换是有意为之
    moments: [],
    // 当前展示的记录 [{ amId, absTs, data, fetchedAt }]
    latestAmId: 0,
    // 已知最大 am 号（向上探测边界，持久化）
    oldestAmId: 0,
    // 当前展示最旧 am 号
    _scrollHandler: null,
    _downLoading: false,
    _noMoreDown: false,
    _upRunning: false,
    // 正在向上爬取
    _upPollTimer: null,
    // 向上定时器
    _upBackoffMs: 0,
    // 向上轮询当前退避间隔（空手而归翻倍，命中即复位）
    _upNextAt: 0,
    // 早于该时间戳不发起向上爬取
    _upProbedTo: 0,
    // 本次会话已向上探测到的最高 am 号（跨空号断层用，页面刷新后重探）
    _upGeneration: 0,
    // 向上搜索代数，refresh 时递增使旧搜索回调失效
    emoticonMap: null,
    // 表情码→图片 { emotionId: { url, pkg } }
    emoticonPacks: null
    // 表情面板数据 [{ name, items: [{ id, url }] }]
  };

  // src/utils.js
  var utils = {
    log(...args) {
      console.log("%c[MomentPlaza]", "color:#ff4b76;font-weight:bold", ...args);
    },
    // 绝对时间戳 → 相对时间 / 日期
    formatTime(timestamp) {
      if (!timestamp) return "";
      const now = Date.now();
      const diff = now - timestamp;
      const minutes = Math.floor(diff / 6e4);
      const hours = Math.floor(diff / 36e5);
      const days = Math.floor(diff / 864e5);
      if (minutes < 1) return "刚刚";
      if (minutes < 60) return `${minutes}分钟前`;
      if (hours < 24) return `${hours}小时前`;
      if (days < 30) return `${days}天前`;
      const date = new Date(timestamp);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    },
    // 相对时间/绝对时间 → 距今毫秒数（"40分钟前" → 40*60000；标准时间 → now - ts）
    parseAgeMs(text) {
      if (!text) return 0;
      const str = String(text);
      const absTs = Date.parse(str);
      if (!isNaN(absTs)) {
        return Math.max(0, Date.now() - absTs);
      }
      const m = str.match(/(\d+)\s*(秒|分钟|小时|天)/);
      if (!m) return 0;
      const n = parseInt(m[1]);
      switch (m[2]) {
        case "秒":
          return n * 1e3;
        case "分钟":
          return n * 6e4;
        case "小时":
          return n * 36e5;
        case "天":
          return n * 864e5;
        default:
          return 0;
      }
    },
    // 由相对时间反推绝对时间戳（API 不返回绝对时间）
    computeAbsTs(createTime, fetchedAt) {
      const offset = this.parseAgeMs(createTime);
      if (!offset) return fetchedAt || Date.now();
      return (fetchedAt || Date.now()) - offset;
    },
    formatNumber(num) {
      if (!num) return "0";
      if (num >= 1e4) return (num / 1e4).toFixed(1) + "万";
      return num.toString();
    },
    escapeHtml(text) {
      if (!text) return "";
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    },
    // 统一属性值转义（HTML 标签内用）
    attrEscape(value) {
      return this.escapeHtml(String(value));
    },
    // 把已有 HTML 标签替换成占位符，避免链接规则误伤属性里的关键词
    _withProtectedTags(html, callback) {
      const tags = [];
      const placeholder = () => `<!--PLAZA_TAG_${tags.length}-->`;
      const withoutTags = html.replace(/<[^>]+>/g, (match) => {
        const p = placeholder();
        tags.push(match);
        return p;
      });
      const result = callback(withoutTags);
      return result.replace(/<!--PLAZA_TAG_(\d+)-->/g, (_, i) => tags[parseInt(i)]);
    },
    // 解析动态内容（表情、图片、@提及、#话题#、ac号）
    parseContent(text) {
      if (!text) return "";
      let html = utils.escapeHtml(text);
      html = html.replace(/\[表情\]/g, '<span style="color:#999;font-size:12px;">[表情]</span>');
      html = html.replace(/\[emot=acfun,(\d+)\/?\]/g, (_, id) => {
        const emo = state.emoticonMap && state.emoticonMap[id];
        return emo ? `<img class="ubb-emotion" data-pkgname="${emo.pkg.replace(/"/g, "%22")}" src="${emo.url.replace(/"/g, "%22")}">` : '<span style="color:#999;font-size:12px;">[表情]</span>';
      });
      html = html.replace(/\[emot=(\w+),(\d+)\/?\]/g, '<img class="ubb-emotion" src="//cdn.aixifan.com/dotnet/20130418/umeditor/dialogs/emotion/images/$1/$2.gif">');
      html = html.replace(/\[img(?:=[^\]]*)?\](https?:\/\/[^[\s]+?)\[\/img\]/gi, (_, url) => {
        return `<img class="plaza-ubb-img" src="${url.replace(/"/g, "%22")}">`;
      });
      html = utils._withProtectedTags(html, (protectedHtml) => {
        let h = protectedHtml;
        h = h.replace(/\[at uid=(\d+)\]@?(.*?)\[\/at\]/g, (_, uid, name) => {
          return `<a class="plaza-at-link" href="//www.acfun.cn/u/${uid}" target="_blank">@${utils.escapeHtml(name)}</a>`;
        });
        h = h.replace(/#([^#\s]{1,30}?)#/g, (_, topic) => {
          return `<a class="plaza-topic-link" href="//www.acfun.cn/search?keyword=${encodeURIComponent(topic)}" target="_blank">#${topic}#</a>`;
        });
        h = h.replace(/\b(?:([va])\/)?(ac\d{4,})\b/gi, (_, prefix, id) => {
          const type = (prefix || "a").toLowerCase();
          const display = prefix ? `${prefix}/${id}` : id;
          return `<a class="plaza-ac-link" href="//www.acfun.cn/${type}/${id}" target="_blank">${display}</a>`;
        });
        h = h.replace(/m\.acfun\.cn\/communityCircle\/moment\/(\d+)/g, (_, id) => {
          return `<a class="plaza-ac-link" href="//www.acfun.cn/moment/am${id}" target="_blank">am${id}</a>`;
        });
        return h;
      });
      html = html.replace(/\r?\n/g, "<br>");
      return html;
    },
    getLastAmId() {
      try {
        return GM_getValue(LAST_AM_KEY, 0);
      } catch {
        return 0;
      }
    },
    setLastAmId(amId) {
      try {
        GM_setValue(LAST_AM_KEY, amId);
      } catch (e) {
      }
    },
    getKeepDays() {
      try {
        const d = GM_getValue(KEEP_DAYS_KEY, CONFIG.KEEP_DAYS_DEFAULT);
        return Math.min(7, Math.max(1, parseInt(d) || CONFIG.KEEP_DAYS_DEFAULT));
      } catch {
        return CONFIG.KEEP_DAYS_DEFAULT;
      }
    },
    setKeepDays(days) {
      try {
        GM_setValue(KEEP_DAYS_KEY, Math.min(7, Math.max(1, days || CONFIG.KEEP_DAYS_DEFAULT)));
      } catch (e) {
      }
    },
    getLastDiscoveryAt() {
      try {
        return parseInt(GM_getValue(LAST_DISCOVERY_KEY, 0)) || 0;
      } catch {
        return 0;
      }
    },
    setLastDiscoveryAt(ts) {
      try {
        GM_setValue(LAST_DISCOVERY_KEY, ts);
      } catch (e) {
      }
    }
  };

  // src/db.js
  var DB_NAME = "moment-plaza";
  var DB_VERSION = 1;
  var STORE_MOMENTS = "moments";
  var _dbPromise = null;
  var db = {
    open() {
      if (_dbPromise) return _dbPromise;
      _dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const d = e.target.result;
          if (!d.objectStoreNames.contains(STORE_MOMENTS)) {
            const store = d.createObjectStore(STORE_MOMENTS, { keyPath: "amId" });
            store.createIndex("by_absTs", "absTs");
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          _dbPromise = null;
          reject(req.error);
        };
      });
      return _dbPromise;
    },
    async putMoment(record) {
      const d = await this.open();
      return new Promise((resolve, reject) => {
        const tx = d.transaction(STORE_MOMENTS, "readwrite");
        tx.objectStore(STORE_MOMENTS).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    async putMoments(records) {
      if (!records || !records.length) return;
      const d = await this.open();
      return new Promise((resolve, reject) => {
        const tx = d.transaction(STORE_MOMENTS, "readwrite");
        const store = tx.objectStore(STORE_MOMENTS);
        records.forEach((r) => store.put(r));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    // 取 amId < fromId 的 count 条（按 amId 降序，即较新的在前）
    // 旧版本存下的「粉丝可见」遗留记录不进入展示流（会随保留天数自动清除）
    async getOlderThan(fromId, count) {
      const d = await this.open();
      return new Promise((resolve, reject) => {
        const store = d.transaction(STORE_MOMENTS, "readonly").objectStore(STORE_MOMENTS);
        const range = IDBKeyRange.upperBound(fromId, true);
        const result = [];
        const req = store.openCursor(range, "prev");
        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (!cursor) {
            resolve(result);
            return;
          }
          if (!(cursor.value.data && cursor.value.data.visibleForFans)) {
            result.push(cursor.value);
          }
          if (result.length < count) {
            cursor.continue();
          } else {
            resolve(result);
          }
        };
        req.onerror = () => reject(req.error);
      });
    },
    // 删除 absTs < cutoffTs 的过期记录
    async deleteOlderThan(cutoffTs) {
      const d = await this.open();
      return new Promise((resolve, reject) => {
        const store = d.transaction(STORE_MOMENTS, "readwrite").objectStore(STORE_MOMENTS);
        const index = store.index("by_absTs");
        const range = IDBKeyRange.upperBound(cutoffTs);
        const req = index.openCursor(range);
        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else resolve();
        };
        req.onerror = () => reject(req.error);
      });
    }
  };

  // src/api.js
  var _apiToken = null;
  var _tokenExpiry = 0;
  var _emoticonPromise = null;
  function _applyEmoticons(flat) {
    const map = {};
    const packs = [];
    const byName = {};
    for (const u of flat) {
      if (!u || !u.emotionId || !u.emotionImageUrl) continue;
      map[u.emotionId] = { url: u.emotionImageUrl, pkg: u.emotionPkgName || "" };
      let pack = byName[u.emotionPkgName];
      if (!pack) {
        pack = byName[u.emotionPkgName] = { name: u.emotionPkgName || "表情", items: [] };
        packs.push(pack);
      }
      pack.items.push({ id: u.emotionId, url: u.emotionImageUrl });
    }
    state.emoticonMap = map;
    state.emoticonPacks = packs;
  }
  var api = {
    // 根据am号获取单条动态
    fetchMoment(amId) {
      if (!amId || amId <= 0) return Promise.resolve(null);
      return new Promise((resolve) => {
        GM_xmlhttpRequest({
          method: "GET",
          url: `${CONFIG.MOMENT_API}?momentId=${amId}`,
          headers: {
            "Accept": "application/json",
            "Referer": `https://www.acfun.cn/moment/am${amId}`
          },
          onload: (response) => {
            const text = response.responseText.trim();
            if (!text.startsWith("{") && !text.startsWith("[")) {
              resolve(null);
              return;
            }
            try {
              const data = JSON.parse(text);
              if (data.result === 0) {
                if (data.repostSource && data.moment) {
                  data.moment.repostSource = data.repostSource;
                }
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
    fetchComments(amId, count = CONFIG.COMMENT_PAGE_SIZE, cursor = "") {
      return new Promise((resolve) => {
        GM_xmlhttpRequest({
          method: "GET",
          url: `https://www.acfun.cn/rest/pc-direct/comment/list?sourceId=${amId}&sourceType=4&cursor=${cursor}&count=${count}`,
          headers: { "Accept": "application/json", "Referer": `https://www.acfun.cn/moment/am${amId}` },
          onload: (response) => {
            try {
              const data = JSON.parse(response.responseText);
              resolve(data.result === 0 ? data : null);
            } catch {
              resolve(null);
            }
          },
          onerror: () => resolve(null)
        });
      });
    },
    // 表情包映射：优先读原生页写入的 localStorage 缓存，其次拉接口（需登录）
    fetchEmoticonPacks() {
      if (_emoticonPromise) return _emoticonPromise;
      _emoticonPromise = new Promise((resolve) => {
        try {
          const cached = JSON.parse(localStorage.getItem("emoticonList") || "null");
          if (Array.isArray(cached) && cached.length) {
            _applyEmoticons(cached);
            resolve(true);
            return;
          }
        } catch (e) {
        }
        GM_xmlhttpRequest({
          method: "POST",
          url: "https://www.acfun.cn/rest/pc-direct/emotion/getUserEmotion",
          headers: { "Accept": "application/json" },
          onload: (resp) => {
            try {
              const data = JSON.parse(resp.responseText);
              const packs = data.emotionPackageList || data.data || [];
              const flat = [];
              for (const p of packs) {
                for (const it of p.emotions || []) {
                  const url = it.emotionImageSmallUrl || it.smallImageInfo && it.smallImageInfo.thumbnailImageCdnUrl || it.smallImageInfo && it.smallImageInfo.thumbnailImage && it.smallImageInfo.thumbnailImage.cdnUrls && it.smallImageInfo.thumbnailImage.cdnUrls[0] && it.smallImageInfo.thumbnailImage.cdnUrls[0].url || "";
                  flat.push({ emotionId: it.id, emotionPkgName: p.name, emotionImageUrl: url });
                }
              }
              _applyEmoticons(flat);
              resolve(true);
            } catch (e) {
              _emoticonPromise = null;
              resolve(false);
            }
          },
          onerror: () => {
            _emoticonPromise = null;
            resolve(false);
          }
        });
      });
      return _emoticonPromise;
    },
    // 获取API token（点赞用）
    async getApiToken() {
      if (_apiToken && Date.now() < _tokenExpiry) return _apiToken;
      return new Promise((resolve) => {
        GM_xmlhttpRequest({
          method: "POST",
          url: "https://id.app.acfun.cn/rest/web/token/get",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
          data: "sid=acfun.midground.api",
          onload: (resp) => {
            try {
              const data = JSON.parse(resp.responseText);
              if (data.result === 0) {
                _apiToken = data["acfun.midground.api_st"] || "";
                _tokenExpiry = Date.now() + CONFIG.TOKEN_TTL_MS;
              }
            } catch {
            }
            resolve(_apiToken);
          },
          onerror: () => resolve("")
        });
      });
    },
    // 点赞/取消点赞动态
    async likeMoment(momentId, userId, isCancel = false) {
      const token = await this.getApiToken();
      if (!token) return null;
      const endpoint = isCancel ? "delete" : "add";
      return new Promise((resolve) => {
        GM_xmlhttpRequest({
          method: "POST",
          url: `https://kuaishouzt.com/rest/zt/interact/${endpoint}`,
          headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
          data: `objectId=${momentId}&objectType=10&userId=${userId}&acfun.midground.api_st=${encodeURIComponent(token)}&kpn=ACFUN_APP&kpf=PC_WEB&subBiz=mainApp&interactType=1`,
          onload: (resp) => {
            try {
              resolve(JSON.parse(resp.responseText));
            } catch {
              resolve(null);
            }
          },
          onerror: () => resolve(null)
        });
      });
    },
    // 评论点赞/取消点赞
    async likeComment(sourceId, commentId, isCancel = false) {
      const endpoint = isCancel ? "unlike" : "like";
      try {
        const resp = await fetch(`https://www.acfun.cn/rest/pc-direct/comment/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `sourceId=${sourceId}&sourceType=4&commentId=${commentId}`,
          credentials: "include"
        });
        return await resp.json();
      } catch {
        return null;
      }
    },
    // 发评论（replyToCommentId 传入则为回复楼中楼）
    async postComment(amId, content, replyToCommentId = 0) {
      const midgroundToken = await this.getApiToken();
      const body = `sourceId=${amId}&sourceType=4&content=${encodeURIComponent(content)}` + (replyToCommentId ? `&replyToCommentId=${replyToCommentId}` : "") + (midgroundToken ? `&midgroundToken=${encodeURIComponent(midgroundToken)}` : "");
      try {
        const resp = await fetch("https://www.acfun.cn/rest/pc-direct/comment/add", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
          credentials: "include"
        });
        return await resp.json();
      } catch (e) {
        utils.log("发评论失败:", e);
        return null;
      }
    },
    // 上传评论图片（kuaishouzt 网关四步：getToken → 分片上传 → complete → 换取 URL）
    // 返回可长期访问的裸路径 URL（preview 域名的 ksc2 路径即文件标识，签名参数会过期需剥掉）
    async uploadImage(file) {
      const token = await new Promise((resolve) => {
        GM_xmlhttpRequest({
          method: "POST",
          url: "https://www.acfun.cn/rest/pc-direct/image/upload/getToken",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          data: `fileName=${encodeURIComponent(file.name || "image.png")}`,
          onload: (resp) => {
            try {
              const data = JSON.parse(resp.responseText);
              resolve(data.result === 0 ? data.info?.token || null : null);
            } catch {
              resolve(null);
            }
          },
          onerror: () => resolve(null)
        });
      });
      if (!token) return null;
      const endpoint = "https://upload.kuaishouzt.com";
      const total = file.size;
      const chunks = Math.max(1, Math.ceil(total / CONFIG.UPLOAD_CHUNK_SIZE));
      for (let i = 0; i < chunks; i++) {
        const start = i * CONFIG.UPLOAD_CHUNK_SIZE;
        const end = Math.min(start + CONFIG.UPLOAD_CHUNK_SIZE, total);
        const ok = await new Promise((resolve) => {
          GM_xmlhttpRequest({
            method: "POST",
            url: `${endpoint}/api/upload/fragment?upload_token=${encodeURIComponent(token)}&fragment_id=${i}`,
            headers: {
              "Content-Type": "application/octet-stream",
              "Content-Range": `bytes ${start}-${end - 1}/${total}`
            },
            data: file.slice(start, end),
            onload: (resp) => {
              try {
                resolve(JSON.parse(resp.responseText).result === 1);
              } catch {
                resolve(false);
              }
            },
            onerror: () => resolve(false)
          });
        });
        if (!ok) {
          utils.log("图片分片上传失败: 分片", i);
          return null;
        }
      }
      const completed = await new Promise((resolve) => {
        GM_xmlhttpRequest({
          method: "POST",
          url: `${endpoint}/api/upload/complete?upload_token=${encodeURIComponent(token)}&fragment_count=${chunks}`,
          onload: (resp) => {
            try {
              resolve(JSON.parse(resp.responseText).result === 1);
            } catch {
              resolve(false);
            }
          },
          onerror: () => resolve(false)
        });
      });
      if (!completed) {
        utils.log("图片上传 complete 失败");
        return null;
      }
      return new Promise((resolve) => {
        GM_xmlhttpRequest({
          method: "POST",
          url: "https://www.acfun.cn/rest/pc-direct/image/upload/getUrlAfterUpload",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          data: `token=${encodeURIComponent(token)}&bizFlag=web-comment-text`,
          onload: (resp) => {
            try {
              const data = JSON.parse(resp.responseText);
              resolve(data.result === 0 && data.url ? data.url.split("?")[0] : null);
            } catch {
              resolve(null);
            }
          },
          onerror: () => resolve(null)
        });
      });
    },
    // 投蕉给动态作者
    throwBanana(momentId) {
      return new Promise((resolve) => {
        GM_xmlhttpRequest({
          method: "POST",
          url: "https://www.acfun.cn/rest/pc-direct/banana/throwBanana",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "Referer": `https://www.acfun.cn/moment/am${momentId}` },
          data: `resourceId=${momentId}&count=1&resourceType=10`,
          onload: (resp) => {
            try {
              resolve(JSON.parse(resp.responseText));
            } catch {
              resolve(null);
            }
          },
          onerror: () => resolve(null)
        });
      });
    },
    // 逐号并发探测动态（direction: 'up' 向上找新动态 / 'down' 向下找历史动态）
    // opts: { skipFansOnly, stopMs }
    //   up：遇到发布时间距今 ≤stopMs 的动态即停（该条保留）
    //   down：遇到发布时间距今 >stopMs 的动态即停（该条丢弃）
    // 返回 { moments, probedTo }：probedTo 为本次实际探测过的边界 am 号（up=最高号，down=最低号）
    async crawlMoments(startId, targetCount = CONFIG.BATCH_SIZE, opts = {}) {
      const up = opts.direction !== "down";
      const results = [];
      let currentId = up ? startId + 1 : startId - 1;
      let emptyCount = 0;
      let totalChecked = 0;
      const MAX_SCAN = targetCount * CONFIG.SCAN_LIMIT_MULTIPLIER;
      while (results.length < targetCount && totalChecked < MAX_SCAN && currentId > 0) {
        const room = targetCount - results.length;
        const batchIds = [];
        for (let i = 0; i < Math.min(CONFIG.CONCURRENT, room, up ? Infinity : currentId); i++) {
          batchIds.push(up ? currentId + i : currentId - i);
        }
        totalChecked += batchIds.length;
        const batchResults = await Promise.all(batchIds.map(
          (amId) => this.fetchMoment(amId).then((data) => {
            if (data && data.result === 0 && data.moment) {
              const moment = data.moment;
              if (opts.skipFansOnly && moment.visibleForFans) {
                return { amId, fansOnly: true };
              }
              const ageMs = utils.parseAgeMs(moment.createTime);
              if (!up && opts.stopMs != null && ageMs > opts.stopMs) {
                return { amId, tooOld: true };
              }
              const hitFresh = up && opts.stopMs != null && ageMs <= opts.stopMs;
              return { amId, found: true, moment: data, hitFresh };
            }
            return { amId, found: false };
          })
        ));
        let shouldStop = false;
        for (const r of batchResults) {
          if (r.fansOnly) {
            emptyCount = 0;
            continue;
          }
          if (r.tooOld) {
            shouldStop = true;
            break;
          }
          if (r.found) {
            emptyCount = 0;
            results.push({ ...r.moment, _amId: r.amId });
            if (r.hitFresh) shouldStop = true;
          } else {
            emptyCount++;
          }
        }
        currentId += up ? batchIds.length : -batchIds.length;
        if (shouldStop) {
          utils.log(up ? "向上爬到最新，停止" : "向下爬到时间下限，停止");
          break;
        }
        if (emptyCount >= CONFIG.MAX_EMPTY) {
          utils.log(`连续 ${emptyCount} 个空号，停止`);
          break;
        }
        await new Promise((r) => setTimeout(r, CONFIG.CRAWL_BATCH_DELAY_MS));
      }
      results.sort((a, b) => b._amId - a._amId);
      return { moments: results, probedTo: up ? currentId - 1 : currentId + 1 };
    }
  };

  // src/editor.js
  var EDITOR_CLASS = "plaza-comment-editor";
  var EDITOR_INPUT_CLASS = "plaza-editor-input";
  var EDITOR_EMOT_BTN_CLASS = "plaza-editor-emot";
  var EDITOR_IMG_BTN_CLASS = "plaza-editor-img";
  var EDITOR_FILE_CLASS = "plaza-editor-file";
  var EDITOR_SEND_CLASS = "plaza-editor-send";
  var EDITOR_PENDING_CLASS = "plaza-editor-pending";
  var EDITOR_PANEL_CLASS = "plaza-emot-panel";
  var editor = {
    renderEditor(amId, opts = {}) {
      const replyTo = opts.replyToCommentId || 0;
      const placeholder = opts.placeholder || "评论一时爽，一直评论一直爽。(˶‾᷄ ⁻̫ ‾᷅˵)";
      const buttonText = opts.buttonText || "发表";
      const replyAttr = replyTo ? ` data-reply-to="${replyTo}"` : "";
      return `
            <div class="${EDITOR_CLASS}" data-am-id="${amId}">
                <textarea class="${EDITOR_INPUT_CLASS}" placeholder="${utils.escapeHtml(placeholder)}" data-am-id="${amId}"${replyAttr}></textarea>
                <div class="${EDITOR_PENDING_CLASS}" style="display:none;">
                    <img class="plaza-editor-pending-img" alt="">
                    <span class="plaza-editor-pending-del" title="移除图片">×</span>
                </div>
                <div class="plaza-editor-actions">
                    <span class="plaza-editor-tool ${EDITOR_EMOT_BTN_CLASS}" title="表情"></span>
                    <span class="plaza-editor-tool ${EDITOR_IMG_BTN_CLASS}" title="插入图片"></span>
                    <input type="file" class="${EDITOR_FILE_CLASS}" accept="image/*" style="display:none;">
                    <button class="${EDITOR_SEND_CLASS}" data-am-id="${amId}"${replyAttr}>${utils.escapeHtml(buttonText)}</button>
                </div>
                <div class="${EDITOR_PANEL_CLASS}" style="display:none;"></div>
            </div>
        `;
    }
  };

  // src/renderer.js
  var COUNT_SUFFIX = "\n    ";
  var renderer = {
    _cachedInteractiveHtml: null,
    getInteractiveHtml() {
      if (this._cachedInteractiveHtml) return this._cachedInteractiveHtml;
      const nativeFeed = document.querySelector(".ac-member-feed:not(.moment-plaza-item) .feed-interactive");
      if (nativeFeed) {
        const clone = nativeFeed.cloneNode(true);
        clone.querySelectorAll(".active").forEach((el) => el.classList.remove("active"));
        this._cachedInteractiveHtml = clone.outerHTML;
        return this._cachedInteractiveHtml;
      }
      return "";
    },
    // 保留天数下拉框的 option 列表（工具栏与首次设置框共用）
    keepDaysOptionsHtml() {
      const keepDays = utils.getKeepDays();
      return CONFIG.KEEP_DAYS_OPTIONS.map((d) => `<option value="${d}"${d === keepDays ? " selected" : ""}>${d}</option>`).join("");
    },
    // 把某个互动区元素里的数字（文本节点）替换为加载点
    _replaceNumWithLoading(el) {
      const nodes = el.childNodes;
      for (let i = nodes.length - 1; i >= 0; i--) {
        if (nodes[i].nodeType === 3 && nodes[i].textContent.trim()) {
          const span2 = document.createElement("span");
          span2.className = "plaza-count-loading";
          nodes[i].parentNode.replaceChild(span2, nodes[i]);
          return;
        }
      }
      const span = document.createElement("span");
      span.className = "plaza-count-loading";
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
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;
      const commentDiv = tempDiv.querySelector(".feed-interactive-comment");
      if (commentDiv) {
        if (pending) {
          this._replaceNumWithLoading(commentDiv);
        } else {
          const nodes = commentDiv.childNodes;
          for (let i = nodes.length - 1; i >= 0; i--) {
            if (nodes[i].nodeType === 3 && nodes[i].textContent.trim()) {
              nodes[i].textContent = utils.formatNumber(commentCount) + COUNT_SUFFIX;
              break;
            }
          }
        }
      }
      const bananaDiv = tempDiv.querySelector(".feed-interactive-banana");
      if (bananaDiv) {
        if (isBanana) bananaDiv.setAttribute("active", "");
        const span = bananaDiv.querySelector("span:last-of-type");
        if (span) {
          if (pending) {
            span.textContent = "";
            span.className = "plaza-count-loading";
          } else {
            span.textContent = utils.formatNumber(bananaCount);
          }
        }
      }
      const likeDiv = tempDiv.querySelector(".feed-interactive-like");
      if (likeDiv) {
        if (isLiked) likeDiv.setAttribute("active", "");
        if (pending) {
          this._replaceNumWithLoading(likeDiv);
        } else {
          const nodes = likeDiv.childNodes;
          for (let i = nodes.length - 1; i >= 0; i--) {
            if (nodes[i].nodeType === 3 && nodes[i].textContent.trim()) {
              nodes[i].textContent = utils.formatNumber(likeCount) + COUNT_SUFFIX;
              break;
            }
          }
        }
      }
      return tempDiv.innerHTML;
    },
    renderToolbar() {
      return `
            <div class="moment-plaza-toolbar">
                <span class="status" id="fetch-status" style="cursor:pointer;" title="点击刷新">加载中...</span>
                <span class="status" id="up-status" style="color:#52c41a;font-size:12px;cursor:pointer;" title="点击刷新"></span>
                <span class="status" style="margin-left:12px;">保留 <select id="plaza-keep-days" style="border:1px solid #e5e5e5;border-radius:3px;padding:1px 4px;color:#666;">${this.keepDaysOptionsHtml()}</select> 天内的数据</span>
            </div>
        `;
    },
    // UBB 标记 → 纯文本（用于转发卡片标题等单行展示）
    _plainText(text) {
      if (!text) return "";
      return String(text).replace(/\[img=[^\]]*\][\s\S]*?\[\/img\]/gi, "[图]").replace(/\[at uid=\d+\]@?([\s\S]*?)\[\/at\]/g, "@$1").replace(/\[emot=\w+,\d+\/?\]/g, "").replace(/\s+/g, " ").trim();
    },
    // 提取转发内容信息（repostSource 由 api 层附加到 moment 上）
    // 类型映射：resourceType 2=视频 3=文章 10=动态（originResourceType 1/2/3 只是文章/漫画/视频的转发来源差异，统一走这里）
    _getRepostInfo(moment) {
      const rs = moment.repostSource;
      if (!rs) return null;
      const isMomentRepost = rs.resourceType === 10;
      let title = rs.articleTitle || rs.caption || rs.description || "";
      let cover = rs.coverUrl || "";
      if (isMomentRepost) {
        title = this._plainText(rs.moment?.text) || rs.discoveryResourceFeedShowContent || title;
        cover = cover || rs.moment?.imgs?.[0]?.url || "";
      }
      if (!title && !cover) return null;
      if (title.length > 60) title = title.slice(0, 60) + "…";
      const typeMap = { 2: "视频", 3: "文章", 10: "动态" };
      let href = "";
      if (rs.resourceId) {
        if (rs.resourceType === 10) href = `//www.acfun.cn/moment/am${rs.resourceId}`;
        else href = `//www.acfun.cn/${rs.resourceType === 2 ? "v" : "a"}/ac${rs.resourceId}`;
      }
      if (!href && rs.shareUrl) href = String(rs.shareUrl).replace(/^https?:/, "");
      return {
        title,
        isMomentRepost,
        cover: String(cover || "").replace(/"/g, "%22"),
        href: String(href).replace(/"/g, "%22"),
        label: typeMap[rs.resourceType] || "内容",
        duration: rs.playDuration || "",
        author: rs.user?.userName || rs.userInfo?.userName || ""
      };
    },
    _repostCardHtml(repost) {
      const meta = [];
      if (repost.duration) meta.push(utils.escapeHtml(repost.duration));
      if (repost.author) meta.push(utils.escapeHtml(repost.author));
      return `
            <a class="plaza-repost-card" href="${repost.href}" target="_blank">
                ${repost.cover ? `<img class="plaza-repost-cover" src="${repost.cover}">` : ""}
                <div class="plaza-repost-info">
                    <div class="plaza-repost-title">${utils.escapeHtml(repost.title)}</div>
                    <div class="plaza-repost-meta"><span class="plaza-repost-tag">${repost.label}</span>${meta.map((m) => `<span>${m}</span>`).join("")}</div>
                </div>
            </a>
        `;
    },
    renderCard(record, opts = {}) {
      const pending = !!opts.pending;
      const moment = record.data || record.moment || record;
      const user = moment.user || {};
      const userId = user.id || user.userId || "";
      const userName = user.name || "";
      const userAvatar = utils.attrEscape((user.headCdnUrls?.[0]?.url || user.headUrl || "") + "?imageMogr2/auto-orient/format/webp/quality/80!/ignore-error/1");
      const repost = this._getRepostInfo(moment);
      const repostHtml = repost ? this._repostCardHtml(repost) : "";
      const rawText = moment.text || moment.replaceUbbText || "";
      const text = utils.parseContent(rawText);
      const images = moment.imgs || [];
      let imageHtml = "";
      if (images.length > 0) {
        const imgTags = images.slice(0, CONFIG.MAX_IMAGES).map((img) => {
          const url = img.url || img.originUrl || "";
          return url ? `<img src="${utils.attrEscape(url)}">` : "";
        }).filter(Boolean);
        if (imgTags.length > 0) {
          imageHtml = `<div class="member-feed-moment-image member-feed-moment-image-${imgTags.length}">${imgTags.join("")}</div>`;
        }
      }
      const amId = record.amId || moment.momentId;
      const nameColor = user.nameColor;
      const nameColorStyle = nameColor === 2 ? `color:${NAME_COLOR_PURPLE};` : `color:${NAME_COLOR_RED};`;
      const absTs = record.absTs || utils.computeAbsTs(moment.createTime, Date.now());
      const createTime = utils.formatTime(absTs) || moment.createTime || "";
      const interactiveHtml = this.fillInteractive(moment, { pending });
      return `
            <div class="ac-member-feed moment-plaza-item" data-am-id="${amId}">
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
                        ${repostHtml}
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
      const userName = comment.userName || "";
      const userId = comment.userId || "";
      const avatar = utils.attrEscape(comment.userHeadImgInfo?.thumbnailImageCdnUrl || comment.headUrl?.[0]?.url || "");
      const rawContent = comment.content || "";
      const content = utils.parseContent(rawContent);
      const likeCount = comment.likeCount || 0;
      const time = comment.postDate || "";
      const floor = comment.floor || "";
      const nameColor = comment.nameColor === 2 ? NAME_COLOR_PURPLE : NAME_COLOR_RED;
      const device = comment.deviceModel || "";
      const isUp = comment.isUp;
      const isCommentLiked = comment.isLiked || false;
      const replyToName = comment.replyToUserName || "";
      const replyToId = comment.replyTo || 0;
      let replyPrefix = "";
      if (isSec && replyToName && replyToId) {
        replyPrefix = `<span class="plaza-reply-prefix">回复 <a class="plaza-at-link" href="//www.acfun.cn/u/${replyToId}" target="_blank">@${utils.escapeHtml(replyToName)}</a> :</span>`;
      }
      const subComments = comment.subComments || [];
      const subHtml = subComments.length > 0 ? `<div class="area-comment-sec clearfix"><div class="area-sec-list">${subComments.map((s) => this.renderComment(s, amId, true)).join("")}</div></div>` : "";
      const secClass = isSec ? " sec" : "";
      const nameStyle = isSec ? "" : ` style="color:${nameColor}"`;
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
                            <a class="name" target="_blank" href="//www.acfun.cn/u/${userId}"${nameStyle}>${utils.escapeHtml(userName)}</a>
                            ${isUp ? '<span class="plaza-up-tag">UP主</span>' : ""}
                            <span class="time_day">发表于</span>
                            <span class="time_times">${time}</span>
                        </div>
                        <div class="area-comment-des">
                            <p class="area-comment-des-content">${replyPrefix}${content}</p>
                        </div>
                        <div class="area-comment-tool">
                            <a class="area-comment-like${isCommentLiked ? " area-comment-up" : ""}">${likeCount > 0 ? `赞 ${likeCount}` : "赞"}</a>
                            <a class="plaza-reply-btn" data-comment-id="${comment.commentId}" data-user="${utils.escapeHtml(userName)}">回复</a>
                            <span class="area-comment-from">
                                ${device ? `<span>来自</span><a class="deviceModel" target="_blank" href="//www.acfun.cn/app/">${utils.escapeHtml(device)}</a>` : ""}
                            </span>
                        </div>
                        <div class="plaza-reply-box" id="reply-box-${comment.commentId}" style="display:none;">
                            ${editor.renderEditor(amId, { replyToCommentId: comment.commentId, placeholder: `回复 ${userName}...`, buttonText: "发送" })}
                        </div>
                    </div>
                    ${floor ? `<span class="index-comment">#${floor}</span>` : ""}
                </div>
                ${subHtml}
                <hr>
            </div>
        `;
    },
    renderComments(data, amId) {
      const total = data?.commentCount ?? "";
      const editorHtml = `
            <div class="plaza-comment-title">评论 ${total}</div>
            ${editor.renderEditor(amId, { buttonText: "发表" })}
        `;
      if (!data) return editorHtml + '<div class="plaza-comment-load-failed">评论加载失败</div>';
      const comments = data.rootComments || [];
      const subMap = data.subCommentsMap || {};
      if (comments.length === 0) return editorHtml + '<div class="plaza-comment-empty">暂无评论</div>';
      const enriched = comments.map((c) => {
        const id = c.commentId?.toString();
        const subEntry = subMap[id];
        const subList = subEntry?.subComments || subEntry || [];
        return { ...c, subComments: Array.isArray(subList) ? subList : [] };
      });
      const html = enriched.map((c) => this.renderComment(c, amId)).join("");
      return `
            ${editorHtml}
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
      return `<div class="moment-plaza-list">${sorted.map((r) => {
        const absTs = r.absTs;
        const pending = !!absTs && now - absTs <= CONFIG.FRESH_WINDOW_MS;
        return this.renderCard(r, { pending });
      }).join("")}</div>`;
    }
  };

  // src/background.js
  var background = {
    // 启动：有 am 号就开启向上后台定时爬取 + 过期清理
    start() {
      const knownAmId = utils.getLastAmId();
      if (!knownAmId || knownAmId <= 0) return;
      state.latestAmId = knownAmId;
      const lastDiscovery = utils.getLastDiscoveryAt();
      if (lastDiscovery) {
        const idleMs = Date.now() - lastDiscovery;
        state._upBackoffMs = this._computeBackoff(idleMs);
        state._upNextAt = Date.now() + state._upBackoffMs;
      }
      this._startUpwardPoll();
      this.cleanupExpired();
    },
    _computeBackoff(idleMs) {
      const min = CONFIG.UP_POLL_INTERVAL;
      const max = CONFIG.UP_POLL_BACKOFF_MAX_MS;
      if (idleMs < 5 * 60 * 1e3) return min;
      if (idleMs < 30 * 60 * 1e3) return Math.min(min * 2, max);
      if (idleMs < 2 * 3600 * 1e3) return Math.min(min * 4, max);
      if (idleMs < 6 * 3600 * 1e3) return Math.min(min * 8, max);
      return max;
    },
    // ========== 向上爬取（后台定时，空手退避 + 跨空号断层） ==========
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
    _cancelRunningSearch() {
      state._upGeneration++;
      state._upRunning = false;
      state._upProbedTo = 0;
    },
    // 快速定位最新动态：按「时间 → am 号」外推，而非盲跳固定步长
    // 用本地已有记录的号差/时间差测出增长速率，直接跳到「此刻」对应的 am 号附近；
    // 越过边界（整段空号）则在已知区间内收敛，命中旧数据则用新锚点修正速率继续外推
    async _fastForward(onStatus) {
      const startId = state.latestAmId;
      if (!startId || startId <= 0) return [];
      const { lo, best } = await this._locateFrontier(startId, onStatus);
      let moments;
      if (best) {
        if (onStatus) onStatus(`快速定位... 从 am${lo} 抓取最新一批`);
        moments = (await api.crawlMoments(lo + 1, CONFIG.UP_CRAWL_TARGET, {
          direction: "down",
          skipFansOnly: true
        })).moments;
        if (!moments.some((m) => m._amId === best.amId)) {
          moments.push({ ...best.raw, _amId: best.amId });
        }
      } else {
        if (onStatus) onStatus(`快速定位... 从 am${startId} 逐号查找`);
        moments = (await api.crawlMoments(startId, CONFIG.UP_CRAWL_TARGET, {
          direction: "up",
          skipFansOnly: true,
          stopMs: CONFIG.UP_STOP_AT_MS
        })).moments;
      }
      await wait();
      if (!moments.length) return [];
      const records = await this._storeMoments(moments);
      const frontier = best ? lo : Math.max(...records.map((r) => r.amId));
      if (frontier > state.latestAmId) {
        state.latestAmId = frontier;
        utils.setLastAmId(frontier);
      }
      utils.setLastDiscoveryAt(Date.now());
      utils.log(`快速定位: 边界 am${frontier}，入库 ${records.length} 条`);
      return records;
    },
    // 探测收敛出边界：返回 lo（已确认存在动态的最高 am 号）与 best（该处动态原始数据）
    async _locateFrontier(startId, onStatus) {
      let anchor = this._newestAnchor();
      let rate = this._estimateIdRate();
      let lo = anchor ? Math.max(startId, anchor.id) : startId;
      let hi = 0;
      let step = CONFIG.FF_INITIAL_STEP;
      let best = null;
      for (let round = 0; round < CONFIG.FF_MAX_PROBES; round++) {
        if (hi && hi - lo <= CONFIG.FF_CONVERGE_GAP) break;
        let target;
        if (hi) {
          target = rate > 0 && anchor ? Math.round(anchor.id + anchor.ageMs * rate) : 0;
          if (!(target > lo && target < hi)) target = Math.round((lo + hi) / 2);
        } else if (anchor && rate > 0) {
          target = Math.round(anchor.id + anchor.ageMs * rate);
          if (target <= lo) target = lo + step;
        } else {
          target = lo + step;
        }
        if (onStatus) onStatus(`快速定位... 探测 am${target}`);
        const hit = await this._probeWindow(target, this._probeSize(rate));
        await new Promise((r) => setTimeout(r, CONFIG.CRAWL_BATCH_DELAY_MS));
        if (!hit) {
          if (rate > 0 || hi) {
            hi = target;
          } else {
            step = Math.round(step / 2);
            if (step < CONFIG.FF_MIN_STEP) hi = target;
          }
          continue;
        }
        if (hit.amId > lo) lo = hit.amId;
        if (!best || hit.ageMs < best.ageMs) best = hit;
        if (hit.ageMs <= CONFIG.UP_STOP_AT_MS) break;
        if (anchor && hit.amId > anchor.id && anchor.ageMs > hit.ageMs) {
          rate = (hit.amId - anchor.id) / (anchor.ageMs - hit.ageMs);
        }
        anchor = { id: hit.amId, ageMs: hit.ageMs };
        if (rate <= 0) step *= CONFIG.FF_STEP_MULTIPLIER;
      }
      if (best && hi && hi - lo > 1) {
        const rest = await this._probeWindow(lo + 1, Math.min(hi - lo - 1, CONFIG.FF_PROBE_MAX));
        if (rest && rest.amId > lo) {
          lo = rest.amId;
          if (rest.ageMs < best.ageMs) best = rest;
        }
      }
      return { lo, best };
    },
    // 采样一段连续 am 号，返回其中最新的公开动态；整段为空返回 null
    async _probeWindow(fromId, size) {
      const ids = [];
      for (let i = 0; i < size; i++) ids.push(fromId + i);
      const results = await Promise.all(ids.map((id) => api.fetchMoment(id)));
      let best = null;
      for (let i = 0; i < results.length; i++) {
        const data = results[i];
        if (!data || data.result !== 0 || !data.moment) continue;
        if (data.moment.visibleForFans) continue;
        const ageMs = utils.parseAgeMs(data.moment.createTime);
        if (!best || ageMs < best.ageMs) best = { amId: ids[i], ageMs, raw: data };
      }
      return best;
    },
    // 采样宽度按速率换算成能覆盖 FF_PROBE_SPAN_MS 的 ID 数，速率未知时用最小宽度
    _probeSize(rate) {
      if (!(rate > 0)) return CONFIG.FF_PROBE_SIZE;
      const n = Math.ceil(rate * CONFIG.FF_PROBE_SPAN_MS);
      return Math.min(CONFIG.FF_PROBE_MAX, Math.max(CONFIG.FF_PROBE_SIZE, n));
    },
    // 本地最新动态作为时间锚点（am 号 → 距今毫秒）
    _newestAnchor() {
      for (const m of state.moments) {
        if (m.absTs) return { id: m.amId, ageMs: Math.max(1, Date.now() - m.absTs) };
      }
      return null;
    },
    // 由本地记录估算 am 号增长速率：最新与最旧两条的号差 ÷ 时间差
    _estimateIdRate() {
      const ms = state.moments;
      if (ms.length < 2) return 0;
      const newest = ms[0];
      const oldest = ms[ms.length - 1];
      const dId = newest.amId - oldest.amId;
      const dTs = newest.absTs - oldest.absTs;
      if (!(dId > 0) || !(dTs > 0)) return 0;
      return dId / dTs;
    },
    _upPollTick() {
      if (state._upRunning) return;
      if (Date.now() < state._upNextAt) return;
      this._runUpwardSearch();
    },
    async _runUpwardSearch() {
      if (state._upRunning) return;
      state._upRunning = true;
      const gen = state._upGeneration;
      const updateUp = (t) => {
        const el = document.getElementById("up-status");
        if (el) el.textContent = t;
      };
      updateUp("↑查找新动态...");
      try {
        const fromId = Math.max(state.latestAmId, state._upProbedTo);
        const { moments: newMoments, probedTo } = await api.crawlMoments(fromId, CONFIG.UP_CRAWL_TARGET, {
          direction: "up",
          skipFansOnly: true,
          stopMs: CONFIG.UP_STOP_AT_MS
        });
        if (gen !== state._upGeneration) return;
        if (probedTo > state._upProbedTo) {
          state._upProbedTo = probedTo;
        }
        if (newMoments.length) {
          const records = await this._storeMoments(newMoments);
          const maxAm = Math.max(...records.map((r) => r.amId));
          if (maxAm > state.latestAmId) {
            state.latestAmId = maxAm;
            utils.setLastAmId(maxAm);
          }
          updateUp(`↑发现 ${records.length} 条新动态，点击刷新`);
          const now = Date.now();
          utils.setLastDiscoveryAt(now);
          state._upBackoffMs = 0;
          state._upNextAt = 0;
        } else {
          updateUp("");
          const lastDisc = utils.getLastDiscoveryAt();
          const idleMs = lastDisc ? Date.now() - lastDisc : 0;
          state._upBackoffMs = this._computeBackoff(idleMs);
          state._upNextAt = Date.now() + state._upBackoffMs;
        }
      } finally {
        if (gen === state._upGeneration) {
          state._upRunning = false;
        }
      }
    },
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
    // ========== 过期清理 ==========
    async cleanupExpired() {
      try {
        const keepDays = utils.getKeepDays();
        const cutoff = Date.now() - keepDays * 864e5;
        await db.deleteOlderThan(cutoff);
      } catch (e) {
        utils.log("清理过期数据失败:", e);
      }
    }
  };

  // src/controller.js
  var controller = {
    // 进入/刷新动态广场
    enterPlaza() {
      const mainContent = document.querySelector(SEL_MAIN_FEEDS);
      if (!mainContent) {
        GM_setValue(AUTO_ENTER_KEY, true);
        window.location.href = "/member/feeds";
        return;
      }
      document.querySelector('a[href="/member/feeds"]')?.classList.remove("ac-member-navigation-item-active");
      document.querySelector(".plaza-nav-item")?.classList.add("ac-member-navigation-item-active");
      const isPlazaOpen = mainContent.querySelector(".moment-plaza-container");
      if (isPlazaOpen) {
        this.refreshPlaza();
      } else {
        this.showPlazaView();
      }
    },
    // 刷新广场（点击刷新时调用）：预渲染 DB 最新 20 条
    async refreshPlaza() {
      background._stopUpwardPoll();
      background._cancelRunningSearch();
      const statusEl = document.getElementById("fetch-status");
      const updateStatus = (t) => {
        if (statusEl) statusEl.textContent = t;
      };
      const upStatus = document.getElementById("up-status");
      if (upStatus) upStatus.textContent = "";
      updateStatus("正在刷新...");
      state._downLoading = false;
      state._noMoreDown = false;
      await this._loadAndRender(state.latestAmId + 1);
      const newestTs = state.moments[0]?.absTs;
      if (!newestTs || Date.now() - newestTs > CONFIG.FF_STALE_THRESHOLD_MS) {
        updateStatus("数据较旧，快速定位最新动态...");
        const ffRecords = await background._fastForward(
          (t) => {
            if (upStatus) upStatus.textContent = t;
          }
        );
        if (ffRecords.length) {
          await this._loadAndRender(state.latestAmId + 1);
        }
        if (upStatus) upStatus.textContent = "";
      }
      background._startUpwardPoll();
      background.cleanupExpired();
    },
    async showPlazaView() {
      const mainContent = document.querySelector(SEL_MAIN_FEEDS);
      if (!mainContent) return;
      renderer.getInteractiveHtml();
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
                        <div style="margin-top:16px;font-size:13px;color:#666;">保留
                            <select id="plaza-setup-keep-days" style="border:1px solid #e5e5e5;border-radius:3px;padding:2px 4px;">${renderer.keepDaysOptionsHtml()}</select> 天内的数据
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
      if (!document.querySelector(".plaza-back-top")) {
        const backTop = document.createElement("div");
        backTop.className = "plaza-back-top";
        backTop.innerHTML = "↑";
        backTop.title = "回到顶部";
        backTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
        document.body.appendChild(backTop);
      }
      this._setupScrollListener();
      this._bindKeepDaysSelect();
      const statusEl = document.getElementById("fetch-status");
      if (statusEl) statusEl.textContent = "正在加载...";
      await this._loadAndRender(state.latestAmId + 1);
      background._startUpwardPoll();
      background.cleanupExpired();
    },
    // ========== 数据流核心 ==========
    // 加载最新一批 → 渲染 → 状态文案 → 后台注入新鲜互动数字（refreshPlaza / showPlazaView 共用）
    async _loadAndRender(fromId) {
      const records = await this._loadBatch(fromId, CONFIG.BATCH_SIZE);
      state.moments = records;
      if (records.length) {
        state.oldestAmId = Math.min(...records.map((r) => r.amId));
        const oldestAbs = records[records.length - 1]?.absTs;
        if (records.length < CONFIG.BATCH_SIZE || oldestAbs && Date.now() - oldestAbs > CONFIG.DOWN_STOP_AFTER_MS) {
          state._noMoreDown = true;
        }
      }
      this._renderList();
      const statusEl = document.getElementById("fetch-status");
      if (statusEl) statusEl.textContent = `共 ${state.moments.length} 条动态，向下滚动加载更多`;
      await this._refreshRecords(records);
    },
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
      const { moments } = await api.crawlMoments(fromAmId, targetCount, {
        direction: "down",
        skipFansOnly: true,
        stopMs: CONFIG.DOWN_STOP_AFTER_MS
      });
      return background._storeMoments(moments);
    },
    // 对需要修复/注入的记录统一补抓一次，避免同一 amId 重复 fetchMoment
    async _refreshRecords(records) {
      if (!records || !records.length) return;
      const now = Date.now();
      const repairIds = /* @__PURE__ */ new Set();
      const freshIds = /* @__PURE__ */ new Set();
      for (const r of records) {
        if (r.data?.originResourceType && !r.data.repostSource) repairIds.add(r.amId);
        if (r.absTs && now - r.absTs <= CONFIG.FRESH_WINDOW_MS) freshIds.add(r.amId);
      }
      const allIds = [.../* @__PURE__ */ new Set([...repairIds, ...freshIds])];
      if (!allIds.length) return;
      await Promise.all(allIds.map(
        (amId) => this._refreshOneMoment(amId, { repair: repairIds.has(amId) })
      ));
    },
    // 单条动态补抓：更新数据 → 刷新互动数字 → 可选重渲染卡片（修复转发源）
    async _refreshOneMoment(amId, opts = {}) {
      const data = await api.fetchMoment(amId);
      if (!data || data.result !== 0 || !data.moment) return;
      const moment = data.moment;
      const record = state.moments.find((m) => m.amId == amId);
      const absTs = record?.absTs || utils.computeAbsTs(moment.createTime, Date.now());
      await db.putMoment({ amId, absTs, data: moment, fetchedAt: Date.now() });
      if (record) record.data = moment;
      const card = document.querySelector(`.moment-plaza-item[data-am-id="${amId}"]`);
      if (!card) return;
      if (opts.repair) {
        const pending = !!absTs && Date.now() - absTs <= CONFIG.FRESH_WINDOW_MS;
        const holder = document.createElement("div");
        holder.innerHTML = renderer.renderCard(record || { amId, absTs, data: moment }, { pending });
        const fresh = holder.firstElementChild;
        if (fresh) card.replaceWith(fresh);
      } else {
        const interactiveEl = card.querySelector(".member-feed-interactive");
        if (interactiveEl) {
          interactiveEl.innerHTML = renderer.fillInteractive(moment, { pending: false });
          const commentContainer = document.getElementById(`comments-${amId}`);
          if (commentContainer && commentContainer.style.display !== "none") {
            const btn = interactiveEl.querySelector(".feed-interactive-comment");
            if (btn) btn.classList.add("active");
          }
        }
      }
    },
    _renderList() {
      const listEl = document.getElementById("moment-list");
      if (listEl) listEl.innerHTML = renderer.renderList(state.moments);
    },
    // 首次使用：绑定链接输入 + 保留天数
    _bindSetupEvents(mainContent) {
      const input = document.getElementById("plaza-link-input");
      const btn = document.getElementById("plaza-link-btn");
      const keepDaysSel = document.getElementById("plaza-setup-keep-days");
      if (keepDaysSel) {
        keepDaysSel.addEventListener("change", (e) => {
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
          alert("无法解析链接，请确认格式正确\n示例：https://www.acfun.cn/moment/am5073277");
          return;
        }
        const amId = parseInt(match[1]);
        state.latestAmId = amId;
        utils.setLastAmId(amId);
        this.showPlazaView();
      };
      btn.addEventListener("click", parseAndStart);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") parseAndStart();
      });
    },
    _bindKeepDaysSelect() {
      const sel = document.getElementById("plaza-keep-days");
      if (!sel) return;
      sel.addEventListener("change", (e) => {
        utils.setKeepDays(parseInt(e.target.value) || CONFIG.KEEP_DAYS_DEFAULT);
        background.cleanupExpired();
      });
    },
    _setupScrollListener() {
      if (state._scrollHandler) {
        window.removeEventListener("scroll", state._scrollHandler);
      }
      state._scrollHandler = () => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        const docHeight = document.documentElement.scrollHeight;
        const backTop = document.querySelector(".plaza-back-top");
        if (backTop) {
          backTop.classList.toggle("visible", scrollTop > CONFIG.BACK_TOP_THRESHOLD);
        }
        const nearBottom = scrollTop + windowHeight >= docHeight - CONFIG.SCROLL_BOTTOM_OFFSET;
        if (!state._downLoading && !state._noMoreDown && nearBottom) {
          this._fetchNextBatch();
        }
      };
      window.addEventListener("scroll", state._scrollHandler, { passive: true });
    },
    // 触底向下加载：固定 20 条，库充足直接预渲染，不足实时抓取
    async _fetchNextBatch() {
      if (state._downLoading || state._noMoreDown) return;
      if (!document.getElementById("moment-list")) return;
      const fromId = state.oldestAmId;
      if (!fromId || fromId <= 0) {
        state._noMoreDown = true;
        return;
      }
      state._downLoading = true;
      const loadMoreEl = document.getElementById("load-more-status");
      if (loadMoreEl) {
        loadMoreEl.className = "plaza-load-more loading";
        loadMoreEl.textContent = "加载中...";
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
        const existing = new Set(state.moments.map((m) => m.amId));
        const newRecords = merged.filter((r) => !existing.has(r.amId));
        if (!newRecords.length) {
          state._noMoreDown = true;
          if (loadMoreEl) {
            loadMoreEl.className = "plaza-load-more";
            loadMoreEl.textContent = "已加载全部动态";
          }
        } else {
          state.moments.push(...newRecords);
          state.oldestAmId = Math.min(...newRecords.map((r) => r.amId));
          const fetchedShort = need > 0 && fetched.length < need;
          const oldestAbs = newRecords[newRecords.length - 1]?.absTs;
          if (fetchedShort || oldestAbs && Date.now() - oldestAbs > CONFIG.DOWN_STOP_AFTER_MS) {
            state._noMoreDown = true;
          }
          this._renderList();
          await this._refreshRecords(newRecords);
          if (loadMoreEl) {
            loadMoreEl.className = "plaza-load-more";
            loadMoreEl.textContent = state._noMoreDown ? "已加载全部动态" : "";
          }
        }
      } finally {
        state._downLoading = false;
      }
    }
  };

  // src/navigation.js
  var navigation = {
    // 在侧边栏注入「动态广场」入口
    setupNavigation() {
      const checkNav = setInterval(() => {
        const feedsNav = document.querySelector('.sub-nav-title a[href="/member/feeds"]') || document.querySelector('a[href="/member/feeds"]') || document.querySelector('.ac-member-navigation a[href*="/feeds"]');
        if (feedsNav) {
          clearInterval(checkNav);
          this.addPlazaNavItem(feedsNav);
        }
      }, CONFIG.NAV_POLL_INTERVAL);
      setTimeout(() => clearInterval(checkNav), CONFIG.NAV_POLL_TIMEOUT);
    },
    addPlazaNavItem(feedsNav) {
      if (document.querySelector(".plaza-nav-item")) return;
      const feedsLink = feedsNav.querySelector('a[href="/member/feeds"]') || feedsNav;
      if (feedsLink.tagName === "A") {
        feedsLink.addEventListener("click", (e) => {
          const mainContent = document.querySelector(SEL_MAIN_FEEDS);
          if (mainContent && mainContent.querySelector(".moment-plaza-container")) {
            e.preventDefault();
            e.stopPropagation();
            location.reload();
          }
        });
      }
      const plazaItem = document.createElement("a");
      plazaItem.href = "javascript:void(0)";
      plazaItem.className = "ac-member-navigation-item ac-member-navigation-sub-item plaza-nav-item";
      plazaItem.textContent = "动态广场";
      plazaItem.addEventListener("click", (e) => {
        e.preventDefault();
        controller.enterPlaza();
      });
      const subNavGroup = feedsNav.closest(".member-sub-nav");
      if (subNavGroup) {
        const fansLink = subNavGroup.querySelector('a[href="/member/feeds/fans"]');
        if (fansLink) {
          fansLink.parentNode.insertBefore(plazaItem, fansLink.nextSibling);
        } else {
          subNavGroup.appendChild(plazaItem);
        }
        subNavGroup.querySelectorAll("a:not(.plaza-nav-item)").forEach((link) => {
          link.addEventListener("click", () => {
            plazaItem.classList.remove("ac-member-navigation-item-active");
          });
        });
      }
      feedsNav.addEventListener("click", () => {
        plazaItem.classList.remove("ac-member-navigation-item-active");
      });
    },
    // /member/feeds 页：自动进入广场（跳转回来时）或显示推广条
    setupFeedsPage() {
      if (GM_getValue(AUTO_ENTER_KEY, false)) {
        GM_setValue(AUTO_ENTER_KEY, false);
        const waitForContent = setInterval(() => {
          const mainContent = document.querySelector(SEL_MAIN_FEEDS);
          if (mainContent) {
            clearInterval(waitForContent);
            controller.enterPlaza();
          }
        }, CONFIG.FEEDS_POLL_INTERVAL);
        setTimeout(() => clearInterval(waitForContent), CONFIG.NAV_POLL_TIMEOUT);
        return;
      }
      setTimeout(() => {
        this.addPlazaPromotion();
      }, CONFIG.PROMOTION_DELAY_MS);
    },
    addPlazaPromotion() {
      if (document.querySelector(".plaza-promotion")) return;
      const header = document.querySelector(".ac-member-feeds-header");
      if (header) {
        const promotion = document.createElement("div");
        promotion.className = "plaza-promotion";
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
        promotion.querySelector("button").addEventListener("click", () => {
          controller.enterPlaza();
        });
        header.parentNode.insertBefore(promotion, header.nextSibling);
      }
    }
  };

  // src/events.js
  var events = {
    // 打开/收起表情面板；首次打开时拉取表情包数据并填充
    async toggleEmotPanel(panel) {
      const willShow = panel.style.display === "none";
      document.querySelectorAll(".plaza-emot-panel").forEach((p) => {
        p.style.display = "none";
      });
      if (!willShow) return;
      panel.style.display = "";
      if (panel.dataset.loaded) return;
      await api.fetchEmoticonPacks();
      const packs = state.emoticonPacks || [];
      if (!packs.length) {
        panel.innerHTML = '<div class="plaza-emot-empty">表情加载失败（可能未登录）</div>';
      } else {
        panel.innerHTML = packs.map((p) => `
                <div class="plaza-emot-pack">
                    <div class="plaza-emot-pack-name">${utils.escapeHtml(p.name)}</div>
                    <div class="plaza-emot-grid">
                        ${p.items.map((it) => `<img class="plaza-emot-item" data-code="${it.id}" data-pkg="${utils.escapeHtml(p.name)}" src="${it.url.replace(/"/g, "%22")}" alt="">`).join("")}
                    </div>
                </div>
            `).join("");
      }
      panel.dataset.loaded = "1";
    },
    // 在 textarea 光标处插入文本
    _insertAtCursor(input, text) {
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? start;
      input.value = input.value.slice(0, start) + text + input.value.slice(end);
      input.focus();
      input.selectionStart = input.selectionEnd = start + text.length;
    },
    bindAll() {
      document.addEventListener("click", async (e) => {
        if (!e.target.closest(".plaza-emot-panel") && !e.target.closest(".plaza-editor-emot")) {
          document.querySelectorAll(".plaza-emot-panel").forEach((p) => {
            p.style.display = "none";
          });
        }
        if (!e.target.closest(".moment-plaza-container, .plaza-promotion")) return;
        const emotBtn = e.target.closest(".plaza-editor-emot");
        if (emotBtn) {
          const panel = emotBtn.closest(".plaza-comment-editor")?.querySelector(".plaza-emot-panel");
          if (panel) this.toggleEmotPanel(panel);
          return;
        }
        const emotItem = e.target.closest(".plaza-emot-item");
        if (emotItem) {
          const input = emotItem.closest(".plaza-comment-editor")?.querySelector(".plaza-editor-input");
          if (input) this._insertAtCursor(input, `[emot=acfun,${emotItem.dataset.code}/]`);
          return;
        }
        const imgBtn = e.target.closest(".plaza-editor-img");
        if (imgBtn) {
          const editorBox = imgBtn.closest(".plaza-comment-editor");
          if (editorBox?.dataset.uploading !== "1") {
            editorBox?.querySelector(".plaza-editor-file")?.click();
          }
          return;
        }
        const pendingDel = e.target.closest(".plaza-editor-pending-del");
        if (pendingDel) {
          const pending = pendingDel.closest(".plaza-editor-pending");
          pending.style.display = "none";
          pending.querySelector("img").removeAttribute("src");
          return;
        }
        if (e.target.closest("#up-status") || e.target.closest("#fetch-status")) {
          controller.refreshPlaza();
          return;
        }
        const shareBtn = e.target.closest(".feed-interactive-repost");
        if (shareBtn) {
          const card = shareBtn.closest(".moment-plaza-item");
          if (!card) return;
          const amId = card.dataset.amId;
          const url = `https://www.acfun.cn/moment/am${amId}`;
          const showCopied = () => {
            const el = shareBtn.querySelector("span:last-child");
            if (el) {
              el.textContent = "已复制";
              setTimeout(() => {
                el.textContent = "分享";
              }, CONFIG.TOAST_DURATION_MS);
            }
          };
          try {
            await navigator.clipboard.writeText(url);
            showCopied();
          } catch {
            const input = document.createElement("input");
            input.value = url;
            document.body.appendChild(input);
            input.select();
            document.execCommand("copy");
            input.remove();
            showCopied();
          }
          return;
        }
        const likeBtn = e.target.closest(".feed-interactive-like");
        if (likeBtn) {
          const card = likeBtn.closest(".moment-plaza-item");
          if (!card) return;
          const amId = card.dataset.amId;
          const record = state.moments.find((m) => m.amId == amId);
          const authorId = record?.data?.user?.id || record?.data?.user?.userId;
          if (!authorId) return;
          if (likeBtn.dataset.loading) return;
          likeBtn.dataset.loading = "1";
          const isLiked = likeBtn.hasAttribute("active");
          try {
            const result = await api.likeMoment(amId, authorId, isLiked);
            if (result) {
              if (isLiked) likeBtn.removeAttribute("active");
              else likeBtn.setAttribute("active", "");
              const nodes = likeBtn.childNodes;
              for (let i = nodes.length - 1; i >= 0; i--) {
                if (nodes[i].nodeType === 3 && nodes[i].textContent.trim()) {
                  const count = parseInt(nodes[i].textContent.trim()) || 0;
                  nodes[i].textContent = (isLiked ? Math.max(0, count - 1) : count + 1) + COUNT_SUFFIX;
                  break;
                }
              }
              const m = state.moments.find((x) => x.amId == amId);
              if (m?.data) {
                m.data.isLike = !isLiked;
                m.data.likeCount = (m.data.likeCount || 0) + (isLiked ? -1 : 1);
              }
            }
          } finally {
            delete likeBtn.dataset.loading;
          }
          return;
        }
        const bananaBtn = e.target.closest(".feed-interactive-banana");
        if (bananaBtn) {
          const card = bananaBtn.closest(".moment-plaza-item");
          if (!card) return;
          const amId = card.dataset.amId;
          if (bananaBtn.dataset.loading) return;
          bananaBtn.dataset.loading = "1";
          try {
            const result = await api.throwBanana(amId);
            if (result) {
              if (result.result === 0) {
                bananaBtn.setAttribute("active", "");
                const numEl = bananaBtn.querySelector("span:last-child");
                if (numEl) {
                  const count = parseInt(numEl.textContent) || 0;
                  numEl.textContent = count + 1;
                }
                const m = state.moments.find((x) => x.amId == amId);
                if (m?.data) {
                  m.data.isThrowBanana = true;
                  m.data.bananaCount = (m.data.bananaCount || 0) + 1;
                }
              } else if (result.error_msg) {
                alert(result.error_msg);
              }
            }
          } finally {
            delete bananaBtn.dataset.loading;
          }
          return;
        }
        const commentLikeBtn = e.target.closest(".area-comment-like");
        if (commentLikeBtn && commentLikeBtn.closest(".moment-comments")) {
          const card = commentLikeBtn.closest(".moment-plaza-item");
          const amId = card?.dataset.amId;
          const commentItem = commentLikeBtn.closest(".area-comment-top");
          const commentId = commentItem?.querySelector(".plaza-reply-btn")?.dataset.commentId;
          if (!amId || !commentId) return;
          const isLiked = commentLikeBtn.classList.contains("area-comment-up");
          const result = await api.likeComment(amId, commentId, isLiked);
          if (result && result.result === 0) {
            commentLikeBtn.classList.toggle("area-comment-up");
            const text = commentLikeBtn.textContent.trim();
            const match = text.match(/\d+/);
            const currentCount = match ? parseInt(match[0]) : 0;
            const newCount = isLiked ? Math.max(0, currentCount - 1) : currentCount + 1;
            commentLikeBtn.textContent = newCount > 0 ? `赞 ${newCount}` : "赞";
          }
          return;
        }
        const commentBtn = e.target.closest(".feed-interactive-comment");
        if (commentBtn) {
          const card = commentBtn.closest(".moment-plaza-item");
          if (!card) return;
          const amId = card.dataset.amId;
          const container = document.getElementById(`comments-${amId}`);
          if (!container) return;
          if (container.style.display !== "none") {
            container.style.display = "none";
            commentBtn.classList.remove("active");
            return;
          }
          if (container.innerHTML) {
            container.style.display = "";
            commentBtn.classList.add("active");
            return;
          }
          container.style.display = "";
          container.innerHTML = '<div class="plaza-comment-empty">评论加载中...</div>';
          commentBtn.classList.add("active");
          controller._refreshOneMoment(amId).catch(() => {
          });
          const data = await api.fetchComments(amId);
          container.innerHTML = renderer.renderComments(data, amId);
          return;
        }
        const replyBtn = e.target.closest(".plaza-reply-btn");
        if (replyBtn) {
          const commentId = replyBtn.dataset.commentId;
          const box = document.getElementById(`reply-box-${commentId}`);
          document.querySelectorAll(".plaza-reply-box").forEach((b) => b.style.display = "none");
          if (box) {
            box.style.display = "flex";
            box.querySelector(".plaza-editor-input")?.focus();
          }
          return;
        }
        const editorSend = e.target.closest(".plaza-editor-send");
        if (editorSend) {
          const amId = editorSend.dataset.amId;
          const replyTo = editorSend.dataset.replyTo;
          const editorBox = editorSend.closest(".plaza-comment-editor");
          const input = editorBox?.querySelector(".plaza-editor-input");
          const pendingBox = editorBox?.querySelector(".plaza-editor-pending");
          const pendingImg = pendingBox?.querySelector("img");
          let content = input?.value?.trim() || "";
          const hasImg = !!pendingBox && pendingBox.style.display !== "none" && pendingImg?.src;
          if (!content && !hasImg) return;
          if (hasImg) content = (content ? content + "\r\n" : "") + `[img=图片]${pendingImg.src}[/img]`;
          editorSend.disabled = true;
          editorSend.textContent = "...";
          const result = await api.postComment(amId, content, replyTo ? parseInt(replyTo) : 0);
          if (result && result.result === 0) {
            const container = document.getElementById(`comments-${amId}`);
            if (container) {
              const data = await api.fetchComments(amId);
              container.innerHTML = renderer.renderComments(data, amId);
            }
          } else {
            alert("发送失败，请重试");
            editorSend.disabled = false;
            editorSend.textContent = replyTo ? "发送" : "发表";
          }
          return;
        }
      });
      document.addEventListener("change", async (e) => {
        const fileInput = e.target.closest?.(".plaza-editor-file");
        if (!fileInput) return;
        const editorBox = fileInput.closest(".plaza-comment-editor");
        const file = fileInput.files && fileInput.files[0];
        fileInput.value = "";
        if (!editorBox || !file) return;
        if (!file.type.startsWith("image/")) {
          alert("只能上传图片文件");
          return;
        }
        if (file.size > CONFIG.MAX_IMAGE_SIZE) {
          alert("图片不能超过 5M");
          return;
        }
        editorBox.dataset.uploading = "1";
        const pending = editorBox.querySelector(".plaza-editor-pending");
        pending.style.display = "none";
        const imgBtn = editorBox.querySelector(".plaza-editor-img");
        imgBtn.style.opacity = ".5";
        const url = await api.uploadImage(file);
        editorBox.dataset.uploading = "";
        imgBtn.style.opacity = "";
        if (!url) {
          alert("图片上传失败，请重试");
          return;
        }
        const pendingImg = pending.querySelector("img");
        pendingImg.src = url;
        pending.style.display = "flex";
      });
      document.addEventListener("keydown", async (e) => {
        if (e.key !== "Enter") return;
        const editor2 = e.target.closest?.(".plaza-editor-input");
        if (editor2) {
          if (!(e.ctrlKey || e.metaKey)) return;
          e.preventDefault();
          editor2.closest(".plaza-comment-editor")?.querySelector(".plaza-editor-send")?.click();
          return;
        }
      });
      document.addEventListener("mousedown", (e) => {
        if (e.target.closest(".plaza-editor-actions")) e.preventDefault();
      });
      document.addEventListener("focusin", (e) => {
        const editorBox = e.target.closest?.(".plaza-comment-editor");
        if (editorBox && !editorBox.closest?.(".plaza-reply-box")) {
          editorBox.classList.add("expanded");
        }
        if (e.target.closest?.(".plaza-editor-input") && !e.target.closest?.(".plaza-reply-box")) {
          document.querySelectorAll(".plaza-reply-box").forEach((b) => b.style.display = "none");
        }
      });
      document.addEventListener("focusout", (e) => {
        const editorBox = e.target.closest?.(".plaza-comment-editor");
        if (!editorBox || editorBox.closest?.(".plaza-reply-box")) return;
        setTimeout(() => {
          if (editorBox.contains(document.activeElement)) return;
          const input = editorBox.querySelector(".plaza-editor-input");
          const pending = editorBox.querySelector(".plaza-editor-pending");
          const hasImg = !!pending && pending.style.display !== "none";
          if (input && !input.value.trim() && !hasImg) {
            editorBox.classList.remove("expanded");
          }
        }, 0);
      });
    }
  };

  // src/main.js
  injectStyles();
  function init() {
    if (!window.location.pathname.startsWith("/member")) return;
    navigation.setupNavigation();
    background.start();
    events.bindAll();
    api.fetchEmoticonPacks();
    if (window.location.pathname.startsWith("/member/feeds")) {
      navigation.setupFeedsPage();
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
