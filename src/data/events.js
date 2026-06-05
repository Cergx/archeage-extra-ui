export const EVENTS = [
    { code: "ifnir", title: "Оборона Ифнира", defaultVisible: true, defaultNotifications: true, schedule: [{ timeStart: "22:00", weekdays: [5] }, { timeStart: "16:00", weekdays: [6] }], locations: ["Ифнир"], quests: [{ id: 10569, title: "Оборона Ифнира" }, { id: 10564, title: "Освобожденные узницы Нагашара" }] },
    { code: "lug_guardians", title: "Луг - Битва хранителей", defaultVisible: true, defaultNotifications: true, schedule: [{ timeStart: "18:00", weekdays: [6, 7] }], locations: ["Великий луг"], quests: [{ id: 11132, title: "Битва хранителей" }, { id: 11096, title: "Турнир в честь Отца-Солнца" }] },
    { code: "storm_eye", title: "Око бури", schedule: [{ timeStart: "21:00", timeEnd: "22:00", weekdays: [2, 4, 6] }], locations: ["Архипелаг погибших кораблей"], quests: [{ id: 6791, title: "Битва на Оке бури" }] },
    { code: "storm_eye_sea", title: "Гроза над морем", schedule: [{ timeStart: "14:00", timeEnd: "15:00" }, { timeStart: "22:00", timeEnd: "23:00" }], locations: ["Архипелаг погибших кораблей"], quests: [{ id: 5765, title: "Гроза над морем" }] },
    { code: "carrion", title: "Падаль", defaultVisible: true, schedule: [{ timeStart: "10:00" }, { timeStart: "22:00" }] },
    { code: "siege", title: "Осада", schedule: [{ timeStart: "21:00", timeEnd: "22:00", weekdays: [3] }] },

    { code: "rift_blood_antallon", title: "Кровавый (дневной) разлом - Анталлон/Эншака", defaultVisible: true, schedule: [{ timeStart: "01:20" }, { timeStart: "05:20" }, { timeStart: "09:20" }, { timeStart: "13:20" }, { timeStart: "17:20" }, { timeStart: "21:20" }], locations: ["Солнечные поля"], quests: [{ id: 5885, title: "Советник Кириоса" }] },
    { code: "rift_blood_garron", title: "Кровавый (дневной) разлом - Гигантский гаррон", defaultVisible: true, schedule: [{ timeStart: "00:20" }, { timeStart: "04:20" }, { timeStart: "08:20" }, { timeStart: "12:20" }, { timeStart: "16:20" }, { timeStart: "20:20" }], locations: ["Инистра", "Полуостров Падающих Звезд"], quests: [{ id: 2943, title: "Элитные войска Кровавой армии" }] },
    { code: "rift_ghost", title: "Призрачный (ночной) разлом - Призрак Эншаки", defaultVisible: true, schedule: [{ timeStart: "02:20", duration: 15 }, { timeStart: "06:20", duration: 15 }, { timeStart: "10:20", duration: 15 }, { timeStart: "14:20", duration: 15 }, { timeStart: "18:20", duration: 15 }, { timeStart: "22:20", duration: 15 }], locations: ["Инистра", "Полуостров Падающих Звезд"], quests: [{ id: 5144, title: "Разгром призрачного легиона" }] },
    { code: "rift_phantom", title: "Фантомы (лиловый разлом)", schedule: [{ timeStart: "01:50" }, { timeStart: "05:50" }, { timeStart: "09:50" }, { timeStart: "13:50" }, { timeStart: "17:50" }, { timeStart: "21:50" }], locations: ["Сокрытая долина", "Ирамийский хребет"], quests: [{ id: 11154, title: "Бой с тенью" }] },

    /* Инстансы - Рейды */
    { code: "dragon_lair", title: "Логово дракона", defaultVisible: true, schedule: [{ timeStart: "13:20", timeEnd: "14:00" }, { timeStart: "18:20", timeEnd: "19:00" }, { timeStart: "21:20", timeEnd: "22:00" }], locations: ["Инстансы - Рейды"] },
    { code: "gardum", title: "Гардум (Ущелье кровавой росы)", defaultVisible: true, schedule: [{ timeStart: "12:40", timeEnd: "13:20" }, { timeStart: "17:40", timeEnd: "18:20" }, { timeStart: "20:40", timeEnd: "21:20" }], locations: ["Инстансы - Рейды"], quests: [{ id: 7935, title: "Хранитель Звенящего ущелья" }] },
    { code: "iramkand", title: "Последний день Ирамканда", schedule: [{ timeStart: "0:40", timeEnd: "1:20" }, { timeStart: "12:00", timeEnd: "12:40" }, { timeStart: "17:00", timeEnd: "17:40" }, { timeStart: "20:00", timeEnd: "20:40" }], locations: ["Инстансы - Рейды"], quests: [{ id: 9205, title: "Последний день Ирамканда" }] },

    /* Инстансы - Фракции */
    { code: "daskshir", title: "Битва за Даскшир", defaultVisible: true, schedule: [{ timeStart: "16:00", timeEnd: "17:00", weekdays: [2, 4, 6] }, { timeStart: "22:30", timeEnd: "23:59", weekdays: [2, 4, 6] }, { timeStart: "19:00", timeEnd: "20:00", weekdays: [1, 3, 5, 7] }], locations: ["Инстансы - Фракции"] },
    { code: "gorge_battle", title: "Битва в Ущелье кровавой росы", schedule: [{ timeStart: "15:15", timeEnd: "16:00" }, { timeStart: "18:00", timeEnd: "19:00" }, { timeStart: "21:45", timeEnd: "22:30" }], locations: ["Инстансы - Фракции"] },
    { code: "enchanted_ponds", title: "Битва за Зачарованные пруды", defaultVisible: true, schedule: [{ timeStart: "14:30", timeEnd: "15:15" }, { timeStart: "17:00", timeEnd: "18:00" }, { timeStart: "21:00", timeEnd: "21:45" }], locations: ["Инстансы - Фракции"] },

    /* Мировые боссы */
    { code: "kraken", title: "Кракен", schedule: [{ timeStart: "19:30", weekdays: [1, 4, 6] }], locations: ["Безмятежное море"] },
    { code: "kalidis", title: "Калидис", schedule: [{ timeStart: "20:30", weekdays: [1, 5, 6] }], locations: ["Туманный пролив"] },
    { code: "leviathan", title: "Левиафан", schedule: [{ timeStart: "20:30", weekdays: [2, 4, 7] }], locations: ["Безмятежное море"] },
    { code: "dolphin", title: "Летучий дельфиец", schedule: [{ timeStart: "21:00", weekdays: [1, 3, 5, 7] }], locations: ["Золотое море"] },
    { code: "ashyara_glenn_loreya", title: "Ашьяра/Гленн/Лорея", schedule: [{ timeStart: "03:20" }, { timeStart: "07:20" }, { timeStart: "11:20" }, { timeStart: "15:20" }, { timeStart: "19:20" }, { timeStart: "23:20" }], locations: ["Бездна", "Солнечные поля"], quests: [{ id: 5971, title: "Чешуя Ашьяры" }, { id: 5970, title: "Кольцо капитана Гленна" }, { id: 5969, title: "Кольцо Лореи" }] },
    { code: "xanatos", title: "Ксанатос", schedule: [{ timeStart: "19:30", weekdays: [2, 5, 7] }], locations: ["Кладбище драконов"] },

    { code: "gardens_bosses", title: "Эншака/Лернея/Таврос/М'гер", schedule: [{ timeStart: "03:00" }, { timeStart: "07:00" }, { timeStart: "11:00" }, { timeStart: "15:00" }, { timeStart: "19:00" }, { timeStart: "23:00" }], locations: ["Сады матери"], quests: [{ id: 10056, title: "Садовые работы" }] },
    { code: "gardens_antallon", title: "Анталлон в садах", schedule: [{ timeStart: "21:30", weekdays: [1, 5, 7] }], locations: ["Сады матери"] },

    { code: "altars", title: "Битва за алтари", schedule: [{ timeStart: "16:00", timeEnd: "16:30", weekdays: [1, 3, 4, 5, 6] }, { timeStart: "20:00", timeEnd: "20:30", weekdays: [0, 2, 3, 4, 5] }], locations: ["Пепельные равнины"] },
    { code: "fesanix", title: "Фесаникс", schedule: [{ timeStart: "22:30", timeEnd: "23:30", weekdays: [2] }], locations: ["Пепельные равнины"] },
];
