import { randomUUID } from "node:crypto";
import { PROJECT_GROUPS, getProjectGroup, validateProjectAttachment } from "../project-workflow.js";

const FIELDS = ["name", "phone", "address", "product", "description", "manager", "note"];
const LABELS = ["Клиент", "Телефон (можно пропустить)", "Адрес", "Тип заказа", "Краткое описание", "Ответственный менеджер", "Примечание (можно пропустить)"];
const PRODUCTS = ["Кухня", "Шкаф", "Гардеробная", "Другое"];
const MAX_BATCH_FILES = 20;
const short = (value, limit = 110) => String(value || "Не указано").slice(0, limit);
const button = (text, action, ...args) => ({ text, callback_data: ["fp", action, ...args].join("|") });
export const projectMenuRows = () => [[button("Новая заявка", "new"), button("Проекты", "list")]];
const back = (id) => [button("Назад к проекту", "open", id)];

export function isProjectUpdate(update, state) {
  const text = String(update.message?.text || "").trim();
  return update.callback_query?.data?.startsWith("fp|") ||
    /^(\/newrequest(?:@\w+)?|\/projects(?:@\w+)?|новая заявка|проекты)$/iu.test(text) ||
    /^\/start(?:@\w+)? project_[\w-]+$/i.test(text) ||
    (state?.flow === "project_workflow" && !text.startsWith("/")) ||
    (state?.flow === "project_workflow" && /^\/cancel$/i.test(text));
}

// Dependencies reuse the existing lead facade and persisted Telegram conversation state.
export function createProjectBotFlow(deps) {
  return async function handle(update, subscriber) {
    const callback = update.callback_query;
    const message = callback?.message || update.message;
    const chat = message?.chat;
    const from = callback?.from || message?.from;
    const text = String(update.message?.text || "").trim();
    let state = await deps.readState(chat?.id);
    if (!isProjectUpdate(update, state)) return null;
    if (callback) await deps.ack(callback.id).catch(() => {});
    const send = (content, rows = projectMenuRows()) => deps.send(chat.id, content, { inline_keyboard: rows });
    const finish = async (content, rows) => ({ ok: true, action: "project_workflow", reply: await send(content, rows) });
    const employee = chat?.type === "private" && subscriber &&
      ["director", "manager", "measurer"].includes(subscriber.role) &&
      String(subscriber.telegramUserId || subscriber.chatId) === String(from?.id) && String(subscriber.chatId) === String(chat?.id) &&
      (!deps.access || deps.access(from.id).read);
    if (!employee) return finish("Проекты доступны зарегистрированным сотрудникам в личном чате. Используйте /register или обратитесь к руководителю.");
    const canEdit = deps.access ? deps.access(from.id).write : ["director", "manager"].includes(subscriber.role);
    const setState = async (next) => {
      state = { ...next, flow: "project_workflow", userId: String(from.id) };
      await deps.writeState(chat.id, state);
    };
    const owned = state?.flow === "project_workflow" && state.userId === String(from.id);
    const [, action, arg, extra, value] = String(callback?.data || "").split("|");
    const list = async (group, page = 0) => {
      if (!PROJECT_GROUPS[group]) return finish("Проекты видны всей команде, в том числе на стадии разработки.", [
        ...Object.entries(PROJECT_GROUPS).map(([id, label]) => [button(label, "list", id)]), ...projectMenuRows()
      ]);
      const all = (await deps.listLeads()).filter((lead) => lead.status !== "LOST" && getProjectGroup(lead) === group);
      const start = Math.max(0, Math.trunc(Number(page) || 0)) * 8;
      const rows = all.slice(start, start + 8).map((lead) => [button(`${short(lead.id, 8)} · ${short(lead.name, 35)} · ${short(lead.product, 25)}`, "open", lead.slug)]);
      if (start > 0) rows.push([button("Ранее", "list", group, String(page - 1))]);
      if (all.length > start + 8) rows.push([button("Далее", "list", group, String(Number(page) + 1))]);
      return finish(`${PROJECT_GROUPS[group]}: ${all.length}`, [...rows, [button("Все стадии", "list")], ...projectMenuRows()]);
    };
    const card = async (id, prefix = "") => {
      const lead = await deps.getLead(id);
      if (!lead) return finish("Проект не найден. Откройте список заново.");
      const files = await deps.listFiles(id);
      const updated = files[0]?.createdAt || lead.updatedAt || lead.lastTouch || lead.createdAt;
      const rows = [[button("Актуальный проект", "current", id)],
        [button("Все файлы", "files", id), button("Фото", "photos", id)],
        [button("История / версии", "history", id)]];
      if (canEdit) rows.push([button("Добавить файлы", "upload", id), button("Добавить фото", "photo", id)], [button("Обновить проект", "update", id)]);
      rows.push([button("Назад к списку", "list", getProjectGroup(lead))]);
      return finish([
        prefix, `Проект ${short(lead.orderNumber || lead.id, 35)}`, `Клиент: ${short(lead.name)}`,
        `Заказ: ${short(lead.product)}`, `Адрес: ${short(lead.address)}`, `Менеджер: ${short(lead.manager)}`,
        `Статус: ${PROJECT_GROUPS[getProjectGroup(lead)]} · ${short(lead.project?.status, 60)}`,
        `Обновлён: ${short(updated, 40)}`
      ].filter(Boolean).join("\n"), rows);
    };
    const files = async (id, mode, page = 0) => {
      if (!await deps.getLead(id)) return finish("Проект не найден.");
      const all = await deps.listFiles(id);
      let selected = mode === "history" ? all.filter((file) => !file.isCurrent) : all.filter((file) => file.isCurrent);
      if (mode === "photos") selected = selected.filter((file) => file.kind === "photo");
      if (mode === "current") {
        const drawing = selected.find((file) => file.groupKey === "drawings-pdf");
        if (drawing) return deliver(drawing.id, false);
        selected = selected.filter((file) => file.kind !== "photo");
      }
      const start = Math.max(0, Math.trunc(Number(page) || 0)) * 8;
      const rows = selected.slice(start, start + 8).map((file) => [button(
        `${file.isCurrent ? "АКТУАЛЬНО" : "АРХИВ"} v${file.version} · ${short(file.fileName, 38)}`,
        file.isCurrent ? "view" : "archive", file.id
      )]);
      if (start > 0) rows.push([button("Ранее", mode, id, String(page - 1))]);
      if (selected.length > start + 8) rows.push([button("Далее", mode, id, String(Number(page) + 1))]);
      return finish(mode === "history" ? "История. Старые версии НЕ ДЛЯ ПРОИЗВОДСТВА." : selected.length ? "Актуальные материалы. Перед работой открывайте их заново из карточки." : "Материалы пока не добавлены.", [...rows, back(id)]);
    };
    const deliver = async (id, archive) => {
      const file = await deps.getFile(id);
      if (!file || !await deps.getLead(file.leadId)) return finish("Файл не найден.");
      if (!archive && !file.isCurrent) return finish("Эта версия устарела. Откройте актуальные материалы.", [[button("Актуальный проект", "current", file.leadId)], back(file.leadId)]);
      const caption = [file.isCurrent ? "АКТУАЛЬНО НА МОМЕНТ ОТПРАВКИ" : "АРХИВ. НЕ ДЛЯ ПРОИЗВОДСТВА!",
        `${short(file.fileName)} · v${file.version}`, `${file.createdAt} · ${short(file.uploadedBy, 60)}`,
        "Сохранённая копия может устареть. Перед изготовлением проверьте карточку проекта."].join("\n");
      await deps.deliverFile(chat.id, file, caption, { inline_keyboard: [[button("Проверить актуальность", "current", file.leadId)], ...(canEdit && file.isCurrent ? [[button("Загрузить новую версию", "replace", file.id)]] : []), back(file.leadId)] });
      return { ok: true, action: "project_file_sent" };
    };
    const prompt = async () => {
      const index = state.step;
      const token = state.token;
      if (index >= FIELDS.length) {
        return finish("Проверьте заявку:\n" + FIELDS.map((field, i) => `${LABELS[i]}: ${short(state.draft[field], 400)}`).join("\n"), [
          [button("Создать заявку", "confirm", token)], [button("Изменить", "edit", token), button("Отмена", "cancel", token)]
        ]);
      }
      const rows = [];
      if (index === 3) rows.push(...PRODUCTS.map((product, i) => [button(product, "answer", token, String(index), String(i))]));
      if (index === 5) rows.push(...state.managers.map((name, i) => [button(short(name, 55), "answer", token, String(index), String(i))]));
      if ([1, 6].includes(index)) rows.push([button("Пропустить", "answer", token, String(index), "skip")]);
      rows.push([button("Отмена", "cancel", token)]);
      return finish(`${index + 1}/${FIELDS.length}. ${LABELS[index]}\n${index === 5 ? "Выберите сотрудника кнопкой." : "Напишите ответ или выберите кнопку."}`, rows);
    };
    try {
      if (/^(\/projects(?:@\w+)?|проекты)$/iu.test(text) || action === "list") {
        if (owned) await deps.clearState(chat.id);
        return list(arg, extra);
      }
      const deepLink = text.match(/^\/start(?:@\w+)? project_([\w-]+)$/i);
      if (action === "open" || deepLink) {
        if (owned) await deps.clearState(chat.id);
        return card(arg || deepLink[1]);
      }
      if (["current", "files", "photos", "history"].includes(action)) return files(arg, action, extra);
      if (action === "view") return deliver(arg, false);
      if (action === "archive") {
        const file = await deps.getFile(arg);
        if (!file) return finish("Файл не найден.");
        return finish("Это старая версия. Не используйте её для изготовления мебели.", [[button("Открыть архив для сравнения", "archiveok", arg)], back(file.leadId)]);
      }
      if (action === "archiveok") return deliver(arg, true);
      if (!canEdit) return finish("Можно просматривать проекты и файлы. Изменения вносит менеджер.");
      if (/^(\/newrequest(?:@\w+)?|новая заявка)$/iu.test(text) || action === "new") {
        const managers = await deps.managers(subscriber);
        if (!managers.length) return finish("Сначала добавьте ответственного менеджера в команду BOSE.");
        await setState({ mode: "create", token: randomUUID().slice(0, 8), sourceRef: randomUUID(), step: 0, draft: {}, managers });
        return prompt();
      }
      if (action === "cancel" || text === "/cancel" || text.toLowerCase() === "отмена") {
        if (callback && (!owned || arg !== state.token)) return finish("Эта кнопка устарела.");
        await deps.clearState(chat.id);
        return finish("Отменено. Файлы и проекты не изменены.");
      }
      if (["upload", "photo", "replace", "update"].includes(action)) {
        const previous = action === "replace" ? await deps.getFile(arg) : null;
        if (action === "replace" && !previous?.isCurrent) return finish("Файл уже обновлён. Откройте карточку заново.");
        const id = previous?.leadId || arg;
        if (!await deps.getLead(id)) return finish("Проект не найден.");
        const batch = action === "upload" || action === "photo";
        await setState({ mode: action === "update" ? "update" : batch ? "batchupload" : "upload", leadId: id, token: randomUUID().slice(0, 8), groupKey: previous?.groupKey || null, expectedCurrentId: previous?.id || null, photoOnly: action === "photo", files: batch ? [] : undefined });
        if (action === "update") return finish("Что обновить?", [[button("Материалы / новая версия", "files", id)], [button("Комментарий к проекту", "comment", state.token)], back(id)]);
        if (previous) return finish(`Отправьте новую версию: ${previous.fileName}. Старую сохраним в истории.`, [[button("Отмена", "cancel", state.token)], back(id)]);
        return finish(`Отправляйте ${action === "photo" ? "фотографии" : "PDF, фото, документы, чертежи или архивы"} до 20 МБ каждый. Можно несколько сообщений подряд. Когда закончите, нажмите «Сохранить пакет».`, [[button("Отмена", "cancel", state.token)], back(id)]);
      }
      if (!owned) return finish("Сценарий завершён или устарел. Откройте нужный проект.");
      if (callback && !["answer", "confirm", "edit", "comment", "savefile", "separate", "savebatch", "clearbatch"].includes(action)) return finish("Откройте меню проекта заново.");
      if (callback && arg !== state.token) return finish("Эта кнопка из старой формы. Используйте последнее сообщение.");
      if (action === "comment") {
        await setState({ ...state, mode: "comment" });
        return finish("Напишите обновлённый комментарий. Статус проекта не изменится.", [[button("Отмена", "cancel", state.token)]]);
      }
      if (state.mode === "comment" && text) {
        if (text.length > 1500) return finish("Сократите комментарий до 1500 символов.");
        const result = await deps.updateLead(state.leadId, { project: { designerComment: text, preparedAt: new Date().toISOString() } });
        if (!result.ok) return finish("Не удалось сохранить комментарий. Попробуйте ещё раз.");
        await deps.clearState(chat.id);
        return card(state.leadId, "Комментарий обновлён.");
      }
      if (state.mode === "create") {
        if (action === "edit") { await setState({ ...state, step: 0 }); return prompt(); }
        if (action === "confirm" && state.step === FIELDS.length) {
          const result = await deps.createLead({ ...state.draft, staffRequest: true, sourceRef: state.sourceRef, chatId: String(chat.id), telegramUserId: String(from.id), authorName: subscriber.name || from.first_name, sourceLabel: "Telegram staff" });
          if (!result.ok || !result.lead) return finish("Не удалось сохранить заявку. Данные формы сохранены, попробуйте подтвердить ещё раз.", [[button("Повторить создание", "confirm", state.token)], [button("Отмена", "cancel", state.token)]]);
          await setState({ mode: "created", token: state.token, leadId: result.lead.slug });
          return card(result.lead.slug, "Заявка создана. Теперь прикрепите материалы.");
        }
        if (state.step >= FIELDS.length) return prompt();
        if (action === "answer" && Number(extra) !== state.step) return prompt();
        if (!callback && message.message_id <= (state.lastMessageId || 0)) return { ok: true, action: "project_duplicate_message" };
        let answer = text;
        if (action === "answer") answer = value === "skip" ? "" : state.step === 3 ? PRODUCTS[Number(value)] : state.managers[Number(value)];
        if (state.step === 5 && !callback) return prompt();
        if (typeof answer !== "string" || (answer.length === 0 && ![1, 6].includes(state.step)) || answer.length > (state.step >= 4 ? 1500 : 200)) return finish("Ответ пустой или слишком длинный. Введите короткий ответ.", [[button("Продолжить форму", "edit", state.token)]]);
        if (state.step === 1 && answer && !/^[+\d ()-]{5,30}$/.test(answer)) return finish("Проверьте номер телефона или нажмите «Пропустить».", [[button("Пропустить", "answer", state.token, "1", "skip")]]);
        await setState({ ...state, lastMessageId: message.message_id, draft: { ...state.draft, [FIELDS[state.step]]: answer }, step: state.step + 1 });
        return prompt();
      }
      if (state.mode === "created") return card(state.leadId, "Эта заявка уже создана.");
      if (state.mode === "batchupload" && (update.message?.document || update.message?.photo)) {
        const photo = update.message.photo?.at(-1);
        const attachment = photo || update.message.document;
        if (state.photoOnly && !photo && !String(attachment.mime_type || "").startsWith("image/")) return finish("Отправьте фотографию.");
        const file = validateProjectAttachment({
          fileName: photo ? `photo-${attachment.file_unique_id}.jpg` : attachment.file_name,
          size: attachment.file_size, contentType: photo ? "image/jpeg" : attachment.mime_type || "application/octet-stream",
          telegramFileId: attachment.file_id, kind: photo || String(attachment.mime_type || "").startsWith("image/") ? "photo" : "document",
          telegramMediaType: photo ? "photo" : "document",
          pathname: `telegram:${attachment.file_unique_id}`, sourceRef: `telegram:${chat.id}:${update.message.message_id}`
        });
        const pending = state.files || [];
        if (pending.some((item) => item.sourceRef === file.sourceRef)) return { ok: true, action: "project_batch_duplicate" };
        if (pending.length >= MAX_BATCH_FILES) return finish(`В одном пакете максимум ${MAX_BATCH_FILES} файлов. Сохраните этот пакет и начните следующий.`, [[button(`Сохранить пакет (${pending.length})`, "savebatch", state.token)], [button("Отмена", "cancel", state.token)]]);
        const nextFiles = [...pending, file];
        await setState({ ...state, files: nextFiles });
        return finish(`В пакете: ${nextFiles.length}. Отправьте ещё материалы или сохраните пакет.`, [[button(`Сохранить пакет (${nextFiles.length})`, "savebatch", state.token)], [button("Очистить пакет", "clearbatch", state.token), button("Отмена", "cancel", state.token)]]);
      }
      if (state.mode === "batchupload" && action === "clearbatch") {
        await setState({ ...state, files: [] });
        return finish("Пакет очищен. Отправьте материалы заново.", [[button("Отмена", "cancel", state.token)], back(state.leadId)]);
      }
      if (state.mode === "batchupload" && action === "savebatch") {
        const pending = state.files || [];
        if (!pending.length) return finish("В пакете пока нет файлов. Отправьте материал или отмените загрузку.", [[button("Отмена", "cancel", state.token)], back(state.leadId)]);
        for (const file of pending) {
          const currentFiles = (await deps.listFiles(state.leadId)).filter((item) => item.isCurrent);
          const matching = currentFiles.find((item) => item.fileName.toLowerCase() === file.fileName.toLowerCase());
          const primaryDrawing = currentFiles.find((item) => item.groupKey === "drawings-pdf");
          const groupKey = matching?.groupKey || (file.fileName.toLowerCase().endsWith(".pdf") && !primaryDrawing ? "drawings-pdf" : randomUUID());
          await deps.saveFile({ ...file, leadId: state.leadId, groupKey, expectedCurrentId: matching?.id || null, uploadedBy: subscriber.name || from.first_name, uploadedByTelegramId: String(from.id) });
        }
        await setState({ mode: "created", token: state.token, leadId: state.leadId });
        return card(state.leadId, `Сохранено материалов: ${pending.length}. Все новые версии отмечены как АКТУАЛЬНЫЕ.`);
      }
      if (state.mode === "upload" && (update.message?.document || update.message?.photo)) {
        const photo = update.message.photo?.at(-1);
        const attachment = photo || update.message.document;
        if (state.photoOnly && !photo && !String(attachment.mime_type || "").startsWith("image/")) return finish("Отправьте фотографию.");
        const file = validateProjectAttachment({
          fileName: photo ? `photo-${attachment.file_unique_id}.jpg` : attachment.file_name,
          size: attachment.file_size, contentType: photo ? "image/jpeg" : attachment.mime_type || "application/octet-stream",
          telegramFileId: attachment.file_id, kind: photo || String(attachment.mime_type || "").startsWith("image/") ? "photo" : "document",
          telegramMediaType: photo ? "photo" : "document",
          pathname: `telegram:${attachment.file_unique_id}`, sourceRef: `telegram:${chat.id}:${update.message.message_id}`
        });
        const currentFiles = (await deps.listFiles(state.leadId)).filter((item) => item.isCurrent);
        const matching = currentFiles.find((item) => item.fileName.toLowerCase() === file.fileName.toLowerCase());
        const groupKey = state.groupKey || matching?.groupKey || (file.fileName.toLowerCase().endsWith(".pdf") ? "drawings-pdf" : randomUUID());
        const current = currentFiles.find((item) => item.groupKey === groupKey);
        await setState({ ...state, mode: "confirmfile", file, groupKey, expectedCurrentId: state.groupKey ? state.expectedCurrentId : current?.id || null });
        return finish(`${current ? `Заменить ${short(current.fileName)} (v${current.version})?` : "Добавить новый материал?"}\n${file.fileName}\nНовая версия станет актуальной. Предыдущая останется в истории.`, [[button("Сохранить актуальную версию", "savefile", state.token)], ...(current ? [[button("Это отдельный документ", "separate", state.token)]] : []), [button("Отмена", "cancel", state.token)]]);
      }
      if (state.mode === "confirmfile" && action === "separate") {
        await setState({ ...state, groupKey: randomUUID(), expectedCurrentId: null });
        return finish(`Добавить отдельно: ${state.file.fileName}? Текущий чертёж не изменится.`, [[button("Добавить документ", "savefile", state.token)], [button("Отмена", "cancel", state.token)]]);
      }
      if (state.mode === "confirmfile" && action === "savefile") {
        await deps.saveFile({ ...state.file, leadId: state.leadId, groupKey: state.groupKey, expectedCurrentId: state.expectedCurrentId, uploadedBy: subscriber.name || from.first_name, uploadedByTelegramId: String(from.id) });
        await setState({ mode: "created", token: state.token, leadId: state.leadId });
        return card(state.leadId, "Материал сохранён как АКТУАЛЬНЫЙ. История сохранена.");
      }
      return finish("Используйте кнопки последнего сообщения или откройте проект заново.");
    } catch (error) {
      if (error.code === "PROJECT_VERSION_CONFLICT") return finish(error.message, state?.leadId ? [back(state.leadId)] : projectMenuRows());
      if (/формат|Размер файла/.test(error.message)) return finish(error.message, [[button("Отмена", "cancel", state?.token)]]);
      deps.log?.(error);
      return finish("Не удалось выполнить действие. Данные формы сохранены. Попробуйте ещё раз или обратитесь к руководителю.");
    }
  };
}
