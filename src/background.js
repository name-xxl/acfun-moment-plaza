import { CONFIG } from './config.js';
import { state } from './state.js';
import { utils } from './utils.js';
import { db } from './db.js';
import { api } from './api.js';

export const background = {
    // 启动：后台定时拉最新动态（feedSquare 第一页）+ 过期清理
    start() {
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
        if (idleMs < 5 * 60 * 1000) return min;
        if (idleMs < 30 * 60 * 1000) return Math.min(min * 2, max);
        if (idleMs < 2 * 3600 * 1000) return Math.min(min * 4, max);
        if (idleMs < 6 * 3600 * 1000) return Math.min(min * 8, max);
        return max;
    },

    // ========== 向上轮询（拉最新一页，diff 出新动态，空手退避） ==========
    _startUpwardPoll() {
        if (state._upPollTimer) return;
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
            const el = document.getElementById('up-status');
            if (el) el.textContent = t;
        };

        const backoffAndSettle = () => {
            const lastDisc = utils.getLastDiscoveryAt();
            const idleMs = lastDisc ? Date.now() - lastDisc : 0;
            state._upBackoffMs = this._computeBackoff(idleMs);
            state._upNextAt = Date.now() + state._upBackoffMs;
        };

        try {
            const page = await api.fetchFeedSquare();
            // 拉取期间被 refresh 打断 → 丢弃结果，不写状态
            if (gen !== state._upGeneration) return;

            if (!page) {
                updateUp('');
                backoffAndSettle();
                return;
            }

            if (page.records.length) {
                await db.putMoments(page.records).catch(() => {});
            }

            const maxAmId = page.records.length ? Math.max(...page.records.map(r => r.amId)) : 0;
            if (!state.latestAmId) {
                // 会话内首次拉取：只建立 diff 基准，不算发现
                state.latestAmId = maxAmId;
                return;
            }

            const freshCount = page.records.filter(r => r.amId > state.latestAmId).length;
            if (freshCount) {
                state.latestAmId = maxAmId;
                utils.setLastDiscoveryAt(Date.now());
                state._upBackoffMs = 0;
                state._upNextAt = 0;
                updateUp(`↑发现 ${freshCount} 条新动态，点击刷新`);
            } else {
                updateUp('');
                backoffAndSettle();
            }
        } finally {
            if (gen === state._upGeneration) {
                state._upRunning = false;
            }
        }
    },

    // ========== 过期清理 ==========
    async cleanupExpired() {
        try {
            const keepDays = utils.getKeepDays();
            const cutoff = Date.now() - keepDays * 86400000;
            await db.deleteOlderThan(cutoff);
        } catch (e) {
            utils.log('清理过期数据失败:', e);
        }
    }
};
