import { CONFIG, SEL_MAIN_FEEDS, AUTO_ENTER_KEY } from './config.js';
import { state } from './state.js';
import { utils } from './utils.js';
import { db } from './db.js';
import { api } from './api.js';
import { renderer } from './renderer.js';
import { background } from './background.js';

export const controller = {
    // 进入/刷新动态广场
    enterPlaza() {
        const mainContent = document.querySelector(SEL_MAIN_FEEDS);

        if (!mainContent) {
            GM_setValue(AUTO_ENTER_KEY, true);
            window.location.href = '/member/feeds';
            return;
        }

        document.querySelector('a[href="/member/feeds"]')?.classList.remove('ac-member-navigation-item-active');
        document.querySelector('.plaza-nav-item')?.classList.add('ac-member-navigation-item-active');

        const isPlazaOpen = mainContent.querySelector('.moment-plaza-container');

        if (isPlazaOpen) {
            this.refreshPlaza();
        } else {
            this.showPlazaView();
        }
    },

    // 刷新广场（点击刷新时调用）：预渲染 DB 最新 20 条
    async refreshPlaza() {
        background._stopUpwardPoll();

        const statusEl = document.getElementById('fetch-status');
        const updateStatus = (t) => { if (statusEl) statusEl.textContent = t; };
        const upStatus = document.getElementById('up-status');
        if (upStatus) upStatus.textContent = '';
        updateStatus('正在刷新...');

        state._downLoading = false;
        state._noMoreDown = false;

        await this._loadAndRender(state.latestAmId + 1);

        background._startUpwardPoll();
        background.cleanupExpired();
    },

    async showPlazaView() {
        const mainContent = document.querySelector(SEL_MAIN_FEEDS);
        if (!mainContent) return;

        renderer.getInteractiveHtml();

        // 没有 am 号 → 首次设置框
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

        if (!document.querySelector('.plaza-back-top')) {
            const backTop = document.createElement('div');
            backTop.className = 'plaza-back-top';
            backTop.innerHTML = '↑';
            backTop.title = '回到顶部';
            backTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
            document.body.appendChild(backTop);
        }
        this._setupScrollListener();
        this._bindKeepDaysSelect();

        const statusEl = document.getElementById('fetch-status');
        if (statusEl) statusEl.textContent = '正在加载...';

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
            state.oldestAmId = Math.min(...records.map(r => r.amId));
            const oldestAbs = records[records.length - 1]?.absTs;
            if (records.length < CONFIG.BATCH_SIZE || (oldestAbs && (Date.now() - oldestAbs) > CONFIG.DOWN_STOP_AFTER_MS)) {
                state._noMoreDown = true;
            }
        }
        this._renderList();

        const statusEl = document.getElementById('fetch-status');
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
            direction: 'down',
            skipFansOnly: true,
            stopMs: CONFIG.DOWN_STOP_AFTER_MS
        });
        return background._storeMoments(moments);
    },

    // 对需要修复/注入的记录统一补抓一次，避免同一 amId 重复 fetchMoment
    async _refreshRecords(records) {
        if (!records || !records.length) return;
        const now = Date.now();
        const repairIds = new Set();
        const freshIds = new Set();
        for (const r of records) {
            if (r.data?.originResourceType && !r.data.repostSource) repairIds.add(r.amId);
            if (r.absTs && (now - r.absTs) <= CONFIG.FRESH_WINDOW_MS) freshIds.add(r.amId);
        }
        const allIds = [...new Set([...repairIds, ...freshIds])];
        if (!allIds.length) return;

        await Promise.all(allIds.map(async (amId) => {
            const data = await api.fetchMoment(amId);
            if (!data || data.result !== 0 || !data.moment) return;
            const moment = data.moment;

            const record = state.moments.find(m => m.amId == amId);
            const absTs = record?.absTs || utils.computeAbsTs(moment.createTime, now);
            await db.putMoment({ amId, absTs, data: moment, fetchedAt: now });
            if (record) record.data = moment;

            // 修复转发卡片
            if (repairIds.has(amId)) {
                const card = document.querySelector(`.moment-plaza-item[data-am-id="${amId}"]`);
                if (card) {
                    const pending = !!absTs && (now - absTs) <= CONFIG.FRESH_WINDOW_MS;
                    const holder = document.createElement('div');
                    holder.innerHTML = renderer.renderCard(record || { amId, absTs, data: moment }, { pending });
                    const fresh = holder.firstElementChild;
                    if (fresh) card.replaceWith(fresh);
                }
            }

            // 注入最新互动数字
            if (freshIds.has(amId)) {
                const card = document.querySelector(`.moment-plaza-item[data-am-id="${amId}"]`);
                const interactiveEl = card?.querySelector('.member-feed-interactive');
                if (interactiveEl) {
                    interactiveEl.innerHTML = renderer.fillInteractive(moment, { pending: false });
                    const commentContainer = document.getElementById(`comments-${amId}`);
                    if (commentContainer && commentContainer.style.display !== 'none') {
                        const btn = interactiveEl.querySelector('.feed-interactive-comment');
                        if (btn) btn.classList.add('active');
                    }
                }
            }
        }));
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
            background.cleanupExpired();
        });
    },

    _setupScrollListener() {
        if (state._scrollHandler) {
            window.removeEventListener('scroll', state._scrollHandler);
        }

        state._scrollHandler = () => {
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            const windowHeight = window.innerHeight;
            const docHeight = document.documentElement.scrollHeight;

            const backTop = document.querySelector('.plaza-back-top');
            if (backTop) {
                backTop.classList.toggle('visible', scrollTop > CONFIG.BACK_TOP_THRESHOLD);
            }

            const nearBottom = scrollTop + windowHeight >= docHeight - CONFIG.SCROLL_BOTTOM_OFFSET;
            if (!state._downLoading && !state._noMoreDown && nearBottom) {
                this._fetchNextBatch();
            }
        };

        window.addEventListener('scroll', state._scrollHandler, { passive: true });
    },

    // 触底向下加载：固定 20 条，库充足直接预渲染，不足实时抓取
    async _fetchNextBatch() {
        if (state._downLoading || state._noMoreDown) return;
        if (!document.getElementById('moment-list')) return;

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
                await this._refreshRecords(newRecords);

                if (loadMoreEl) {
                    loadMoreEl.className = 'plaza-load-more';
                    loadMoreEl.textContent = state._noMoreDown ? '已加载全部动态' : '';
                }
            }
        } finally {
            state._downLoading = false;
        }
    }
};
