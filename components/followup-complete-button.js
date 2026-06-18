"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { pick } from "../lib/i18n";

export default function FollowupCompleteButton({ lead, type, scheduledAt, lang = "en" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [note, setNote] = useState("");

  async function handleComplete() {
    setPending(true);
    setFeedback("");

    try {
      const response = await fetch("/api/followups/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ lead, type, scheduledAt, note })
      });

      const result = await response.json();
      setFeedback(result.message || pick(lang, "Follow-up closed", "Возврат закрыт"));

      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      setFeedback(`${pick(lang, "Error", "Ошибка")}: ${error.message}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="task-action-row">
      <input
        className="inline-note-input"
        disabled={pending}
        onChange={(event) => setNote(event.target.value)}
        placeholder={pick(lang, "How the follow-up ended", "Как завершили возврат")}
        type="text"
        value={note}
      />
      <button className="ghost-button" disabled={pending} onClick={handleComplete} type="button">
        {pending ? pick(lang, "Closing...", "Закрываем...") : pick(lang, "Close follow-up", "Закрыть возврат")}
      </button>
      {feedback ? <small className="inline-feedback">{feedback}</small> : null}
    </div>
  );
}
