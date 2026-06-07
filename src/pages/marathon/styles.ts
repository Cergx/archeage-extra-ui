import { appendStyleElement } from '../../utils/dom.js';
import itemIconStyles from '../../components/itemIcon/itemIcon.scss';
import selectedItemsStyles from './selected-items.scss';
import marathonStyles from './marathon.scss';
import cartStyles from '../cart/cart.scss';

export let itemIconStylesInjected: boolean = false;
export let selectedItemsStylesInjected: boolean = false;
export let marathonStylesInjected: boolean = false;
export let cartStylesInjected: boolean = false;

/** Инжектит стили для иконок предметов (используется на cart и marathon). */
export const injectItemIconStyles = (): void => {
    if (itemIconStylesInjected) return;
    itemIconStylesInjected = true;
    const style = document.createElement('style');
    style.textContent = itemIconStyles;
    appendStyleElement(style);
};

/** Инжектит стили для страницы марафона. */
export const injectMarathonStyles = (): void => {
    if (marathonStylesInjected) return;
    marathonStylesInjected = true;

    const style = document.createElement('style');
    style.textContent = marathonStyles;
    appendStyleElement(style);
};

/** Инжектит стили для страницы корзины. */
export const injectCartStyles = (): void => {
    if (cartStylesInjected) return;
    cartStylesInjected = true;

    const style = document.createElement('style');
    style.textContent = cartStyles;
    appendStyleElement(style);
};

/** Инжектит стили для блока списка выбранных предметов. */
export const injectSelectedItemsStyles = (): void => {
    if (selectedItemsStylesInjected) return;
    selectedItemsStylesInjected = true;

    const style = document.createElement('style');
    style.textContent = selectedItemsStyles;
    appendStyleElement(style);
};
