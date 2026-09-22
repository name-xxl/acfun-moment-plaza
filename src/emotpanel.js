import { state } from './state.js';
import { api } from './api.js';
import { utils } from './utils.js';

const RECENT_KEY = 'plaza_emot_recent_v1';
const RECENT_LIMIT = 12;
// 悬停预览浮层的固定尺寸（与 css.js 中 .plaza-emot-preview 保持一致）
const PREVIEW_W = 140;
const PREVIEW_H = 156;

function readRecent() {
    try {
        const ids = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
        if (Array.isArray(ids)) return ids.map(String).filter(Boolean).slice(0, RECENT_LIMIT);
    } catch (e) {}
    return [];
}

function rememberRecent(id) {
    const ids = readRecent().filter((x) => x !== String(id));
    ids.unshift(String(id));
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, RECENT_LIMIT))); } catch (e) {}
}

function attrUrl(url) {
    return String(url || '').replace(/"/g, '%22');
}

function itemHtml(item) {
    return `<img class="plaza-emot-item" data-code="${item.id}" data-url="${attrUrl(item.url)}" data-big="${attrUrl(item.big || item.url)}" data-name="${utils.escapeHtml(item.name || '')}" src="${attrUrl(item.url)}" alt="" loading="lazy">`;
}

// 视图模型：最近使用（若有）作为切换条首个虚拟包，其后是真实表情包
function viewPacks() {
    const map = state.emoticonMap || {};
    const recent = readRecent().map((id) => map[id] && { ...map[id], id }).filter(Boolean);
    const packs = [];
    if (recent.length) packs.push({ name: '最近使用', items: recent, virtual: true });
    for (const p of (state.emoticonPacks || [])) packs.push({ name: p.name, items: p.items });
    return packs;
}

// 选中包按包名记忆（存 dataset），避免「最近使用」虚拟包插入导致索引漂移
function activePack(panel) {
    const packs = viewPacks();
    return packs.find((p) => p.name === panel.dataset.emotPack) || packs[0];
}

// 面板骨架（对齐原生）：头部包名 / 6 列网格 / 底部灰底包切换条（‹› 按需显隐）
function buildPanel(panel) {
    panel.innerHTML = `
        <div class="plaza-emot-head"><span class="plaza-emot-pack-name"></span></div>
        <div class="plaza-emot-grid"></div>
        <div class="plaza-emot-foot">
            <button type="button" class="plaza-emot-foot-page" data-dir="-1" title="上一个表情包">‹</button>
            <div class="plaza-emot-strip"></div>
            <button type="button" class="plaza-emot-foot-page" data-dir="1" title="更多表情包">›</button>
        </div>
    `;
    // 翻页箭头显隐跟随滚动位置
    const strip = panel.querySelector('.plaza-emot-strip');
    strip.addEventListener('scroll', () => updateStripArrows(panel), { passive: true });
}

// 根据切换条滚动位置显隐 ‹›（visibility 保占位，避免跳动）
function updateStripArrows(panel) {
    const strip = panel.querySelector('.plaza-emot-strip');
    if (!strip) return;
    const prev = panel.querySelector('.plaza-emot-foot-page[data-dir="-1"]');
    const next = panel.querySelector('.plaza-emot-foot-page[data-dir="1"]');
    if (prev) prev.style.visibility = strip.scrollLeft > 4 ? 'visible' : 'hidden';
    if (next) next.style.visibility = strip.scrollWidth - strip.scrollLeft - strip.clientWidth > 4 ? 'visible' : 'hidden';
}

function renderHead(panel) {
    const el = panel.querySelector('.plaza-emot-pack-name');
    if (el) el.textContent = (activePack(panel) || {}).name || '';
}

function renderGrid(panel) {
    const pkg = activePack(panel);
    const gridEl = panel.querySelector('.plaza-emot-grid');
    if (!gridEl || !pkg) return;
    gridEl.innerHTML = pkg.items.map((it) => itemHtml(it)).join('');
    gridEl.scrollTop = 0;
}

function renderStrip(panel) {
    const strip = panel.querySelector('.plaza-emot-strip');
    if (!strip) return;
    // viewPacks() 每次返回新对象，高亮按包名比较而非引用
    const activeName = (activePack(panel) || {}).name;
    strip.innerHTML = viewPacks().map((p) =>
        `<button type="button" class="plaza-emot-pack-thumb${p.name === activeName ? ' active' : ''}" data-name="${utils.escapeHtml(p.name)}" title="${utils.escapeHtml(p.name)}">` +
        `<img src="${attrUrl(p.items[0] && p.items[0].url)}" alt="" loading="lazy"></button>`
    ).join('');
    strip.scrollLeft = 0;
    updateStripArrows(panel);
}

function renderAll(panel) {
    renderHead(panel);
    renderGrid(panel);
    renderStrip(panel);
}

let _previewEl = null;

function previewEl() {
    if (!_previewEl || !_previewEl.parentNode) {
        _previewEl = document.createElement('div');
        _previewEl.className = 'plaza-emot-preview';
        _previewEl.innerHTML = '<img alt=""><span></span>';
        document.body.appendChild(_previewEl);
    }
    return _previewEl;
}

export const emotpanel = {
    // 首次打开时构建面板；数据由 main.js 预取，这里兜底再拉一次
    async ensure(panel) {
        if (panel.dataset.loaded) return;
        panel.innerHTML = '<div class="plaza-emot-empty">表情加载中…</div>';
        const ok = await api.fetchEmoticonPacks();
        if (!(state.emoticonPacks || []).length) {
            panel.innerHTML = '<div class="plaza-emot-empty">表情加载失败（可能未登录）</div>';
            // 拉到了但为空不再重试；网络失败则下次打开重试
            if (ok) panel.dataset.loaded = '1';
            return;
        }
        buildPanel(panel);
        panel.dataset.loaded = '1';
        renderAll(panel);
    },

    selectPack(panel, name) {
        if (!viewPacks().some((p) => p.name === name)) return;
        panel.dataset.emotPack = name;
        renderAll(panel);
    },

    // 底部条 ‹/›：按 dir 翻一屏，方向由按钮提供，无内容侧的箭头已隐藏
    scrollStrip(panel, dir) {
        const strip = panel.querySelector('.plaza-emot-strip');
        if (!strip) return;
        strip.scrollBy({ left: (dir < 0 ? -1 : 1) * 200, behavior: 'smooth' });
    },

    // 选中表情：记录最近使用，并同步所有已构建面板（仅正在看「最近使用」的刷新网格，其余只刷切换条，不打断滚动位置）
    pick(code) {
        if (!code) return;
        rememberRecent(code);
        this.refreshRecent();
    },

    refreshRecent() {
        document.querySelectorAll('.plaza-emot-panel[data-loaded]').forEach((p) => {
            renderStrip(p);
            const active = activePack(p);
            if (active && active.virtual) {
                renderHead(p);
                renderGrid(p);
            }
        });
    },

    showPreview(item) {
        const el = previewEl();
        el.querySelector('img').src = item.dataset.big || item.dataset.url || '';
        el.querySelector('span').textContent = item.dataset.name || item.dataset.code || '';
        el.classList.add('show');
        // 优先浮在目标上方，上方空间不足放下方，左右夹在视口内
        const rect = item.getBoundingClientRect();
        const left = Math.min(Math.max(8, rect.left + rect.width / 2 - PREVIEW_W / 2), window.innerWidth - PREVIEW_W - 8);
        const top = rect.top >= PREVIEW_H + 12
            ? rect.top - PREVIEW_H - 8
            : Math.min(window.innerHeight - PREVIEW_H - 8, rect.bottom + 8);
        el.style.left = left + 'px';
        el.style.top = Math.max(8, top) + 'px';
    },

    hidePreview() {
        if (_previewEl) _previewEl.classList.remove('show');
    }
};
