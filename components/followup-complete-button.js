"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FollowupCompleteButton({ lead, type, scheduledAt }) {
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
      setFeedback(result.message || "Возврат закрыт");

      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      setFeedback(`Ошибка: ${error.message}`);
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
        placeholder="Как завершили возврат"
        type="text"
        value={note}
      />
      <button className="ghost-button" disabled={pending} onClick={handleComplete} type="button">
        {pending ? "Закрываем..." : "Закрыть возврат"}
      </button>
      {feedback ? <small className="inline-feedback">{feedback}</small> : null}
    </div>
  );
}
