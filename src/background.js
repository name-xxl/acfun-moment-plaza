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

    _cancelRunningSearch() {
        state._upGeneration++;
        state._upRunning = false;
        state._upProbedTo = 0;
    },

    // 指数跳跃快速定位最新动态：从 last_am 起按指数步长跳跃探测
    // 每步采样 FF_PROBE_SIZE 个 ID 避免空号误判；找到 ≤1h 的动态即返回
    // 全部跳完仍未找到 → 从最后命中位置回退到普通逐号爬取
    async _fastForward(onStatus) {
        const startId = state.latestAmId;
        if (!startId || startId <= 0) return [];

        let step = CONFIG.FF_INITIAL_STEP;
        let lastFoundId = startId;
        let emptyProbes = 0;

        for (let probe = 0; probe < CONFIG.FF_MAX_PROBES; probe++) {
            const probeId = startId + step;
            if (onStatus) onStatus(`快速定位... 探测 am${probeId}`);

            const ids = [];
            for (let i = 0; i < CONFIG.FF_PROBE_SIZE; i++) ids.push(probeId + i);

            const results = await Promise.all(ids.map(id => api.fetchMoment(id)));
            let probeNewest = 0;
            let probeHasData = false;

            for (let i = 0; i < results.length; i++) {
                const data = results[i];
                if (!data || data.result !== 0 || !data.moment) continue;
                if (data.moment.visibleForFans) continue;
                probeHasData = true;
                const ageMs = utils.parseAgeMs(data.moment.createTime);
                if (ageMs <= CONFIG.UP_STOP_AT_MS) {
                    const records = await this._storeMoments([{ ...data, _amId: ids[i] }]);
                    if (records.length) {
                        const maxAm = Math.max(...records.map(r => r.amId));
                        if (maxAm > state.latestAmId) {
                            state.latestAmId = maxAm;
                            utils.setLastAmId(maxAm);
                        }
                        utils.setLastDiscoveryAt(Date.now());
                        utils.log(`快速定位成功: am${maxAm}`);
                        return records;
                    }
                }
                if (ageMs > probeNewest) probeNewest = ageMs;
            }

            if (probeHasData) {
                lastFoundId = probeId + CONFIG.FF_PROBE_SIZE - 1;
                emptyProbes = 0;
            } else {
                emptyProbes++;
                if (emptyProbes >= 3 && lastFoundId > startId) break;
            }

            step *= CONFIG.FF_STEP_MULTIPLIER;
            await new Promise(r => setTimeout(r, CONFIG.CRAWL_BATCH_DELAY_MS));
        }

        // 未找到新鲜动态 → 从最后命中位置回退到普通爬取
        const crawlFrom = lastFoundId > startId ? lastFoundId : startId;
        if (onStatus) onStatus(`快速定位... 从 am${crawlFrom} 逐号查找`);
        const { moments } = await api.crawlMoments(crawlFrom, CONFIG.UP_CRAWL_TARGET, {
            direction: 'up',
            skipFansOnly: true,
            stopMs: CONFIG.UP_STOP_AT_MS
        });

        if (!moments.length) return [];
        const records = await this._storeMoments(moments);
        const maxAm = Math.max(...records.map(r => r.amId));
        if (maxAm > state.latestAmId) {
            state.latestAmId = maxAm;
            utils.setLastAmId(maxAm);
        }
        utils.setLastDiscoveryAt(Date.now());
        return records;
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
        updateUp('↑查找新动态...');

        try {
            // am 号不连续：连续空号（断层）会截断单次爬取。从「已探测边界」继续探，
            // 断层分多次爬取逐步跨过。_upProbedTo 仅用于会话内避免重复探测同一段空号，
            // 不持久化：页面刷新后从 latestAmId 重新出发，避免跳过刷新期间填入空段的新动态。
            const fromId = Math.max(state.latestAmId, state._upProbedTo);
            const { moments: newMoments, probedTo } = await api.crawlMoments(fromId, CONFIG.UP_CRAWL_TARGET, {
                direction: 'up',
                skipFansOnly: true,
                stopMs: CONFIG.UP_STOP_AT_MS
            });

            // 搜索期间被 refresh 打断 → 丢弃结果，不写状态
            if (gen !== state._upGeneration) return;

            if (probedTo > state._upProbedTo) {
                state._upProbedTo = probedTo;
            }

            if (newMoments.length) {
                const records = await this._storeMoments(newMoments);
                const maxAm = Math.max(...records.map(r => r.amId));
                if (maxAm > state.latestAmId) {
                    state.latestAmId = maxAm;
                    utils.setLastAmId(maxAm);
                }
                updateUp(`↑发现 ${records.length} 条新动态，点击刷新`);
                const now = Date.now();
                utils.setLastDiscoveryAt(now);
                state._upBackoffMs = 0;
                state._upNextAt = 0;
            } else {
                updateUp('');
                const lastDisc = utils.getLastDiscoveryAt();
                const idleMs = lastDisc ? Date.now() - lastDisc : 0;
                state._upBackoffMs = this._computeBackoff(idleMs);
                state._upNextAt = Date.now() + state._upBackoffMs;
            }
        } finally {
            if (gen === state._upGeneration) {
                state._upRunning = false;
            }
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
