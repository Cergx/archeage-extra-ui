// Data and item utilities extracted from ArcheAgeExtraUI.user.js.

import benedictIcon from '../icons/items/56010.png';
import rudolfBoxIcon from '../icons/items/rudolfBox.png';

export const CODEX_IMAGES_BASE = 'https://archeagecodex.com/images/';
export const LS_KEY_ICON_SEX = 'tm_aa_icon_sex';
export const LS_KEY_ICON_SCALE = 'tm_aa_icon_scale';
export const LS_KEY_ICON_SCALE_BROWSER_ZOOM = 'tm_aa_icon_scale_browser_zoom';
export const LS_KEYS: Record<string, string> = { ICON_SEX: LS_KEY_ICON_SEX };

export interface Grade {
    overlay: string;
    title: string;
    color: string;
    cartNamePatterns?: RegExp[];
}

export const GRADES: Grade[] = [
    /* 0  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade0.png`, title: 'Бесполезный предмет', color: '#949293' },
    /* 1  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade1.png`, title: 'Обычный предмет', color: '#ba976d', cartNamePatterns: [/^обычн(?:ый|ая|ое|ые)\s+/] },
    /* 2  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade2.png`, title: 'Необычный предмет', color: '#77b064', cartNamePatterns: [/^необычн(?:ый|ая|ое|ые)\s+/] },
    /* 3  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade3.png`, title: 'Редкий предмет', color: '#558fd7', cartNamePatterns: [/^редк(?:ий|ая|ое|ие)\s+/] },
    /* 4  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade4.png`, title: 'Уникальный предмет', color: '#cb72d8', cartNamePatterns: [/^уникальн(?:ый|ая|ое|ые)\s+/] },
    /* 5  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade5.png`, title: 'Эпический предмет', color: '#d78b06', cartNamePatterns: [/^эпическ(?:ий|ая|ое|ие)\s+/] },
    /* 6  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade6.png`, title: 'Легендарный предмет', color: '#e17853', cartNamePatterns: [/^легендарн(?:ый|ая|ое|ые)\s+/] },
    /* 7  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade7.png`, title: 'Реликвия', color: '#f95252', cartNamePatterns: [/^реликвийн(?:ый|ая|ое|ые)\s+/] },
    /* 8  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade8.png`, title: 'Предмет эпохи чудес', color: '#cf7d5d', cartNamePatterns: [/\s+эпохи чудес$/] },
    /* 9  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade9.png`, title: 'Предмет эпохи сказаний', color: '#8fa5ca', cartNamePatterns: [/\s+эпохи сказаний$/] },
    /* 10 */ { overlay: `${CODEX_IMAGES_BASE}icon_grade10.png`, title: 'Предмет эпохи легенд', color: '#bf7900', cartNamePatterns: [/\s+эпохи легенд$/] },
    /* 11 */ { overlay: `${CODEX_IMAGES_BASE}icon_grade11.png`, title: 'Предмет эпохи мифов', color: '#c90b0b', cartNamePatterns: [/\s+эпохи мифов$/] },
    /* 12 */ { overlay: `${CODEX_IMAGES_BASE}icon_grade12.png`, title: 'Предмет эпохи Двенадцати', color: '#ae98fe', cartNamePatterns: [/\s+эпохи двенадцати$/] },
];

export interface ItemType {
    icon?: string;
    title: string;
}

export const ITEM_TYPES: Record<string, ItemType> = {
    'unidentified': { title: 'Неопознанный предмет' },
    'quest':        { title: 'Задание' },
    'magical':      { title: 'Магический предмет' },
    'box':          { title: 'Ящик' },
    'equipment':    { title: 'Снаряжение' },
    'material':     { title: 'Материал' },
    'potion':       { title: 'Микстура' },
    'other':        { title: 'Прочее' },
    'rareMaterial': { title: 'Редкий материал' },
    'mount':        { title: 'Ездовой питомец' },
    'battlePet':    { title: 'Боевой питомец' },
    'lightArmor':   { title: 'Легкий доспех' },
    'furniture':    { title: 'Предмет интерьера' },
    'craftItem':    { title: 'Ремесленный предмет' },
};

export interface ItemSubType {
    title: string;
}

export const ITEM_SUB_TYPES: Record<string, ItemSubType> = {
    'ingot':          { title: 'Слиток металла' },
    'leather':        { title: 'Кожа' },
    'cloth':          { title: 'Ткань' },
    'lumber':         { title: 'Древесина' },

    'costume':        { title: 'Костюм' },
    'cloak':          { title: 'Плащ' },
    'windInstrument': { title: 'Духовой инструмент' },
};

export interface EquipmentSubType {
    title: string;
}

export const EQUIPMENT_SUB_TYPES: Record<string, EquipmentSubType> = {
    'helmet':            { title: 'Шлем' },
    'armor':             { title: 'Нагрудник' },
    'belt':              { title: 'Пояс' },
    'bracer':            { title: 'Наручи' },
    'gloves':            { title: 'Перчатки' },
    'cloak':             { title: 'Плащ' },
    'pants':             { title: 'Поножи' },
    'boots':             { title: 'Обувь' },
    'underwear':         { title: 'Нижнее бельё' },
    'necklace':          { title: 'Ожерелье' },
    'earrings':          { title: 'Серьга' },
    'ring':              { title: 'Кольцо' },
    'two_handed_weapon': { title: 'Двуручное оружие' },
    'ranged weapon':     { title: 'Оружие дальнего боя' },
    'instrument':        { title: 'Инструмент' },
    'weight':            { title: 'Груз' },
    'costume':           { title: 'Костюм' },
};

export interface ItemOverlay {
    icon: string;
}

export const ICON_OVERLAY: Record<string, ItemOverlay> = {
    'unconfirmed': { icon: 'https://archeagecodex.com/items/top_unconfirmed.png' },
    'seal_02':        { icon: 'https://archeagecodex.com/items/top_seal_02.png' },
    'seal_03':        { icon: 'https://archeagecodex.com/items/top_seal_03.png' },
    'seal_04':        { icon: 'https://archeagecodex.com/items/top_seal_04.png' },
    'seal_08':        { icon: 'https://archeagecodex.com/items/top_seal_08.png' },
    'quest_y':     { icon: 'https://archeagecodex.com/items/top_quest_y.png' },
    'quest_cash':  { icon: 'https://archeagecodex.com/items/top_quest_cash.png' },
};

export const HERO_LEVEL_ICON = 'https://archeagecodex.com/images/icon_hlv.png';
export const MAX_HERO_LEVEL = 70;
export const MAX_LEVEL = 55 + MAX_HERO_LEVEL;
export const CURRENCY_ICONS = {
    gold: 'https://archeagecodex.com/items/gold.png',
    silver: 'https://archeagecodex.com/items/silver.png',
    bronze: 'https://archeagecodex.com/items/bronze.png',
};

export interface ItemBase {
    id: number;
    icon: string;
    iconM?: string;
    iconF?: string;
    grade?: number;
    fixedGrade?: number;
    name: string;
    searchName?: string;
    type?: string;
    overlay?: string;
    subType?: string;
    equipmentSubType?: string;
    vekselName?: string;
    vekselType?: string;
    isPersonal?: boolean;
    description?: string;
    useDescription?: string;
    equipDescription?: string;
    isEquipDescriptionTemporary?: boolean;
    price?: number | null;
    reqLevel?: number;
    maxLevel?: number;
    apiCategoryTitle?: string;
    speed?: number | string;
    durability?: number | string;
    dps?: number | string;
    armor?: number | string;
    magicResistance?: number | string;
    mdps?: number | string;
    hdps?: number | string;
    str?: number | string;
    dex?: number | string;
    sta?: number | string;
    int?: number | string;
    spi?: number | string;
    numSockets?: number;
    isGradable?: boolean;
    isGradeEnchantable?: boolean;
    buff?: Record<string, string | number | boolean | null>;
    buffDuration?: number | string;
    isGradeInferred?: boolean;
}

type ItemPlaceholderValue = string | number | boolean | null | Record<string, string | number | boolean | null>;
type ItemPlaceholderFormatter = (value: ItemPlaceholderValue, item?: ItemBase) => string;

export const snakeToCamel = (value: unknown): string => (
    String(value || '').replace(/_([a-z])/g, (_, char) => char.toUpperCase())
);

export const formatDurationValue = (value: unknown): string => {
    const totalSeconds = Math.max(0, Math.floor(Number(value) || 0));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts: string[] = [];

    if (hours) parts.push(`${hours} ч.`);
    if (minutes) parts.push(`${minutes} м.`);
    if (seconds) parts.push(`${seconds} с.`);
    return parts.join(' ') || '0 с.';
};

const ITEM_PLACEHOLDER_FORMATTERS: Record<string, ItemPlaceholderFormatter> = {
    buffDuration: value => formatDurationValue(value),
};

export const escapeHtmlAttribute = (value: unknown): string => (
    String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
);

export const decapitalize = (value: unknown): string => (
    String(value || '').replace(/^./, char => char.toLowerCase())
);

export const getItemPlaceholderValue = (item: ItemBase | null | undefined, field: string): ItemPlaceholderValue | undefined => {
    const directValue = (item as Record<string, ItemPlaceholderValue | undefined> | null | undefined)?.[field];
    if (directValue != null) return directValue;

    if (!field.startsWith('buff') || !item?.buff || typeof item.buff !== 'object') return null;
    const buffField = decapitalize(field.slice('buff'.length));
    return item.buff[buffField] ?? null;
};

export const resolveItemPlaceholders = (text: unknown, item?: ItemBase): string => (
    String(text || '').replace(/#\{([a-zA-Z0-9_]+)\}/g, (match, rawField) => {
        const field = snakeToCamel(rawField);
        const value = getItemPlaceholderValue(item, field);
        if (value == null) return `<span>(${rawField})</span>`;

        const formatter = ITEM_PLACEHOLDER_FORMATTERS[field];
        return formatter ? formatter(value, item) : String(value);
    })
);

/**
 * Парсит игровую разметку цвета (WoW/XLGames-формат) в HTML.
 * |cAARRGGBB...text...|r → <span style="color:#RRGGBBAA">text</span>
 * |nc;...text...|r       → <span class="inv-nc">text</span>
 * |nd;...text...|r       → <span class="inv-nd">text</span>
 * |ni;...text...|r       → <span class="inv-ni">text</span>
 * |nr;...text...|r       → <span class="inv-nr">text</span>
 * \n                     → <br>
 */
export const parseGameMarkup = (text: string, { preserveNewlines = false }: { preserveNewlines?: boolean } = {}): string => {
    if (!text) return '';
    const html = text
        .replace(/\|c([\da-fA-F]{2})([\da-fA-F]{6})(.*?)\|r/g,
            (_, alpha, color, inner) => `<span style="color:#${color}${alpha}">${inner}</span>`)
        .replace(/\|nc;(.*?)\|r/g,
            (_, inner) => `<span class="inv-nc">${inner}</span>`)
        .replace(/\|buffvar;(.*?)\|r/g,
            (_, inner) => `<span class="inv-buffvar">${inner}</span>`)
        .replace(/\|nn;(.*?)\|r/g,
            (_, inner) => `<span class="inv-nn">${inner}</span>`)
        .replace(/\|nd;(.*?)\|r/g,
            (_, inner) => `<span class="inv-nd">${inner}</span>`)
        .replace(/\|ni;(.*?)\|r/g,
            (_, inner) => `<span class="inv-ni">${inner}</span>`)
        .replace(/\|nr;(.*?)\|r/g,
            (_, inner) => `<span class="inv-nr">${inner}</span>`);

    return preserveNewlines ? html : html.replace(/\n/g, '<br/>');
};

export const hasVisibleTooltipText = (value: unknown): boolean => (
    String(value || '').replace(/\n|<br\s*\/?>/gi, '').trim().length > 0
);

export type DynamicTooltipFieldValue = string | number | boolean | null | Record<string, string | null | number | boolean>;

export interface DynamicTooltipKnownFields {
    grade?: string;
    name?: string;
    name_metaphone?: string;
    category_id?: string;
    level_requirement?: string;
    level_limit?: string;
    description?: string;
    refund?: string | null;
    gradable?: string;
    disenchantable?: string;
    grade_enchantable?: string;
    fixed_grade?: string;
    filename?: string;
    c_dps?: string;
    c_mdps?: string;
    c_hdps?: string;
    c_speed?: string;
    c_armor?: string;
    c_magic_resistance?: string;
    c_str?: string;
    c_dex?: string;
    c_sta?: string;
    c_int?: string;
    c_spi?: string;
    c_durability?: string;
    buff?: Record<string, string | null | number | boolean> | null;
    num_sockets?: string;
    dyeing?: string;
    equip_tooltip?: string;
    set_description?: string;
    cat_name?: string;
    grade_name?: string;
    grade_color?: string;
}

export type DynamicTooltipData = DynamicTooltipKnownFields & Record<string, DynamicTooltipFieldValue | undefined>;

export const cleanDynamicTooltipMarkup = (value: DynamicTooltipFieldValue | undefined): string | null => {
    if (value == null) return null;
    let result = String(value)
        .replace(/\\+"/g, '"')
        .replace(/\\+'/g, "'")
        .replace(/<br\s*\/?>\s*\n/gi, '<br/>')
        .replace(/^(?:\s|\n|<br\s*\/?>)+/gi, '')
        .replace(/(?:\s|\n|<br\s*\/?>)+$/gi, '');

    if (/<span\b[^>]*\bstyle\s*=/i.test(result)) {
        const template = document.createElement('template');
        template.innerHTML = result;

        for (const span of template.content.querySelectorAll<HTMLSpanElement>('span[style]')) {
            const color = span.style.borderBottomColor.toLowerCase().replace(/\s+/g, '');
            const colorClass = ({
                '#ff9c27': 'inv-nc',
                'rgb(255,156,39)': 'inv-nc',
                '#f5cb65': 'inv-nc',
                'rgb(245,203,101)': 'inv-nc',
                '#97d5f9': 'inv-nr',
                'rgb(151,213,249)': 'inv-nr',
            } as Record<string, string>)[color];
            if (span.style.borderBottomStyle !== 'dotted' || span.style.borderBottomWidth !== '1px' || !colorClass) continue;

            span.removeAttribute('style');
            span.className = colorClass;
        }

        result = template.innerHTML;
    }

    return result ? result : null;
};

export const stripHtmlForMatch = (value: unknown): string => (
    String(value || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
);


export const CODEX_ITEM_URL = 'https://archeagecodex.com/ru/item/';
export const CODEX_ITEM_ICONS = 'https://archeagecodex.com/items/';
export const GMRU_CDN_ICONS = 'https://aa.cdn.gmru.net/ms/data/game-icons/';
export const ICON_SEX_VALUES = {
    m: { title: 'Мужской', field: 'iconM' },
    f: { title: 'Женский', field: 'iconF' },
};

export const loadIconSex = (): string => {
    try {
        const sex = localStorage.getItem(LS_KEY_ICON_SEX);
        return sex && ICON_SEX_VALUES[sex as keyof typeof ICON_SEX_VALUES] ? sex : 'm';
    } catch {
        return 'm';
    }
};

export const saveIconSex = (sex: string): void => {
    try {
        if (ICON_SEX_VALUES[sex as keyof typeof ICON_SEX_VALUES]) {
            localStorage.setItem(LS_KEY_ICON_SEX, sex);
        } else {
            localStorage.removeItem(LS_KEY_ICON_SEX);
        }
    } catch {
        // ignore
    }
};

export const loadIconScalePercent = (): number => {
    try {
        const raw = localStorage.getItem(LS_KEY_ICON_SCALE);
        if (raw != null) {
            const val = parseInt(raw, 10);
            if (Number.isFinite(val) && val >= 10 && val <= 5000) return val;
        }
    } catch { /* ignore */ }
    return 100;
};

export const saveIconScalePercent = (val: number): void => {
    try {
        const intVal = Math.round(val);
        if (Number.isFinite(intVal) && intVal >= 10 && intVal <= 5000) {
            localStorage.setItem(LS_KEY_ICON_SCALE, String(intVal));
        } else {
            localStorage.removeItem(LS_KEY_ICON_SCALE);
        }
    } catch { /* ignore */ }
};

export const loadIconScaleBrowserZoom = (): boolean => {
    try { return localStorage.getItem(LS_KEY_ICON_SCALE_BROWSER_ZOOM) !== 'false'; }
    catch { return true; }
};

export const saveIconScaleBrowserZoom = (enabled: boolean): void => {
    try {
        if (enabled) localStorage.removeItem(LS_KEY_ICON_SCALE_BROWSER_ZOOM);
        else localStorage.setItem(LS_KEY_ICON_SCALE_BROWSER_ZOOM, 'false');
    } catch { /* ignore */ }
};

export const getItemIconUrlFromParts = (icon: string, iconM: string, iconF: string): string => {
    const sex = loadIconSex();
    const sexIcon = sex === 'm' ? iconM || iconF || 'm' : iconF || iconM || 'f';
    return sexIcon ? icon.replace(/\{sex\}/g, sexIcon) : icon;
};

export const getItemIconUrl = (item: ItemBase): string => (
    getItemIconUrlFromParts(item?.icon || '', item?.iconM || '', item?.iconF || '')
);

export const ITEMS: Record<number, ItemBase> = Object.fromEntries(([
    { id: 8256, icon: `${GMRU_CDN_ICONS}b855c7909baa6f5c5bd6b7dbfc08b865.png`, grade: 1, name: "Ткань" }, // icon_item_0356.png
    { id: 8318, icon: `${GMRU_CDN_ICONS}9d60cae3016a14b2cfc17a90de8e5f5b.png`, grade: 1, name: "Слиток железа" }, // icon_item_quest053.png
    { id: 8337, icon: `${GMRU_CDN_ICONS}92b1e189f64bc8a6b7edf2eb51c73890.png`, grade: 1, name: "Упаковка строительной древесины", vekselName: "Строительная древесина" }, // icon_item_0041.png
    { id: 16327, icon: `${GMRU_CDN_ICONS}c4952a5513632f33311717370ca55ca9.png`, grade: 1, name: "Сыромятная кожа" }, // icon_item_0352.png

    { id: 29207, overlay: 'unconfirmed', vekselType: 'sack', icon: `${GMRU_CDN_ICONS}3e86907901bff954369cc9ae307104f6.png`, grade: 1, name: "Туго набитый краденый кошелек" },
    { id: 32059, overlay: 'unconfirmed', vekselType: 'sack', icon: `${GMRU_CDN_ICONS}70a2b288662f4e1c5c1c812ad07f34f6.png`, grade: 1, name: "Мешочек с серебром" }, // icon_item_1839.png
    { id: 34915, overlay: 'unconfirmed', vekselType: 'sack', icon: `${GMRU_CDN_ICONS}70a2b288662f4e1c5c1c812ad07f34f6.png`, grade: 1, name: "Тяжелый мешочек с серебром" },
    { id: 34916, overlay: 'unconfirmed', vekselType: 'sack', icon: `${GMRU_CDN_ICONS}70a2b288662f4e1c5c1c812ad07f34f6.png`, grade: 1, name: "Увесистый мешочек с серебром" },
    { id: 35461, overlay: 'unconfirmed', vekselType: 'sack', icon: `${GMRU_CDN_ICONS}70a2b288662f4e1c5c1c812ad07f34f6.png`, grade: 1, name: "Полновесный мешочек с серебром" },
    { id: 40928, overlay: 'unconfirmed', vekselType: 'sack', icon: `${GMRU_CDN_ICONS}d9df620283926e6f4a9ab47ebacf499c.png`, grade: 1, name: "Расшитый жемчугом кошелёк" }, // icon_item_3101.png
    { id: 42076, overlay: 'unconfirmed', vekselType: 'archive', icon: `${GMRU_CDN_ICONS}66ed119fca00abf78ddf2602ed55e659.png`, grade: 1, name: "Резной сундучок со всякой всячиной" }, // icon_item_3619.png
    { id: 42077, overlay: 'unconfirmed', vekselType: 'archive', icon: `${GMRU_CDN_ICONS}1ddc9b8c6e0d41d83f2d3f9536eb29a4.png`, grade: 1, name: "Фермерский сундучок со всякой всячиной" }, // icon_item_3620.png
    { id: 43176, overlay: 'unconfirmed', vekselType: 'sack', icon: `${GMRU_CDN_ICONS}b41e79b64ae0b578499ac6301325f631.png`, grade: 1, name: "Котомка эфенского странника" }, // icon_item_3906.png
    { id: 43177, overlay: 'unconfirmed', vekselType: 'archive', icon: `${GMRU_CDN_ICONS}f2d17e3b4d030e91c38e68cd60c0ee69.png`, grade: 1, name: "Эфенский сундучок со всякой всячиной" }, // icon_item_3907.png
    
    { id: 8000753, overlay: 'quest_y', icon: `${GMRU_CDN_ICONS}8139603ac380eaa7a6a9f7a0c331a607.png`, grade: 2, name: "Лицензия на убийство: повелитель подземелья" }, // icon_item_2762.png
    { id: 8000749, overlay: 'quest_y', icon: `${GMRU_CDN_ICONS}8139603ac380eaa7a6a9f7a0c331a607.png`, grade: 3, name: "Лицензия на убийство: Баррага Безумный" },
    { id: 8000750, overlay: 'quest_y', icon: `${GMRU_CDN_ICONS}8139603ac380eaa7a6a9f7a0c331a607.png`, grade: 4, name: "Лицензия на убийство: Даута" },
    { id: 8000751, overlay: 'quest_y', icon: `${GMRU_CDN_ICONS}8139603ac380eaa7a6a9f7a0c331a607.png`, grade: 5, name: "Лицензия на убийство: иферийцы" },
    { id: 8000752, overlay: 'quest_y', icon: `${GMRU_CDN_ICONS}8139603ac380eaa7a6a9f7a0c331a607.png`, grade: 6, name: "Лицензия на убийство: Иштар" },
    { id: 54615, overlay: 'quest_cash', icon: `${GMRU_CDN_ICONS}5c0da4536b0d2abe8a70a119562338f7.png`, grade: 3, name: "Разрешение на работу: билет в один конец" },

    { id: 44829, overlay: 'quest_y', icon: `${GMRU_CDN_ICONS}e1cae56dca548c5324aa52004df78667.png`, grade: 4, name: "Шепчущий камень" },

    { id: 48893, icon: 'https://archeagecodex.com/items/icon_item_4819.png', grade: 10, name: 'Драгоценная эфенская сфера оружейника' },
    { id: 48894, icon: 'https://archeagecodex.com/items/icon_item_4820.png', grade: 10, name: 'Драгоценная эфенская сфера бронника' },
    { id: 54915, icon: 'https://archeagecodex.com/items/icon_item_1695.png', grade: 1, name: 'Свиток чар ифнирского героя' },
    { id: 45508, icon: 'https://archeagecodex.com/items/icon_item_4212.png', grade: 2, name: 'Сфера анимага' },
    { id: 8001565, icon: 'https://archeagecodex.com/items/icon_item_3628.png', grade: 1, name: 'Новенькая кирка' },
    { id: 8002452, overlay: 'unconfirmed', icon: 'https://archeagecodex.com/items/icon_item_3349.png', grade: 1, name: 'Универсальный алхимический кристалл' },
    { id: 8002449, icon: 'https://archeagecodex.com/items/charge_wider.png', grade: 1, name: 'Дополнительная сумка' },
    { id: 47943, icon: 'https://archeagecodex.com/items/icon_item_4710.png', grade: 1, name: 'Настойка усердного ремесленника' },
    { id: 39424, icon: 'https://archeagecodex.com/items/icon_item_3017.png', grade: 1, name: 'Ирамийская гадальная руна' },
    { id: 46180, icon: 'https://archeagecodex.com/items/icon_item_1395.png', grade: 3, name: 'Солнечный настой' },
    { id: 47130, type: 'unidentified', overlay: 'unconfirmed', icon: 'https://archeagecodex.com/items/icon_item_2679.png', grade: 6, name: 'Хрустальная руна' },
    { id: 47104, icon: 'https://archeagecodex.com/items/icon_item_4570.png', grade: 2, name: 'Парниковый купол' },
    { id: 48903, icon: 'https://archeagecodex.com/items/icon_item_3282.png', grade: 1, name: 'Набор сверкающих эфенских сфер' },
    { id: 48474, icon: 'https://archeagecodex.com/items/icon_item_3275.png', grade: 11, name: 'Большой набор мифических эссенций' },
    { id: 35727, icon: 'https://archeagecodex.com/items/icon_item_1982.png', grade: 2, name: 'Буровая установка' },
    { id: 47082, icon: 'https://archeagecodex.com/items/icon_item_3369.png', grade: 1, name: 'Патент на транспортное средство' },
    { id: 31892, icon: 'https://archeagecodex.com/items/icon_item_1733.png', grade: 1, name: 'Земельный вексель' },
    { id: 55722, icon: 'https://archeagecodex.com/items/icon_item_5864.png', grade: 4, name: 'Искусная цитриновая гравировка' },
    { id: 48885, icon: `${GMRU_CDN_ICONS}aa37ed77de192687a78947c34a0a29be.png`, grade: 8, name: 'Сверкающая эфенская сфера оружейника' },
    { id: 48886, icon: 'https://archeagecodex.com/items/icon_item_4818.png', grade: 8, name: 'Сверкающая эфенская сфера бронника' },
    { id: 55723, icon: 'https://archeagecodex.com/items/icon_item_5865.png', grade: 4, name: 'Искусная аквамариновая гравировка' },
    { id: 45747, icon: 'https://archeagecodex.com/items/icon_item_4385.png', grade: 5, name: 'Драгоценный флакон с зельем охотника' },
    { id: 49270, icon: 'https://archeagecodex.com/items/icon_item_2273.png', grade: 5, name: 'Набор больших эфенских кубов' },
    { id: 45160, icon: 'https://archeagecodex.com/items/icon_item_2376.png', grade: 4, name: 'Настойка спорыньи' },
    { id: 46623, icon: 'https://archeagecodex.com/items/icon_item_0986.png', grade: 4, name: 'Настойка остролиста', buff: { duration: 1800 } },
    { id: 8001268, icon: 'https://archeagecodex.com/items/icon_item_1986.png', grade: 1, name: 'Свиток дельфийской библиотеки', buff: { duration: 3600 } },
    { id: 8001169, icon: 'https://archeagecodex.com/items/icon_item_1986.png', grade: 1, name: 'Свиток опыта V', buff: { duration: 3600 }, isPersonal: true },
    { id: 8001172, icon: 'https://archeagecodex.com/items/icon_item_1986.png', grade: 1, name: 'Свиток опыта VIII', buff: { duration: 3600 }, isPersonal: true },
    { id: 46181, icon: 'https://archeagecodex.com/items/icon_item_1396.png', grade: 3, name: 'Лунный настой' },
    { id: 48546, icon: 'https://archeagecodex.com/items/icon_item_3595.png', grade: 1, name: 'Письмена войны' },
    { id: 47655, icon: 'https://archeagecodex.com/items/icon_item_4709.png', grade: 4, name: 'Фиона Розовый Лепесток' },
    { id: 47581, icon: 'https://archeagecodex.com/items/icon_item_4211.png', grade: 3, name: 'Лиловое эмалевое стекло' },
    { id: 47479, icon: 'https://archeagecodex.com/items/icon_item_3519.png', grade: 1, name: 'Инкрустированный флакон с целебным эликсиром' },
    { id: 47480, icon: 'https://archeagecodex.com/items/icon_item_3520.png', grade: 1, name: 'Инкрустированный флакон с эликсиром маны' },
    { id: 8002996, icon: 'https://archeagecodex.com/items/icon_item_6002.png', grade: 1, name: 'Осколок предела', price: 100 },
    { id: 8003072, icon: 'https://archeagecodex.com/items/icon_item_6002.png', grade: 1, name: 'Осколок предела' },
    { id: 8001288, icon: 'https://archeagecodex.com/items/icon_item_0966.png', grade: 1, name: 'Цитрусовая карамелька', buff: { duration: 3600 } },
    { id: 8002649, icon: 'https://archeagecodex.com/items/icon_item_3259.png', grade: 4, name: 'Набор неверинских фейерверков' },
    { id: 8000540, icon: 'https://archeagecodex.com/items/icon_item_3207.png', grade: 1, name: 'Пушистая неверинская елочка' },
    { id: 49769, icon: 'https://archeagecodex.com/items/icon_item_4950.png', grade: 6, name: 'Зачарованный свиток пробуждения хранителя знаний' },
    { id: 54653, icon: 'https://archeagecodex.com/items/icon_item_5043.png', grade: 12, name: 'Сундук с обновленным рамианским снаряжением' },
    { id: 53515, icon: 'https://archeagecodex.com/items/icon_item_5266.png', grade: 2, isPersonal: true, price: 0, reqLevel: 1, name: 'Заговоренная рамианская руна' },
    { id: 52207, icon: 'https://archeagecodex.com/items/icon_item_3022.png', grade: 1, name: 'Мешочек с микстурами' },
    { id: 51239, icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 11, name: 'Сундук с изначальным рамианским оружием эпохи мифов' },
    { id: 51240, icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 12, name: 'Сундук с изначальным рамианским оружием эпохи Двенадцати' },
    { id: 54654, icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 12, name: 'Сундук с обновленным рамианским оружием эпохи Двенадцати' },
    { id: 54655, icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 11, name: 'Сундук с обновленными рамианскими доспехами эпохи мифов' },
    { id: 47941, icon: 'https://archeagecodex.com/items/x_mas_gift.png', grade: 10, name: 'Сундук с оружием Библиотеки Эрнарда эпохи легенд' },
    { id: 51243, icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 12, name: 'Сундук с магистерским эрнардским оружием эпохи Двенадцати' },
    { id: 55501, icon: 'https://archeagecodex.com/items/icon_item_5850.png', grade: 6, name: 'Сундучок с легендарным украшением ифнирского героя' },
    { id: 51940, icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 8, name: 'Сундучок с ценным украшением эпохи чудес' },
    { id: 51236, icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 11, name: 'Сундучок с драгоценным украшением эпохи мифов' },
    { id: 55783, icon: 'https://archeagecodex.com/items/icon_item_2992.png', grade: 5, name: 'Сундучок с зачарованной гравировкой для украшений' },
    { id: 50924, icon: 'https://archeagecodex.com/items/costume_hm/nu_m_hm_cloth248.png', grade: 2, name: 'Дизайн широкополой шляпы стрелка' },
    { id: 50925, icon: 'https://archeagecodex.com/items/costume_hm/nu_{sex}_hm_cloth519.png', grade: 2, name: 'Дизайн соломенной шляпы' },
    { id: 8002486, icon: 'https://archeagecodex.com/items/costume_set/nu_{sex}_sk_korean006.png', grade: 1, name: 'Дизайн костюма хоури эпохи Фарвати' },
    { id: 51092, icon: 'https://archeagecodex.com/items/costume_set/nu_{sex}_sk_uniform004.png', grade: 2, name: 'Дизайн одеяния правителя северного Мейра' },
    { id: 129, icon: `${GMRU_CDN_ICONS}3afe6571286a8a3f3cfab503f4bb8b00.png`, grade: 1, name: 'Дельфийская руна', reqLevel: 50 },
    { id: 8003128, icon: `${GMRU_CDN_ICONS}3afe6571286a8a3f3cfab503f4bb8b00.png`, grade: 10, name: 'Дельфийская руна эпохи легенд', reqLevel: 91 },
    { id: 55280, icon: 'https://archeagecodex.com/items/icon_item_2812.png', grade: 6, name: 'Легендарная руна ифнирского героя' },
    { id: 55683, icon: 'https://archeagecodex.com/items/icon_item_4527.png', grade: 1, name: 'Мешочек с магистериями для украшений' },
    { id: 50536, icon: 'https://archeagecodex.com/items/icon_item_4527.png', grade: 1, name: 'Мешочек с магистериями' },
    { id: 8001148, icon: 'https://archeagecodex.com/items/icon_item_3807.png', grade: 2, name: 'Статуя «Орхидна на троне»' },
    { id: 8001203, icon: 'https://archeagecodex.com/items/icon_item_3277.png', grade: 1, name: 'Сундучок с фамильными ценностями' },
    { id: 54933, icon: 'https://archeagecodex.com/items/icon_item_5809.png', grade: 2, name: 'Замерзший пруд' },
    { id: 48860, icon: 'https://archeagecodex.com/items/icon_item_4002.png', grade: 6, name: 'Большая эфенская сфера оружейника' },
    { id: 48861, icon: 'https://archeagecodex.com/items/icon_item_4816.png', grade: 6, name: 'Большая эфенская сфера бронника' },
    { id: 44359, icon: 'https://archeagecodex.com/items/icon_item_3559.png', grade: 1, name: 'Походный фиал славы' },
    { id: 32490, icon: 'https://archeagecodex.com/items/icon_item_1333.png', grade: 9, name: 'Сверкающий фиал с эликсиром чести' },
    { id: 55800, icon: 'https://archeagecodex.com/items/icon_item_5486.png', grade: 4, name: 'Сундучок с фрагментами судьбы' },
    { id: 8002772, icon: 'https://archeagecodex.com/items/icon_item_5043.png', grade: 5, name: 'Окованный сталью ящик с боевым питомцем' },
    { id: 50635, icon: 'https://archeagecodex.com/items/icon_item_5058.png', grade: 2, isPersonal: true, name: 'Заговоренная гадальная руна' },
    { id: 8002769, icon: 'https://archeagecodex.com/items/quest/icon_item_quest217.png', grade: 3, isPersonal: true, name: 'Знак «Ключевая фигура»' },
    { id: 28813, icon: 'https://archeagecodex.com/items/icon_item_1319.png', grade: 5, name: 'Монеты дару x85' },
    { id: 30604, icon: 'https://archeagecodex.com/items/icon_item_1643.png', grade: 5, name: 'Монеты дару x100' },
    { id: 28814, icon: 'https://archeagecodex.com/items/icon_item_1643.png', grade: 5, name: 'Монеты дару x180' },
    { id: 30605, icon: 'https://archeagecodex.com/items/icon_item_1643.png', grade: 5, name: 'Монеты дару x280' },
    { id: 55450, icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 7, name: 'Реликвийное кольцо ифнирского героя' },
    { id: 8002410, subType: 'cloak', icon: 'https://archeagecodex.com/items/icon_item_0936.png', grade: 5, name: 'Алый шарф', isEquipDescriptionTemporary: true },
    { id: 34684, subType: 'windInstrument', icon: 'https://archeagecodex.com/items/icon_item_ins_s_0051.png', name: 'Укрепленная аргенитовая лютня' },
    { id: 34685, subType: 'windInstrument', icon: 'https://archeagecodex.com/items/icon_item_ins_w_0025.png', name: 'Укрепленный аргенитовый кларнет' },
    { id: 417, icon: 'https://archeagecodex.com/items/icon_item_0418.png', grade: 1, name: 'Редкий камень странствий', isPersonal: true, price: 0, reqLevel: 1 },
    { id: 52701, icon: 'https://archeagecodex.com/items/icon_item_5282.png', grade: 1, name: 'Кристалл изначального анадия', price: 0 },
    { id: 40491, icon: 'https://archeagecodex.com/items/icon_item_3090.png', grade: 2, name: 'Знак отваги' },
    { id: 46695, icon: 'https://archeagecodex.com/items/icon_item_4557.png', grade: 3, name: 'Белоснежный олененок' },
    { id: 48521, icon: 'https://archeagecodex.com/items/icon_item_2070.png', grade: 5, name: 'Большой эфенский куб оружейника' },
    { id: 48522, icon: 'https://archeagecodex.com/items/icon_item_2069.png', grade: 5, name: 'Большой эфенский куб бронника' },
    { id: 8002273, icon: 'https://archeagecodex.com/items/icon_item_1668.png', grade: 1, name: 'Набор анимага' },
    { id: 8002483, icon: 'https://archeagecodex.com/items/icon_item_3261.png', grade: 1, name: 'Коробка с бельем «Ночи Аль-Харбы»' },
    { id: 45409, overlay: 'unconfirmed', icon: 'https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_cloth292.png', grade: 2, name: 'Рамианское матерчатое снаряжение' },
    { id: 53586, icon: 'https://archeagecodex.com/items/icon_item_5144.png', grade: 4, name: 'Золотой сундучок со знаками культистов' },
    { id: 46151, icon: 'https://archeagecodex.com/items/icon_item_4467.png', grade: 3, name: 'Заготовка огранщика', isPersonal: true },
    { id: 49252, icon: 'https://archeagecodex.com/items/icon_item_4878.png', grade: 2, name: 'Образцы флоры Сада', isPersonal: true, price: 0, description: 'Пакетик с образцами флоры Сада Матери.' },
    { id: 31151, icon: 'https://archeagecodex.com/items/x_mas_gift.png', grade: 1, name: 'Перевязанный ленточкой подарок', isPersonal: true, price: 0 },
    { id: 28188, icon: `${GMRU_CDN_ICONS}d2f377e3c3118826089a2caf9e794a50.png`, grade: 3, name: 'Сплав стихий', isPersonal: true, price: 360 },
    { id: 55516, icon: 'https://archeagecodex.com/items/icon_item_2812.png', grade: 5, name: 'Эпическая руна ифнирского героя', isPersonal: true },
    { id: 55490, icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 8, name: 'Серьга ифнирского героя эпохи чудес', isPersonal: true },
    { id: 55255, icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 7, name: 'Реликвийная серьга ифнирского героя', isPersonal: true },
    { id: 52808, overlay: 'unconfirmed', icon: 'https://archeagecodex.com/items/icon_item_teleport.png', grade: 1, name: 'Книга порталов (7 д.)', isPersonal: true },
    { id: 34702, subType: 'windInstrument', icon: 'https://archeagecodex.com/items/icon_item_ins_w_0049.png', name: 'Зеркальный аргенитовый кларнет', buff: { avgRestoreMana: 16 } },
    { id: 51723, icon: 'https://archeagecodex.com/items/icon_item_5149.png', grade: 4, name: 'Ящик с Мару, покорителем просторов', isPersonal: true },
    { id: 8002771, icon: 'https://archeagecodex.com/items/icon_item_5043.png', grade: 5, name: 'Окованный сталью ящик с глайдером', isPersonal: true },
    { id: 39363, icon: 'https://archeagecodex.com/items/icon_item_2275.png', grade: 1, name: 'Осенний Лоскутик' },
    { id: 34972, icon: 'https://archeagecodex.com/items/doll_pet_hm_001.png', grade: 1, name: 'Красные очки-сердечки' },
    { id: 34975, icon: 'https://archeagecodex.com/items/doll_pet_bo_001.png', grade: 1, name: 'Кулинарные перчатки в красный горошек' },
    { id: 36183, icon: 'https://archeagecodex.com/items/doll_pet_ar_007.png', grade: 1, name: 'Красный заводной ключик' },
    { id: 34981, icon: 'https://archeagecodex.com/items/icon_item_2720.png', grade: 1, name: 'Детеныш Гартарейн' },
    { id: 37018, icon: 'https://archeagecodex.com/items/costume_hm/nu_m_hm_cloth560.png', grade: 3, name: 'Вязаная шапочка' },
    { id: 49630, icon: 'https://archeagecodex.com/items/icon_item_4862.png', grade: 5, name: 'Статуэтка «Аранзеб»' },
    { id: 31787, icon: 'https://archeagecodex.com/items/costume_hm/nu_m_hm_cloth550.png', grade: 3, name: 'Ободок со снеговичками' },
    { id: 28242, icon: 'https://archeagecodex.com/items/icon_item_1243.png', grade: 1, name: 'Мыло' },
    { id: 43298, icon: 'https://archeagecodex.com/items/icon_item_3952.png', grade: 1, name: 'Теневой делец' },
    { id: 8002004, icon: 'https://archeagecodex.com/items/icon_item_2774.png', grade: 1, name: 'Призрачный конь (30 д.)' },
    { id: 8000315, icon: 'https://archeagecodex.com/items/costume_cp/nu_f_cp_leather002.png', grade: 1, name: 'Накидка из грифоньих перьев' },
    { id: 8000127, subType: 'costume', icon: 'https://archeagecodex.com/items/costume_set/nu_f_sk_party001.png', grade: 2, name: 'Бальный наряд Двух Корон' },
    { id: 55495, icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 9, name: 'Кольцо ифнирского героя эпохи сказаний' },

    { id: 33156, type: 'equipment', icon: 'https://archeagecodex.com/items/costume_hm/nu_m_hm_cloth554.png', name: 'Вишневая шляпа-торт' },

    { id: 45373, icon: 'https://archeagecodex.com/items/icon_item_4353.png', grade: 2, name: 'Фонтан «Лесная гармония»' },
    { id: 8000346, icon: 'https://archeagecodex.com/items/icon_item_1360.png', grade: 2, name: 'Белая субмарина', searchName: 'Белая субмарина (30 д.)' },
    { id: 8000309, icon: 'https://archeagecodex.com/items/icon_item_1502.png', grade: 3, name: 'Цирковой медведь', searchName: 'Цирковой медведь (на 30 дней)' },
    { id: 31878, icon: 'https://archeagecodex.com/items/icon_item_1670.png', grade: 2, name: 'Неверинский патефон' },
    { id: 8002069, icon: 'https://archeagecodex.com/items/icon_item_moonstone05.png', grade: 1, name: 'Дар жрицы Нуи' },
    { id: 39551, icon: 'https://archeagecodex.com/items/icon_item_2847.png', grade: 2, name: 'Песчаная скульптура Победы' },
    { id: 8000310, icon: 'https://archeagecodex.com/items/icon_item_2979.png', grade: 1, name: 'Жетон на покупку оружия' },
    { id: 8000311, icon: 'https://archeagecodex.com/items/icon_item_2980.png', grade: 1, name: 'Жетон на покупку доспехов' },
    { id: 8000441, icon: 'https://archeagecodex.com/items/icon_item_2993.png', grade: 1, name: 'Иферийская монетка' },
    { id: 8000442, icon: 'https://archeagecodex.com/items/icon_item_2982.png', grade: 1, name: 'Заколдованная монетка' },

    { id: 8000314, icon: 'https://archeagecodex.com/items/icon_item_2993.png', grade: 1, name: 'Зачарованная монетка' },
    { id: 8001157, icon: 'https://archeagecodex.com/items/icon_item_2861.png', grade: 1, name: 'Зачарованная монетка' },

    { id: 8002645, icon: 'https://archeagecodex.com/items/icon_item_1683.png', grade: 1, name: 'Фейерверк «Шар»' },
    { id: 8000528, icon: 'https://archeagecodex.com/items/icon_item_3196.png', grade: 1, name: 'Неверинский венок' },
    { id: 45320, icon: 'https://archeagecodex.com/items/icon_item_4350.png', grade: 1, name: 'Арфа «Песнь моря»', searchName: 'Арфа морской богини' },
    { id: 8000372, icon: 'https://archeagecodex.com/items/icon_house_023.png', grade: 1, name: 'Спецпроект: беленый нуианский дом с синей черепичной крышей' },
    { id: 31584, icon: 'https://archeagecodex.com/items/icon_item_2523.png', grade: 1, name: 'Неверинский фейерверк', searchName: 'Праздничный салют' },
    { id: 35225, icon: 'https://archeagecodex.com/items/costume_hm/nu_m_hm_cloth556.png', grade: 2, name: 'Ободок футбольного болельщика', searchName: 'Заколка в виде футбольного мяча' },
    { id: 27747, icon: 'https://archeagecodex.com/items/icon_item_0966.png', grade: 1, name: 'Мятный леденец', searchName: 'Пробуждающая конфета' },
    { id: 46701, icon: 'https://archeagecodex.com/items/icon_item_4563.png', grade: 3, name: 'Снежный кабаненок' },

    { id: 45880, icon: 'https://archeagecodex.com/items/costume_hm/nu_{sex}_hm_cloth295.png', name: 'Диадема эрнардского мнемоника', isPersonal: true },
    { id: 45881, icon: 'https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_cloth295.png', name: 'Матерчатый камзол эрнардского мнемоника', isPersonal: true },
    { id: 45882, icon: 'https://archeagecodex.com/items/costume_pt/nu_{sex}_pt_cloth295.png', name: 'Матерчатые поножи эрнардского мнемоника', isPersonal: true },
    { id: 45883, icon: 'https://archeagecodex.com/items/costume_gv/nu_m_gv_cloth295.png', name: 'Матерчатые перчатки эрнардского мнемоника', isPersonal: true },
    { id: 45884, icon: 'https://archeagecodex.com/items/costume_bo/nu_{sex}_bo_cloth295.png', name: 'Матерчатые сапоги эрнардского мнемоника', isPersonal: true },
    { id: 45885, icon: 'https://archeagecodex.com/items/icon_item_arm_cloth_0020.png', name: 'Матерчатые наручи эрнардского мнемоника', isPersonal: true },
    { id: 45886, icon: 'https://archeagecodex.com/items/icon_item_belt_cloth_0021.png', name: 'Матерчатый пояс эрнардского мнемоника', isPersonal: true },

    { id: 45991, icon: 'https://archeagecodex.com/items/costume_hm/nu_{sex}_hm_cloth295.png', name: 'Диадема смотрителя тайных архивов', isPersonal: true },
    { id: 45990, icon: 'https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_cloth295.png', name: 'Матерчатый камзол смотрителя тайных архивов', isPersonal: true },
    { id: 45989, icon: 'https://archeagecodex.com/items/costume_pt/nu_{sex}_pt_cloth295.png', name: 'Матерчатые поножи смотрителя тайных архивов', isPersonal: true },
    { id: 45988, icon: 'https://archeagecodex.com/items/costume_gv/nu_m_gv_cloth295.png', name: 'Матерчатые перчатки смотрителя тайных архивов', isPersonal: true },
    { id: 45987, icon: 'https://archeagecodex.com/items/costume_bo/nu_{sex}_bo_cloth295.png', name: 'Матерчатые сапоги смотрителя тайных архивов', isPersonal: true },
    { id: 45986, icon: 'https://archeagecodex.com/items/icon_item_arm_cloth_0020.png', name: 'Матерчатые наручи смотрителя тайных архивов', isPersonal: true },
    { id: 45985, icon: 'https://archeagecodex.com/items/icon_item_belt_cloth_0021.png', name: 'Матерчатый пояс смотрителя тайных архивов', isPersonal: true },

    { id: 45887, icon: 'https://archeagecodex.com/items/costume_hm/nu_{sex}_hm_leather295.png', name: 'Фибула заклинателя гримуаров', isPersonal: true },
    { id: 45888, icon: 'https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_leather295.png', name: 'Кожаная куртка заклинателя гримуаров', isPersonal: true },
    { id: 45889, icon: 'https://archeagecodex.com/items/costume_pt/nu_{sex}_pt_leather295.png', name: 'Кожаные поножи заклинателя гримуаров', isPersonal: true },
    { id: 45890, icon: 'https://archeagecodex.com/items/costume_gv/nu_m_gv_leather295.png', name: 'Кожаные перчатки заклинателя гримуаров', isPersonal: true },
    { id: 47047, icon: 'https://archeagecodex.com/items/costume_bo/nu_{sex}_bo_leather295.png', name: 'Кожаные сапоги заклинателя гримуаров', isPersonal: true },
    { id: 47048, icon: 'https://archeagecodex.com/items/icon_item_arm_leather_0020.png', name: 'Кожаные наручи заклинателя гримуаров', isPersonal: true },
    { id: 47049, icon: 'https://archeagecodex.com/items/icon_item_belt_leather_0021.png', name: 'Кожаный пояс заклинателя гримуаров', isPersonal: true },

    { id: 47043, icon: 'https://archeagecodex.com/items/costume_hm/nu_{sex}_hm_leather295.png', name: 'Фибула укротителя гримуаров', isPersonal: true },
    { id: 47044, icon: 'https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_leather295.png', name: 'Кожаная куртка укротителя гримуаров', isPersonal: true },
    { id: 47045, icon: 'https://archeagecodex.com/items/costume_pt/nu_{sex}_pt_leather295.png', name: 'Кожаные поножи укротителя гримуаров', isPersonal: true },
    { id: 47046, icon: 'https://archeagecodex.com/items/costume_gv/nu_m_gv_leather295.png', name: 'Кожаные перчатки укротителя гримуаров', isPersonal: true },
    { id: 45891, icon: 'https://archeagecodex.com/items/costume_bo/nu_{sex}_bo_leather295.png', name: 'Кожаные сапоги укротителя гримуаров', isPersonal: true },
    { id: 45892, icon: 'https://archeagecodex.com/items/icon_item_arm_leather_0020.png', name: 'Кожаные наручи укротителя гримуаров', isPersonal: true },
    { id: 45893, icon: 'https://archeagecodex.com/items/icon_item_belt_leather_0021.png', name: 'Кожаный пояс укротителя гримуаров', isPersonal: true },

    { id: 45894, icon: 'https://archeagecodex.com/items/costume_hm/nu_m_hm_metal295.png', name: 'Латный шлем эрнардского архивариуса', isPersonal: true },
    { id: 45895, icon: 'https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_metal295.png', name: 'Латный нагрудник эрнардского архивариуса', isPersonal: true },
    { id: 45896, icon: 'https://archeagecodex.com/items/costume_pt/nu_{sex}_pt_metal295.png', name: 'Латные поножи эрнардского архивариуса', isPersonal: true },
    { id: 45897, icon: 'https://archeagecodex.com/items/costume_gv/nu_m_gv_metal295.png', name: 'Латные перчатки эрнардского архивариуса', isPersonal: true },
    { id: 45898, icon: 'https://archeagecodex.com/items/costume_bo/nu_{sex}_bo_metal295.png', name: 'Латные сапоги эрнардского архивариуса', isPersonal: true },
    { id: 45899, icon: 'https://archeagecodex.com/items/icon_item_arm_metal_0020.png', name: 'Латные наручи эрнардского архивариуса', isPersonal: true },
    { id: 45900, icon: 'https://archeagecodex.com/items/icon_item_belt_metal_0021.png', name: 'Латный пояс эрнардского архивариуса', isPersonal: true },

    { id: 53522, icon: 'https://archeagecodex.com/items/quest/icon_item_quest169.png', grade: 2, name: 'Большой сундук Кириоса', isPersonal: true },
    { id: 55367, icon: 'https://archeagecodex.com/items/icon_item_1482.png', grade: 9, name: 'Ларец со свитками пробуждения 3 ранга' },
    { id: 8000926, icon: 'https://archeagecodex.com/items/icon_item_3368.png', grade: 1, name: '[1 день] Покровительство Сиоль' },
    { id: 8000927, icon: 'https://archeagecodex.com/items/icon_item_3368.png', grade: 1, name: '[7 дней] Покровительство Сиоль' },
    { id: 51922, icon: 'https://archeagecodex.com/items/icon_item_4413.png', grade: 2, name: 'Корзинка с жетоном' },
    { id: 33382, icon: 'https://archeagecodex.com/items/icon_item_0843.png', grade: 1, name: 'Бутыль с имбирным напитком' },
    { id: 8003057, icon: 'https://archeagecodex.com/items/icon_item_6009.png', grade: 2, name: 'Мимолетное благословение предела' },

    { id: 56010, icon: benedictIcon, grade: 4, name: 'Бенедикт' },

    { icon: rudolfBoxIcon, grade: 1, name: 'Ящик с Рудольфом' },

    { id: 49188, icon: 'https://archeagecodex.com/items/icon_item_4833.png', grade: 2, name: 'Премиум-подписка на 7 дней' },

    { id: 52018, icon: 'https://archeagecodex.com/items/icon_item_1829.png', grade: 3, name: 'Рубиновый эликсир' },
    { id: 50914, icon: 'https://archeagecodex.com/items/icon_item_1829.png', grade: 8, name: 'Рубиновый эликсир' },
    { id: 8002774, icon: 'https://archeagecodex.com/items/icon_item_1829.png', grade: 11, name: 'Рубиновый эликсир' },
    { id: 42308, icon: 'https://archeagecodex.com/items/icon_item_3627.png', grade: 1, name: 'Добротная кирка' },
    { id: 55760, icon: 'https://archeagecodex.com/items/icon_item_5888.png', grade: 5, name: 'Эссенция судьбы' },

    { id: 45603, overlay: 'seal_02', icon: 'https://aa.cdn.gmru.net/ms/data/game-icons/1f2e5e445d5172f8eab7c09aa9a329d3.png', grade: 2, name: 'Обработанный лунный камень' },
    { id: 45604, overlay: 'seal_03', icon: 'https://archeagecodex.com/items/icon_item_0829.png', grade: 3, name: 'Ограненный лунный камень' },
    { id: 45605, overlay: 'seal_03', icon: 'https://aa.cdn.gmru.net/ms/data/game-icons/44a345e910536ca21b3fcb5151b4773a.png', grade: 3, name: 'Лунная звезда' },
    { id: 45606, overlay: 'seal_04', icon: 'https://aa.cdn.gmru.net/ms/data/game-icons/3178140baf3cdb49fc1b07204f80b9db.png', grade: 4, name: 'Сияющая лунная звезда' },
    { id: 8002297, overlay: 'seal_08', icon: 'https://archeagecodex.com/items/icon_item_2267.png', grade: 3, name: 'Королевский лунный изумруд' },

    { id: 1, type: '', icon: '', grade: 1, name: '' },
] as ItemBase[]).map(i => [i.id, i])) as Record<number, ItemBase>;

export const getItemCodexUrl = (item: ItemBase): string => (
    `${CODEX_ITEM_URL}${item.id}/${item.isGradeInferred ? `?grade=${item.grade}` : ''}`
);
