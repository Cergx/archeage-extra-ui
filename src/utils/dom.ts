/**
 * Добавляет <style> в <head>. Если head ещё не готов (document_start),
 * ждёт DOMContentLoaded.
 */
export const appendStyleElement = (style: HTMLStyleElement): void => {
    const tryAppend = () => {
        if (document.head) {
            document.head.appendChild(style);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                document.head.appendChild(style);
            }, { once: true });
        }
    };
    tryAppend();
};
