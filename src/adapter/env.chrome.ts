/**
 * Адаптер окружения Chrome-расширения (content script).
 * popup_open/popup_close проксируются через postMessage в page-script.
 */
export const pageWindow = new Proxy(window, {
    get(target, prop) {
        if (prop === 'popup_open') {
            return (...args: unknown[]) => {
                window.postMessage({ source: 'tmAA-cs', type: 'POPUP_OPEN', args }, '*');
            };
        }
        if (prop === 'popup_close') {
            return () => {
                window.postMessage({ source: 'tmAA-cs', type: 'POPUP_CLOSE' }, '*');
            };
        }
        return (target as any)[prop];
    },
}) as Window & typeof globalThis;

export const pageDocument: Document = document;

let claimRequestId = 0;

/** Забирает награду через page-script, потому что Vuex недоступен content-script. */
export const claimLevelPrizeInPage = (level: number, isPremium: boolean): Promise<unknown> => {
    const requestId = `claim-${Date.now()}-${++claimRequestId}`;
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            window.removeEventListener('message', onMessage);
            reject(new Error(`getLevelPrize timed out for level=${level}`));
        }, 10_000);
        const onMessage = (event: MessageEvent): void => {
            if (event.source !== window || event.data?.source !== 'tmAA-page' || event.data?.requestId !== requestId) return;
            clearTimeout(timeout);
            window.removeEventListener('message', onMessage);
            if (event.data.type === 'CLAIM_LEVEL_PRIZE_SUCCESS') resolve(event.data.data);
            else reject(new Error(event.data.error || `getLevelPrize failed for level=${level}`));
        };
        window.addEventListener('message', onMessage);
        window.postMessage({ source: 'tmAA-cs', type: 'CLAIM_LEVEL_PRIZE', requestId, level, isPremium }, '*');
    });
};

export const readSharedValue = (key: string): string | undefined =>
    localStorage.getItem(key) ?? undefined;

export const writeSharedValue = (key: string, value: string): void => {
    localStorage.setItem(key, value);
};

type IrDataHandler = (data: { grades: any; info: any; items: any }) => void;
let irDataHandler: IrDataHandler | null = null;

export const onIrData = (handler: IrDataHandler): void => {
    irDataHandler = handler;
};

window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window) return;
    if (event.data?.source !== 'tmAA-page') return;
    if (event.data.type === 'IR_DATA' && irDataHandler) {
        irDataHandler(event.data.body);
    }
});
