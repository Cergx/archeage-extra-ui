/**
 * Удаляет пустой style, созданный прежними функциями инициализации.
 * Стили расширения подключаются отдельными CSS-файлами через manifest.
 */
export const appendStyleElement = (style: HTMLStyleElement): void => {
    // SCSS imports are injected as standalone stylesheets through manifest.json.
    style.remove();
};
