import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createProjectBotFlow } from "../lib/telegram/project-flow.js";

test("installer appends files without replacing the active drawing and loses access immediately", async () => {
  const states = new Map();
  const lead = { id: "lead-1", slug: "lead-1", name: "Private client", product: "Kitchen", status: "NEW", project: {}, order: { production: {} } };
  const activeDrawing = { id: "drawing-1", leadId: lead.slug, groupKey: "drawings-pdf", isCurrent: true, fileName: "drawing.pdf", version: 1, kind: "document", createdAt: new Date().toISOString() };
  const files = [activeDrawing];
  const messages = [];
  let authorized = true;
  const deps = {
    readState: async (id) => states.get(String(id)),
    writeState: async (id, state) => states.set(String(id), state),
    clearState: async (id) => states.delete(String(id)),
    getLead: async (id) => id === lead.slug ? lead : null,
    listLeads: async () => [lead],
    listFiles: async () => files,
    getFile: async (id) => files.find((file) => file.id === id),
    saveFile: async (file) => { files.push({ ...file, id: randomUUID(), version: 1, isCurrent: true, createdAt: new Date().toISOString() }); },
    managers: async () => [],
    createLead: async () => ({ ok: false }),
    updateLead: async () => ({ ok: false }),
    ack: async () => {},
    deliverFile: async () => {},
    send: async (_chatId, text, markup) => { messages.push({ text, markup }); },
    log: () => {},
    access: async () => authorized ? { read: true, write: false, addPhoto: true, addFiles: true, role: "installer" } : { read: false, write: false, addPhoto: false, addFiles: false, role: null }
  };
  const handler = createProjectBotFlow(deps);
  const member = { chatId: "101", telegramUserId: "101", role: "installer", name: "Installer" };
  const message = (text, document) => handler({ message: { text, document, message_id: messages.length + 1, chat: { id: 101, type: "private" }, from: { id: 101 } } }, member);
  const callback = (data) => handler({ callback_query: { id: randomUUID(), data, from: { id: 101 }, message: { chat: { id: 101, type: "private" } } } }, member);
  const click = (label) => callback(messages.at(-1).markup.inline_keyboard.flat().find((button) => button.text === label).callback_data);

  await callback("fp|open|lead-1");
  assert.ok(messages.at(-1).markup.inline_keyboard.flat().some((button) => button.text === "Добавить файлы"));
  assert.doesNotMatch(messages.at(-1).text, /Клиент:|Менеджер:/);
  await click("Добавить файлы");
  await message("", { file_id: "doc", file_unique_id: "unique", file_name: "drawing.pdf", file_size: 100, mime_type: "application/pdf" });
  await click("Сохранить пакет (1)");
  assert.equal(files.length, 2);
  assert.equal(activeDrawing.isCurrent, true);
  assert.match(files[1].groupKey, /^site-file:/);

  authorized = false;
  await callback("fp|open|lead-1");
  assert.match(messages.at(-1).text, /доступны зарегистрированным сотрудникам/i);
});
