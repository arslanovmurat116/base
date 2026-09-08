import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { randomUUID } from "node:crypto";
import { createProjectBotFlow } from "../lib/telegram/project-flow.js";
import { getProjectGroup, nextProjectVersion, validateProjectAttachment, buildStaffProjectPatch } from "../lib/project-workflow.js";

function harness() {
  const states = new Map(), leads = [], files = [], messages = [], deliveries = [];
  let messageId = 1;
  const editor = { chatId: "101", telegramUserId: "101", role: "manager", name: "Manager" };
  const viewer = { chatId: "102", telegramUserId: "102", role: "measurer", name: "Workshop" };
  const deps = {
    readState: async (id) => structuredClone(states.get(String(id))),
    writeState: async (id, value) => states.set(String(id), structuredClone(value)),
    clearState: async (id) => states.delete(String(id)),
    listLeads: async () => leads,
    getLead: async (id) => leads.find((lead) => lead.slug === id),
    createLead: async (payload) => {
      let lead = leads.find((entry) => entry.sourceRef === payload.sourceRef);
      if (!lead) {
        lead = { ...payload, ...buildStaffProjectPatch(payload), slug: randomUUID(), id: `P${leads.length + 1}`, status: "NEW" };
        leads.push(lead);
      }
      return { ok: true, lead };
    },
    updateLead: async (id, patch) => { const lead = leads.find((entry) => entry.slug === id); lead.project = { ...lead.project, ...patch.project }; return { ok: true }; },
    managers: async () => ["Manager", "Colleague"],
    listFiles: async (id) => files.filter((file) => file.leadId === id),
    getFile: async (id) => files.find((file) => file.id === id),
    saveFile: async (input) => {
      const decision = nextProjectVersion(files.filter((file) => file.leadId === input.leadId), input);
      if (decision.duplicate) return decision.duplicate;
      if (decision.current) decision.current.isCurrent = false;
      const row = { ...input, id: randomUUID(), version: decision.version, isCurrent: true, createdAt: new Date().toISOString() };
      files.unshift(row);
      return row;
    },
    ack: async () => {},
    send: async (chatId, text, markup) => { const reply = { chatId, text, markup }; messages.push(reply); return reply; },
    deliverFile: async (...args) => deliveries.push(args),
    log: (error) => { throw error; }
  };
  let handler = createProjectBotFlow(deps);
  const send = (text, subscriber = editor, attachment = {}) => handler({ message: { text, ...attachment, message_id: messageId++, chat: { id: Number(subscriber.chatId), type: "private" }, from: { id: Number(subscriber.telegramUserId) } } }, subscriber);
  const click = (data, subscriber = editor) => handler({ callback_query: { id: randomUUID(), data, from: { id: Number(subscriber.telegramUserId) }, message: { message_id: messageId++, chat: { id: Number(subscriber.chatId), type: "private" } } } }, subscriber);
  const button = (label) => messages.at(-1).markup.inline_keyboard.flat().find((item) => item.text === label)?.callback_data;
  const press = (label, subscriber) => { const data = button(label); assert.ok(data, `Missing button: ${label}`); return click(data, subscriber); };
  const draft = async () => {
    await send("Новая заявка"); await send("Test client"); await press("Пропустить"); await send("Test address");
    await press("Кухня"); await send("Test kitchen project"); await press("Manager"); await send("Test note");
  };
  const create = async () => { await draft(); await press("Создать заявку"); return leads.at(-1); };
  const pdf = (name = "drawing.pdf") => ({ document: { file_id: randomUUID(), file_unique_id: randomUUID(), file_name: name, file_size: 200, mime_type: "application/pdf" } });
  return { deps, states, leads, files, messages, deliveries, send, click, press, button, draft, create, pdf, editor, viewer, restart: () => { handler = createProjectBotFlow(deps); } };
}

test("create, optional phone, edit/cancel and duplicate confirmation", async () => {
  const h = harness();
  await h.draft();
  await h.press("Изменить");
  assert.equal(h.states.get("101").step, 0);
  await h.press("Отмена");
  assert.equal(h.leads.length, 0);
  await h.draft();
  const confirm = h.button("Создать заявку");
  await h.click(confirm); await h.click(confirm);
  assert.equal(h.leads.length, 1);
  assert.equal(h.leads[0].phone, "");
  assert.equal(h.leads[0].address, "Test address");
  assert.equal(h.leads[0].project.description, "Test kitchen project");
  await h.create();
  assert.equal(h.leads.length, 2, "same manager can create multiple projects");
});

test("full project PDF/photo flow, second employee, restart, current and history", async () => {
  const h = harness(); const lead = await h.create();
  await h.press("Добавить файл"); await h.send("", h.editor, h.pdf());
  const confirm = h.button("Сохранить актуальную версию");
  await h.click(confirm); await h.click(confirm);
  assert.equal(h.files.length, 1);
  const original = h.files[0];
  h.restart();
  await h.send("/projects", h.viewer); await h.press("В разработке", h.viewer);
  await h.click(`fp|open|${lead.slug}`, h.viewer); await h.press("Актуальный проект", h.viewer);
  assert.equal(h.deliveries.at(-1)[1].id, original.id);
  await h.click(`fp|replace|${original.id}`); await h.send("", h.editor, h.pdf("new-drawing.pdf")); await h.press("Сохранить актуальную версию");
  assert.equal(h.files.length, 2);
  assert.equal(original.isCurrent, false);
  const current = h.files.find((file) => file.isCurrent);
  assert.equal(current.version, 2);
  const delivered = h.deliveries.length;
  await h.click(`fp|view|${original.id}`, h.viewer);
  assert.equal(h.deliveries.length, delivered, "stale callback cannot send old PDF as current");
  await h.press("Актуальный проект", h.viewer);
  assert.equal(h.deliveries.at(-1)[1].id, current.id);
  await h.click(`fp|history|${lead.slug}`, h.viewer);
  await h.click(`fp|archive|${original.id}`, h.viewer);
  assert.equal(h.deliveries.length, delivered + 1, "archive requires confirmation");
  await h.press("Открыть архив для сравнения", h.viewer);
  assert.match(h.deliveries.at(-1)[2], /НЕ ДЛЯ ПРОИЗВОДСТВА/);
  await h.click(`fp|photo|${lead.slug}`);
  await h.send("", h.editor, { photo: [{ file_id: "photo-id", file_unique_id: "photo-unique", file_size: 600 }] });
  await h.press("Сохранить актуальную версию");
  assert.equal(h.files.filter((file) => file.isCurrent).length, 2);
  await h.click(`fp|photos|${lead.slug}`, h.viewer);
  assert.match(h.messages.at(-1).markup.inline_keyboard[0][0].text, /photo/);
  assert.equal(h.files.find((file) => file.groupKey === "drawings-pdf" && file.isCurrent).id, current.id);
  for (const message of h.messages) for (const item of message.markup.inline_keyboard.flat()) assert.ok(Buffer.byteLength(item.callback_data) <= 64);
});

test("separate PDF does not supersede drawings; update only changes comment", async () => {
  const h = harness(); const lead = await h.create();
  await h.press("Добавить файл"); await h.send("", h.editor, h.pdf()); await h.press("Сохранить актуальную версию");
  const original = h.files[0];
  await h.press("Добавить файл"); await h.send("", h.editor, h.pdf("contract.pdf"));
  await h.press("Это отдельный документ"); await h.press("Добавить документ");
  assert.equal(original.isCurrent, true);
  assert.equal(h.files.filter((file) => file.isCurrent).length, 2);
  await h.press("Обновить проект"); await h.press("Комментарий к проекту"); await h.send("New comment");
  assert.equal(lead.project.designerComment, "New comment");
  assert.equal(lead.project.status, "Черновик");
});

test("stale forms, group chat, untrusted IDs and viewer writes are rejected", async () => {
  const h = harness(); const lead = await h.create();
  await h.click(`fp|upload|${lead.slug}`, h.viewer);
  assert.match(h.messages.at(-1).text, /Изменения вносит менеджер/);
  await h.send("Новая заявка"); const stale = h.button("Отмена"); await h.send("Новая заявка"); await h.click(stale);
  assert.ok(h.states.get("101"));
  h.deps.access = () => ({ read: false, write: false }); h.restart();
  await h.send("/projects"); assert.match(h.messages.at(-1).text, /зарегистрированным сотрудникам/);
  delete h.deps.access;
  const flow = createProjectBotFlow(h.deps);
  await flow({ message: { text: "/projects", chat: { id: -101, type: "group" }, from: { id: 101 } } }, h.editor);
  assert.match(h.messages.at(-1).text, /личном чате/);
});

test("image sent as document keeps its Telegram transport type", async () => {
  const h = harness(); await h.create(); await h.press("Добавить фото");
  await h.send("", h.editor, { document: { file_id: "image-as-file", file_unique_id: "image-unique", file_name: "plan.jpg", file_size: 100, mime_type: "image/jpeg" } });
  await h.press("Сохранить актуальную версию");
  assert.equal(h.files[0].kind, "photo");
  assert.equal(h.files[0].telegramMediaType, "document");
});

test("duplicate user message does not answer the next wizard question", async () => {
  const h = harness();
  const flow = createProjectBotFlow(h.deps);
  await h.send("Новая заявка");
  const update = { message: { text: "Client", message_id: 100, chat: { id: 101, type: "private" }, from: { id: 101 } } };
  await flow(update, h.editor); await flow(update, h.editor);
  assert.equal(h.states.get("101").step, 1);
  assert.equal(h.states.get("101").draft.phone, undefined);
});

test("CAS and source dedup preserve one current version", () => {
  const rows = [{ id: "new", sourceRef: "update-new", groupKey: "drawings-pdf", version: 2, isCurrent: true }, { id: "old", sourceRef: "update-old", groupKey: "drawings-pdf", version: 1, isCurrent: false }];
  assert.throws(() => nextProjectVersion(rows, { groupKey: "drawings-pdf", sourceRef: "update-3", expectedCurrentId: "old" }), /уже обновлён/);
  assert.equal(nextProjectVersion(rows, { sourceRef: "update-old" }).duplicate.id, "old");
  assert.equal(nextProjectVersion(rows, { groupKey: "drawings-pdf", sourceRef: "update-3", expectedCurrentId: "new" }).version, 3);
});

test("safe formats and size limits; existing stages are reused", () => {
  for (const name of ["a.pdf", "a.jpg", "a.docx", "a.dwg", "a.skp", "a.zip"]) assert.equal(validateProjectAttachment({ fileName: name, size: 20 }).fileName, name);
  for (const file of [{ fileName: "run.exe", size: 20 }, { fileName: "a.pdf", size: 0 }, { fileName: "a.pdf", size: 21 * 1024 * 1024 }]) assert.throws(() => validateProjectAttachment(file));
  assert.equal(getProjectGroup({ project: { status: "Черновик" } }), "development");
  assert.equal(getProjectGroup({ order: { production: { handedToProduction: true, stage: "Ожидает распил" } } }), "ready");
  assert.equal(getProjectGroup({ order: { production: { stage: "Распил" } } }), "production");
  assert.equal(getProjectGroup({ productionStatus: "Завершено" }), "completed");
});

test("actual file adapter: isolated mock persistence survives reload and concurrent uploads", async () => {
  let stored = [];
  async function loadAdapter() {
    const context = vm.createContext({ process: { env: {} }, console, Date, URL });
    const modules = {
      "node:crypto": { randomUUID },
      "./db": { getPool() { throw new Error("Unexpected live DB use"); }, isLiveDatabaseEnabled: () => false, query() { throw new Error("Unexpected DB use"); } },
      "./persistent-store": { readPersistentJson: async () => structuredClone(stored), writePersistentJson: async (_, rows) => { stored = structuredClone(rows); }, buildPrivateBlobProxyUrl: (value) => value },
      "./core/business-events": { appendBusinessEvent() {}, buildBusinessEvent() {} },
      "./project-workflow": { nextProjectVersion, validateProjectAttachment }
    };
    const mod = new vm.SourceTextModule(await readFile(new URL("../lib/project-files.js", import.meta.url), "utf8"), { context });
    await mod.link(async (specifier) => {
      const values = modules[specifier]; assert.ok(values, specifier);
      return new vm.SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context });
    });
    await mod.evaluate(); return mod.namespace;
  }
  let adapter = await loadAdapter();
  const input = { leadId: "project-1", groupKey: "drawings-pdf", sourceRef: "first", fileName: "drawing.pdf", size: 100, pathname: "telegram:first", expectedCurrentId: null };
  const first = await adapter.saveProjectFile(input);
  adapter = await loadAdapter();
  assert.equal((await adapter.listProjectFiles("project-1"))[0].id, first.id);
  const result = await Promise.allSettled(["second", "third"].map((sourceRef) => adapter.saveProjectFile({ ...input, sourceRef, expectedCurrentId: first.id })));
  assert.equal(result.filter((entry) => entry.status === "fulfilled").length, 1);
  assert.equal((await adapter.listProjectFiles("project-1")).filter((file) => file.isCurrent).length, 1);
  assert.equal((await adapter.saveProjectFile(input)).id, first.id);
  assert.equal((await adapter.listProjectFiles("project-1")).length, 2);
  const legacy = { slug: "project-2", projectAssets: { files: [{ id: "drawings-pdf", available: true, fileName: "old.pdf", url: "/project-files/project-2/old.pdf" }] } };
  const imported = await adapter.listProjectFilesWithLegacy(legacy);
  assert.equal(imported[0].size, null);
  await adapter.listProjectFilesWithLegacy(legacy);
  assert.equal((await adapter.listProjectFiles("project-2")).length, 1);
  await adapter.saveProjectFile({ ...input, leadId: "project-2", expectedCurrentId: imported[0].id });
  const history = await adapter.listProjectFiles("project-2");
  assert.equal(history.length, 2);
  assert.equal(history.find((file) => !file.isCurrent).pathname, "/project-files/project-2/old.pdf");
});
