// Data and item utilities extracted from ArcheAgeExtraUI.user.js.

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
    'seal':        { icon: 'https://archeagecodex.com/items/top_seal_08.png' },
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
    name: string;
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
    { id: 8256, type: 'material', subType: 'cloth', icon: `${GMRU_CDN_ICONS}b855c7909baa6f5c5bd6b7dbfc08b865.png`, grade: 1, name: "Ткань" }, // icon_item_0356.png
    { id: 8318, type: 'material', subType: 'ingot', icon: `${GMRU_CDN_ICONS}9d60cae3016a14b2cfc17a90de8e5f5b.png`, grade: 1, name: "Слиток железа" }, // icon_item_quest053.png
    { id: 8337, type: 'material', subType: 'lumber', icon: `${GMRU_CDN_ICONS}92b1e189f64bc8a6b7edf2eb51c73890.png`, grade: 1, name: "Упаковка строительной древесины", vekselName: "Строительная древесина" }, // icon_item_0041.png
    { id: 16327, type: 'material', subType: 'leather', icon: `${GMRU_CDN_ICONS}c4952a5513632f33311717370ca55ca9.png`, grade: 1, name: "Сыромятная кожа" }, // icon_item_0352.png
    { id: 35461, type: 'unidentified', overlay: 'unconfirmed', vekselType: 'sack', icon: `${GMRU_CDN_ICONS}70a2b288662f4e1c5c1c812ad07f34f6.png`, grade: 1, name: "Полновесный мешочек с серебром" }, // icon_item_1839.png
    { id: 40928, type: 'unidentified', overlay: 'unconfirmed', vekselType: 'sack', icon: `${GMRU_CDN_ICONS}d9df620283926e6f4a9ab47ebacf499c.png`, grade: 1, name: "Расшитый жемчугом кошелёк" }, // icon_item_3101.png
    { id: 42076, type: 'unidentified', overlay: 'unconfirmed', vekselType: 'archive', icon: `${GMRU_CDN_ICONS}66ed119fca00abf78ddf2602ed55e659.png`, grade: 1, name: "Резной сундучок со всякой всячиной" }, // icon_item_3619.png
    { id: 42077, type: 'unidentified', overlay: 'unconfirmed', vekselType: 'archive', icon: `${GMRU_CDN_ICONS}1ddc9b8c6e0d41d83f2d3f9536eb29a4.png`, grade: 1, name: "Фермерский сундучок со всякой всячиной" }, // icon_item_3620.png
    { id: 43176, type: 'unidentified', overlay: 'unconfirmed', vekselType: 'sack', icon: `${GMRU_CDN_ICONS}b41e79b64ae0b578499ac6301325f631.png`, grade: 1, name: "Котомка эфенского странника" }, // icon_item_3906.png
    { id: 43177, type: 'unidentified', overlay: 'unconfirmed', vekselType: 'archive', icon: `${GMRU_CDN_ICONS}f2d17e3b4d030e91c38e68cd60c0ee69.png`, grade: 1, name: "Эфенский сундучок со всякой всячиной" }, // icon_item_3907.png
    { id: 8000749, type: 'quest', overlay: 'quest_y', icon: `${GMRU_CDN_ICONS}8139603ac380eaa7a6a9f7a0c331a607.png`, grade: 3, name: "Лицензия на убийство: Баррага Безумный", description: 'Позволяет получить задание.' }, // icon_item_2762.png
    { id: 8000751, type: 'quest', overlay: 'quest_y', icon: `${GMRU_CDN_ICONS}8139603ac380eaa7a6a9f7a0c331a607.png`, grade: 5, name: "Лицензия на убийство: иферийцы", description: 'Позволяет получить задание.' },
    { id: 8000752, type: 'quest', overlay: 'quest_y', icon: `${GMRU_CDN_ICONS}8139603ac380eaa7a6a9f7a0c331a607.png`, grade: 6, name: "Лицензия на убийство: Иштар" },
    { id: 8000753, type: 'quest', overlay: 'quest_y', icon: `${GMRU_CDN_ICONS}8139603ac380eaa7a6a9f7a0c331a607.png`, grade: 2, name: "Лицензия на убийство: повелитель подземелья" },

    { id: 48893, icon: 'https://archeagecodex.com/items/icon_item_4819.png', grade: 10, name: 'Драгоценная эфенская сфера оружейника' },
    { id: 48894, type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_4820.png', grade: 10, name: 'Драгоценная эфенская сфера бронника', description: 'Предотвращает понижение уровня эффекта эфенских кубов, действующего на предмет. Повышает вероятность успеха при попытке улучшить снаряжение с помощью эфенских кубов в |nc;2|r раза.\n\nМожно использовать только при уровне усиления |nc;18 и выше|r.' },
    { id: 54915, type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_1695.png', grade: 1, name: 'Свиток чар ифнирского героя' },
    { id: 45508, icon: 'https://archeagecodex.com/items/icon_item_4212.png', grade: 2, name: 'Сфера анимага' },
    { id: 8001565, icon: 'https://archeagecodex.com/items/icon_item_3628.png', grade: 1, name: 'Новенькая кирка' },
    { id: 8002452, overlay: 'unconfirmed', icon: 'https://archeagecodex.com/items/icon_item_3349.png', grade: 1, name: 'Универсальный алхимический кристалл' },
    { id: 8002449, icon: 'https://archeagecodex.com/items/charge_wider.png', grade: 1, name: 'Дополнительная сумка' },
    { id: 47943, type: 'potion', icon: 'https://archeagecodex.com/items/icon_item_4710.png', grade: 1, name: 'Настойка усердного ремесленника' },
    { id: 39424, type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_3017.png', grade: 1, name: 'Ирамийская гадальная руна', description: 'Позволяет заменить один из |nc;эффектов синтеза костюма, эфенского снаряжения, рамианского снаряжения или трофейного снаряжения мифических противников|r другим, выбранным случайным образом.', useDescription: 'Распаковать.\nУдерживая Shift, щелкните левой кнопкой мыши, чтобы распаковать все предметы этого типа, находящиеся в рюкзаке.' },
    { id: 46180, icon: 'https://archeagecodex.com/items/icon_item_1395.png', grade: 3, name: 'Солнечный настой' },
    { id: 47130, type: 'unidentified', overlay: 'unconfirmed', icon: 'https://archeagecodex.com/items/icon_item_2679.png', grade: 6, name: 'Хрустальная руна', description: '|nd;Можно получить одну из хрустальных рун на выбор:|r\n- хрустальная руна багровой луны,\n- хрустальная руна осенней луны,\n- хрустальная руна молодой луны,\n- хрустальная руна безмолвной луны,\n- хрустальная руна колдовской луны.' },
    { id: 47104, icon: 'https://archeagecodex.com/items/icon_item_4570.png', grade: 2, name: 'Парниковый купол' },
    { id: 48903, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_3282.png', grade: 1, name: 'Набор сверкающих эфенских сфер' },
    { id: 48474, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_3275.png', grade: 11, name: 'Большой набор мифических эссенций' },
    { id: 8002297, type: 'unidentified', overlay: 'seal', icon: 'https://archeagecodex.com/items/icon_item_2267.png', grade: 3, name: 'Королевский лунный изумруд' },
    { id: 35727, icon: 'https://archeagecodex.com/items/icon_item_1982.png', grade: 2, name: 'Буровая установка' },
    { id: 47082, icon: 'https://archeagecodex.com/items/icon_item_3369.png', grade: 1, name: 'Патент на транспортное средство' },
    { id: 31892, icon: 'https://archeagecodex.com/items/icon_item_1733.png', grade: 1, name: 'Земельный вексель' },
    { id: 55722, icon: 'https://archeagecodex.com/items/icon_item_5864.png', grade: 4, name: 'Искусная цитриновая гравировка' },
    { id: 48885, icon: `${GMRU_CDN_ICONS}aa37ed77de192687a78947c34a0a29be.png`, grade: 8, name: 'Сверкающая эфенская сфера оружейника' },
    { id: 48886, icon: 'https://archeagecodex.com/items/icon_item_4818.png', grade: 8, name: 'Сверкающая эфенская сфера бронника', description: 'Предотвращает понижение уровня эффекта эфенских кубов, действующего на предмет.\n\nМожно использовать только при уровне усиления |nc;18 и выше|r.' },
    { id: 55723, icon: 'https://archeagecodex.com/items/icon_item_5865.png', grade: 4, name: 'Искусная аквамариновая гравировка' },
    { id: 45747, type: 'potion', icon: 'https://archeagecodex.com/items/icon_item_4385.png', grade: 5, name: 'Драгоценный флакон с зельем охотника' },
    { id: 49270, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2273.png', grade: 5, name: 'Набор больших эфенских кубов' },
    { id: 45160, type: 'potion', icon: 'https://archeagecodex.com/items/icon_item_2376.png', grade: 4, name: 'Настойка спорыньи' },
    { id: 46623, type: 'potion', icon: 'https://archeagecodex.com/items/icon_item_0986.png', grade: 4, name: 'Настойка остролиста', buff: { duration: 1800 } },
    { id: 8001268, type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_1986.png', grade: 1, name: 'Свиток дельфийской библиотеки', buff: { duration: 3600 } },
    { id: 8001169, type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_1986.png', grade: 1, name: 'Свиток опыта V', buff: { duration: 3600 }, isPersonal: true },
    { id: 8001172, type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_1986.png', grade: 1, name: 'Свиток опыта VIII', buff: { duration: 3600 }, isPersonal: true },
    { id: 46181, icon: 'https://archeagecodex.com/items/icon_item_1396.png', grade: 3, name: 'Лунный настой' },
    { id: 48546, icon: 'https://archeagecodex.com/items/icon_item_3595.png', grade: 1, name: 'Письмена войны' },
    { id: 47655, icon: 'https://archeagecodex.com/items/icon_item_4709.png', grade: 4, name: 'Фиона Розовый Лепесток' },
    { id: 47581, icon: 'https://archeagecodex.com/items/icon_item_4211.png', grade: 3, name: 'Лиловое эмалевое стекло' },
    { id: 47479, icon: 'https://archeagecodex.com/items/icon_item_3519.png', grade: 1, name: 'Инкрустированный флакон с целебным эликсиром' },
    { id: 47480, icon: 'https://archeagecodex.com/items/icon_item_3520.png', grade: 1, name: 'Инкрустированный флакон с эликсиром маны' },
    { id: 8002996, icon: 'https://archeagecodex.com/items/icon_item_6002.png', grade: 1, name: 'Осколок предела', description: 'Этот осколок – фрагмент отражения божественных сил в материальном мире. На |ni;станке для акхиума|r из таких частиц можно создать нумены.', price: 100 },
    { id: 8003072, icon: 'https://archeagecodex.com/items/icon_item_6002.png', grade: 1, name: 'Осколок предела' },
    { id: 8001288, icon: 'https://archeagecodex.com/items/icon_item_0966.png', grade: 1, name: 'Цитрусовая карамелька', buff: { duration: 3600 } },
    { id: 8002649, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_3259.png', grade: 4, name: 'Набор неверинских фейерверков' },
    { id: 8000540, icon: 'https://archeagecodex.com/items/icon_item_3207.png', grade: 1, name: 'Пушистая неверинская елочка' },
    { id: 49769, icon: 'https://archeagecodex.com/items/icon_item_4950.png', grade: 6, name: 'Зачарованный свиток пробуждения хранителя знаний' },
    { id: 54653, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_5043.png', grade: 12, name: 'Сундук с обновленным рамианским снаряжением' },
    { id: 53515, type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_5266.png', grade: 2, isPersonal: true, price: 0, reqLevel: 1, name: 'Заговоренная рамианская руна', description: 'Позволяет заменить один из эффектов синтеза предмета другим, выбрав нужный эффект.\n\n|ni;Подходит для проклятого, изначального, обновленного и совершенного рамианского снаряжения.|r', useDescription: 'Приступить к замене эффекта.\nРасход очков работы: |nc;50|r.' },
    { id: 52207, icon: 'https://archeagecodex.com/items/icon_item_3022.png', grade: 1, name: 'Мешочек с микстурами', description: 'Содержимое:\n- инкрустированный флакон с эликсиром маны (300 шт.),\n- инкрустированный флакон с целебным эликсиром (300 шт.),\n- солнечный настой (30 шт.),\n- лунный настой (30 шт.)' },
    { id: 51239, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 11, name: 'Сундук с изначальным рамианским оружием эпохи мифов' },
    { id: 51240, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 12, name: 'Сундук с изначальным рамианским оружием эпохи Двенадцати' },
    { id: 54654, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 12, name: 'Сундук с обновленным рамианским оружием эпохи Двенадцати' },
    { id: 54655, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 11, name: 'Сундук с обновленными рамианскими доспехами эпохи мифов' },
    { id: 47941, type: 'box', icon: 'https://archeagecodex.com/items/x_mas_gift.png', grade: 10, name: 'Сундук с оружием Библиотеки Эрнарда эпохи легенд' },
    { id: 51243, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 12, name: 'Сундук с магистерским эрнардским оружием эпохи Двенадцати' },
    { id: 55501, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_5850.png', grade: 6, name: 'Сундучок с легендарным украшением ифнирского героя', description: 'Открыв этот сундучок, вы сможете выбрать один из следующих предметов:\n- легендарная серьга ифнирского героя,\n- легендарное кольцо ифнирского героя.' },
    { id: 51940, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 8, name: 'Сундучок с ценным украшением эпохи чудес' },
    { id: 51236, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 11, name: 'Сундучок с драгоценным украшением эпохи мифов', description: 'Открыв этот сундучок, вы сможете выбрать один из следующих предметов качества эпохи мифов:\n- перстень чемпиона Дома Норьетт,\n- серьга чемпиона Дома Норьетт,\n- ожерелье последнего рубежа,\n- ожерелье доблести воина XIII ранга,\n- ожерелье доблести целителя XIII ранга.' },
    { id: 55783, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2992.png', grade: 5, name: 'Сундучок с зачарованной гравировкой для украшений' },
    { id: 50924, type: 'equipment', subType: 'costume', icon: 'https://archeagecodex.com/items/costume_hm/nu_m_hm_cloth248.png', grade: 2, name: 'Дизайн широкополой шляпы стрелка' },
    { id: 50925, type: 'equipment', subType: 'costume', icon: 'https://archeagecodex.com/items/costume_hm/nu_{sex}_hm_cloth519.png', grade: 2, name: 'Дизайн соломенной шляпы' },
    { id: 8002486, type: 'equipment', subType: 'costume', icon: 'https://archeagecodex.com/items/costume_set/nu_{sex}_sk_korean006.png', grade: 1, name: 'Дизайн костюма хоури эпохи Фарвати' },
    { id: 51092, type: 'equipment', subType: 'costume', icon: 'https://archeagecodex.com/items/costume_set/nu_{sex}_sk_uniform004.png', grade: 2, name: 'Дизайн одеяния правителя северного Мейра' },
    { id: 129, type: 'magical', icon: `${GMRU_CDN_ICONS}3afe6571286a8a3f3cfab503f4bb8b00.png`, grade: 1, name: 'Дельфийская руна', description: 'Неказистая руна из светлого песчаника.', useDescription: 'Позволяет мгновенно получить 200.000 очков опыта.', reqLevel: 50 },
    { id: 8003128, type: 'magical', icon: `${GMRU_CDN_ICONS}3afe6571286a8a3f3cfab503f4bb8b00.png`, grade: 10, name: 'Дельфийская руна эпохи легенд', description: 'Древняя руна, наполненная невероятной магической силой.', useDescription: 'Позволяет мгновенно получить 125,000,000 очков опыта.', reqLevel: 91 },
    { id: 55280, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2812.png', grade: 6, name: 'Легендарная руна ифнирского героя' },
    { id: 55683, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_4527.png', grade: 1, name: 'Мешочек с магистериями для украшений' },
    { id: 50536, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_4527.png', grade: 1, name: 'Мешочек с магистериями', description: 'Открыв мешочек, вы сможете выбрать один из следующих предметов:\n- мешочек с рубиновыми магистериями,\n- мешочек с кварцевыми магистериями,\n- мешочек с сапфировыми магистериями,\n- мешочек с изумрудными магистериями,\n- мешочек с янтарными магистериями.' },
    { id: 8001148, icon: 'https://archeagecodex.com/items/icon_item_3807.png', grade: 2, name: 'Статуя «Орхидна на троне»' },
    { id: 8001203, icon: 'https://archeagecodex.com/items/icon_item_3277.png', grade: 1, name: 'Сундучок с фамильными ценностями' },
    { id: 54933, icon: 'https://archeagecodex.com/items/icon_item_5809.png', grade: 2, name: 'Замерзший пруд' },
    { id: 48860, type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_4002.png', grade: 6, name: 'Большая эфенская сфера оружейника', description: 'Повышает вероятность успеха при попытке улучшить снаряжение с помощью эфенских кубов в |nc;2|r раза.' },
    { id: 48861, type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_4816.png', grade: 6, name: 'Большая эфенская сфера бронника', description: 'Повышает вероятность успеха при попытке улучшить снаряжение с помощью эфенских кубов в |nc;2|r раза.' },
    { id: 44359, type: 'potion', icon: 'https://archeagecodex.com/items/icon_item_3559.png', grade: 1, name: 'Походный фиал славы' },
    { id: 32490, icon: 'https://archeagecodex.com/items/icon_item_1333.png', grade: 9, name: 'Сверкающий фиал с эликсиром чести' },
    { id: 55800, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_5486.png', grade: 4, name: 'Сундучок с фрагментами судьбы', description: 'Открыв этот сундучок, вы сможете выбрать один из следующих предметов:\n- пыль судьбы (25 шт.),\n- слиток судьбы (5 шт.),\n- призма судьбы.' },
    { id: 8002772, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_5043.png', grade: 5, name: 'Окованный сталью ящик с боевым питомцем', description: 'Сняв печать, вы получите Квадрума, Мистериона или Мистериона, Ужаса Ночи (на выбор).' },
    { id: 50635, type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_5058.png', grade: 2, isPersonal: true, name: 'Заговоренная гадальная руна', description: 'Позволяет заменить один из эффектов синтеза предмета другим, выбрав нужный эффект.\n\n|ni;Подходит для эфенского и рамианского снаряжения; трофеев, полученных за победу над мифическими противниками; ожерелий, полученных на Последнем рубеже; перстней говорящего с духами; а также для костюмов, плащей и украшений чемпионов Порт-Аргенто.|r', useDescription: 'Приступить к замене эффекта.<br>Расход очков работы: <span class="orange_text">50</span>.' },
    { id: 8002769, icon: 'https://archeagecodex.com/items/quest/icon_item_quest217.png', grade: 3, isPersonal: true, name: 'Знак «Ключевая фигура»', description: 'Позволяет получить титул «Ключевая фигура».', useDescription: 'Получить титул.' },
    { id: 28813, icon: 'https://archeagecodex.com/items/icon_item_1319.png', grade: 5, name: 'Монеты дару x85' },
    { id: 30604, icon: 'https://archeagecodex.com/items/icon_item_1643.png', grade: 5, name: 'Монеты дару x100' },
    { id: 28814, icon: 'https://archeagecodex.com/items/icon_item_1643.png', grade: 5, name: 'Монеты дару x180' },
    { id: 30605, icon: 'https://archeagecodex.com/items/icon_item_1643.png', grade: 5, name: 'Монеты дару x280' },
    { id: 55450, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 7, name: 'Реликвийное кольцо ифнирского героя' },
    { id: 8002410, type: 'equipment', subType: 'cloak', icon: 'https://archeagecodex.com/items/icon_item_0936.png', grade: 5, name: 'Алый шарф', description: 'Неизвестно, в чем причина, но к человеку в таком шарфе окружающие почему-то относятся с особенным уважением (и даже с некоторой опаской).\n\n|nc;Усиливающие эффекты костюма действуют 30 дней. Чтобы активировать их заново, костюм нужно постирать.|r', equipDescription: 'Скорость передвижения +|nc;3|r%\nСкорость плавания +|nc;3|r%\nСкорость занятия ремеслом |nc;+10%|r\nСкорость занятия животноводством |nc;+10%|r\nОпыт при занятии ремеслом |nc;+10|r%', isEquipDescriptionTemporary: true },
    { id: 34684, type: 'equipment', subType: 'windInstrument', icon: 'https://archeagecodex.com/items/icon_item_ins_s_0051.png', name: 'Укрепленная аргенитовая лютня' },
    { id: 34685, type: 'equipment', subType: 'windInstrument', icon: 'https://archeagecodex.com/items/icon_item_ins_w_0025.png', name: 'Укрепленный аргенитовый кларнет' },
    { id: 417, icon: 'https://archeagecodex.com/items/icon_item_0418.png', grade: 1, name: 'Редкий камень странствий', isPersonal: true, description: 'Необходим для перемещения с помощью книги порталов.', price: 0, reqLevel: 1 },
    { id: 52701, icon: 'https://archeagecodex.com/items/icon_item_5282.png', grade: 1, name: 'Кристалл изначального анадия', description: 'Эти лиловые кристаллы – достойное подношение духам-хранителям.\nОдновременно в рюкзаке может быть не более пяти кристаллов. Кристаллы исчезнут через один час.', useDescription: 'Поднести кристалл духам-хранителям у древнего тотема или усилить призванного духа-хранителя.', price: 0 },
    { id: 40491, icon: 'https://archeagecodex.com/items/icon_item_3090.png', grade: 2, name: 'Знак отваги' },
    { id: 46695, icon: 'https://archeagecodex.com/items/icon_item_4557.png', grade: 3, name: 'Белоснежный олененок' },
    { id: 48521, type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_2070.png', grade: 5, name: 'Большой эфенский куб оружейника' },
    { id: 48522, type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_2069.png', grade: 5, name: 'Большой эфенский куб бронника' },
    { id: 8002273, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_1668.png', grade: 1, name: 'Набор анимага' },
    { id: 8002483, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_3261.png', grade: 1, name: 'Коробка с бельем «Ночи Аль-Харбы»' },
    { id: 45409, type: 'unidentified', overlay: 'unconfirmed', icon: 'https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_cloth292.png', grade: 2, name: 'Рамианское матерчатое снаряжение' },
    { id: 53586, type: 'unidentified', icon: 'https://archeagecodex.com/items/icon_item_5144.png', grade: 4, name: 'Золотой сундучок со знаками культистов' },
    { id: 46151, type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_4467.png', grade: 3, name: 'Заготовка огранщика', isPersonal: true },
    { id: 49252, type: 'quest', icon: 'https://archeagecodex.com/items/icon_item_4878.png', grade: 2, name: 'Образцы флоры Сада', isPersonal: true, price: 0, description: 'Пакетик с образцами флоры Сада Матери.' },
    { id: 31151, type: 'other', icon: 'https://archeagecodex.com/items/x_mas_gift.png', grade: 1, name: 'Перевязанный ленточкой подарок', description: 'Похоже, один из снеговиков вместе с украшениями прихватил подарок из тех, что должен был раздавать на улицах города.', useDescription: 'Открыть подарок.\nУдерживая Shift, щелкните правой кнопкой мыши, чтобы открыть все подарки этого вида один за другим.', isPersonal: true, price: 0 },
    { id: 28188, type: 'rareMaterial', icon: `${GMRU_CDN_ICONS}d2f377e3c3118826089a2caf9e794a50.png`, grade: 3, name: 'Сплав стихий', description: 'Можно изготовить с помощью |ni;тигля стихий|r.\nИспользуется в ремесле.', isPersonal: true, price: 360 },
    { id: 55516, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2812.png', grade: 5, name: 'Эпическая руна ифнирского героя', isPersonal: true },
    { id: 55490, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 8, name: 'Серьга ифнирского героя эпохи чудес', isPersonal: true },
    { id: 55255, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 7, name: 'Реликвийная серьга ифнирского героя', isPersonal: true },
    { id: 52808, type: 'unidentified', overlay: 'unconfirmed', icon: 'https://archeagecodex.com/items/icon_item_teleport.png', grade: 1, name: 'Книга порталов (7 д.)', isPersonal: true },
    { id: 34702, type: 'equipment', subType: 'windInstrument', icon: 'https://archeagecodex.com/items/icon_item_ins_w_0049.png', name: 'Зеркальный аргенитовый кларнет', buff: { avgRestoreMana: 16 } },
    { id: 51723, type: 'mount', icon: 'https://archeagecodex.com/items/icon_item_5149.png', grade: 4, name: 'Ящик с Мару, покорителем просторов', isPersonal: true },
    { id: 8002771, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_5043.png', grade: 5, name: 'Окованный сталью ящик с глайдером', isPersonal: true },
    { id: 39363, type: 'battlePet', icon: 'https://archeagecodex.com/items/icon_item_2275.png', grade: 1, name: 'Осенний Лоскутик' },
    { id: 34972, icon: 'https://archeagecodex.com/items/doll_pet_hm_001.png', grade: 1, name: 'Красные очки-сердечки' },
    { id: 34975, icon: 'https://archeagecodex.com/items/doll_pet_bo_001.png', grade: 1, name: 'Кулинарные перчатки в красный горошек' },
    { id: 36183, icon: 'https://archeagecodex.com/items/doll_pet_ar_007.png', grade: 1, name: 'Красный заводной ключик' },
    { id: 34981, type: 'battlePet', icon: 'https://archeagecodex.com/items/icon_item_2720.png', grade: 1, name: 'Детеныш Гартарейн' },
    { id: 37018, type: 'lightArmor', icon: 'https://archeagecodex.com/items/costume_hm/nu_m_hm_cloth560.png', grade: 3, name: 'Вязаная шапочка' },
    { id: 49630, type: 'furniture', icon: 'https://archeagecodex.com/items/icon_item_4862.png', grade: 5, name: 'Статуэтка «Аранзеб»' },
    { id: 31787, type: 'lightArmor', icon: 'https://archeagecodex.com/items/costume_hm/nu_m_hm_cloth550.png', grade: 3, name: 'Ободок со снеговичками' },
    { id: 28242, type: 'craftItem', icon: 'https://archeagecodex.com/items/icon_item_1243.png', grade: 1, name: 'Мыло' },
    { id: 43298, type: 'craftItem', icon: 'https://archeagecodex.com/items/icon_item_3952.png', grade: 1, name: 'Теневой делец' },
    { id: 8002004, type: 'mount', icon: 'https://archeagecodex.com/items/icon_item_2774.png', grade: 1, name: 'Призрачный конь (30 д.)' },
    { id: 8000315, type: 'lightArmor', icon: 'https://archeagecodex.com/items/costume_cp/nu_f_cp_leather002.png', grade: 1, name: 'Накидка из грифоньих перьев' },
    { id: 8000127, type: 'equipment', subType: 'costume', icon: 'https://archeagecodex.com/items/costume_set/nu_f_sk_party001.png', grade: 2, name: 'Бальный наряд Двух Корон' },
    { id: 55495, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 9, name: 'Кольцо ифнирского героя эпохи сказаний' },

    { id: 33156, type: 'equipment', equipmentSubType: 'helmet', icon: 'https://archeagecodex.com/items/costume_hm/nu_m_hm_cloth554.png', name: 'Вишневая шляпа-торт' },

    { id: 45373, type: 'furniture', icon: 'https://archeagecodex.com/items/icon_item_4353.png', grade: 2, name: 'Фонтан «Лесная гармония»' },
    { id: 8000346, icon: 'https://archeagecodex.com/items/icon_item_1360.png', grade: 2, name: 'Белая субмарина (30 д.)' },
    { id: 8000309, type: 'mount', icon: 'https://archeagecodex.com/items/icon_item_1502.png', grade: 3, name: 'Цирковой медведь (на 30 дней)' },
    { id: 31878, type: 'furniture', icon: 'https://archeagecodex.com/items/icon_item_1670.png', grade: 2, name: 'Неверинский патефон' },
    { id: 8002069, icon: 'https://archeagecodex.com/items/icon_item_moonstone05.png', grade: 1, name: 'Дар жрицы Нуи' },
    { id: 39551, type: 'furniture', icon: 'https://archeagecodex.com/items/icon_item_2847.png', grade: 2, name: 'Песчаная скульптура Победы' },
    { id: 8000310, icon: 'https://archeagecodex.com/items/icon_item_2979.png', grade: 1, name: 'Жетон на покупку оружия' },
    { id: 8000311, icon: 'https://archeagecodex.com/items/icon_item_2980.png', grade: 1, name: 'Жетон на покупку доспехов' },
    { id: 8000441, icon: 'https://archeagecodex.com/items/icon_item_2993.png', grade: 1, name: 'Иферийская монетка' },
    { id: 8000442, icon: 'https://archeagecodex.com/items/icon_item_2982.png', grade: 1, name: 'Заколдованная монетка' },

    { id: 45880, type: 'equipment', equipmentSubType: 'helmet', icon: 'https://archeagecodex.com/items/costume_hm/nu_{sex}_hm_cloth295.png', name: 'Диадема эрнардского мнемоника', isPersonal: true },
    { id: 45881, type: 'equipment', equipmentSubType: 'armor', icon: 'https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_cloth295.png', name: 'Матерчатый камзол эрнардского мнемоника', isPersonal: true },
    { id: 45882, type: 'equipment', equipmentSubType: 'pants', icon: 'https://archeagecodex.com/items/costume_pt/nu_{sex}_pt_cloth295.png', name: 'Матерчатые поножи эрнардского мнемоника', isPersonal: true },
    { id: 45883, type: 'equipment', equipmentSubType: 'gloves', icon: 'https://archeagecodex.com/items/costume_gv/nu_m_gv_cloth295.png', name: 'Матерчатые перчатки эрнардского мнемоника', isPersonal: true },
    { id: 45884, type: 'equipment', equipmentSubType: 'boots', icon: 'https://archeagecodex.com/items/costume_bo/nu_{sex}_bo_cloth295.png', name: 'Матерчатые сапоги эрнардского мнемоника', isPersonal: true },
    { id: 45885, type: 'equipment', equipmentSubType: 'bracer', icon: 'https://archeagecodex.com/items/icon_item_arm_cloth_0020.png', name: 'Матерчатые наручи эрнардского мнемоника', isPersonal: true },
    { id: 45886, type: 'equipment', equipmentSubType: 'belt', icon: 'https://archeagecodex.com/items/icon_item_belt_cloth_0021.png', name: 'Матерчатый пояс эрнардского мнемоника', isPersonal: true },

    { id: 45991, type: 'equipment', equipmentSubType: 'helmet', icon: 'https://archeagecodex.com/items/costume_hm/nu_{sex}_hm_cloth295.png', name: 'Диадема смотрителя тайных архивов', isPersonal: true },
    { id: 45990, type: 'equipment', equipmentSubType: 'armor', icon: 'https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_cloth295.png', name: 'Матерчатый камзол смотрителя тайных архивов', isPersonal: true },
    { id: 45989, type: 'equipment', equipmentSubType: 'pants', icon: 'https://archeagecodex.com/items/costume_pt/nu_{sex}_pt_cloth295.png', name: 'Матерчатые поножи смотрителя тайных архивов', isPersonal: true },
    { id: 45988, type: 'equipment', equipmentSubType: 'gloves', icon: 'https://archeagecodex.com/items/costume_gv/nu_m_gv_cloth295.png', name: 'Матерчатые перчатки смотрителя тайных архивов', isPersonal: true },
    { id: 45987, type: 'equipment', equipmentSubType: 'boots', icon: 'https://archeagecodex.com/items/costume_bo/nu_{sex}_bo_cloth295.png', name: 'Матерчатые сапоги смотрителя тайных архивов', isPersonal: true },
    { id: 45986, type: 'equipment', equipmentSubType: 'bracer', icon: 'https://archeagecodex.com/items/icon_item_arm_cloth_0020.png', name: 'Матерчатые наручи смотрителя тайных архивов', isPersonal: true },
    { id: 45985, type: 'equipment', equipmentSubType: 'belt', icon: 'https://archeagecodex.com/items/icon_item_belt_cloth_0021.png', name: 'Матерчатый пояс смотрителя тайных архивов', isPersonal: true },

    { id: 45887, type: 'equipment', equipmentSubType: 'helmet', icon: 'https://archeagecodex.com/items/costume_hm/nu_{sex}_hm_leather295.png', name: 'Фибула заклинателя гримуаров', isPersonal: true },
    { id: 45888, type: 'equipment', equipmentSubType: 'armor', icon: 'https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_leather295.png', name: 'Кожаная куртка заклинателя гримуаров', isPersonal: true },
    { id: 45889, type: 'equipment', equipmentSubType: 'pants', icon: 'https://archeagecodex.com/items/costume_pt/nu_{sex}_pt_leather295.png', name: 'Кожаные поножи заклинателя гримуаров', isPersonal: true },
    { id: 45890, type: 'equipment', equipmentSubType: 'gloves', icon: 'https://archeagecodex.com/items/costume_gv/nu_m_gv_leather295.png', name: 'Кожаные перчатки заклинателя гримуаров', isPersonal: true },
    { id: 47047, type: 'equipment', equipmentSubType: 'boots', icon: 'https://archeagecodex.com/items/costume_bo/nu_{sex}_bo_leather295.png', name: 'Кожаные сапоги заклинателя гримуаров', isPersonal: true },
    { id: 47048, type: 'equipment', equipmentSubType: 'bracer', icon: 'https://archeagecodex.com/items/icon_item_arm_leather_0020.png', name: 'Кожаные наручи заклинателя гримуаров', isPersonal: true },
    { id: 47049, type: 'equipment', equipmentSubType: 'belt', icon: 'https://archeagecodex.com/items/icon_item_belt_leather_0021.png', name: 'Кожаный пояс заклинателя гримуаров', isPersonal: true },

    { id: 47043, type: 'equipment', equipmentSubType: 'helmet', icon: 'https://archeagecodex.com/items/costume_hm/nu_{sex}_hm_leather295.png', name: 'Фибула укротителя гримуаров', isPersonal: true },
    { id: 47044, type: 'equipment', equipmentSubType: 'armor', icon: 'https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_leather295.png', name: 'Кожаная куртка укротителя гримуаров', isPersonal: true },
    { id: 47045, type: 'equipment', equipmentSubType: 'pants', icon: 'https://archeagecodex.com/items/costume_pt/nu_{sex}_pt_leather295.png', name: 'Кожаные поножи укротителя гримуаров', isPersonal: true },
    { id: 47046, type: 'equipment', equipmentSubType: 'gloves', icon: 'https://archeagecodex.com/items/costume_gv/nu_m_gv_leather295.png', name: 'Кожаные перчатки укротителя гримуаров', isPersonal: true },
    { id: 45891, type: 'equipment', equipmentSubType: 'boots', icon: 'https://archeagecodex.com/items/costume_bo/nu_{sex}_bo_leather295.png', name: 'Кожаные сапоги укротителя гримуаров', isPersonal: true },
    { id: 45892, type: 'equipment', equipmentSubType: 'bracer', icon: 'https://archeagecodex.com/items/icon_item_arm_leather_0020.png', name: 'Кожаные наручи укротителя гримуаров', isPersonal: true },
    { id: 45893, type: 'equipment', equipmentSubType: 'belt', icon: 'https://archeagecodex.com/items/icon_item_belt_leather_0021.png', name: 'Кожаный пояс укротителя гримуаров', isPersonal: true },

    { id: 45894, type: 'equipment', equipmentSubType: 'helmet', icon: 'https://archeagecodex.com/items/costume_hm/nu_m_hm_metal295.png', name: 'Латный шлем эрнардского архивариуса', isPersonal: true },
    { id: 45895, type: 'equipment', equipmentSubType: 'armor', icon: 'https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_metal295.png', name: 'Латный нагрудник эрнардского архивариуса', isPersonal: true },
    { id: 45896, type: 'equipment', equipmentSubType: 'pants', icon: 'https://archeagecodex.com/items/costume_pt/nu_{sex}_pt_metal295.png', name: 'Латные поножи эрнардского архивариуса', isPersonal: true },
    { id: 45897, type: 'equipment', equipmentSubType: 'gloves', icon: 'https://archeagecodex.com/items/costume_gv/nu_m_gv_metal295.png', name: 'Латные перчатки эрнардского архивариуса', isPersonal: true },
    { id: 45898, type: 'equipment', equipmentSubType: 'boots', icon: 'https://archeagecodex.com/items/costume_bo/nu_{sex}_bo_metal295.png', name: 'Латные сапоги эрнардского архивариуса', isPersonal: true },
    { id: 45899, type: 'equipment', equipmentSubType: 'bracer', icon: 'https://archeagecodex.com/items/icon_item_arm_metal_0020.png', name: 'Латные наручи эрнардского архивариуса', isPersonal: true },
    { id: 45900, type: 'equipment', equipmentSubType: 'belt', icon: 'https://archeagecodex.com/items/icon_item_belt_metal_0021.png', name: 'Латный пояс эрнардского архивариуса', isPersonal: true },

    { id: 53522, type: 'other', icon: 'https://archeagecodex.com/items/quest/icon_item_quest169.png', grade: 2, name: 'Большой сундук Кириоса', description: 'Сундук с медными драконами.\nВнутри:\n\n- 60-100 медных драконов.', isPersonal: true },
    { id: 55367, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_1482.png', grade: 9, name: 'Ларец со свитками пробуждения 3 ранга' },
    { id: 8000926, icon: 'https://archeagecodex.com/items/icon_item_3368.png', grade: 1, name: '[1 день] Покровительство Сиоль' },
    { id: 8000927, icon: 'https://archeagecodex.com/items/icon_item_3368.png', grade: 1, name: '[7 дней] Покровительство Сиоль' },
    { id: 51922, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_4413.png', grade: 2, name: 'Корзинка с жетоном' },
    { id: 33382, type: 'potion', icon: 'https://archeagecodex.com/items/icon_item_0843.png', grade: 1, name: 'Бутыль с имбирным напитком' },
    { id: 8003057, type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_6009.png', grade: 2, name: 'Мимолетное благословение предела' },

    { id: 56010, name: 'Бенедикт', icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYG7QAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6OTdFODYzN0UzRTU2MTFGMTg0NDU4NjRGMEZDN0I0MjYiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6OTdFODYzN0YzRTU2MTFGMTg0NDU4NjRGMEZDN0I0MjYiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDo5N0U4NjM3QzNFNTYxMUYxODQ0NTg2NEYwRkM3QjQyNiIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo5N0U4NjM3RDNFNTYxMUYxODQ0NTg2NEYwRkM3QjQyNiIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PjAKMw0AABTfSURBVHjaNFlpjBzHdX7d1XfPPTszO7Mnd8ldXhJJUeJK1mVJlm34iJ04dpxECIIgMWLYjg3byJ8gQQzEgRMYQWDHBvwrAezAiYPEcKIocnT5EGVJFEmRIiVyuUvufczdM9N3VVde9Sozy93Z2emqV+9973vf15SeerJeyivFvFwuQDEn5W1im1xXgRDgHOJYCkLwfWnogetKrpf4PkSRFIVSzHjC8DMSBw4AEojPE5ANWSkRvaKYZWJokhIltEujrXDUCsM+Df2EJQlQyhnnlHGWcMqBUU4T8RUnXGGJHDPcmIchhKEU4JIgJTSRiYQbUIrbQxhzGkt4WZJIwMXWsswVLjGMAwPikoTvAU9AkjlIEg+BOTyMWaKAHCXJiFEPGJMSWZZUTqicgAKAF6fnwMtAFtcSAHypYJhpNFIQgIeb4JVMDlSJyLiyRBOMNU1JBBgTHgejlBIJg8anLMIT8aVry4p4JZ6xRIcJ+BLD+GLOgyQJAI/IZS4pGHwiDiBWZzyNIeEEr8WFMTCuJBTiCAKFu4r4GB4kjLiuSLLYU2zPqJTGhHGLY0qJuFDGg2G+4pjhaTgeXSEqkWSViHOIw+Mx5TR5eAQqccyspOCHZCkBTBAuImPlMF78OMUfuChT8CyypMQUkwtKCEp6VMa4HskaAYIB4QM/m+CbaVhMLCzqGHgsZopmZcrlTLYgS3IYeGHgRn4Q+V4UekQzVMOmkpIkaZFxJdwJd8Oo8HKEGqKHYd0x1ZguhrlKBAQTkULcBo8eyCKCBHenMsUKEklBMAmAYASYSFxY/Bb7URj4ucpUY2YuVypZ2ZKWLSiKljAaRyENXG84GnY6nZ2N3fVlzKGeK8qymnBRZMyWjNnhMsGYFDwk7sYgwpzLIMomaoaAV1LMA5UhFOUX6MJ8qJghCRTyLloFXhAN3lCW9akT904cOWbny9gVcRy6XgAa1QjRTFvL5bLjauOYgsH1ttZXrry+ffOaYth6roypZUAUWWYHkaX9hbiSEGNSLLAs8IpYSsj8eBZT+W59cOsEI5UTJtCDsXIsk+htEg4HZm5s/t6Ha4cWsOH7w2EYMgQVIbhTEkYxjUI/jIf+MECSINLYzKHp42ezlfqwtT/qtPRMlmi6jBAjGLwqKRibwHfaE4gEZIHk4EnmMCBEQdoy+DdMBk+bBnMLBy0NMkZjFSrz9z1mFvLuwPH8CAvMVUi7WFRXVCQIcQWmyAR0WSah08Eeqi+emDp6GoHV2ryjm7aqWwTTRDSZICGIXQWNcdH4AhQc05YGRERLQZojEC8Q+zxtaEmAMXI9M1uav+9hyTB6Tg+vyeeKmYxtmAZmHAFJFFVVlEQ3JU2rGVpGYaJ9ZVUFZjDPGqvN3rOk60Z7fUW8aWbSPIk2FvuIQLAUiCjkPmQcpK6UY0ULpvlgKccg9EmapNjzdd2cu+dhZqjOwNGw/1RyfWUliGljZmq8WjGIauhGgswbeBktenFD3uiNiuCNSSHYtT2qHIUb8ydPzS49TiX9zhvnEaSSZghISESgiGK2GAYoC+JDDpAOyExKkfvut4NH+h5jEa2cOiOVbHfgYr8ouhrSZOgNaRRfPv9avVH/4HuXnO7erXduZMvVHyXTP1zDJNfAwk53YU+DKDv+9st3f/9H8+eWlh5+7ND9j62+9gtV1UBRCGcYgagbEXUQtJfChsxVM5hCBTsS/0QEk+KHxHccHYFfaExUj94VUirQqGm5jJm3lB+sGz/ujT00rpQb9Wd3tVdut9vUfFE+9KxXg3xGzlvcNiHbAJ/B5vqourj/5hubr72x39qZWjw+Xm/0dzYlgkzERYmQWGNGGcUH/ohxo8ON/EEE+CWyhrlLX+BsRVSXjp008wUpYhQgitni9Pi/XOo987/b4EivB/IL6/7Vl/eXA/ta+ciWMWZZcsOUKrpUIaRuGk0agzuA6clo8fTh9ttua3N9Y6u2eGyiXG5v3pGJehAHjcVTfEujIqcWplLuw8GIE16UUU4D4jS0SpXCofkojATYgmEpo76yR77zT2+CjEzahPUWdAMwKPieGEm10rRtUMw7F2MUSaMTeGAY4DhQmdSL+drmZVC0tbW1xdNn8xmzub2JbZWGgZwhIqI0wRDJEw8tgchdhBmU/x9a+B1nqdGYyo03cpqq5yv/+mb36Wu9p59fB2QfmYpJWq/A1CTkSqBz2G/DcNjLZ/OGgSutReAgKUch3Fq/L6PfM559PciV3P2xqIMQ3Pfc6akZZ/sOcqOIAylMxHVQOCbPHT1ZqtY13RQEdUBBKZqxF9RC0fdGRw81LrbIy/+2fPv8jiD7rA6VcbjvHsgWYXUDrt+Am5vAY1hZgZsrmJktq3q0WLCJDp4BcfClpcIP31//3IOLl8fPRMDMnFXWyc61N1KxFWF6GBOZwc4XvIi1qtWnM7mCgsgX3c9TGsL1I9nKZgrl8ULh/PWt7/3Hq5ABKIBIhmmgkIPdDrDgS5++/1t/+vFPfPQc9Prgj2B3d73Nf2fwxn8b335j7tmHqw4cuftb3/32E5/47fv2Lp4+98BFtW4q/Mh0I+w1kdxFQDH+EJAQqGBpQPzdx7vdju+lokNSsoXyWA0J9e9/eh12+5AlOAgFVrCau23otL750eOf/fVH7prPL5W7Z2YtkPFIJqxffPLS11rPvXh49NwvHnnzcHHw9oC9vtr966/9+UMkavOJnEGc5g7KyDgOaBweYAd7TWRIpAiU7a01p9+JolBQuJihAlESwmZyZvfOyoWXntvvzUB9CvotwDGNc9AykPUfmbQnS9m//Oa3X3zp5f1m58ThMhx5LwyND/qXZhW4OQR2aeM98U+/ONp6+gOPh2z13rNnw2EPJk/ldSe4fTnWxgTFYa2oyAtGhDx9UDVl9e2rTrcZBb5QxGJioPShVr4Mqn7n4vkgiKBYxQEBqUgU+o6YYFsZud/rjTrNDYwG83rXnHWdZGHH+90zy7MUfvor+P5FqAZ7D4/tVX7j9OiTX9Q18s11Bx58yB1o6kvfoJDBkYDIOShUIkZriiDGld3NtYSh9GCqfFAySGJqFYsQ+7al5uoTsIvRcEDdj7qEEtjcBdCe6YYny7fuPnbMpL1s2Gf1c3CJ/cHki+9N2l95Wv5ROzkAAN2Aj01lvld94usXL0DBnLOT89XH7r35qrX+S5qZZCJBPEm/BE+KU0vKaDRQ8YcqyIilHgI5SjdMS1d8XVOtjFB4GZS8KozakAOYn4Uji7DZ+dtrqx+asjNzj6547FV3avEDY+93fvbMy7Dd5r9P9EfmJhvFyoX1S9Vq5hunCm/mjl1w5cuj6M0Y4MiHljYv8sjFThYTnr0LYiJ0sKrgr2KM8IPpKiXCOpAQqxpECSGhmgNcAuFM+bFjpYWZ6k9yE1CpT0zObG/UntlqQtmGKeuJMf2rDxwfdr7Z3v6tL1f4/fVMY3IeErsxZS1TKg3cpRyZ0qDIld7uflRoZBYebr/1LLdrqQ5KrQMqSVUz7CyZrmTld4WGUEWIE6IowdBBVZzJ5a/uDLcHOCPZxGzhC48stEbsrStbMPCGOj/SqHQnGwsTlaem85+ayuQTatTn1PJd71x6pkf9Hlm9uXujnQ/0pc+jHoyoXzaUxYIadNo3e6P3TeTay5eiROh9xJDod5BVrEuuqBx0uVCuspBBmCqcxIE76q68Uzs8SVGfiBjDxyYM3S4M/Q6M+rDNIRzeqnUKU4279ey5fGHcUvsRhfb67L2Pru/+xc9+8PXDXSwIxI2PHE6MOvVc1OI0yRjKUlnWIsmyS8TIxq4nEZ0JaZpqVTHXZTIxlklNgRDRqV8SCFY0TRruh43T1/Mne8s7YEd3FxQzP5bRUW0PN5wh9EPo9iY4++RC5Wg1NxTySniGwO23RrSpN/bN2Z3yPZmps3biuoHnjfxw5HbaXQukcwszqOSvvPazIPAkWWNCW2PhUoEhK0L+C/yIoYBGRXg5RJXl9/aqZ/+5+jG4cgGkWMhsRRu6oZ2x37Mwx5P189jDknp/jhYh7HluDBL1ggDNKostKTw0M9X3xy1TL2c03w99nFZIyq6P+9Zq1WmsjaaiNY7Rhio8le+C/AKRREehRJeFs0MLFyexwlS0Q2gL2fO1U9DcgeXroKhZg+Ss3MhzB747li08eHyhXmkVTXNhotp03Baq+pTUVEXDhk0kpVzK52KK8EBcCqeAAaFlS6dnSCMPIxTeR/VdT9bs1P2AaPswDsKhMiLY4OSCNj2VdE72LoeqjtLY4wSwg2hPDIocOWnL/TCwFBL7QYcluWz2zMwUyMTlBAsS9QKCTkLTLBNkQ8dJKOYTWl0OqoImgPCUYxAe+HF0mL7niYxbdhCyZDC0cjnhJ9GNoRMWSlCW1yMtLk31xudo45is2qaz6ZjjG6wGowBseSGL60QJizKGqSmYauEEojgJ0JXhxIl8dBxE0VDWYUwYDRUHRTsZgCARHAtxarDQxFEEqkqUjK2P/IjK5A8/90ebG5vL7yybdoaK4ZHiZraUadZOQ30eDh9ZNcqroXuWfvxix4XuENbeMiQ6iMiAhjlVuHrVMNGl4aU+D8RNCc5N25YSgqJGQ+PBWBgESiILxSCUMmr4SBLOkItpTgXdBDEg2LieX+vEyIMf/vRTr/z8Ag6Q7c0mGohypUb+8R/+7PEPPvmTfhYM9cvjw3P1/I/DEmQs8Bxo71DgowjcJJnOqONjY+hAgijEpVHC4bZE9AWa0URFhkX3cPAQHYMFkuHA4+CxcYJyRjlCnpmmmc9k8Ejfve23blz5yAP3bew2r129/sSHfy2XL22srcrl6amTpPv8o9nvTHSLN/7z8xPDP84HcH0ZDwI9GVxxIwMtC2IdtQAVLknWDSyejoWIAKU2E7c0WOL7vut7uHXMGcoCTdhfMdEQxUHghyG1dNMyDFwrjGjO4J99/PR/TT26GqjHFmdbbvLZr/7N733mT/b6gex0HIR+kTdr8e7Vd3aeP//KV84ZR6wQLl564gPH4dgibHsQIgJQwAQxj2zLwmhw3mHtkD/wPRmJ2It39tsYEfY3VhZDd6PIj+KRH4wcvzdwCYQ5HQ/XQ4+hKKoX9k85rz5VUZZLR4tj2Yyq7m/vs8hDs62MnKFerW45g07AC/n85Zu3z9zb/s5v3vWLSe++Q9pfzT/0lGWv/vsL1zR5ujJSYytIfCnle8xU3gDdYNMTuWKp0O97rabTHfpoUHAUTk6MVQq60xs6Q+y4Ecijra0Wetxao6YRLwqHr7x9++SUlPRn8ofuPnH3iThu7Te3fLTSR+cbV6+/vddqjQbDoetiTNlcUeb+4XrxuRdeTbz+333hk9187vwLrxZVli8UEUI45sbHC9WqUcgm6BwdZzeJvBNHpo+fnJuojdm6MTNbNSWHeZ0gcBTCpuul3Z19ZxQ+dO7s/OE6C1wWR6plZTXu7yznswVO6eHjE7du3vz5L18nh2bH3DBwHQzH1xRN9HIcjTfG17f2V9fWIokbEvvUk/fMzkzcWF6vVUszk8WxAjEMT6J96ruh5yK9DEYB9o6qEnfQzhVUTaGXL15s9/rt7hAPvt9s4Zw6cfTI9GTd1M293d3dvc2JWjWIYsLD1v4eVvbc0tn/eea56++sKlbGwpGrII0C2nlUcezO2m0cL6OBb+lG1jIvXb9xe2Nn6eyZ8c98pN9qJZHfHzhOz5OYpCuqnE7ErKXkMtqVy1fbzfZYtRSGvmnZ+WymO/RYlo0GTqVgVAsWjvXhYNgbdnFudlt7XsTy+fJ4XjeszM7GJnISrkWWTi2gbkWDRwQWIxxrBKS9dgcVeNa0EMpI+FFEO519FTx8hbyPoKAoorCL0DRg2xFm4r8oHkMxZpv453KlkS9XEAB2xtQsQ05ZQFXNbMbsd/Y63S5ulQShuBVFw1qlfGRx3mntv/DShWZ3gHM3kDg6P+EMxR0SnGoM9SrSCkkVb8CxxZRQjoNhB38X9zpQ7NogBZQjJ4G4Rai4HEauly+U8oV8a3dNpYMRBk092zZURmwibhqog3gnbrtI4GGkYIgJchnXgQ17HU3jTqe533LEbayYxYq4RyqEfBIiyVHQcfyglMTokGdj2usRzeyhJZUV7C5sWjFDFXG7QuZCROmyinNgNOpe/fnTWtBxnb18QZ2rFjaGbBQIqeOFoW1k97lLs3OV+ftV5EhGQ46n0sQdjYETatKNlfVW38lYpqKGSSTFOkbLlDgKMIeJZKV31FCCo25LZMNErYLzP4rEECV0lMSBhJfqZr5YZEG8fXOZDtbAbcsh5LKSmqlrhZqsK2YSOWbJT5DUqS+kF9FVI/I6SGZCXuA8QekjZ9FfZCR4Z2UH/ZnjMwVNKsEhKP6jACkOtZnMI19BqS3rLsXJkSgqEbfbma+wdHzRUAHIqCbOiM0b1/bWbrW3aE6HiRm5MDnJsxOSlbtNo7UerWp6Vgo001bMiozzRMUqJOGoj6JMwgpiqtHjBP1aY5IG8bjUf+Jo7oGjFaxCqMoYVSL+l0DCvRFAhGH3j9oZU0IM+Lw48iJVjSWiyHGsqHrM4c76+vrKHadJi1k4NJ8t1CftYhnNSxgjdY64F3GFuIodu11N9yxQcOKboCa4M2okPCx35eGwF/a6rc6wOb+62++t337fXdVlBDUPXcePsjjwYhgOHMM0B3HY3FrLm7w0WU7Q0CY7JimNPAX1GyonULzba9tvrnqNLNxzjNSrufnZQzhju73uII6rhrpyZ7tSzi/MzNy+fU0CZX0rvNi/eWZh7FbXnaw36uNVNH6x1+x0m5RkavX5t966cXN1WGvIkmGrGiNPzlNOceR0qjnj9MnDe/s7V95awy6wsjbH9KkWATlnxM32/sZGjzAUh92JHDs1n6uWCQoxx0FK7EZua9Tfl2lsCDPnH1uY5l7v2pWN66vD5XXPi2hWHuDk7/S7JGjqENq2juLDwEGRRIVq+cEHFhZn6rhUw2Zk2oycQdTvx1rSn5+yTy1MzzeKURI4I7/ZDZp9pEF/MAhqlfzsoVoQJK1etDvgt3ajyyvRnsPHy2o2Z++03V9d5VSmqm3dWR9duNbc3O62R+TtDkoXfmKKFHNKRrOmy1lThb7rA9H90NvY3N5pjQK/o/MIZWW7s/Psy63/E2AAOTY7Y/TCa8QAAAAASUVORK5CYII=' },

    { id: 49188, icon: 'https://archeagecodex.com/items/icon_item_4833.png', grade: 2, name: 'Премиум-подписка на 7 дней' },

    { id: 1, type: '', icon: '', grade: 1, name: '' },
] as ItemBase[]).map(i => [i.id, i])) as Record<number, ItemBase>;

export const getItemCodexUrl = (item: ItemBase): string => (
    `${CODEX_ITEM_URL}${item.id}/${item.isGradeInferred ? `?grade=${item.grade}` : ''}`
);
