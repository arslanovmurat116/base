import { getAISalesAssistantOutput } from "./ai/service";
import { suggestTelegramReplyDraft } from "./telegram-templates";

export async function getAILeadReplyDraft(lead) {
  const suggestion = suggestTelegramReplyDraft(lead);

  if (!suggestion.template) {
    return {
      ok: false,
      message: "No fallback reply template available"
    };
  }

  const result = await getAISalesAssistantOutput(lead);

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    mode: result.mode,
    templateKey: suggestion.template.key,
    label:
      result.mode === "ai"
        ? `AI draft from ${suggestion.template.label}`
        : suggestion.template.label,
    messageText: result.data.replyDraft || suggestion.template.text,
    reason: result.reason
  };
}
