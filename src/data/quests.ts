import { ITEMS } from './items.js';

export const CODEX_BASE = 'https://archeagecodex.com/ru/quest/';
export const CODEX_IMAGES_BASE = 'https://archeagecodex.com/images/';
export const ICON_QUEST = 'https://archeagecodex.com/images/icon_quest_common.png';
export const ICON_VEKSEL = 'https://aa.cdn.gmru.net/ms/data/game-icons/e046763d68cd5d1b2dbd5513fc845e07.png';
export const ICON_VEKSEL_NORTH = 'https://aa.cdn.gmru.net/ms/data/game-icons/6a0ac94699b0c4d678470feb07f3fa85.png';
export const ICON_GISAA_OVERLAY = 'https://gisaa.ru/img/gisaa.svg?v=1';
export const VEKSEL_BASE = 'https://gisaa.ru/veksel/';

/**
 * @typedef {Object} Slot
 * @property {ItemBase} item - Предмет.
 * @property {number} [count] - Количество предмета.
 */

/**
 * @typedef {Object} EventSchedule
 * @property {string} timeStart - Время начала события (HH:MM).
 * @property {string} [timeEnd] - Время окончания события (HH:MM). Если указано — событие длится диапазон.
 * @property {number[]} [weekdays] - Дни недели (1–7), если не каждый день.
 * @property {number} [duration] - Примерная длительность события (в минутах).
 */

/**
 * @typedef {Object} Quest
 * @property {number} id - ID квеста.
 * @property {string} title - Название квеста.
 * @property {number[]} marathonId - Известные ID заданий в марафоне для точного сопоставления.
 * @property {string} short - Краткое описание / пояснение.
 * @property {'blue_salt'|'north'} [veksel] - Тип векселя.
 * @property {string[]} [locations] - Локации выполнения.
 * @property {number[]} [availableWeekdays] - Дни недели, в которые квест можно взять (0 - понедельник, 6 - воскресенье).
 * @property {Slot} [slot] - Предмет с количеством.
 * @property {EventSchedule[]} [schedule] - Расписание событий.
 */

/** @type {Quest[]} */
export const QUESTS = [
    { marathonId: [8246], id: 10559, title: "Чужие коконы", short: "Ифнир (Каменные крылья) - 10 коконов" },
    { marathonId: [8248, 8804], id: 9142, title: "Плотницкая нужда", short: "", veksel: 'blue_salt', slot: { item: ITEMS[8337], count: 60 } },
    { marathonId: [8250, 8806], id: 9318, title: "Дети Ольха", short: 'Квест на Взрослого ольхона (портал "Укромный утес")' },
    { marathonId: [8252, 8808], id: 10512, title: "Котомки эфенского странника I", short: "", veksel: 'north', locations: ["Бухта Китобоев", "Эфен'Хал"], slot: { item: ITEMS[43176], count: 20 } },
    { marathonId: [8254, 8810], id: 10513, title: "Котомки эфенского странника II", short: "", veksel: 'north', locations: ["Бухта Китобоев", "Эфен'Хал"], slot: { item: ITEMS[43176], count: 60 } },
    { marathonId: [8256, 8812], id: 9100, title: "Старый враг", short: "Библа, 2-ой босс" },
    { marathonId: [8258, 8814], id: 7658, title: "Требуется экзорцист (героич.)", short: "" },
    { marathonId: [8260, 8816], id: 6797, title: "Опасность для моряков", short: "15 жуков/медуз в море (не забыть сдать)" },
    { marathonId: [8262, 8818], id: 8998, title: "Бесконечный бой", short: "" },
    { marathonId: [8268, 8824], id: 5972, title: "И на дару бывает прору...", short: "Чешуя Ашьяры, Кольцо Лореи, Кольцо Гленна" },
    { marathonId: [8274, 8830], id: 10480, title: "Состязание союзов в Академии", short: "" },
    { marathonId: [8282, 8838], id: 7154, title: "Темница Дауты", short: "" },
    { marathonId: [8284, 8840], id: 9137, title: "Железо для корабелов", short: "", veksel: 'blue_salt', slot: { item: ITEMS[8318], count: 60 } },
    { marathonId: [8286, 8842], id: 8000131, title: "Вдали от обезумевшего мира", short: "Квест Нуи на 500 очков работы" },
    { marathonId: [8288, 8844], id: 10508, title: "Расшитые жемчугом кошельки I", short: "", veksel: 'north', locations: ["Бездна", "Солнечные поля"], slot: { item: ITEMS[40928], count: 25 } },
    { marathonId: [8290, 8846], id: 10509, title: "Расшитые жемчугом кошельки II", short: "", veksel: 'north', locations: ["Бездна", "Солнечные поля"], slot: { item: ITEMS[40928], count: 75 } },
    { marathonId: [8292, 8848], id: 5092, title: "Отличные фитили", short: `<a href="https://archeageon.ru/kvesty/konsortsiuma-sinej-soli/261-kvesty-ot-parfyumera-na-dz-vostok-arheidj#porychenie" target="_blank">Парфюмер на востоке</a>` },
    { marathonId: [8294, 8850], id: 7659, title: "Требуются работники (героич.)", short: "" },
    { marathonId: [8296, 8852], id: 7817, title: "Опасности окольных дорог", short: "" },
    { marathonId: [8298, 8854], id: 8000058, title: "Лицензия на убийство: Баррага Безумный", short: "Нагашар (только обычка)", slot: { item: ITEMS[8000749] } },
    { marathonId: [8300, 8856], id: 5971, title: "Чешуя Ашьяры", short: "", schedule: [{ timeStart: "03:20" }, { timeStart: "07:20" }, { timeStart: "11:20" }, { timeStart: "15:20" }, { timeStart: "19:20" }, { timeStart: "23:20" }] },
    { marathonId: [8314, 8870], id: 10564, title: "Освобожденные узницы Нагашара", short: "Ифнир - змея", schedule: [{ timeStart: "22:00", weekdays: [5] }, { timeStart: "16:00", weekdays: [6] }] },
    { marathonId: [8316, 8872], id: 8000061, title: "Лицензия на убийство: Иштар", short: "Сады наслаждений (только хард)", slot: { item: ITEMS[8000752] } },
    { marathonId: [8318, 8874], id: 9317, title: "Охота на крупную дичь", short: 'Квест на Космача (портал "Зимний Очаг")' },
    { marathonId: [8320, 8876], id: 9152, title: "Книжные обложки", short: "", veksel: 'blue_salt', slot: { item: ITEMS[16327], count: 60 } },
    { marathonId: [8322, 8878], id: 8435, title: "Чистота и порядок", short: 'Портал "Лягушачьи пруды"' },
    { marathonId: [8324, 8880], id: 10510, title: "Фермерские сундучки со всякой всячиной I", short: "", veksel: 'north', locations: ["Бездна", "Солнечные поля"], slot: { item: ITEMS[42077], count: 8 } },
    { marathonId: [8326, 8882], id: 10511, title: "Фермерские сундучки со всякой всячиной II", short: "", veksel: 'north', locations: ["Бездна", "Солнечные поля"], slot: { item: ITEMS[42077], count: 25 } },
    { marathonId: [8328, 8884], id: 7657, title: "Разыскивается: О'Карф (героич.)", short: "" },
    { marathonId: [8330, 8886], id: 7813, title: "Преграда на пути", short: "" },
    { marathonId: [8336, 8892], id: 5144, title: "Разгром призрачного легиона", short: "Призрачный (ночной) разлом", schedule: [{ timeStart: "02:20" }, { timeStart: "06:20" }, { timeStart: "10:20" }, { timeStart: "14:20" }, { timeStart: "18:20" }, { timeStart: "22:20" }] },
    { marathonId: [8338, 8894], id: 5885, title: "Советник Кириоса", short: "Анталлон на Солнечных полях", schedule: [{ timeStart: "01:20" }, { timeStart: "05:20" }, { timeStart: "09:20" }, { timeStart: "13:20" }, { timeStart: "17:20" }, { timeStart: "21:20" }] },
    { marathonId: [8340, 8896], id: 8000060, title: "Лицензия на убийство: иферийцы (низк., обычн.)", short: "Сады наслаждений (изи или нормал)", slot: { item: ITEMS[8000751] } },
    { marathonId: [8346, 8902], id: 10056, title: "Садовые работы**", short: "Квест можно взять в любое время, боссы:", schedule: [{ timeStart: "03:00" }, { timeStart: "07:00" }, { timeStart: "11:00" }, { timeStart: "15:00" }, { timeStart: "19:00" }, { timeStart: "23:00" }] },
    { marathonId: [8348, 8904], id: 11154, title: "Бой с тенью", short: "Лиловый (армия фантомов)", schedule: [{ timeStart: "01:50" }, { timeStart: "05:50" }, { timeStart: "09:50" }, { timeStart: "13:50" }, { timeStart: "17:50" }, { timeStart: "21:50" }] },
    { marathonId: [8350, 8906], id: 11227, title: "Билет в один конец", short: 'Превратиться в <a href="https://archeagecodex.com/ru/buff/32459/" target="_blank" rel="noopener noreferrer" title="Перевоплощение в дару" class="tm-inline-icon"><img src="https://archeagecodex.com/items/icon_skill_buff691.png" alt=""></a>дару, получить и использовать <a href="https://archeagecodex.com/ru/item/54615/" target="_blank" rel="noopener noreferrer" title="Разрешение на работу: билет в один конец" class="tm-inline-icon tm-inline-icon--graded"><img src="https://archeagecodex.com/items/icon_item_0226.png" alt=""><img src="https://archeagecodex.com/images/icon_grade3.png" alt="" class="tm-inline-icon-grade"></a>, потратить 500 ОР (идти в данж не надо)' },
    { marathonId: [8352, 8908], id: 9147, title: "С миру по нитке", short: "", veksel: 'blue_salt', slot: { item: ITEMS[8256], count: 60 } },
    { marathonId: [8354, 8910], id: 8000136, title: "В гармонии с собой", short: "Квест Нуи на 2500 ремесленки" },
    { marathonId: [8356, 8912], id: 10506, title: "Резные сундучки со всякой всячиной I", short: "", veksel: 'north', locations: ["Замок Ош"], slot: { item: ITEMS[42076], count: 10 } },
    { marathonId: [8358, 8914], id: 10507, title: "Резные сундучки со всякой всячиной II", short: "", veksel: 'north', locations: ["Замок Ош"], slot: { item: ITEMS[42076], count: 30 } },
    { marathonId: [8360, 8916], id: 5091, title: "Взрывоопасное поручение", short: `<a href="https://archeageon.ru/kvesty/konsortsiuma-sinej-soli/260-kvesty-ot-parfyumera-na-dz-v-arheidj#porychenie" target="_blank">Парфюмер на западе</a>` },
    { marathonId: [8362, 8918], id: 9101, title: "Неприступная башня", short: "Библа, 3-ий босс" },
    { marathonId: [8364, 8920], id: 7656, title: "Разыскивается: Акмит (героич.)", short: "" },
    { marathonId: [8366, 8922], id: 9320, title: "Война во имя славы союза", short: "" },
    { marathonId: [8372, 8928], id: 9297, title: "Орды Земель покоя", short: "", availableWeekdays: [6] },
    { marathonId: [8380, 8936], id: 7815, title: "Три новости, и все плохие", short: "Изи/нормал Сады наслаждений" },
    { marathonId: [8382, 8938], id: 10735, title: "Предводитель демонов", short: "Эншака на Солнечных полях", schedule: [{ timeStart: "01:20" }, { timeStart: "05:20" }, { timeStart: "09:20" }, { timeStart: "13:20" }, { timeStart: "17:20" }, { timeStart: "21:20" }] },
    { marathonId: [8388, 8944], id: 9153, title: "Ремесленная одежда", short: "", veksel: 'blue_salt', slot: { item: ITEMS[16327], count: 100 } },
    { marathonId: [8390, 8946], id: 5062, title: "Бей мандрагору!", short: "" },
    { marathonId: [8392, 8948], id: 10514, title: "Эфенские сундучки со всякой всячиной I", short: "", veksel: 'north', locations: ["Бухта Китобоев", "Эфен'Хал"], slot: { item: ITEMS[43177], count: 7 } },
    { marathonId: [8394, 8950], id: 10515, title: "Эфенские сундучки со всякой всячиной II", short: "", veksel: 'north', locations: ["Бухта Китобоев", "Эфен'Хал"], slot: { item: ITEMS[43177], count: 20 } },
    { marathonId: [8396, 8952], id: 7155, title: "Откровение Бездны", short: "Нагашар обычка" },
    { marathonId: [8398, 8954], id: 9398, title: "Состязание союзов", short: "100 мобов на Пустоши Корвуса" },
    { marathonId: [8400, 8956], id: 7152, title: "Мемориальная доска (гер.)", short: "" },
    { marathonId: [8402, 8958], id: 9102, title: "Стокнижное чудище", short: "Библа, голем" },
    { marathonId: [8404], id: 9205, title: "Последний день Ирамканда", short: "", schedule: [{ timeStart: "0:40", timeEnd: "1:20" }, { timeStart: "12:00", timeEnd: "12:40" }, { timeStart: "17:00", timeEnd: "17:40" }, { timeStart: "20:00", timeEnd: "20:40" }] },
    { marathonId: [8414, 8972], id: 10952, title: "Бой с «Летучим харнийцем»", short: "" },
    { marathonId: [8422, 8980], id: 10304, title: "Тайны святилища", short: "" },
    { marathonId: [8424, 8982], id: 9099, title: "Обитель архивариуса", short: "Библа, первый босс" },
    { marathonId: [8426, 8984], id: 9143, title: "Раз трактир, два трактир", short: "", veksel: 'blue_salt', slot: { item: ITEMS[8337], count: 100 } },
    { marathonId: [8434, 8992], id: 10504, title: "Полновесные мешочки с серебром I", short: "", veksel: 'north', locations: ["Замок Ош"], slot: { item: ITEMS[35461], count: 30 } },
    { marathonId: [8436, 8994], id: 10505, title: "Полновесные мешочки с серебром II", short: "", veksel: 'north', locations: ["Замок Ош"], slot: { item: ITEMS[35461], count: 90 } },
    { marathonId: [8438, 8996], id: 8000062, title: "Лицензия на убийство: повелитель подземелья (героич.)", short: "Аль-Харба / Ферма / Колыбель / Воющая Бездна / Копи / Арсенал", slot: { item: ITEMS[8000753] } },
    { marathonId: [8448, 9006], id: 2943, title: "Элитные войска Кровавой армии", short: "Кровавый (дневной) разлом - 3-я волна", schedule: [{ timeStart: "00:20" }, { timeStart: "04:20" }, { timeStart: "08:20" }, { timeStart: "12:20" }, { timeStart: "16:20" }, { timeStart: "20:20" }] },
    { marathonId: [8450, 9008], id: 7935, title: "Хранитель Звенящего ущелья**", short: "Гардум", schedule: [{ timeStart: "12:40", timeEnd: "13:20" }, { timeStart: "17:40", timeEnd: "18:20" }, { timeStart: "20:40", timeEnd: "21:20" }] },
    { marathonId: [8452, 9010], id: 7660, title: "Герой с крепким рассудком (героич.)", short: "" },
    { marathonId: [8470, 9028], id: 10739, title: "Призрачный предводитель", short: "Призрачный (ночной) разлом - Эншака", schedule: [{ timeStart: "02:20" }, { timeStart: "06:20" }, { timeStart: "10:20" }, { timeStart: "14:20" }, { timeStart: "18:20" }, { timeStart: "22:20" }] },
    { marathonId: [8478, 9030], id: 10423, title: "Голиаф, механический скарабей", short: "" },
    { marathonId: [8494, 9032], id: 8635, title: "Срочная доставка", short: "" },
    { marathonId: [8496, 9034], id: 9295, title: "Орды Сальфимара", short: "", availableWeekdays: [1, 4] },
    { marathonId: [8498, 9036], id: 9294, title: "Орды Нуимара", short: "", availableWeekdays: [0, 3] },
    { marathonId: [8500, 9050], id: 8637, title: "Старый друг – новый враг", short: "Бухта - Жакар" },
    { marathonId: [8502, 9040], id: 7327, title: "Взгляд слепца", short: "50 мобов (100 очков) на Сверкающем побережье" },
    { marathonId: [8504, 9042], id: 9296, title: "Орды Сангемара", short: "", availableWeekdays: [2, 5] },
    { marathonId: [8506, 9044], id: 5969, title: "Кольцо Лореи", short: "", schedule: [{ timeStart: "03:20" }, { timeStart: "07:20" }, { timeStart: "11:20" }, { timeStart: "15:20" }, { timeStart: "19:20" }, { timeStart: "23:20" }] },
    { marathonId: [8508, 9062], id: 8641, title: "Наступление кир'феров", short: "Эфен - жаба (через 5 минут после начала войны)" },
    { marathonId: [8510, 9048], id: 5077, title: "Аромат для важной особы", short: `Парфюмер (<a href="https://archeageon.ru/kvesty/konsortsiuma-sinej-soli/260-kvesty-ot-parfyumera-na-dz-v-arheidj#aroma" target="_blank">запад</a>/<a href="https://archeageon.ru/kvesty/konsortsiuma-sinej-soli/261-kvesty-ot-parfyumera-na-dz-vostok-arheidj#aroma" target="_blank">восток</a>)` },
    { marathonId: [8512, 9038], id: 8605, title: "Битва в Бухте китобоев", short: "" },
    { marathonId: [8514, 9052], id: 11096, title: "Турнир в честь Отца-Солнца", short: "Луг - Битва хранителей", schedule: [{ timeStart: "18:00", weekdays: [6, 0] }] },
    { marathonId: [8516, 9054], id: 8000129, title: "Во славу Орхидны", short: "" },
    { marathonId: [8518, 9056], id: 1415, title: "Сирота", short: "" },
    { marathonId: [8520, 9058], id: 5970, title: "Кольцо капитана Гленна", short: "", schedule: [{ timeStart: "03:20" }, { timeStart: "07:20" }, { timeStart: "11:20" }, { timeStart: "15:20" }, { timeStart: "19:20" }, { timeStart: "23:20" }] },
    { marathonId: [8522, 9060], id: 10188, title: "Образцы флоры Сада", short: "", slot: { item: ITEMS[49252], count: 20 } },
    { marathonId: [8524, 9046], id: 8618, title: "Битва за Эфен'Хал", short: "Эфен - мобы" },
    { marathonId: [9064], id: 8000311, title: "Охота на призраков", short: "Предпоследнее испытание для осколков предела" },
];

/** @param {string} value */
export const normalizeQuestTitleForMatch = (value) => {
    const roman = (num) => {
        const map = ['', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix'];
        return map[num] || String(num);
    };

    return String(value || '')
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/(\D)(\d+)$/u, (_, prefix, num) => `${prefix} ${roman(Number(num))}`)
        .replace(/\*+/g, '')
        .replace(/героич/g, 'гер')
        .replace(/[«»"'`´’‘“”()[\]{}.,:;!?\-–—_/\\]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

/** @param {string} value */
export const getQuestTitleMatchWords = (value) => (
    normalizeQuestTitleForMatch(value)
        .split(' ')
        .filter(word => word.length >= 3 || /^[ivx]+$/.test(word))
);

/**
 * Оценивает похожесть заголовка марафон-квеста из API и локального заголовка QUESTS.
 * Сначала ценит точное/подстрочное совпадение, затем сумму совпавших значимых слов.
 * @param {string} apiTitle
 * @param {string} localTitle
 * @returns {number}
 */
export const scoreQuestTitleMatch = (apiTitle, localTitle) => {
    const apiNorm = normalizeQuestTitleForMatch(apiTitle);
    const localNorm = normalizeQuestTitleForMatch(localTitle);
    if (!apiNorm || !localNorm) return 0;
    if (apiNorm === localNorm) return 1000;
    if (apiNorm.includes(localNorm) || localNorm.includes(apiNorm)) {
        return Math.min(apiNorm.length, localNorm.length);
    }

    const apiWords = new Set(getQuestTitleMatchWords(apiTitle));
    const commonWords = getQuestTitleMatchWords(localTitle).filter(word => apiWords.has(word));
    return commonWords.join('').length + commonWords.length * 2;
};

/**
 * Находит локальные метаданные QUESTS для марафон-квеста из API.
 * Сначала ищет по текущему ID марафон-квеста, затем по похожести title.
 * @param {ApiQuest} marathonQuest
 * @returns {Quest|null}
 */
export const findQuestMetaForMarathonQuest = (marathonQuest) => {
    const marathonQuestId = Number(marathonQuest?.id || 0);
    if (marathonQuestId) {
        const byId = QUESTS.find(q => q.marathonId.includes(marathonQuestId));
        if (byId) return byId;
    }

    let bestQuest = null;
    let bestScore = 0;
    for (const quest of QUESTS) {
        const score = scoreQuestTitleMatch(marathonQuest?.title, quest.title);
        if (score > bestScore) {
            bestQuest = quest;
            bestScore = score;
        }
    }

    return bestScore >= 12 ? bestQuest : null;
};
