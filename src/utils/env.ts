import { claimLevelPrizeInPage, openNextBoxInPage, pageWindow, pageDocument } from '../adapter/env.js';

export { claimLevelPrizeInPage, openNextBoxInPage, pageWindow, pageDocument };

/** Resolve esbuild-emitted assets through the extension API from the isolated world. */
export const resolveExtensionAsset = (url: string): string => {
    const assetPath = url.replace(/^\.\//, '');
    if (!assetPath.startsWith('assets/')) return url;
    const extensionApi = (globalThis as any).browser ?? (globalThis as any).chrome;
    return extensionApi?.runtime?.getURL(assetPath) ?? url;
};

/** Whether current page is on gisaa.ru. */
export const isGisaaSite: boolean = location.hostname.includes('gisaa.ru');

/** Whether current page is on archeage.ru. */
export const isArcheageSite: boolean = location.hostname.includes('archeage.ru');

/** Whether current page is the ArcheAge cart page. */
export const isCartPage: boolean = isArcheageSite && (location.pathname === '/cart' || location.pathname === '/cart/');

/** Whether current page is the ArcheAge item restore page. */
export const isItemRestorePage: boolean = isArcheageSite && (location.pathname === '/itemrestore' || location.pathname === '/itemrestore/');
