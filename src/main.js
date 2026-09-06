import { injectStyles } from './css.js';
import { navigation } from './navigation.js';
import { background } from './background.js';
import { events } from './events.js';
import { api } from './api.js';

injectStyles();

function init() {
    if (!window.location.pathname.startsWith('/member')) return;

    navigation.setupNavigation();
    background.start();
    events.bindAll();
    api.fetchEmoticonPacks();

    if (window.location.pathname.startsWith('/member/feeds')) {
        navigation.setupFeedsPage();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
