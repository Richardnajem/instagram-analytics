/**
 * test_project_inventory.js — The Projects tab's numbers are checkable.
 *
 * The inventory makes claims on screen (how complete it is, how many projects
 * per year, what is wrong with the data). This test checks those claims against
 * the data itself:
 *   • every row carries exactly as many values as the guide has fields, so a
 *     column can never be silently shifted in the table or the workbook,
 *   • the field guide IS the workbook's column order (they come from one place),
 *   • the completeness figure does not count a dash — or a dash with a note —
 *     as a recorded value,
 *   • every double-check finding names rows that really exist, and a finding
 *     claimed as "high" is never empty,
 *   • the analytics are a plain tally of the rows.
 *
 * Usage: node test_project_inventory.js
 */
'use strict';

const inv = require('./project-inventory.js');

let failures = 0;
let checks = 0;
function check(name, cond, detail) {
    checks++;
    if (cond) console.log('  ✅ ' + name);
    else { failures++; console.error('  ❌ ' + name + (detail ? ' — ' + detail : '')); }
}

const FIELDS = inv.FIELDS;
const rows = inv.rows();
const stats = inv.stats();
const analytics = inv.analytics();
const findings = inv.audit();

console.log('\n════════ PROJECT INVENTORY ════════\n');

/* ── 1. Shape of the data ── */
console.log('1) Every row matches the field guide exactly');
{
    check('the guide has the 16 agreed fields', FIELDS.length === 16, String(FIELDS.length));
    const bad = rows.filter(r => FIELDS.some(f => r.values[f.key] == null));
    check('every row has a value (possibly "—") for every field', bad.length === 0,
        bad.slice(0, 3).map(r => r.values.id).join(','));
    const arrays = inv.PROJECTS;
    const wrongLength = arrays.filter(a => a.length !== FIELDS.length);
    check('every sourced row array is exactly 16 long', wrongLength.length === 0,
        wrongLength.length + ' rows off, e.g. ' + JSON.stringify((wrongLength[0] || []).slice(0, 2)));
    check('the workbook sheet is named', inv.sheetName === 'Project Inventory');
    const dupes = {};
    rows.forEach(r => { dupes[r.values.id] = (dupes[r.values.id] || 0) + 1; });
    const dupeIds = Object.keys(dupes).filter(k => dupes[k] > 1);
    check('no two rows share a Project ID', dupeIds.length === 0, dupeIds.join(','));
    const badIds = rows.filter(r => !/^SW-[A-Za-z0-9-]+$/.test(r.values.id));
    check('every Project ID follows the SW-… pattern', badIds.length === 0,
        badIds.slice(0, 3).map(r => r.values.id).join(','));
}

/* ── 2. Completeness is measured honestly ── */
console.log('2) The completeness figure counts dashes as empty');
{
    // The notes column is filled on every row by design, so the completeness
    // figure counts the 15 data fields only — including it would flatter the
    // number without recording anything new.
    check('cells = rows × data fields (the notes column is excluded)',
        stats.cells === stats.total * (FIELDS.length - 1),
        stats.cells + ' vs ' + (stats.total * (FIELDS.length - 1)));
    check('the notes column really is excluded', FIELDS.filter(f => f.key === 'missing').length === 1 &&
        stats.cells < stats.total * FIELDS.length);
    check('filled is never more than cells', stats.filled <= stats.cells);
    check('documented matches filled/cells', stats.documented === Math.round((stats.filled / stats.cells) * 100),
        stats.documented + '% vs ' + stats.filled + '/' + stats.cells);
    check('a dash with a note ("— (not published)") is NOT counted as filled',
        inv.rows().some(r => /^—\s*\(/.test(String(r.values.donation))) && stats.withAmount < stats.total,
        'withAmount=' + stats.withAmount);
    check('exactly the rows with a real amount are counted',
        stats.withAmount === rows.filter(r => /[£$€]|\b\d/.test(String(r.values.donation)) && !/^—/.test(String(r.values.donation).trim())).length,
        String(stats.withAmount));
    check('the year range is the real span of the sources', stats.range === '2011–2026', stats.range);
    check('every row still asks for something more', stats.gaps === stats.total, String(stats.gaps));
}

/* ── 3. The double-check findings are real ── */
console.log('3) Every double-check finding points at real rows');
{
    const ids = {};
    rows.forEach(r => { ids[r.values.id] = true; });
    check('there is at least one finding', findings.length > 0);
    const unknown = findings.filter(f => f.ids && f.ids.some(id => !ids[id]));
    check('no finding references a row that does not exist', unknown.length === 0,
        unknown.map(f => f.title).join(' | '));
    const empty = findings.filter(f => f.severity !== 'info' && (!f.ids || f.ids.length === 0));
    check('a concrete finding is never empty of rows', empty.length === 0, empty.map(f => f.title).join(' | '));
    check('every finding has a description of what to check', findings.every(f => (f.detail || '').length > 40));

    const byKey = k => findings.filter(f => f.key === k)[0];
    check('the repeated-description check finds the known double-report',
        !!byKey('repeat-verdict') && byKey('repeat-verdict').ids.length >= 2,
        byKey('repeat-verdict') ? byKey('repeat-verdict').ids.join(',') : 'missing');
    check('the same description under two years is a HIGH severity finding',
        byKey('repeat-verdict') && byKey('repeat-verdict').severity === 'high');
    check('year ranges are flagged', !!byKey('year-range') && byKey('year-range').ids.length >= 7,
        byKey('year-range') ? String(byKey('year-range').ids.length) : 'missing');
    check('a region/pair used as a country is flagged', !!byKey('country-composite'));
    check('abbreviated country names are flagged', !!byKey('country-abbrev') && byKey('country-abbrev').ids.length > 10);
    check('the missing organisation is caught', !!byKey('org-missing'));
    check('no-amount is reported as a coverage note, not an error',
        byKey('no-amount') && byKey('no-amount').severity === 'info');
    check('findings are ordered most serious first',
        findings.map(f => ({ high: 0, medium: 1, low: 2, info: 3 })[f.severity]).every((v, i, a) => i === 0 || a[i - 1] <= v));

    // The word "fund" alone is not evidence of an amount.
    const money = byKey('amount-missing');
    if (money) {
        const offenders = money.ids.map(id => rows.filter(r => r.values.id === id)[0]);
        check('the money-mention check only flags explicit cost/currency wording',
            offenders.every(r => /£\s?[0-9]|\$\s?[0-9]|[0-9]+\s?(pounds|dollars|USD|GBP|euros)|\b(budget|cost|costs|amount of)\b/i.test(r.values.description)),
            offenders.map(r => r.values.id + ': ' + String(r.values.description).slice(0, 60)).join(' || '));
    } else {
        check('the money-mention check only flags explicit cost/currency wording', true);
    }
}

/* ── 4. The analytics are a plain tally ── */
console.log('4) Analytics add up to the rows they came from');
{
    const yearTotal = analytics.byYear.reduce((n, e) => n + e.count, 0);
    const rowsWithYear = rows.filter(r => /[0-9]{4}/.test(String(r.values.year))).length;
    check('every row with a year is in the year chart', yearTotal === rowsWithYear, yearTotal + ' vs ' + rowsWithYear);
    check('the year chart is in date order',
        analytics.byYear.every((e, i, a) => i === 0 || a[i - 1].year <= e.year));
    const countryTotal = analytics.byCountry.reduce((n, e) => n + e.value, 0);
    check('the country chart never exceeds the row count', countryTotal <= rows.length);
    const statusTotal = analytics.byStatus.reduce((n, e) => n + e.value, 0);
    check('every row lands in exactly one status group', statusTotal === rows.length, statusTotal + ' vs ' + rows.length);
    check('statuses are grouped, not invented',
        analytics.byStatus.every(e => ['Delivered', 'In progress', 'Planned', 'Closed', 'Other', 'Unknown'].indexOf(e.key) !== -1),
        analytics.byStatus.map(e => e.key).join(','));
    check('completeness covers all 16 fields', analytics.completeness.length === 16);
    check('a field marked 100% documented really is in every row',
        analytics.completeness.every(c => {
            if (c.percent !== 100) return true;
            return rows.every(r => String(r.values[c.key] || '').trim() !== '' && String(r.values[c.key]).trim() !== '—');
        }));
}

/* ── 5. The export builder is real ── */
console.log('5) The workbook is built from the same rows the table shows');
{
    const bytes = inv.buildXlsx(FIELDS, rows.map(r => FIELDS.map(f => r.values[f.key] || '')), inv.sheetName);
    const head = Buffer.from(bytes.slice(0, 2)).toString('latin1');
    check('the file is a zip (xlsx) container', head === 'PK', head);
    check('the file is not empty', bytes.length > 20000, String(bytes.length));
    const text = Buffer.from(bytes).toString('latin1');
    check('it contains the sheet and shared parts', /xl\/worksheets\/sheet1\.xml/.test(text) && /\[Content_Types\]\.xml/.test(text));
    check('the header row names the guide fields',
        text.indexOf('Project ID') !== -1 && text.indexOf('Missing information') !== -1);
}

console.log('\n─────────────────────────────────────────');
if (failures === 0) {
    console.log('✅ PROJECT INVENTORY — ' + checks + '/' + checks + ' checks passed');
    process.exit(0);
}
console.error('❌ ' + failures + ' of ' + checks + ' checks failed');
process.exit(1);
