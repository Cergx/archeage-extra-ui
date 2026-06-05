import reloadBtnStyles from './reloadBtn.scss';

export let reloadBtnStylesInjected = false;

export const injectReloadBtnStyles = () => {
    if (reloadBtnStylesInjected) return;
    reloadBtnStylesInjected = true;
    const style = document.createElement('style');
    style.textContent = reloadBtnStyles;
    document.head.appendChild(style);
};

/**
 * Создаёт кнопку ↻ для перезагрузки страницы и вставляет её в заголовок.
 * Автоматически инжектит стили при первом вызове.
 * @param {HTMLElement} header — элемент `.guild_header2`, в который добавляется кнопка.
 */
export const appendReloadBtn = (header) => {
    injectReloadBtnStyles();
    header.classList.add('tm-has-reload');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tm-reload-btn';
    btn.title = 'Обновить страницу';
    btn.innerHTML = '&#x21bb;';
    btn.addEventListener('click', () => location.reload());
    header.appendChild(btn);
};
