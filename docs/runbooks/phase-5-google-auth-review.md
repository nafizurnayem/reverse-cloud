# Phase 5 Google authentication review

Run this review against the deployed site with one ordinary client account and
one staff account. Do not save OAuth codes, access tokens, refresh tokens or
session cookies in screenshots or issue reports.

## Preconditions

- `NEXT_PUBLIC_SITE_URL` is the deployed HTTPS origin.
- Supabase Google Auth lists `https://<origin>/en/auth/callback` and
  `https://<origin>/bn/auth/callback` as allowed redirects.
- The client account has no active `staff_roles` assignment.
- The staff account has a known active role and expected permissions.
- A private/incognito browser window is available for each account.

## Test matrix

Record pass/fail, browser, account type and UTC timestamp for every row.

| Scenario | Steps | Expected result |
| --- | --- | --- |
| English Google login | Open `/en/login?next=/en/portal`, choose Google and complete login. | Callback returns to `/en/portal`; the account is shown as signed in. |
| Bangla Google login | Open `/bn/login?next=/bn/portal`, choose Google and complete login. | Callback and destination remain Bangla. |
| Session refresh | Refresh the portal, then close and reopen the tab. | The user remains signed in while the Supabase session is valid. |
| Safe destination | Open `/en/login?next=https://example.com`, then sign in. | The app ignores the external destination and returns to `/en/portal`. |
| Cross-locale destination | Open `/bn/login?next=/en/admin`, then sign in. | The app rejects the mismatched destination and uses `/bn/portal`. |
| Client admin guard | While signed in as the client, request `/en/admin`. | Admin data is not rendered; the route responds as unavailable. |
| Staff permissions | Sign in as staff and open `/en/admin`. | Only sections granted by active database roles appear. |
| Role change | From another administrator, deactivate and reactivate one non-admin role. | The target's next authorized request reflects the change and the audit log records it. |
| Final-admin protection | Try to deactivate the only active admin assignment. | The action is rejected with the localized final-admin message. |
| Logout | Submit Sign out, then revisit the portal and admin URL. | The session is removed and protected pages return to login. |
| Magic-link fallback | Request a magic link in each locale and use it once. | The locale and safe destination are preserved; reusing the link fails safely. |
| Invite after login | Start from a valid localized invite while signed out and authenticate. | The invite is accepted once and the user lands in the localized portal. |

## Evidence and completion

The review is complete when every row passes in a production-like deployment,
no critical or high-severity authentication bug remains open, and the staff role
shown in the admin shell matches the active database assignment. Attach only
redacted screenshots and request IDs to bug reports.
