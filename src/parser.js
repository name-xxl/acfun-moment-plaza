import { state } from './state.js';
import { utils } from './utils.js';

// ---------- UBB 内容解析（规则表：全仓库唯一出处） ----------
// 每种 UBB 格式在此登记一条，toHtml（富文本渲染）与 toText（纯文本剥离）同源派生，
// 新增格式只加一条登记，parseContent / plainText 两端同时生效。
//
// BLOCK_RULES：自闭合的块级标记（表情/图片），先行执行生成独立标签，
// 避免其 URL/参数被后续链接规则改写；
// INLINE_RULES：行内链接类，在标签保护块内按序执行（见 parseContent）。
const BLOCK_RULES = [
    {
        // 字面量 [表情]（API 直接给的明文，非 UBB），渲染为灰字占位
        pattern: /\[表情\]/g,
        toHtml: () => '<span style="color:#999;font-size:12px;">[表情]</span>',
    },
    {
        // AcFun 主表情包 [emot=acfun,ID/]，查表情映射表，无映射降级灰字占位
        pattern: /\[emot=acfun,(\d+)\/?\]/g,
        toHtml: (_, id) => {
            const emo = state.emoticonMap && state.emoticonMap[id];
            return emo
                ? `<img class="ubb-emotion" data-pkgname="${emo.pkg.replace(/"/g, '%22')}" src="${emo.url.replace(/"/g, '%22')}">`
                : '<span style="color:#999;font-size:12px;">[表情]</span>';
        },
        toText: () => '',
    },
    {
        // 非 acfun 主包的老表情走 umeditor 静态路径（与原生 fallback 一致）
        pattern: /\[emot=(\w+),(\d+)\/?\]/g,
        toHtml: '<img class="ubb-emotion" src="//cdn.aixifan.com/dotnet/20130418/umeditor/dialogs/emotion/images/$1/$2.gif">',
        toText: () => '',
    },
    {
        // UBB 图片，兼容 [img=图片] 与无属性 [img] 两种写法
        pattern: /\[img(?:=[^\]]*)?\](https?:\/\/[^[\s]+?)\[\/img\]/gi,
        toHtml: (_, url) => `<img class="plaza-ubb-img" src="${url.replace(/"/g, '%22')}">`,
        toText: () => '[图]',
    },
];

// 视频/文章链接的统一渲染，[ac=]（feedSquare 紧凑方言）与 [resource]（pc-direct 详情完整方言）共用
const stripTags = (s) => s.replace(/<[^>]+>/g, '');
const acTagLink = (typePath, id, text) =>
    `<a class="plaza-ac-link${typePath === 'v' ? ' plaza-ac-video' : ''}" href="//www.acfun.cn/${typePath}/ac${id}" target="_blank">${text}</a>`;

const INLINE_RULES = [
    {
        // @提及。toHtml 不再转义 name：parseContent 已对全文 escapeHtml 过，
        // 再转一次会把 & 变成 &amp;quot; 这类双重转义（toText 吃原始文本，不受影响）
        pattern: /\[at uid=(\d+)\]@?(.*?)\[\/at\]/g,
        toHtml: (_, uid, name) => `<a class="plaza-at-link" href="//www.acfun.cn/u/${uid}" target="_blank">@${name}</a>`,
        toText: (_, uid, name) => `@${name}`,
    },
    {
        // #话题#（纯文本下原样保留即可读）
        pattern: /#([^#\s]{1,30}?)#/g,
        toHtml: (_, topic) => `<a class="plaza-topic-link" href="//www.acfun.cn/search?keyword=${encodeURIComponent(topic)}" target="_blank">#${topic}#</a>`,
    },
    {
        // 裸 ac 号与 v/ac号/a/ac号（要求 ac 后紧跟数字，故不会吃进 [ac=...] 标签本身）
        pattern: /\b(?:([va])\/)?(ac\d{4,})\b/gi,
        toHtml: (_, prefix, id) => {
            const type = (prefix || 'a').toLowerCase();
            const display = prefix ? `${prefix}/${id}` : id;
            return `<a class="plaza-ac-link" href="//www.acfun.cn/${type}/${id}" target="_blank">${display}</a>`;
        },
    },
    {
        // 动态短链
        pattern: /m\.acfun\.cn\/communityCircle\/moment\/(\d+)/g,
        toHtml: (_, id) => `<a class="plaza-ac-link" href="//www.acfun.cn/moment/am${id}" target="_blank">am${id}</a>`,
    },
    {
        // [ac=48879687@video]文字[/ac] 视频/文章链接标签（feedSquare 方言）：@video→/v/，@article/无后缀→/a/。
        // 必须排在裸 ac 号之后：display 文本可能已被先行规则渲染成 <a>（display 恰为
        // ac 号的情形），剥掉标签后由本条统一生成链接，避免嵌套
        pattern: /\[ac=(\d+)(?:@(\w+))?\]([\s\S]*?)\[\/ac\]/gi,
        toHtml: (_, id, suffix, inner) => {
            const type = String(suffix || '').toLowerCase() === 'video' ? 'v' : 'a';
            return acTagLink(type, id, stripTags(inner));
        },
        toText: (_, id, suffix, inner) => inner,
    },
    {
        // [resource id=48879687 type=2 icon=...]标题[/resource] 视频/文章链接标签
        // （pc-direct 详情方言，同链换形：feedSquare 是上面的紧凑 [ac=] 形式）。
        // type 2=视频 3=文章（与转发 typeMap 一致），其余按文章处理。
        // 同样排在裸 ac 号之后剥先行标签；icon 属性区用 [^\]]* 吞并，即便其中
        // 恰好出现 ac 号被先行规则改写也不影响匹配（icon 反正不参与输出）
        pattern: /\[resource id=(\d+) type=(\d+)[^\]]*\]([\s\S]*?)\[\/resource\]/gi,
        toHtml: (_, id, type, inner) => acTagLink(String(type) === '2' ? 'v' : 'a', id, stripTags(inner)),
        toText: (_, id, type, inner) => inner,
    },
];

// 按登记顺序依次应用规则；text 模式下未登记 toText 的规则原样保留
const applyRules = (str, rules, mode) => rules.reduce(
    (s, r) => s.replace(r.pattern, mode === 'html' ? r.toHtml : (r.toText ?? (m => m))),
    str
);

export const parser = {
    // 把已有 HTML 标签替换成占位符，避免链接规则误伤属性里的关键词。
    // 安全前提：占位符形如 <!--...-->，本函数必须在 escapeHtml 之后调用——用户文本里的
    // "<" 已转义成 &lt;，伪造不出占位符形态，恢复替换不会错位
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

    // 富文本解析（动态正文/评论）：转义 → 块级规则 → 标签保护块内跑链接规则 → 换行
    parseContent(text) {
        if (!text) return '';
        let html = utils.escapeHtml(text);
        html = applyRules(html, BLOCK_RULES, 'html');
        html = this._withProtectedTags(html, h => applyRules(h, INLINE_RULES, 'html'));
        return html.replace(/\r?\n/g, '<br>');
    },

    // 纯文本剥离（转发卡片标题等单行展示）：吃原始文本、吐纯文本，调用方负责 escapeHtml
    plainText(text) {
        if (!text) return '';
        return applyRules(applyRules(text, BLOCK_RULES, 'text'), INLINE_RULES, 'text')
            .replace(/\s+/g, ' ')
            .trim();
    },

    // UBB 词汇表：脚本内生成 UBB（插表情/带图评论）统一走这里，与上方规则 pattern 同源
    emotUbb(pkg, code) {
        return `[emot=${pkg},${code}/]`;
    },

    imgUbb(url) {
        return `[img=图片]${url}[/img]`;
    },
};
