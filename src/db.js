const DB_NAME = 'moment-plaza';
const DB_VERSION = 1;
const STORE_MOMENTS = 'moments';

let _dbPromise = null;

export const db = {
    open() {
        if (_dbPromise) return _dbPromise;
        _dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const d = e.target.result;
                if (!d.objectStoreNames.contains(STORE_MOMENTS)) {
                    const store = d.createObjectStore(STORE_MOMENTS, { keyPath: 'amId' });
                    store.createIndex('by_absTs', 'absTs');
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => { _dbPromise = null; reject(req.error); };
        });
        return _dbPromise;
    },

    async putMoment(record) {
        const d = await this.open();
        return new Promise((resolve, reject) => {
            const tx = d.transaction(STORE_MOMENTS, 'readwrite');
            tx.objectStore(STORE_MOMENTS).put(record);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    async putMoments(records) {
        if (!records || !records.length) return;
        const d = await this.open();
        return new Promise((resolve, reject) => {
            const tx = d.transaction(STORE_MOMENTS, 'readwrite');
            const store = tx.objectStore(STORE_MOMENTS);
            records.forEach(r => store.put(r));
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    // 取 amId < fromId 的 count 条（按 amId 降序，即较新的在前）
    // 旧版本存下的「粉丝可见」遗留记录不进入展示流（会随保留天数自动清除）
    async getOlderThan(fromId, count) {
        const d = await this.open();
        return new Promise((resolve, reject) => {
            const store = d.transaction(STORE_MOMENTS, 'readonly').objectStore(STORE_MOMENTS);
            const range = IDBKeyRange.upperBound(fromId, true);
            const result = [];
            const req = store.openCursor(range, 'prev');
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (!cursor) {
                    resolve(result);
                    return;
                }
                if (!(cursor.value.data && cursor.value.data.visibleForFans)) {
                    result.push(cursor.value);
                }
                if (result.length < count) {
                    cursor.continue();
                } else {
                    resolve(result);
                }
            };
            req.onerror = () => reject(req.error);
        });
    },

    // 删除 absTs < cutoffTs 的过期记录
    async deleteOlderThan(cutoffTs) {
        const d = await this.open();
        return new Promise((resolve, reject) => {
            const store = d.transaction(STORE_MOMENTS, 'readwrite').objectStore(STORE_MOMENTS);
            const index = store.index('by_absTs');
            const range = IDBKeyRange.upperBound(cutoffTs);
            const req = index.openCursor(range);
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) { cursor.delete(); cursor.continue(); }
                else resolve();
            };
            req.onerror = () => reject(req.error);
        });
    }
};
