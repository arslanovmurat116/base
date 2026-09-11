import { cookies, headers } from "next/headers";
import { getBoseSessionFromCookieStore } from "./security/session-server";

export async function getOwnerAccessState() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const session = await getBoseSessionFromCookieStore(cookieStore);
  const forwardedHost = headerStore.get("x-forwarded-host");
  const host = forwardedHost || headerStore.get("host") || "";

  return {
    isOwner: session?.isOwner === true,
    session,
    host
  };
}
