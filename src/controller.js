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

    // 刷新广场（点击刷新时调用）：重拉最新一页
    async refreshPlaza() {
        background._stopUpwardPoll();
        background._cancelRunningSearch();

        const statusEl = document.getElementById('fetch-status');
        const updateStatus = (t) => { if (statusEl) statusEl.textContent = t; };
        const upStatus = document.getElementById('up-status');
        if (upStatus) upStatus.textContent = '';
        updateStatus('正在刷新...');

        state._downLoading = false;
        state._noMoreDown = false;

        await this._loadFirstPage();

        background._startUpwardPoll();
        background.cleanupExpired();
    },

    async showPlazaView() {
        const mainContent = document.querySelector(SEL_MAIN_FEEDS);
        if (!mainContent) return;

        renderer.getInteractiveHtml();

        state.moments = [];
        state._downCursor = '';
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

        await this._loadFirstPage();

        background._startUpwardPoll();
        background.cleanupExpired();
    },

    // ========== 数据流核心 ==========
    // 拉广场最新一页 → 渲染 → 状态文案 → 后台注入新鲜互动数字（refreshPlaza / showPlazaView 共用）
    async _loadFirstPage() {
        const page = await api.fetchFeedSquare();
        if (!page) {
            const statusEl = document.getElementById('fetch-status');
            if (statusEl) statusEl.textContent = '加载失败，点击重试';
            return;
        }

        state.moments = page.records;
        state._downCursor = page.nextCursor;
        if (page.noMore) state._noMoreDown = true;
        this._markNoMoreIfPastWindow(page.records);

        // 已展示到的最大号即轮询 diff 基准，避免把用户刚刷新看过的动态误报为新发现
        const maxAmId = page.records.length ? Math.max(...page.records.map(r => r.amId)) : 0;
        if (maxAmId > state.latestAmId) state.latestAmId = maxAmId;
        utils.setLastDiscoveryAt(Date.now());

        this._renderList();
        const statusEl = document.getElementById('fetch-status');
        if (statusEl) statusEl.textContent = `共 ${state.moments.length} 条动态，向下滚动加载更多`;

        await db.putMoments(page.records).catch(() => {});
        await this._refreshRecords(page.records);
    },

    // 本批最旧一条已超过展示时间下限 → 标记无更多
    _markNoMoreIfPastWindow(records) {
        if (!records.length) return;
        const oldestAbs = Math.min(...records.map(r => r.absTs));
        if (oldestAbs && (Date.now() - oldestAbs) > CONFIG.DOWN_STOP_AFTER_MS) {
            state._noMoreDown = true;
        }
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

        await Promise.all(allIds.map(amId =>
            this._refreshOneMoment(amId, { repair: repairIds.has(amId) })
        ));
    },

    // 单条动态补抓：更新数据 → 刷新互动数字 → 可选重渲染卡片（修复转发源）
    async _refreshOneMoment(amId, opts = {}) {
        const data = await api.fetchMoment(amId);
        if (!data || data.result !== 0 || !data.moment) return;
        const moment = data.moment;

        const record = state.moments.find(m => m.amId == amId);
        const absTs = record?.absTs || utils.computeAbsTs(moment.createTime, Date.now());
        await db.putMoment({ amId, absTs, data: moment, fetchedAt: Date.now() });
        if (record) record.data = moment;

        const card = document.querySelector(`.moment-plaza-item[data-am-id="${amId}"]`);
        if (!card) return;

        if (opts.repair) {
            const pending = !!absTs && (Date.now() - absTs) <= CONFIG.FRESH_WINDOW_MS;
            const holder = document.createElement('div');
            holder.innerHTML = renderer.renderCard(record || { amId, absTs, data: moment }, { pending });
            const fresh = holder.firstElementChild;
            if (fresh) card.replaceWith(fresh);
        } else {
            const interactiveEl = card.querySelector('.member-feed-interactive');
            if (interactiveEl) {
                interactiveEl.innerHTML = renderer.fillInteractive(moment, { pending: false });
                const commentContainer = document.getElementById(`comments-${amId}`);
                if (commentContainer && commentContainer.style.display !== 'none') {
                    const btn = interactiveEl.querySelector('.feed-interactive-comment');
                    if (btn) btn.classList.add('active');
                }
            }
        }
    },

    _renderList() {
        const listEl = document.getElementById('moment-list');
        if (listEl) listEl.innerHTML = renderer.renderList(state.moments);
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

    // 触底向下加载：pcursor 续翻更旧的一页（每页固定 20 条），>24h 或翻到底即止
    async _fetchNextBatch() {
        if (state._downLoading || state._noMoreDown) return;
        if (!document.getElementById('moment-list')) return;

        state._downLoading = true;
        const loadMoreEl = document.getElementById('load-more-status');
        if (loadMoreEl) {
            loadMoreEl.className = 'plaza-load-more loading';
            loadMoreEl.textContent = '加载中...';
        }

        try {
            const page = await api.fetchFeedSquare(state._downCursor);
            if (!page) {
                // 不置 noMoreDown，下次触底自动重试
                if (loadMoreEl) {
                    loadMoreEl.className = 'plaza-load-more';
                    loadMoreEl.textContent = '加载失败，滚动重试';
                }
                return;
            }

            state._downCursor = page.nextCursor;
            if (page.noMore) state._noMoreDown = true;

            const existing = new Set(state.moments.map(m => m.amId));
            const inWindow = page.records.filter(r => {
                if (existing.has(r.amId)) return false;
                if ((Date.now() - r.absTs) > CONFIG.DOWN_STOP_AFTER_MS) {
                    state._noMoreDown = true;
                    return false;
                }
                return true;
            });

            if (!inWindow.length) {
                state._noMoreDown = true;
                if (loadMoreEl) {
                    loadMoreEl.className = 'plaza-load-more';
                    loadMoreEl.textContent = '已加载全部动态';
                }
            } else {
                state.moments.push(...inWindow);
                this._renderList();
                await db.putMoments(inWindow).catch(() => {});
                await this._refreshRecords(inWindow);

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
