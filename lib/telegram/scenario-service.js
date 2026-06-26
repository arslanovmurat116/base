import { getAIBotAssistantOutput } from "../ai/service";
import {
  createCoreClientRecord,
  createCoreDealRecord,
  createTelegramBotRequestRecord,
  findCoreClientByReferenceInDb,
  findCoreDealByReferenceInDb
} from "../core/write-models";
import {
  createFollowup,
  createTask,
  getAICRMSummary,
  getBOSEDashboardData
} from "../server-data";
import { trackTelegramAnalyticsEvent } from "./analytics";

function normalizeText(value) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

function normalizeScenarioActor(actor = {}) {
  return {
    telegramUserId: actor.telegramUserId ? String(actor.telegramUserId) : null,
    chatId: actor.chatId ? String(actor.chatId) : null,
    username: actor.username || null,
    firstName: actor.firstName || null,
    languageCode: actor.languageCode || null,
    role: actor.role || null,
    platform: actor.platform || "telegram-bot",
    appVersion: actor.appVersion || "rc1"
  };
}

async function trackScenarioAnalytics(actor, eventName, eventPayload = {}) {
  const normalizedActor = normalizeScenarioActor(actor);

  if (!normalizedActor.telegramUserId) {
    return null;
  }

  return trackTelegramAnalyticsEvent({
    telegramUserId: normalizedActor.telegramUserId,
    chatId: normalizedActor.chatId,
    username: normalizedActor.username,
    firstName: normalizedActor.firstName,
    languageCode: normalizedActor.languageCode,
    platform: normalizedActor.platform,
    appVersion: normalizedActor.appVersion,
    eventName,
    eventPayload
  }).catch(() => null);
}

async function buildBotRequestSummary(content, actor, summaryType) {
  const dashboard = await getBOSEDashboardData().catch(() => null);
  const crmSummaryResult = await getAICRMSummary().catch(() => null);
  const crmSummary = crmSummaryResult?.data || null;
  const aiResult = await getAIBotAssistantOutput({
    question: content,
    dashboard,
    crmSummary,
    summaryType
  });

  if (aiResult?.ok) {
    await trackScenarioAnalytics(actor, "ai_used", {
      source: "telegram_bot_scenario",
      summaryType,
      mode: aiResult.mode || "fallback"
    });
  }

  return aiResult?.data || {
    summary: content,
    nextAction: "Review the request in BOSE.",
    suggestedScenario: "customer_feedback",
    draftReply: "BOSE captured the request."
  };
}

async function resolveLeadReferenceFromScenario(reference) {
  const normalizedReference = normalizeText(reference);

  if (!normalizedReference) {
    return null;
  }

  const deal = await findCoreDealByReferenceInDb(undefined, normalizedReference).catch(() => null);

  if (deal?.leadId) {
    return deal.leadId;
  }

  const client = await findCoreClientByReferenceInDb(undefined, normalizedReference).catch(
    () => null
  );

  if (client?.sourceLeadId) {
    return client.sourceLeadId;
  }

  return normalizedReference;
}

async function createFeedbackTask(title, content, actor, extraLines = []) {
  const description = [content, ...extraLines].filter(Boolean).join("\n\n");
  const taskResult = await createTask({
    title,
    owner: actor.firstName || null,
    description,
    priority: "medium"
  });

  return taskResult;
}

export async function runBOSEBotScenarioAction({ scenarioId, data = {}, actor = {} }) {
  const normalizedActor = normalizeScenarioActor(actor);

  switch (scenarioId) {
    case "create_client": {
      const result = await createCoreClientRecord({
        displayName: data.displayName,
        phone: data.phone,
        notes: data.note,
        ownerName: normalizedActor.firstName || null,
        actorType: normalizedActor.role ? "user" : "system",
        actorId: normalizedActor.telegramUserId,
        channel: "telegram",
        scenarioId
      });

      if (result?.ok && result.client?.id) {
        await trackScenarioAnalytics(normalizedActor, "client_created", {
          scenarioId,
          clientId: result.client.id
        });
      }

      return result;
    }

    case "create_deal": {
      const result = await createCoreDealRecord({
        clientReference: data.clientReference,
        title: data.title,
        amountEstimate: data.amountEstimate,
        ownerName: normalizedActor.firstName || null,
        note: data.note || null,
        actorType: normalizedActor.role ? "user" : "system",
        actorId: normalizedActor.telegramUserId,
        channel: "telegram",
        scenarioId
      });

      if (result?.ok && result.deal?.id) {
        await trackScenarioAnalytics(normalizedActor, "deal_created", {
          scenarioId,
          dealId: result.deal.id,
          clientId: result.client?.id || null
        });
      }

      return result;
    }

    case "create_task": {
      const leadReference = await resolveLeadReferenceFromScenario(data.reference);
      return createTask({
        title: data.title,
        lead: leadReference,
        owner: normalizedActor.firstName || null,
        deadline: data.deadline || null,
        priority: "medium",
        description: data.description || null
      });
    }

    case "followup_reminder": {
      const leadReference = await resolveLeadReferenceFromScenario(data.reference);
      return createFollowup({
        lead: leadReference,
        owner: normalizedActor.firstName || null,
        type: "custom",
        scheduledAt: data.scheduledAt,
        note: data.note
      });
    }

    case "ask_ai": {
      const dashboard = await getBOSEDashboardData().catch(() => null);
      const crmSummaryResult = await getAICRMSummary().catch(() => null);
      const crmSummary = crmSummaryResult?.data || null;
      const result = await getAIBotAssistantOutput({
        question: data.question,
        dashboard,
        crmSummary
      });

      if (result?.ok) {
        await trackScenarioAnalytics(normalizedActor, "ai_used", {
          scenarioId,
          mode: result.mode || "fallback"
        });
      }

      return result;
    }

    case "customer_feedback":
    case "feature_request":
    case "support_request":
    case "file_document_intake": {
      const requestTypeMap = {
        customer_feedback: "CUSTOMER_FEEDBACK",
        feature_request: "FEATURE_REQUEST",
        support_request: "SUPPORT_REQUEST",
        file_document_intake: "FILE_INTAKE"
      };
      const requestType = requestTypeMap[scenarioId] || "BOT_REQUEST";
      const rawContent =
        data.content ||
        data.caption ||
        data.fileName ||
        "Bot scenario submission without text content.";
      const aiSummary = await buildBotRequestSummary(rawContent, normalizedActor, requestType);
      const taskTitleMap = {
        CUSTOMER_FEEDBACK: "Review customer feedback",
        FEATURE_REQUEST: "Review feature request",
        SUPPORT_REQUEST: "Handle support request",
        FILE_INTAKE: "Review uploaded file"
      };
      const taskResult = await createFeedbackTask(
        taskTitleMap[requestType],
        rawContent,
        normalizedActor,
        [
          aiSummary.summary ? `AI summary: ${aiSummary.summary}` : null,
          aiSummary.nextAction ? `AI next step: ${aiSummary.nextAction}` : null,
          data.fileName ? `File: ${data.fileName}` : null,
          data.mimeType ? `Type: ${data.mimeType}` : null,
          data.fileId ? `Telegram file id: ${data.fileId}` : null
        ]
      );

      const result = await createTelegramBotRequestRecord({
        scenarioId,
        requestType,
        sourceChannel: "telegram",
        telegramUserId: normalizedActor.telegramUserId,
        chatId: normalizedActor.chatId,
        username: normalizedActor.username,
        subjectType: normalizedActor.role ? "user" : "telegram_user",
        subjectId: normalizedActor.telegramUserId || normalizedActor.chatId,
        title:
          data.title ||
          (requestType === "FILE_INTAKE"
            ? data.fileName || "File intake"
            : rawContent.slice(0, 96)),
        content: rawContent,
        aiSummary: aiSummary.summary,
        aiNextAction: aiSummary.nextAction,
        taskId: taskResult?.taskId || null,
        payload: {
          question: data.question || null,
          fileId: data.fileId || null,
          fileName: data.fileName || null,
          mimeType: data.mimeType || null,
          mode: aiSummary.mode || null
        },
        actorType: normalizedActor.role ? "user" : "system",
        actorId: normalizedActor.telegramUserId,
        channel: "telegram"
      });

      return {
        ...result,
        taskResult,
        aiSummary
      };
    }

    case "daily_summary":
    default:
      return getAICRMSummary();
  }
}
