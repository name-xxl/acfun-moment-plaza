import { CONFIG, NAME_COLOR_PURPLE, NAME_COLOR_RED } from './config.js';
import { utils } from './utils.js';
import { editor } from './editor.js';

// 原生 HTML 里数字文本节点后带的空白，替换数字时保留以维持排版
export const COUNT_SUFFIX = '\n    ';

export const renderer = {
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

    // 保留天数下拉框的 option 列表（工具栏与首次设置框共用）
    keepDaysOptionsHtml() {
        const keepDays = utils.getKeepDays();
        return CONFIG.KEEP_DAYS_OPTIONS
            .map(d => `<option value="${d}"${d === keepDays ? ' selected' : ''}>${d}</option>`)
            .join('');
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
                        nodes[i].textContent = utils.formatNumber(commentCount) + COUNT_SUFFIX;
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
        if (!text) return '';
        return String(text)
            .replace(/\[img=[^\]]*\][\s\S]*?\[\/img\]/gi, '[图]')
            .replace(/\[at uid=\d+\]@?([\s\S]*?)\[\/at\]/g, '@$1')
            .replace(/\[emot=\w+,\d+\/?\]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    },

    // 提取转发内容信息（repostSource 由 api 层附加到 moment 上）
    // 类型映射：resourceType 2=视频 3=文章 10=动态（originResourceType 1/2/3 只是文章/漫画/视频的转发来源差异，统一走这里）
    _getRepostInfo(moment) {
        const rs = moment.repostSource;
        if (!rs) return null;
        const isMomentRepost = rs.resourceType === 10;

        let title = rs.articleTitle || rs.caption || rs.description || '';
        let cover = rs.coverUrl || '';
        if (isMomentRepost) {
            // 转发动态：原文和首图在嵌套 moment 里，作者在 repostSource.user（嵌套 moment.user 为 null）
            title = this._plainText(rs.moment?.text) || rs.discoveryResourceFeedShowContent || title;
            cover = cover || rs.moment?.imgs?.[0]?.url || '';
        }
        if (!title && !cover) return null;
        if (title.length > 60) title = title.slice(0, 60) + '…';

        const typeMap = { 2: '视频', 3: '文章', 10: '动态' };
        let href = '';
        if (rs.resourceId) {
            if (rs.resourceType === 10) href = `//www.acfun.cn/moment/am${rs.resourceId}`;
            else href = `//www.acfun.cn/${rs.resourceType === 2 ? 'v' : 'a'}/ac${rs.resourceId}`;
        }
        if (!href && rs.shareUrl) href = String(rs.shareUrl).replace(/^https?:/, '');

        return {
            title,
            isMomentRepost,
            cover: String(cover || '').replace(/"/g, '%22'),
            href: String(href).replace(/"/g, '%22'),
            label: typeMap[rs.resourceType] || '内容',
            duration: rs.playDuration || '',
            author: rs.user?.userName || rs.userInfo?.userName || '',
        };
    },

    _repostCardHtml(repost) {
        const meta = [];
        if (repost.duration) meta.push(utils.escapeHtml(repost.duration));
        if (repost.author) meta.push(utils.escapeHtml(repost.author));
        return `
            <a class="plaza-repost-card" href="${repost.href}" target="_blank">
                ${repost.cover ? `<img class="plaza-repost-cover" src="${repost.cover}">` : ''}
                <div class="plaza-repost-info">
                    <div class="plaza-repost-title">${utils.escapeHtml(repost.title)}</div>
                    <div class="plaza-repost-meta"><span class="plaza-repost-tag">${repost.label}</span>${meta.map(m => `<span>${m}</span>`).join('')}</div>
                </div>
            </a>
        `;
    },

    renderCard(record, opts = {}) {
        const pending = !!opts.pending;
        const moment = record.data || record.moment || record;
        const user = moment.user || {};

        const userId = user.id || user.userId || '';
        const userName = user.name || '';
        const userAvatar = utils.attrEscape((user.headCdnUrls?.[0]?.url || user.headUrl || '') + '?imageMogr2/auto-orient/format/webp/quality/80!/ignore-error/1');

        const repost = this._getRepostInfo(moment);
        const repostHtml = repost ? this._repostCardHtml(repost) : '';

        const rawText = moment.text || moment.replaceUbbText || '';
        const text = utils.parseContent(rawText);

        const images = moment.imgs || [];
        let imageHtml = '';
        if (images.length > 0) {
            const imgCount = Math.min(images.length, CONFIG.MAX_IMAGES);
            const imgTags = images.slice(0, CONFIG.MAX_IMAGES).map(img => {
                const url = img.url || img.originUrl || '';
                return url ? `<img src="${utils.attrEscape(url)}">` : '';
            }).filter(Boolean).join('');
            imageHtml = `<div class="member-feed-moment-image member-feed-moment-image-${imgCount}">${imgTags}</div>`;
        }

        const amId = record.amId || moment.momentId;

        const nameColor = user.nameColor;
        const nameColorStyle = nameColor === 2 ? `color:${NAME_COLOR_PURPLE};` : `color:${NAME_COLOR_RED};`;

        // 展示时间：优先用存储的绝对时间戳动态计算，保证准确
        const absTs = record.absTs || utils.computeAbsTs(moment.createTime, Date.now());
        const createTime = utils.formatTime(absTs) || moment.createTime || '';

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
        const userName = comment.userName || '';
        const userId = comment.userId || '';
        const avatar = utils.attrEscape(comment.userHeadImgInfo?.thumbnailImageCdnUrl || comment.headUrl?.[0]?.url || '');
        const rawContent = comment.content || '';
        const content = utils.parseContent(rawContent);
        const likeCount = comment.likeCount || 0;
        const time = comment.postDate || '';
        const floor = comment.floor || '';
        const nameColor = comment.nameColor === 2 ? NAME_COLOR_PURPLE : NAME_COLOR_RED;
        const device = comment.deviceModel || '';
        const isUp = comment.isUp;
        const isCommentLiked = comment.isLiked || false;

        // 楼中楼回复前缀：回复 @被回复用户名 :
        const replyToName = comment.replyToUserName || '';
        const replyToId = comment.replyTo || 0;
        let replyPrefix = '';
        if (isSec && replyToName && replyToId) {
            replyPrefix = `<span class="plaza-reply-prefix">回复 <a class="plaza-at-link" href="//www.acfun.cn/u/${replyToId}" target="_blank">@${utils.escapeHtml(replyToName)}</a> :</span>`;
        }

        const subComments = comment.subComments || [];
        const subHtml = subComments.length > 0
            ? `<div class="area-comment-sec clearfix"><div class="area-sec-list">${subComments.map(s => this.renderComment(s, amId, true)).join('')}</div></div>`
            : '';

        const secClass = isSec ? ' sec' : '';
        const nameStyle = isSec ? '' : ` style="color:${nameColor}"`;

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
                            ${isUp ? '<span class="plaza-up-tag">UP主</span>' : ''}
                            <span class="time_day">发表于</span>
                            <span class="time_times">${time}</span>
                        </div>
                        <div class="area-comment-des">
                            <p class="area-comment-des-content">${replyPrefix}${content}</p>
                        </div>
                        <div class="area-comment-tool">
                            <a class="area-comment-like${isCommentLiked ? ' area-comment-up' : ''}">${likeCount > 0 ? `赞 ${likeCount}` : '赞'}</a>
                            <a class="plaza-reply-btn" data-comment-id="${comment.commentId}" data-user="${utils.escapeHtml(userName)}">回复</a>
                            <span class="area-comment-from">
                                ${device ? `<span>来自</span><a class="deviceModel" target="_blank" href="//www.acfun.cn/app/">${utils.escapeHtml(device)}</a>` : ''}
                            </span>
                        </div>
                        <div class="plaza-reply-box" id="reply-box-${comment.commentId}" style="display:none;">
                            ${editor.renderEditor(amId, { replyToCommentId: comment.commentId, placeholder: `回复 ${userName}...`, buttonText: '发送' })}
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
        const total = data?.commentCount ?? '';
        const editorHtml = `
            <div class="plaza-comment-title">评论 ${total}</div>
            ${editor.renderEditor(amId, { buttonText: '发表' })}
        `;

        if (!data) return editorHtml + '<div class="plaza-comment-load-failed">评论加载失败</div>';
        const comments = data.rootComments || [];
        const subMap = data.subCommentsMap || {};
        if (comments.length === 0) return editorHtml + '<div class="plaza-comment-empty">暂无评论</div>';

        const enriched = comments.map(c => {
            const id = c.commentId?.toString();
            const subEntry = subMap[id];
            const subList = subEntry?.subComments || subEntry || [];
            return { ...c, subComments: Array.isArray(subList) ? subList : [] };
        });

        const html = enriched.map(c => this.renderComment(c, amId)).join('');
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
        return `<div class="moment-plaza-list">${sorted.map(r => {
            const absTs = r.absTs;
            const pending = !!absTs && (now - absTs) <= CONFIG.FRESH_WINDOW_MS;
            return this.renderCard(r, { pending });
        }).join('')}</div>`;
    }
};
