import {
  buildScenarioDraftRequestedBy,
  buildWorkHubScenarioRequestFromDraft,
  normalizeScenarioDraftStatus,
  validateScenarioOrderSubmission
} from "./scenario-drafts.js";

function buildAnalyticsContext(session = {}) {
  return {
    companyId: session.companyId || null,
    profileId: session.profileId || null,
    sessionId: session.id || null,
    subjectType: session.subjectType || null,
    subjectId: session.subjectId || null,
    telegramUserId: session.telegramUserId || null,
    chatId: session.chatId || null,
    username: session.telegramUsername || null,
    languageCode: session.languageCode || null,
    platform: session.platform || "telegram-miniapp",
    appVersion: session.appVersion || "rc1",
    timestamp: new Date().toISOString()
  };
}

export function buildJsonResult(body, status = 200, headers = {}) {
  return {
    body,
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  };
}

function getSearchParam(source, name) {
  if (source?.nextUrl?.searchParams) {
    return source.nextUrl.searchParams.get(name);
  }

  if (source?.searchParams && typeof source.searchParams.get === "function") {
    return source.searchParams.get(name);
  }

  if (source?.[name] != null) {
    return source[name];
  }

  return null;
}

export async function handleScenarioDraftGetRequest(source, deps) {
  const ownerAccess = await deps.getOwnerAccessState();

  if (!ownerAccess.isOwner) {
    return buildJsonResult(
      {
        ok: false,
        message: "Scenario drafts are visible only in owner mode."
      },
      403
    );
  }

  try {
    const id = getSearchParam(source, "id");
    const format = String(getSearchParam(source, "format") || "").trim().toLowerCase();
    const status = getSearchParam(source, "status");
    const limitRaw = getSearchParam(source, "limit");
    const limit = Number(limitRaw);

    if (id && format === "workhub") {
      const draft = await deps.getScenarioDraftByIdData(id);

      if (!draft?.id) {
        return buildJsonResult(
          {
            ok: false,
            message: "Scenario draft was not found."
          },
          404
        );
      }

      const payload = buildWorkHubScenarioRequestFromDraft(draft);
      return buildJsonResult(payload, 200, {
        "Content-Disposition": `attachment; filename="bose-scenario-${draft.id}.json"`
      });
    }

    const data = await deps.getScenarioDraftsData({
      status: status || undefined,
      limit: Number.isFinite(limit) ? limit : undefined
    });

    return buildJsonResult({
      ok: true,
      data
    });
  } catch (error) {
    return buildJsonResult(
      {
        ok: false,
        message: error.message || "Scenario drafts API failed"
      },
      500
    );
  }
}

export async function handleScenarioDraftPostRequest(body, deps) {
  const validation = validateScenarioOrderSubmission(body);

  if (!validation.ok) {
    return buildJsonResult(
      {
        ok: false,
        message: validation.errors[0] || "Scenario request is invalid.",
        errors: validation.errors
      },
      400
    );
  }

  const session = await deps.getActiveMiniAppSessionSnapshot({
    sessionId: body?.sessionId,
    sessionToken: body?.sessionToken
  });

  if (!session?.id) {
    return buildJsonResult(
      {
        ok: false,
        message: "Active Telegram Mini App session is required."
      },
      401
    );
  }

  const analyticsContext = buildAnalyticsContext(session);
  const createPayload = {
    companyId: session.companyId,
    source: "telegram_scenario_order",
    telegramUserId: session.telegramUserId,
    telegramUsername: session.telegramUsername,
    chatId: session.chatId,
    sessionId: session.id,
    title: validation.value.title,
    description: validation.value.description,
    category: validation.value.category,
    targetPlatform: validation.value.targetPlatform,
    constraints: validation.value.constraints,
    status: "NEW",
    metadata: {
      requestedBy: buildScenarioDraftRequestedBy({
        telegramUserId: session.telegramUserId,
        telegramUsername: session.telegramUsername
      }),
      subjectType: session.subjectType || null,
      subjectId: session.subjectId || null,
      platform: session.platform || "telegram-miniapp",
      appVersion: session.appVersion || "rc1"
    },
    actorType: "user",
    actorId: session.subjectId || session.telegramUserId || null,
    channel: "telegram-miniapp"
  };

  try {
    const result = await deps.createScenarioDraftRecord(createPayload);

    if (!result?.ok || !result?.draft) {
      await deps.trackTelegramAnalyticsEvent({
        ...analyticsContext,
        eventName: "scenario_draft_failed",
        eventPayload: {
          source: createPayload.source,
          category: createPayload.category,
          targetPlatform: createPayload.targetPlatform,
          message: result?.message || "scenario_draft_failed"
        },
        eventKey: session.id
          ? `scenario_draft_failed:${session.id}:${createPayload.category}:${createPayload.targetPlatform}`
          : null
      }).catch(() => null);

      return buildJsonResult(
        {
          ok: false,
          message: result?.message || "Scenario draft could not be created."
        },
        400
      );
    }

    await deps.trackTelegramAnalyticsEvent({
      ...analyticsContext,
      eventName: "scenario_draft_created",
      eventPayload: {
        draftId: result.draft.id,
        source: result.draft.source,
        category: result.draft.category,
        targetPlatform: result.draft.targetPlatform,
        status: result.draft.status,
        created: Boolean(result.created)
      },
      eventKey: `scenario_draft_created:${result.draft.id}`
    }).catch(() => null);

    return buildJsonResult(
      {
        ok: true,
        created: Boolean(result.created),
        draft: result.draft,
        taskId: result.taskId || null,
        analysisMode: result.analysisMode || null,
        analysisReason: result.analysisReason || null,
        nextStep:
          "BOSE saved the request for owner review. The owner can review, export, and pass it into WorkHub Scenario Hub."
      },
      result.created === false ? 200 : 201
    );
  } catch (error) {
    await deps.trackTelegramAnalyticsEvent({
      ...analyticsContext,
      eventName: "scenario_draft_failed",
      eventPayload: {
        source: createPayload.source,
        category: createPayload.category,
        targetPlatform: createPayload.targetPlatform,
        message: error.message
      },
      eventKey: session.id
        ? `scenario_draft_failed:${session.id}:${createPayload.category}:${createPayload.targetPlatform}`
        : null
    }).catch(() => null);

    return buildJsonResult(
      {
        ok: false,
        message: "Scenario draft creation failed",
        error: error.message
      },
      400
    );
  }
}

export async function handleScenarioDraftPatchRequest(body, deps) {
  const ownerAccess = await deps.getOwnerAccessState();

  if (!ownerAccess.isOwner) {
    return buildJsonResult(
      {
        ok: false,
        message: "Scenario draft updates are visible only in owner mode."
      },
      403
    );
  }

  const draftId = String(body?.id || body?.draftId || "").trim();
  const status = normalizeScenarioDraftStatus(body?.status, null);

  if (!draftId) {
    return buildJsonResult(
      {
        ok: false,
        message: "Scenario draft id is required."
      },
      400
    );
  }

  if (!status) {
    return buildJsonResult(
      {
        ok: false,
        message: "Scenario draft status is required."
      },
      400
    );
  }

  try {
    const result = await deps.updateScenarioDraftStatusRecord({
      id: draftId,
      status
    });

    if (!result?.ok || !result?.draft) {
      return buildJsonResult(
        {
          ok: false,
          message: result?.message || "Scenario draft status could not be updated."
        },
        result?.message === "Scenario draft was not found." ? 404 : 400
      );
    }

    return buildJsonResult({
      ok: true,
      draft: result.draft
    });
  } catch (error) {
    return buildJsonResult(
      {
        ok: false,
        message: "Scenario draft status update failed",
        error: error.message
      },
      400
    );
  }
}
