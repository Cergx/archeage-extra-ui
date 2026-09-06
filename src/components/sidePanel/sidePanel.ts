import sidePanelStyles from './sidePanel.scss';
import { appendStyleElement } from '../../utils/dom.js';

let sidePanelStylesInjected = false;

const injectSidePanelStyles = (): void => {
    if (sidePanelStylesInjected) return;
    sidePanelStylesInjected = true;
    const style = document.createElement('style');
    style.textContent = sidePanelStyles;
    appendStyleElement(style);
};

export const createSidePanel = (): HTMLDivElement => {
    injectSidePanelStyles();
    const sidePanel = document.createElement('div');
    sidePanel.className = 'tm-side-panel';
    return sidePanel;
};
