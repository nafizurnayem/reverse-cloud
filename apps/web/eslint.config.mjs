import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/lib/supabase/admin.ts",
      "src/app/api/leads/route.ts",
      "src/app/api/webhooks/calcom/route.ts",
      "src/app/api/chat/confirm-booking/route.ts",
      "src/app/api/schedule/book/route.ts",
      "src/app/api/portal/appointments/[[]id[]]/cancel/route.ts",
      "src/app/[[]locale[]]/admin/meetings/actions.ts",
      "src/lib/invites/**/*.ts",
    ],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["**/supabase/admin", "**/supabase/admin.*", "./admin", "./admin.*"],
          message: "Service-role imports are limited to validated leads, verified webhooks, validated booking operations, and authorized invitations.",
        }],
      }],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/supabase/admin.ts"],
    rules: {
      "no-restricted-syntax": ["error", {
        selector: "MemberExpression[property.name='SUPABASE_SERVICE_ROLE_KEY'], MemberExpression[property.value='SUPABASE_SERVICE_ROLE_KEY']",
        message: "Read the service-role key only in lib/supabase/admin.ts.",
      }, {
        selector: "ImportExpression[source.value=/admin(?:\\.[cm]?[jt]s)?$/]",
        message: "Use a static privileged-client import so its allowlist can be checked.",
      }, {
        selector: "CallExpression[callee.name='require'][arguments.0.value=/admin(?:\\.[cm]?[jt]s)?$/]",
        message: "Use a static privileged-client import so its allowlist can be checked.",
      }],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
