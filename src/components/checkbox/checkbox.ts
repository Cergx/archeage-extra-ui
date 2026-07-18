import { appendStyleElement } from '../../utils/dom.js';
import checkboxStyles from './checkbox.scss';

export interface CheckboxOptions {
    label: string;
    checked?: boolean;
    disabled?: boolean;
    id?: string;
    className?: string;
    onChange?: (checked: boolean) => void;
}

export interface CheckboxHandle {
    root: HTMLLabelElement;
    input: HTMLInputElement;
}

let checkboxStylesInjected = false;

const injectCheckboxStyles = (): void => {
    if (checkboxStylesInjected) return;
    checkboxStylesInjected = true;
    const style = document.createElement('style');
    style.textContent = checkboxStyles;
    appendStyleElement(style);
};

export const createCheckbox = ({ label, checked = false, disabled = false, id, className, onChange }: CheckboxOptions): CheckboxHandle => {
    injectCheckboxStyles();

    const root = document.createElement('label');
    root.className = 'tm-checkbox';
    if (className) root.classList.add(className);

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'tm-checkbox-input';
    input.checked = checked;
    input.disabled = disabled;
    if (id) input.id = id;
    if (onChange) input.addEventListener('change', () => onChange(input.checked));

    const control = document.createElement('span');
    control.className = 'tm-checkbox-control';
    control.setAttribute('aria-hidden', 'true');

    const text = document.createElement('span');
    text.className = 'tm-checkbox-label';
    text.textContent = label;

    root.append(input, control, text);
    return { root, input };
};
