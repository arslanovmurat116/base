export function getScenarioOrderRoute() {
  return "/scenario-request";
}

export function buildScenarioOrderTelegramReply() {
  return {
    text: [
      "Scenario order for BOSE",
      "",
      "Tell BOSE what scenario you want to implement.",
      "Open the Mini App form, describe the task, and BOSE will save it for owner review and WorkHub export."
    ].join("\n"),
    buttonLabel: "Open Scenario Form",
    path: getScenarioOrderRoute()
  };
}
