import { pick } from "./i18n";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

export function containsCyrillic(value) {
  return /[А-Яа-яЁё]/.test(String(value || ""));
}

function translateByMatchers(value, lang, matchers, fallbackEn, fallbackRu) {
  const source = normalize(value);

  if (!source) {
    return pick(lang, fallbackEn, fallbackRu);
  }

  const match = matchers.find((item) =>
    item.keys.some((key) => source.includes(key))
  );

  if (match) {
    return pick(lang, match.en, match.ru);
  }

  return value;
}

export function safeLocalizedText(value, lang, fallbackEn, fallbackRu = "Не указано") {
  const source = String(value || "").trim();

  if (!source) {
    return pick(lang, fallbackEn, fallbackRu);
  }

  if (lang === "en" && containsCyrillic(source)) {
    return fallbackEn;
  }

  return source;
}

export function translateSource(value, lang) {
  return translateByMatchers(
    value,
    lang,
    [
      { keys: ["instagram", "инстаграм"], en: "Instagram ads", ru: "Реклама Instagram" },
      { keys: ["whatsapp"], en: "WhatsApp", ru: "WhatsApp" },
      { keys: ["site", "website", "сайт", "quiz", "квиз"], en: "Website / quiz", ru: "Сайт / квиз" },
      { keys: ["recommend", "referral", "рекомен"], en: "Referral", ru: "Рекомендация" },
      { keys: ["ads", "advert", "реклам"], en: "Ads", ru: "Реклама" }
    ],
    "Unknown source",
    "Источник не указан"
  );
}

export function translateChannel(value, lang) {
  return translateByMatchers(
    value,
    lang,
    [
      { keys: ["whatsapp"], en: "WhatsApp", ru: "WhatsApp" },
      { keys: ["instagram", "инстаграм"], en: "Instagram", ru: "Instagram" },
      { keys: ["site", "website", "сайт"], en: "Website", ru: "Сайт" },
      { keys: ["recommend", "referral", "рекомен"], en: "Referral", ru: "Рекомендация" }
    ],
    "Channel",
    "Канал"
  );
}

export function translateProduct(value, lang) {
  return translateByMatchers(
    value,
    lang,
    [
      { keys: ["шкаф и гардероб", "wardrobe + closet"], en: "Wardrobe + walk-in closet", ru: "Шкаф и гардеробная" },
      { keys: ["кух"], en: "Kitchen", ru: "Кухня" },
      { keys: ["гардероб"], en: "Walk-in closet", ru: "Гардеробная" },
      { keys: ["шкаф-купе"], en: "Sliding wardrobe", ru: "Шкаф-купе" },
      { keys: ["шкаф"], en: "Wardrobe", ru: "Шкаф" },
      { keys: ["тумб"], en: "Cabinet", ru: "Тумба" },
      { keys: ["тв"], en: "TV unit", ru: "ТВ-зона" },
      { keys: ["офис"], en: "Commercial project", ru: "Коммерческий проект" },
      { keys: ["мелк"], en: "Small order", ru: "Мелкий заказ" }
    ],
    "Custom order",
    "Индивидуальный заказ"
  );
}

export function translateRequestType(value, lang) {
  return translateByMatchers(
    value,
    lang,
    [
      { keys: ["встроенный шкаф + гардеробная"], en: "Built-in wardrobe + walk-in closet", ru: "Встроенный шкаф + гардеробная" },
      { keys: ["шкаф и гардероб"], en: "Wardrobe + walk-in closet", ru: "Шкаф и гардеробная" },
      { keys: ["кухня под потолок"], en: "Floor-to-ceiling kitchen", ru: "Кухня под потолок" },
      { keys: ["встроенн", "built-in"], en: "Built-in wardrobe", ru: "Встроенный шкаф" },
      { keys: ["гардероб"], en: "Walk-in closet", ru: "Гардеробная" },
      { keys: ["шкаф"], en: "Wardrobe", ru: "Шкаф" },
      { keys: ["кух"], en: "Kitchen", ru: "Кухня" }
    ],
    "Order request",
    "Запрос по заказу"
  );
}

export function translateDealStage(value, lang) {
  return translateByMatchers(
    value,
    lang,
    [
      { keys: ["нов"], en: "New lead", ru: "Новая заявка" },
      { keys: ["связ"], en: "Contact", ru: "Связаться" },
      { keys: ["расч"], en: "Estimate", ru: "Расчёт" },
      { keys: ["замер выполн"], en: "Measurement completed", ru: "Замер выполнен" },
      { keys: ["замер назнач"], en: "Measurement booked", ru: "Замер назначен" },
      { keys: ["соглас"], en: "Approval", ru: "Согласование" },
      { keys: ["предоплата получ"], en: "Deposit received", ru: "Предоплата получена" },
      { keys: ["производ"], en: "Production", ru: "Производство" },
      { keys: ["отказ", "lost"], en: "Lost", ru: "Отказ" }
    ],
    "Deal in progress",
    "Сделка в работе"
  );
}

export function translateCalculationStatus(value, lang) {
  return translateByMatchers(
    value,
    lang,
    [
      { keys: ["не начин"], en: "Not started", ru: "Не начинали" },
      { keys: ["в расч"], en: "In estimate", ru: "В расчёте" },
      { keys: ["ожидает расч"], en: "Waiting for estimate", ru: "Ожидает расчёта" },
      { keys: ["отправ"], en: "Estimate sent", ru: "Расчёт отправлен" },
      { keys: ["соглас"], en: "Estimate approved", ru: "Расчёт согласован" },
      { keys: ["останов"], en: "Stopped", ru: "Остановлен" },
      { keys: ["pending", "уточ"], en: "Pending", ru: "Уточняется" }
    ],
    "Pending",
    "Уточняется"
  );
}

export function translateMeasurementStatus(value, lang) {
  return translateByMatchers(
    value,
    lang,
    [
      { keys: ["не назнач"], en: "Not booked", ru: "Не назначен" },
      { keys: ["назнач"], en: "Booked", ru: "Назначен" },
      { keys: ["подтв"], en: "Confirmed", ru: "Подтверждён" },
      { keys: ["выполн", "провед"], en: "Completed", ru: "Проведён" },
      { keys: ["сорван", "no-show"], en: "No-show", ru: "Не состоялся" }
    ],
    "Not booked",
    "Не назначен"
  );
}

export function translateUrgency(value, lang) {
  return translateByMatchers(
    value,
    lang,
    [
      { keys: ["сроч", "urgent", "hot"], en: "Urgent", ru: "Срочно" },
      { keys: ["план", "warm"], en: "Planned", ru: "Планово" },
      { keys: ["обыч", "normal"], en: "Normal", ru: "Обычная" },
      { keys: ["низк", "cold"], en: "Low priority", ru: "Низкий приоритет" }
    ],
    "Normal",
    "Обычная"
  );
}

export function translateTag(value, lang) {
  return translateByMatchers(
    value,
    lang,
    [
      { keys: ["офис"], en: "Office", ru: "Офис" },
      { keys: ["офисный проект"], en: "Office project", ru: "Офисный проект" },
      { keys: ["два варианта сметы"], en: "Two estimate options", ru: "Два варианта сметы" },
      { keys: ["выезд на объект"], en: "Site visit", ru: "Выезд на объект" },
      { keys: ["нестандартная геометрия"], en: "Complex layout", ru: "Нестандартная геометрия" },
      { keys: ["кп отправлено"], en: "Quote sent", ru: "КП отправлено" },
      { keys: ["сравнивает варианты"], en: "Comparing options", ru: "Сравнивает варианты" },
      { keys: ["нужен дожим"], en: "Needs follow-up", ru: "Нужен дожим" },
      { keys: ["нужен быстрый кп"], en: "Fast quote needed", ru: "Нужен быстрый КП" },
      { keys: ["закрыто"], en: "Closed", ru: "Закрыто" },
      { keys: ["шкаф"], en: "Wardrobe", ru: "Шкаф" },
      { keys: ["гардероб"], en: "Walk-in closet", ru: "Гардеробная" },
      { keys: ["есть размеры"], en: "Dimensions ready", ru: "Есть размеры" },
      { keys: ["новострой"], en: "New build", ru: "Новостройка" },
      { keys: ["без дизайн"], en: "No design brief", ru: "Без дизайн-проекта" },
      { keys: ["быстрый расч"], en: "Fast estimate needed", ru: "Нужен быстрый расчёт" },
      { keys: ["согласование материал"], en: "Material approval", ru: "Согласование материалов" },
      { keys: ["тёпл", "тепл"], en: "Warm lead", ru: "Тёплый клиент" },
      { keys: ["после 19"], en: "Evening visit", ru: "Выезд после 19:00" },
      { keys: ["коммерчес"], en: "Commercial", ru: "Коммерческий объект" }
    ],
    safeLocalizedText(value, lang, "Order tag", "Тег"),
    safeLocalizedText(value, lang, "Order tag", "Тег")
  );
}

export function translateTaskLane(value, lang) {
  return translateByMatchers(
    value,
    lang,
    [
      { keys: ["первый контакт"], en: "First contact", ru: "Первый контакт" },
      { keys: ["сроч"], en: "Urgent", ru: "Срочно" },
      { keys: ["расч", "estimate"], en: "Estimate", ru: "Расчёт" },
      { keys: ["дожим", "proposal"], en: "Follow-up", ru: "Дожим" },
      { keys: ["замер", "visit"], en: "Measurement", ru: "Замер" },
      { keys: ["оплат"], en: "Payment", ru: "Оплата" }
    ],
    "Task",
    "Задача"
  );
}

export function translateTaskTag(value, lang) {
  return translateByMatchers(
    value,
    lang,
    [
      { keys: ["первый контакт"], en: "First contact", ru: "Первый контакт" },
      { keys: ["расч"], en: "Estimate", ru: "Расчёт" },
      { keys: ["сроч"], en: "Urgent", ru: "Срочно" },
      { keys: ["офис"], en: "Office", ru: "Офис" },
      { keys: ["кп"], en: "Quote", ru: "КП" },
      { keys: ["смет"], en: "Estimate", ru: "Смета" },
      { keys: ["замер"], en: "Measurement", ru: "Замер" }
    ],
    translateTaskLane(value, lang),
    translateTaskLane(value, lang)
  );
}

export function translateTaskTitle(value, lang) {
  return translateByMatchers(
    value,
    lang,
    [
      { keys: ["первый контакт"], en: "First contact", ru: "Первый контакт" },
      { keys: ["бриф", "brief"], en: "Collect the brief", ru: "Собрать бриф" },
      { keys: ["подготов", "собрать расч", "предварительный расч", "смет", "расч", "estimate"], en: "Prepare estimate", ru: "Подготовить расчёт" },
      { keys: ["проверить разницу", "фасад"], en: "Review facade options", ru: "Проверить варианты фасадов" },
      { keys: ["подтверд", "confirm"], en: "Confirm the appointment", ru: "Подтвердить встречу" },
      { keys: ["назнач", "book"], en: "Book the measurement", ru: "Назначить замер" },
      { keys: ["пример", "кейс"], en: "Send an example", ru: "Отправить пример" },
      { keys: ["предоплат"], en: "Follow up on deposit", ru: "Вернуться по предоплате" },
      { keys: ["вернуть", "перезвон", "follow"], en: "Follow up with client", ru: "Вернуться к клиенту" }
    ],
    safeLocalizedText(value, lang, "Task", "Задача"),
    safeLocalizedText(value, lang, "Task", "Задача")
  );
}

export function translateTaskDescription(value, lang) {
  return safeLocalizedText(
    value,
    lang,
    "Open the deal card to review the exact task details.",
    "Откройте карточку сделки, чтобы посмотреть детали задачи."
  );
}

export function translateFollowupType(value, lang) {
  return translateByMatchers(
    value,
    lang,
    [
      { keys: ["подтвердить запись"], en: "Confirm the appointment", ru: "Подтвердить запись" },
      { keys: ["подтверждение выезда"], en: "Confirm the visit", ru: "Подтверждение выезда" },
      { keys: ["новый слот", "перенос"], en: "Find a new slot", ru: "Подобрать новый слот" },
      { keys: ["дожать"], en: "Push to booking", ru: "Дожать до записи" },
      { keys: ["дожим после расч"], en: "Follow up after estimate", ru: "Дожим после расчёта" },
      { keys: ["возврат после расч"], en: "Callback after estimate", ru: "Возврат после расчёта" },
      { keys: ["возврат после кп"], en: "Callback after quote", ru: "Возврат после КП" },
      { keys: ["предлож", "proposal"], en: "Follow up after estimate", ru: "Вернуться после предложения" },
      { keys: ["подготовить расч"], en: "Prepare estimate", ru: "Подготовить расчёт" },
      { keys: ["бюджет"], en: "Clarify budget", ru: "Уточнить бюджет" },
      { keys: ["созвон"], en: "Confirm the call", ru: "Подтвердить созвон" },
      { keys: ["пример"], en: "Send an example", ru: "Отправить пример" },
      { keys: ["кейс"], en: "Show a case", ru: "Показать кейс" },
      { keys: ["мягко"], en: "Soft follow-up", ru: "Мягко вернуться позже" }
    ],
    safeLocalizedText(value, lang, "Follow-up", "Повторный контакт"),
    safeLocalizedText(value, lang, "Follow-up", "Повторный контакт")
  );
}

export function translateAlertAction(value, lang) {
  return translateByMatchers(
    value,
    lang,
    [
      { keys: ["новая заявка"], en: "New lead", ru: "Новая заявка" },
      { keys: ["получены размеры"], en: "Dimensions received", ru: "Получены размеры" },
      { keys: ["кп отправлено"], en: "Quote sent", ru: "КП отправлено" },
      { keys: ["просроч"], en: "Overdue action", ru: "Просроченное действие" },
      { keys: ["замер"], en: "Measurement requires attention", ru: "Нужен контроль по замеру" },
      { keys: ["расч", "кп"], en: "Estimate requires attention", ru: "Нужен контроль по расчёту" },
      { keys: ["предоплат"], en: "Deposit follow-up", ru: "Контроль предоплаты" }
    ],
    safeLocalizedText(value, lang, "Attention required", "Нужен контроль"),
    safeLocalizedText(value, lang, "Attention required", "Нужен контроль")
  );
}

export function translateScheduleText(value, lang, fallbackEn = "Not scheduled", fallbackRu = "Не назначено") {
  const source = String(value || "").trim();

  if (!source) {
    return pick(lang, fallbackEn, fallbackRu);
  }

  if (lang === "ru") {
    return source;
  }

  if (/^не назначен|^не назначена|^не назначено/i.test(source)) {
    return fallbackEn;
  }

  return source
    .replace(/^вчера/i, "Yesterday")
    .replace(/^сегодня/i, "Today")
    .replace(/^завтра/i, "Tomorrow")
    .replace(/^понедельник/i, "Monday")
    .replace(/^вторник/i, "Tuesday")
    .replace(/^среда/i, "Wednesday")
    .replace(/^четверг/i, "Thursday")
    .replace(/^пятница/i, "Friday")
    .replace(/^суббота/i, "Saturday")
    .replace(/^воскресенье/i, "Sunday");
}

export function translateAmountText(value, lang, fallbackEn = "Pending", fallbackRu = "Уточняется") {
  const source = String(value || "").trim();

  if (!source) {
    return pick(lang, fallbackEn, fallbackRu);
  }

  if (lang === "ru") {
    return source;
  }

  if (/^не внесен|^не внесена|^не внесено/i.test(source)) {
    return fallbackEn;
  }

  return source
    .replace(/Предварительно:/gi, "Estimate:")
    .replace(/После брифа:/gi, "After brief:")
    .replace(/млн/gi, "m")
    .replace(/тыс/gi, "k");
}

export function translateDurationText(value, lang, fallbackEn = "Duration pending", fallbackRu = "Длительность уточняется") {
  const source = String(value || "").trim();

  if (!source) {
    return pick(lang, fallbackEn, fallbackRu);
  }

  if (lang === "ru") {
    return source;
  }

  return source
    .replace(/мин[а-я.]*/gi, "min")
    .replace(/часа/gi, "hrs")
    .replace(/час/gi, "hr");
}

export function translateEstimateLabel(value, lang) {
  return translateByMatchers(
    value,
    lang,
    [
      { keys: ["финальн"], en: "Final estimate", ru: "Финальная смета" },
      { keys: ["чернов"], en: "Draft estimate", ru: "Черновая смета" },
      { keys: ["estimate"], en: "Estimate", ru: "Смета" }
    ],
    "Estimate",
    "Смета"
  );
}

export function translateProductionStage(value, lang) {
  return translateByMatchers(
    value,
    lang,
    [
      { keys: ["не передано"], en: "Not sent", ru: "Не передано" },
      { keys: ["ожидает распил"], en: "Waiting for cutting", ru: "Ожидает распил" },
      { keys: ["распил"], en: "Cutting", ru: "Распил" },
      { keys: ["сборк"], en: "Assembly", ru: "Сборка" },
      { keys: ["готово к установке"], en: "Ready for installation", ru: "Готово к установке" },
      { keys: ["установка"], en: "Installation", ru: "Установка" },
      { keys: ["заверш"], en: "Completed", ru: "Завершено" }
    ],
    "Not started",
    "Не запущено"
  );
}

export function translateExportLabel(value, lang) {
  const source = String(value || "").trim();

  if (!source) {
    return pick(lang, "No export yet", "Экспорт пока не добавлен");
  }

  if (lang === "ru") {
    return source;
  }

  return source.replace(/^экспорт/gi, "Export");
}

export function translateNextStepText(value, lang, fallbackEn = "Open the order card", fallbackRu = "Откройте карточку заказа") {
  return translateByMatchers(
    value,
    lang,
    [
      { keys: ["позвонить, собрать базовый бриф"], en: "Call, collect the brief and align the estimate timing", ru: "Позвонить, собрать базовый бриф и согласовать удобное время для расчёта" },
      { keys: ["уточнить материалы фасадов"], en: "Clarify facade materials and send a preliminary estimate", ru: "Уточнить материалы фасадов и отправить предварительный расчёт" },
      { keys: ["собрать финальные размеры"], en: "Collect final dimensions and issue the estimate", ru: "Собрать финальные размеры и выдать расчёт" },
      { keys: ["провести замер кухни"], en: "Complete the measurement and confirm the estimate timing", ru: "Провести замер и после выезда подтвердить срок расчёта" },
      { keys: ["вернуться по отправленному кп"], en: "Follow up on the sent quote and confirm installation timing", ru: "Вернуться по отправленному КП и закрыть вопрос по сроку установки" },
      { keys: ["передать в производство"], en: "Move to production after the contract is signed", ru: "Передать в производство после подписания договора" },
      { keys: ["кп отправлено"], en: "Quote sent", ru: "КП отправлено" },
      { keys: ["после запуска в производство"], en: "After production starts", ru: "После запуска в производство" },
      { keys: ["закрыто"], en: "Closed", ru: "Закрыто" },
      { keys: ["сравнивает варианты"], en: "Comparing options", ru: "Сравнивает варианты" },
      { keys: ["ждём"], en: "Waiting for reply", ru: "Ждём ответ" },
      { keys: ["перезвон"], en: "Callback planned", ru: "Запланирован перезвон" }
    ],
    safeLocalizedText(value, lang, fallbackEn, fallbackRu),
    safeLocalizedText(value, lang, fallbackEn, fallbackRu)
  );
}

export function translateActorText(value, lang) {
  return translateByMatchers(
    value,
    lang,
    [
      { keys: ["система"], en: "System", ru: "Система" },
      { keys: ["клиент"], en: "Client", ru: "Клиент" }
    ],
    safeLocalizedText(value, lang, "Team", "Команда"),
    safeLocalizedText(value, lang, "Team", "Команда")
  );
}

export function translateLocationText(value, lang, fallbackEn = "Open the deal card for the exact location", fallbackRu = "Откройте сделку, чтобы посмотреть точный адрес") {
  const source = String(value || "").trim();

  if (!source) {
    return pick(lang, fallbackEn, fallbackRu);
  }

  if (lang === "ru") {
    return source;
  }

  return source
    .replace(/^шоурум/gi, "Showroom")
    .replace(/^онлайн/gi, "Online")
    .replace(/частный дом/gi, "private home")
    .replace(/\bул\./gi, "st.");
}
