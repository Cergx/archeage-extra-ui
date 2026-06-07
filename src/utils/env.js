/** Page window object from the userscript page context. */
export const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

/** Page document object from the userscript page context. */
export const pageDocument = pageWindow.document || document;

/** Whether current page is on gisaa.ru. */
export const isGisaaSite = location.hostname.includes('gisaa.ru');

/** Whether current page is on archeage.ru. */
export const isArcheageSite = location.hostname.includes('archeage.ru');

/** Whether current page is the ArcheAge cart page. */
export const isCartPage = isArcheageSite && (location.pathname === '/cart' || location.pathname === '/cart/');

/** Whether current page is the ArcheAge item restore page. */
export const isItemRestorePage = isArcheageSite && (location.pathname === '/itemrestore' || location.pathname === '/itemrestore/');
