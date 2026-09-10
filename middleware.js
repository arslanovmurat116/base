import { NextResponse } from "next/server";
import { getBoseSessionFromRequest, isStaffRole } from "./lib/security/session-auth";

const OWNER_ONLY_API_PREFIXES = ["/api/admin/", "/api/telegram/dispatch"];
const PUBLIC_API_PATHS = new Set([
  "/api/system/health",
  "/api/telegram/webhook",
  "/api/telegram/miniapp/auth",
  "/api/preferences/language"
]);
const SESSION_API_PATHS = new Set([
  "/api/telegram/analytics/track",
  "/api/telegram/miniapp/session/end",
  "/api/scenario-drafts"
]);
const OWNER_PAGES = ["/owner", "/test", "/debug", "/scenario-drafts"];
const WORKSPACE_PAGES = ["/dashboard", "/workboard", "/leads", "/clients", "/deals", "/tasks", "/appointments", "/ai"];
const PROJECT_ONLY_ROLES = new Set(["designer", "production", "installer"]);

function matchesPrefix(pathname, prefixes) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isPublicApi(pathname) {
  return PUBLIC_API_PATHS.has(pathname) || pathname.startsWith("/api/telegram/cron/");
}

function apiError(message, status) {
  return NextResponse.json({ ok: false, message }, { status });
}

function isProjectSurface(pathname) {
  return pathname === "/leads" || pathname.startsWith("/leads/") || pathname === "/api/leads" || pathname.startsWith("/api/leads/") || pathname === "/api/blob";
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const isOwnerPage = matchesPrefix(pathname, OWNER_PAGES);
  const isWorkspacePage = matchesPrefix(pathname, WORKSPACE_PAGES);

  if (isApi && isPublicApi(pathname)) return NextResponse.next();
  if (!isApi && !isOwnerPage && !isWorkspacePage) return NextResponse.next();

  const session = await getBoseSessionFromRequest(request);
  if (!session) {
    if (isApi) return apiError("Verified Telegram Mini App session is required.", 401);
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("auth", "required");
    return NextResponse.redirect(url);
  }

  if (isOwnerPage) {
    if (session.isOwner) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("auth", "owner-required");
    return NextResponse.redirect(url);
  }

  if (OWNER_ONLY_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return session.isOwner ? NextResponse.next() : apiError("Owner access is required.", 403);
  }

  if (isApi && !SESSION_API_PATHS.has(pathname) && !isStaffRole(session.role)) {
    return apiError("Staff access is required.", 403);
  }

  if (!isApi && !isOwnerPage && !isStaffRole(session.role)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("auth", "staff-required");
    return NextResponse.redirect(url);
  }

  if (PROJECT_ONLY_ROLES.has(session.role) && !isProjectSurface(pathname)) {
    if (isApi) return apiError("This role has access only to project materials.", 403);
    const url = request.nextUrl.clone();
    url.pathname = "/leads";
    return NextResponse.redirect(url);
  }

  const isLeadMutation = /^\/api\/leads\/[^/]+$/.test(pathname) && request.method === "PATCH";
  if (isLeadMutation && !["owner", "manager", "designer"].includes(session.role)) {
    return apiError("Project edit access is required.", 403);
  }

  if (
    (pathname.endsWith("/outcome") || pathname.startsWith("/api/core/")) &&
    !["owner", "manager"].includes(session.role)
  ) {
    return apiError("Manager access is required.", 403);
  }

  if (
    ["/api/tasks/complete", "/api/followups/create", "/api/followups/complete"].includes(pathname) &&
    !["owner", "manager", "operator"].includes(session.role)
  ) {
    return apiError("Operations access is required.", 403);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*", "/workboard/:path*", "/leads/:path*", "/clients/:path*", "/deals/:path*", "/tasks/:path*", "/appointments/:path*", "/ai/:path*", "/owner/:path*", "/test/:path*", "/debug/:path*", "/scenario-drafts/:path*"]
};
