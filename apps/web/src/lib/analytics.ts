/**
 * PostHog analytics singleton.
 * Gracefully no-ops if VITE_POSTHOG_KEY is not set.
 */
import posthog from "posthog-js";

const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? "https://us.i.posthog.com";

if (key) {
  posthog.init(key, {
    api_host: host,
    person_profiles: "identified_only",
    capture_pageview: true,
  });
}

export type AnalyticsEvent =
  | "session_started"
  | "session_ended"
  | "progress_completed"
  | "group_created"
  | "group_joined"
  | "nudge_clicked";

export function track(event: AnalyticsEvent, props?: Record<string, unknown>) {
  if (!key) return;
  posthog.capture(event, props);
}

export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  if (!key) return;
  posthog.identify(userId, traits);
}

export { posthog };
