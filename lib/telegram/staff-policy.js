import { PROJECT_EDIT_ROLES } from '../security/access-policy';
export { PROJECT_ONLY_ROLES, PROJECT_EDIT_ROLES, staffProjectPermissions } from '../security/access-policy';

const ACTIONS = [
  ["newrequest", "Новая заявка", "New request", PROJECT_EDIT_ROLES],
  ["projects", "Проекты", "Projects"],
  ["today", "Сегодня", "Today", ["owner", "manager", "operator"]],
  ["clients", "Клиенты", "Clients", ["owner", "manager"]],
  ["deals", "Сделки", "Deals", ["owner", "manager"]],
  ["tasks", "Задачи", "Tasks", ["owner", "manager"]],
  ["newclient", "Создать клиента", "Create client", ["owner", "manager"]],
  ["newdeal", "Создать сделку", "Create deal", ["owner", "manager"]],
  ["newtask", "Создать задачу", "Create task", ["owner", "manager"]],
  ["followup", "Напоминание", "Follow-up", ["owner", "manager"]],
  ["appointments", "Встречи и замеры", "Appointments", ["owner", "manager", "operator"]],
  ["control", "Контроль", "Control", ["owner", "manager"]],
  ["alerts", "Просроченное", "Overdue", ["owner", "manager"]],
  ["askai", "Спросить AI", "Ask AI", ["owner", "manager"]],
  ["summary", "AI-сводка", "AI summary", ["owner", "manager"]],
  ["status", "Моя роль", "My role"],
  ["support", "Помощь", "Support"]
];

export function staffActions(role) {
  return role ? ACTIONS.filter(([, , , roles]) => !roles || roles.includes(role)) : [];
}

export function staffButtonCommand(text) {
  if (["Меню", "Инструменты"].includes(text)) return "/menu";
  if (text === "Отмена") return "/cancel";
  const action = ACTIONS.find(([, ru, en]) => text === ru || text === en);
  return action ? `/${action[0]}` : null;
}

export function canRunStaffCommand(role, command) {
  const aliases = { add: "menu", digest: "today", ai: "askai", workspace: "app" };
  const key = aliases[command] || command;
  return Boolean(role) && (["start", "help", "register", "menu", "app", "cancel"].includes(key) || staffActions(role).some(([id]) => id === key));
}

export function canRunStaffScenario(role, scenario) {
  const commands = {
    create_client: "newclient", create_deal: "newdeal", create_task: "newtask",
    followup_reminder: "followup", ask_ai: "askai", daily_summary: "summary", support_request: "support"
  };
  return Boolean(commands[scenario]) && canRunStaffCommand(role, commands[scenario]);
}
