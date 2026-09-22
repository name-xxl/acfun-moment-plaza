import { CONFIG } from './config.js';
import { state } from './state.js';
import { api } from './api.js';
import { renderer, COUNT_SUFFIX } from './renderer.js';
import { controller } from './controller.js';
import { emotpanel } from './emotpanel.js';

// 全局事件委托。广场 DOM 不存在时所有分支都会空跑返回，
// 因此在 /member 页初始化时绑定一次即可（等价于原先每次进入广场时绑定）。
export const events = {
    // 打开/收起表情面板；首次打开时由 emotpanel 构建内容
    async toggleEmotPanel(panel) {
        const willShow = !panel.classList.contains('open');
        this.closeEmotPanels();
        if (!willShow) return;

        panel.classList.add('open');
        await emotpanel.ensure(panel);
        emotpanel.refreshRecent();
    },

    closeEmotPanels() {
        document.querySelectorAll('.plaza-emot-panel').forEach((p) => p.classList.remove('open'));
        emotpanel.hidePreview();
    },

    // 在 textarea 光标处插入文本
    _insertAtCursor(input, text) {
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? start;
        input.value = input.value.slice(0, start) + text + input.value.slice(end);
        input.focus();
        input.selectionStart = input.selectionEnd = start + text.length;
    },

    bindAll() {
        document.addEventListener('click', async (e) => {
            // 点击面板/表情按钮以外区域时收起表情面板
            if (!e.target.closest('.plaza-emot-panel') && !e.target.closest('.plaza-editor-emot')) {
                this.closeEmotPanels();
            }

            if (!e.target.closest('.moment-plaza-container, .plaza-promotion')) return;

            // 表情按钮 → 开关面板
            const emotBtn = e.target.closest('.plaza-editor-emot');
            if (emotBtn) {
                const panel = emotBtn.closest('.plaza-comment-editor')?.querySelector('.plaza-emot-panel');
                if (panel) this.toggleEmotPanel(panel);
                return;
            }

            // 底部条包缩略图 → 切换表情包
            const packThumb = e.target.closest('.plaza-emot-pack-thumb');
            if (packThumb) {
                const panel = packThumb.closest('.plaza-emot-panel');
                if (panel) emotpanel.selectPack(panel, packThumb.dataset.name);
                return;
            }

            // 底部条 ‹/› → 按方向翻动包切换条
            const footPage = e.target.closest('.plaza-emot-foot-page');
            if (footPage) {
                const panel = footPage.closest('.plaza-emot-panel');
                if (panel) emotpanel.scrollStrip(panel, parseInt(footPage.dataset.dir, 10));
                return;
            }

            // 面板里的表情 → 光标处插入 [emot=acfun,ID/]，并记入最近使用
            const emotItem = e.target.closest('.plaza-emot-item');
            if (emotItem) {
                const input = emotItem.closest('.plaza-comment-editor')?.querySelector('.plaza-editor-input');
                if (input) this._insertAtCursor(input, `[emot=acfun,${emotItem.dataset.code}/]`);
                emotpanel.pick(emotItem.dataset.code);
                return;
            }

            // 图片按钮 → 触发文件选择
            const imgBtn = e.target.closest('.plaza-editor-img');
            if (imgBtn) {
                const editorBox = imgBtn.closest('.plaza-comment-editor');
                if (editorBox?.dataset.uploading !== '1') {
                    editorBox?.querySelector('.plaza-editor-file')?.click();
                }
                return;
            }

            // 待发图片的移除按钮
            const pendingDel = e.target.closest('.plaza-editor-pending-del');
            if (pendingDel) {
                const pending = pendingDel.closest('.plaza-editor-pending');
                pending.style.display = 'none';
                pending.querySelector('img').removeAttribute('src');
                return;
            }

            if (e.target.closest('#up-status') || e.target.closest('#fetch-status')) {
                controller.refreshPlaza();
                return;
            }

            // 分享（复制链接）
            const shareBtn = e.target.closest('.feed-interactive-repost');
            if (shareBtn) {
                const card = shareBtn.closest('.moment-plaza-item');
                if (!card) return;
                const amId = card.dataset.amId;
                const url = `https://www.acfun.cn/moment/am${amId}`;
                const showCopied = () => {
                    const el = shareBtn.querySelector('span:last-child');
                    if (el) {
                        el.textContent = '已复制';
                        setTimeout(() => { el.textContent = '分享'; }, CONFIG.TOAST_DURATION_MS);
                    }
                };
                try {
                    await navigator.clipboard.writeText(url);
                    showCopied();
                } catch {
                    const input = document.createElement('input');
                    input.value = url;
                    document.body.appendChild(input);
                    input.select();
                    document.execCommand('copy');
                    input.remove();
                    showCopied();
                }
                return;
            }

            // 点赞
            const likeBtn = e.target.closest('.feed-interactive-like');
            if (likeBtn) {
                const card = likeBtn.closest('.moment-plaza-item');
                if (!card) return;
                const amId = card.dataset.amId;
                const record = state.moments.find(m => m.amId == amId);
                const authorId = record?.data?.user?.id || record?.data?.user?.userId;
                if (!authorId) return;

                if (likeBtn.dataset.loading) return;
                likeBtn.dataset.loading = '1';
                const isLiked = likeBtn.hasAttribute('active');
                try {
                    const result = await api.likeMoment(amId, authorId, isLiked);
                    if (result) {
                        if (isLiked) likeBtn.removeAttribute('active');
                        else likeBtn.setAttribute('active', '');
                        const nodes = likeBtn.childNodes;
                        for (let i = nodes.length - 1; i >= 0; i--) {
                            if (nodes[i].nodeType === 3 && nodes[i].textContent.trim()) {
                                const count = parseInt(nodes[i].textContent.trim()) || 0;
                                nodes[i].textContent = (isLiked ? Math.max(0, count - 1) : count + 1) + COUNT_SUFFIX;
                                break;
                            }
                        }
                        const m = state.moments.find(x => x.amId == amId);
                        if (m?.data) {
                            m.data.isLike = !isLiked;
                            m.data.likeCount = (m.data.likeCount || 0) + (isLiked ? -1 : 1);
                        }
                    }
                } finally {
                    delete likeBtn.dataset.loading;
                }
                return;
            }

            // 投蕉
            const bananaBtn = e.target.closest('.feed-interactive-banana');
            if (bananaBtn) {
                const card = bananaBtn.closest('.moment-plaza-item');
                if (!card) return;
                const amId = card.dataset.amId;

                if (bananaBtn.dataset.loading) return;
                bananaBtn.dataset.loading = '1';
                try {
                    const result = await api.throwBanana(amId);
                    if (result) {
                        if (result.result === 0) {
                            bananaBtn.setAttribute('active', '');
                            const numEl = bananaBtn.querySelector('span:last-child');
                            if (numEl) {
                                const count = parseInt(numEl.textContent) || 0;
                                numEl.textContent = count + 1;
                            }
                            const m = state.moments.find(x => x.amId == amId);
                            if (m?.data) {
                                m.data.isThrowBanana = true;
                                m.data.bananaCount = (m.data.bananaCount || 0) + 1;
                            }
                        } else if (result.error_msg) {
                            alert(result.error_msg);
                        }
                    }
                } finally {
                    delete bananaBtn.dataset.loading;
                }
                return;
            }

            // 评论点赞
            const commentLikeBtn = e.target.closest('.area-comment-like');
            if (commentLikeBtn && commentLikeBtn.closest('.moment-comments')) {
                const card = commentLikeBtn.closest('.moment-plaza-item');
                const amId = card?.dataset.amId;
                const commentItem = commentLikeBtn.closest('.area-comment-top');
                const commentId = commentItem?.querySelector('.plaza-reply-btn')?.dataset.commentId;
                if (!amId || !commentId) return;

                const isLiked = commentLikeBtn.classList.contains('area-comment-up');
                const result = await api.likeComment(amId, commentId, isLiked);
                if (result && result.result === 0) {
                    commentLikeBtn.classList.toggle('area-comment-up');
                    const text = commentLikeBtn.textContent.trim();
                    const match = text.match(/\d+/);
                    const currentCount = match ? parseInt(match[0]) : 0;
                    const newCount = isLiked ? Math.max(0, currentCount - 1) : currentCount + 1;
                    commentLikeBtn.textContent = newCount > 0 ? `赞 ${newCount}` : '赞';
                }
                return;
            }

            // 点击评论数 → 展开/收起评论（单条请求更新）
            const commentBtn = e.target.closest('.feed-interactive-comment');
            if (commentBtn) {
                const card = commentBtn.closest('.moment-plaza-item');
                if (!card) return;
                const amId = card.dataset.amId;
                const container = document.getElementById(`comments-${amId}`);
                if (!container) return;

                if (container.style.display !== 'none') {
                    container.style.display = 'none';
                    commentBtn.classList.remove('active');
                    return;
                }

                if (container.innerHTML) {
                    container.style.display = '';
                    commentBtn.classList.add('active');
                    return;
                }

                container.style.display = '';
                container.innerHTML = '<div class="plaza-comment-empty">评论加载中...</div>';
                commentBtn.classList.add('active');

                // 展开时同时刷新该条互动数据（赞/评/投蕉数字），评论单独拉取
                controller._refreshOneMoment(amId).catch(() => {});
                const data = await api.fetchComments(amId);
                container.innerHTML = renderer.renderComments(data, amId);
                return;
            }

            // 点击"回复"按钮
            const replyBtn = e.target.closest('.plaza-reply-btn');
            if (replyBtn) {
                const commentId = replyBtn.dataset.commentId;
                const box = document.getElementById(`reply-box-${commentId}`);
                document.querySelectorAll('.plaza-reply-box').forEach(b => b.style.display = 'none');
                if (box) {
                    box.style.display = 'flex';
                    box.querySelector('.plaza-editor-input')?.focus();
                }
                return;
            }

            // 发评论 / 回复（共用 .plaza-editor-send，回复会带 data-reply-to）
            const editorSend = e.target.closest('.plaza-editor-send');
            if (editorSend) {
                const amId = editorSend.dataset.amId;
                const replyTo = editorSend.dataset.replyTo;
                const editorBox = editorSend.closest('.plaza-comment-editor');
                const input = editorBox?.querySelector('.plaza-editor-input');
                const pendingBox = editorBox?.querySelector('.plaza-editor-pending');
                const pendingImg = pendingBox?.querySelector('img');
                let content = input?.value?.trim() || '';
                const hasImg = !!pendingBox && pendingBox.style.display !== 'none' && pendingImg?.src;
                if (!content && !hasImg) return;
                // 待发图片以原生带图评论的 UBB 格式追加
                if (hasImg) content = (content ? content + '\r\n' : '') + `[img=图片]${pendingImg.src}[/img]`;

                editorSend.disabled = true;
                editorSend.textContent = '...';
                const result = await api.postComment(amId, content, replyTo ? parseInt(replyTo) : 0);
                if (result && result.result === 0) {
                    const container = document.getElementById(`comments-${amId}`);
                    if (container) {
                        const data = await api.fetchComments(amId);
                        container.innerHTML = renderer.renderComments(data, amId);
                    }
                } else {
                    alert('发送失败，请重试');
                    editorSend.disabled = false;
                    editorSend.textContent = replyTo ? '发送' : '发表';
                }
                return;
            }
        });

        // 选中文件后上传评论图片
        document.addEventListener('change', async (e) => {
            const fileInput = e.target.closest?.('.plaza-editor-file');
            if (!fileInput) return;
            const editorBox = fileInput.closest('.plaza-comment-editor');
            const file = fileInput.files && fileInput.files[0];
            fileInput.value = '';
            if (!editorBox || !file) return;

            if (!file.type.startsWith('image/')) {
                alert('只能上传图片文件');
                return;
            }
            if (file.size > CONFIG.MAX_IMAGE_SIZE) {
                alert('图片不能超过 5M');
                return;
            }

            editorBox.dataset.uploading = '1';
            const pending = editorBox.querySelector('.plaza-editor-pending');
            pending.style.display = 'none';
            const imgBtn = editorBox.querySelector('.plaza-editor-img');
            imgBtn.style.opacity = '.5';
            const url = await api.uploadImage(file);
            editorBox.dataset.uploading = '';
            imgBtn.style.opacity = '';

            if (!url) {
                alert('图片上传失败，请重试');
                return;
            }
            const pendingImg = pending.querySelector('img');
            pendingImg.src = url;
            pending.style.display = 'flex';
        });

        // 表情悬停大图预览：mouseover 冒泡委托，item 内部移动不重复触发
        document.addEventListener('mouseover', (e) => {
            const item = e.target.closest?.('.plaza-emot-item');
            if (item && item.closest('.plaza-emot-panel.open')) emotpanel.showPreview(item);
        });
        document.addEventListener('mouseout', (e) => {
            const item = e.target.closest?.('.plaza-emot-item');
            if (item && !(e.relatedTarget && item.contains(e.relatedTarget))) emotpanel.hidePreview();
        });
        // 预览浮层 fixed 定位，面板/页面滚动时立即隐藏，避免错位
        document.addEventListener('scroll', () => emotpanel.hidePreview(), true);

        document.addEventListener('keydown', async (e) => {
            if (e.key !== 'Enter') return;
            const editor = e.target.closest?.('.plaza-editor-input');
            if (editor) {
                if (!(e.ctrlKey || e.metaKey)) return;
                e.preventDefault();
                editor.closest('.plaza-comment-editor')?.querySelector('.plaza-editor-send')?.click();
                return;
            }
        });

        // 编辑器聚焦展开（还原原生 fold 态：默认纯框，聚焦出工具行）
        // 工具行 mousedown 阻止默认行为，避免点击图标时 textarea 失焦导致面板收起
        document.addEventListener('mousedown', (e) => {
            if (e.target.closest('.plaza-editor-actions')) e.preventDefault();
        });

        document.addEventListener('focusin', (e) => {
            const editorBox = e.target.closest?.('.plaza-comment-editor');
            // 楼层回复框没有折叠逻辑，只有显示/隐藏；
            // 常驻主评论框才需要聚焦后展开工具行
            if (editorBox && !editorBox.closest?.('.plaza-reply-box')) {
                editorBox.classList.add('expanded');
            }
            // 主评论框获得焦点时，收起所有楼层回复框；
            // 回复框内部的 textarea 获得焦点时不应把自己关掉
            if (e.target.closest?.('.plaza-editor-input') && !e.target.closest?.('.plaza-reply-box')) {
                document.querySelectorAll('.plaza-reply-box').forEach(b => b.style.display = 'none');
            }
        });

        document.addEventListener('focusout', (e) => {
            const editorBox = e.target.closest?.('.plaza-comment-editor');
            // 楼层回复框只有显示/隐藏，没有 fold 态，不需要折叠
            if (!editorBox || editorBox.closest?.('.plaza-reply-box')) return;
            setTimeout(() => {
                if (editorBox.contains(document.activeElement)) return;
                const input = editorBox.querySelector('.plaza-editor-input');
                const pending = editorBox.querySelector('.plaza-editor-pending');
                const hasImg = !!pending && pending.style.display !== 'none';
                if (input && !input.value.trim() && !hasImg) {
                    editorBox.classList.remove('expanded');
                }
            }, 0);
        });
    }
};
