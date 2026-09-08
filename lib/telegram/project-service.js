import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { getPrivateBlob } from "../persistent-store";
import { sendTelegramProjectFile } from "../telegram";
import { getPool, isLiveDatabaseEnabled, query } from "../db";
import { MAX_PROJECT_FILE_BYTES } from "../project-workflow";

const queues = new Map();
let lockPool;
let lockPoolSource;
const parseIds = (...values) => new Set(values.join(",").split(/[,;\s]+/).filter(Boolean));
export function projectAccess(userId) {
  const editors = parseIds(process.env.TELEGRAM_PROJECT_EDITOR_IDS || "", process.env.BOSE_OWNER_TELEGRAM_IDS || "", process.env.TELEGRAM_DIRECTOR_CHAT_IDS || "", process.env.TELEGRAM_MANAGER_CHAT_IDS || "");
  const viewers = parseIds(process.env.TELEGRAM_PROJECT_VIEWER_IDS || "", process.env.TELEGRAM_MEASURER_CHAT_IDS || "");
  // Registration is self-service in the legacy bot, so it is not a staff permission grant.
  const write = editors.has(String(userId));
  return { read: write || viewers.has(String(userId)), write };
}

export async function withProjectChatLock(chatId, operation) {
  if (!isLiveDatabaseEnabled()) {
    if (process.env.VERCEL) throw new Error("Project workflow requires Postgres in production");
    const task = (queues.get(chatId) || Promise.resolve()).then(operation);
    const settled = task.catch(() => {});
    queues.set(chatId, settled);
    try { return await task; } finally { if (queues.get(chatId) === settled) queues.delete(chatId); }
  }
  const pool = getPool();
  // Conversation locks must not occupy every connection used by the existing
  // facade queries. Keep the small lock pool separate to avoid pool starvation.
  if (lockPoolSource !== pool) {
    const previous = lockPool;
    lockPool = new Pool({ ...pool.options, max: 2, allowExitOnIdle: true, application_name: "bose-project-locks" });
    lockPool.on("error", () => {});
    lockPoolSource = pool;
    if (previous) previous.end().catch(() => {});
  }
  const client = await lockPool.connect();
  try {
    await client.query("begin");
    await client.query("set local lock_timeout = '5s'");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [`project-chat:${process.env.DISET_DEFAULT_COMPANY_ID}:${chatId}`]);
    return await operation();
  } finally {
    try { await client.query("rollback"); } finally { client.release(); }
  }
}

export async function listProjectManagers(subscribers = []) {
  if (isLiveDatabaseEnabled()) {
    const result = await query("select full_name from users where company_id = $1 and is_active and role in ('owner','manager') order by full_name", [process.env.DISET_DEFAULT_COMPANY_ID]);
    return [...new Set(result.rows.map((row) => row.full_name))];
  }
  return [...new Set(subscribers.filter((item) => ["director", "manager"].includes(item.role)).map((item) => item.name).filter(Boolean))];
}

export async function deliverProjectFile(chatId, file, caption, markup) {
  if (file.telegramFileId) return sendTelegramProjectFile(chatId, file, caption, markup);
  let bytes;
  if (file.pathname.startsWith("project-files/")) {
    const result = await getPrivateBlob(file.pathname);
    if (!result?.stream) throw new Error("Project file not found");
    const reader = result.stream.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_PROJECT_FILE_BYTES) throw new Error("Project file exceeds 20 MB");
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    bytes = Buffer.concat(chunks);
  } else {
    const root = path.resolve(process.cwd(), "public");
    const target = path.resolve(root, file.pathname.replace(/^\//, ""));
    const relative = path.relative(root, target);
    if (relative.startsWith("..") || path.isAbsolute(relative) || !/^(project-files|demo-projects)[\\/]/.test(relative)) throw new Error("Invalid project file path");
    const stat = await fs.stat(target);
    if (stat.size > MAX_PROJECT_FILE_BYTES) throw new Error("Project file exceeds 20 MB");
    bytes = await fs.readFile(target);
  }
  return sendTelegramProjectFile(chatId, file, caption, markup, bytes);
}
