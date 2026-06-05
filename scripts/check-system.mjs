const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
const endpoints = [
  "/api/dashboard",
  "/api/leads",
  "/api/appointments",
  "/api/workboard"
];

async function main() {
  for (const endpoint of endpoints) {
    const url = `${baseUrl}${endpoint}`;

    try {
      const response = await fetch(url);
      const json = await response.json();
      const status = response.ok ? "OK" : "FAIL";
      console.log(`${status} ${endpoint}`);

      if (!response.ok) {
        console.log(JSON.stringify(json, null, 2));
      }
    } catch (error) {
      console.log(`FAIL ${endpoint}`);
      console.log(error.message);
    }
  }
}

main();
