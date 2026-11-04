/**
 * test_project_inventory.js — The Projects tab's numbers are checkable.
 *
 * The inventory makes claims on screen (how complete it is, how many projects
 * per year, what is wrong with the data). This test checks those claims against
 * the data itself:
 *   • the field list and the column order are the tracker workbook's own,
 *   • every row carries exactly as many values as the guide has fields, so a
 *     column can never be silently shifted in the table or the workbook,
 *   • the completeness figure does not count a dash as a recorded value,
 *   • every double-check finding names rows that really exist, and a finding
 *     claimed as "high" is never empty,
 *   • the analytics are a plain tally of the rows.
 *
 * The data is transcribed from
 * SmallWorld_Project_Inventory_and_Progress_Tracker.xlsx, sheet "Project
 * Inventory". This test is the guard that the app still sticks to those fields.
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

/* The tracker workbook's own field order: its 16-row "Field Guide" sheet plus
   the "Duration of project" column of the "Project Inventory" sheet. */
const WORKBOOK_FIELDS = [
    'Project ID', 'Year', 'Project name', 'Country', 'Location',
    'Beneficiary organization Name', 'Institution type', 'Brief description',
    'Support category', 'Beneficiaries', 'Donation in pounds', 'Delivery date',
    'Project status', 'Available documentation', 'File location',
    'Missing information', 'Duration of project'
];

console.log('\n════════ PROJECT INVENTORY ════════\n');

/* ── 1. Shape of the data ── */
console.log('1) Every row matches the field guide exactly');
{
    check('the fields are the tracker workbook\'s 17 columns, in its order',
        JSON.stringify(FIELDS.slice(0, WORKBOOK_FIELDS.length).map(f => f.field)) === JSON.stringify(WORKBOOK_FIELDS),
        FIELDS.map(f => f.field).join(' | '));
    check('the two classification columns follow the workbook columns',
        FIELDS.slice(WORKBOOK_FIELDS.length).map(f => f.field).join('|') ===
        'Beneficiary / Institution Type|Tangible / Non-Tangible',
        FIELDS.slice(WORKBOOK_FIELDS.length).map(f => f.field).join(' | '));
    check('the Duration of project column is present', FIELDS.some(f => f.key === 'duration'));
    check('the inventory has the workbook\'s 18 project rows', rows.length === 18, String(rows.length));
    const bad = rows.filter(r => FIELDS.some(f => r.values[f.key] == null));
    check('every row has a value (possibly "—") for every field', bad.length === 0,
        bad.slice(0, 3).map(r => r.values.id).join(','));
    const arrays = inv.PROJECTS;
    const wrongLength = arrays.filter(a => a.length !== WORKBOOK_FIELDS.length);
    check('every sourced row array is exactly 17 long', wrongLength.length === 0,
        wrongLength.length + ' rows off, e.g. ' + JSON.stringify((wrongLength[0] || []).slice(0, 2)));
    check('the workbook sheet is named', inv.sheetName === 'Project Inventory');
    const dupes = {};
    rows.forEach(r => { dupes[r.values.id] = (dupes[r.values.id] || 0) + 1; });
    const dupeIds = Object.keys(dupes).filter(k => dupes[k] > 1);
    check('no two rows share a Project ID', dupeIds.length === 0, dupeIds.join(','));
    // Client ID: CC + a 2-digit number + the last two digits of the year (UK0126).
    const ID_RE = /^[A-Z]{2}\d{4}$/;
    const badIds = rows.filter(r => !ID_RE.test(r.values.id));
    check('every Project ID follows the CC + NN + YY client-ID format', badIds.length === 0,
        badIds.slice(0, 3).map(r => r.values.id).join(','));
    check("IDs use the row's country code and its first year", rows.every(r => {
        const m = String(r.values.year).match(/(\d{4})/);
        const country = String(r.values.country || '').trim();
        const code = country === '—' || country === '' ? 'XX' : inv.countryCodeFor(country);
        const id = String(r.values.id);
        return id.slice(0, 2) === code && (!m || id.slice(-2) === m[1].slice(-2));
    }), rows.filter(r => {
        const m = String(r.values.year).match(/(\d{4})/);
        const country = String(r.values.country || '').trim();
        const code = country === '—' || country === '' ? 'XX' : inv.countryCodeFor(country);
        const id = String(r.values.id);
        return !(id.slice(0, 2) === code && (!m || id.slice(-2) === m[1].slice(-2)));
    }).map(r => r.values.id + ' / ' + r.values.country + ' / ' + r.values.year).join(','));
    check('the number restarts per country-year and runs 01, 02, 03…', (() => {
        const counters = {};
        return rows.every(r => {
            const m = String(r.values.year).match(/(\d{4})/);
            if (!m) return true;
            const id = String(r.values.id);
            const key = id.slice(0, 2) + m[1];
            counters[key] = (counters[key] || 0) + 1;
            return id.slice(2, 4) === String(counters[key]).padStart(2, '0');
        });
    })(), rows.map(r => r.values.id).join(','));
    check('a blank country is coded XX, never an invented country', rows.every(r => {
        const country = String(r.values.country || '').trim();
        return country === '—' || country === '' ? r.values.id.indexOf('XX') === 0 : r.values.id.indexOf('XX') !== 0;
    }), rows.map(r => r.values.id + ' / ' + r.values.country).join(' | '));
    check('the dropdown carries the programme countries', [
        'United Kingdom', 'United States', 'Ukraine', 'Italy', 'Spain', 'Turkey', 'Armenia',
        'Japan', 'Morocco', 'Egypt', 'India', 'Bangladesh', 'Thailand', 'China', 'Philippines',
        'Puerto Rico', 'Mexico', 'Panama', 'Colombia', 'Brazil', 'Nigeria', 'Ethiopia',
        'Malaysia', 'Indonesia', 'Australia'
    ].every(c => inv.COUNTRY_OPTIONS.indexOf(c) !== -1), inv.COUNTRY_OPTIONS.join(','));
    check('a recorded country that is not on the list is still offered',
        inv.countryChoices().indexOf('Abu Dhabi') !== -1, inv.countryChoices().join(','));
    check('a generated ID takes the next free number for the country and year',
        inv.nextClientId('United Kingdom', '2025') === 'UK0425' && inv.nextClientId('—', '2021') === 'XX0921',
        inv.nextClientId('United Kingdom', '2025') + ' / ' + inv.nextClientId('—', '2021'));
}

/* ── 2. Completeness is measured honestly ── */
console.log('2) The completeness figure counts dashes as empty');
{
    check('cells = rows × data fields (the notes column is excluded)',
        stats.cells === stats.total * (WORKBOOK_FIELDS.length - 1),
        stats.cells + ' vs ' + (stats.total * (WORKBOOK_FIELDS.length - 1)));
    check('the notes column really is excluded', FIELDS.filter(f => f.key === 'missing').length === 1 &&
        stats.cells < stats.total * FIELDS.length);
    check('filled is never more than cells', stats.filled <= stats.cells);
    check('documented matches filled/cells', stats.documented === Math.round((stats.filled / stats.cells) * 100),
        stats.documented + '% vs ' + stats.filled + '/' + stats.cells);
    check('a dash is NOT counted as filled',
        rows.every(r => !/^—$/.test(String(r.values.deliveryDate))) ||
        stats.withDate < stats.total,
        'withDate=' + stats.withDate);
    check('exactly the rows with a real amount are counted',
        stats.withAmount === rows.filter(r => /[£$€]|\b\d/.test(String(r.values.donation)) && !/^—/.test(String(r.values.donation).trim())).length,
        String(stats.withAmount));
    check('the year range covers the workbook\'s recorded years', stats.range === '2011–2027', stats.range);
    check('every year-filter option matches at least one row',
        stats.yearList.every(y => rows.some(r => String(r.values.year).indexOf(String(y)) === 0 ||
            new RegExp('(^|\\D)' + y + '(\\D|$)').test(String(r.values.year)))),
        stats.yearList.join(','));
    check('the workbook leaves Missing information blank, and the app says so',
        stats.gaps === 0 && rows.every(r => String(r.values.missing).trim() === '—'),
        'gaps=' + stats.gaps);
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
    check('year spans are flagged', !!byKey('year-range') && byKey('year-range').ids.length >= 8,
        byKey('year-range') ? String(byKey('year-range').ids.length) : 'missing');
    check('the repeated project names in the same year are caught',
        !!byKey('dup-name') && byKey('dup-name').ids.length === 4,
        byKey('dup-name') ? byKey('dup-name').ids.join(',') : 'missing');
    check('rows with no file location are flagged as HIGH',
        !!byKey('no-source') && byKey('no-source').severity === 'high' && byKey('no-source').ids.length === 12,
        byKey('no-source') ? String(byKey('no-source').ids.length) : 'missing');
    check('no-date is a coverage note, not an error', byKey('no-date') && byKey('no-date').severity === 'info');
    check('no-amount is a coverage note, not an error',
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
    check('"Completed" in the workbook counts as Delivered', analytics.byStatus.some(e => e.key === 'Delivered' && e.value >= 3));
    check('"Under procsseding" counts as In progress', analytics.byStatus.some(e => e.key === 'In progress' && e.value === 1));
    check('completeness covers all 17 fields', analytics.completeness.length === 17);
    check('a field marked 100% documented really is in every row',
        analytics.completeness.every(c => {
            if (c.percent !== 100) return true;
            return rows.every(r => String(r.values[c.key] || '').trim() !== '' && String(r.values[c.key]).trim() !== '—');
        }));
}

/* ── 5. The export builder is real ── */
console.log('5) The workbook is built from the same rows the table shows');
{
    const arrays = rows.map(r => FIELDS.map(f => r.values[f.key] || ''));
    const bytes = inv.buildXlsx(FIELDS, arrays, inv.sheetName);
    const head = Buffer.from(bytes.slice(0, 2)).toString('latin1');
    check('the file is a zip (xlsx) container', head === 'PK', head);
    check('the file is not empty', bytes.length > 2000, String(bytes.length));
    const text = Buffer.from(bytes).toString('latin1');
    check('it contains the sheet and shared parts', /xl\/worksheets\/sheet1\.xml/.test(text) && /\[Content_Types\]\.xml/.test(text));
    check('the header row names the workbook fields',
        text.indexOf('Project ID') !== -1 && text.indexOf('Missing information') !== -1 &&
        text.indexOf('Duration of project') !== -1);
}

/* ── 6. Attachments are typed, bounded and honest ── */
console.log('6) Attachments have the agreed types and an honest size limit');
{
    const types = inv.ATTACHMENT_TYPES;
    check('attachments are divided into named types', Array.isArray(types) && types.length >= 6,
        String(types && types.length));
    const labels = types.map(t => t.label).join(' | ');
    ['Agreement', 'Testimon', 'Thank-you', 'Video'].forEach(word =>
        check('type list includes "' + word + '"', labels.indexOf(word) !== -1, labels));
    check('every type has a unique key', new Set(types.map(t => t.key)).size === types.length);
    check('every type has an icon', types.every(t => !!t.icon));
    check('small files are copied at 1 MB or below', inv.ATTACH_EMBED_LIMIT === 1024 * 1024,
        String(inv.ATTACH_EMBED_LIMIT));
    check('rows start with an (empty) attachment list', inv.attachmentsFor('UK0125').length === 0);
    check('the attachment accessor is exposed for checking', typeof inv.attachmentsFor === 'function');
}

/* ── 7. Columns can be added, hidden and deleted ── */
console.log('7) Columns: add, hide, delete, restore');
{
    const WORKBOOK_KEYS = inv.FIELDS.slice(0, 17).map(f => f.key);
    check('the 17 workbook columns are visible by default', inv.columns().visible.length === 19,
        String(inv.columns().visible.length));

    // Two classification columns ship with the tracker (see TRACKER_COLUMNS).
    const TRACKER = ['beneficiary_kind', 'tangibility'];
    const baseCustom = inv.columns().custom.length;
    check('the two classification columns are part of the tracker',
        TRACKER.every(k => inv.columns().custom.some(c => c.key === k && c.locked)),
        inv.columns().custom.map(c => c.field + (c.locked ? ' (locked)' : '')).join(' | '));
    check('Beneficiary / Institution Type offers the requested kinds',
        inv.cellOptions('beneficiary_kind').join('|') ===
        'Physical institution|Programme|Initiative|Individual|Group|Community',
        inv.cellOptions('beneficiary_kind').join(' | '));
    check('Tangible / Non-Tangible offers exactly those two values',
        inv.cellOptions('tangibility').join('|') === 'Tangible|Non-Tangible',
        inv.cellOptions('tangibility').join(' | '));
    check('a tracker column cannot be deleted',
        /part of the tracker/.test(inv.deleteColumn('beneficiary_kind')), inv.deleteColumn('beneficiary_kind'));
    check('a tracker column can be hidden and shown again',
        inv.setColumnVisible('tangibility', false) === '' &&
        inv.columns().visible.indexOf('tangibility') === -1 &&
        inv.setColumnVisible('tangibility', true) === '' &&
        inv.columns().visible.indexOf('tangibility') !== -1);

    const err = inv.addColumn({ field: 'Contact person', type: 'text' });
    check('a text column can be added', err === '' && inv.columns().custom.length === baseCustom + 1, err);
    const added = inv.columns().custom[inv.columns().custom.length - 1];
    check('the added column is a real column, last in the table',
        inv.FIELDS.length === baseCustom + 18 && inv.FIELDS[inv.FIELDS.length - 1].field === 'Contact person',
        inv.FIELDS.map(f => f.field).join(' | '));
    check('the workbook columns keep their order',
        inv.FIELDS.slice(0, 17).map(f => f.key).join(',') === WORKBOOK_KEYS.join(','));
    check('every row has a slot for the new column',
        inv.rows().every(r => r.values[added.key] == null || r.values[added.key] === ''));

    check('a column name that already exists is refused',
        /already exists/.test(inv.addColumn({ field: 'contact person' })),
        inv.addColumn({ field: 'contact person' }));

    const err3 = inv.addColumn({ field: 'Payment check', type: 'select', options: ['Paid', 'Not paid'] });
    const dropdown = inv.columns().custom.filter(c => c.field === 'Payment check')[0];
    check('a dropdown column keeps its options', err3 === '' && dropdown && dropdown.options.join(',') === 'Paid,Not paid',
        err3);
    check('a dropdown column without options is refused',
        /at least one option/.test(inv.addColumn({ field: 'Empty dropdown', type: 'select', options: [] })));

    inv.setColumnVisible('location', false);
    check('a workbook column can be hidden', inv.columns().visible.indexOf('location') === -1);
    check('hiding a column keeps its recorded values',
        inv.rows().every(r => r.values.location != null));
    check('a hidden column is not in the table',
        inv.FIELDS.every(f => f.key !== 'location'));
    inv.setColumnVisible('location', true);
    check('it can be shown again', inv.columns().visible.indexOf('location') !== -1);

    const statusOptions = inv.cellOptions('status');
    check('a known-value column offers a dropdown of recorded values',
        statusOptions.length > 0 && statusOptions.indexOf('Completed') !== -1, statusOptions.join(' | '));
    check('the dropdown column offers exactly its own options',
        inv.cellOptions(dropdown.key).join(',') === 'Paid,Not paid');
    check('a free-text column is not forced into a list',
        inv.cellOptions('duration').length === 0, inv.cellOptions('duration').join(' | '));

    check('a workbook column cannot be deleted',
        /hidden, not removed/.test(inv.deleteColumn('id')));
    check('an added column can be deleted', inv.deleteColumn(added.key) === '' &&
        !inv.columns().custom.some(c => c.key === added.key));
    check('the deleted column leaves the table', inv.FIELDS.every(f => f.key !== added.key));

    inv.showAllColumns();
    inv.deleteColumn(dropdown.key);
    check('all workbook columns are back and no test column is left',
        inv.columns().visible.length === baseCustom + 17 && inv.columns().custom.length === baseCustom,
        inv.columns().visible.length + ' visible · ' + inv.columns().custom.length + ' custom');
}

console.log('\n─────────────────────────────────────────');
if (failures === 0) {
    console.log('✅ PROJECT INVENTORY — ' + checks + '/' + checks + ' checks passed');
    process.exit(0);
}
console.error('❌ ' + failures + ' of ' + checks + ' checks failed');
process.exit(1);
