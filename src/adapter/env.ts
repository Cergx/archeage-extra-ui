/**
 * Адаптер окружения Tampermonkey.
 * Предоставляет API хранилища и страничного window, используемые всем кодом.
 */

export const pageWindow: Window & typeof globalThis =
    typeof unsafeWindow !== 'undefined' ? unsafeWindow as Window & typeof globalThis : window;

export const pageDocument: Document = pageWindow.document;

type VueStore = {
    dispatch: (type: string, payload?: unknown) => Promise<unknown> | unknown;
};

const getPageVueStore = (): VueStore | null => {
    const roots = [
        pageDocument.querySelector('.game__right'),
        pageDocument.querySelector('.page'),
        pageDocument.body,
    ];

    for (const root of roots) {
        let el: Element | null = root;
        while (el) {
            const store = (el as Element & { __vue__?: { $store?: VueStore } }).__vue__?.$store;
            if (store && typeof store.dispatch === 'function') return store;
            el = el.parentElement;
        }
    }
    return null;
};

/** Забирает награду в контексте страницы, где доступен Vuex сайта. */
export const claimLevelPrizeInPage = (level: number, isPremium: boolean): Promise<unknown> => {
    const store = getPageVueStore();
    if (!store) return Promise.reject(new Error('Vue store not found'));

    return new Promise((resolve, reject) => {
        let settled = false;
        const succeed = (data: unknown): void => {
            if (!settled) {
                settled = true;
                resolve(data);
            }
        };
        const fail = (error?: unknown): void => {
            if (!settled) {
                settled = true;
                reject(error ?? new Error(`getLevelPrize failed for level=${level}`));
            }
        };
        try {
            const result = store.dispatch('maininfo/getLevelPrize', {
                level,
                is_premium: isPremium ? 1 : 0,
                callback_success: succeed,
                callback_error: fail,
            });
            if (result && typeof (result as Promise<unknown>).then === 'function') {
                void Promise.resolve(result).then(succeed, fail);
            }
        } catch (error) {
            fail(error);
        }
    });
};

export const readSharedValue = (key: string): string | undefined => {
    if (typeof GM_getValue === 'function') {
        const value = GM_getValue(key);
        if (value !== undefined && value !== null) return String(value);
    }
    return undefined;
};

export const writeSharedValue = (key: string, value: string): void => {
    if (typeof GM_setValue === 'function') {
        GM_setValue(key, value);
    }
};

export const onIrData = null as unknown as (handler: (data: any) => void) => void;
