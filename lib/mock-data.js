export const dashboardStats = [
  {
    label: "Новые заявки",
    value: "12",
    note: "4 клиента нужно взять в работу в ближайшие 15 минут"
  },
  {
    label: "На расчёт",
    value: "5",
    note: "Нужны размеры, материалы и диапазон бюджета"
  },
  {
    label: "Замеры на неделе",
    value: "4",
    note: "2 выезда уже подтверждены клиентами"
  },
  {
    label: "Просроченный возврат",
    value: "3",
    note: "Тёплые сделки ждут возврата менеджера"
  }
];

export const leadStages = [
  { name: "Новая заявка", count: 1, tone: "var(--accent)" },
  { name: "Связаться", count: 1, tone: "var(--sand)" },
  { name: "Расчёт стоимости", count: 1, tone: "var(--info)" },
  { name: "Замер назначен", count: 1, tone: "var(--olive)" },
  { name: "Согласование", count: 1, tone: "var(--wine)" }
];

export const teamQueue = [
  {
    lead: "Амир К.",
    slug: "l-201",
    source: "Реклама Instagram",
    owner: "Айдана",
    deadline: "Сегодня, 14:30",
    status: "NEW"
  },
  {
    lead: "Айгерим С.",
    slug: "l-202",
    source: "Сайт / квиз",
    owner: "Тимур",
    deadline: "Сегодня, 15:00",
    status: "CONTACTED"
  },
  {
    lead: "Дастан, офисный проект",
    slug: "l-203",
    source: "Рекомендация",
    owner: "Айдана",
    deadline: "Сегодня, 17:00",
    status: "QUALIFIED"
  }
];

export const systemModules = [
  {
    title: "Входящие заявки",
    text: "Единый поток лидов из рекламы, сайта, WhatsApp и рекомендаций без потери контекста."
  },
  {
    title: "Квалификация и расчёт",
    text: "Менеджер быстро фиксирует изделие, бюджет, сроки и переводит клиента в расчёт без лишних экранов."
  },
  {
    title: "Замер и консультация",
    text: "Отдельный контур для выезда, шоурума и онлайн-консультации с понятным статусом подтверждения."
  },
  {
    title: "Дожим сделки",
    text: "Повторный контакт, комментарии и следующий шаг живут внутри карточки сделки, а не в голове менеджера."
  }
];

export const sourceBoard = [
  { name: "Реклама Instagram", leads: 5, cpl: "3 900 ₸", result: "Лучший объём" },
  { name: "Сайт / квиз", leads: 3, cpl: "2 500 ₸", result: "Тёплые входящие" },
  { name: "Рекомендации", leads: 2, cpl: "0 ₸", result: "Лучшее качество" },
  { name: "WhatsApp", leads: 2, cpl: "n/a", result: "Нужен контроль скорости" }
];

export const navItems = [
  { href: "/", label: "Главная" },
  { href: "/workboard", label: "Смена" },
  { href: "/leads", label: "Сделки" },
  { href: "/appointments", label: "Замеры" }
];

export const roleOptions = [
  { value: "owner", label: "Собственник" },
  { value: "manager", label: "Менеджер" },
  { value: "operator", label: "Замерщик" }
];

export const leadsTable = [
  {
    id: "L-201",
    slug: "l-201",
    name: "Амир К.",
    phone: "+7 707 123 44 10",
    channel: "WhatsApp",
    source: "Реклама Instagram",
    manager: "Айдана",
    status: "NEW",
    nextAction: "Позвонить, собрать базовый бриф и согласовать удобное время для расчёта",
    deadline: "Сегодня, 14:30",
    summary:
      "Нужна кухня под потолок для квартиры в черновой отделке. Клиент хочет быстро понять диапазон бюджета и когда можно выехать на замер.",
    product: "Кухня",
    requestType: "Кухня под потолок",
    projectSize: "Кухня 4.2 м + пенал под технику",
    city: "Алматы, Бостандыкский район",
    address: "Бостандыкский район, точный адрес клиент пришлёт после первого звонка",
    createdAt: "Сегодня, 13:42",
    urgency: "Срочно",
    temperature: "Горячий",
    budget: "6–8 млн ₸",
    estimateRange: "После брифа: 5.5–7 млн ₸",
    dealStage: "Новая заявка",
    calculationStatus: "Не начинали",
    prepaymentStatus: "Не запрошена",
    prepaymentAmount: "",
    finalAmount: "",
    productionStatus: "Не запущено",
    nextContactAt: "Сегодня, 14:30",
    lastTouch: "Сегодня, 13:52",
    clientComment:
      "Нужна кухня в новую квартиру, хочется быстро понять диапазон бюджета и сроки замера.",
    managerComment:
      "Клиент готов двигаться быстро, если сразу дать понятную рамку по стоимости и срокам замера.",
    measurement: {
      date: "Не назначен",
      time: "Не назначено",
      address: "Адрес уточняется после первого контакта",
      measurer: "Не назначен",
      status: "Не назначен",
      dimensions: "Ждём план и размеры от застройщика",
      comment: "Сначала нужно собрать вводные по кухне и технике.",
      result: "Замер ещё не назначен"
    },
    tags: ["Новостройка", "Без дизайн-проекта", "Нужен быстрый расчёт"],
    messages: [
      {
        direction: "inbound",
        sender: "Клиент",
        text: "Здравствуйте, нужна кухня в новую квартиру. Хотим понять по бюджету и срокам.",
        time: "13:41"
      },
      {
        direction: "system",
        sender: "Система",
        text: "Заявка зафиксирована, менеджеру поставлен срок на первый контакт.",
        time: "13:42"
      },
      {
        direction: "inbound",
        sender: "Клиент",
        text: "Проекта на руках пока нет, могу прислать план и размеры от застройщика.",
        time: "13:52"
      }
    ],
    tasks: [
      {
        title: "Созвониться и собрать базовый бриф",
        description: "Уточнить планировку, состав кухни, технику и желаемые сроки.",
        owner: "Айдана",
        priority: "high",
        dueAt: "Сегодня, 14:30",
        status: "OPEN"
      }
    ],
    followups: [],
    appointments: [],
    statusHistory: [
      {
        previousStatus: "—",
        nextStatus: "NEW",
        time: "Сегодня, 13:42",
        reason: "Новая заявка из рекламы Instagram",
        actor: "Система"
      }
    ],
    activity: [
      {
        action: "Заявка создана",
        time: "Сегодня, 13:42",
        actor: "Система",
        detail: "Источник: реклама Instagram. Канал: WhatsApp."
      }
    ],
    intakeSession: {
      requestTrack: "consultation",
      summaryText: "Клиенту нужен быстрый ориентир по стоимости и следующий шаг к замеру."
    }
  },
  {
    id: "L-202",
    slug: "l-202",
    name: "Айгерим С.",
    phone: "+7 701 883 10 12",
    channel: "Сайт",
    source: "Сайт / квиз",
    manager: "Тимур",
    status: "CONTACTED",
    nextAction: "Уточнить материалы фасадов и отправить предварительный расчёт",
    deadline: "Сегодня, 15:00",
    summary:
      "Интересует встроенный шкаф в прихожую и гардеробная в спальню. Уже отправила план и примерные размеры, ждёт понятный диапазон цены.",
    product: "Шкаф и гардеробная",
    requestType: "Встроенный шкаф + гардеробная",
    projectSize: "Прихожая + спальня",
    city: "Алматы, Наурызбайский район",
    address: "Наурызбайский район, точный адрес дадут после согласования выезда",
    createdAt: "Сегодня, 11:44",
    urgency: "Планово",
    temperature: "Тёплый",
    budget: "2.5–3.5 млн ₸",
    estimateRange: "Предварительно: 2.8–3.4 млн ₸",
    dealStage: "Расчёт стоимости",
    calculationStatus: "В расчёте",
    prepaymentStatus: "Не запрошена",
    prepaymentAmount: "",
    finalAmount: "",
    productionStatus: "Не запущено",
    nextContactAt: "Сегодня, 17:30",
    lastTouch: "Сегодня, 12:18",
    clientComment:
      "Нужен понятный ориентир по цене и срокам по шкафу в прихожую и гардеробной.",
    managerComment:
      "Хороший лид: уже есть фото помещения и пожелания по наполнению. Главное — не затянуть с расчётом.",
    measurement: {
      date: "Не назначен",
      time: "Не назначено",
      address: "Адрес уточняется после предварительного расчёта",
      measurer: "Не назначен",
      status: "Не назначен",
      dimensions: "Есть примерные размеры от клиента",
      comment: "После расчёта решить, нужен ли выезд на объект.",
      result: "Замер ещё не назначен"
    },
    tags: ["Шкаф", "Гардеробная", "Есть размеры"],
    messages: [
      {
        direction: "inbound",
        sender: "Клиент",
        text: "Оставила заявку на шкаф в прихожую и гардеробную. Можно ориентир по цене?",
        time: "11:44"
      },
      {
        direction: "outbound",
        sender: "Тимур",
        text: "Да, конечно. Пришлите, пожалуйста, фото и примерные размеры, чтобы дать честный диапазон.",
        time: "12:02"
      },
      {
        direction: "inbound",
        sender: "Клиент",
        text: "Отправила план и фото. Нужны светлые фасады без ручек.",
        time: "12:18"
      }
    ],
    tasks: [
      {
        title: "Подготовить предварительный расчёт",
        description: "Посчитать корпус, фасады и базовую фурнитуру в двух вариантах.",
        owner: "Тимур",
        priority: "high",
        dueAt: "Сегодня, 15:00",
        status: "OPEN"
      }
    ],
    followups: [
      {
        type: "Возврат после расчёта",
        owner: "Тимур",
        scheduledAt: "Сегодня, 17:30",
        note: "Вернуться после отправки диапазона и уточнить, устраивает ли бюджет.",
        status: "PENDING"
      }
    ],
    appointments: [],
    statusHistory: [
      {
        previousStatus: "NEW",
        nextStatus: "CONTACTED",
        time: "Сегодня, 12:02",
        reason: "Менеджер вышел на связь и запросил исходные данные",
        actor: "Тимур"
      }
    ],
    activity: [
      {
        action: "Первый контакт",
        time: "Сегодня, 12:02",
        actor: "Тимур",
        detail: "Запросили фото помещения, план и примерные размеры."
      }
    ],
    intakeSession: {
      requestTrack: "estimate",
      summaryText: "Лид готов к предварительному расчёту, нужна аккуратная работа с бюджетом."
    }
  },
  {
    id: "L-203",
    slug: "l-203",
    name: "Дастан, офисный проект",
    phone: "+7 705 401 00 22",
    channel: "Рекомендация",
    source: "Рекомендация",
    manager: "Айдана",
    status: "QUALIFIED",
    nextAction: "Собрать финальные размеры и выдать расчёт по ресепшену и шкафам",
    deadline: "Сегодня, 17:00",
    summary:
      "Небольшой офисный проект: ресепшен, шкафы для сотрудников и тумбы в переговорную. Клиент ждёт расчёт в двух вариантах по материалам.",
    product: "Корпусная мебель для офиса",
    requestType: "Ресепшен + шкафы + тумбы",
    projectSize: "3 помещения",
    city: "Алматы, Медеуский район",
    address: "Медеуский район, офисный блок, адрес есть у менеджера",
    createdAt: "Сегодня, 10:55",
    urgency: "Планово",
    temperature: "Тёплый",
    budget: "4–5 млн ₸",
    estimateRange: "Два варианта: 4.2 и 4.8 млн ₸",
    dealStage: "Расчёт стоимости",
    calculationStatus: "В расчёте",
    prepaymentStatus: "Не запрошена",
    prepaymentAmount: "",
    finalAmount: "",
    productionStatus: "Не запущено",
    nextContactAt: "Завтра, 11:00",
    lastTouch: "Сегодня, 11:40",
    clientComment:
      "Нужны два сценария расчёта по офисной мебели с понятной разницей по материалам.",
    managerComment:
      "Есть шанс быстро закрыть в договор, если расчёт будет аккуратным и с понятной аргументацией по материалам.",
    measurement: {
      date: "Не назначен",
      time: "Не назначено",
      address: "Замер не нужен, работаем по планам и техзаданию",
      measurer: "Не требуется",
      status: "Не требуется",
      dimensions: "Размеры есть в офисном плане",
      comment: "Важно быстро собрать два варианта сметы.",
      result: "Работаем без выезда, по готовому ТЗ"
    },
    tags: ["Офисный проект", "Два варианта сметы", "Нужен быстрый КП"],
    messages: [
      {
        direction: "inbound",
        sender: "Клиент",
        text: "Нам нужен расчёт по офисной мебели. Важно уложиться в сроки и дать два варианта материалов.",
        time: "10:55"
      },
      {
        direction: "outbound",
        sender: "Айдана",
        text: "Приняла. До вечера подготовим два сценария и отметим, где разница по стоимости и срокам.",
        time: "11:10"
      },
      {
        direction: "inbound",
        sender: "Клиент",
        text: "Отлично, тогда ждём расчёт сегодня.",
        time: "11:40"
      }
    ],
    tasks: [
      {
        title: "Подготовить смету в двух вариантах",
        description: "Собрать ЛДСП + МДФ и премиальный вариант с улучшенной фурнитурой.",
        owner: "Айдана",
        priority: "high",
        dueAt: "Сегодня, 17:00",
        status: "OPEN"
      }
    ],
    followups: [
      {
        type: "Возврат после КП",
        owner: "Айдана",
        scheduledAt: "Завтра, 11:00",
        note: "После отправки сметы созвониться и пройтись по вариантам материалов.",
        status: "PENDING"
      }
    ],
    appointments: [],
    statusHistory: [
      {
        previousStatus: "CONTACTED",
        nextStatus: "QUALIFIED",
        time: "Сегодня, 11:10",
        reason: "Собран бриф, понятен состав мебели и бюджетный диапазон",
        actor: "Айдана"
      }
    ],
    activity: [
      {
        action: "Бриф собран",
        time: "Сегодня, 11:10",
        actor: "Айдана",
        detail: "Зафиксированы помещения, материалы и дедлайн клиента."
      }
    ],
    intakeSession: {
      requestTrack: "estimate",
      summaryText: "Клиент квалифицирован, критичны скорость расчёта и прозрачность КП."
    }
  },
  {
    id: "L-204",
    slug: "l-204",
    name: "Назгуль Т.",
    phone: "+7 778 522 91 18",
    channel: "WhatsApp",
    source: "WhatsApp",
    manager: "Ерлан",
    status: "MEETING",
    nextAction: "Провести замер кухни и постирочной, после выезда подтвердить срок выдачи расчёта",
    deadline: "Завтра, 11:30",
    summary:
      "Клиент хочет кухню и зону постирочной в частном доме. Замер уже согласован, ожидается выезд с фиксацией всех нестандартных углов.",
    product: "Кухня + постирочная",
    requestType: "Замер на объекте",
    projectSize: "Частный дом, 2 зоны",
    city: "Алматы, мкр. Нурлытау",
    address: "мкр. Нурлытау, частный дом",
    createdAt: "Сегодня, 09:20",
    urgency: "Срочно",
    temperature: "Горячий",
    budget: "8–11 млн ₸",
    estimateRange: "После замера: 8.5–10.5 млн ₸",
    dealStage: "Замер назначен",
    calculationStatus: "Ждёт замер",
    prepaymentStatus: "Не запрошена",
    prepaymentAmount: "",
    finalAmount: "",
    productionStatus: "Не запущено",
    nextContactAt: "Сегодня, 19:00",
    lastTouch: "Сегодня, 10:05",
    clientComment:
      "Нужен полный замер кухни и постирочной, важно учесть нестандартные углы и технику.",
    managerComment:
      "Объект перспективный. После замера важно не тянуть больше суток до выдачи понятного расчёта.",
    measurement: {
      date: "Завтра, 11:30",
      time: "11:30",
      address: "Нурлытау, частный дом",
      measurer: "Ерлан",
      status: "Замер назначен",
      dimensions: "Размеры будут добавлены после выезда",
      comment: "Подтвердить адрес, контакт на объекте и список техники.",
      result: "Ожидаем выезд на объект"
    },
    tags: ["Выезд на объект", "Нестандартная геометрия", "Высокий чек"],
    messages: [
      {
        direction: "outbound",
        sender: "Ерлан",
        text: "Подтверждаю замер на завтра, 11:30. За день до выезда напомним и уточним адрес.",
        time: "09:50"
      },
      {
        direction: "inbound",
        sender: "Клиент",
        text: "Да, всё в силе. Адрес отправлю вечером.",
        time: "10:05"
      }
    ],
    tasks: [
      {
        title: "Подтвердить адрес и ориентир по времени",
        description: "Вечером получить точный адрес, отправить окно приезда и список того, что подготовить к замеру.",
        owner: "Ерлан",
        priority: "medium",
        dueAt: "Сегодня, 19:00",
        status: "OPEN"
      }
    ],
    followups: [
      {
        type: "Подтверждение выезда",
        owner: "Ерлан",
        scheduledAt: "Сегодня, 19:00",
        note: "Подтвердить адрес, контакт на объекте и готовность к замеру.",
        status: "PENDING"
      }
    ],
    appointments: [
      {
        id: "A-301",
        lead: "Назгуль Т.",
        owner: "Ерлан",
        type: "measurement",
        status: "CONFIRMED",
        scheduledAt: "Завтра, 11:30",
        scheduledAtIso: "2026-06-04T11:30:00+05:00",
        duration: "90 минут",
        location: "Нурлытау, частный дом",
        note: "Нужен полный замер кухни и постирочной, обратить внимание на встроенную технику.",
        outcomeNote: "",
        revenueAmount: "",
        dimensionsSummary: "Размеры будут зафиксированы после выезда",
        measurementComment: "Подтвердить адрес и проход на объект",
        measurementResult: "Ожидаем замер"
      }
    ],
    statusHistory: [
      {
        previousStatus: "QUALIFIED",
        nextStatus: "MEETING",
        time: "Сегодня, 09:50",
        reason: "Клиент подтвердил выезд на объект",
        actor: "Ерлан"
      }
    ],
    activity: [
      {
        action: "Замер подтверждён",
        time: "Сегодня, 09:50",
        actor: "Ерлан",
        detail: "Назначен выезд на объект, ждём точный адрес вечером."
      }
    ],
    intakeSession: {
      requestTrack: "booking",
      summaryText: "Главная задача — довести клиента до успешного выезда и быстро вернуться с расчётом."
    }
  },
  {
    id: "L-205",
    slug: "l-205",
    name: "Самат Р.",
    phone: "+7 702 333 55 41",
    channel: "WhatsApp",
    source: "Рекомендация",
    manager: "Тимур",
    status: "PROPOSAL",
    nextAction: "Вернуться по отправленному КП и закрыть вопрос по сроку установки",
    deadline: "Завтра, 12:00",
    summary:
      "Шкаф-купе и ТВ-зона. Предварительный расчёт уже ушёл, клиент думает между двумя вариантами фасадов и сравнивает сроки установки.",
    product: "Шкаф-купе + ТВ-зона",
    requestType: "КП отправлено",
    projectSize: "Гостиная + коридор",
    city: "Алматы, Ауэзовский район",
    address: "Ауэзовский район, адрес у менеджера",
    createdAt: "Вчера, 16:10",
    urgency: "Планово",
    temperature: "Тёплый",
    budget: "3.2–3.8 млн ₸",
    estimateRange: "КП: 3.45 млн ₸ и 3.78 млн ₸",
    dealStage: "Согласование",
    calculationStatus: "Расчёт отправлен",
    prepaymentStatus: "Ожидаем предоплату",
    prepaymentAmount: "",
    finalAmount: "3.45–3.78 млн ₸",
    productionStatus: "Не запущено",
    nextContactAt: "Завтра, 12:00",
    lastTouch: "Вчера, 18:25",
    clientComment:
      "Нужно выбрать между двумя вариантами фасадов и понять срок монтажа.",
    managerComment:
      "Сделка живая. Клиенту нужен аккуратный дожим по разнице фасадов и срокам монтажа.",
    measurement: {
      date: "Не назначен",
      time: "Не назначено",
      address: "Адрес клиента есть, выезд пока не нужен",
      measurer: "Не назначен",
      status: "Не требуется",
      dimensions: "Базовые размеры уже есть",
      comment: "Фокус на согласовании фасадов и сроков установки.",
      result: "Ждём решение клиента по КП"
    },
    tags: ["КП отправлено", "Сравнивает варианты", "Нужен дожим"],
    messages: [
      {
        direction: "outbound",
        sender: "Тимур",
        text: "Отправил два варианта расчёта. Внутри отдельно отметил разницу по фасадам и срокам.",
        time: "Вчера, 18:25"
      }
    ],
    tasks: [
      {
        title: "Созвониться после КП",
        description: "Обсудить разницу по фасадам и помочь выбрать вариант без просадки в темпе сделки.",
        owner: "Тимур",
        priority: "medium",
        dueAt: "Завтра, 12:00",
        status: "OPEN"
      }
    ],
    followups: [
      {
        type: "Дожим после расчёта",
        owner: "Тимур",
        scheduledAt: "Завтра, 12:00",
        note: "Вернуться по КП, снять вопросы по срокам установки и фурнитуре.",
        status: "PENDING"
      }
    ],
    appointments: [],
    statusHistory: [
      {
        previousStatus: "QUALIFIED",
        nextStatus: "PROPOSAL",
        time: "Вчера, 18:25",
        reason: "Предварительный расчёт и КП отправлены клиенту",
        actor: "Тимур"
      }
    ],
    activity: [
      {
        action: "КП отправлено",
        time: "Вчера, 18:25",
        actor: "Тимур",
        detail: "Высланы два варианта расчёта с разницей по фасадам."
      }
    ],
    intakeSession: {
      requestTrack: "estimate",
      summaryText: "Сделка на этапе дожима, главное — не потерять импульс после отправки КП."
    }
  },
  {
    id: "L-206",
    slug: "l-206",
    name: "Динара М.",
    phone: "+7 747 991 41 00",
    channel: "Instagram",
    source: "Реклама Instagram",
    manager: "Айдана",
    status: "WON",
    nextAction: "Передать в производство после подписания договора",
    deadline: "Подписано",
    summary:
      "Клиентка согласовала расчёт по встроенному шкафу и подтвердила запуск после замера. Сделка уже закрыта, в интерфейсе полезна как ориентир по качеству потока.",
    product: "Встроенный шкаф",
    requestType: "Сделка выиграна",
    projectSize: "Шкаф в спальню",
    city: "Алматы, Жетысуский район",
    address: "Жетысуский район, объект клиента",
    createdAt: "Вчера, 10:15",
    urgency: "Завершена",
    temperature: "Закрыта",
    budget: "1.9 млн ₸",
    estimateRange: "Финальный договор: 1.95 млн ₸",
    dealStage: "В производство",
    calculationStatus: "Расчёт согласован",
    prepaymentStatus: "Предоплата получена",
    prepaymentAmount: "585 000 ₸",
    finalAmount: "1 950 000 ₸",
    productionStatus: "В производство",
    nextContactAt: "После запуска в производство",
    lastTouch: "Сегодня, 09:10",
    clientComment:
      "Клиентка утвердила шкаф после замера и согласовала запуск в работу.",
    managerComment:
      "Хороший пример тёплой сделки: быстрый замер, короткий цикл до договора, без просадки по возврату к клиенту.",
    measurement: {
      date: "Вчера, 12:00",
      time: "12:00",
      address: "Жетысуский район",
      measurer: "Айдана",
      status: "Замер выполнен",
      dimensions: "Все размеры подтверждены на месте",
      comment: "После выезда клиент сразу согласовал договор.",
      result: "После замера получена предоплата и сделка передана в производство"
    },
    tags: ["Закрыто", "Шкаф", "Хороший референс"],
    messages: [
      {
        direction: "outbound",
        sender: "Айдана",
        text: "Договор и финальная спецификация отправлены. Спасибо, запускаем в работу.",
        time: "09:10"
      }
    ],
    tasks: [],
    followups: [],
    appointments: [
      {
        id: "A-304",
        lead: "Динара М.",
        owner: "Айдана",
        type: "measurement",
        status: "COMPLETED",
        scheduledAt: "Вчера, 12:00",
        scheduledAtIso: "2026-06-02T12:00:00+05:00",
        duration: "60 минут",
        location: "Жетысуский район",
        note: "Замер выполнен, все размеры подтверждены.",
        outcomeNote: "После замера клиент согласовал договор и финальную стоимость.",
        revenueAmount: "585000",
        dimensionsSummary: "Размеры шкафа подтверждены, ниша готова к производству",
        measurementComment: "Выезд прошёл без замечаний, размеры финализированы",
        measurementResult: "После замера получена предоплата, проект ушёл в производство"
      }
    ],
    statusHistory: [
      {
        previousStatus: "PROPOSAL",
        nextStatus: "WON",
        time: "Сегодня, 09:10",
        reason: "Клиент подтвердил финальную стоимость и подписал договор",
        actor: "Айдана"
      }
    ],
    activity: [
      {
        action: "Сделка закрыта",
        time: "Сегодня, 09:10",
        actor: "Айдана",
        detail: "Подписан договор по встроенному шкафу."
      }
    ],
    intakeSession: {
      requestTrack: "estimate",
      summaryText: "Сделка уже закрыта и полезна как ориентир по короткому циклу продаж."
    }
  }
];

export const taskColumns = [
  {
    title: "Срочно",
    tone: "var(--accent)",
    items: [
      {
        title: "Созвониться с Амиром и собрать бриф",
        owner: "Айдана",
        deadline: "Сегодня, 14:30",
        tag: "Первый контакт"
      },
      {
        title: "Дать предварительный расчёт по шкафу Айгерим",
        owner: "Тимур",
        deadline: "Сегодня, 15:00",
        tag: "Расчёт"
      }
    ]
  },
  {
    title: "На расчёт",
    tone: "var(--info)",
    items: [
      {
        title: "Собрать два варианта сметы по офисному проекту",
        owner: "Айдана",
        deadline: "Сегодня, 17:00",
        tag: "Офис"
      },
      {
        title: "Проверить разницу по фасадам для Самата",
        owner: "Тимур",
        deadline: "Завтра, 12:00",
        tag: "КП"
      }
    ]
  },
  {
    title: "На дожим",
    tone: "var(--olive)",
    items: [
      {
        title: "Подтвердить адрес и окно выезда для Назгуль",
        owner: "Ерлан",
        deadline: "Сегодня, 19:00",
        tag: "Замер"
      }
    ]
  }
];

export const followupQueue = [
  {
    lead: "Айгерим С.",
    slug: "l-202",
    owner: "Тимур",
    type: "Возврат после расчёта",
    scheduledAt: "Сегодня, 17:30",
    note: "Уточнить, укладывается ли клиент в диапазон бюджета и нужен ли замер.",
    status: "PENDING"
  },
  {
    lead: "Назгуль Т.",
    slug: "l-204",
    owner: "Ерлан",
    type: "Подтверждение выезда",
    scheduledAt: "Сегодня, 19:00",
    note: "Подтвердить адрес, контакт на объекте и детали по доступу.",
    status: "PENDING"
  },
  {
    lead: "Самат Р.",
    slug: "l-205",
    owner: "Тимур",
    type: "Дожим после расчёта",
    scheduledAt: "Завтра, 12:00",
    note: "Пройтись по отличиям между двумя вариантами фасадов и снять сомнения.",
    status: "PENDING"
  }
];

export const activityLog = [
  {
    time: "Сегодня, 13:42",
    actor: "Система",
    lead: "Амир К.",
    action: "Новая заявка",
    detail: "Создан лид из рекламы Instagram, ожидание первого контакта."
  },
  {
    time: "Сегодня, 12:18",
    actor: "Клиент",
    lead: "Айгерим С.",
    action: "Получены размеры",
    detail: "Клиент отправил фото и план, расчёт можно запускать."
  },
  {
    time: "Сегодня, 09:50",
    actor: "Ерлан",
    lead: "Назгуль Т.",
    action: "Замер подтверждён",
    detail: "Выезд назначен на завтра, 11:30."
  },
  {
    time: "Вчера, 18:25",
    actor: "Тимур",
    lead: "Самат Р.",
    action: "КП отправлено",
    detail: "Клиенту отправлены два варианта расчёта с разницей по фасадам."
  }
];

export const analyticsSnapshot = {
  sourcePerformance: [
    {
      source: "Реклама Instagram",
      leads: 5,
      won: 1,
      lost: 0,
      cpl: "3 900 ₸",
      note: "Даёт объём"
    },
    {
      source: "Сайт / квиз",
      leads: 3,
      won: 0,
      lost: 0,
      cpl: "2 500 ₸",
      note: "Хороший старт на расчёт"
    },
    {
      source: "Рекомендации",
      leads: 2,
      won: 1,
      lost: 0,
      cpl: "0 ₸",
      note: "Лучшее качество"
    },
    {
      source: "WhatsApp",
      leads: 2,
      won: 0,
      lost: 0,
      cpl: "n/a",
      note: "Нужен быстрый ответ"
    }
  ],
  lossReasons: [
    { reason: "Не уложились в бюджет", total: 2 },
    { reason: "Ушёл в паузу после расчёта", total: 1 },
    { reason: "Не доехали до замера", total: 1 }
  ],
  managerQuality: [
    {
      manager: "Айдана",
      firstResponse: "11 минут",
      overdue: 0,
      won: 1,
      note: "Хорошо двигает расчёты"
    },
    {
      manager: "Тимур",
      firstResponse: "17 минут",
      overdue: 1,
      won: 0,
      note: "Нужен более плотный возврат"
    },
    {
      manager: "Ерлан",
      firstResponse: "9 минут",
      overdue: 0,
      won: 0,
      note: "Сильный контур по замерам"
    }
  ]
};

export const workboardSnapshot = {
  focus: [
    {
      label: "Новые заявки",
      value: "1",
      note: "Клиенты, которым нельзя дать остыть"
    },
    {
      label: "На расчёт",
      value: "2",
      note: "Сделки, где следующий шаг — диапазон цены или КП"
    },
    {
      label: "Замеры",
      value: "1",
      note: "Подтверждённые выезды и консультации"
    },
    {
      label: "Повторный контакт",
      value: "3",
      note: "Возвраты после расчёта и подтверждения замера"
    }
  ],
  urgentLeads: teamQueue,
  taskQueue: [
    {
      lane: "Срочно",
      title: "Созвониться с Амиром и собрать бриф",
      owner: "Айдана",
      deadline: "Сегодня, 14:30",
      tag: "Первый контакт"
    },
    {
      lane: "Срочно",
      title: "Дать предварительный расчёт по шкафу Айгерим",
      owner: "Тимур",
      deadline: "Сегодня, 15:00",
      tag: "Расчёт"
    },
    {
      lane: "На дожим",
      title: "Подтвердить адрес и окно выезда для Назгуль",
      owner: "Ерлан",
      deadline: "Сегодня, 19:00",
      tag: "Замер"
    }
  ],
  alerts: [
    {
      time: "Сегодня, 13:42",
      actor: "Система",
      lead: "Амир К.",
      action: "Новый лид без ответа",
      detail: "Нужно закрыть первый контакт и перевести в квалификацию."
    },
    {
      time: "Вчера, 18:25",
      actor: "Тимур",
      lead: "Самат Р.",
      action: "КП ушло без следующего касания",
      detail: "Важно не потерять импульс после расчёта."
    }
  ]
};

export const escalationSnapshot = {
  summary: [
    {
      label: "Без первого ответа",
      value: "1",
      note: "Есть новая заявка без звонка менеджера"
    },
    {
      label: "Просроченный возврат",
      value: "1",
      note: "Есть возврат, который нельзя переносить"
    },
    {
      label: "Риск по замеру",
      value: "1",
      note: "Нужно подтвердить адрес и доступ на объект"
    },
    {
      label: "Сделки без движения",
      value: "1",
      note: "КП отправлено, но дальше нужен дожим"
    }
  ],
  firstResponseBreaches: [
    {
      lead: "Амир К.",
      owner: "Айдана",
      source: "Реклама Instagram",
      status: "NEW",
      deadline: "Сегодня, 14:30",
      slug: "l-201"
    }
  ],
  overdueFollowups: [
    {
      lead: "Самат Р.",
      owner: "Тимур",
      type: "Дожим после расчёта",
      scheduledAt: "Завтра, 12:00",
      note: "Клиент сравнивает варианты фасадов, нельзя дать сделке зависнуть.",
      slug: "l-205"
    }
  ],
  overdueTasks: [
    {
      title: "Подтвердить адрес и окно выезда для Назгуль",
      owner: "Ерлан",
      deadline: "Сегодня, 19:00",
      tag: "Замер"
    }
  ],
  stalledLeads: [
    {
      lead: "Самат Р.",
      owner: "Тимур",
      status: "PROPOSAL",
      lastTouch: "Вчера, 18:25",
      slug: "l-205"
    }
  ]
};

export const appointmentsSnapshot = [
  {
    id: "A-301",
    lead: "Назгуль Т.",
    owner: "Ерлан",
    type: "measurement",
    status: "CONFIRMED",
    scheduledAt: "Завтра, 11:30",
    scheduledAtIso: "2026-06-04T11:30:00+05:00",
    duration: "90 минут",
    location: "Нурлытау, частный дом",
    note: "Полный замер кухни и постирочной. Важно проверить ниши под встроенную технику.",
    outcomeNote: "",
    revenueAmount: "",
    dimensionsSummary: "Размеры будут зафиксированы после выезда",
    measurementComment: "Подтвердить проход на объект и контакты на месте",
    measurementResult: "Замер ещё не проведён"
  },
  {
    id: "A-302",
    lead: "Самат Р.",
    owner: "Тимур",
    type: "showroom",
    status: "SCHEDULED",
    scheduledAt: "Пятница, 18:00",
    scheduledAtIso: "2026-06-05T18:00:00+05:00",
    duration: "45 минут",
    location: "Шоурум, ул. Сатпаева",
    note: "Показать фасады и образцы фурнитуры перед финальным выбором.",
    outcomeNote: "",
    revenueAmount: "",
    dimensionsSummary: "Размеры уже есть, встреча нужна для согласования материалов",
    measurementComment: "Подготовить образцы фасадов и фурнитуры",
    measurementResult: "Ожидаем встречу в шоуруме"
  },
  {
    id: "A-303",
    lead: "Айгерим С.",
    owner: "Тимур",
    type: "consultation",
    status: "SCHEDULED",
    scheduledAt: "Суббота, 12:00",
    scheduledAtIso: "2026-06-06T12:00:00+05:00",
    duration: "30 минут",
    location: "Онлайн",
    note: "Короткая консультация по наполнению гардеробной перед замером.",
    outcomeNote: "",
    revenueAmount: "",
    dimensionsSummary: "Предварительные размеры от клиента уже получены",
    measurementComment: "Нужно подготовить вопросы по наполнению",
    measurementResult: "Консультация ещё не проведена"
  },
  {
    id: "A-304",
    lead: "Динара М.",
    owner: "Айдана",
    type: "measurement",
    status: "COMPLETED",
    scheduledAt: "Вчера, 12:00",
    scheduledAtIso: "2026-06-02T12:00:00+05:00",
    duration: "60 минут",
    location: "Жетысуский район",
    note: "Замер выполнен, все размеры подтверждены.",
    outcomeNote: "После замера клиент согласовал договор и финальную стоимость.",
    revenueAmount: "585000",
    dimensionsSummary: "Размеры шкафа подтверждены, можно запускать заказ",
    measurementComment: "Все замеры подтверждены, замечаний по объекту нет",
    measurementResult: "Получена предоплата, заказ передан в производство"
  }
];
