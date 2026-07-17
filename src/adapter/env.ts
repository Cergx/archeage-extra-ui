/**
 * Адаптер окружения Tampermonkey.
 * Предоставляет API хранилища и страничного window, используемые всем кодом.
 */

export const pageWindow: Window & typeof globalThis =
    typeof unsafeWindow !== 'undefined' ? unsafeWindow as Window & typeof globalThis : window;

export const pageDocument: Document = pageWindow.document;

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
