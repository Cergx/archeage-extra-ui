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
