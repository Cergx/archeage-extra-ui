import { appendStyleElement } from '../../utils/dom.js';
import inputStyles from './input.scss';

export interface InputOptions {
    type?: 'text' | 'number';
    value?: string | number;
    className?: string;
    placeholder?: string;
    min?: string | number;
    max?: string | number;
    step?: string | number;
    disabled?: boolean;
    theme?: 'default' | 'white';
}

let inputStylesInjected = false;

const injectInputStyles = (): void => {
    if (inputStylesInjected) return;
    inputStylesInjected = true;
    const style = document.createElement('style');
    style.textContent = inputStyles;
    appendStyleElement(style);
};

export const createInput = ({
    type = 'text',
    value = '',
    className,
    placeholder,
    min,
    max,
    step,
    disabled = false,
    theme = 'default',
}: InputOptions = {}): HTMLInputElement => {
    injectInputStyles();

    const input = document.createElement('input');
    input.type = type;
    input.className = 'tm-input';
    if (className) input.classList.add(className);
    if (theme === 'white') input.classList.add('tm-input--theme-white');
    input.value = String(value);
    input.disabled = disabled;
    if (placeholder != null) input.placeholder = placeholder;
    if (min != null) input.min = String(min);
    if (max != null) input.max = String(max);
    if (step != null) input.step = String(step);
    return input;
};
