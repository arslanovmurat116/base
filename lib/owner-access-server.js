import { cookies, headers } from "next/headers";
import { OWNER_ACCESS_COOKIE, isLocalHostname } from "./owner-access";

export async function getOwnerAccessState() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const ownerCookieEnabled = cookieStore.get(OWNER_ACCESS_COOKIE)?.value === "1";
  const forwardedHost = headerStore.get("x-forwarded-host");
  const host = forwardedHost || headerStore.get("host") || "";
  const localPreview = isLocalHostname(host);

  return {
    isOwner: ownerCookieEnabled || localPreview,
    ownerCookieEnabled,
    localPreview,
    host
  };
}
