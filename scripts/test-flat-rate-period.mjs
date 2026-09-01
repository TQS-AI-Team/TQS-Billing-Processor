// Flat Rate / Monthly Pricing (Item D) billing-period tests.
//
// Rule under test — Confluence "Automated Representation Billing Processes by
// Agreement Price Type" (Finance & Accounting Playbook, v7):
//   "Monthly and flat rate billing reports cover the full calendar month, from
//    the 1st through the last day of the month. Other billing/report types
//    either use a single week or follow the TQS billing calendar."
//   "For every full week shutdown, Monday - Friday, there is a 20% of the
//    monthly rate credit applied."
//   "If every week of the billing period is shutdown, there is a 100% credit."
//
// Run: node scripts/test-flat-rate-period.mjs
import { loadHelpers } from './extract-fns.mjs';

const H = loadHelpers({
  consts: ['r2','cdDay','cdAdd','cdISO','MONTH_NAMES'],
  functions: [
    'cd',
    'lastSundayOfMonth',
    'computeBillingCycle',
    'flatRateBillingMonth',
    'countFullShutdownWeeks',
    'countWeekdays',
    'calcFlatRateCredit',
  ],
});

let failures = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if(!ok) failures++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}\n         got ${JSON.stringify(got)}  want ${JSON.stringify(want)}`);
};

// The August 2026 cycle Lucas ran: Mon after the last Sun of July (2026-07-27)
// through the last Sun of August (2026-08-30).
const cycle = H.computeBillingCycle(new Date(2026, 7, 31));
console.log('\nTQS billing cycle for August 2026 (contracted units):');
eq('cycle start', cycle.cycleStart, '2026-07-27');
eq('cycle end', cycle.cycleEnd, '2026-08-30');

console.log('\nFlat Rate / Monthly Pricing window = the calendar month:');
const aug = H.flatRateBillingMonth(cycle.cycleStart, cycle.cycleEnd);
eq('month start', aug.start, '2026-08-01');
eq('month end', aug.end, '2026-08-31');
eq('month label', aug.label, 'August 2026');
eq('weekdays in August 2026', aug.weekdays, 21);

// Regression: the reported defect. "Hall 50 Shut down" ran Mon 2026-07-27 to
// Sun 2026-08-02 — a July shutdown week. It sits inside the August CU cycle,
// so scoping Item D to the cycle credited it against August's flat rate.
const hall50 = [{ startTime: '2026-07-27', endTime: '2026-08-02' }];

console.log('\n"Hall 50 Shut down" 2026-07-27 -> 2026-08-02 (a JULY week):');
eq('counted against the CU cycle (the old, wrong window)',
   H.countFullShutdownWeeks(hall50, cycle.cycleStart, cycle.cycleEnd), 1);
eq('counted against calendar August (the fix) -> no credit',
   H.countFullShutdownWeeks(hall50, aug.start, aug.end), 0);

// It must still be credited on JULY's invoice — the fix moves the credit, it
// does not delete it.
const jul = H.flatRateBillingMonth('2026-06-29', '2026-07-26');
eq('July window start', jul.start, '2026-07-01');
eq('July window end', jul.end, '2026-07-31');
eq('the same shutdown IS a full week of July', H.countFullShutdownWeeks(hall50, jul.start, jul.end), 1);
eq('20% of $3800 for that one July week', H.calcFlatRateCredit(3800, 'Monthly', 1), 760);

// A genuine August shutdown week still counts.
console.log('\nA real August shutdown week still credits:');
eq('Mon 2026-08-10 -> Sun 2026-08-16 inside August',
   H.countFullShutdownWeeks([{ startTime: '2026-08-10', endTime: '2026-08-16' }], aug.start, aug.end), 1);
eq('a partial week (Mon-Wed) credits nothing',
   H.countFullShutdownWeeks([{ startTime: '2026-08-10', endTime: '2026-08-12' }], aug.start, aug.end), 0);

// The 100% rule counts the calendar month's full Mon-Fri weeks, not the cycle's.
console.log('\n"every week of the billing period is shutdown" -> 100%:');
eq('full Mon-Fri weeks in calendar August 2026',
   H.countFullShutdownWeeks([{ startTime: aug.start, endTime: aug.end }], aug.start, aug.end), 4);
eq('full Mon-Fri weeks in the August CU cycle (the old, wrong denominator)',
   H.countFullShutdownWeeks([{ startTime: cycle.cycleStart, endTime: cycle.cycleEnd }], cycle.cycleStart, cycle.cycleEnd), 5);

// Boundary weeks must land in exactly one month, in every browser timezone.
// 2026-09-01 is a Tuesday, so the week Mon 2026-08-31 -> Fri 2026-09-04
// straddles the boundary and belongs to August.
console.log('\nMonth-boundary week Mon 2026-08-31 -> Fri 2026-09-04 (Sep 1 is a Tuesday):');
const sep = H.flatRateBillingMonth('2026-08-31', '2026-09-27');
const straddle = [{ startTime: '2026-08-31', endTime: '2026-09-06' }];
// Containment is the pre-existing rule (mon >= periodStart && fri <= periodEnd)
// and this change does not alter it: a week split across two months is fully
// inside neither, so it credits in neither. Flagged for Finance to confirm.
eq('does NOT count for September', H.countFullShutdownWeeks(straddle, sep.start, sep.end), 0);
eq('does NOT count for August either (week is not contained in one month)',
   H.countFullShutdownWeeks(straddle, aug.start, aug.end), 0);

// A week whose Friday is the last day of the month must not be dropped.
// 2026-07-31 is a Friday, so Mon 2026-07-27 -> Fri 2026-07-31 ends exactly on
// the month end.
eq('week ending exactly on the month end counts',
   H.countFullShutdownWeeks(hall50, '2026-07-01', '2026-07-31'), 1);

console.log('\nWeekday counts (calendar dates, not browser-local instants):');
eq('weekdays 2026-08-01..2026-08-31', H.countWeekdays('2026-08-01', '2026-08-31'), 21);
eq('weekdays 2026-02-01..2026-02-28', H.countWeekdays('2026-02-01', '2026-02-28'), 20);
eq('weekdays 2026-08-03..2026-08-07', H.countWeekdays('2026-08-03', '2026-08-07'), 5);

console.log(`\n${failures ? `${failures} FAILING` : 'all passing'} · TZ=${process.env.TZ || '(system)'}\n`);
process.exit(failures ? 1 : 0);
