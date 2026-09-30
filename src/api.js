import { CONFIG } from './config.js';
import { state } from './state.js';
import { utils } from './utils.js';

let _apiToken = null;
let _tokenExpiry = 0;
let _tokenPromise = null;
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
    // 统一请求封装：带超时（挂起的请求会把 _downLoading/_upRunning 永久卡死），
    // 网络/超时/JSON 解析失败（含 HTML 错误页）一律 resolve(null)，调用方无需感知网络层差异
    _gmJson(options, timeoutMs = CONFIG.REQUEST_TIMEOUT_MS) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                timeout: timeoutMs,
                ...options,
                onload: (resp) => {
                    try { resolve(JSON.parse(resp.responseText)); } catch { resolve(null); }
                },
                onerror: () => resolve(null),
                ontimeout: () => resolve(null),
            });
        });
    },

    // 根据am号获取单条动态
    fetchMoment(amId) {
        if (!amId || amId <= 0) return Promise.resolve(null);
        return this._gmJson({
            method: 'GET',
            url: `${CONFIG.MOMENT_API}?momentId=${amId}`,
            headers: {
                'Accept': 'application/json',
                'Referer': `https://www.acfun.cn/moment/am${amId}`,
            },
        }).then((data) => {
            if (!data || data.result !== 0) return null;
            // 转发内容挂在响应顶层（moment 平级），附加进 moment 便于存库与渲染
            if (data.repostSource && data.moment) {
                data.moment.repostSource = data.repostSource;
            }
            return data;
        });
    },

    // 获取评论列表
    fetchComments(amId, count = CONFIG.COMMENT_PAGE_SIZE, cursor = '') {
        return this._gmJson({
            method: 'GET',
            url: `${CONFIG.COMMENT_API_BASE}/list?sourceId=${amId}&sourceType=4&cursor=${cursor}&count=${count}`,
            headers: { 'Accept': 'application/json', 'Referer': `https://www.acfun.cn/moment/am${amId}` },
        }).then((data) => (data && data.result === 0 ? data : null));
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
            this._gmJson({
                method: 'POST',
                url: CONFIG.EMOTION_API,
                headers: { 'Accept': 'application/json' },
            }).then((data) => {
                if (!data) {
                    // 网络/解析失败：不占住 promise，下次打开重试
                    _emoticonPromise = null;
                    resolve(false);
                    return;
                }
                try {
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
            });
        });
        return _emoticonPromise;
    },

    // 获取API token（点赞/发评论用），并发调用共享同一次请求
    async getApiToken() {
        if (_apiToken && Date.now() < _tokenExpiry) return _apiToken;
        if (_tokenPromise) return _tokenPromise;
        _tokenPromise = this._gmJson({
            method: 'POST',
            url: CONFIG.TOKEN_API,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
            data: 'sid=acfun.midground.api',
        }).then((data) => {
            if (data && data.result === 0) {
                _apiToken = data['acfun.midground.api_st'] || '';
                _tokenExpiry = Date.now() + CONFIG.TOKEN_TTL_MS;
            }
            return _apiToken;
        }).finally(() => { _tokenPromise = null; });
        return _tokenPromise;
    },

    // 点赞/取消点赞动态
    async likeMoment(momentId, userId, isCancel = false) {
        const token = await this.getApiToken();
        if (!token) return null;
        const endpoint = isCancel ? 'delete' : 'add';
        const data = await this._gmJson({
            method: 'POST',
            url: `${CONFIG.INTERACT_API}/${endpoint}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
            data: `objectId=${momentId}&objectType=10&userId=${userId}&acfun.midground.api_st=${encodeURIComponent(token)}&kpn=ACFUN_APP&kpf=PC_WEB&subBiz=mainApp&interactType=1`,
        });
        // 只认 result===0：否则接口报错的 JSON 也会被当成成功翻转 UI 红心
        return data && data.result === 0 ? data : null;
    },

    // 评论点赞/取消点赞（同源请求，直接 fetch 带 cookie；超时用 AbortSignal）
    async likeComment(sourceId, commentId, isCancel = false) {
        const endpoint = isCancel ? 'unlike' : 'like';
        try {
            const resp = await fetch(`${CONFIG.COMMENT_API_BASE}/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `sourceId=${sourceId}&sourceType=4&commentId=${commentId}`,
                credentials: 'include',
                signal: AbortSignal.timeout(CONFIG.REQUEST_TIMEOUT_MS),
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
            const resp = await fetch(`${CONFIG.COMMENT_API_BASE}/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body,
                credentials: 'include',
                signal: AbortSignal.timeout(CONFIG.REQUEST_TIMEOUT_MS),
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
        const data = await this._gmJson({
            method: 'POST',
            url: CONFIG.UPLOAD_TOKEN_API,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data: `fileName=${encodeURIComponent(file.name || 'image.png')}`,
        });
        const token = data && data.result === 0 && data.info ? data.info.token : null;
        if (!token) return null;

        const gateway = CONFIG.UPLOAD_GATEWAY;
        const total = file.size;
        const chunks = Math.max(1, Math.ceil(total / CONFIG.UPLOAD_CHUNK_SIZE));

        for (let i = 0; i < chunks; i++) {
            const start = i * CONFIG.UPLOAD_CHUNK_SIZE;
            const end = Math.min(start + CONFIG.UPLOAD_CHUNK_SIZE, total);
            const resp = await this._gmJson({
                method: 'POST',
                url: `${gateway}/api/upload/fragment?upload_token=${encodeURIComponent(token)}&fragment_id=${i}`,
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'Content-Range': `bytes ${start}-${end - 1}/${total}`,
                },
                data: file.slice(start, end),
            }, CONFIG.UPLOAD_TIMEOUT_MS);
            if (!resp || resp.result !== 1) { utils.log('图片分片上传失败: 分片', i); return null; }
        }

        const done = await this._gmJson({
            method: 'POST',
            url: `${gateway}/api/upload/complete?upload_token=${encodeURIComponent(token)}&fragment_count=${chunks}`,
        }, CONFIG.UPLOAD_TIMEOUT_MS);
        if (!done || done.result !== 1) { utils.log('图片上传 complete 失败'); return null; }

        const final = await this._gmJson({
            method: 'POST',
            url: CONFIG.UPLOAD_FINISH_API,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data: `token=${encodeURIComponent(token)}&bizFlag=web-comment-text`,
        });
        return final && final.result === 0 && final.url ? final.url.split('?')[0] : null;
    },

    // 投蕉给动态作者（保留完整响应体：调用方需读 error_msg 提示禁止投蕉等）
    throwBanana(momentId) {
        return this._gmJson({
            method: 'POST',
            url: CONFIG.BANANA_API,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': `https://www.acfun.cn/moment/am${momentId}` },
            data: `resourceId=${momentId}&count=1&resourceType=10`,
        });
    },

    // 拉取动态广场列表（APP 端接口，免登录，服务端已过滤粉丝可见，每页固定 20 条，不含转发）
    // cursor 为空拉最新一页，否则按 pcursor 续翻更旧的一页；翻到底时 pcursor 返回 "no_more"
    // 返回 { records: [{ amId, absTs, data, fetchedAt }], nextCursor, noMore }，请求失败返回 null
    fetchFeedSquare(cursor = '') {
        const qs = cursor ? `?pcursor=${encodeURIComponent(cursor)}` : '';
        return this._gmJson({
            method: 'GET',
            url: `${CONFIG.FEED_SQUARE_API}${qs}`,
            headers: { 'Accept': 'application/json' },
        }).then((data) => {
            if (!data || data.result !== 0 || !Array.isArray(data.feedList)) return null;
            const now = Date.now();
            const records = data.feedList
                .filter(f => f.moment && f.moment.momentId && f.createTime)
                .map(f => this._squareFeedToRecord(f, now));
            const nextCursor = String(data.pcursor || '');
            return { records, nextCursor, noMore: nextCursor === 'no_more' };
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
