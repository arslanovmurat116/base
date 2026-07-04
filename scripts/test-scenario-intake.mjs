import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const originalAppBaseUrl = process.env.APP_BASE_URL;
const originalBotToken = process.env.TELEGRAM_BOT_TOKEN;

process.env.APP_BASE_URL = process.env.APP_BASE_URL || "https://example.com";
process.env.TELEGRAM_BOT_TOKEN = "";

const { buildScenarioOrderTelegramReply } = await import("../lib/telegram/scenario-order-bridge.js");
const {
  handleScenarioDraftGetRequest,
  handleScenarioDraftPatchRequest,
  handleScenarioDraftPostRequest
} = await import("../lib/scenario-drafts-api.js");

const workHubRoot = "C:/Users/Мурат Арсланов/Desktop/workhub";
const workHubSchemaPath = path.join(
  workHubRoot,
  "scenario-hub",
  "schemas",
  "scenario-request.schema.json"
);
const workHubSchema = JSON.parse(fs.readFileSync(workHubSchemaPath, "utf8"));
const results = [];

function record(name, passed, details, extra = {}) {
  results.push({
    name,
    passed: Boolean(passed),
    details,
    ...extra
  });
}

function assertSchemaLike(value, schema) {
  const required = Array.isArray(schema.required) ? schema.required : [];
  const properties = Object.keys(schema.properties || {});
  const keys = Object.keys(value || {}).sort();
  const expectedKeys = [...properties].sort();

  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
    throw new Error(`Exported JSON keys do not match WorkHub schema. Got ${keys.join(", ")}`);
  }

  for (const key of required) {
    if (value?.[key] == null || value[key] === "") {
      throw new Error(`Exported JSON is missing required field: ${key}`);
    }
  }
}

const draftRecord = {
  id: "draft-001",
  source: "telegram_scenario_order",
  telegramUserId: "100500",
  telegramUsername: "@owner_signal",
  chatId: "777",
  sessionId: "00000000-0000-0000-0000-000000000001",
  title: "Обработка заявки клиента",
  description: "Получить заявку клиента из Telegram, сохранить контакт, создать сделку и уведомить менеджера.",
  category: "crm",
  targetPlatform: "telegram",
  constraints: ["Без секретов", "Без реальных платежей"],
  rawText: "Получить заявку клиента из Telegram, сохранить контакт, создать сделку и уведомить менеджера.",
  aiSummary: "Capture the Telegram lead, store the contact, create a deal, and notify the manager.",
  suggestedTrigger: "A client sends a Telegram message.",
  suggestedSteps: ["Capture the message", "Create or update the client", "Create the deal", "Notify the manager"],
  suggestedEntities: ["Lead", "Client", "Deal", "Manager"],
  suggestedBotActions: ["Open Mini App form", "Notify manager"],
  suggestedMiniAppBlocks: ["Scenario request form", "Owner review list"],
  status: "NEW",
  metadata: {
    requestedBy: "@owner_signal (telegram:100500)"
  },
  createdAt: "2026-07-05T12:00:00.000Z",
  updatedAt: "2026-07-05T12:00:00.000Z"
};

const sessionSnapshot = {
  id: "00000000-0000-0000-0000-000000000001",
  companyId: "00000000-0000-0000-0000-0000000000aa",
  profileId: "00000000-0000-0000-0000-0000000000bb",
  subjectType: "telegram_user",
  subjectId: "100500",
  telegramUserId: "100500",
  telegramUsername: "@owner_signal",
  chatId: "777",
  platform: "telegram-miniapp",
  appVersion: "rc1",
  languageCode: "ru"
};

try {
  const launchContract = buildScenarioOrderTelegramReply();
  const telegramControlSource = fs.readFileSync(
    path.join("C:/Users/Мурат Арсланов/Desktop/mebel rdn", "lib", "telegram-control.js"),
    "utf8"
  );
  record(
    "telegram_scenario_command",
    /command === "scenario"/.test(telegramControlSource) &&
      /\/scenario-request$/i.test(launchContract.path) &&
      /WorkHub export/i.test(launchContract.text),
    "Expected /scenario wiring and a Mini App contract for /scenario-request.",
    {
      targetPath: launchContract.path
    }
  );
} catch (error) {
  record("telegram_scenario_command", false, error.message);
}

let capturedCreatePayload = null;
let exportPayload = null;

try {
  const postResult = await handleScenarioDraftPostRequest(
    {
      title: draftRecord.title,
      description: draftRecord.description,
      category: "CRM",
      targetPlatform: "Telegram",
      constraints: draftRecord.constraints,
      sessionId: sessionSnapshot.id,
      sessionToken: "verified-session-token",
      telegramUserId: "999999"
    },
    {
      getActiveMiniAppSessionSnapshot: async () => sessionSnapshot,
      createScenarioDraftRecord: async (payload) => {
        capturedCreatePayload = payload;
        return {
          ok: true,
          created: true,
          draft: {
            ...draftRecord,
            source: payload.source,
            telegramUserId: payload.telegramUserId,
            telegramUsername: payload.telegramUsername,
            sessionId: payload.sessionId,
            category: payload.category,
            targetPlatform: payload.targetPlatform,
            constraints: payload.constraints,
            status: payload.status,
            metadata: payload.metadata
          },
          taskId: "task-001",
          analysisMode: "fallback",
          analysisReason: "test"
        };
      },
      trackTelegramAnalyticsEvent: async () => ({ ok: true })
    }
  );

  record(
    "scenario_post",
    postResult.status === 201 &&
      postResult.body?.ok === true &&
      postResult.body?.draft?.id === draftRecord.id &&
      capturedCreatePayload?.telegramUserId === sessionSnapshot.telegramUserId &&
      capturedCreatePayload?.telegramUserId !== "999999",
    "Expected POST to use the verified Mini App session identity and return the created draft.",
    {
      status: postResult.status
    }
  );
} catch (error) {
  record("scenario_post", false, error.message);
}

try {
  const getResult = await handleScenarioDraftGetRequest(
    {
      status: "NEW"
    },
    {
      getOwnerAccessState: async () => ({ isOwner: true }),
      getScenarioDraftsData: async (options) => {
        if (options.status !== "NEW") {
          throw new Error("Status filter was not forwarded.");
        }

        return [draftRecord];
      }
    }
  );

  record(
    "scenario_get_owner_list",
    getResult.status === 200 &&
      getResult.body?.ok === true &&
      Array.isArray(getResult.body?.data) &&
      getResult.body.data.length === 1,
    "Expected owner GET to return the filtered scenario draft list."
  );
} catch (error) {
  record("scenario_get_owner_list", false, error.message);
}

try {
  const patchResult = await handleScenarioDraftPatchRequest(
    {
      id: draftRecord.id,
      status: "REVIEW"
    },
    {
      getOwnerAccessState: async () => ({ isOwner: true }),
      updateScenarioDraftStatusRecord: async ({ id, status }) => ({
        ok: true,
        draft: {
          ...draftRecord,
          id,
          status
        }
      })
    }
  );

  record(
    "scenario_patch_status",
    patchResult.status === 200 &&
      patchResult.body?.ok === true &&
      patchResult.body?.draft?.status === "REVIEW",
    "Expected owner PATCH to update the scenario draft status."
  );
} catch (error) {
  record("scenario_patch_status", false, error.message);
}

let exportFilePath = "";

try {
  const exportResult = await handleScenarioDraftGetRequest(
    {
      id: draftRecord.id,
      format: "workhub"
    },
    {
      getOwnerAccessState: async () => ({ isOwner: true }),
      getScenarioDraftByIdData: async () => draftRecord
    }
  );

  exportPayload = exportResult.body;
  assertSchemaLike(exportPayload, workHubSchema);

  exportFilePath = path.join(
    os.tmpdir(),
    `bose-scenario-export-${Date.now()}.json`
  );
  fs.writeFileSync(exportFilePath, JSON.stringify(exportPayload, null, 2), "utf8");

  record(
    "scenario_export_workhub_json",
    exportResult.status === 200 &&
      exportResult.headers?.["Content-Disposition"]?.includes(`bose-scenario-${draftRecord.id}.json`) &&
      exportPayload.source === "BOSE_TELEGRAM" &&
      exportPayload.status === "NEW",
    "Expected owner export to produce a WorkHub-compatible JSON file.",
    {
      exportFilePath
    }
  );
} catch (error) {
  record("scenario_export_workhub_json", false, error.message);
}

process.env.APP_BASE_URL = originalAppBaseUrl;
process.env.TELEGRAM_BOT_TOKEN = originalBotToken;

const failed = results.filter((item) => !item.passed);

if (failed.length > 0) {
  console.log(JSON.stringify(results, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      exportFilePath,
      results
    },
    null,
    2
  )
);
