import { CONFIG, AUTO_ENTER_KEY, SEL_MAIN_FEEDS } from './config.js';
import { controller } from './controller.js';

export const navigation = {
    // 在侧边栏注入「动态广场」入口
    setupNavigation() {
        const checkNav = setInterval(() => {
            const feedsNav = document.querySelector('.sub-nav-title a[href="/member/feeds"]')
                || document.querySelector('a[href="/member/feeds"]')
                || document.querySelector('.ac-member-navigation a[href*="/feeds"]');
            if (feedsNav) {
                clearInterval(checkNav);
                this.addPlazaNavItem(feedsNav);
            }
        }, CONFIG.NAV_POLL_INTERVAL);
        setTimeout(() => clearInterval(checkNav), CONFIG.NAV_POLL_TIMEOUT);
    },

    addPlazaNavItem(feedsNav) {
        if (document.querySelector('.plaza-nav-item')) return;

        const feedsLink = feedsNav.querySelector('a[href="/member/feeds"]') || feedsNav;
        if (feedsLink.tagName === 'A') {
            feedsLink.addEventListener('click', (e) => {
                const mainContent = document.querySelector(SEL_MAIN_FEEDS);
                if (mainContent && mainContent.querySelector('.moment-plaza-container')) {
                    e.preventDefault();
                    e.stopPropagation();
                    location.reload();
                }
            });
        }

        const plazaItem = document.createElement('a');
        plazaItem.href = 'javascript:void(0)';
        plazaItem.className = 'ac-member-navigation-item ac-member-navigation-sub-item plaza-nav-item';
        plazaItem.textContent = '动态广场';

        plazaItem.addEventListener('click', (e) => {
            e.preventDefault();
            controller.enterPlaza();
        });

        const subNavGroup = feedsNav.closest('.member-sub-nav');
        if (subNavGroup) {
            const fansLink = subNavGroup.querySelector('a[href="/member/feeds/fans"]');
            if (fansLink) {
                fansLink.parentNode.insertBefore(plazaItem, fansLink.nextSibling);
            } else {
                subNavGroup.appendChild(plazaItem);
            }

            subNavGroup.querySelectorAll('a:not(.plaza-nav-item)').forEach(link => {
                link.addEventListener('click', () => {
                    plazaItem.classList.remove('ac-member-navigation-item-active');
                });
            });
        }

        feedsNav.addEventListener('click', () => {
            plazaItem.classList.remove('ac-member-navigation-item-active');
        });
    },

    // /member/feeds 页：自动进入广场（跳转回来时）或显示推广条
    setupFeedsPage() {
        if (GM_getValue(AUTO_ENTER_KEY, false)) {
            GM_setValue(AUTO_ENTER_KEY, false);
            const waitForContent = setInterval(() => {
                const mainContent = document.querySelector(SEL_MAIN_FEEDS);
                if (mainContent) {
                    clearInterval(waitForContent);
                    controller.enterPlaza();
                }
            }, CONFIG.FEEDS_POLL_INTERVAL);
            setTimeout(() => clearInterval(waitForContent), CONFIG.NAV_POLL_TIMEOUT);
            return;
        }

        setTimeout(() => {
            this.addPlazaPromotion();
        }, CONFIG.PROMOTION_DELAY_MS);
    },

    addPlazaPromotion() {
        if (document.querySelector('.plaza-promotion')) return;

        const header = document.querySelector('.ac-member-feeds-header');
        if (header) {
            const promotion = document.createElement('div');
            promotion.className = 'plaza-promotion';
            promotion.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 16px;
                background: #f5f5f5;
                margin: 0 16px 16px;
                border-radius: 4px;
                font-size: 14px;
                color: #666;
            `;
            promotion.innerHTML = `
                <span>按am号查找动态，试试<strong style="color: #ff4b76;">动态广场</strong></span>
                <button style="background: #ff4b76; color: #fff; border: none; padding: 4px 16px; border-radius: 4px; cursor: pointer;">进入</button>
            `;

            promotion.querySelector('button').addEventListener('click', () => {
                controller.enterPlaza();
            });

            header.parentNode.insertBefore(promotion, header.nextSibling);
        }
    }
};
