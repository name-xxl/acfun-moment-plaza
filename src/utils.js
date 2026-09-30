// 通用小工具（日志 / HTML 转义）。内容解析在 parser.js，时间与数字格式化在 format.js，
// GM 存取在 storage.js
export const utils = {
    log(...args) {
        console.log('%c[MomentPlaza]', 'color:#ff4b76;font-weight:bold', ...args);
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    // 统一属性值转义（HTML 标签内用）
    attrEscape(value) {
        return this.escapeHtml(String(value));
    },
};
