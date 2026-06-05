import { pageDocument, pageWindow, isArcheageSite } from '../../utils.js';
import tooltipStyles from './tooltip.scss';
import {
    ITEMS,
    GRADES,
    ITEM_TYPES,
    ITEM_SUB_TYPES,
    EQUIPMENT_SUB_TYPES,
    ICON_OVERLAY,
    MAX_LEVEL,
    HERO_LEVEL_ICON,
    CURRENCY_ICONS,
    getItemCodexUrl,
    getItemIconUrl,
    stripHtmlForMatch,
    cleanDynamicTooltipMarkup,
    hasVisibleTooltipText,
    parseGameMarkup,
    resolveItemPlaceholders,
    loadIconScalePercent,
    loadIconScaleBrowserZoom,
} from '../../data/items.js';

void ITEMS;

const LS_KEY_DYNAMIC_TOOLTIPS = 'tm_aa_dynamic_tooltips';
const DEBUG_PREFIX = '[ArcheAgeExtraUI]';
const debugWarn = (...args) => console.warn(DEBUG_PREFIX, ...args);

export const ITEM_STORE = new Map();
export const POPULATING_PROMISES = new Map();

/** @type {HTMLElement|null} */
let globalTooltip = null;

/** @type {Map<string, DynamicTooltipData|null|Promise<DynamicTooltipData|null>>} */
const dynamicTooltipCache = new Map();
let activeTooltipKey = null;
let tooltipDomInitialized = false;

const TOOLTIP_VISIBLE_CLASS = 'tm-item-tooltip--visible';
const TOOLTIP_RIGHT_CLASS = 'tm-item-tooltip--right';
const TOOLTIP_BOTTOM_CLASS = 'tm-item-tooltip--bottom';
const TOOLTIP_WIDTH = 248;

const getSystemScale = () => {
    if (loadIconScaleBrowserZoom()) return 1;
    return pageWindow.devicePixelRatio;
};

const getTooltipContainer = () => {
    if (globalTooltip) return globalTooltip;

    globalTooltip = pageDocument.createElement('div');
    globalTooltip.className = 'tm-item-tooltip';
    pageDocument.body.appendChild(globalTooltip);
    return globalTooltip;
};

const injectTooltipStyles = () => {
    if (pageDocument.getElementById('tm-item-tooltip-styles')) return;

    const style = pageDocument.createElement('style');
    style.id = 'tm-item-tooltip-styles';
    style.textContent = tooltipStyles;
    pageDocument.head.appendChild(style);
};

const initTooltipDom = () => {
    injectTooltipStyles();
    getTooltipContainer();
};

const resolveItemLevelValue = (levelValue, isMaxLevel = false) => {
    if (isMaxLevel && Number(levelValue) === 0) return MAX_LEVEL;
    return Number(levelValue);
};

const appendItemLevelValue = (container, levelValue, isMaxLevel = false) => {
    const level = resolveItemLevelValue(levelValue, isMaxLevel);
    if (Number.isFinite(level) && level > 55) {
        const icon = pageDocument.createElement('img');
        icon.className = 'tm-item-tooltip-hero-level-icon';
        icon.src = HERO_LEVEL_ICON;
        icon.alt = 'героический уровень';
        container.appendChild(icon);

        const value = pageDocument.createElement('span');
        value.className = 'inv-nc';
        value.textContent = String(level - 55);
        container.appendChild(value);
    } else {
        container.appendChild(pageDocument.createTextNode(String(levelValue)));
    }
};

const makeRequiredLevelLine = (reqLevel, maxLevel) => {
    const line = pageDocument.createElement('div');
    line.className = 'tm-item-tooltip-level';
    line.appendChild(pageDocument.createTextNode('Требуемый уровень: '));

    if (reqLevel != null) appendItemLevelValue(line, reqLevel);

    if (maxLevel != null) {
        line.appendChild(pageDocument.createTextNode('~'));
        appendItemLevelValue(line, maxLevel, true);
    }

    return line;
};

const formatSpeedStat = (value) => {
    const str = String(value).trim();
    if (!str.includes('.')) return `${str}.0`;

    const [whole, fraction = ''] = str.split('.');
    return `${whole}.${fraction || '0'}`;
};

const ITEM_UTILITY_STATS = [
    { field: 'speed', label: 'Сноровка', format: formatSpeedStat },
    { field: 'durability', label: 'Прочность', format: value => `${value}/${value}` },
];

const ITEM_COMBAT_STATS = [
    { field: 'dps', label: 'Урон', colon: true },
    { field: 'armor', label: 'Защита', colon: true },
    { field: 'magicResistance', label: 'Сопротивление', colon: true },
    { field: 'mdps', label: 'Сила заклинаний' },
    { field: 'hdps', label: 'Эффективность исцеления' },
    { field: 'str', label: 'Сила' },
    { field: 'dex', label: 'Ловкость' },
    { field: 'sta', label: 'Выносливость' },
    { field: 'int', label: 'Интеллект' },
    { field: 'spi', label: 'Мудрость' },
];

const isDisplayableItemStatValue = (value) => {
    if (value == null || value === '') return false;
    const num = Number(value);
    return !Number.isFinite(num) || num !== 0;
};

const getItemStatEntries = (item, stats) => (
    stats
        .map(stat => ({ ...stat, value: item[stat.field] }))
        .filter(stat => isDisplayableItemStatValue(stat.value))
);

const makeItemStatsSection = (entries) => {
    const section = pageDocument.createElement('div');
    section.className = 'tm-item-tooltip-stats';

    for (const entry of entries) {
        const row = pageDocument.createElement('div');
        row.className = 'tm-item-tooltip-stat-row';

        const label = pageDocument.createElement('span');
        label.className = 'tm-item-tooltip-stat-label';
        label.textContent = entry.colon ? `${entry.label}:` : entry.label;

        const value = pageDocument.createElement('span');
        value.className = 'tm-item-tooltip-stat-value';
        value.textContent = entry.format ? entry.format(entry.value) : String(entry.value);

        row.appendChild(label);
        row.appendChild(value);
        section.appendChild(row);
    }

    return section;
};

const appendPricePart = (container, amount, iconSrc, title) => {
    const part = pageDocument.createElement('span');
    part.className = 'tm-item-tooltip-price-part';

    const value = pageDocument.createElement('span');
    value.textContent = String(amount);
    part.appendChild(value);

    const icon = pageDocument.createElement('img');
    icon.className = 'tm-item-tooltip-price-icon';
    icon.src = iconSrc;
    icon.alt = title;
    icon.title = title;
    part.appendChild(icon);

    container.appendChild(part);
};

const makeItemPriceValue = (price) => {
    const value = pageDocument.createElement('span');
    value.className = 'tm-item-tooltip-price-value';

    const totalBronze = Math.max(0, Math.floor(Number(price) || 0));
    const gold = Math.floor(totalBronze / 10000);
    const silver = Math.floor((totalBronze % 10000) / 100);
    const bronze = totalBronze % 100;

    if (gold > 0) appendPricePart(value, gold, CURRENCY_ICONS.gold, 'золото');
    if (silver > 0) appendPricePart(value, silver, CURRENCY_ICONS.silver, 'серебро');
    if (bronze > 0 || totalBronze === 0) appendPricePart(value, bronze, CURRENCY_ICONS.bronze, 'бронза');

    return value;
};

const getItemDynamicTooltipKey = (item) => {
    if (item?.id == null || item.id === '') return null;
    const grade = Number.isFinite(Number(item.grade)) ? Number(item.grade) : 0;
    return `${item.id}|${grade}`;
};

/**
 * @param {number|string} itemId
 * @param {number|string} grade
 * @param {DynamicTooltipData} data
 */
const saveDynamicTooltipSnapshot = (itemId, grade, data) => {
    if (itemId == null || !data) return;

    try {
        const raw = localStorage.getItem(LS_KEY_DYNAMIC_TOOLTIPS);
        const all = raw ? JSON.parse(raw) : {};
        all[String(itemId)] = {
            id: String(itemId),
            grade: String(grade ?? 0),
            updatedAt: Date.now(),
            data,
        };
        localStorage.setItem(LS_KEY_DYNAMIC_TOOLTIPS, JSON.stringify(all));
    } catch (e) {
        debugWarn('Failed to save dynamic tooltip snapshot:', e);
    }
};

/**
 * @param {DynamicTooltipFieldValue|undefined} value
 * @returns {string|null}
 */
const dynamicTooltipFieldValue = (value) => {
    if (value == null) return null;
    const str = String(value).trim();
    return str ? str : null;
};

/**
 * @param {DynamicTooltipFieldValue|undefined} value
 * @returns {number|null}
 */
const dynamicTooltipNumberValue = (value) => {
    if (value == null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

/**
 * @param {DynamicTooltipFieldValue|undefined} value
 * @returns {number|string|null}
 */
const dynamicTooltipStatValue = (value) => {
    if (value == null || value === '') return null;
    const str = String(value).trim();
    if (!str) return null;

    const num = Number(str);
    return Number.isFinite(num) ? num : str;
};

const DYNAMIC_EQUIP_TOOLTIP_PATTERNS = [
    /Здоровье/,
    /Защита/,
    /Сопротивление/,
    /Скорость\s+(?:передвижения|плавания|занятия|сбора)/,
    /Опыт\s+при\s+занятии/,
    /Время\s+применения\s+умений/,
];

const isDynamicEquipTooltipPart = (value) => {
    const text = stripHtmlForMatch(value);
    return DYNAMIC_EQUIP_TOOLTIP_PATTERNS.some(pattern => pattern.test(text));
};

/**
 * @param {DynamicTooltipFieldValue|undefined} value
 * @returns {Partial<ItemBase>}
 */
const mapDynamicEquipTooltip = (value) => {
    const raw = dynamicTooltipFieldValue(value);
    if (!raw) return {};

    const parts = raw
        .split(/<br\s*\/?>/i)
        .map(part => cleanDynamicTooltipMarkup(part))
        .filter(Boolean);

    const equipIndex = parts.findIndex(isDynamicEquipTooltipPart);
    if (equipIndex === -1) {
        const useDescription = cleanDynamicTooltipMarkup(raw);
        return useDescription ? { useDescription } : {};
    }

    const equipParts = [];
    let nextIndex = equipIndex;
    while (nextIndex < parts.length && isDynamicEquipTooltipPart(parts[nextIndex])) {
        equipParts.push(parts[nextIndex]);
        nextIndex++;
    }

    const result = {
        equipDescription: equipParts.join('<br/>'),
    };

    if (equipIndex > 0 && /^Действует\b/i.test(stripHtmlForMatch(parts[equipIndex - 1]))) {
        result.isEquipDescriptionTemporary = true;
    }

    const useDescription = cleanDynamicTooltipMarkup(parts.slice(nextIndex).join('<br/>'));
    if (useDescription) result.useDescription = useDescription;

    return result;
};

/**
 * @param {DynamicTooltipData|null} data
 * @returns {Partial<ItemBase>}
 */
const mapDynamicTooltipToItem = (data) => {
    if (!data || typeof data !== 'object') return {};

    const fixedGrade = dynamicTooltipNumberValue(data.fixed_grade);
    const apiGrade = dynamicTooltipNumberValue(data.grade);
    const grade = fixedGrade != null && fixedGrade >= 0 ? fixedGrade : apiGrade;
    const reqLevel = dynamicTooltipNumberValue(data.level_requirement);
    const maxLevel = dynamicTooltipNumberValue(data.level_limit);
    const hasRefund = Object.prototype.hasOwnProperty.call(data, 'refund');
    const price = data.refund === null ? null : dynamicTooltipNumberValue(data.refund);
    const description = cleanDynamicTooltipMarkup(data.description);
    const equipTooltipFields = mapDynamicEquipTooltip(data.equip_tooltip);
    const setDescription = cleanDynamicTooltipMarkup(data.set_description);

    return {
        ...(dynamicTooltipFieldValue(data.filename) ? { icon: dynamicTooltipFieldValue(data.filename) } : {}),
        ...(dynamicTooltipFieldValue(data.name) ? { name: dynamicTooltipFieldValue(data.name) } : {}),
        ...(grade != null && grade >= 0 ? { grade } : {}),
        ...(description ? { description } : {}),
        ...equipTooltipFields,
        ...(setDescription ? { equipDescription: setDescription } : {}),
        ...(dynamicTooltipFieldValue(data.cat_name) ? { apiCategoryTitle: dynamicTooltipFieldValue(data.cat_name) } : {}),
        ...(reqLevel != null && reqLevel > 0 ? { reqLevel } : {}),
        ...(maxLevel != null && maxLevel >= 0 ? { maxLevel } : {}),
        ...(hasRefund && (price !== null || data.refund === null) ? { price } : {}),
        ...(dynamicTooltipStatValue(data.c_speed) != null ? { speed: dynamicTooltipStatValue(data.c_speed) } : {}),
        ...(dynamicTooltipStatValue(data.c_durability) != null ? { durability: dynamicTooltipStatValue(data.c_durability) } : {}),
        ...(dynamicTooltipStatValue(data.c_dps) != null ? { dps: dynamicTooltipStatValue(data.c_dps) } : {}),
        ...(dynamicTooltipStatValue(data.c_armor) != null ? { armor: dynamicTooltipStatValue(data.c_armor) } : {}),
        ...(dynamicTooltipStatValue(data.c_magic_resistance) != null ? { magicResistance: dynamicTooltipStatValue(data.c_magic_resistance) } : {}),
        ...(dynamicTooltipStatValue(data.c_mdps) != null ? { mdps: dynamicTooltipStatValue(data.c_mdps) } : {}),
        ...(dynamicTooltipStatValue(data.c_hdps) != null ? { hdps: dynamicTooltipStatValue(data.c_hdps) } : {}),
        ...(dynamicTooltipStatValue(data.c_str) != null ? { str: dynamicTooltipStatValue(data.c_str) } : {}),
        ...(dynamicTooltipStatValue(data.c_dex) != null ? { dex: dynamicTooltipStatValue(data.c_dex) } : {}),
        ...(dynamicTooltipStatValue(data.c_sta) != null ? { sta: dynamicTooltipStatValue(data.c_sta) } : {}),
        ...(dynamicTooltipStatValue(data.c_int) != null ? { int: dynamicTooltipStatValue(data.c_int) } : {}),
        ...(dynamicTooltipStatValue(data.c_spi) != null ? { spi: dynamicTooltipStatValue(data.c_spi) } : {}),
    };
};

const itemHasTooltipField = (item, field) => (
    field === 'price'
        ? Object.prototype.hasOwnProperty.call(item, field)
        : item[field] != null && item[field] !== ''
);

/**
 * @param {ItemBase} item
 * @param {DynamicTooltipData|null} data
 * @returns {ItemBase}
 */
const mergeDynamicTooltipItem = (item, data) => {
    const apiItem = mapDynamicTooltipToItem(data);
    const merged = { ...item };

    for (const [field, value] of Object.entries(apiItem)) {
        if (field === 'buff') {
            merged.buff = { ...(value || {}), ...(merged.buff || {}) };
            continue;
        }
        if (!itemHasTooltipField(merged, field)) merged[field] = value;
    }

    return merged;
};

/**
 * @param {ItemBase} item
 * @returns {Promise<DynamicTooltipData|null>}
 */
const fetchDynamicTooltipData = async (item) => {
    if (!isArcheageSite) return null;

    const key = getItemDynamicTooltipKey(item);
    if (!key) return null;
    if (dynamicTooltipCache.has(key)) return dynamicTooltipCache.get(key);

    const grade = Number.isFinite(Number(item.grade)) ? Number(item.grade) : 0;
    const promise = fetch(`/dynamic/tooltip/?a=item&id=${encodeURIComponent(item.id)}&g=${encodeURIComponent(grade)}`, {
        credentials: 'include',
        cache: 'no-store',
    })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
            if (data && typeof data === 'object') saveDynamicTooltipSnapshot(item.id, grade, data);
            return data && typeof data === 'object' ? data : null;
        })
        .catch(e => {
            debugWarn(`Failed to fetch dynamic tooltip for item ${item.id}:`, e);
            return null;
        });

    dynamicTooltipCache.set(key, promise);
    const data = await promise;
    dynamicTooltipCache.set(key, data);
    return data;
};

export const makeItemIconLink = ({ item, linked = false, size = 'medium', count, noTooltip = false }) => {
    const icon = pageDocument.createElement(linked ? 'a' : 'div');
    icon.className = `tm-item-icon tm-item-icon--${size}`;

    if (linked) {
        icon.href = getItemCodexUrl(item);
        icon.target = '_blank';
        icon.rel = 'noopener noreferrer';
        icon.addEventListener('click', (e) => e.stopPropagation());
    }

    const itemImg = pageDocument.createElement('img');
    itemImg.className = 'tm-item-icon-img';
    itemImg.src = getItemIconUrl(item);
    itemImg.dataset.itemId = item.id;
    itemImg.dataset.iconTemplate = item.icon || '';
    itemImg.dataset.iconM = item.iconM || '';
    itemImg.dataset.iconF = item.iconF || '';
    icon.appendChild(itemImg);

    const overlay = ICON_OVERLAY[item.overlay]?.icon;
    if (overlay) {
        const overlayImg = pageDocument.createElement('img');
        overlayImg.className = 'tm-item-icon-overlay';
        overlayImg.src = overlay;
        icon.appendChild(overlayImg);
    }

    const gradeInfo = GRADES[item.grade];
    if (gradeInfo) {
        const gradeImg = pageDocument.createElement('img');
        gradeImg.className = 'tm-item-icon-grade';
        gradeImg.src = gradeInfo.overlay;
        gradeImg.alt = gradeInfo.title || '';
        icon.appendChild(gradeImg);
    }

    if (count && count > 1) {
        const countEl = pageDocument.createElement('div');
        countEl.className = 'tm-item-icon-count';
        countEl.textContent = count;
        icon.appendChild(countEl);
    }

    if (!noTooltip) {
        icon.addEventListener('mouseenter', () => showTooltip(icon, item));
        icon.addEventListener('mouseleave', hideTooltip);
    }

    return icon;
};

/**
 * Заполняет тултип данными предмета.
 * @param {ItemBase} item
 */
const populateTooltip = (item) => {
    const tooltip = getTooltipContainer();
    tooltip.innerHTML = '';

    const gradeInfo = GRADES[item.grade];

    const headerSection = pageDocument.createElement('div');
    headerSection.className = 'tm-item-tooltip-header';

    const iconEl = makeItemIconLink({ item, noTooltip: true });
    headerSection.appendChild(iconEl);

    const tipMeta = pageDocument.createElement('div');
    tipMeta.className = 'tm-item-tooltip-meta';

    const subTypeInfo = ITEM_SUB_TYPES[item.subType];
    const typeInfo = subTypeInfo || ITEM_TYPES[item.type];
    const typeTitle = typeInfo?.title || item.apiCategoryTitle;
    if (typeTitle) {
        const typeLine = pageDocument.createElement('div');
        typeLine.className = 'tm-item-tooltip-type';
        typeLine.textContent = typeTitle;
        tipMeta.appendChild(typeLine);
    }

    if (gradeInfo?.title && !(item.grade === 1 && item.type !== 'equipment')) {
        const gradeLine = pageDocument.createElement('div');
        gradeLine.className = 'tm-item-tooltip-grade';
        if (gradeInfo.color) gradeLine.style.color = gradeInfo.color;
        gradeLine.textContent = gradeInfo.title;
        tipMeta.appendChild(gradeLine);
    }

    const nameLine = pageDocument.createElement('div');
    nameLine.className = 'tm-item-tooltip-name';
    if (gradeInfo?.color) nameLine.style.color = gradeInfo.color;
    nameLine.textContent = item.name || '';
    tipMeta.appendChild(nameLine);

    headerSection.appendChild(tipMeta);
    tooltip.appendChild(headerSection);

    if (item.isPersonal || item.reqLevel != null || item.maxLevel != null) {
        const sep = pageDocument.createElement('div');
        sep.className = 'tm-item-tooltip-sep';
        tooltip.appendChild(sep);

        const reqSection = pageDocument.createElement('div');
        reqSection.className = 'tm-item-tooltip-req';
        if (item.reqLevel != null || item.maxLevel != null) {
            reqSection.appendChild(makeRequiredLevelLine(item.reqLevel, item.maxLevel));
        }
        if (item.isPersonal) {
            const p = pageDocument.createElement('div');
            p.textContent = 'Персональный предмет';
            reqSection.appendChild(p);
        }
        tooltip.appendChild(reqSection);
    }

    const utilityStatEntries = getItemStatEntries(item, ITEM_UTILITY_STATS);
    if (utilityStatEntries.length) {
        const sep = pageDocument.createElement('div');
        sep.className = 'tm-item-tooltip-sep';
        tooltip.appendChild(sep);
        tooltip.appendChild(makeItemStatsSection(utilityStatEntries));
    }

    const combatStatEntries = getItemStatEntries(item, ITEM_COMBAT_STATS);
    if (combatStatEntries.length) {
        const sep = pageDocument.createElement('div');
        sep.className = 'tm-item-tooltip-sep';
        tooltip.appendChild(sep);
        tooltip.appendChild(makeItemStatsSection(combatStatEntries));
    }

    const equipmentSubTypeInfo = EQUIPMENT_SUB_TYPES[item.equipmentSubType];
    if (equipmentSubTypeInfo?.title) {
        const sep = pageDocument.createElement('div');
        sep.className = 'tm-item-tooltip-sep';
        tooltip.appendChild(sep);

        const equipmentSubTypeSection = pageDocument.createElement('div');
        equipmentSubTypeSection.className = 'tm-item-tooltip-equipment-subtype';
        equipmentSubTypeSection.textContent = equipmentSubTypeInfo.title;
        tooltip.appendChild(equipmentSubTypeSection);
    }

    const hasUseDescription = item.useDescription && hasVisibleTooltipText(item.useDescription);
    if (item.description || hasUseDescription || item.equipDescription) {
        const sep = pageDocument.createElement('div');
        sep.className = 'tm-item-tooltip-sep';
        tooltip.appendChild(sep);

        const descriptionSection = pageDocument.createElement('div');
        descriptionSection.className = 'tm-item-tooltip-desc';
        if (item.description) {
            const descText = pageDocument.createElement('div');
            descText.innerHTML = parseGameMarkup(resolveItemPlaceholders(item.description, item));
            descriptionSection.appendChild(descText);
        }
        if (hasUseDescription) {
            const useBlock = pageDocument.createElement('div');
            useBlock.className = 'tm-item-tooltip-use';
            const useLabel = pageDocument.createElement('div');
            useLabel.className = 'tm-item-tooltip-use-label';
            useLabel.textContent = 'Использование';
            const useText = pageDocument.createElement('div');
            useText.className = 'tm-item-tooltip-use-text';
            useText.innerHTML = parseGameMarkup(resolveItemPlaceholders(item.useDescription, item));
            useBlock.appendChild(useLabel);
            useBlock.appendChild(useText);
            descriptionSection.appendChild(useBlock);
        }
        if (item.equipDescription) {
            const equipBlock = pageDocument.createElement('div');
            equipBlock.className = 'tm-item-tooltip-use';
            const equipLabel = pageDocument.createElement('div');
            equipLabel.className = 'tm-item-tooltip-use-label';
            equipLabel.textContent = item.isEquipDescriptionTemporary ? 'Экипировка (временно)' : 'Экипировка';
            const equipText = pageDocument.createElement('div');
            equipText.className = 'tm-item-tooltip-use-text';
            equipText.innerHTML = parseGameMarkup(resolveItemPlaceholders(item.equipDescription, item));
            equipBlock.appendChild(equipLabel);
            equipBlock.appendChild(equipText);
            descriptionSection.appendChild(equipBlock);
        }
        tooltip.appendChild(descriptionSection);
    }

    if (item.price !== undefined) {
        const sep = pageDocument.createElement('div');
        sep.className = 'tm-item-tooltip-sep';
        tooltip.appendChild(sep);

        const priceSection = pageDocument.createElement('div');
        priceSection.className = 'tm-item-tooltip-price';
        if (item.price === null || Number(item.price) === 0) {
            priceSection.className = 'tm-item-tooltip-price tm-item-tooltip-price--none';
            priceSection.textContent = 'Этот предмет не нужен торговцам.';
        } else {
            const label = pageDocument.createElement('span');
            label.textContent = 'Цена\nпродажи:';
            priceSection.appendChild(label);
            priceSection.appendChild(makeItemPriceValue(item.price));
        }
        tooltip.appendChild(priceSection);
    }
};

const positionTooltip = (anchorEl) => {
    const tooltip = getTooltipContainer();
    const rect = anchorEl.getBoundingClientRect();
    const screenScale = getSystemScale();
    const scale = (1 / screenScale) * (loadIconScalePercent() / 100);

    const tooltipLeftEdge = rect.left + 8 - TOOLTIP_WIDTH * scale;
    const showOnRight = tooltipLeftEdge < 0;

    tooltip.classList.add(TOOLTIP_VISIBLE_CLASS);
    tooltip.style.setProperty('--tm-tooltip-scale', `${scale}`);
    const tooltipHeight = tooltip.offsetHeight * scale;
    const showFromBottom = (rect.bottom - 8 + tooltipHeight) > pageWindow.innerHeight;

    if (showFromBottom) {
        const topEdge = rect.top + 8 - tooltipHeight;
        if (topEdge < 0) {
            tooltip.style.setProperty('--tm-tooltip-top', '0px');
            tooltip.classList.remove(TOOLTIP_BOTTOM_CLASS);
        } else {
            tooltip.style.setProperty('--tm-tooltip-top', `${rect.top + 8}px`);
            tooltip.classList.add(TOOLTIP_BOTTOM_CLASS);
        }
    } else {
        tooltip.style.setProperty('--tm-tooltip-top', `${rect.bottom - 8}px`);
        tooltip.classList.remove(TOOLTIP_BOTTOM_CLASS);
    }

    if (showOnRight) {
        tooltip.style.setProperty('--tm-tooltip-left', `${rect.right - 8}px`);
        tooltip.classList.add(TOOLTIP_RIGHT_CLASS);
    } else {
        tooltip.style.setProperty('--tm-tooltip-left', `${rect.left + 8}px`);
        tooltip.classList.remove(TOOLTIP_RIGHT_CLASS);
    }
};

/**
 * Показывает тултип рядом с элементом.
 * @param {HTMLElement} anchorEl
 * @param {ItemBase} item
 */
export const showTooltip = (anchorEl, item) => {
    initTooltipDom();
    const tooltipKey = getItemDynamicTooltipKey(item) || `${Date.now()}:${Math.random()}`;
    activeTooltipKey = tooltipKey;
    populateTooltip(item);
    positionTooltip(anchorEl);

    fetchDynamicTooltipData(item).then(data => {
        if (!data || activeTooltipKey !== tooltipKey) return;

        populateTooltip(mergeDynamicTooltipItem(item, data));
        positionTooltip(anchorEl);
    });
};

/** Скрывает тултип. */
export const hideTooltip = () => {
    activeTooltipKey = null;
    if (globalTooltip) {
        globalTooltip.classList.remove(TOOLTIP_VISIBLE_CLASS, TOOLTIP_RIGHT_CLASS, TOOLTIP_BOTTOM_CLASS);
    }
};

const getDelegatedTooltipItem = (target) => {
    const icon = target?.closest?.('.tm-item-icon[data-item-id], [data-tm-tooltip-item-id], [data-item-id]');
    const itemId = icon?.dataset?.tmTooltipItemId || icon?.dataset?.itemId;
    if (!itemId) return null;

    const item = ITEM_STORE.get(String(itemId)) || ITEM_STORE.get(Number(itemId)) || ITEMS[itemId];
    return item ? { icon, item } : null;
};

export const handleItemIconMouseEnter = (event) => {
    const found = getDelegatedTooltipItem(event.target);
    if (found) showTooltip(found.icon, found.item);
};

export const initTooltips = () => {
    initTooltipDom();
    if (tooltipDomInitialized) return;
    tooltipDomInitialized = true;

    pageDocument.addEventListener('mouseover', (event) => {
        const found = getDelegatedTooltipItem(event.target);
        if (!found || found.icon.contains(event.relatedTarget)) return;
        showTooltip(found.icon, found.item);
    });
    pageDocument.addEventListener('mouseout', (event) => {
        const found = getDelegatedTooltipItem(event.target);
        if (!found || found.icon.contains(event.relatedTarget)) return;
        hideTooltip();
    });
};

export const initTooltip = initTooltips;
