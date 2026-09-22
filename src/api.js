import { CONFIG } from './config.js';
import { state } from './state.js';
import { utils } from './utils.js';

let _apiToken = null;
let _tokenExpiry = 0;
let _emoticonPromise = null;

// bigUrl 供面板悬停大图预览（原生页缓存里没有时退回小图），name 供预览标注
function _applyEmoticons(flat) {
    const map = {};
    const packs = [];
    const byName = {};
    for (const u of flat) {
        if (!u || !u.emotionId || !u.emotionImageUrl) continue;
        const big = u.emotionBigUrl || u.emotionImageUrl;
        const name = u.emotionName || '';
        map[u.emotionId] = { url: u.emotionImageUrl, big: big, name: name, pkg: u.emotionPkgName || '' };
        let pack = byName[u.emotionPkgName];
        if (!pack) {
            pack = byName[u.emotionPkgName] = { name: u.emotionPkgName || '表情', items: [] };
            packs.push(pack);
        }
        pack.items.push({ id: u.emotionId, url: u.emotionImageUrl, big: big, name: name });
    }
    state.emoticonMap = map;
    state.emoticonPacks = packs;
}

export const api = {
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
                        if (data.result === 0) {
                            // 转发内容挂在响应顶层（moment 平级），附加进 moment 便于存库与渲染
                            if (data.repostSource && data.moment) {
                                data.moment.repostSource = data.repostSource;
                            }
                            resolve(data);
                        } else {
                            resolve(null);
                        }
                    } catch (e) { resolve(null); }
                },
                onerror: () => resolve(null)
            });
        });
    },

    // 获取评论列表
    fetchComments(amId, count = CONFIG.COMMENT_PAGE_SIZE, cursor = '') {
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

    // 表情包映射：优先读原生页写入的 localStorage 缓存，其次拉接口（需登录）
    fetchEmoticonPacks() {
        if (_emoticonPromise) return _emoticonPromise;
        _emoticonPromise = new Promise((resolve) => {
            try {
                const cached = JSON.parse(localStorage.getItem('emoticonList') || 'null');
                if (Array.isArray(cached) && cached.length) {
                    _applyEmoticons(cached);
                    resolve(true);
                    return;
                }
            } catch (e) {}
            GM_xmlhttpRequest({
                method: 'POST',
                url: 'https://www.acfun.cn/rest/pc-direct/emotion/getUserEmotion',
                headers: { 'Accept': 'application/json' },
                onload: (resp) => {
                    try {
                        const data = JSON.parse(resp.responseText);
                        const packs = data.emotionPackageList || data.data || [];
                        const flat = [];
                        for (const p of packs) {
                            for (const it of (p.emotions || [])) {
                                const url = it.emotionImageSmallUrl
                                    || (it.smallImageInfo && it.smallImageInfo.thumbnailImageCdnUrl)
                                    || (it.smallImageInfo && it.smallImageInfo.thumbnailImage && it.smallImageInfo.thumbnailImage.cdnUrls && it.smallImageInfo.thumbnailImage.cdnUrls[0] && it.smallImageInfo.thumbnailImage.cdnUrls[0].url)
                                    || '';
                                // emotionImageBigUrl 实测可能是字符串也可能是 [{url}]，两种都兜住
                                const rawBig = (typeof it.emotionImageBigUrl === 'string' && it.emotionImageBigUrl)
                                    || (it.bigImageInfo && it.bigImageInfo.thumbnailImageCdnUrl)
                                    || (it.bigImageInfo && it.bigImageInfo.thumbnailImage && it.bigImageInfo.thumbnailImage.cdnUrls && it.bigImageInfo.thumbnailImage.cdnUrls[0] && it.bigImageInfo.thumbnailImage.cdnUrls[0].url)
                                    || '';
                                flat.push({
                                    emotionId: it.id,
                                    emotionPkgName: p.name,
                                    emotionImageUrl: url,
                                    emotionBigUrl: rawBig || url,
                                    emotionName: (typeof it.name === 'string' && it.name) || ''
                                });
                            }
                        }
                        _applyEmoticons(flat);
                        resolve(true);
                    } catch (e) { _emoticonPromise = null; resolve(false); }
                },
                onerror: () => { _emoticonPromise = null; resolve(false); }
            });
        });
        return _emoticonPromise;
    },

    // 获取API token（点赞用）
    async getApiToken() {
        if (_apiToken && Date.now() < _tokenExpiry) return _apiToken;
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
                            _apiToken = data['acfun.midground.api_st'] || '';
                            _tokenExpiry = Date.now() + CONFIG.TOKEN_TTL_MS;
                        }
                    } catch {}
                    resolve(_apiToken);
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

    // 发评论（replyToCommentId 传入则为回复楼中楼）
    async postComment(amId, content, replyToCommentId = 0) {
        const midgroundToken = await this.getApiToken();
        const body = `sourceId=${amId}&sourceType=4&content=${encodeURIComponent(content)}` +
            (replyToCommentId ? `&replyToCommentId=${replyToCommentId}` : '') +
            (midgroundToken ? `&midgroundToken=${encodeURIComponent(midgroundToken)}` : '');
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
    },

    // 上传评论图片（kuaishouzt 网关四步：getToken → 分片上传 → complete → 换取 URL）
    // 返回可长期访问的裸路径 URL（preview 域名的 ksc2 路径即文件标识，签名参数会过期需剥掉）
    async uploadImage(file) {
        const token = await new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: 'https://www.acfun.cn/rest/pc-direct/image/upload/getToken',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                data: `fileName=${encodeURIComponent(file.name || 'image.png')}`,
                onload: (resp) => {
                    try {
                        const data = JSON.parse(resp.responseText);
                        resolve(data.result === 0 ? (data.info?.token || null) : null);
                    } catch { resolve(null); }
                },
                onerror: () => resolve(null)
            });
        });
        if (!token) return null;

        const endpoint = 'https://upload.kuaishouzt.com';
        const total = file.size;
        const chunks = Math.max(1, Math.ceil(total / CONFIG.UPLOAD_CHUNK_SIZE));

        for (let i = 0; i < chunks; i++) {
            const start = i * CONFIG.UPLOAD_CHUNK_SIZE;
            const end = Math.min(start + CONFIG.UPLOAD_CHUNK_SIZE, total);
            const ok = await new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: `${endpoint}/api/upload/fragment?upload_token=${encodeURIComponent(token)}&fragment_id=${i}`,
                    headers: {
                        'Content-Type': 'application/octet-stream',
                        'Content-Range': `bytes ${start}-${end - 1}/${total}`,
                    },
                    data: file.slice(start, end),
                    onload: (resp) => {
                        try { resolve(JSON.parse(resp.responseText).result === 1); }
                        catch { resolve(false); }
                    },
                    onerror: () => resolve(false)
                });
            });
            if (!ok) { utils.log('图片分片上传失败: 分片', i); return null; }
        }

        const completed = await new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: `${endpoint}/api/upload/complete?upload_token=${encodeURIComponent(token)}&fragment_count=${chunks}`,
                onload: (resp) => {
                    try { resolve(JSON.parse(resp.responseText).result === 1); }
                    catch { resolve(false); }
                },
                onerror: () => resolve(false)
            });
        });
        if (!completed) { utils.log('图片上传 complete 失败'); return null; }

        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: 'https://www.acfun.cn/rest/pc-direct/image/upload/getUrlAfterUpload',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                data: `token=${encodeURIComponent(token)}&bizFlag=web-comment-text`,
                onload: (resp) => {
                    try {
                        const data = JSON.parse(resp.responseText);
                        resolve(data.result === 0 && data.url ? data.url.split('?')[0] : null);
                    } catch { resolve(null); }
                },
                onerror: () => resolve(null)
            });
        });
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

    // 拉取动态广场列表（APP 端接口，免登录，服务端已过滤粉丝可见，每页固定 20 条，不含转发）
    // cursor 为空拉最新一页，否则按 pcursor 续翻更旧的一页；翻到底时 pcursor 返回 "no_more"
    // 返回 { records: [{ amId, absTs, data, fetchedAt }], nextCursor, noMore }，请求失败返回 null
    fetchFeedSquare(cursor = '') {
        return new Promise((resolve) => {
            const qs = cursor ? `?pcursor=${encodeURIComponent(cursor)}` : '';
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${CONFIG.FEED_SQUARE_API}${qs}`,
                headers: { 'Accept': 'application/json' },
                onload: (response) => {
                    try {
                        const data = JSON.parse(response.responseText);
                        if (data.result !== 0 || !Array.isArray(data.feedList)) { resolve(null); return; }
                        const now = Date.now();
                        const records = data.feedList
                            .filter(f => f.moment && f.moment.momentId && f.createTime)
                            .map(f => this._squareFeedToRecord(f, now));
                        const nextCursor = String(data.pcursor || '');
                        resolve({ records, nextCursor, noMore: nextCursor === 'no_more' });
                    } catch (e) { resolve(null); }
                },
                onerror: () => resolve(null)
            });
        });
    },

    // feedSquare 条目 → 本地记录格式：
    // createTime 是绝对时间戳（毫秒），直接作 absTs；互动数字在 feed 顶层（moment 内无 likeCount）；
    // 用户信息从 user/userInfo 映射成 moment/detail 的 user 结构供 renderer 使用
    _squareFeedToRecord(feed, now) {
        const moment = { ...feed.moment };
        const u = feed.user || {};
        const info = feed.userInfo || {};
        moment.user = {
            id: u.userId ?? info.id ?? '',
            name: u.userName ?? info.name ?? '',
            headUrl: u.userHead ?? info.headUrl ?? '',
            headCdnUrls: info.headCdnUrls || (u.userHead ? [{ url: u.userHead }] : []),
            nameColor: u.nameColor ?? info.nameColor,
        };
        moment.likeCount = feed.likeCount ?? 0;
        moment.commentCount = feed.commentCount ?? moment.commentCount ?? 0;
        moment.bananaCount = feed.bananaCount ?? moment.bananaCount ?? 0;
        // 该接口不带登录态，互动状态不可信，展示时以 _refreshOneMoment 的 detail 刷新为准
        moment.isLike = feed.isLike || false;
        moment.isThrowBanana = feed.isThrowBanana || false;
        return {
            amId: parseInt(moment.momentId),
            absTs: feed.createTime,
            data: moment,
            fetchedAt: now,
        };
    }
};
