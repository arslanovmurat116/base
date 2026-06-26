import TrackedLink from "./tracked-link";

const TELEGRAM_BOT_BASE_HREF = "https://t.me/bose_business_os_bot";

const SHORTCUTS = {
  dashboard: {
    href: "/dashboard",
    label: { en: "Open Workspace", ru: "Открыть BOSE" },
    note: { en: "Go to the main BOSE dashboard.", ru: "Перейти в главную панель BOSE." }
  },
  demo: {
    href: "/demo",
    label: { en: "Demo Mode", ru: "Демо-режим" },
    note: { en: "Open safe sample data and click through the flow.", ru: "Открыть тестовые данные и быстро пройти сценарий." }
  },
  clients: {
    href: "/clients",
    label: { en: "Clients", ru: "Клиенты" },
    note: { en: "See who is already in the workspace.", ru: "Посмотреть, кто уже есть в рабочем пространстве." }
  },
  deals: {
    href: "/deals",
    label: { en: "Deals", ru: "Сделки" },
    note: { en: "Open the current pipeline and active records.", ru: "Открыть текущую воронку и активные записи." }
  },
  tasks: {
    href: "/tasks",
    label: { en: "Tasks", ru: "Задачи" },
    note: { en: "Review the queue that needs action now.", ru: "Посмотреть очередь задач, где нужны действия." }
  },
  ai: {
    href: "/ai",
    label: { en: "AI Assistant", ru: "AI-ассистент" },
    note: { en: "Open summaries, next actions, and reply drafts.", ru: "Открыть сводки, следующие шаги и черновики ответов." }
  },
  pricing: {
    href: "/pricing",
    label: { en: "Pricing", ru: "Тарифы" },
    note: { en: "See Free, Pro, and Business plans.", ru: "Посмотреть планы Free, Pro и Business." }
  },
  bot: {
    href: `${TELEGRAM_BOT_BASE_HREF}?start=demo`,
    label: { en: "Open Bot", ru: "Открыть бота" },
    note: { en: "Jump into Telegram and reopen BOSE from the bot.", ru: "Перейти в Telegram и снова открыть BOSE из бота." },
    external: true
  },
  request: {
    href: `${TELEGRAM_BOT_BASE_HREF}?start=request`,
    label: { en: "Start Request", ru: "Запустить заявку" },
    note: { en: "Run the client intake flow from Telegram.", ru: "Запустить клиентский сценарий приёма заявки из Telegram." },
    external: true
  }
};

export default function WorkspaceShortcuts({
  lang = "en",
  items = ["dashboard", "demo", "clients", "deals", "tasks", "ai"],
  eventSource = "workspace-shortcuts"
}) {
  const language = lang === "ru" ? "ru" : "en";

  return (
    <div className="lead-quick-nav">
      {items
        .map((key) => ({ key, ...SHORTCUTS[key] }))
        .filter((item) => item?.href)
        .map((item) => (
          <TrackedLink
            key={item.key}
            className="lead-quick-link"
            eventLabel={item.label[language]}
            eventSource={eventSource}
            href={item.href}
            rel={item.external ? "noreferrer" : undefined}
            target={item.external ? "_blank" : undefined}
          >
            <span className="eyebrow">BOSE</span>
            <strong>{item.label[language]}</strong>
            <span>{item.note[language]}</span>
          </TrackedLink>
        ))}
    </div>
  );
}
