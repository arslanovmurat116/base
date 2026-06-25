import TrackedLink from "../../components/tracked-link";
import EmptyStateActions from "../../components/empty-state-actions";
import EventBeacon from "../../components/event-beacon";
import { getAICRMSummary, getLeadAISalesAssistantData, getLeadsData } from "../../lib/server-data";
import { getLanguage } from "../../lib/i18n-server";

export const metadata = {
  title: "AI | BOSE"
};

export default async function AIPage() {
  const lang = await getLanguage();
  const [crmSummary, leads] = await Promise.all([getAICRMSummary(), getLeadsData()]);
  const sampleLead = leads[0] || null;
  const salesSummary = sampleLead ? await getLeadAISalesAssistantData(sampleLead.slug) : null;
  const isRu = lang === "ru";

  return (
    <main className="page-shell">
      <EventBeacon eventName="ai_used" eventPayload={{ surface: "ai-page", assistants: ["sales", "crm"] }} />
      <section className="page-heading">
        <p className="eyebrow">BOSE AI</p>
        <h1>AI Assistant</h1>
        <p>
          {isRu
            ? "Единый AI MVP-слой: summary, next action, draft reply и CRM digest."
            : "One shared AI MVP layer for summaries, next actions, draft replies, and CRM digests."}
        </p>
      </section>

      <section className="workboard-grid">
        <article className="panel workboard-panel">
          <div className="section-title">
            <p className="eyebrow">AI Sales Assistant</p>
            <h2>{isRu ? "По одной живой сделке" : "For one live deal"}</h2>
          </div>
          {salesSummary?.data ? (
            <div className="workboard-stack">
              <article className="work-item">
                <div>
                  <strong>Summary</strong>
                  <p>{salesSummary.data.summary}</p>
                </div>
              </article>
              <article className="work-item">
                <div>
                  <strong>Next Action</strong>
                  <p>{salesSummary.data.nextAction}</p>
                </div>
              </article>
              <article className="work-item">
                <div>
                  <strong>Draft Reply</strong>
                  <p>{salesSummary.data.replyDraft}</p>
                </div>
              </article>
              <TrackedLink
                className="ghost-link"
                eventLabel="AI Sales Assistant"
                eventSource="ai-page"
                href={sampleLead?.slug ? `/leads/${sampleLead.slug}` : "/deals"}
              >
                {isRu ? "Открыть исходную сделку" : "Open source deal"}
              </TrackedLink>
            </div>
          ) : (
            <>
              <p>{isRu ? "Пока нет живой сделки для AI-примера." : "No live deal is available for an AI example yet."}</p>
              <EmptyStateActions lang={lang} />
            </>
          )}
        </article>

        <article className="panel workboard-panel">
          <div className="section-title">
            <p className="eyebrow">AI CRM Assistant</p>
            <h2>{isRu ? "Операционная сводка" : "Operating digest"}</h2>
          </div>
          <div className="workboard-stack">
            <article className="work-item">
              <div>
                <strong>{crmSummary.data?.dailyDigest || "No digest yet"}</strong>
                <p>{crmSummary.reason || ""}</p>
              </div>
            </article>
            <article className="work-item">
              <div>
                <strong>{crmSummary.data?.overdueTasks || "No overdue tasks"}</strong>
                <p>{crmSummary.data?.workloadSummary || ""}</p>
              </div>
            </article>
            {(crmSummary.data?.managerRecommendations || []).map((item) => (
              <article className="work-item" key={item}>
                <div>
                  <strong>{item}</strong>
                  <p>BOSE AI</p>
                </div>
              </article>
            ))}
            <TrackedLink className="ghost-link" eventLabel="Ask AI" eventSource="ai-page" href="/api/ai/crm/summary">
              {isRu ? "Открыть raw AI summary" : "Open raw AI summary"}
            </TrackedLink>
          </div>
        </article>
      </section>
    </main>
  );
}
