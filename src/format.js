// 展示格式化：时间与数字的纯函数集合（无外部依赖）
export const format = {
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
};
