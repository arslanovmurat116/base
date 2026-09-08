const BOSE_BOT_SCENARIOS = Object.freeze([
  {
    id: "furniture_project",
    command: "newrequest",
    trigger: ["новая заявка", "new request"],
    requiredInput: ["name", "address", "product", "description", "manager"],
    steps: ["name", "phone", "address", "product", "description", "manager", "note", "confirm"],
    handler: "createProjectBotFlow",
    aiUsage: "none",
    businessEvent: "LeadCreated",
    resultMessage: "Заявка создана. Прикрепите актуальные материалы.",
    priority: "high",
    integrateWith: ["leads", "clients", "deals", "project_file_versions", "business_events"],
    sourcePatterns: ["existing lead intake and project file slots"]
  },
  {
    id: "scenario_discovery",
    command: "demo",
    trigger: ["demo", "automation", "scenario draft", "what do you want to automate"],
    requiredInput: ["category", "content"],
    steps: ["category", "content"],
    handler: "createScenarioDraftRecord",
    aiUsage: "scenario-draft",
    businessEvent: "ScenarioDraftCreated",
    resultMessage: "Describe what to automate.",
    priority: "high",
    complexity: "low",
    risk: "low",
    integrateWith: ["scenario_drafts", "tasks", "business_events", "analytics"],
    sourcePatterns: [
      "Telegram discovery intake",
      "product feedback loops",
      "AI workflow discovery"
    ]
  },
  {
    id: "create_client",
    command: "newclient",
    trigger: ["create client", "new client", "add client"],
    requiredInput: ["displayName", "phone", "note"],
    steps: ["displayName", "phone", "note"],
    handler: "createCoreClientRecord",
    aiUsage: "optional-summary",
    businessEvent: "ClientCreated",
    resultMessage: "Client saved in BOSE.",
    priority: "high",
    complexity: "low",
    risk: "low",
    integrateWith: ["clients", "business_events", "analytics"],
    sourcePatterns: [
      "aiogram FSM",
      "python-telegram-bot ConversationHandler",
      "n8n Telegram lead capture"
    ]
  },
  {
    id: "create_deal",
    command: "newdeal",
    trigger: ["create deal", "new deal", "add deal"],
    requiredInput: ["clientReference", "title", "amountEstimate"],
    steps: ["clientReference", "title", "amountEstimate"],
    handler: "createCoreDealRecord",
    aiUsage: "none",
    businessEvent: "DealCreated",
    resultMessage: "Deal saved in BOSE.",
    priority: "high",
    complexity: "low",
    risk: "low",
    integrateWith: ["deals", "clients", "business_events", "analytics"],
    sourcePatterns: ["telegraf session + callback buttons", "CRM bot workflows"]
  },
  {
    id: "create_task",
    command: "newtask",
    trigger: ["create task", "new task", "add task"],
    requiredInput: ["title", "reference", "deadline", "description"],
    steps: ["title", "reference", "deadline", "description"],
    handler: "createTask",
    aiUsage: "none",
    businessEvent: "TaskCreated",
    resultMessage: "Task saved in BOSE.",
    priority: "high",
    complexity: "low",
    risk: "low",
    integrateWith: ["tasks", "deals", "lead_compat"],
    sourcePatterns: ["admin task bots", "inline action menus"]
  },
  {
    id: "followup_reminder",
    command: "followup",
    trigger: ["follow up", "remind", "callback", "next touch"],
    requiredInput: ["reference", "scheduledAt", "note"],
    steps: ["reference", "scheduledAt", "note"],
    handler: "createFollowup",
    aiUsage: "none",
    businessEvent: "FollowupScheduled",
    resultMessage: "Follow-up saved in BOSE.",
    priority: "high",
    complexity: "low",
    risk: "low",
    integrateWith: ["lead_followups", "notifications", "business_events"],
    sourcePatterns: ["Telegram reminder bots", "n8n Telegram reminders"]
  },
  {
    id: "ask_ai",
    command: "askai",
    trigger: ["ask ai", "assistant", "help me decide"],
    requiredInput: ["question"],
    steps: ["question"],
    handler: "getAIBotAssistantOutput",
    aiUsage: "required",
    businessEvent: "AIUsed",
    resultMessage: "AI guidance prepared.",
    priority: "high",
    complexity: "low",
    risk: "low",
    integrateWith: ["ai", "dashboard", "analytics"],
    sourcePatterns: ["FAQ/support bots", "OpenAI Telegram reply drafting"]
  },
  {
    id: "daily_summary",
    command: "summary",
    trigger: ["daily summary", "digest", "today summary"],
    requiredInput: [],
    steps: [],
    handler: "getAICRMSummary",
    aiUsage: "optional-summary",
    businessEvent: "DailySummaryRequested",
    resultMessage: "Daily summary delivered.",
    priority: "high",
    complexity: "low",
    risk: "low",
    integrateWith: ["dashboard", "tasks", "followups", "appointments"],
    sourcePatterns: ["manager digest bots", "n8n daily report workflows"]
  },
  {
    id: "customer_feedback",
    command: "feedback",
    trigger: ["feedback", "what is missing", "not convenient"],
    requiredInput: ["content"],
    steps: ["content"],
    handler: "createTelegramBotRequestRecord",
    aiUsage: "summary-and-next-step",
    businessEvent: "CustomerFeedbackSubmitted",
    resultMessage: "Feedback captured for the BOSE team.",
    priority: "high",
    complexity: "low",
    risk: "low",
    integrateWith: ["tasks", "business_events", "telegram_bot_requests", "ai"],
    sourcePatterns: ["support bots", "product discovery intake"]
  },
  {
    id: "feature_request",
    command: "feature",
    trigger: ["feature request", "need feature", "automation idea"],
    requiredInput: ["content"],
    steps: ["content"],
    handler: "createTelegramBotRequestRecord",
    aiUsage: "summary-and-next-step",
    businessEvent: "FeatureRequestSubmitted",
    resultMessage: "Feature request captured for the BOSE backlog.",
    priority: "high",
    complexity: "low",
    risk: "low",
    integrateWith: ["tasks", "business_events", "telegram_bot_requests", "ai"],
    sourcePatterns: ["user feedback capture", "n8n backlog intake"]
  },
  {
    id: "support_request",
    command: "support",
    trigger: ["support", "bug", "help", "issue"],
    requiredInput: ["content"],
    steps: ["content"],
    handler: "createTelegramBotRequestRecord",
    aiUsage: "summary-and-next-step",
    businessEvent: "SupportRequestSubmitted",
    resultMessage: "Support request captured for the BOSE team.",
    priority: "high",
    complexity: "low",
    risk: "low",
    integrateWith: ["tasks", "business_events", "telegram_bot_requests", "ai"],
    sourcePatterns: ["support desk bots", "admin alert routing"]
  },
  {
    id: "file_document_intake",
    command: "file",
    trigger: ["file", "document", "send pdf", "send photo"],
    requiredInput: ["attachment", "caption"],
    steps: ["attachment"],
    handler: "createTelegramBotRequestRecord",
    aiUsage: "optional-summary",
    businessEvent: "FileIntakeSubmitted",
    resultMessage: "File intake captured for review.",
    priority: "medium",
    complexity: "medium",
    risk: "low",
    integrateWith: ["tasks", "business_events", "telegram_bot_requests"],
    sourcePatterns: ["document intake bots", "Telegram file workflows"]
  }
]);

export function listBOSEBotScenarios() {
  return [...BOSE_BOT_SCENARIOS];
}

export function getBOSEBotScenario(input) {
  const normalized = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "");

  return (
    BOSE_BOT_SCENARIOS.find(
      (scenario) =>
        scenario.id === normalized ||
        scenario.command === normalized ||
        scenario.trigger.includes(normalized)
    ) || null
  );
}

export function listBOSEBotLaunchScenarios() {
  return BOSE_BOT_SCENARIOS.filter((scenario) => scenario.priority === "high");
}
