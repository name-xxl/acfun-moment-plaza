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

    // 快速定位最新动态：按「时间 → am 号」外推，而非盲跳固定步长
    // 用本地已有记录的号差/时间差测出增长速率，直接跳到「此刻」对应的 am 号附近；
    // 越过边界（整段空号）则在已知区间内收敛，命中旧数据则用新锚点修正速率继续外推
    async _fastForward(onStatus) {
        const startId = state.latestAmId;
        if (!startId || startId <= 0) return [];

        const { lo, best } = await this._locateFrontier(startId, onStatus);

        let moments;
        if (best) {
            // 已定位到边界 → 从边界向下收一批，保证列表里有足够多的新动态
            if (onStatus) onStatus(`快速定位... 从 am${lo} 抓取最新一批`);
            moments = (await api.crawlMoments(lo + 1, CONFIG.UP_CRAWL_TARGET, {
                direction: 'down',
                skipFansOnly: true
            })).moments;
            if (!moments.some(m => m._amId === best.amId)) {
                moments.push({ ...best.raw, _amId: best.amId });
            }
        } else {
            // 全程没探到任何动态 → 回退到逐号向上爬取
            if (onStatus) onStatus(`快速定位... 从 am${startId} 逐号查找`);
            moments = (await api.crawlMoments(startId, CONFIG.UP_CRAWL_TARGET, {
                direction: 'up',
                skipFansOnly: true,
                stopMs: CONFIG.UP_STOP_AT_MS
            })).moments;
        }
        await wait();

        if (!moments.length) return [];
        const records = await this._storeMoments(moments);
        const frontier = best ? lo : Math.max(...records.map(r => r.amId));
        if (frontier > state.latestAmId) {
            state.latestAmId = frontier;
            utils.setLastAmId(frontier);
        }
        utils.setLastDiscoveryAt(Date.now());
        utils.log(`快速定位: 边界 am${frontier}，入库 ${records.length} 条`);
        return records;
    },

    // 探测收敛出边界：返回 lo（已确认存在动态的最高 am 号）与 best（该处动态原始数据）
    async _locateFrontier(startId, onStatus) {
        let anchor = this._newestAnchor();       // 时间锚点 { id, ageMs }
        let rate = this._estimateIdRate();       // am 号 / 毫秒
        let lo = anchor ? Math.max(startId, anchor.id) : startId;
        let hi = 0;                              // 已确认越界（整段空号）的最低 am 号
        let step = CONFIG.FF_INITIAL_STEP;
        let best = null;

        for (let round = 0; round < CONFIG.FF_MAX_PROBES; round++) {
            if (hi && hi - lo <= CONFIG.FF_CONVERGE_GAP) break;

            let target;
            if (hi) {
                // 已有上界：外推落在区间内就用外推，否则二分
                target = rate > 0 && anchor ? Math.round(anchor.id + anchor.ageMs * rate) : 0;
                if (!(target > lo && target < hi)) target = Math.round((lo + hi) / 2);
            } else if (anchor && rate > 0) {
                target = Math.round(anchor.id + anchor.ageMs * rate);
                if (target <= lo) target = lo + step;
            } else {
                target = lo + step;
            }

            if (onStatus) onStatus(`快速定位... 探测 am${target}`);
            const hit = await this._probeWindow(target, this._probeSize(rate));
            await new Promise(r => setTimeout(r, CONFIG.CRAWL_BATCH_DELAY_MS));

            if (!hit) {
                // 采样宽度已按速率校准 → 整段空号即视为越界；无速率时先怀疑是空号断层，缩短步长重试
                if (rate > 0 || hi) {
                    hi = target;
                } else {
                    step = Math.round(step / 2);
                    if (step < CONFIG.FF_MIN_STEP) hi = target;
                }
                continue;
            }

            if (hit.amId > lo) lo = hit.amId;
            if (!best || hit.ageMs < best.ageMs) best = hit;
            if (hit.ageMs <= CONFIG.UP_STOP_AT_MS) break;

            // 用新旧两个锚点修正速率，越靠近现在越准
            if (anchor && hit.amId > anchor.id && anchor.ageMs > hit.ageMs) {
                rate = (hit.amId - anchor.id) / (anchor.ageMs - hit.ageMs);
            }
            anchor = { id: hit.amId, ageMs: hit.ageMs };
            if (rate <= 0) step *= CONFIG.FF_STEP_MULTIPLIER;
        }

        // 收敛阈值内可能还夹着几条 → 一次补扫 (lo, hi) 把边界定准
        if (best && hi && hi - lo > 1) {
            const rest = await this._probeWindow(lo + 1, Math.min(hi - lo - 1, CONFIG.FF_PROBE_MAX));
            if (rest && rest.amId > lo) {
                lo = rest.amId;
                if (rest.ageMs < best.ageMs) best = rest;
            }
        }

        return { lo, best };
    },

    // 采样一段连续 am 号，返回其中最新的公开动态；整段为空返回 null
    async _probeWindow(fromId, size) {
        const ids = [];
        for (let i = 0; i < size; i++) ids.push(fromId + i);
        const results = await Promise.all(ids.map(id => api.fetchMoment(id)));
        let best = null;
        for (let i = 0; i < results.length; i++) {
            const data = results[i];
            if (!data || data.result !== 0 || !data.moment) continue;
            if (data.moment.visibleForFans) continue;
            const ageMs = utils.parseAgeMs(data.moment.createTime);
            if (!best || ageMs < best.ageMs) best = { amId: ids[i], ageMs, raw: data };
        }
        return best;
    },

    // 采样宽度按速率换算成能覆盖 FF_PROBE_SPAN_MS 的 ID 数，速率未知时用最小宽度
    _probeSize(rate) {
        if (!(rate > 0)) return CONFIG.FF_PROBE_SIZE;
        const n = Math.ceil(rate * CONFIG.FF_PROBE_SPAN_MS);
        return Math.min(CONFIG.FF_PROBE_MAX, Math.max(CONFIG.FF_PROBE_SIZE, n));
    },

    // 本地最新动态作为时间锚点（am 号 → 距今毫秒）
    _newestAnchor() {
        for (const m of state.moments) {
            if (m.absTs) return { id: m.amId, ageMs: Math.max(1, Date.now() - m.absTs) };
        }
        return null;
    },

    // 由本地记录估算 am 号增长速率：最新与最旧两条的号差 ÷ 时间差
    _estimateIdRate() {
        const ms = state.moments;
        if (ms.length < 2) return 0;
        const newest = ms[0];
        const oldest = ms[ms.length - 1];
        const dId = newest.amId - oldest.amId;
        const dTs = newest.absTs - oldest.absTs;
        if (!(dId > 0) || !(dTs > 0)) return 0;
        return dId / dTs;
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
