import { appendStyleElement } from '../../utils/dom.js';
import scrollbarStyles from './scrollbar.scss';

let scrollbarStylesInjected = false;

export const injectScrollbarStyles = (): void => {
    if (scrollbarStylesInjected) return;
    scrollbarStylesInjected = true;
    const style = document.createElement('style');
    style.textContent = scrollbarStyles;
    appendStyleElement(style);
};
