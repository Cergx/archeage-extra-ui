import { initCart } from './cart.js';
import { injectSelectedItemsStyles, injectCartStyles } from '../marathon/styles.js';
import { injectItemIconStyles } from '../../components/itemIcon/itemIcon.js';
import { makeItemIconLink } from '../../components/tooltip/tooltip.js';
import { fetchText, getUidFromCheckUser } from '../marathon/core.js';
import { initArcheageCommon } from '../../utils/archeageCommon.js';

initArcheageCommon();

const start = (): void => initCart({
    injectItemIconStyles,
    injectSelectedItemsStyles,
    injectCartStyles,
    makeItemIconLink,
    fetchText,
    getUidFromCheckUser,
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
