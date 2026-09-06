import { CONFIG, LAST_AM_KEY, KEEP_DAYS_KEY } from './config.js';
import { state } from './state.js';

export const utils = {
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

    // 相对时间/绝对时间 → 距今毫秒数（"40分钟前" → 40*60000；标准时间 → now - ts）
    parseAgeMs(text) {
        if (!text) return 0;
        const str = String(text);
        // 优先按绝对时间解析（API 某些场景返回标准时间）
        const absTs = Date.parse(str);
        if (!isNaN(absTs)) {
            return Math.max(0, Date.now() - absTs);
        }
        const m = str.match(/(\d+)\s*(秒|分钟|小时|天)/);
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
        const offset = this.parseAgeMs(createTime);
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
        return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
        if (!text) return '';
        let html = utils.escapeHtml(text);
        // 先处理字面量 [表情]，避免后续替换输出被二次包裹
        html = html.replace(/\[表情\]/g, '<span style="color:#999;font-size:12px;">[表情]</span>');
        html = html.replace(/\[emot=acfun,(\d+)\/?\]/g, (_, id) => {
            const emo = state.emoticonMap && state.emoticonMap[id];
            return emo
                ? `<img class="ubb-emotion" data-pkgname="${emo.pkg.replace(/"/g, '%22')}" src="${emo.url.replace(/"/g, '%22')}">`
                : '<span style="color:#999;font-size:12px;">[表情]</span>';
        });
        // 非 acfun 主包的老表情走 umeditor 静态路径（与原生 fallback 一致）
        html = html.replace(/\[emot=(?!acfun,)(\w+),(\d+)\/?\]/g, '<img class="ubb-emotion" src="//cdn.aixifan.com/dotnet/20130418/umeditor/dialogs/emotion/images/$1/$2.gif">');
        // UBB 图片要在链接规则之前处理，避免 URL 里的字符被当作 ac 号/话题改写
        // 兼容 [img=图片] 和无属性 [img] 两种写法
        html = html.replace(/\[img(?:=[^\]]*)?\](https?:\/\/[^[\s]+?)\[\/img\]/gi, (_, url) => {
            return `<img class="plaza-ubb-img" src="${url.replace(/"/g, '%22')}">`;
        });
        // 链接类规则：先把已有 HTML 标签保护起来，避免在 href/src 等属性里二次匹配
        html = utils._withProtectedTags(html, (protectedHtml) => {
            let h = protectedHtml;
            h = h.replace(/\[at uid=(\d+)\]@?(.*?)\[\/at\]/g, (_, uid, name) => {
                return `<a class="plaza-at-link" href="//www.acfun.cn/u/${uid}" target="_blank">@${utils.escapeHtml(name)}</a>`;
            });
            h = h.replace(/#([^#\s]{1,30}?)#/g, (_, topic) => {
                return `<a class="plaza-topic-link" href="//www.acfun.cn/search?keyword=${encodeURIComponent(topic)}" target="_blank">#${topic}#</a>`;
            });
            // 合并 ac 号与 v/ac号/a/ac号，避免两条规则在 href 里嵌套
            h = h.replace(/\b(?:([va])\/)?(ac\d{4,})\b/gi, (_, prefix, id) => {
                const type = (prefix || 'a').toLowerCase();
                const display = prefix ? `${prefix}/${id}` : id;
                return `<a class="plaza-ac-link" href="//www.acfun.cn/${type}/${id}" target="_blank">${display}</a>`;
            });
            h = h.replace(/m\.acfun\.cn\/communityCircle\/moment\/(\d+)/g, (_, id) => {
                return `<a class="plaza-ac-link" href="//www.acfun.cn/moment/am${id}" target="_blank">am${id}</a>`;
            });
            return h;
        });
        html = html.replace(/\r?\n/g, '<br>');
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
