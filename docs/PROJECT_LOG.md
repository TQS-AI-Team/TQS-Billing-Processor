# Billing Processor — Project Log

Running notes for cross-session continuity. Update this whenever a session ends with meaningful state changes, open questions, or decisions worth carrying forward. Pair with:

- `CLAUDE.md` (root) — high-level architecture and rules-of-the-road
- `docs/ROLLBACK.md` — per-version SHAs and revert playbook
- This file — running narrative

When starting a new session, prompt with: *"Read `docs/PROJECT_LOG.md`, `docs/ROLLBACK.md`, and `CLAUDE.md` to catch up on the project state."*

---

## Current shipped state (latest first)

| Version | Date | Highlights | SHA |
|---|---|---|---|
| v2.4.7 | 2026-05-21 | Fix PDF summary pagination — rows at bottom of page now overflow to a new page instead of being silently dropped. | `1df74f8` |
| v2.4.6 | 2026-05-21 | Fix HST row in summary — Unit Price and Subtotal both show HST total; Scheduled Hours and Hours Worked show 0. | `1df74f8` |
| v2.4.5 | 2026-05-12 | Fix otRate lookup — collect from all agreements at location (including expired ones) since it is a location-level property, not period-specific. | `95df6de` |
| v2.4.4 | 2026-05-12 | Add `otRate` field name diagnostic to parse log (first agreement's field list + per-agreement otRate value) to identify correct N8N field name. | `a963680` |
| v2.4.3 | 2026-05-08 | Additional hours rate now uses `otRate` from agreement data; falls back to OCR rate then std.rate × 1.5. | `cae2745` |
| v2.4.2 | 2026-05-08 | Filter agreements expiring on period start date from summary — replaced agreements hidden; other zero-hour agreements still shown. | `aafe040` |
| v2.4.1 | 2026-05-08 | Exclude zero-scheduledHours agreements from summary table/PDF; revert deploy workflow to main-only trigger to stop Azure federated identity failures on PR pushes. | `ead95fa` |
| v2.4.0 | 2026-05-08 | Fix scheduled hours for replaced agreements — treat Monday expiry as previous Sunday, exclude agreement entirely if adjusted expiry falls before period start. | `107a4f4` |
| v2.3.9 | 2026-05-08 | Re-add feature branch deploy trigger to workflow (pending Azure federated credential setup for the feature branch). | `7669a31` |
| v2.3.8 | 2026-05-08 | Revert deploy workflow to main-only trigger — feature branch trigger caused Azure federated identity error (subject mismatch). | `fb43bbf` |
| v2.3.7 | 2026-05-08 | Deploy workflow: also trigger on push to `claude/add-billing-processor-tab-VLeg1` so Azure deploys without requiring a manual push to main. | `35c89ce` |
| v2.3.6 | 2026-05-08 | Add per-agreement scheduled hours diagnostic logging (parse log + console) to diagnose 50 vs 40 scheduled hours mismatch. | `d242a94` |
| v2.3.5 | 2026-05-08 | Fix scheduled hours week count — derive from actual period dates instead of stored state to prevent stale value carrying over from a previous month selection. | `9ec03ca` |
| v2.3.4 | 2026-05-08 | Fix `callClaudeVision` to handle N8N batch response shape `{success,results:[{invoice}]}` — was showing "?" for invoice#/location; add per-invoice agreement matching log lines. | `3d48c2d` |
| v2.3.3 | 2026-05-08 | Fix changelog hook loop — skip reminder when commit message contains "PROJECT_LOG". | `ec80412` |
| v2.3.2 | 2026-05-08 | PROJECT_LOG self-update: add v2.3.1 row. | `f42739f` |
| v2.3.1 | 2026-05-08 | PROJECT_LOG self-update: add v2.3.0 row. | `735c8ee` |
| v2.3.0 | 2026-05-08 | Fix Bosch location matching (Qnet canonical name after agreement match), PDF grand total always drawn on first row, app changelog bumped to 2.3.0. | `8e85f77` |
| v1.9.9 | 2026-05-08 | **Bosch:** Embed standalone assembler in `#bosch` tab via `<iframe>` — eliminates CSS/JS conflicts with main app. Old inline markup hidden in-place. | `35402a8` |
| v1.9.8 | 2026-05-08 | **Bosch:** Replace HTML with user-provided version — per-page `callClaudeVision` with `systemPrompt` payload, `APP.agreementData` as keyed object, `generateBundle` loading from stored `arrayBuf`, `.step-nav` CSS class, `inv.id`-based approval assignments. | `18aab8a` |
| v1.9.7 | 2026-05-08 | PROJECT_LOG self-update: add v1.9.6 row (changelog hook commit). | `36c5f71` |
| v1.9.6 | 2026-05-08 | Add `.claude/settings.json` with PostToolUse hook — fires after every `git commit` and injects a reminder to update `docs/PROJECT_LOG.md`. Backfill Bosch entries v1.9.2–v1.9.5 into version table. | `d20cf3c` |
| v1.9.5 | 2026-05-08 | **Bosch:** Fix blank PDF bundle — embed cached PDF.js-rendered PNGs instead of pdf-lib `copyPages` (which produces blank pages on Sage PDFs). Add "✕ Remove" buttons + "Clear all" per upload zone. | `392e10e` |
| v1.9.4 | 2026-05-08 | **Bosch:** Fix OCR format mismatch — `callClaudeVision` now sends `{pages:[…],billingMonth}` batch format matching N8N webhook contract (was sending single-page+systemPrompt). Per-page log shows inv#/location/agreement. Agreement-to-invoice matching logs each Qnet name resolution. | `6fd747b` |
| v1.9.3 | 2026-05-08 | **Bosch:** Standalone `Bosch Invoice Bundle Assembler.html` — full rewrite as double-click-to-open file. 5-step wizard (step 4 hidden), per-page Claude Vision OCR via N8N, `buildSummaryRows()` seeded from Qnet agreements, landscape pdf-lib cover pages, `APP` state object. | `b0c7119` |
| v1.9.2 | 2026-05-08 | **Bosch:** Improve OCR error logging — surface HTTP status and first per-page failure reason from N8N response. | `33a500d` |
| v1.9.0 | 2026-05-01 | **Major pivot:** reconciliation is now file-driven (4 files). Adjustment report is primary retro source; #2 vs #4 diff catches anything missed. No DB queries from this tab. Old DB-query path left in source pending v1.9.1 cleanup. | _pending merge_ |
| v1.8.0 | 2026-04-30 | Volume discount (1096) recompute when CU/AH/WP retros change the base. HST/VAT now use post-discount net (matches existing Month-End audit). | `a1bdb72` |
| v1.7.9 | 2026-04-30 | HST (1053) and VAT (1047) retros on adjusted taxable base. Per (cust × SA) aggregate. | `396181a` |
| v1.7.8 | 2026-04-30 | Retro rows now populate CURRENCY and SI_LINEITEM_DATE; MEMO is self-explanatory with shutdown dates / AH+WP counts inlined. | `b6c86d6` |
| v1.7.7 | 2026-04-30 | Step 3 bulk actions visually flip per-row buttons + live Pending counter. | `f74c6b4` |
| v1.7.6 | 2026-04-30 | Case-insensitive column lookup in recon CSV gen (fixes empty MEMO on retro rows). Adds PROJECT_LOG.md. | `7618091` |
| v1.7.5 | 2026-04-30 | Per-retro prior-rows expandable detail (with shutdown overlap highlighting). Currency-neutral KPIs (counts, not mixed-$ totals). Auto-Matched counter as completeness signal. | `b7a93bd` |
| v1.7.4 | 2026-04-30 | Hotfix: unhide `#rs4` Step 4 card so Generate Augmented CSVs button produces visible output. | `cbbe975` |
| v1.7.3 | 2026-04-29 | Diagnostic surfaces extracted-but-unmatched MEMO agreement number with likely causes. | `b7a6249` |
| v1.7.2 | 2026-04-29 | Retro-row context: prior ITEMDESC, MEMO, row count, source sheet + specific diagnostic notes. | `b2ea095` |
| v1.7.1 | 2026-04-29 | Hotfix: scope retros to pre-bill customers only (was iterating union of billed + expected, generated phantom retros for every priced agreement in DB — ~600 false positives). | `6f036c0` |
| v1.7.0 | 2026-04-28 | Pre-Bill Reconciliation Phase 3 — AH/WP retros (CU absorption rule, day-count tier, FR skipped). | `2faa834` |
| v1.6.0 | 2026-04-28 | Pre-Bill Reconciliation Phase 2 — `expectedSnapshot` + retro diff for shutdowns / contracted units / pricing / shutdown credits. Step 3 review UI + Step 4 augmented CSV gen. Adds `docs/ROLLBACK.md`. | `3c2ae59` |
| v1.5.0 | 2026-04-28 | Pre-Bill Reconciliation Phase 1 — tab navigation, period inputs, file uploads, `billedSnapshot` builder, `DB_PRIOR` loader. Foundation only; algorithm in v1.6+. | `dee7e9b` |
| v1.4.0 | 2026-04-28 | Test-account block fixes (per-row, case-insensitive, auto-approved). Per-item dynamic date defaults (`iA/gA`…`iD/gD`) with `computeBillingCycle()`. | `6c8a429` |
| v1.3.0 | 2026-04-27 | Additional-hours producing-facility routing (Autoliv-style). Editable C-code input in Manual Action; CSV-time strip+split. | `d7f5c05` |
| v1.2.0 | 2026-04-27 | Mid-period agreement-coverage audit. DB.contractedMap wiring. In-app changelog with version badge. | `57d3a15` |

---

## Active work / open items

### Bosch Invoice Bundle Assembler (`public/Bosch Invoice Bundle Assembler.html`)

Standalone double-click HTML file — no server, no build tools.

**Current state (v1.9.5):** OCR format fixed, blank PDF fixed via PNG embedding, file removal UX improved.

**N8N webhooks:**
- OCR: `https://teamqs.app.n8n.cloud/webhook/bosch-invoice-ocr` — expects `{pages:[{imageBase64,mediaType:'image/jpeg'}],billingMonth}`, returns `{success,results:[{success,invoice:{…}}]}`
- Agreements: `https://teamqs.app.n8n.cloud/webhook/bosch-agreement-lookup` — POST `{supplierId:226,billingPeriodStart,billingPeriodEnd}`
- Additional hours: `https://teamqs.app.n8n.cloud/webhook/bosch-additional-hours` — POST `{billingStart,billingEnd}`

**Open items:**
1. **Real OCR test with correct N8N format** — the format was wrong before v1.9.4; need to confirm OCR now succeeds end-to-end with a real billing month's PDFs.
2. **PDF page dimensions** — `embedCachedPage` divides rendered pixels by 2 to get PDF points; verify this is correct for Sage exports (assumes `scale:2.0` in `pdfToPages`).
3. **Multi-file invoice spanning** — if one invoice's pages span two uploaded PDFs (unusual but possible), `inv.sourceFileIndex` only tracks the first page's file; pages from subsequent files would be missed. Not yet handled.
4. **`refreshAgreements` location update** — same Qnet-name patch applied in `startParsing` should also be in `refreshAgreements`. Verify both paths update `inv.location`.

---

### Reconciliation feature

**Current state:** core loop works (upload prior + new pre-bill → DB diff → Step 3 review → Step 4 augmented CSV download). Real-data testing in progress with Lucas using March/April data.

**Verified working:**
- Tab nav, period auto-fill, file upload + parsing
- `billedSnapshot` per (cust × SA × itemId)
- `DB_PRIOR` loader (separate from Month-End `DB`)
- `expectedSnapshot` for: contracted-units, monthly-pricing, flat-rate, shutdown-credit
- `expectedSnapshot` Phase 3 types: additional-hours (with absorption rule), weekend-production (with day-count tier)
- Per-retro prior-row detail with shutdown-week highlighting
- Augmented CSV gen with retro-row append (Case A) and standalone block for orphans (Case B)

**Open items / not yet shipped:**

1. **HST / VAT recomputation against new retro net** — _shipped v1.7.9 (per cust × SA aggregate)._ Future refinement: per-`SI_LINEITEM_DATE` granularity per CLAUDE.md spec.

2. **Volume discount recomputation** — _shipped v1.8.0._ Reads stated % from prior 1096 row's ITEMDESC, recomputes against new base, retro for delta. HST/VAT updated to use post-discount net.

3. **Producing-facility routing for AH retros** — when an AH retro is for an agreement where `additionalHourResponsibility = 'Producing Facility'`, the retro should bill to the producing facility's C-code, not the parent. Currently emits under the agreement's `customerCode`/`accountNumber`. Workaround: use Skip + manual reroute via Month-End workflow.

4. **SharePoint upload for the augmented pre-bill** — Phase 2 deferred this. Spec says the SharePoint location should default to `Pre-Invoices/{YYYY}/{MM Month}/`. The button is wired but currently shows an alert.

5. **Confluence updates** — once the recon flow ships fully, the end-of-period AH/WP recap is dead. Confluence pages 694386707 and 1627095047 need updating to reflect the new flow. Not a code task.

### Bug-watch / things to verify after each Lucas run

- **MEMO column on retro rows** (fixed v1.7.6 with case-insensitive lookup — verify on next run)
- **Auto-Matched count** — should be a healthy number (a few hundred). If suspiciously low while billed cells are high, DB_PRIOR didn't load enough data.
- **n8n Query 5 priceType filter** — confirmed `OR a.priceType IS NULL` was added by Lucas on 2026-04-30. If new "Reference RXXX found in MEMO but not in DB_PRIOR" diagnostics appear with NEWER agreement numbers, may need to check the filter again or look at expireTime cutoffs.

---

## Key decisions (irreversible without revisiting)

| Decision | When | Why |
|---|---|---|
| Calendar-month rule for `computeBillingCycle()` (cycle = current calendar month's last Sunday, regardless of whether today > last Sunday) | v1.4.0 | Spec rule text contradicted spec verify example. Verify example matched team's actual workflow (accountants finish cycle in days after Sunday but before next month begins). Implemented to match the example. |
| Squash-merge for all PRs | ongoing | Clean per-feature commit on main; simple `git revert <sha>` for any rollback. Documented in `docs/ROLLBACK.md`. |
| Pre-bill customers = customers in prior pre-bill file (not from DB) | v1.7.1 | Spec section 3.1 explicit. Iterating union of billed + expected generated phantom retros for every priced agreement. |
| Currency-neutral KPIs in Step 3 | v1.7.5 | Mixed-currency $ totals were nonsense. Counts (rows added / removed / matched) are immediately useful. |
| Auto-Matched as completeness signal | v1.7.5 | Lucas asked "how do I know nothing else changed?" — counter shows how many (cust × SA × type) cells were checked but balanced. |
| Phasing the recon feature into v1.5/1.6/1.7 | 2026-04-28 | Spec explicitly suggested phased delivery. Each phase independently shippable. |
| Auto-approve test-account blocks (`approved: true` instead of `null`) | v1.4.0 | Hard rule, not a judgment call. Removes friction. |

---

## n8n workflow notes

**Workflow:** `billing-processor-db` (id `AJwkePsQAFTHSNKF`) on `https://teamqs.app.n8n.cloud`
**Webhook:** `https://teamqs.app.n8n.cloud/webhook/billing-processor-db?pStart=YYYY-MM-DD&pEnd=YYYY-MM-DD`

Returns:
- `shutdowns` — plant shutdowns active in period
- `marelliSuppressedSageCodes` — Marelli SAs with Flat Rate $0
- `pricedAgreements` — Flat Rate + Monthly Pricing
- `contractedAgreements` — Contracted Units (Legacy or NULL priceType)
- `weekendProduction` — WP rows in period
- `additionalHours` — approved AH rows in period (filtered by `approvedTime`)
- `invoiceSettings` — `accountNumber → 'Normal' | 'Days The Plant Is Open'`

The actual SQL strings live in the **build queries** Code node (output goes to a downstream Execute Query node via `{{ $json.sql }}`). Each query is a `sql*` field on the output JSON.

**Query 5 (contractedAgreements) WHERE clause** (verified live as of 2026-04-30):
```sql
WHERE (a.deleted IS NULL OR a.deleted = 0)
  AND (a.priceType = 'Legacy (Contracted Units)' OR a.priceType IS NULL)
  AND a.rate > 0
  AND l.sageLocationCode IS NOT NULL
  AND (a.expireTime IS NULL OR a.expireTime >= '${pStart}')
  AND a.startTime <= '${pEnd}'
```

Not yet on the n8n side: `agreementProducingFacilities` payload field for auto-suggesting AH-routing C-codes. Without it, the input on the Month-End tab is blank and the user types it in (full functionality, no auto-fill).

---

## Tested data points

| Date | Period | Test type | Outcome |
|---|---|---|---|
| 2026-04-30 | March/April recon | First real-data recon run | ~600 phantom retros (false positives). Root cause: priceType filter in n8n Q5 missing `OR IS NULL`. Fixed. |
| 2026-04-30 | March/April recon | Re-run after n8n fix | 22 CU retros, 3 AH retros, 1 WP retro. Lucas requested per-row detail + count-based KPIs + auto-matched signal — shipped as v1.7.5. |
| 2026-04-30 | March/April recon | Step 4 download | Empty MEMO on retro rows reported. Root cause: case-sensitive column lookup. Fixed in v1.7.6 (this commit). |

---

## How to use this log

**At session start:**
- Tell Claude: *"Read `docs/PROJECT_LOG.md`, `docs/ROLLBACK.md`, and `CLAUDE.md` to catch up."*

**At session end (or after each meaningful change):**
- Have Claude append to this log: latest version row, any new open items, any decisions worth preserving, and a row in the test-data table if a real-data run produced new findings.

**When something breaks:**
- Note the symptom under "Active work / open items" → bug-watch.
- Once root cause is found, move it to "Tested data points" with the resolution.
