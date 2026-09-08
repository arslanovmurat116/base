import { randomUUID } from "node:crypto";
import { getPool, isLiveDatabaseEnabled, query } from "./db";
import { readPersistentJson, writePersistentJson, buildPrivateBlobProxyUrl } from "./persistent-store";
import { appendBusinessEvent, buildBusinessEvent } from "./core/business-events";
import { nextProjectVersion, validateProjectAttachment } from "./project-workflow";

const STATE_FILE = "project-file-versions.json";
let localQueue = Promise.resolve();
const company = () => process.env.DISET_DEFAULT_COMPANY_ID || null;
function live() {
  if (isLiveDatabaseEnabled() && !company()) throw new Error("Project company is not configured");
  return isLiveDatabaseEnabled();
}

function normalize(row) {
  return {
    id: row.id, leadId: row.lead_id, groupKey: row.group_key, version: row.version,
    isCurrent: row.is_current, sourceRef: row.source_ref, fileName: row.file_name,
    contentType: row.content_type, size: row.byte_size == null ? null : Number(row.byte_size), kind: row.kind,
    pathname: row.storage_path, telegramFileId: row.telegram_file_id,
    telegramMediaType: row.telegram_media_type,
    uploadedBy: row.uploaded_by, uploadedByTelegramId: row.uploaded_by_telegram_id,
    createdAt: new Date(row.created_at).toISOString()
  };
}

export function projectFileUrl(file) {
  // Always resolve the latest version in the bot, rather than publishing an immutable
  // download link that may silently become obsolete in an old browser tab.
  return `https://t.me/bose_business_os_bot?start=project_${file.leadId}`;
}

export function projectFileStorageUrl(file) {
  return file.pathname.startsWith("project-files/")
    ? buildPrivateBlobProxyUrl(file.pathname) : file.pathname;
}

export async function listProjectFiles(leadId, { optional = false } = {}) {
  if (live()) {
    try {
      const result = await query("select * from project_file_versions where company_id = $1 and lead_id = $2 order by created_at desc, version desc", [company(), leadId]);
      return result.rows.map(normalize);
    } catch (error) {
      // Existing CRM reads remain usable before the additive migration is applied.
      if (optional && error.code === "42P01") return [];
      throw error;
    }
  }
  const rows = await readPersistentJson(STATE_FILE, []);
  return rows.filter((row) => row.leadId === leadId);
}

export async function getProjectFile(id) {
  if (live()) {
    const result = await query("select * from project_file_versions where company_id = $1 and id = $2", [company(), id]);
    return result.rows[0] ? normalize(result.rows[0]) : null;
  }
  return (await readPersistentJson(STATE_FILE, [])).find((row) => row.id === id) || null;
}

export async function saveProjectFile(input) {
  if (process.env.VERCEL && !isLiveDatabaseEnabled()) throw new Error("Project versions require Postgres in production");
  const legacy = input.sourceRef?.startsWith("legacy:") && input.size == null;
  const safe = validateProjectAttachment(legacy ? { ...input, size: 1 } : input);
  if (legacy) safe.size = null;
  if (!safe.sourceRef || !safe.groupKey || !safe.pathname) throw new Error("Missing project file reference");
  const file = { ...safe, id: safe.id || randomUUID(), createdAt: new Date().toISOString(), isCurrent: true };
  if (!live()) {
    const operation = localQueue.then(async () => {
      const rows = await readPersistentJson(STATE_FILE, []);
      const projectRows = rows.filter((row) => row.leadId === file.leadId);
      const decision = nextProjectVersion(projectRows, file);
      if (decision.duplicate) return decision.duplicate;
      for (const row of projectRows) if (row.groupKey === file.groupKey) row.isCurrent = false;
      const next = { ...file, version: decision.version };
      rows.unshift(next);
      await writePersistentJson(STATE_FILE, rows);
      return next;
    });
    localQueue = operation.catch(() => {});
    return operation;
  }
  const client = await getPool().connect();
  try {
    await client.query("begin");
    // Serialize all file families per project; source retries and current changes are atomic.
    const lead = await client.query("select id from leads where company_id = $1 and id = $2 for update", [company(), file.leadId]);
    if (!lead.rowCount) throw new Error("Project not found");
    const result = await client.query("select * from project_file_versions where company_id = $1 and lead_id = $2", [company(), file.leadId]);
    const decision = nextProjectVersion(result.rows.map(normalize), file);
    if (decision.duplicate) {
      await client.query("commit");
      return decision.duplicate;
    }
    await client.query("update project_file_versions set is_current = false where company_id = $1 and lead_id = $2 and group_key = $3 and is_current", [company(), file.leadId, file.groupKey]);
    const saved = await client.query(`insert into project_file_versions
      (id, company_id, lead_id, group_key, version, source_ref, file_name, content_type, byte_size, kind, storage_path, telegram_file_id, uploaded_by, uploaded_by_telegram_id, telegram_media_type)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning *`, [
      file.id, company(), file.leadId, file.groupKey, decision.version, file.sourceRef,
      file.fileName, file.contentType || "application/octet-stream", file.size, file.kind || "document",
      file.pathname, file.telegramFileId || null, file.uploadedBy || "Не указан", file.uploadedByTelegramId || null, file.telegramMediaType || null
    ]);
    await client.query("update leads set updated_at = now() where company_id = $1 and id = $2", [company(), file.leadId]);
    const payload = { fileId: file.id, groupKey: file.groupKey, version: decision.version, previousFileId: decision.current?.id || null, uploadedBy: file.uploadedBy };
    await client.query("insert into lead_events (company_id,lead_id,event_type,payload) values ($1,$2,'project_file_version_created',$3::jsonb)", [company(), file.leadId, JSON.stringify(payload)]);
    const event = await appendBusinessEvent(buildBusinessEvent({
      companyId: company(), aggregateType: "lead", aggregateId: file.leadId,
      eventName: "ProjectFileVersionCreated", actorType: "user", actorId: file.uploadedByTelegramId,
      channel: file.telegramFileId ? "telegram" : "web", payload
    }), (sql, params) => client.query(sql, params));
    if (!event.ok) throw new Error("Project file event could not be saved");
    await client.query("commit");
    return normalize(saved.rows[0]);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function listProjectFilesWithLegacy(lead, slotId = null) {
  const rows = await listProjectFiles(lead.slug);
  const legacy = [...(lead.projectAssets?.files || []), ...(lead.projectAssets?.previews || [])];
  for (const file of legacy) {
    if (slotId && file.id !== slotId) continue;
    if (!file.available || !file.url || file.url.startsWith("https://t.me/") || rows.some((row) => row.groupKey === file.id)) continue;
    const pathname = file.url.startsWith("/api/blob?") ? new URL(file.url, "https://local.invalid").searchParams.get("pathname") : file.url;
    if (!pathname?.startsWith("project-files/") && !pathname?.startsWith("/project-files/") && !pathname?.startsWith("/demo-projects/")) continue;
    rows.push(await saveProjectFile({
      leadId: lead.slug, groupKey: file.id, sourceRef: `legacy:${file.id}`, expectedCurrentId: null,
      fileName: file.fileName, size: null, contentType: "application/octet-stream",
      kind: file.preview ? "photo" : "document", pathname, uploadedBy: lead.projectAssets?.uploadedBy || "Legacy upload"
    }));
  }
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function overlayProjectFiles(lead) {
  const versions = await listProjectFiles(lead.slug, { optional: true });
  if (!versions.length) return lead;
  const assets = lead.projectAssets || {};
  const current = versions.filter((file) => file.isCurrent);
  const overlay = (items = []) => items.map((item) => {
    const file = current.find((entry) => entry.groupKey === item.id);
    return file ? { ...item, available: true, fileName: file.fileName, url: projectFileUrl(file), updatedAt: file.createdAt } : item;
  });
  const previews = (assets.previews || []).flatMap((item) => {
    const file = current.find((entry) => entry.groupKey === item.id);
    if (!file) return [item];
    return file.telegramFileId ? [] : [{ ...item, url: projectFileStorageUrl(file), updatedAt: file.createdAt }];
  });
  const estimateFile = current.find((file) => file.groupKey === "estimate-excel");
  const estimate = estimateFile ? { ...assets.estimate, fileUrl: projectFileUrl(estimateFile) } : assets.estimate;
  const projectAssets = { ...assets, estimate, files: overlay(assets.files), previews, versions: versions.map(({ telegramFileId, telegramMediaType, uploadedByTelegramId, pathname, sourceRef, ...file }) => ({ ...file, url: projectFileUrl(file) })) };
  return { ...lead, projectAssets, project: { ...lead.project, assets: projectAssets }, order: { ...lead.order, estimate: { ...lead.order?.estimate, export: estimate } } };
}
