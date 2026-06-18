import { readPersistentJson, writePersistentJson } from "./persistent-store.js";

const TELEGRAM_CLIENT_LEADS_FILE = "telegram-client-leads.json";
const TELEGRAM_SUBSCRIBERS_FILE = "telegram-subscribers.json";
const TELEGRAM_DISPATCH_LOG_FILE = "telegram-dispatch-log.json";
const TELEGRAM_REGISTRATION_STATE_FILE = "telegram-registration-state.json";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function isSyntheticDemoChatId(chatId) {
  const normalized = String(chatId || "").trim();
  return (
    /^555/.test(normalized) ||
    /^7772/.test(normalized) ||
    /^9900/.test(normalized) ||
    /^99/.test(normalized)
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
    const shouldDrop = Array.from(removedChatIds).some((chatId) =>
      key.includes(String(chatId))
    );

    if (!shouldDrop) {
      next[key] = value;
    }
  }

  return next;
}

function pruneRegistrationState(state, removedChatIds, keepChatIds) {
  const next = {};

  for (const [key, value] of Object.entries(state || {})) {
    if (
      !removedChatIds.has(String(key)) &&
      !(isSyntheticDemoChatId(key) && !keepChatIds.has(String(key)))
    ) {
      next[key] = value;
    }
  }

  return next;
}

function isDemoLead(lead, keepChatIds, keepOrderNumbers) {
  const chatId = String(lead?.telegramChatId || "").trim();
  const orderNumber = String(lead?.orderNumber || "")
    .trim()
    .toUpperCase();

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
    /demo|test|preview|pilot client|client demo|murat demo|prod demo|prod robust/.test(
      text
    ) || isSyntheticDemoChatId(chatId)
  );
}

function isDemoSubscriber(subscriber, keepChatIds) {
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

function normalizeSet(values = []) {
  return new Set(
    values
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  );
}

export async function cleanupDemoState(options = {}) {
  const applyChanges = options.applyChanges === true;
  const keepChatIds = normalizeSet(options.keepChatIds || []);
  const keepOrderNumbers = new Set(
    Array.from(normalizeSet(options.keepOrderNumbers || [])).map((value) =>
      value.toUpperCase()
    )
  );

  const leads = await readPersistentJson(TELEGRAM_CLIENT_LEADS_FILE, []);
  const subscribers = await readPersistentJson(TELEGRAM_SUBSCRIBERS_FILE, []);
  const dispatchLog = await readPersistentJson(TELEGRAM_DISPATCH_LOG_FILE, {});
  const registrationState = await readPersistentJson(
    TELEGRAM_REGISTRATION_STATE_FILE,
    {}
  );

  const leadsToRemove = leads.filter((lead) =>
    isDemoLead(lead, keepChatIds, keepOrderNumbers)
  );
  const keptLeads = leads.filter(
    (lead) => !isDemoLead(lead, keepChatIds, keepOrderNumbers)
  );

  const subscribersToRemove = subscribers.filter((subscriber) =>
    isDemoSubscriber(subscriber, keepChatIds)
  );
  const keptSubscribers = subscribers.filter(
    (subscriber) => !isDemoSubscriber(subscriber, keepChatIds)
  );
  const removedChatIds = new Set(
    subscribersToRemove.map((subscriber) => String(subscriber.chatId))
  );

  const nextDispatchLog = pruneDispatchLog(dispatchLog, removedChatIds);
  const nextRegistrationState = pruneRegistrationState(
    registrationState,
    removedChatIds,
    keepChatIds
  );

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
    await writePersistentJson(TELEGRAM_CLIENT_LEADS_FILE, keptLeads);
    await writePersistentJson(TELEGRAM_SUBSCRIBERS_FILE, keptSubscribers);
    await writePersistentJson(TELEGRAM_DISPATCH_LOG_FILE, nextDispatchLog);
    await writePersistentJson(
      TELEGRAM_REGISTRATION_STATE_FILE,
      nextRegistrationState
    );
  }

  return summary;
}
