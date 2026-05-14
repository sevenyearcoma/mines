import posthog from "posthog-js";

type AnalyticsProperties = Record<string, unknown>;

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const explicitEnabled = process.env.NEXT_PUBLIC_POSTHOG_ENABLED;
const enabled =
  Boolean(token) &&
  explicitEnabled !== "false" &&
  (process.env.NODE_ENV === "production" || explicitEnabled === "true");

let initialized = false;

export function initAnalytics() {
  if (!enabled || initialized || typeof window === "undefined") return;

  posthog.init(token!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "/ingest",
    ui_host: "https://us.posthog.com",
    defaults: "2026-01-30",
    capture_exceptions: process.env.NODE_ENV === "production",
    disable_session_recording: process.env.NODE_ENV !== "production",
    debug: false,
  });

  initialized = true;
}

export function capture(name: string, properties?: AnalyticsProperties) {
  if (!enabled) return;
  initAnalytics();
  posthog.capture(name, properties);
}

export function identify(id: string, properties?: AnalyticsProperties) {
  if (!enabled) return;
  initAnalytics();
  posthog.identify(id, properties);
}

export function resetAnalytics() {
  if (!enabled) return;
  initAnalytics();
  posthog.reset();
}
