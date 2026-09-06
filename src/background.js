import { CONFIG } from './config.js';
import { state } from './state.js';
import { utils } from './utils.js';
import { db } from './db.js';
import { api } from './api.js';

export const background = {
    // 启动：有 am 号就开启向上后台定时爬取 + 过期清理
    start() {
        const knownAmId = utils.getLastAmId();
        if (!knownAmId || knownAmId <= 0) return;

        state.latestAmId = knownAmId;
        this._startUpwardPoll();
        this.cleanupExpired();
    },

    // ========== 向上爬取（后台定时，空手退避 + 跨空号断层） ==========
    _startUpwardPoll() {
        if (state._upPollTimer) return;
        this._upPollTick();
        state._upPollTimer = setInterval(() => this._upPollTick(), CONFIG.UP_POLL_INTERVAL);
    },

    _stopUpwardPoll() {
        if (state._upPollTimer) {
            clearInterval(state._upPollTimer);
            state._upPollTimer = null;
        }
    },

    _upPollTick() {
        if (state._upRunning) return;
        if (Date.now() < state._upNextAt) return;
        this._runUpwardSearch();
    },

    async _runUpwardSearch() {
        if (state._upRunning) return;
        state._upRunning = true;

        const upStatus = document.getElementById('up-status');
        const updateUp = (t) => { if (upStatus) upStatus.textContent = t; };
        updateUp('↑查找新动态...');

        try {
            // am 号不连续：连续空号（断层）会截断单次爬取。从「已探测边界」继续探，
            // 断层分多次爬取逐步跨过，跨过后不再重复探测（会话内记忆，页面刷新后重探一次）
            const fromId = Math.max(state.latestAmId, state._upProbedTo);
            const { moments: newMoments, probedTo } = await api.crawlMoments(fromId, CONFIG.UP_CRAWL_TARGET, {
                direction: 'up',
                skipFansOnly: true,
                stopMs: CONFIG.UP_STOP_AT_MS
            });
            if (probedTo > state._upProbedTo) state._upProbedTo = probedTo;

            if (newMoments.length) {
                const records = await this._storeMoments(newMoments);
                const maxAm = Math.max(...records.map(r => r.amId));
                if (maxAm > state.latestAmId) {
                    state.latestAmId = maxAm;
                    utils.setLastAmId(maxAm);
                }
                updateUp(`↑发现 ${records.length} 条新动态，点击刷新`);
                state._upBackoffMs = 0;
                state._upNextAt = 0;
            } else {
                updateUp('');
                // 空手而归 → 下次间隔翻倍（封顶），减少夜间空探测；命中新动态即恢复正常节奏
                state._upBackoffMs = Math.min(
                    (state._upBackoffMs || CONFIG.UP_POLL_INTERVAL) * 2,
                    CONFIG.UP_POLL_BACKOFF_MAX_MS
                );
                state._upNextAt = Date.now() + state._upBackoffMs;
            }
        } finally {
            state._upRunning = false;
        }
    },

    async _storeMoments(moments) {
        const records = [];
        const now = Date.now();
        for (const m of moments) {
            const moment = m.moment || m;
            const amId = parseInt(m._amId || moment.momentId);
            if (!amId) continue;
            if (moment.visibleForFans) continue;
            const absTs = utils.computeAbsTs(moment.createTime, now);
            records.push({ amId, absTs, data: moment, fetchedAt: now });
        }
        if (records.length) {
            await db.putMoments(records);
        }
        return records;
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
