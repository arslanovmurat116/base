const baseUrl = (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const endpoints = [
  { path: "/" },
  { path: "/dashboard" },
  { path: "/demo" },
  { path: "/clients" },
  { path: "/deals" },
  { path: "/tasks" },
  { path: "/ai" },
  { path: "/pricing" },
  { path: "/privacy" },
  { path: "/terms" },
  { path: "/api/system/health" },
  { path: "/api/dashboard" },
  { path: "/api/workboard" },
  { path: "/api/leads" },
  { path: "/api/appointments" },
  { path: "/api/core/clients" },
  { path: "/api/core/deals" },
  { path: "/api/core/summaries" },
  { path: "/api/core/statistics" },
  { path: "/api/telegram/analytics/track", method: "POST", body: { eventName: "screen_view", eventPayload: { source: "system-check" } } },
  { path: "/api/telegram/webhook" },
  { path: "/api/telegram/dispatch?dryRun=1" },
  { path: "/api/ai/crm/summary" }
];

async function main() {
  console.log(`BOSE RC1 system check against ${baseUrl}`);

  for (const endpoint of endpoints) {
    const url = `${baseUrl}${endpoint.path}`;

    try {
      const response = await fetch(url, {
        method: endpoint.method || "GET",
        headers: endpoint.body
          ? {
              "Content-Type": "application/json"
            }
          : undefined,
        body: endpoint.body ? JSON.stringify(endpoint.body) : undefined
      });
      const status = response.ok ? "OK" : "FAIL";
      const body = await response.json().catch(() => null);
      console.log(`${status} ${endpoint.method || "GET"} ${endpoint.path} (${response.status})`);

      if (!response.ok && body) {
        console.log(JSON.stringify(body, null, 2));
      }
    } catch (error) {
      console.log(`FAIL ${endpoint.method || "GET"} ${endpoint.path}`);
      console.log(error.message);
    }
  }
}

main();
