import { suggestTelegramReplyDraft } from "../telegram-templates";
import {
  getScenarioDraftCategoryLabel,
  normalizeScenarioDraftCategory
} from "../scenario-drafts";

function compactList(items, emptyText = "none") {
  if (!items?.length) {
    return emptyText;
  }

  return items.join("; ");
}

function normalizeLeadSummary(lead) {
  const recentMessages = (lead.messages || [])
    .slice(-6)
    .map((item) => `${item.sender || item.direction || "unknown"}: ${item.text || item.messageText || ""}`);
  const appointments = (lead.appointments || []).map(
    (item) =>
      `${item.status || "unknown"} | ${item.type || "meeting"} | ${item.scheduledAt || "unscheduled"}`
  );
  const followups = (lead.followups || []).map(
    (item) => `${item.status || "unknown"} | ${item.type || "followup"} | ${item.scheduledAt || "unscheduled"}`
  );

  return [
    `Lead: ${lead.name || "Unknown lead"}`,
    `Phone: ${lead.phone || "n/a"}`,
    `Channel: ${lead.channel || "n/a"}`,
    `Source: ${lead.source || "n/a"}`,
    `Status: ${lead.status || "NEW"}`,
    `Manager: ${lead.manager || "Unassigned"}`,
    `Summary: ${lead.summary || "No summary"}`,
    `Next action: ${lead.nextAction || "No next action"}`,
    `Recent messages: ${compactList(recentMessages)}`,
    `Appointments: ${compactList(appointments)}`,
    `Follow-ups: ${compactList(followups)}`
  ].join("\n");
}

function extractResponseText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const chunks = [];

  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && content?.text) {
        chunks.push(content.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

function safeJsonParse(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function getAIServiceConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim() || "";
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";

  return {
    configured: Boolean(apiKey),
    apiKey,
    model
  };
}

async function runJSONAssistant({ system, prompt, fallback }) {
  const config = getAIServiceConfig();

  if (!config.configured) {
    return {
      ok: true,
      mode: "fallback",
      data: fallback,
      reason: "OpenAI API key is not configured, so BOSE used the safe local fallback."
    };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        input: `${system}\n\nReturn valid JSON only.\n\n${prompt}`
      })
    });
    const data = await response.json();

    if (!response.ok) {
      return {
        ok: true,
        mode: "fallback",
        data: fallback,
        reason: data?.error?.message || "AI request failed, so BOSE used the safe local fallback."
      };
    }

    const text = extractResponseText(data);
    const parsed = safeJsonParse(text);

    if (!parsed || typeof parsed !== "object") {
      return {
        ok: true,
        mode: "fallback",
        data: fallback,
        reason: "AI returned a non-JSON response, so BOSE used the safe local fallback."
      };
    }

    return {
      ok: true,
      mode: "ai",
      data: parsed,
      reason: "AI generated the result from live BOSE context."
    };
  } catch (error) {
    return {
      ok: true,
      mode: "fallback",
      data: fallback,
      reason: `AI request failed, so BOSE used the safe local fallback. ${error.message}`
    };
  }
}

function buildQualificationSuggestion(lead) {
  const hasPhone = Boolean(lead.phone);
  const hasBudget = Boolean(lead.budget && !String(lead.budget).toLowerCase().includes("уточ"));
  const hasAppointment = Boolean((lead.appointments || []).length);
  const status = String(lead.status || "NEW").toUpperCase();

  if (status === "NEW" && hasPhone) {
    return {
      suggestedStatus: "CONTACTED",
      reason: "Contact data is available, so the first live touch is the next safe step."
    };
  }

  if (["CONTACTED", "NEW"].includes(status) && hasBudget) {
    return {
      suggestedStatus: "QUALIFIED",
      reason: "The client already shared enough commercial context to move into qualification."
    };
  }

  if (["QUALIFIED", "CONTACTED"].includes(status) && hasAppointment) {
    return {
      suggestedStatus: "MEETING",
      reason: "An appointment already exists, so the lead is ready for the meeting stage."
    };
  }

  return {
    suggestedStatus: status,
    reason: "Current BOSE lead context does not justify an automatic stage move."
  };
}

function buildSalesAssistantFallback(lead) {
  const suggestion = suggestTelegramReplyDraft(lead);
  const qualification = buildQualificationSuggestion(lead);

  return {
    summary: [
      `${lead.name || "The client"} is currently in ${String(lead.status || "NEW").toLowerCase()} stage.`,
      lead.summary || "The latest summary is still short.",
      lead.nextAction ? `The next tracked action is: ${lead.nextAction}.` : "The next tracked action is not set yet."
    ].join(" "),
    nextAction:
      lead.nextAction ||
      (String(lead.status || "").toUpperCase() === "NEW"
        ? "Call the client and confirm the request details."
        : "Move the deal one clear step forward and log the outcome."),
    replyDraft: suggestion.template?.text || "Thanks for the message. I will help you with the next step shortly.",
    qualificationSuggestion: qualification
  };
}

function buildCRMAssistantFallback(input = {}) {
  const stats = input.statistics || {};
  const notifications = input.notifications || [];
  const tasks = input.tasks || [];
  const followups = input.followups || [];
  const appointments = input.appointments || [];
  const openDeals = stats.dealsOpen ?? 0;
  const overdueTasks = stats.tasksOverdue ?? 0;
  const pendingFollowups = stats.followupsPending ?? 0;
  const scheduledAppointments = stats.appointmentsScheduled ?? 0;

  return {
    dailyDigest: `BOSE is tracking ${openDeals} open deals, ${overdueTasks} overdue tasks, ${pendingFollowups} pending follow-ups, and ${scheduledAppointments} scheduled appointments.`,
    overdueTasks: overdueTasks
      ? `${overdueTasks} tasks need attention before the next team cycle.`
      : "No overdue tasks need escalation right now.",
    workloadSummary: `Tasks: ${tasks.length}. Follow-ups: ${followups.length}. Appointments: ${appointments.length}. Notifications: ${notifications.length}.`,
    managerRecommendations: [
      overdueTasks ? "Clear the overdue task queue first." : "Keep the current task pace stable.",
      pendingFollowups ? "Push follow-ups that are blocking movement to the next deal stage." : "Follow-up pressure is currently under control.",
      scheduledAppointments ? "Confirm tomorrow's appointments and missing addresses." : "No scheduled appointment pressure right now."
    ]
  };
}

function buildBotAssistantFallback(input = {}) {
  const question = String(input.question || "Help me move work forward.").trim();
  const dashboard = input.dashboard || {};
  const digest =
    input.crmSummary?.dailyDigest ||
    `BOSE is tracking ${dashboard?.stats?.clientsTotal || 0} clients, ${
      dashboard?.stats?.dealsOpen || 0
    } open deals, and ${dashboard?.stats?.tasksOpen || 0} open tasks.`;
  const lowered = question.toLowerCase();
  let suggestedScenario = "daily_summary";

  if (lowered.includes("client")) {
    suggestedScenario = "create_client";
  } else if (lowered.includes("deal")) {
    suggestedScenario = "create_deal";
  } else if (lowered.includes("task")) {
    suggestedScenario = "create_task";
  } else if (lowered.includes("follow")) {
    suggestedScenario = "followup_reminder";
  } else if (lowered.includes("feature") || lowered.includes("automation")) {
    suggestedScenario = "feature_request";
  } else if (lowered.includes("support") || lowered.includes("bug")) {
    suggestedScenario = "support_request";
  }

  return {
    summary: digest,
    nextAction:
      input.crmSummary?.managerRecommendations?.[0] ||
      "Open the next BOSE action and move one client or deal forward.",
    suggestedScenario,
    draftReply: `BOSE suggests: ${question}`
  };
}

function buildScenarioDraftFallback(input = {}) {
  const categoryId = normalizeScenarioDraftCategory(input.category);
  const categoryLabel = getScenarioDraftCategoryLabel(categoryId, "en");
  const rawText = String(input.rawText || "").trim();
  const lowered = rawText.toLowerCase();

  const triggerByCategory = {
    clients_leads: "A new inbound client message or request arrives.",
    sales: "A new deal appears or a deal stops moving forward.",
    tasks_staff: "A new task appears or a team handoff is needed.",
    reminders: "A deadline is close or a client stays silent for too long.",
    documents_files: "A user sends a document, photo, or file request.",
    reports: "The day, week, or shift ends and a summary is needed.",
    customer_support: "A client asks a support question or reports a problem.",
    other: "A repeated business action needs a clear BOSE trigger."
  };

  const entitiesByCategory = {
    clients_leads: ["Client", "Lead", "Conversation", "Message"],
    sales: ["Client", "Deal", "Task", "Follow-up"],
    tasks_staff: ["Task", "User", "Notification"],
    reminders: ["Follow-up", "Task", "Notification"],
    documents_files: ["Document", "File", "Client", "Task"],
    reports: ["Event", "Task", "Deal", "Summary"],
    customer_support: ["Client", "Conversation", "Message", "Task"],
    other: ["Client", "Task", "Event"]
  };

  const botActionsByCategory = {
    clients_leads: ["Capture the request", "Create or update the client card", "Notify the owner"],
    sales: ["Create the deal", "Assign the next step", "Send a reminder if the deal stalls"],
    tasks_staff: ["Create a task", "Assign the owner", "Track completion status"],
    reminders: ["Schedule the reminder", "Send the prompt", "Log the outcome"],
    documents_files: ["Capture the file", "Link it to the record", "Create a review task"],
    reports: ["Collect key events", "Build a digest", "Send it to the owner"],
    customer_support: ["Capture the issue", "Create the support task", "Prepare the reply draft"],
    other: ["Capture the process", "Turn it into a BOSE draft", "Review it manually"]
  };

  const miniAppBlocksByCategory = {
    clients_leads: ["Client inbox", "Lead card", "Conversation timeline"],
    sales: ["Deal board", "Deal detail", "Next action panel"],
    tasks_staff: ["Task inbox", "Owner queue", "Completion panel"],
    reminders: ["Follow-up queue", "Reminder history", "Schedule block"],
    documents_files: ["File intake", "Document list", "Review drawer"],
    reports: ["Summary dashboard", "Digest block", "Metrics cards"],
    customer_support: ["Support inbox", "Client profile", "Reply box"],
    other: ["Scenario draft view", "Task list", "Owner review panel"]
  };

  const steps = [];

  steps.push(`Detect the trigger for ${categoryLabel.toLowerCase()}.`);
  steps.push("Capture the request details and store them in BOSE.");

  if (lowered.includes("2 day") || lowered.includes("2 days") || lowered.includes("2 дня")) {
    steps.push("Wait two days without a reply, then create a reminder.");
  } else if (lowered.includes("day") || lowered.includes("дн")) {
    steps.push("Wait for the defined time window, then send a follow-up.");
  } else {
    steps.push("Move the work to the next tracked action.");
  }

  steps.push("Show the owner a clear next step inside the Mini App.");

  return {
    summary: rawText
      ? `The user wants BOSE to automate a ${categoryLabel.toLowerCase()} process: ${rawText}`
      : `The user wants BOSE to automate a ${categoryLabel.toLowerCase()} process.`,
    suggestedTrigger: triggerByCategory[categoryId] || triggerByCategory.other,
    suggestedSteps: steps,
    suggestedEntities: entitiesByCategory[categoryId] || entitiesByCategory.other,
    suggestedBotActions: botActionsByCategory[categoryId] || botActionsByCategory.other,
    suggestedMiniAppBlocks: miniAppBlocksByCategory[categoryId] || miniAppBlocksByCategory.other
  };
}

export function getAIServiceStatus() {
  const config = getAIServiceConfig();

  return {
    configured: config.configured,
    model: config.model
  };
}

export async function getAISalesAssistantOutput(lead) {
  const fallback = buildSalesAssistantFallback(lead);

  return runJSONAssistant({
    system: [
      "You are BOSE AI Sales Assistant.",
      "You help a Telegram-first business OS move leads forward safely.",
      "Keep outputs concise, practical, and directly useful for a manager."
    ].join(" "),
    prompt: [
      "Build a JSON object with keys: summary, nextAction, replyDraft, qualificationSuggestion.",
      "qualificationSuggestion must be an object with keys suggestedStatus and reason.",
      "",
      "Lead context:",
      normalizeLeadSummary(lead),
      "",
      "Fallback baseline:",
      JSON.stringify(fallback)
    ].join("\n"),
    fallback
  });
}

export async function getAICRMAssistantOutput(input) {
  const fallback = buildCRMAssistantFallback(input);

  return runJSONAssistant({
    system: [
      "You are BOSE AI CRM Assistant.",
      "You summarize operational workload for a Telegram-first business operating system.",
      "Focus on daily digest, overdue work, workload summary, and manager recommendations."
    ].join(" "),
    prompt: [
      "Build a JSON object with keys: dailyDigest, overdueTasks, workloadSummary, managerRecommendations.",
      "managerRecommendations must be an array of short strings.",
      "",
      "Operational snapshot:",
      JSON.stringify(input)
    ].join("\n"),
    fallback
  });
}

export async function getAIBotAssistantOutput(input = {}) {
  const fallback = buildBotAssistantFallback(input);

  return runJSONAssistant({
    system: [
      "You are BOSE AI Bot Assistant.",
      "You help Telegram users choose the right BOSE scenario and next action.",
      "Stay concise and practical."
    ].join(" "),
    prompt: [
      "Build a JSON object with keys: summary, nextAction, suggestedScenario, draftReply.",
      "suggestedScenario must be one of: create_client, create_deal, create_task, followup_reminder, daily_summary, customer_feedback, feature_request, support_request, file_document_intake, ask_ai.",
      "",
      "Question:",
      String(input.question || ""),
      "",
      "Dashboard snapshot:",
      JSON.stringify(input.dashboard || {}),
      "",
      "CRM summary:",
      JSON.stringify(input.crmSummary || {}),
      "",
      "Fallback baseline:",
      JSON.stringify(fallback)
    ].join("\n"),
    fallback
  });
}

export async function getAIScenarioDraftOutput(input = {}) {
  const fallback = buildScenarioDraftFallback(input);

  return runJSONAssistant({
    system: [
      "You are BOSE AI Scenario Discovery Assistant.",
      "You turn a plain-language business process into a safe BOSE scenario draft.",
      "Do not promise execution. Only produce a concise draft.",
      "Keep outputs grounded in Telegram-first business workflows."
    ].join(" "),
    prompt: [
      "Build a JSON object with keys: summary, suggestedTrigger, suggestedSteps, suggestedEntities, suggestedBotActions, suggestedMiniAppBlocks.",
      "suggestedSteps must be an array of short strings.",
      "suggestedEntities must be an array of entity names.",
      "suggestedBotActions must be an array of short bot actions.",
      "suggestedMiniAppBlocks must be an array of Mini App blocks.",
      "",
      `Category: ${normalizeScenarioDraftCategory(input.category)}`,
      `Raw text: ${String(input.rawText || "").trim()}`,
      "",
      "Fallback baseline:",
      JSON.stringify(fallback)
    ].join("\n"),
    fallback
  });
}
