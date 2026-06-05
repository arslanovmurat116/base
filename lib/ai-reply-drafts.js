import { suggestTelegramReplyDraft } from "./telegram-templates";

function compactList(items, emptyText = "none") {
  if (!items?.length) {
    return emptyText;
  }

  return items.join("; ");
}

function buildLeadContext(lead) {
  const recentMessages = (lead.messages || [])
    .slice(-6)
    .map((item) => `${item.sender}: ${item.text}`);
  const appointments = (lead.appointments || []).map(
    (item) =>
      `${item.status} | ${item.type} | ${item.scheduledAt} | ${item.location || "no location"}`
  );
  const followups = (lead.followups || []).map(
    (item) => `${item.status} | ${item.type} | ${item.scheduledAt} | ${item.note}`
  );

  return [
    `Lead: ${lead.name}`,
    `Channel: ${lead.channel}`,
    `Source: ${lead.source}`,
    `Status: ${lead.status}`,
    `Manager: ${lead.manager}`,
    `Summary: ${lead.summary}`,
    `Next action: ${lead.nextAction}`,
    `Recent messages: ${compactList(recentMessages)}`,
    `Appointments: ${compactList(appointments)}`,
    `Follow-ups: ${compactList(followups)}`
  ].join("\n");
}

function buildAIPrompt(lead, fallback) {
  return [
    "You write concise Telegram replies for a clinic/studio sales or front-desk team.",
    "Goals:",
    "- Keep the tone warm, clear, calm, and human.",
    "- Do not invent prices, guarantees, or medical/service outcomes.",
    "- Keep the draft short and directly usable in Telegram.",
    "- Prefer a single clear next step.",
    "- If there was a no-show, gently help reschedule without sounding cold.",
    "",
    "Lead context:",
    buildLeadContext(lead),
    "",
    "Fallback template label:",
    fallback.template?.label || "none",
    "",
    "Fallback template text:",
    fallback.template?.text || "",
    "",
    "Return only the final Telegram message text."
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

export async function getAILeadReplyDraft(lead) {
  const fallback = suggestTelegramReplyDraft(lead);
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";

  if (!fallback.template) {
    return {
      ok: false,
      message: "No fallback reply template available"
    };
  }

  if (!apiKey) {
    return {
      ok: true,
      mode: "smart-fallback",
      templateKey: fallback.template.key,
      label: fallback.template.label,
      messageText: fallback.template.text,
      reason: `${fallback.reason} AI key is not configured yet, so the system used the best safe template fallback.`
    };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input: buildAIPrompt(lead, fallback)
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const apiMessage =
        typeof data?.error?.message === "string" && data.error.message.trim()
          ? data.error.message.trim()
          : null;
      const quotaHint =
        data?.error?.code === "insufficient_quota"
          ? "OpenAI quota or billing is not active yet."
          : null;

      return {
        ok: true,
        mode: "smart-fallback",
        templateKey: fallback.template.key,
        label: fallback.template.label,
        messageText: fallback.template.text,
        reason: [
          fallback.reason,
          quotaHint || "AI draft was unavailable, so the system returned to the safe template fallback.",
          apiMessage
        ]
          .filter(Boolean)
          .join(" ")
      };
    }

    const messageText = extractResponseText(data);

    if (!messageText) {
      return {
        ok: true,
        mode: "smart-fallback",
        templateKey: fallback.template.key,
        label: fallback.template.label,
        messageText: fallback.template.text,
        reason: `${fallback.reason} AI returned an empty result, so the system used the safe template fallback.`
      };
    }

    return {
      ok: true,
      mode: "ai",
      templateKey: fallback.template.key,
      label: `AI draft from ${fallback.template.label}`,
      messageText,
      reason: `AI adapted the reply using live lead context and the base template "${fallback.template.label}".`
    };
  } catch {
    return {
      ok: true,
      mode: "smart-fallback",
      templateKey: fallback.template.key,
      label: fallback.template.label,
      messageText: fallback.template.text,
      reason: `${fallback.reason} AI draft failed, so the system used the safe template fallback.`
    };
  }
}
