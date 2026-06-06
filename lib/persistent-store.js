import fs from "node:fs";
import path from "node:path";
import { del, get, put } from "@vercel/blob";

const STATE_PREFIX = "_state";
const LOCAL_STATE_DIR = path.join(process.cwd(), ".mock-state");

function cloneJsonValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function resolveLocalStatePath(fileName) {
  return path.join(LOCAL_STATE_DIR, fileName);
}

export function isBlobStoreEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function buildStatePathname(fileName) {
  return `${STATE_PREFIX}/${fileName}`;
}

export function buildProjectFilePathname(slug, fileName) {
  return `project-files/${slug}/${fileName}`;
}

export function buildPrivateBlobProxyUrl(pathname) {
  return `/api/blob?pathname=${encodeURIComponent(pathname)}`;
}

export async function readPersistentJson(fileName, fallbackValue) {
  if (isBlobStoreEnabled()) {
    try {
      const result = await get(buildStatePathname(fileName), {
        access: "private"
      });

      if (!result || result.statusCode !== 200 || !result.stream) {
        return cloneJsonValue(fallbackValue);
      }

      const text = await new Response(result.stream).text();
      return text ? JSON.parse(text) : cloneJsonValue(fallbackValue);
    } catch (error) {
      console.warn(`Persistent blob read failed for ${fileName}:`, error.message);
      return cloneJsonValue(fallbackValue);
    }
  }

  try {
    const filePath = resolveLocalStatePath(fileName);

    if (!fs.existsSync(filePath)) {
      return cloneJsonValue(fallbackValue);
    }

    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (error) {
    console.warn(`Persistent file read failed for ${fileName}:`, error.message);
    return cloneJsonValue(fallbackValue);
  }
}

export async function writePersistentJson(fileName, value) {
  const payload = JSON.stringify(value, null, 2);

  if (isBlobStoreEnabled()) {
    await put(buildStatePathname(fileName), payload, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json"
    });
    return;
  }

  fs.mkdirSync(LOCAL_STATE_DIR, { recursive: true });
  fs.writeFileSync(resolveLocalStatePath(fileName), payload, "utf-8");
}

export async function putPrivateBlob(pathname, body, contentType) {
  return put(pathname, body, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType
  });
}

export async function deletePrivateBlob(pathnameOrPathnames) {
  if (!pathnameOrPathnames) {
    return;
  }

  await del(pathnameOrPathnames);
}

export async function getPrivateBlob(pathname) {
  return get(pathname, {
    access: "private"
  });
}
