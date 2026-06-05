function getFirstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "Здравствуйте";
}

function normalizeTemplateTime(value) {
  if (!value) {
    return "по удобному для вас времени";
  }

  return String(value);
}

export function buildTelegramReplyTemplates(lead) {
  const firstName = getFirstName(lead?.name);
  const appointments = Array.isArray(lead?.appointments) ? lead.appointments : [];
  const nextAppointment =
    appointments.find((item) =>
      ["SCHEDULED", "CONFIRMED"].includes(String(item.status || "").toUpperCase())
    ) || appointments[0];
  const noShowAppointment = appointments.find(
    (item) => String(item.status || "").toUpperCase() === "NO_SHOW"
  );
  const appointmentTime = normalizeTemplateTime(nextAppointment?.scheduledAt);
  const appointmentLocation = nextAppointment?.location || "в удобном для вас формате";
  const noShowTime = normalizeTemplateTime(noShowAppointment?.scheduledAt);

  return [
    {
      key: "first-touch",
      label: "Первый контакт",
      text: `${firstName}, здравствуйте. Увидели ваш запрос и взяли его в работу. Могу коротко уточнить пару деталей и предложить удобное окно для созвона или записи.`
    },
    {
      key: "booking-confirmation",
      label: "Подтверждение записи",
      text: `${firstName}, подтверждаю вашу запись на ${appointmentTime}. Формат: ${appointmentLocation}. Если время актуально, просто ответьте, что всё в силе.`
    },
    {
      key: "reschedule",
      label: "Перенос слота",
      text: `${firstName}, если текущее время вам уже неудобно, можем быстро перенести запись на другой слот. Напишите, пожалуйста, какой интервал вам подходит, и я сразу предложу варианты.`
    },
    {
      key: "no-show-recovery",
      label: "Возврат после no-show",
      text: `${firstName}, не дождались вас на записи ${noShowTime}. Если вопрос ещё актуален, давайте быстро вернёмся и подберём новое удобное время без лишней переписки.`
    },
    {
      key: "post-visit-followup",
      label: "После визита",
      text: `${firstName}, спасибо за визит. Если хотите, я коротко зафиксирую следующий шаг и предложу удобное время для повторного контакта или следующей записи.`
    }
  ];
}

export function getTelegramReplyTemplateByKey(lead, templateKey) {
  return buildTelegramReplyTemplates(lead).find(
    (template) => template.key === templateKey
  );
}

export function suggestTelegramReplyDraft(lead) {
  const templates = buildTelegramReplyTemplates(lead);
  const appointments = Array.isArray(lead?.appointments) ? lead.appointments : [];
  const currentStatus = String(lead?.status || "").toUpperCase();

  if (appointments.some((item) => String(item.status || "").toUpperCase() === "NO_SHOW")) {
    return {
      reason: "У лида есть no-show, лучше сразу мягко вернуть его в новый слот.",
      template: templates.find((item) => item.key === "no-show-recovery") || templates[0]
    };
  }

  if (
    appointments.some((item) =>
      ["SCHEDULED", "CONFIRMED"].includes(String(item.status || "").toUpperCase())
    )
  ) {
    return {
      reason: "По лиду уже есть запись, поэтому логичнее начать с подтверждения или уточнения слота.",
      template: templates.find((item) => item.key === "booking-confirmation") || templates[0]
    };
  }

  if (["NEW", "CONTACTED"].includes(currentStatus)) {
    return {
      reason: "Лид ещё на раннем этапе, поэтому лучше начать с короткого первого касания.",
      template: templates.find((item) => item.key === "first-touch") || templates[0]
    };
  }

  if (["QUALIFIED", "MEETING", "PROPOSAL"].includes(currentStatus)) {
    return {
      reason: "Лид уже тёплый, поэтому лучше мягко подтянуть его к слоту или следующему шагу.",
      template: templates.find((item) => item.key === "reschedule") || templates[0]
    };
  }

  return {
    reason: "Это базовый безопасный черновик для ручной доработки менеджером.",
    template: templates[0] || null
  };
}
