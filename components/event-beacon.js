"use client";

import { useEffect } from "react";
import { trackMiniAppEvent } from "./miniapp-launch-client";

export default function EventBeacon({ eventName, eventPayload = {} }) {
  useEffect(() => {
    void trackMiniAppEvent(eventName, eventPayload);
  }, [eventName, JSON.stringify(eventPayload)]);

  return null;
}
