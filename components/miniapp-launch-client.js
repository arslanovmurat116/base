"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const SESSION_STORAGE_KEY = "bose-miniapp-session-v2";
const SERVER_SESSION_STORAGE_KEY = "bose-miniapp-server-session-v2";
const SCREEN_STORAGE_PREFIX = "bose-screen-view:";

function getTelegramWebApp() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.Telegram?.WebApp || null;
}

function safeJsonParse(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function readStoredSession() {
  if (typeof window === "undefined") {
    return null;
  }

  return safeJsonParse(window.sessionStorage.getItem(SESSION_STORAGE_KEY));
}

export function readMiniAppSessionSnapshot() {
  return readStoredSession();
}

function writeStoredSession(value) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(value));
}

function hasCurrentServerSession(expiresAt) {
  if (typeof window === "undefined") return false;
  const storedExpiry = Number(window.sessionStorage.getItem(SERVER_SESSION_STORAGE_KEY) || 0);
  return storedExpiry > Date.now() && storedExpiry === new Date(expiresAt || 0).getTime();
}

function markCurrentServerSession(expiresAt) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SERVER_SESSION_STORAGE_KEY, String(new Date(expiresAt || 0).getTime()));
}

function shouldTrackScreen(pathname) {
  if (typeof window === "undefined") {
    return false;
  }

  const key = `${SCREEN_STORAGE_PREFIX}${pathname}`;

  if (window.sessionStorage.getItem(key)) {
    return false;
  }

  window.sessionStorage.setItem(key, "1");
  return true;
}

async function postJson(url, body, options = {}) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      keepalive: options.keepalive === true
    });

    return response.json().catch(() => null);
  } catch {
    return null;
  }
}

export async function trackMiniAppEvent(eventName, eventPayload = {}, extra = {}) {
  const session = readStoredSession();

  if (!session?.sessionId && !session?.profileId && !extra?.telegramUserId) {
    return null;
  }

  return postJson("/api/telegram/analytics/track", {
    companyId: session?.companyId || null,
    profileId: session?.profileId || null,
    sessionId: session?.sessionId || null,
    subjectType: session?.subjectType || null,
    subjectId: session?.subjectId || null,
    userId: session?.userId || null,
    clientId: session?.clientId || null,
    telegramUserId: session?.telegramUserId || extra?.telegramUserId || null,
    chatId: session?.chatId || extra?.chatId || null,
    username: session?.username || extra?.username || null,
    languageCode: session?.languageCode || extra?.languageCode || null,
    platform: session?.platform || extra?.platform || null,
    appVersion: session?.appVersion || extra?.appVersion || "rc1",
    eventName,
    eventPayload,
    timestamp: new Date().toISOString()
  });
}

export default function MiniAppLaunchClient() {
  const pathname = usePathname();
  const router = useRouter();
  const sessionRef = useRef(null);
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    sessionRef.current = readStoredSession();
  }, []);

  useEffect(() => {
    const webApp = getTelegramWebApp();

    if (webApp?.ready) {
      webApp.ready();
    }

    if (webApp?.expand) {
      try {
        webApp.expand();
      } catch {
        // Ignore expand failures in non-Telegram browsers.
      }
    }

    const sync = async () => {
      if (!webApp?.initData) {
        return;
      }

      const existing = readStoredSession();
      const expiresAt = existing?.expiresAt ? new Date(existing.expiresAt).getTime() : 0;
      const expired = !expiresAt || expiresAt <= Date.now();
      const unsafeUser = webApp.initDataUnsafe?.user || {};
      const checked = existing && !expired && hasCurrentServerSession(existing.expiresAt) ? await fetch('/api/telegram/miniapp/session',{cache:'no-store'}).then(r=>r.ok).catch(()=>false) : false;
      const authResult = checked
        ? { session: {...existing,id:existing.sessionId} }
        : await postJson("/api/telegram/miniapp/auth", {
            initData: webApp.initData,
            screenPath: pathname,
            platform: webApp.platform || "telegram-miniapp",
            device: navigator.userAgent,
            telegramVersion: webApp.version || null,
            appVersion: "rc1",
            chatId: webApp.initDataUnsafe?.chat?.id || null
          });

      if (authResult?.session) {
        const sessionPayload = {
          sessionId: authResult.session.id,
          sessionToken: authResult.session.sessionToken,
          profileId: authResult.profile?.id || existing?.profileId || null,
          subjectType: authResult.session.subjectType || null,
          subjectId: authResult.session.subjectId || null,
          userId: authResult.profile?.coreUserId || null,
          clientId: authResult.profile?.coreClientId || null,
          companyId: authResult.profile?.companyId || authResult.session.companyId || null,
          telegramUserId: authResult.profile?.telegramUserId || authResult.session.telegramUserId || (unsafeUser.id ? String(unsafeUser.id) : null),
          chatId: authResult.profile?.chatId || authResult.session.chatId || null,
          username: authResult.profile?.username || authResult.session.telegramUsername || (unsafeUser.username ? `@${unsafeUser.username}` : null),
          languageCode: authResult.profile?.languageCode || authResult.session.languageCode || unsafeUser.language_code || null,
          platform: authResult.session.platform || webApp.platform || "telegram-miniapp",
          appVersion: authResult.session.appVersion || "rc1",
          expiresAt: authResult.session.expiresAt || null
        };

        writeStoredSession(sessionPayload);
        markCurrentServerSession(sessionPayload.expiresAt);
        sessionRef.current = sessionPayload;
        if(!checked)router.refresh();
      }

      if (shouldTrackScreen(pathname)) {
        await trackMiniAppEvent("screen_view", {
          screen: pathname,
          title: document.title || "BOSE"
        });
      }
    };

    sync();
  }, [pathname]);

  useEffect(() => {
    const handlePageHide = () => {
      const session = sessionRef.current || readStoredSession();

      if (!session?.sessionId) {
        return;
      }

      const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));

      void postJson(
        "/api/telegram/miniapp/session/end",
        {
          sessionId: session.sessionId,
          sessionToken: session.sessionToken,
          profileId: session.profileId,
          companyId: session.companyId,
          subjectType: session.subjectType,
          subjectId: session.subjectId,
          telegramUserId: session.telegramUserId,
          chatId: session.chatId,
          username: session.username,
          languageCode: session.languageCode,
          platform: session.platform,
          appVersion: session.appVersion,
          screenPath: pathname,
          durationSeconds,
          endedAt: new Date().toISOString()
        },
        { keepalive: true }
      );
    };

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [pathname]);

  return null;
}
