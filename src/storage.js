import { CONFIG } from './config.js';

// GM 存储：键名与读写逻辑内聚（用户设置 + 跨会话游标）
const KEEP_DAYS_KEY = 'moment_plaza_keep_days';
const LAST_DISCOVERY_KEY = 'moment_plaza_last_discovery';

export const storage = {
    getKeepDays() {
        try {
            const d = GM_getValue(KEEP_DAYS_KEY, CONFIG.KEEP_DAYS_DEFAULT);
            return Math.min(7, Math.max(1, parseInt(d) || CONFIG.KEEP_DAYS_DEFAULT));
        } catch { return CONFIG.KEEP_DAYS_DEFAULT; }
    },

    setKeepDays(days) {
        try { GM_setValue(KEEP_DAYS_KEY, Math.min(7, Math.max(1, days || CONFIG.KEEP_DAYS_DEFAULT))); } catch (e) {}
    },

    getLastDiscoveryAt() {
        try { return parseInt(GM_getValue(LAST_DISCOVERY_KEY, 0)) || 0; } catch { return 0; }
    },

    setLastDiscoveryAt(ts) {
        try { GM_setValue(LAST_DISCOVERY_KEY, ts); } catch (e) {}
    }
};
