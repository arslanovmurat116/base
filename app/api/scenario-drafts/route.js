import { NextResponse } from "next/server.js";
import {
  createScenarioDraftRecord,
  updateScenarioDraftStatusRecord
} from "../../../lib/core/write-models.js";
import {
  getScenarioDraftByIdData,
  getScenarioDraftsData
} from "../../../lib/server-data.js";
import { trackTelegramAnalyticsEvent } from "../../../lib/telegram/analytics.js";
import { getActiveMiniAppSessionSnapshot } from "../../../lib/telegram/miniapp-session.js";
import { getOwnerAccessState } from "../../../lib/owner-access-server.js";
import {
  buildJsonResult,
  handleScenarioDraftGetRequest,
  handleScenarioDraftPatchRequest,
  handleScenarioDraftPostRequest
} from "../../../lib/scenario-drafts-api.js";

function toNextResponse(result) {
  return new NextResponse(JSON.stringify(result.body, null, 2), {
    status: result.status,
    headers: result.headers
  });
}

function createRouteDeps(overrides = {}) {
  return {
    getOwnerAccessState,
    getScenarioDraftsData,
    getScenarioDraftByIdData,
    createScenarioDraftRecord,
    updateScenarioDraftStatusRecord,
    getActiveMiniAppSessionSnapshot,
    trackTelegramAnalyticsEvent,
    ...overrides
  };
}

export async function GET(request) {
  return toNextResponse(await handleScenarioDraftGetRequest(request, createRouteDeps()));
}

export async function POST(request) {
  const body = await request.json();
  return toNextResponse(await handleScenarioDraftPostRequest(body, createRouteDeps()));
}

export async function PATCH(request) {
  const body = await request.json();
  return toNextResponse(await handleScenarioDraftPatchRequest(body, createRouteDeps()));
}
