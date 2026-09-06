import { utils } from './utils.js';

export const EDITOR_CLASS = 'plaza-comment-editor';
export const EDITOR_INPUT_CLASS = 'plaza-editor-input';
export const EDITOR_EMOT_BTN_CLASS = 'plaza-editor-emot';
export const EDITOR_IMG_BTN_CLASS = 'plaza-editor-img';
export const EDITOR_FILE_CLASS = 'plaza-editor-file';
export const EDITOR_SEND_CLASS = 'plaza-editor-send';
export const EDITOR_PENDING_CLASS = 'plaza-editor-pending';
export const EDITOR_PANEL_CLASS = 'plaza-emot-panel';

export const editor = {
    renderEditor(amId, opts = {}) {
        const replyTo = opts.replyToCommentId || 0;
        const placeholder = opts.placeholder || '评论一时爽，一直评论一直爽。(˶‾᷄ ⁻̫ ‾᷅˵)';
        const buttonText = opts.buttonText || '发表';
        const replyAttr = replyTo ? ` data-reply-to="${replyTo}"` : '';
        return `
            <div class="${EDITOR_CLASS}" data-am-id="${amId}">
                <textarea class="${EDITOR_INPUT_CLASS}" placeholder="${utils.escapeHtml(placeholder)}" data-am-id="${amId}"${replyAttr}></textarea>
                <div class="${EDITOR_PENDING_CLASS}" style="display:none;">
                    <img class="plaza-editor-pending-img" alt="">
                    <span class="plaza-editor-pending-del" title="移除图片">×</span>
                </div>
                <div class="plaza-editor-actions">
                    <span class="plaza-editor-tool ${EDITOR_EMOT_BTN_CLASS}" title="表情"></span>
                    <span class="plaza-editor-tool ${EDITOR_IMG_BTN_CLASS}" title="插入图片"></span>
                    <input type="file" class="${EDITOR_FILE_CLASS}" accept="image/*" style="display:none;">
                    <button class="${EDITOR_SEND_CLASS}" data-am-id="${amId}"${replyAttr}>${utils.escapeHtml(buttonText)}</button>
                </div>
                <div class="${EDITOR_PANEL_CLASS}" style="display:none;"></div>
            </div>
        `;
    }
};
