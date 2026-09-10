import assert from "node:assert/strict";
import test from "node:test";
import {
  createBoseSessionToken,
  isStaffRole,
  verifyBoseSessionToken
} from "../lib/security/session-auth.js";
import {
  mapTelegramRoleToCoreRole,
  normalizeTelegramSurfaceRole
} from "../lib/core/roles.js";

test("signed Mini App session cannot be forged by changing its payload", async () => {
  const previousSecret = process.env.BOSE_AUTH_SECRET;
  process.env.BOSE_AUTH_SECRET = "security-test-secret";

  try {
    const token = await createBoseSessionToken({
      sessionId: "session-1",
      subjectId: "telegram-1",
      role: "designer",
      expiresAt: Date.now() + 60_000
    });
    const claims = await verifyBoseSessionToken(token);

    assert.equal(claims.role, "designer");
    assert.equal(claims.isOwner, false);
    assert.equal(await verifyBoseSessionToken(`${token}tampered`), null);
  } finally {
    if (previousSecret === undefined) delete process.env.BOSE_AUTH_SECRET;
    else process.env.BOSE_AUTH_SECRET = previousSecret;
  }
});

test("furniture execution roles map to minimum BOSE roles", () => {
  assert.equal(normalizeTelegramSurfaceRole("дизайнер"), "designer");
  assert.equal(mapTelegramRoleToCoreRole("production"), "production");
  assert.equal(mapTelegramRoleToCoreRole("монтажник"), "installer");
  assert.equal(isStaffRole("designer"), true);
  assert.equal(isStaffRole("production"), true);
  assert.equal(isStaffRole("client"), false);
});
