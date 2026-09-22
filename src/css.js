const layoutStyles = `
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

const interactiveStyles = `
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

const commentStyles = `
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
        position: relative;
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
    /* 头像框覆盖层：同原生机制（框图为独立 PNG/GIF，约 80x70，中心对齐头像略上移，可带头像外装饰）；楼中楼不展示 */
    .plaza-avatar-frame {
        position: absolute;
        left: -15px;
        top: -15px;
        width: 80px;
        height: 70px;
        max-width: none;
        pointer-events: none;
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
        margin-right: 2px;
    }
    .moment-comments .area-comment-title .time_day {
        color: #999;
        font-size: 12px;
        margin-right: 0;
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
    /* 赞按钮图标：原版 13px SVG（base64 抄自原生评论区） */
    .moment-comments .area-comment-like {
        color: #999;
        cursor: pointer;
        margin-right: 13px;
        padding-left: 20px;
        background: url("data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB3aWR0aD0iMTNweCIgaGVpZ2h0PSIxM3B4IiB2aWV3Qm94PSIwIDAgMTMgMTMiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayI+CiAgICA8IS0tIEdlbmVyYXRvcjogU2tldGNoIDUyLjUgKDY3NDY5KSAtIGh0dHA6Ly93d3cuYm9oZW1pYW5jb2RpbmcuY29tL3NrZXRjaCAtLT4KICAgIDx0aXRsZT5pY29uX2NvbW1lbnRfejwvdGl0bGU+CiAgICA8ZGVzYz5DcmVhdGVkIHdpdGggU2tldGNoLjwvZGVzYz4KICAgIDxnIGlkPSJpY29uX2NvbW1lbnRfeiIgc3Ryb2tlPSJub25lIiBzdHJva2Utd2lkdGg9IjEiIGZpbGw9Im5vbmUiIGZpbGwtcnVsZT0iZXZlbm9kZCI+CiAgICAgICAgPGcgaWQ9InphbjEiIGZpbGw9IiM5OTk5OTkiIGZpbGwtcnVsZT0ibm9uemVybyI+CiAgICAgICAgICAgIDxwYXRoIGQ9Ik0xLjUsMyBDMi4zMjg0MjcxMiwzIDMsMy42NzE1NzI4OCAzLDQuNSBMMywxMC41IEMzLDExLjMyODQyNzEgMi4zMjg0MjcxMiwxMiAxLjUsMTIgQzAuNjcxNTcyODc1LDEyIDEuNTU0MzEyMjNlLTE1LDExLjMyODQyNzEgLTEuMTEwMjIzMDJlLTE2LDEwLjUgTC0xLjExMDIyMzAyZS0xNiw0LjUgQy0xLjExMDIyMzAyZS0xNiwzLjY3MTU3Mjg4IDAuNjcxNTcyODc1LDMgMS41LDMgWiIgaWQ9IlJlY3RhbmdsZS0xNSI+PC9wYXRoPgogICAgICAgICAgICA8cGF0aCBkPSJNMTAuNzI0Njg3NSwzLjg5NjQzNDI0IEMxMi4xNzUyNzM5LDMuODk2NDM0MjQgMTMuMjkwNjc2Nyw1LjI4MTY0OTIgMTIuOTM3NTY1Miw2LjQ3MTUxNTkgTDExLjg1NDEwMjcsMTAuMTIyNDE4MyBDMTEuNDE0OTkyNSwxMS42MDIwNzEzIDEwLjkxODg0OTgsMTIgOS40MjQ1MzI1OCwxMiBMNC41LDEyIEM0LjIyMzg1NzYzLDEyIDQsMTEuNzc2MTQyNCA0LDExLjUgTDQsNC4zNSBDNCw0LjE4MDExMDQzIDQuMDg2MjY1NDEsNC4wMjE4NDQzMSA0LjIyOTA0NzMzLDMuOTI5NzgwMjQgTDUuMjM4MDAzODIsMy4yODA5MTY0NSBDNS41NjY5MDY4NiwzLjAzMTc2Mjg3IDUuNzkzNTMxMDIsMi43NDE0OTM3MyA1Ljk1MzY0MjQ5LDIuMzk1MDE4OTggQzYuMDkyOTI0MTksMi4wOTM2MTkwMiA2LjEyMjA3MDY5LDEuOTgxNjQyMjYgNi4yNzc0ODI4OCwxLjI1OTk1OTU2IEM2LjQ4OTkzNzgsMC4yNzMzODkzNDcgNi44NjM3MzY2OSwtMC4xNjExNDk5NjggNy43OTc0MTA0NiwwLjA0MjIyODg2MTYgQzkuMjg0MjE3OTgsMC4zNjYwOTQ4NDUgOS41NzE5NDQ1MSwxLjczNDE4MTczIDguODQzMDE1OTksMy44OTY0MzQyNCBMMTAuNzI0Njg3NSwzLjg5NjQzNDI0IFoiIGlkPSJQYXRoLTQiPjwvcGF0aD4KICAgICAgICA8L2c+CiAgICA8L2c+Cjwvc3ZnPg==") no-repeat 1px 1px / 13px 13px;
    }
    .moment-comments .area-comment-like:hover {
        color: #fd4c5c;
        background-image: url("data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB3aWR0aD0iMTNweCIgaGVpZ2h0PSIxM3B4IiB2aWV3Qm94PSIwIDAgMTMgMTMiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayI+CiAgICA8IS0tIEdlbmVyYXRvcjogU2tldGNoIDUyLjUgKDY3NDY5KSAtIGh0dHA6Ly93d3cuYm9oZW1pYW5jb2RpbmcuY29tL3NrZXRjaCAtLT4KICAgIDx0aXRsZT5pY29uX2NvbW1lbnRfejwvdGl0bGU+CiAgICA8ZGVzYz5DcmVhdGVkIHdpdGggU2tldGNoLjwvZGVzYz4KICAgIDxnIGlkPSJpY29uX2NvbW1lbnRfeiIgc3Ryb2tlPSJub25lIiBzdHJva2Utd2lkdGg9IjEiIGZpbGw9Im5vbmUiIGZpbGwtcnVsZT0iZXZlbm9kZCI+CiAgICAgICAgPGcgaWQ9InphbjEiIGZpbGw9IiNmZDRjNWMiIGZpbGwtcnVsZT0ibm9uemVybyI+CiAgICAgICAgICAgIDxwYXRoIGQ9Ik0xLjUsMyBDMi4zMjg0MjcxMiwzIDMsMy42NzE1NzI4OCAzLDQuNSBMMywxMC41IEMzLDExLjMyODQyNzEgMi4zMjg0MjcxMiwxMiAxLjUsMTIgQzAuNjcxNTcyODc1LDEyIDEuNTU0MzEyMjNlLTE1LDExLjMyODQyNzEgLTEuMTEwMjIzMDJlLTE2LDEwLjUgTC0xLjExMDIyMzAyZS0xNiw0LjUgQy0xLjExMDIyMzAyZS0xNiwzLjY3MTU3Mjg4IDAuNjcxNTcyODc1LDMgMS41LDMgWiIgaWQ9IlJlY3RhbmdsZS0xNSI+PC9wYXRoPgogICAgICAgICAgICA8cGF0aCBkPSJNMTAuNzI0Njg3NSwzLjg5NjQzNDI0IEMxMi4xNzUyNzM5LDMuODk2NDM0MjQgMTMuMjkwNjc2Nyw1LjI4MTY0OTIgMTIuOTM3NTY1Miw2LjQ3MTUxNTkgTDExLjg1NDEwMjcsMTAuMTIyNDE4MyBDMTEuNDE0OTkyNSwxMS42MDIwNzEzIDEwLjkxODg0OTgsMTIgOS40MjQ1MzI1OCwxMiBMNC41LDEyIEM0LjIyMzg1NzYzLDEyIDQsMTEuNzc2MTQyNCA0LDExLjUgTDQsNC4zNSBDNCw0LjE4MDExMDQzIDQuMDg2MjY1NDEsNC4wMjE4NDQzMSA0LjIyOTA0NzMzLDMuOTI5NzgwMjQgTDUuMjM4MDAzODIsMy4yODA5MTY0NSBDNS41NjY5MDY4NiwzLjAzMTc2Mjg3IDUuNzkzNTMxMDIsMi43NDE0OTM3MyA1Ljk1MzY0MjQ5LDIuMzk1MDE4OTggQzYuMDkyOTI0MTksMi4wOTM2MTkwMiA2LjEyMjA3MDY5LDEuOTgxNjQyMjYgNi4yNzc0ODI4OCwxLjI1OTk1OTU2IEM2LjQ4OTkzNzgsMC4yNzMzODkzNDcgNi44NjM3MzY2OSwtMC4xNjExNDk5NjggNy43OTc0MTA0NiwwLjA0MjIyODg2MTYgQzkuMjg0MjE3OTgsMC4zNjYwOTQ4NDUgOS41NzE5NDQ1MSwxLjczNDE4MTczIDguODQzMDE1OTksMy44OTY0MzQyNCBMMTAuNzI0Njg3NSwzLjg5NjQzNDI0IFoiIGlkPSJQYXRoLTQiPjwvcGF0aD4KICAgICAgICA8L2c+CiAgICA8L2c+Cjwvc3ZnPg==");
    }
    .moment-comments .area-comment-like.area-comment-up,
    .moment-comments .area-comment-like[active] {
        color: #fd4c5c !important;
        background-image: url("data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB3aWR0aD0iMTNweCIgaGVpZ2h0PSIxM3B4IiB2aWV3Qm94PSIwIDAgMTMgMTMiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayI+CiAgICA8IS0tIEdlbmVyYXRvcjogU2tldGNoIDUyLjUgKDY3NDY5KSAtIGh0dHA6Ly93d3cuYm9oZW1pYW5jb2RpbmcuY29tL3NrZXRjaCAtLT4KICAgIDx0aXRsZT5pY29uX2NvbW1lbnRfejwvdGl0bGU+CiAgICA8ZGVzYz5DcmVhdGVkIHdpdGggU2tldGNoLjwvZGVzYz4KICAgIDxnIGlkPSJpY29uX2NvbW1lbnRfeiIgc3Ryb2tlPSJub25lIiBzdHJva2Utd2lkdGg9IjEiIGZpbGw9Im5vbmUiIGZpbGwtcnVsZT0iZXZlbm9kZCI+CiAgICAgICAgPGcgaWQ9InphbjEiIGZpbGw9IiNmZDRjNWMiIGZpbGwtcnVsZT0ibm9uemVybyI+CiAgICAgICAgICAgIDxwYXRoIGQ9Ik0xLjUsMyBDMi4zMjg0MjcxMiwzIDMsMy42NzE1NzI4OCAzLDQuNSBMMywxMC41IEMzLDExLjMyODQyNzEgMi4zMjg0MjcxMiwxMiAxLjUsMTIgQzAuNjcxNTcyODc1LDEyIDEuNTU0MzEyMjNlLTE1LDExLjMyODQyNzEgLTEuMTEwMjIzMDJlLTE2LDEwLjUgTC0xLjExMDIyMzAyZS0xNiw0LjUgQy0xLjExMDIyMzAyZS0xNiwzLjY3MTU3Mjg4IDAuNjcxNTcyODc1LDMgMS41LDMgWiIgaWQ9IlJlY3RhbmdsZS0xNSI+PC9wYXRoPgogICAgICAgICAgICA8cGF0aCBkPSJNMTAuNzI0Njg3NSwzLjg5NjQzNDI0IEMxMi4xNzUyNzM5LDMuODk2NDM0MjQgMTMuMjkwNjc2Nyw1LjI4MTY0OTIgMTIuOTM3NTY1Miw2LjQ3MTUxNTkgTDExLjg1NDEwMjcsMTAuMTIyNDE4MyBDMTEuNDE0OTkyNSwxMS42MDIwNzEzIDEwLjkxODg0OTgsMTIgOS40MjQ1MzI1OCwxMiBMNC41LDEyIEM0LjIyMzg1NzYzLDEyIDQsMTEuNzc2MTQyNCA0LDExLjUgTDQsNC4zNSBDNCw0LjE4MDExMDQzIDQuMDg2MjY1NDEsNC4wMjE4NDQzMSA0LjIyOTA0NzMzLDMuOTI5NzgwMjQgTDUuMjM4MDAzODIsMy4yODA5MTY0NSBDNS41NjY5MDY4NiwzLjAzMTc2Mjg3IDUuNzkzNTMxMDIsMi43NDE0OTM3MyA1Ljk1MzY0MjQ5LDIuMzk1MDE4OTggQzYuMDkyOTI0MTksMi4wOTM2MTkwMiA2LjEyMjA3MDY5LDEuOTgxNjQyMjYgNi4yNzc0ODI4OCwxLjI1OTk1OTU2IEM2LjQ4OTkzNzgsMC4yNzMzODkzNDcgNi44NjM3MzY2OSwtMC4xNjExNDk5NjggNy43OTc0MTA0NiwwLjA0MjIyODg2MTYgQzkuMjg0MjE3OTgsMC4zNjYwOTQ4NDUgOS41NzE5NDQ1MSwxLjczNDE4MTczIDguODQzMDE1OTksMy44OTY0MzQyNCBMMTAuNzI0Njg3NSwzLjg5NjQzNDI0IFoiIGlkPSJQYXRoLTQiPjwvcGF0aD4KICAgICAgICA8L2c+CiAgICA8L2c+Cjwvc3ZnPg==");
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
        padding-right: 0;
    }
    .moment-comments .area-comment-sec .area-comment-first {
        padding: 0;
        margin: 15px 0 0;
    }
    .moment-comments .area-comment-sec .sec:first-child .area-comment-first {
        margin-top: 0;
    }
    .moment-comments .area-comment-sec .name {
        font-weight: 700;
    }
    .moment-comments .area-comment-sec hr {
        display: none;
    }
    .plaza-reply-prefix {
        color: #999;
        font-size: 14px;
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

const editorStyles = `
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
    /* 表情面板：对齐原生三段式——头部包名 / 6 列大格子网格 / 底部灰底包切换条 */
    .plaza-emot-panel {
        position: absolute;
        bottom: calc(100% + 10px);
        left: 0;
        width: 560px;
        max-width: calc(100vw - 48px);
        display: none;
        flex-direction: column;
        background: #fff;
        border: 1px solid #e8e8e8;
        border-radius: 8px;
        box-shadow: 0 6px 24px rgba(0,0,0,.14);
        box-sizing: border-box;
        z-index: 100;
    }
    .plaza-emot-panel.open {
        display: flex;
    }
    /* 指向表情按钮的小三角 */
    .plaza-emot-panel::before {
        content: '';
        position: absolute;
        top: -6px;
        left: 22px;
        width: 10px;
        height: 10px;
        background: #fff;
        border-left: 1px solid #e8e8e8;
        border-top: 1px solid #e8e8e8;
        transform: rotate(45deg);
    }
    .plaza-emot-head {
        flex: 0 0 auto;
        padding: 14px 20px 8px;
    }
    .plaza-emot-pack-name {
        font-size: 14px;
        color: #333;
    }
    .plaza-emot-grid {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 2px 6px;
        padding: 0 14px;
        max-height: 316px;
        overflow-y: auto;
        min-height: 0;
        flex: 1 1 auto;
        overscroll-behavior: contain;
    }
    .plaza-emot-item {
        width: 100%;
        height: 56px;
        padding: 6px;
        box-sizing: border-box;
        object-fit: contain;
        cursor: pointer;
        border-radius: 6px;
    }
    .plaza-emot-item:hover {
        background: #f2f2f2;
    }
    .plaza-emot-foot {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        gap: 4px;
        margin-top: 8px;
        padding: 6px 10px;
        background: #f8f8f8;
        border-top: 1px solid #f0f0f0;
        border-radius: 0 0 7px 7px;
    }
    .plaza-emot-strip {
        display: flex;
        align-items: center;
        gap: 16px;
        overflow-x: auto;
        scrollbar-width: none;
        min-width: 0;
        flex: 1 1 auto;
        padding: 3px;
    }
    .plaza-emot-strip::-webkit-scrollbar {
        display: none;
    }
    /* 加 .plaza-emot-panel 前缀压过 .plaza-comment-editor button 的红色按钮全局样式 */
    .plaza-emot-panel .plaza-emot-pack-thumb {
        flex: 0 0 auto;
        width: 36px;
        height: 36px;
        padding: 0;
        border: none;
        border-radius: 4px;
        background: none;
        cursor: pointer;
        opacity: .75;
        transition: width .12s ease, height .12s ease, opacity .12s ease;
    }
    .plaza-emot-panel .plaza-emot-pack-thumb img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
    }
    .plaza-emot-panel .plaza-emot-pack-thumb:hover {
        opacity: 1;
    }
    .plaza-emot-panel .plaza-emot-pack-thumb.active {
        width: 46px;
        height: 46px;
        opacity: 1;
    }
    .plaza-emot-panel .plaza-emot-foot-page {
        flex: 0 0 auto;
        width: 26px;
        height: 26px;
        padding: 0;
        border: none;
        border-radius: 50%;
        background: none;
        color: #666;
        font-size: 20px;
        line-height: 24px;
        text-align: center;
        cursor: pointer;
    }
    .plaza-emot-panel .plaza-emot-foot-page:hover {
        background: #e9e9e9;
    }
    .plaza-emot-empty {
        color: #999;
        font-size: 12px;
        padding: 8px 0;
    }
    /* 悬停大图预览浮层（fixed，尺寸与 emotpanel.js 中常量一致） */
    .plaza-emot-preview {
        display: none;
        position: fixed;
        z-index: 1000;
        width: 140px;
        padding: 8px;
        background: #fff;
        border: 1px solid #e6e6e6;
        border-radius: 8px;
        box-shadow: 0 6px 20px rgba(0,0,0,.15);
        text-align: center;
        pointer-events: none;
    }
    .plaza-emot-preview.show {
        display: block;
    }
    .plaza-emot-preview img {
        width: 120px;
        height: 120px;
        object-fit: contain;
    }
    .plaza-emot-preview span {
        display: block;
        margin-top: 4px;
        font-size: 12px;
        color: #666;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    /* 回复按钮与回复框 */
    .plaza-reply-btn {
        color: #999;
        cursor: pointer;
        margin-right: 13px;
        font-size: 12px;
        padding-left: 17px;
        background: url("data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB3aWR0aD0iMTNweCIgaGVpZ2h0PSIxM3B4IiB2aWV3Qm94PSIwIDAgMTMgMTMiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayI+CiAgICA8IS0tIEdlbmVyYXRvcjogU2tldGNoIDUyLjUgKDY3NDY5KSAtIGh0dHA6Ly93d3cuYm9oZW1pYW5jb2RpbmcuY29tL3NrZXRjaCAtLT4KICAgIDx0aXRsZT5pY29uX2NvbW1lbnRfcGw8L3RpdGxlPgogICAgPGRlc2M+Q3JlYXRlZCB3aXRoIFNrZXRjaC48L2Rlc2M+CiAgICA8ZyBpZD0iaWNvbl9jb21tZW50X3BsIiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMSIgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj4KICAgICAgICA8ZyBpZD0iaWNvbl/mlofnq6Dor4TorrotY29weS0yIiBmaWxsPSIjOTk5OTk5IiBmaWxsLXJ1bGU9Im5vbnplcm8iPgogICAgICAgICAgICA8cGF0aCBkPSJNNC4wNzAwMjc0NywxMiBMMC42MzczNjA1NjQsMTIuOTgwNzYyIEMwLjMxNzk1MjQ2MSwxMy4wNzIwMjE0IDAsMTIuODMyMTg5NCAwLDEyLjUgTDAsNCBDMCwyLjcyMzg1NzYzIDAuNzIzODU3NjI1LDIgMiwyIEwxMSwyIEMxMi4yNzYxNDI0LDIgMTMsMi43MjM4NTc2MyAxMyw0IEwxMywxMCBDMTMsMTEuMjc2MTQyNCAxMi4yNzYxNDI0LDEyIDExLDEyIEw0LjA3MDAyNzQ3LDEyIFogTTksNSBDOC40NDc3MTUyNSw1IDgsNS40NDc3MTUyNSA4LDYgTDgsNyBDOCw3LjU1MjI4NDc1IDguNDQ3NzE1MjUsOCA5LDggQzkuNTUyMjg0NzUsOCAxMCw3LjU1MjI4NDc1IDEwLDcgTDEwLDYgQzEwLDUuNDQ3NzE1MjUgOS41NTIyODQ3NSw1IDksNSBaIE00LDUgQzMuNDQ3NzE1MjUsNSAzLDUuNDQ3NzE1MjUgMyw2IEwzLDcgQzMsNy41NTIyODQ3NSAzLjQ0NzcxNTI1LDggNCw4IEM0LjU1MjI4NDc1LDggNSw3LjU1MjI4NDc1IDUsNyBMNSw2IEM1LDUuNDQ3NzE1MjUgNC41NTIyODQ3NSw1IDQsNSBaIiBpZD0iQ29tYmluZWQtU2hhcGUiPjwvcGF0aD4KICAgICAgICA8L2c+CiAgICA8L2c+Cjwvc3ZnPg==") no-repeat 0 1px / 13px 13px;
    }
    .plaza-reply-btn:hover {
        color: #fd4c5c;
        background-image: url("data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB3aWR0aD0iMTNweCIgaGVpZ2h0PSIxM3B4IiB2aWV3Qm94PSIwIDAgMTMgMTMiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayI+CiAgICA8IS0tIEdlbmVyYXRvcjogU2tldGNoIDUyLjUgKDY3NDY5KSAtIGh0dHA6Ly93d3cuYm9oZW1pYW5jb2RpbmcuY29tL3NrZXRjaCAtLT4KICAgIDx0aXRsZT5pY29uX2NvbW1lbnRfcGw8L3RpdGxlPgogICAgPGRlc2M+Q3JlYXRlZCB3aXRoIFNrZXRjaC48L2Rlc2M+CiAgICA8ZyBpZD0iaWNvbl9jb21tZW50X3BsIiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMSIgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj4KICAgICAgICA8ZyBpZD0iaWNvbl/mlofnq6Dor4TorrotY29weS0yIiBmaWxsPSIjZmQ0YzVjIiBmaWxsLXJ1bGU9Im5vbnplcm8iPgogICAgICAgICAgICA8cGF0aCBkPSJNNC4wNzAwMjc0NywxMiBMMC42MzczNjA1NjQsMTIuOTgwNzYyIEMwLjMxNzk1MjQ2MSwxMy4wNzIwMjE0IDAsMTIuODMyMTg5NCAwLDEyLjUgTDAsNCBDMCwyLjcyMzg1NzYzIDAuNzIzODU3NjI1LDIgMiwyIEwxMSwyIEMxMi4yNzYxNDI0LDIgMTMsMi43MjM4NTc2MyAxMyw0IEwxMywxMCBDMTMsMTEuMjc2MTQyNCAxMi4yNzYxNDI0LDEyIDExLDEyIEw0LjA3MDAyNzQ3LDEyIFogTTksNSBDOC40NDc3MTUyNSw1IDgsNS40NDc3MTUyNSA4LDYgTDgsNyBDOCw3LjU1MjI4NDc1IDguNDQ3NzE1MjUsOCA5LDggQzkuNTUyMjg0NzUsOCAxMCw3LjU1MjI4NDc1IDEwLDcgTDEwLDYgQzEwLDUuNDQ3NzE1MjUgOS41NTIyODQ3NSw1IDksNSBaIE00LDUgQzMuNDQ3NzE1MjUsNSAzLDUuNDQ3NzE1MjUgMyw2IEwzLDcgQzMsNy41NTIyODQ3NSAzLjQ0NzcxNTI1LDggNCw4IEM0LjU1MjI4NDc1LDggNSw3LjU1MjI4NDc1IDUsNyBMNSw2IEM1LDUuNDQ3NzE1MjUgNC41NTIyODQ3NSw1IDQsNSBaIiBpZD0iQ29tYmluZWQtU2hhcGUiPjwvcGF0aD4KICAgICAgICA8L2c+CiAgICA8L2c+Cjwvc3ZnPg==");
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

const contentStyles = `
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

const uiStyles = `
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

const styles = layoutStyles + interactiveStyles + commentStyles + editorStyles + contentStyles + uiStyles;

export function injectStyles() {
    GM_addStyle(styles);
}
