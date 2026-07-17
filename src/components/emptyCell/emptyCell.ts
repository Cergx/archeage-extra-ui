import { pageDocument } from '../../utils/env.js';
import { appendStyleElement } from '../../utils/dom.js';
import emptyCellStyles from './emptyCell.scss';

const EMPTY_CELL_STYLES_ID = 'tm-empty-cell-styles';

export const injectEmptyCellStyles = (): void => {
    if (pageDocument.getElementById(EMPTY_CELL_STYLES_ID)) return;

    const style = pageDocument.createElement('style');
    style.id = EMPTY_CELL_STYLES_ID;
    style.textContent = emptyCellStyles;
    appendStyleElement(style);
};

export const makeEmptyCell = (): HTMLDivElement => {
    injectEmptyCellStyles();

    const cell = pageDocument.createElement('div');
    cell.className = 'tm-empty-cell';
    cell.setAttribute('aria-hidden', 'true');
    return cell;
};
