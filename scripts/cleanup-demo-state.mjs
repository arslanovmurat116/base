import { readPersistentJson, writePersistentJson } from "../lib/persistent-store.js";

const argv = process.argv.slice(2);
const applyChanges = argv.includes("--apply");

function readFlagValues(flag) {
  const values = [];

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === flag && argv[index + 1]) {
      values.push(argv[index + 1]);
      index += 1;
    }
  }

  return values;
}

const keepChatIds = new Set(readFlagValues("--keep-chat").map((value) => String(value).trim()));
const keepOrderNumbers = new Set(
  readFlagValues("--keep-order").map((value) => String(value).trim().toUpperCase())
);
const positionalKeepChats = argv.filter(
  (value) =>
    value &&
    !value.startsWith("--") &&
    /^\d{6,}$/.test(String(value).trim())
);

for (const chatId of positionalKeepChats) {
  keepChatIds.add(String(chatId).trim());
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function isSyntheticDemoChatId(chatId) {
  const normalized = String(chatId || "").trim();
  return /^555/.test(normalized) || /^7772/.test(normalized) || /^9900/.test(normalized) || /^99/.test(normalized);
}

function isDemoLead(lead) {
  const chatId = String(lead?.telegramChatId || "").trim();
  const orderNumber = String(lead?.orderNumber || "").trim().toUpperCase();

  if (keepChatIds.has(chatId) || keepOrderNumbers.has(orderNumber)) {
    return false;
  }

  const text = [
    lead?.slug,
    lead?.orderNumber,
    lead?.name,
    lead?.phone,
    lead?.telegramUsername,
    lead?.telegramChatId,
    lead?.summary,
    lead?.managerComment,
    lead?.clientComment
  ]
    .map(normalize)
    .join(" ");

  return (
    /demo|test|preview|pilot client|client demo|murat demo/.test(text) ||
    isSyntheticDemoChatId(chatId)
  );
}

function isDemoSubscriber(subscriber) {
  const chatId = String(subscriber?.chatId || "").trim();

  if (keepChatIds.has(chatId)) {
    return false;
  }

  const text = [
    subscriber?.chatId,
    subscriber?.role,
    subscriber?.name,
    subscriber?.username,
    subscriber?.source
  ]
    .map(normalize)
    .join(" ");

  return (
    isSyntheticDemoChatId(chatId) ||
    /test|preview|multi_role|aidana|timur|demo/.test(text)
  );
}

function summarizeLead(lead) {
  return {
    slug: lead?.slug,
    orderNumber: lead?.orderNumber,
    name: lead?.name,
    phone: lead?.phone,
    telegramChatId: lead?.telegramChatId,
    telegramUsername: lead?.telegramUsername
  };
}

function summarizeSubscriber(subscriber) {
  return {
    chatId: subscriber?.chatId,
    role: subscriber?.role,
    name: subscriber?.name,
    username: subscriber?.username,
    source: subscriber?.source
  };
}

function pruneDispatchLog(log, removedChatIds) {
  const next = {};

  for (const [key, value] of Object.entries(log || {})) {
    const shouldDrop = Array.from(removedChatIds).some((chatId) => key.includes(String(chatId)));

    if (!shouldDrop) {
      next[key] = value;
    }
  }

  return next;
}

function pruneRegistrationState(state, removedChatIds) {
  const next = {};

  for (const [key, value] of Object.entries(state || {})) {
    if (!removedChatIds.has(String(key)) && !(isSyntheticDemoChatId(key) && !keepChatIds.has(String(key)))) {
      next[key] = value;
    }
  }

  return next;
}

const leads = await readPersistentJson("telegram-client-leads.json", []);
const subscribers = await readPersistentJson("telegram-subscribers.json", []);
const dispatchLog = await readPersistentJson("telegram-dispatch-log.json", {});
const registrationState = await readPersistentJson("telegram-registration-state.json", {});

const leadsToRemove = leads.filter(isDemoLead);
const keptLeads = leads.filter((lead) => !isDemoLead(lead));

const subscribersToRemove = subscribers.filter(isDemoSubscriber);
const keptSubscribers = subscribers.filter((subscriber) => !isDemoSubscriber(subscriber));
const removedChatIds = new Set(subscribersToRemove.map((subscriber) => String(subscriber.chatId)));

const nextDispatchLog = pruneDispatchLog(dispatchLog, removedChatIds);
const nextRegistrationState = pruneRegistrationState(registrationState, removedChatIds);

const summary = {
  applyChanges,
  keepChatIds: Array.from(keepChatIds),
  keepOrderNumbers: Array.from(keepOrderNumbers),
  leadsBefore: leads.length,
  leadsAfter: keptLeads.length,
  leadsRemoved: leadsToRemove.map(summarizeLead),
  subscribersBefore: subscribers.length,
  subscribersAfter: keptSubscribers.length,
  subscribersRemoved: subscribersToRemove.map(summarizeSubscriber),
  dispatchKeysBefore: Object.keys(dispatchLog || {}).length,
  dispatchKeysAfter: Object.keys(nextDispatchLog || {}).length,
  registrationStatesBefore: Object.keys(registrationState || {}).length,
  registrationStatesAfter: Object.keys(nextRegistrationState || {}).length
};

if (applyChanges) {
  await writePersistentJson("telegram-client-leads.json", keptLeads);
  await writePersistentJson("telegram-subscribers.json", keptSubscribers);
  await writePersistentJson("telegram-dispatch-log.json", nextDispatchLog);
  await writePersistentJson("telegram-registration-state.json", nextRegistrationState);
}

console.log(JSON.stringify(summary, null, 2));
