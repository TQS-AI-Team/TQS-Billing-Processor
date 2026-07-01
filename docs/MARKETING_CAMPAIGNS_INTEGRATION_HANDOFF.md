# Marketing Campaigns → Ad Platform Integration Handoff

**For:** the `TQS-AI-Team/TQS-Marketing-Campaigns` repo (the console campaign builder UI).
**From:** the n8n ad-execution workflows on `https://teamqs.app.n8n.cloud`.
**Purpose:** define exactly what the builder UI must POST, and the API constraints it must
enforce client-side, so campaigns don't get rejected. Grounded in validation against
**Google Ads API v22** and **Meta Marketing API v25.0**.

> Verification caveat: `developers.google.com` and `developers.facebook.com` are blocked by
> the agent egress proxy, so the findings below were validated against official SDK source
> (Meta v25.0) and official-domain search results, with canonical doc URLs cited. Confirm
> against the live docs before shipping UI changes.

---

## 1. Google Ads — LIVE

**n8n workflow:** `[AUTO] TQS Google Ads Execution [MKTG]` (id `90Kc0zOE87DRr5pa`), active.
**Production webhook:** `POST https://teamqs.app.n8n.cloud/webhook/002a8057-b1eb-4677-bcbd-6580808e2552`
**Credential:** `Google Ads Oauth (Refresh Token)` (TQS team) — also supplies the developer token.
**Behavior:** one atomic `googleAds:mutate` (budget → campaign → ad group → keywords → geo →
audiences → RSAs). **All campaigns are created `PAUSED`.**

### 1.1 Request body the UI must POST
```json
{
  "customerId": "1234567890",              // Google Ads customer ID, digits only, no dashes — REQUIRED
  "loginCustomerId": "2493970075",         // manager (MCC) ID if the account is managed; else omit
  "campaign": {
    "budgetName": "TQS — <location>",      // REQUIRED
    "budgetMicros": 50000000,              // integer micros ($ × 1,000,000); REQUIRED; min 10000
    "name": "[AUTO] TQS — <location> — Search",  // REQUIRED
    "startDate": "2026-07-15",             // YYYY-MM-DD; optional (YYYYMMDD tolerated by n8n)
    "endDate": "2026-09-30"                // YYYY-MM-DD; optional; must be after startDate
  },
  "adGroup": {
    "name": "Tier 1 Suppliers",            // REQUIRED
    "cpcBidMicros": 8000000                // integer micros; REQUIRED
  },
  "keywords": [
    { "text": "oem resident liaison", "matchType": "PHRASE" }   // matchType ∈ EXACT | PHRASE | BROAD
  ],
  "geoCriteria": [
    { "locationId": "1023191" }            // Google geoTargetConstant numeric ID
  ],
  "audienceLists": [
    { "userListResourceName": "customers/1234567890/userLists/987654321" }  // full resource name
  ],
  "ads": [
    {
      "headlines": ["h1", "h2", "h3"],     // MIN 3, MAX 15, each ≤ 30 chars
      "descriptions": ["d1", "d2"],        // MIN 2, MAX 4, each ≤ 90 chars
      "finalUrls": ["https://www.teamqualityservices.com"]   // ≥ 1 absolute URL
    }
  ]
}
```
`keywords`, `geoCriteria`, and `audienceLists` may be empty arrays; `ads` must have ≥ 1 entry.

### 1.2 Hard constraints the UI MUST enforce (validated blockers)
These are the failure modes that would otherwise roll back the entire atomic mutate:

| Field | Rule | Source |
|---|---|---|
| `ads[].headlines` | **≥ 3**, ≤ 15, each **≤ 30 chars** | RSA content minimums |
| `ads[].descriptions` | **≥ 2**, ≤ 4, each **≤ 90 chars** | RSA content minimums |
| `ads[].finalUrls` | **≥ 1** absolute URL (with scheme) | RSA requires final URL |
| `campaign.startDate` / `endDate` | **`YYYY-MM-DD`** — never `""`, never `YYYYMMDD` | REST date format |
| `campaign.budgetMicros` | integer **≥ 10000** micros (real currency floor is higher) | budget minimum |
| `customerId` | digits only, no dashes | request path |
| `loginCustomerId` | the **manager** ID when the account is managed (not the child) | MCC header |
| `keywords[].matchType` | `EXACT` \| `PHRASE` \| `BROAD` | KeywordMatchType enum |

> **n8n already guards these.** A `Validate & Normalize` node rejects bad payloads with a
> descriptive error before any API call. But the UI should validate client-side too so users
> get immediate feedback instead of a failed submit.

### 1.3 Response
- **Success:** `{ ok:true, budgetResourceName, campaignResourceName, adGroupResourceName,
  keywordResourceNames[], geoCriterionResourceNames[], audienceCriterionResourceNames[], adResourceNames[] }`
- **Validation failure:** the workflow throws and returns an error whose message starts with
  `Google Ads payload rejected: …` (currently surfaced as an HTTP error, not a structured 4xx —
  see open items).

### 1.4 Confirmed-correct (no change needed)
Atomic mutate with negative temp resource names (`-1/-2/-3`), campaign-level `userList` (valid for
**Search**), `containsEuPoliticalAdvertising` (required — always sent), `manualCpc` bidding,
index-ordered response parsing. `networkSettings` is now set server-side by n8n.

### 1.5 Open items (Google Ads)
- [ ] **Webhook path** is an auto-generated UUID. Decide a readable path (e.g.
      `/webhook/tqs/google-ads/execute`) and update **both** the UI and the n8n webhook node.
- [ ] Confirm which customer accounts sit under manager **`2493970075`** (drives `loginCustomerId`).
- [ ] Decide whether n8n should return a structured `4xx` on validation failure (nicer for the UI).

---

## 2. Meta (Facebook) — NOT BUILT YET (spec for the build)

**Credential ready:** `Facebook Graph API` (TQS team), holding a Meta **System User** token
(non-expiring). No workflow exists yet. Validated against **Marketing API v25.0**; pin every
call to `https://graph.facebook.com/v25.0`.

Ad creation is a strict 4-step chain — each returns an `id` fed to the next:
**Campaign → Ad Set → Ad Creative → Ad** (`POST /act_{ad_account_id}/…`).

### 2.1 What the UI must collect / decide
- **objective** — ODAX only: `OUTCOME_TRAFFIC`, `OUTCOME_LEADS`, `OUTCOME_SALES`,
  `OUTCOME_ENGAGEMENT`, `OUTCOME_AWARENESS`, `OUTCOME_APP_PROMOTION`.
  **Do NOT use legacy** `LINK_CLICKS` / `CONVERSIONS` / `LEAD_GENERATION` at campaign level.
- **special_ad_categories** — array, send `[]` if none. **Required on every campaign.**
- **budget** — in **CENTS** of account currency; `daily_budget` or `lifetime_budget`
  (lifetime requires `end_time`); on **campaign (CBO) or ad set — exactly one level**.
- **targeting** — at least `geo_locations` (e.g. `{ "countries": ["US"] }`).
- **billing_event** + **optimization_goal** — must be a valid combo for the objective.
- **promoted_object** — required for leads/conversions/messaging (`{page_id}` or
  `{pixel_id, custom_event_type}`).
- **creative** — `object_story_spec` with `page_id` + `link_data` (link, message, call_to_action).
- **status** — `PAUSED` while building.

### 2.2 Minimal correct bodies
```json
// 1. POST /act_{id}/campaigns
{ "name": "Traffic Campaign", "objective": "OUTCOME_TRAFFIC",
  "special_ad_categories": [], "status": "PAUSED" }

// 2. POST /act_{id}/adsets
{ "name": "Traffic AdSet", "campaign_id": "<CAMPAIGN_ID>",
  "billing_event": "IMPRESSIONS", "optimization_goal": "LINK_CLICKS",
  "daily_budget": 1000,                                  // cents = $10.00
  "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
  "targeting": { "geo_locations": { "countries": ["US"] } }, "status": "PAUSED" }
// For OUTCOME_LEADS add: "optimization_goal":"LEAD_GENERATION", "promoted_object":{"page_id":"<PAGE_ID>"}

// 3. POST /act_{id}/adcreatives
{ "name": "Traffic Creative",
  "object_story_spec": { "page_id": "<PAGE_ID>",
    "link_data": { "link": "https://example.com/landing", "message": "…",
      "call_to_action": { "type": "LEARN_MORE", "value": { "link": "https://example.com/landing" } } } } }

// 4. POST /act_{id}/ads
{ "name": "Traffic Ad", "adset_id": "<ADSET_ID>",
  "creative": { "creative_id": "<CREATIVE_ID>" }, "status": "PAUSED" }
```

### 2.3 Pitfalls the UI must prevent
Budget in **cents** (not dollars) · `special_ad_categories` always present · `OUTCOME_*` only ·
targeting always has geo · `promoted_object` when required · one budget level only ·
`creative` must be `{ "creative_id": … }` (not a bare string) · pin to `v25.0`.

### 2.4 Prerequisites / blockers before the Meta workflow can be built
- [ ] **Ad account** `act_<id>`; System User assigned to it with an admin/ads role.
- [ ] **Page ID** for `object_story_spec.page_id`, on the same Business.
- [ ] **System User has the "Ads" task on that Page** (Business Settings asset assignment).
      If not, add scope **`pages_manage_ads`** and re-issue the System User token.
- [ ] `ads_management` access level: **Standard vs Advanced** (+ Business Verification if managing
      assets beyond your own Business).
- [ ] **Objective** (`OUTCOME_TRAFFIC` vs `OUTCOME_LEADS`) and **budget model** decision.
- [ ] If leads: **lead form ID** (on-Facebook) or **Pixel ID + custom_event_type** (website).
- [ ] Creative assets: landing URL, primary text/headline/description, and an image uploaded via
      `POST /act_{id}/adimages` (→ `image_hash`) or a video via `/advideos`.
- [ ] Ad-account **currency** (to sanity-check the cents math).

### 2.5 Token permission status (7 granted scopes)
Needed and present: `ads_management`, `ads_read`, `business_management`, `pages_show_list`
(+ `pages_read_engagement`, helpful). Not relevant: `whatsapp_business_management`,
`whatsapp_business_messaging`. **Verify:** `pages_manage_ads` is **not** granted — confirm the
Page "Ads" task assignment or add this scope.

---

## 3. Infra / cross-system notes
- **n8n base:** `https://teamqs.app.n8n.cloud`.
- **Google Ads is n8n-only.** The Google Ads app was **disabled in Zapier**. Turn off any
  remaining live Google Ads **Zaps** in the Zapier account UI.
- **Windsor.ai** reviews reporting data only; API key is stored in Azure. No consumer workflow
  exists yet — Windsor is not in the publish path.
- **Both platforms create everything PAUSED** for human review before spend.

## 4. Canonical doc references
- Google Ads: `developers.google.com/google-ads/api` — RSA create, mutate/temporary-ids,
  campaign create, EU political ads, KeywordMatchType, location targeting.
- Meta: `developers.facebook.com/docs/marketing-api` — campaign/adset/adcreative/ad references,
  special ad category, promoted object; Graph API **v25.0** changelog.
