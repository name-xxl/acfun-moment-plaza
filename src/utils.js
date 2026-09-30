// 通用小工具（日志 / HTML 转义）。内容解析在 parser.js，时间与数字格式化在 format.js，
// GM 存取在 storage.js
export const utils = {
    log(...args) {
        console.log('%c[MomentPlaza]', 'color:#ff4b76;font-weight:bold', ...args);
    },

    escapeHtml(text) {
        if (!text) return '';
        // & 必须最先替换；输出与「textContent 赋值 + 引号补转义」的 DOM 法等价，但不依赖 document（node 测试可用）
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    // 统一属性值转义（HTML 标签内用）
    attrEscape(value) {
        return this.escapeHtml(String(value));
    },
};
