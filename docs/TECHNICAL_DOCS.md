# TQS Billing Processor — Technical Documentation

## 1. Overview

The TQS Month-End Billing Processor is an internal web application that automates the monthly billing workflow. It takes raw Qnet exports (Excel files), applies billing rules and date corrections, verifies amounts against the Qnet database, generates Sage-ready CSVs, and uploads them directly to SharePoint.

**Production URL:** `https://billing.teamqualityservices.com` (custom domain on Railway)

**Audience:** Accounts Receivable / finance team members running month-end billing.

**Access control:** Restricted via Microsoft Entra security group assignment.

---

## 2. Architecture

```
┌─────────────────────┐       ┌──────────────────────┐       ┌─────────────────────┐
│  User (browser)     │──────▶│  Express server      │──────▶│  Microsoft Entra ID │
│                     │       │  (Railway)           │       │  (SSO / OIDC)       │
└─────────────────────┘       └──────────────────────┘       └─────────────────────┘
                                        │
                                        │ serves /public/index.html
                                        ▼
                              ┌──────────────────────┐
                              │  Frontend (vanilla   │──────▶ n8n webhooks (Qnet DB, Confluence)
                              │  JS + MSAL.js)       │──────▶ Microsoft Graph API (SharePoint)
                              └──────────────────────┘
```

**Tech stack:**
- **Frontend:** Pure HTML/CSS/JS (no framework). Uses SheetJS (xlsx.full.min.js) for Excel parsing, MSAL.js for SharePoint Graph API auth.
- **Backend:** Node.js + Express + `@azure/msal-node` for server-side SSO.
- **Hosting:** Railway (Linux container, Node 18+).
- **Auth:** Microsoft Entra ID (OIDC authorization code flow).
- **Data sources:** n8n webhooks (front the Qnet DB and Confluence), SharePoint via Graph API.

### 2a. Two billing periods, not one

The app carries **two different period windows**, and mixing them up is a real
source of wrong invoices:

| Window | Applies to | Span | Where it comes from |
|---|---|---|---|
| **TQS billing calendar cycle** | Items A/B/C — contracted units, additional hours, weekend production | Monday after the prior month's last Sunday → this month's last Sunday. August 2026 = `2026-07-27` → `2026-08-30` | The **Period Start / Period End** fields in Step 1, prefilled by `computeBillingCycle()` |
| **Calendar month** | Item D — Monthly Pricing and Flat Rate | 1st → last day of the month. August 2026 = `2026-08-01` → `2026-08-31` | `flatRateBillingMonth(pStart, pEnd)` — the calendar month containing the period **end** |

Confluence, *Automated Representation Billing Processes by Agreement Price
Type* (Finance & Accounting Playbook):

> Monthly and flat rate billing reports cover the full calendar month, from the
> 1st through the last day of the month. Other billing/report types either use a
> single week or follow the TQS billing calendar.

The cycle's opening week is **prior-month time**, so anything Item D that
measures against the cycle double-counts it. That was the v2.8.8 bug: a
shutdown running Mon `2026-07-27` – Sun `2026-08-02` sits inside the August
cycle, so the audit demanded an August flat-rate shutdown credit for a week
July's invoice had already covered. Every Item D check — shutdown credits, the
100%-full-month rule, and pro-ration — now reads `FR_MONTH` / `flatRateBillingMonth()`.
The `Total Weekdays in Period` field likewise counts the **cycle's** weekdays
(25 in August 2026) and is the wrong denominator for Item D, which uses the
month's (21).

### 2b. Dates are calendar days, not instants

`new Date('2026-08-31')` parses as **UTC midnight**, so reading it back with the
local getters (`getDay`, `getDate`, `getMonth`) reports the previous day
anywhere west of Greenwich — in America/New_York `new Date('2026-08-01').getDay()`
is Friday, not Saturday. That shifted every week boundary by a day: a shutdown
week whose Friday was the month's last day was dropped, and one whose Monday
was the day before the period start was counted.

Billing date math therefore goes through the `cd()` / `cdDay()` / `cdAdd()` /
`cdISO()` primitives, which read and write UTC fields so a calendar date means
the same day in every browser. `countFullShutdownWeeks`, `countWeekdays`,
`forEachMonFriWeek`, `getApplicableShutdowns` and `flatRateBillingMonth` all use
them. **Do not** reintroduce `new Date(isoString).getDay()` /
`.setDate()` for billing math.

Still on the old local-date pattern, and deliberately left alone so
contracted-unit amounts do not move without Finance verifying them: the
contracted-units partial-week walks in the `agreement-coverage` check and in
`buildExpectedSnapshot`, the `contracted-shutdown` (Normal setting) week check,
and the reconciliation retro week math. Same one-day skew, contracted-units
only — see `docs/PROJECT_LOG.md` "Open items".

---

## 3. Authentication Flow

Two separate Microsoft auth flows coexist:

### 3a. Server-side SSO (page access)

This gates access to the app. Happens before the HTML ever loads.

1. User visits the app URL.
2. Express middleware checks `req.session.account`. If absent → 302 to `/auth/login`.
3. `/auth/login` calls `msalClient.getAuthCodeUrl()` and redirects the browser to `login.microsoftonline.com`.
4. User authenticates (if not already signed in with Microsoft) and consents.
5. Microsoft redirects back to `/auth/callback?code=...`.
6. Server exchanges the code for tokens via `msalClient.acquireTokenByCode()`, stores the account on the session.
7. 302 to `/` — now `req.session.account` exists, middleware lets them through, Express serves `public/index.html`.

**Logout:** `/auth/logout` destroys the session.

### 3b. Client-side MSAL (SharePoint uploads)

Used by the HTML to upload generated CSVs to SharePoint via Graph API. Separate token, acquired in-browser via popup. Configured in the `CONFIG` block at the bottom of `public/index.html`. This doesn't gate access — it only activates when the user clicks "Upload to SharePoint".

---

## 4. Deployment (Railway)

### 4a. Branch and build

- Repo: `lucas-straw/tqs-billing-processer`
- Railway deploys from whichever branch is configured in **Service → Settings → Source → Branch** (currently `main`, formerly `claude/fix-express-sso-server-9Eq6T` during development).
- Build: Railpack auto-detects Node from `package.json` and runs `npm install` then `npm start`.
- `package.json` pins `engines.node` to `>=18`.

### 4b. Environment variables

Set in Railway → Service → **Variables**. All five are required:

| Variable | Purpose | Example / Source |
|---|---|---|
| `CLIENT_ID` | Azure App Registration "Application (client) ID" | `7a37853f-26b9-4f4a-a60b-f0f7c1a31aab` |
| `TENANT_ID` | Entra tenant ID | `27050f3c-db65-437f-b52a-4c66d6383cd0` |
| `CLIENT_SECRET` | From Azure → App Registration → Certificates & secrets | — (rotate before expiry) |
| `REDIRECT_URI` | Must match what's registered in Azure | `https://billing.teamqualityservices.com/auth/callback` |
| `SESSION_SECRET` | Random string for express-session | `openssl rand -hex 32` |

`PORT` is injected automatically by Railway (typically 8080). The app reads it via `process.env.PORT`.

### 4c. Custom domain

- Railway → **Settings → Networking → Custom Domain** → add `billing.teamqualityservices.com`
- Railway provides a CNAME target like `xxx.up.railway.app`
- DNS provider: add CNAME record `billing` → `<target>`
- Railway auto-provisions TLS once DNS resolves
- **After changing the domain**, update both:
  - Railway env var `REDIRECT_URI`
  - Azure App Registration → Authentication → Redirect URIs

---

## 5. Azure Configuration

### 5a. App Registration

Azure portal → **App registrations** → "TQS Billing Processor"

- **Authentication** → Platform: **Web**
  - Redirect URI: `https://billing.teamqualityservices.com/auth/callback`
  - (Remove any SPA redirect URIs — not needed with server-side flow)
- **Certificates & secrets** → Client secret must be active (set expiry reminder)
- **API permissions** (delegated):
  - `openid`, `profile`, `email` — required for SSO
  - `Files.ReadWrite`, `Sites.ReadWrite.All` — for SharePoint upload (client-side MSAL)

### 5b. Access control via security groups

Azure portal → **Enterprise Applications** → "TQS Billing Processor"

- **Properties** → "Assignment required?" = **Yes**
- **Users and groups** → add the security group(s) that should have access

Users outside the assigned groups get an Azure-side "You don't have access" error before hitting the app. Requires Entra ID P1 to assign groups (individual users work on any tier).

---

## 6. External Integrations

### 6a. n8n webhooks

Hosted at `https://teamqs.app.n8n.cloud`. Two endpoints used:

| Webhook | Purpose |
|---|---|
| `/webhook/billing-processor-db` | Returns shutdowns, priced agreements, Marelli-suppressed codes, and invoice settings for the billing period. Called automatically when the period dates are set. |
| `/webhook/billing-rules-check` | Checks the current version of the Confluence billing rules page and SOP page. Flags the banner at the top of the app if either has changed. |

No credentials are exposed in the frontend — n8n handles the Qnet DB connection and Confluence API on the backend.

### 6b. SharePoint via Graph API

Target location: `Accounting/AR/Invoicing/Mthly Invoicing Docs/<year>/<month>/Monthly Rep`

- `driveId` is hardcoded in the `CONFIG.sharePoint` block of `index.html`
- Year and month are set by the user in the UI before uploading
- Uses client-side MSAL to acquire a `Files.ReadWrite` token; no SharePoint credentials live in the app

---

## 7. File Structure

```
/
├── server.js             Express server + Entra SSO (msal-node)
├── package.json          Node deps, start script, and `npm test`
├── public/
│   └── index.html        Entire frontend (single file, no build step)
├── scripts/
│   ├── extract-fns.mjs           Pulls named functions out of index.html so
│   │                             tests exercise the SHIPPED code, not a copy
│   └── test-flat-rate-period.mjs Item D billing-period regression suite
└── docs/
    └── TECHNICAL_DOCS.md This document
```

Run the suite with `npm test`. It has no dependencies and runs in CI via
`npm run test --if-present`. Because the billing math is timezone-sensitive,
run it under a few zones before shipping a date change:

```
for tz in America/New_York UTC Europe/Berlin Australia/Sydney; do TZ=$tz npm test; done
```

---

## 8. Common Workflows

### 8a. Updating the HTML

1. Edit `public/index.html`
2. Commit and push to the Railway-connected branch
3. Railway auto-deploys (~1 min)

### 8b. Rotating the client secret

1. Azure → App Registration → **Certificates & secrets** → New client secret
2. Copy the **Value** (not the ID) — only shown once
3. Railway → Variables → update `CLIENT_SECRET`
4. Delete the old secret in Azure after confirming the new one works

### 8c. Changing the deploy branch

Railway → Service → **Settings → Source → Branch** → pick branch → save. Next push to that branch triggers a deploy.

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Application failed to respond" | Wrong Railway domain or app crashed | Check Deploy Logs for `Listening on port ...`. Verify Settings → Networking shows the domain you're hitting. |
| Redirect loop on login | `REDIRECT_URI` env var ≠ Azure registered redirect URI (trailing slash, http vs https, subdomain) | Make them match exactly. |
| `AADSTS50011: Redirect URI mismatch` | Same as above | Same fix. |
| `AADSTS7000215: Invalid client secret` | Secret rotated or expired | Generate new secret in Azure, update Railway var. |
| Build log: `Cannot find module '@azure/msal-node'` | `package.json` missing dep | Confirm `@azure/msal-node` is listed under `dependencies`. |
| "You do not have access" from Microsoft | User not in an assigned security group | Add them to the group in Entra (Enterprise Apps → Users and groups). |
| SharePoint upload returns 401 | Client-side MSAL token expired or user declined consent | User clicks upload again — MSAL re-prompts. |
| DB bar shows "unavailable" | n8n webhook down or timed out | Check n8n workflow status at `teamqs.app.n8n.cloud`. The app gracefully degrades — the user can still process files. |

---

## 10. Adding More Internal Apps Behind Entra SSO

This project is a template. To add another internal app (e.g., a reports dashboard, a data entry tool):

1. **New Azure App Registration** — one per app, each with its own client ID / secret and redirect URI.
2. **Deploy wherever makes sense** — Railway, Azure App Service, wherever. Copy this project's `server.js` as the auth shim and drop in your app's frontend under `public/`.
3. **Assign the security group** in that app's Enterprise Application page.
4. **Give it a subdomain** — e.g., `reports.teamqualityservices.com`, `quotes.teamqualityservices.com`.
5. **Appears in My Apps automatically** — users see all authorized apps at `https://myapps.microsoft.com/teamqualityservices.com`.

**Company branding** (logos, colors on the login screen and My Apps portal): Entra admin center → **Company branding**.

**Grouping apps** in My Apps (e.g., "Finance Apps" collection): Entra admin center → **Enterprise applications → Collections**.

---

## 11. Known Limitations / Future Work

- **In-memory session store** — `express-session` default. Fine for a single Railway instance; if we ever scale to multiple replicas, swap for Redis or a DB-backed store.
- **No rate limiting** — low-traffic internal tool, probably fine, but worth adding `express-rate-limit` if abuse becomes possible.
- **No audit log of who ran billing** — the Microsoft account is on `req.session.account` during a session but nothing is persisted. Could be added by logging each analyze/upload action to n8n or a small DB.
- **Confluence rules version check requires manual acknowledgment** — the banner warns but doesn't block.

---

## 12. Contacts / Ownership

- **App owner:** [fill in]
- **Azure tenant admin:** [fill in]
- **n8n workflow owner:** [fill in]
- **Railway account owner:** [fill in]
- **Confluence rules page:** https://teamqs.atlassian.net/wiki/spaces/finance/pages/1627095047
- **Confluence SOP page:** https://teamqs.atlassian.net/wiki/spaces/finance/pages/694386707
