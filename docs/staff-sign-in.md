# Staff sign-in

## What changed
- Staff now have their own sign-in address, **`/internal-access/staff-sign-in`** by default. Change it with `STAFF_SIGN_IN_PATH` (see `.env.example`); it is read at build time, so redeploy after changing it. An unusable value (wrong characters, too short, or on a path the app already uses) falls back to the default, so a typo can never lock staff out.
- **No public page links to it.** The "Staff Login" link is gone from the home page, `/courses` and `/courses/upcoming`, and Loop's public guide no longer offers a staff sign-in or staff password-reset link. `tests/staffLoginExposure.test.ts` fails if a public file ever mentions the staff routes again.
- **The older `/admin/login` stays**, as agreed. Set `STAFF_LEGACY_LOGIN=off` when you are ready: `/admin/login` then answers 404 and signed-out staff are sent to the new address.
- The form is the same one, in `src/components/admin/StaffLoginForm.tsx`, and it signs in through the same `POST /api/auth/login`. Instructors use it too.
- The internal file behind the address (`/staff-access`) answers 404 to anyone who asks for it directly. The address and `/admin/*`, `/instructor/*` send `X-Robots-Tag: noindex, nofollow, noarchive`. There is no sitemap.

## What protects it (the hidden address is not the protection)
- Every staff page and API checks the session and role on the server (`requireRole`). A trainee, employer, investor or organization account that calls a staff API gets 401 or 403 (checked in `scripts/device-checks/staff-access.cjs`).
- Sign-in is limited to 5 attempts per 15 minutes per address and email.
- Staff accounts can only be created by a super admin (`/api/admin/staff`) or when a super admin approves a training organization. No public route creates one, and `tests/staffLoginExposure.test.ts` checks it.
- **New: sign-in record.** Every attempt (signed in, wrong password, deactivated account, blocked for too many attempts) is stored in `StaffSignInLog` with the email, address and browser. Super admins see the last 50 under Settings, Security, "Recent staff sign-ins".

## Not done
- **No multi-factor authentication.** The platform does not have it today. It is a separate piece of work (an authenticator-app code at staff sign-in, with recovery codes).
- Until `STAFF_LEGACY_LOGIN=off`, a signed-out visitor who opens a staff page such as `/admin/dashboard` is sent to `/admin/login`, which reveals that address. `/admin/forgot-password` and `/admin/reset-password` are also still reachable, and the reset page links back to `/admin/login`.
- Network restrictions or an identity provider in front of staff access are not set up.

## Deploy and roll back
- Deploy: apply migration `20261023090000_staff_sign_in_log` (a new table only). Optionally set the two variables above.
- Roll back: unset both variables and redeploy; nothing else depends on them. The old address never stopped working.
