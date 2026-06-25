export const BOSE_AI_AGENTS = Object.freeze({
  salesAssistant: {
    id: "ai_sales_assistant",
    status: "active-mvp",
    currentEntrypoints: ["getAILeadReplyDraft", "getLeadAISalesAssistantData"],
    dataSources: ["leads", "messages", "followups", "appointments", "events"],
    responsibilities: [
      "draft reply",
      "suggest next action",
      "summarize lead",
      "flag churn or silence risk",
      "suggest qualification"
    ]
  },
  crmAssistant: {
    id: "ai_crm_assistant",
    status: "active-mvp",
    currentEntrypoints: ["getAICRMSummary"],
    dataSources: ["tasks", "followups", "appointments", "notifications", "workboard read models"],
    responsibilities: [
      "build daily digest",
      "highlight urgent queues",
      "suggest reminders",
      "propose reassignments",
      "summarize workload"
    ]
  },
  projectManager: {
    id: "ai_project_manager",
    status: "planned-foundation",
    currentEntrypoints: [],
    dataSources: ["deals", "tasks", "appointments", "module milestones", "files", "events"],
    responsibilities: [
      "spot blockers",
      "propose next milestone",
      "summarize project state"
    ]
  },
  customerSuccess: {
    id: "ai_customer_success",
    status: "planned-foundation",
    currentEntrypoints: [],
    dataSources: ["launches", "success loops", "usage signals", "messages", "events"],
    responsibilities: [
      "detect renewal risk",
      "draft outreach",
      "suggest retention moves"
    ]
  }
});

export function listBOSEAIAgents() {
  return Object.values(BOSE_AI_AGENTS);
}

export function getBOSEAIAgent(agentId) {
  return BOSE_AI_AGENTS[agentId] || null;
}
