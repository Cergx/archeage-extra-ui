import { pageWindow, pageDocument } from '../adapter/env.js';

export { pageWindow, pageDocument };

/** Whether current page is on gisaa.ru. */
export const isGisaaSite: boolean = location.hostname.includes('gisaa.ru');

/** Whether current page is on archeage.ru. */
export const isArcheageSite: boolean = location.hostname.includes('archeage.ru');

/** Whether current page is the ArcheAge cart page. */
export const isCartPage: boolean = isArcheageSite && (location.pathname === '/cart' || location.pathname === '/cart/');

/** Whether current page is the ArcheAge item restore page. */
export const isItemRestorePage: boolean = isArcheageSite && (location.pathname === '/itemrestore' || location.pathname === '/itemrestore/');
