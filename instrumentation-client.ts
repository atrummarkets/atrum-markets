import posthog from "posthog-js";

/**
 * Browser analytics, deliberately anonymous.
 *
 * This is a privacy product: the relayer exists so a user's address never appears beside their
 * action on chain. Analytics that identified people by wallet would rebuild that link off-chain
 * and make it queryable, so nothing here identifies anyone -- see the note in lib/atrum/wallet.tsx.
 */

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (!projectToken || !apiHost) {
  if (process.env.NODE_ENV === "development") {
    const missingVariable = projectToken
      ? "NEXT_PUBLIC_POSTHOG_HOST"
      : "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN";

    // Warn, never throw. This module is the client instrumentation entry point, so throwing
    // here breaks local dev for everyone who has not set up PostHog -- which is every
    // contributor who is not working on analytics, and CI. Missing analytics is not a reason
    // to stop the app from running.
    console.warn(
      `${missingVariable} is not configured, so PostHog events will not be sent. ` +
        "This is only a warning; the app runs normally without it.",
    );
  }
} else {
  posthog.init(projectToken, {
    api_host: apiHost,
    defaults: "2026-01-30",
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: false,
    },
    /**
     * No person profiles, ever.
     *
     * Without this, PostHog still stitches one browser's whole journey into a single profile
     * via cookie -- deposit, then bet, then redeem, linked together and stamped with an IP.
     * Anonymous-but-linked is still a profile of one user's shielded activity, which is the
     * thing this product promises not to build. Counts and funnels work without it.
     */
    person_profiles: "never",
    debug: process.env.NODE_ENV === "development",
    tracing_headers: [window.location.hostname],
  });
}
