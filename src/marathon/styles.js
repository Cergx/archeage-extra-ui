import itemIconStyles from '../itemIcon/itemIcon.scss';
import selectedItemsStyles from './selectedItems/selectedItems.scss';
import marathonStyles from './page/page.scss';
import cartStyles from '../cart/cart.scss';

const DONE_CLASS = 'tm-task-completed';
const JUST_DONE_CLASS = 'tm-task-just-completed';

export let itemIconStylesInjected = false;
export let selectedItemsStylesInjected = false;
export let marathonStylesInjected = false;
export let cartStylesInjected = false;

const getSystemScale = () => window.devicePixelRatio / (window.visualViewport?.scale || 1);

const getEffectiveScale = () => 1 / getSystemScale();

export const updateTooltipScale = (tooltip) => {
    tooltip.style.setProperty('--tm-tooltip-scale', `${getEffectiveScale()}`);
};

/** Инжектит стили для иконок предметов (используется на cart и marathon). */
export const injectItemIconStyles = () => {
    if (itemIconStylesInjected) return;
    itemIconStylesInjected = true;
    const style = document.createElement('style');
    style.textContent = itemIconStyles;
    document.head.appendChild(style);
};

/** Инжектит стили для страницы марафона. */
export const injectMarathonStyles = () => {
    if (marathonStylesInjected) return;
    marathonStylesInjected = true;

    const style = document.createElement('style');
    style.textContent = marathonStyles;
    document.head.appendChild(style);
};

/** Инжектит стили для страницы корзины. */
export const injectCartStyles = () => {
    if (cartStylesInjected) return;
    cartStylesInjected = true;

    const style = document.createElement('style');
    style.textContent = cartStyles;
    document.head.appendChild(style);
};

/** Инжектит стили для блока списка выбранных предметов. */
export const injectSelectedItemsStyles = () => {
    if (selectedItemsStylesInjected) return;
    selectedItemsStylesInjected = true;

    const style = document.createElement('style');
    style.textContent = selectedItemsStyles;
    document.head.appendChild(style);
};
