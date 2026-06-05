"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TaskCompleteButton({ title }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [note, setNote] = useState("");

  async function handleComplete() {
    setPending(true);
    setFeedback("");

    try {
      const response = await fetch("/api/tasks/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ title, note })
      });

      const result = await response.json();
      setFeedback(result.message || "Задача закрыта");

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
        placeholder="Короткий итог по задаче"
        type="text"
        value={note}
      />
      <button className="ghost-button" disabled={pending} onClick={handleComplete} type="button">
        {pending ? "Закрываем..." : "Закрыть задачу"}
      </button>
      {feedback ? <small className="inline-feedback">{feedback}</small> : null}
    </div>
  );
}
