import { appendStyleElement } from '../../utils/dom.js';
import reloadBtnStyles from './reloadBtn.scss';

export let reloadBtnStylesInjected: boolean = false;

export const injectReloadBtnStyles: () => void = () => {
    if (reloadBtnStylesInjected) return;
    reloadBtnStylesInjected = true;
    const style = document.createElement('style');
    style.textContent = reloadBtnStyles;
    appendStyleElement(style);
};

export const appendReloadBtn: (header: HTMLElement) => void = (header) => {
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
