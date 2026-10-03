import { initItemRestore } from './itemRestore.js';
import { injectSelectedItemsStyles } from '../marathon/styles.js';
import { injectItemIconStyles } from '../../components/itemIcon/itemIcon.js';
import { makeItemIconLink } from '../../components/tooltip/tooltip.js';
import { initArcheageCommon } from '../../utils/archeageCommon.js';

initArcheageCommon();

const start = (): void => initItemRestore({ injectItemIconStyles, injectSelectedItemsStyles, makeItemIconLink });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
