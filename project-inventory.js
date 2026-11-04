/* ═══════════════════════════════════════════════════════════════════════════
   project-inventory.js — SmallWorld project inventory (Projects tab)

   What this module is for
   ----------------------
   Turns the fields of SmallWorld_Project_Inventory_and_Progress_Tracker.xlsx
   into a working inventory: the guide is rendered as a two-column table
   (Field / What to record in each field) and the same fields become the columns
   of the inventory, one row per project. The inventory can be exported as a real
   .xlsx workbook.

   Data-honesty rules (see AGENTS.md §"Data-honesty rules")
   -------------------------------------------------------
   1. Nothing is invented. Every value is either recorded in the workbook or
      shown as "—". A blank workbook cell stays blank, it is not given a
      plausible value.
   2. The field list and the column order are the workbook's own, so the tab,
      the export and the tracker cannot drift apart.
   3. The workbook is the source of truth here. The old website-, Instagram- and
      photo-archive-derived rows were deleted rather than mixed with it.

   Runtime notes
   -------------
   - Loaded with a plain <script> tag after ui.js (no bundler in this project),
     and also requireable from Node by generate-project-inventory.js so the
     exported workbook and the tab cannot drift apart.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    /* ── The field guide ──────────────────────────────────────────────────
       The fields of SmallWorld_Project_Inventory_and_Progress_Tracker.xlsx, in
       the workbook's own order: the 16 rows of its “Field Guide” sheet, plus
       the “Duration of project” column the “Project Inventory” sheet records
       as its 17th column. Order matters: it is the column order in the table
       and in the exported workbook. */
    var BUILTIN_FIELDS = [
        { key: 'id',          field: 'Project ID',              what: 'A unique reference for identification, tracking and cross-referencing. Format: two-letter country code, a 2-digit number for the project’s place in that country for the year (01, 02, 03, 04…), then the last two digits of the year — e.g. UK0126. XX means the country is not recorded.' },
        { key: 'year',        field: 'Year',                    what: 'The year the project was initiated or delivered, used to organise the records.' },
        { key: 'name',        field: 'Project name',            what: 'The official project title, for identification and reporting. If none exists, use a descriptive title.' },
        { key: 'country',     field: 'Country',                 what: 'The country supported by the project (its own column).' },
        { key: 'location',    field: 'Location',                what: 'The city, town, state or specific area where the project was implemented (its own column).' },
        { key: 'org',         field: 'Beneficiary organization Name', what: 'The partner organisation, school, institution or entity receiving the support.' },
        { key: 'instType',    field: 'Institution type',        what: 'The classification of the beneficiary: school, charity, NGO, community organisation, or another institution.' },
        { key: 'description', field: 'Brief description',       what: 'A concise overview of the project’s objectives, activities and intended impact.' },
        { key: 'category',    field: 'Support category',        what: 'The type of assistance provided — education, school development, a financial donation, learning resources, or another kind of support.' },
        { key: 'beneficiaries', field: 'Beneficiaries',         what: 'The number and, where available, the categories of people reached — including gender and age range.' },
        { key: 'donation',    field: 'Donation in pounds',      what: 'The recorded financial contribution in pounds (£), exactly as the workbook states it.' },
        { key: 'deliveryDate', field: 'Delivery date',          what: 'The date the support was delivered or the project was completed, where available.' },
        { key: 'status',      field: 'Project status',          what: 'The current or historical stage: planned, ongoing, completed, pending verification, or the wording the workbook uses.' },
        { key: 'documentation', field: 'Available documentation', what: 'The supporting evidence held: reports, photographs, videos, agreements, invoices and correspondence.' },
        { key: 'fileLocation', field: 'File location',          what: 'The folder, database or shared-drive location where the supporting material can be accessed.' },
        { key: 'missing',     field: 'Missing information',     what: 'Outstanding details, documents, figures or confirmations needed to complete the project record.' },
        { key: 'duration',    field: 'Duration of project',     what: 'The implementation period, including start and end dates where available (the workbook may state it as “2 years”).' }
    ];

    /* ── The columns actually on screen ───────────────────────────────────
       Every workbook column is shown until it is hidden, plus any column added
       in this app (text or dropdown). The array is rebuilt IN PLACE so every
       holder of it — the table, the exports, the Node API — sees the current
       set without needing a reference refresh. The workbook columns themselves
       are never deleted, only hidden: the source data stays intact and can be
       shown again at any time. */
    var FIELDS = BUILTIN_FIELDS.slice();

    /* ── Inventory rows ───────────────────────────────────────────────────
       Transcribed from “Project Inventory” in
       SmallWorld_Project_Inventory_and_Progress_Tracker.xlsx (rows 5–21 and the
       2011 entry at row 31). Text is trimmed, nothing is reworded, and a blank
       cell is stored as “—” — no value is invented. The workbook's Project ID
       column is blank, so each row carries the requested client ID: country code
       (UK, AE; XX where the country is blank), a 2-digit number for that
       project's place in the country for the year (01, 02, 03, 04…), then the
       last two digits of the year — UK0125 is the first UK project of 2025.
       The number restarts for each country and year, and a project added in the
       app takes the next free one.

       The earlier website-, Instagram- and photo-archive-derived rows were
       removed: the workbook is the agreed source of truth for this tab.
       Arrays are in FIELDS order. */
    var PROJECTS = [
        ['UK0125', '2025-2027', 'BIG EDUCATION - Rethinking project', 'UNITED KINGDOM', 'Two secondary and high schools in london', 'BIG EDUCATION', 'Educational Center', 'The head, heart, and Hands whole-child development through the Head, Heart, and Hand approach.', 'Education support / teacher traning', '1,000+ student', '10,000 pound', '21 November 2025 and ending on 20 November 2027.', 'Under procsseding', 'MOU / Payment receipts / video for visit', 'SmallWorld PC', '—', '2 years'],
        ['UK0225', '2025', 'visit to the Uk project the board', 'UNITED KINGDOM', '—', '—', '—', '—', '—', '—', '—', '—', '—', '—', '—', '—', '—'],
        ['UK0325', '2025-2026', 'Refugee Education UK (REUK)', 'UNITED KINGDOM', 'London, 101 King\'s Cross Road, London, WC1X 9LP', 'National Advice Line for Refugees', 'NGO', 'Establish a helpline as a national service provider.', 'National Advice Line for Refugees', '2000 student', '3,000 pound', '16/1/2025 - 16/01/2026', 'Completed', 'MOU / VISIT PICS / REPORT PROJECT', 'SmallWorld PC', '—', '1 year'],
        ['AE0125', '2025-2026', 'Education for All', 'Abu Dhabi', 'Dubai Silicion Oasis', 'Pure Data Centers Global (Pure DC)', 'Limitted company', 'Building a computer lap', 'Education Support / goods in hand', '1,000+ student', '£22,500 pound', '13/05/2025-13/05/2026', 'Completed', 'MOU / VISIT PICS / REPORT PROJECT', 'SmallWorld PC', '—', '1 school year / Lap 5 years'],
        ['UK0124', '2024-2025', 'Tayberry Project - 2024-2025', 'UNITED KINGDOM', 'UK , London ,West Yorkshire, Calderdale, East Lancashire, Rochdale, Bacup, and Burnley', 'Ask the queastion CIC', 'Educational Center - Tuition centre', 'Providing a safe space for student to study and tutoring for UK subrubs Children in need for safe space', 'Education support / Student Tutoring', '50 Student', '3,000 pound', '01/June /2024 - 01/June/2025', 'Completed', 'MOU / VISIT PICS / REPORT PROJECT', 'SmallWorld PC', '—', '1 year'],
        ['UK0123', '2023', 'SMALLWORLD CHARITIE VISIT', 'UNITED KINGDOM', '—', '—', '—', '—', '—', '—', '—', '—', '—', '—', '—', '—', '—'],
        ['UK0122', '2022-2023', 'CRY UK 2022- 2023', 'UNITED KINGDOM', 'Building Skills Center for children', 'NGO', 'Organization NGO', '—', 'Education Support', '—', '5000', '—', '—', 'MOU / VISIT PICS / REPORT PROJECT', 'SmallWorld PC', '—', '1 year'],
        ['UK0222', '2022', 'Barnardo\'s Path Program - belive in children', 'UNITED KINGDOM', '—', 'NGO', 'Organization NGO', '—', '—', '—', '—', '—', 'Grant agreement in not signed', '—', 'SmallWorld PC', '—', '2 years'],
        ['XX0121', '2021-2022', 'Back to School project', '—', '—', 'Zarat Al Lotus Autism Center', '—', '—', '—', '—', '45875', '—', '—', '—', '—', '—', '—'],
        ['XX0221', '22nd Sept to 13th Jan 2021', 'Back To School Project', '—', '—', 'United Nations High Commissioner for Refugees (UNHCR)', '—', '—', '—', '—', '82742.88', '—', '—', '—', '—', '—', '—'],
        ['XX0321', '24th Feb 2021', 'Virtual Learning Project (Laptop Project)', '—', '—', 'Emirates Autism Center', '—', '—', '—', '—', '4130.35', '—', '—', '—', '—', '—', '—'],
        ['XX0421', '10th May 2021', 'Enhancing Autistic Capabilities Project', '—', '—', 'Emirates Autism Center', '—', '—', '—', '—', '1512', '—', '—', '—', '—', '—', '—'],
        ['XX0521', '28th June 2021', 'Enhancing Autistic Capabilities Project', '—', '—', 'Basmat Amal Initiative', '—', '—', '—', '—', '3750', '—', '—', '—', '—', '—', '—'],
        ['XX0621', '5th July 2021 to 13th July 2021', 'Capgemini Singapore PTE Ltd Collaboration', '—', '—', 'Basmat Amal Initiative', '—', '—', '—', '—', '11600', '—', '—', '—', '—', '—', '—'],
        ['XX0721', '14th Sept 2021 to 5th Oct 2021', 'Skill Acquisition Programme', '—', '—', 'Basmat Amal Initiative', '—', '—', '—', '—', '—', '—', '—', '—', '—', '—', '—'],
        ['XX0821', '16th Feb 2021', 'Library Programme', '—', '—', 'Unknown Yet', '—', '—', '—', '—', '5955', '—', '—', '—', '—', '—', '—'],
        ['XX0120', '04 Feb 2020 to 15th Jan 2021', 'Regal London (Notepads Stored in the office)', '—', '—', '—', '—', '—', '—', '—', '35983.7', '—', '—', '—', '—', '—', '—'],
        ['UK0111', '2011', 'Children In need (BBC)', 'UNITED KINGDOM', '—', '—', '—', '—', '—', '—', '—', '—', '—', '—', '—', '—', '—'],
    ];

    var ALL_PROJECTS = PROJECTS;

    /* ═══ Column configuration ═════════════════════════════════════════════
       Which workbook columns are shown, plus the columns the user added. Stored
       in localStorage, so it survives a reload and applies in the browser
       preview exactly as in the desktop app. */
    var COL_KEY = 'swaProjectInventoryColumns';
    var COLUMNS = { hidden: [], custom: [] };

    function normColumnDef(def) {
        if (!def || typeof def !== 'object') return null;
        var field = String(def.field == null ? '' : def.field).trim();
        if (!field) return null;
        var type = def.type === 'select' ? 'select' : 'text';
        var options = Array.isArray(def.options)
            ? def.options.map(function (o) { return String(o).trim(); }).filter(Boolean)
            : [];
        return {
            key: String(def.key || ''),
            field: field.slice(0, 80),
            what: String(def.what || 'A column added in this app — its values are typed here, not from the workbook.'),
            type: type,
            options: options.slice(0, 60),
            locked: !!def.locked
        };
    }

    function loadColumns() {
        try {
            var raw = (typeof localStorage !== 'undefined') && localStorage.getItem(COL_KEY);
            if (!raw) return { hidden: [], custom: [] };
            var parsed = JSON.parse(raw);
            var builtinKeys = BUILTIN_FIELDS.map(function (f) { return f.key; });
            var custom = Array.isArray(parsed && parsed.custom)
                ? parsed.custom.map(normColumnDef).filter(Boolean)
                : [];
            // A hidden column is kept only if it still exists — workbook columns
            // and the app's own columns alike (a hidden tracker column used to be
            // dropped on reload and reappear).
            var known = builtinKeys.concat(custom.map(function (f) { return f.key; }));
            var hidden = Array.isArray(parsed && parsed.hidden)
                ? parsed.hidden.map(String).filter(function (k) { return known.indexOf(k) !== -1; })
                : [];
            return { hidden: hidden, custom: custom };
        } catch (e) { return { hidden: [], custom: [] }; }
    }

    /** Returns '' on success, or the reason it could not be saved. */
    function saveColumns(cfg) {
        try {
            if (typeof localStorage === 'undefined') return '';
            localStorage.setItem(COL_KEY, JSON.stringify(cfg || { hidden: [], custom: [] }));
            return '';
        } catch (e) {
            if (e && (e.name === 'QuotaExceededError' || /quota/i.test(String(e.message || '')))) {
                return 'App storage is full — remove a custom column or some attachments.';
            }
            return 'Could not save the column setup: ' + (e && e.message ? e.message : e);
        }
    }

    COLUMNS = loadColumns();

    /* ═══ Two classification columns the tracker needs ══════════════════════
       The workbook has one Institution type column, which mixes what the
       beneficiary IS with what it received. These two fields split that:

         • Beneficiary / Institution Type — the kind of entity that received
           the support: a physical institution or facility, a programme, an
           initiative, an individual, a group, or a community.
         • Tangible / Non-Tangible — whether that entity (and the benefit) is
           physical and directly measurable, or developmental and indirect.

       They are app columns (values recorded here, not in the workbook), shown
       by default and <b>locked</b>: they can be hidden but not deleted, so the
       classification cannot silently disappear from the tracker. Left blank
       until someone classifies the row — no value is inferred. */
    var TRACKER_COLUMNS = [
        {
            key: 'beneficiary_kind',
            field: 'Beneficiary / Institution Type',
            what: 'The kind of entity that received the support — a physical institution or facility, a programme, an initiative, an individual, a group, or a community. Separate from Tangible / Non-Tangible, which says whether it is physical.',
            type: 'select',
            options: ['Physical institution', 'Programme', 'Initiative', 'Individual', 'Group', 'Community'],
            locked: true
        },
        {
            key: 'tangibility',
            field: 'Tangible / Non-Tangible',
            what: 'Tangible: a physical entity or identifiable, measurable support. Non-tangible: a programme, network or developmental benefit that is not defined by a physical facility or a directly measurable item.',
            type: 'select',
            options: ['Tangible', 'Non-Tangible'],
            locked: true
        }
    ];

    function ensureTrackerColumns() {
        var added = false;
        TRACKER_COLUMNS.forEach(function (def) {
            var exists = BUILTIN_FIELDS.concat(COLUMNS.custom).some(function (f) { return f.key === def.key; });
            if (exists) return;
            COLUMNS.custom.push(normColumnDef(def));
            added = true;
        });
        if (!added) return;
        refreshFields();
        saveColumns(COLUMNS);
    }

    ensureTrackerColumns();

    function refreshFields() {
        FIELDS.length = 0;
        BUILTIN_FIELDS.forEach(function (f) {
            if (COLUMNS.hidden.indexOf(f.key) === -1) FIELDS.push(f);
        });
        COLUMNS.custom.forEach(function (f) {
            if (COLUMNS.hidden.indexOf(f.key) === -1) FIELDS.push(f);
        });
        // A column that is no longer shown cannot stay the edit target.
        if (typeof state !== 'undefined' && state && state.editColumn &&
            !FIELDS.some(function (f) { return f.key === state.editColumn; })) {
            state.editColumn = null;
            state.editDraft = {};
        }
    }

    function customKey(label) {
        var slug = String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24);
        var base = 'c_' + (slug || 'column');
        var key = base, n = 2;
        while (BUILTIN_FIELDS.concat(COLUMNS.custom).some(function (f) { return f.key === key; })) {
            key = base + '_' + n;
            n++;
        }
        return key;
    }

    /** Add a column. Returns '' on success, or the reason it was refused. */
    function addColumn(def) {
        var clean = normColumnDef(def);
        if (!clean) return 'Give the new column a name first.';
        if (clean.type === 'select' && !clean.options.length) return 'A dropdown column needs at least one option.';
        var clash = BUILTIN_FIELDS.concat(COLUMNS.custom).filter(function (f) {
            return String(f.field).toLowerCase() === clean.field.toLowerCase();
        })[0];
        if (clash) return 'A column called “' + clean.field + '” already exists.';
        clean.key = customKey(clean.field);
        COLUMNS.custom.push(clean);
        refreshFields();
        return saveColumns(COLUMNS);
    }

    /** Show or hide any column (workbook or custom). Workbook data is kept. */
    function setColumnVisible(key, visible) {
        var known = BUILTIN_FIELDS.concat(COLUMNS.custom).some(function (f) { return f.key === key; });
        if (!known) return 'That column does not exist.';
        var at = COLUMNS.hidden.indexOf(key);
        if (visible && at !== -1) COLUMNS.hidden.splice(at, 1);
        else if (!visible && at === -1) COLUMNS.hidden.push(key);
        refreshFields();
        return saveColumns(COLUMNS);
    }

    /** Delete a column added in this app, together with the values typed into it. */
    function deleteColumn(key) {
        var found = COLUMNS.custom.filter(function (f) { return f.key === key; })[0];
        if (!found) return 'Only columns added in this app can be deleted — workbook columns are hidden, not removed.';
        if (found.locked) return '“' + found.field + '” is part of the tracker — hide it instead of deleting it.';
        COLUMNS.custom = COLUMNS.custom.filter(function (f) { return f.key !== key; });
        COLUMNS.hidden = COLUMNS.hidden.filter(function (k) { return k !== key; });
        var edits = loadEdits();
        Object.keys(edits).forEach(function (id) {
            var bucket = edits[id];
            if (!bucket || typeof bucket !== 'object') return;
            delete bucket[key];
            if (!Object.keys(bucket).length) delete edits[id];
        });
        saveEdits(edits);
        var users = loadUserProjects();
        users.forEach(function (u) { if (u && u.values) delete u.values[key]; });
        saveUserProjects(users);
        if (state.cellEdit && state.cellEdit.key === key) state.cellEdit = null;
        refreshFields();
        return saveColumns(COLUMNS);
    }

    function showAllColumns() {
        COLUMNS.hidden = [];
        refreshFields();
        return saveColumns(COLUMNS);
    }

    refreshFields();


    /* ── Sources panel content ────────────────────────────────────────────
       States plainly what the tab is built from and what the workbook could
       not tell us, so the inventory can never be mistaken for a verified
       record. */
    var SOURCES = [
        {
            name: 'Workbook — SmallWorld_Project_Inventory_and_Progress_Tracker.xlsx (sheet “Project Inventory”)',
            what: 'The only source of the rows: 18 project records entered by the team, covering 2025–2011. Descriptions, amounts, statuses, documentation, file locations and durations are reproduced as recorded in that sheet.',
            url: 'SmallWorld_Project_Inventory_and_Progress_Tracker.xlsx — sheet “Project Inventory”, rows 5–21 and 31',
            gap: 'The Project ID column is blank on every row, so the app assigns a client ID from the row itself (country code, the next number for that country in the year, then the 2-digit year). Many cells are empty (country, location, beneficiary organisation, delivery date, amount, missing information) and the sheet is a working record, not evidence: nothing here has been checked against an agreement, receipt or report.'
        },
        {
            name: 'Workbook — sheet “Field Guide”',
            what: 'The agreed field list and what to record in each field. The 17th column, “Duration of project”, comes from the Project Inventory header because the Field Guide sheet does not list it.',
            url: 'SmallWorld_Project_Inventory_and_Progress_Tracker.xlsx — sheet “Field Guide”',
            gap: 'The guide describes the intended record; it supplies no data of its own.'
        },
        {
            name: 'Workbook — sheets “Work Progress” and “Read Me”',
            what: 'The team task list (T-01 to T-09) and the working rules: enter projects from 2026 backwards, record only facts supported by documents or sources, and flag unclear details in “Missing information”.',
            url: 'SmallWorld_Project_Inventory_and_Progress_Tracker.xlsx — sheets “Work Progress” and “Read Me”',
            gap: 'Neither sheet is imported into the inventory and neither states a project fact.'
        }
    ];

    var METHOD_NOTES = [
        'Every row is copied from the “Project Inventory” sheet of SmallWorld_Project_Inventory_and_Progress_Tracker.xlsx. The earlier website-, Instagram- and photo-archive-derived rows were deleted so this tab matches the workbook.',
        'The workbook’s Project ID column is blank, so each row is given the requested client ID: country code (UK, AE; XX where the Country cell is empty), a 2-digit number for its place in that country for the year (01, 02, 03, 04…), then the last two digits of the year — UK0125 is the first UK project of 2025, UK0225 the second. The number restarts for each country and year and never reuses one, so two rows cannot share an ID.',
        'Abu Dhabi is coded AE (United Arab Emirates) and the United Kingdom is coded GB. XX is used where the workbook records no country at all; it means “not recorded”, not a made-up country.',
        'Values are reproduced as recorded — including the workbook’s own wording (“Under procsseding”, “Completed”, “Grant agreement in not signed”) and its blank cells, which show here as “—”. Only leading, trailing and repeated whitespace is trimmed.',
        'Two lines in the sheet are not projects and are not imported: the expense-summary row (“SmallWorld Foundation Expenses (FEB 2020 - JAN 2021) spreadsheet enclosed”) and a stray row that holds only “No MOU / GRANT”.',
        'The workbook leaves “Missing information” blank on every row. The app does not fill it in with invented notes; the double-check section reports the gaps each row actually shows.',
        'The donation column is free text (“3,000 pound”, “5000”, “£22,500 pound”), so no money total is computed — adding those would imply a currency precision the workbook does not state.',
        'A correction typed into the table is stored as a local override, keyed by the row’s original workbook Project ID and marked “edited”; the workbook value stays visible, the exports use the corrected value, and “Reset my edits” restores every source value. The workbook itself is never rewritten.'
    ];

    /* ═══ XLSX builder ════════════════════════════════════════════════════
       A minimal but valid SpreadsheetML workbook (stored-ZIP, no dependency),
       so the renderer needs no bundler and no library to export real .xlsx. */

    var CRC_TABLE = (function () {
        var t = new Uint32Array(256);
        for (var n = 0; n < 256; n++) {
            var c = n;
            for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            t[n] = c >>> 0;
        }
        return t;
    })();

    function crc32(bytes) {
        var c = 0xFFFFFFFF;
        for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
    }

    function utf8(str) {
        if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
        var enc = unescape(encodeURIComponent(str)), out = new Uint8Array(enc.length);
        for (var i = 0; i < enc.length; i++) out[i] = enc.charCodeAt(i);
        return out;
    }

    /* Stored (uncompressed) ZIP — every reader accepts it and it keeps the
       implementation small enough to ship without a dependency. */
    function zipStore(files) {
        var chunks = [], central = [], offset = 0;
        function u16(v) { return [v & 0xFF, (v >>> 8) & 0xFF]; }
        function u32(v) { return [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]; }

        files.forEach(function (f) {
            var name = utf8(f.name);
            var data = typeof f.data === 'string' ? utf8(f.data) : f.data;
            var crc = crc32(data);
            var local = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
                u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
            chunks.push(new Uint8Array(local), name, data);
            central.push([].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
                u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0),
                u16(0), u16(0), u32(0), u32(offset)));
            central[central.length - 1].name = name;
            offset += local.length + name.length + data.length;
        });

        var centralChunks = [], centralSize = 0;
        central.forEach(function (c) {
            var head = new Uint8Array(c);
            centralChunks.push(head, c.name);
            centralSize += head.length + c.name.length;
        });

        var eocd = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0),
            u16(files.length), u16(files.length), u32(centralSize), u32(offset), u16(0)));

        var all = chunks.concat(centralChunks, [eocd]);
        var total = all.reduce(function (n, c) { return n + c.length; }, 0);
        var out = new Uint8Array(total), pos = 0;
        all.forEach(function (c) { out.set(c, pos); pos += c.length; });
        return out;
    }

    function xml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
            /* strip control characters Excel rejects */
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    }

    function colName(i) {
        var s = '';
        i += 1;
        while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
        return s;
    }

    var COL_WIDTHS = [14, 11, 42, 20, 30, 34, 22, 68, 24, 34, 26, 22, 22, 44, 52, 58];

    function buildXlsx(fields, rows, sheetName) {
        var cols = fields.map(function (f, i) {
            return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (COL_WIDTHS[i] || 24) + '" customWidth="1"/>';
        }).join('');

        var sheet = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
            '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>',
            '<sheetFormatPr defaultRowHeight="15"/>',
            '<cols>' + cols + '</cols>', '<sheetData>'];

        sheet.push('<row r="1">' + fields.map(function (f, i) {
            return '<c r="' + colName(i) + '1" s="1" t="inlineStr"><is><t xml:space="preserve">' + xml(f.field) + '</t></is></c>';
        }).join('') + '</row>');

        rows.forEach(function (row, r) {
            var n = r + 2;
            sheet.push('<row r="' + n + '">' + fields.map(function (f, i) {
                var v = row[i];
                if (v == null || v === '') return '';
                return '<c r="' + colName(i) + n + '" s="2" t="inlineStr"><is><t xml:space="preserve">' + xml(v) + '</t></is></c>';
            }).join('') + '</row>');
        });

        sheet.push('</sheetData></worksheet>');

        var contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
            '<Default Extension="xml" ContentType="application/xml"/>' +
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
            '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
            '</Types>';

        var rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
            '</Relationships>';

        var workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
            '<sheets><sheet name="' + xml(sheetName || 'Project Inventory') + '" sheetId="1" r:id="rId1"/></sheets></workbook>';

        var workbookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
            '</Relationships>';

        var styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
            '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
            '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>' +
            '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
            '<fill><patternFill patternType="solid"><fgColor rgb="FF1F3864"/><bgColor indexed="64"/></patternFill></fill></fills>' +
            '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
            '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
            '<cellXfs count="3">' +
            '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
            '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
            '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
            '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

        return zipStore([
            { name: '[Content_Types].xml', data: contentTypes },
            { name: '_rels/.rels', data: rootRels },
            { name: 'xl/workbook.xml', data: workbook },
            { name: 'xl/_rels/workbook.xml.rels', data: workbookRels },
            { name: 'xl/styles.xml', data: styles },
            { name: 'xl/worksheets/sheet1.xml', data: sheet.join('') }
        ]);
    }
    /* ═══ Identity images ═════════════════════════════════════════════════
       Each row gets a visual identifier. A real picture is used only when the
       row carries one (a project you added yourself); otherwise a generated
       tile (flag + project id) is drawn. Nothing is passed off as a photograph
       of a project the workbook has no photograph for. */

    var COUNTRY_FLAG = {
        'Australia': '\u{1F1E6}\u{1F1FA}', 'Bosnia': '\u{1F1E7}\u{1F1E6}', 'Bangladesh': '\u{1F1E7}\u{1F1E9}',
        'Palestine': '\u{1F1F5}\u{1F1F8}', 'Hungary': '\u{1F1ED}\u{1F1FA}', 'Indonesia': '\u{1F1EE}\u{1F1E9}',
        'Jordan': '\u{1F1EF}\u{1F1F4}', 'Panama': '\u{1F1F5}\u{1F1E6}', 'Armenia': '\u{1F1E6}\u{1F1F2}',
        'Japan': '\u{1F1EF}\u{1F1F5}', 'Kuwait': '\u{1F1F0}\u{1F1FC}', 'Ukraine': '\u{1F1FA}\u{1F1E6}',
        'China': '\u{1F1E8}\u{1F1F3}', 'Colombia': '\u{1F1E8}\u{1F1F4}', 'Lebanon': '\u{1F1F1}\u{1F1E7}',
        'Turkey': '\u{1F1F9}\u{1F1F7}', 'USA': '\u{1F1FA}\u{1F1F8}', 'UAE': '\u{1F1E6}\u{1F1EA}',
        'India': '\u{1F1EE}\u{1F1F3}', 'Egypt': '\u{1F1EA}\u{1F1EC}', 'Italy': '\u{1F1EE}\u{1F1F9}',
        'Mexico': '\u{1F1F2}\u{1F1FD}', 'Philippines': '\u{1F1F5}\u{1F1ED}', 'Puerto Rico': '\u{1F1F5}\u{1F1F7}',
        'Brazil': '\u{1F1E7}\u{1F1F7}', 'Spain': '\u{1F1EA}\u{1F1F8}', 'Greece': '\u{1F1EC}\u{1F1F7}',
        'Thailand': '\u{1F1F9}\u{1F1ED}', 'Nigeria': '\u{1F1F3}\u{1F1EC}', 'Ethiopia': '\u{1F1EA}\u{1F1F9}',
        'Morocco': '\u{1F1F2}\u{1F1E6}', 'Yemen': '\u{1F1FE}\u{1F1EA}', 'Malawi': '\u{1F1F2}\u{1F1FC}',
        'Syria': '\u{1F1F8}\u{1F1FE}', 'United Kingdom': '\u{1F1EC}\u{1F1E7}', 'UNITED KINGDOM': '\u{1F1EC}\u{1F1E7}',
        'UK': '\u{1F1EC}\u{1F1E7}', 'Venezuela': '\u{1F1FB}\u{1F1EA}',
        'Malaysia': '\u{1F1F2}\u{1F1FE}', 'Russia': '\u{1F1F7}\u{1F1FA}', 'Tunisia': '\u{1F1F9}\u{1F1F3}',
        'Sudan': '\u{1F1F8}\u{1F1E9}', 'Korea': '\u{1F1F0}\u{1F1F7}',
        'United States': '\u{1F1FA}\u{1F1F8}', 'United States of America': '\u{1F1FA}\u{1F1F8}',
        'United Arab Emirates': '\u{1F1E6}\u{1F1EA}', 'Abu Dhabi': '\u{1F1E6}\u{1F1EA}'
    };

    /* ── The countries the programme works in ─────────────────────────────
       The map from the programme brief, offered as a dropdown instead of a
       free-text box so one country is one spelling. UAE is included because the
       workbook records its projects by emirate (Abu Dhabi); a value already in
       the data that is not on this list is still offered in the editor, never
       silently dropped. */
    var COUNTRY_OPTIONS = [
        'Australia', 'Armenia', 'Bangladesh', 'Brazil', 'China', 'Colombia', 'Egypt',
        'Ethiopia', 'India', 'Indonesia', 'Italy', 'Japan', 'Malaysia', 'Mexico',
        'Morocco', 'Nigeria', 'Panama', 'Philippines', 'Puerto Rico', 'Spain',
        'Thailand', 'Turkey', 'Ukraine', 'United Arab Emirates', 'United Kingdom',
        'United States'
    ];

    /* Country → the two letters a client ID starts with. UK, not the ISO code
       GB: the IDs are this app's own reference, and the requested format says
       UK. A blank country gives XX — “not recorded”, never a guess. */
    var COUNTRY_CODE = {
        'UK': 'UK', 'United Kingdom': 'UK', 'UNITED KINGDOM': 'UK',
        'UAE': 'AE', 'United Arab Emirates': 'AE', 'Abu Dhabi': 'AE', 'Dubai': 'AE',
        'United States': 'US', 'United States of America': 'US', 'USA': 'US',
        'Ukraine': 'UA', 'Italy': 'IT', 'Spain': 'ES', 'Turkey': 'TR', 'Armenia': 'AM',
        'Japan': 'JP', 'Morocco': 'MA', 'Egypt': 'EG', 'India': 'IN', 'Bangladesh': 'BD',
        'Thailand': 'TH', 'China': 'CN', 'Philippines': 'PH', 'Puerto Rico': 'PR',
        'Mexico': 'MX', 'Panama': 'PA', 'Colombia': 'CO', 'Brazil': 'BR', 'Nigeria': 'NG',
        'Ethiopia': 'ET', 'Malaysia': 'MY', 'Indonesia': 'ID', 'Australia': 'AU'
    };

    function countryCodeFor(country) {
        var name = String(country == null ? '' : country).trim();
        if (!name || name === '—') return 'XX';
        return COUNTRY_CODE[name] || 'XX';
    }

    /** Country choices for a dropdown: the brief's list, plus anything recorded
     *  that is not on it (matched case-insensitively, so UNITED KINGDOM and
     *  United Kingdom are not offered twice). */
    function countryChoices() {
        var seen = {};
        var out = COUNTRY_OPTIONS.slice();
        out.forEach(function (c) { seen[c.toLowerCase()] = 1; });
        distinctValues('country').forEach(function (c) {
            if (!seen[c.toLowerCase()]) { out.push(c); seen[c.toLowerCase()] = 1; }
        });
        return out;
    }

    var STORAGE_KEY = 'swaProjectInventoryUser';
    var IDENTITY_IMAGE = 'assets/swa_logo.png';

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function fileUrl(p) {
        var norm = String(p || '').replace(/\\/g, '/');
        return 'file:///' + norm.split('/').map(function (seg, i) {
            return i === 0 ? seg : encodeURIComponent(seg);
        }).join('/');
    }

    /** Deterministic hue so the same country always gets the same tile colour. */
    function hueFor(text) {
        var h = 0, s = String(text || '');
        for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
        return h;
    }

    function flagTile(id, country) {
        var flag = COUNTRY_FLAG[country] || '';
        var hue = hueFor(country || id);
        var label = esc(String(id || '').slice(0, 10));
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">' +
            '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0" stop-color="hsl(' + hue + ',68%,48%)"/>' +
            '<stop offset="1" stop-color="hsl(' + ((hue + 38) % 360) + ',68%,28%)"/>' +
            '</linearGradient></defs><rect width="96" height="96" rx="14" fill="url(#g)"/>' +
            (flag ? '<text x="48" y="44" font-size="30" text-anchor="middle">' + flag + '</text>' : '') +
            '<text x="48" y="' + (flag ? 74 : 56) + '" font-size="13" font-family="monospace" fill="#fff" text-anchor="middle">' + label + '</text>' +
            '</svg>';
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    /** The image for a row: the picture it was saved with, else a generated tile. */
    function imageFor(row) {
        if (row.image) return row.image;
        return flagTile(row.values.id, row.values.country);
    }

    /* ── User-added projects (localStorage) ───────────────────────────────
       STORAGE_KEY itself is declared with the identity-image block above. */
    var VIEW_KEY = 'swaProjectInventoryView';

    function loadUserProjects() {
        try {
            var raw = (typeof localStorage !== 'undefined') && localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];
            var parsed = JSON.parse(raw);
            var list = Array.isArray(parsed) ? parsed : (parsed && parsed.added) || [];
            return Array.isArray(list) ? list.filter(function (r) { return r && r.values; }) : [];
        } catch (e) { return []; }
    }

    function saveUserProjects(list) {
        try {
            if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(list || []));
        } catch (e) { /* storage full or unavailable — the UI still holds the rows */ }
    }

    /* ── Attachments ──────────────────────────────────────────────────────
       Any row — one from the workbook or one added by hand — can carry
       attachments, stored beside the row (never inside it), so the workbook's
       17 columns stay exactly as recorded. They are grouped by type on screen.

       Storage honesty: a file up to 1 MB is copied into the app as a data URL,
       which works offline and in the browser preview. A larger file is NEVER
       copied — the desktop app keeps a link to the file on disk and says so,
       and the browser preview refuses it rather than pretending it was saved. */
    /* IDs used by earlier builds, and the CC-TYPE-YEAR generation this app used
       until the client-ID scheme below replaced it. Existing attachments, local
       edits and user-added rows are moved to the current IDs once per map, so a
       rename can never orphan evidence. */
    var LEGACY_ID_MAP = {
        'SW-2025-001': 'UK0125', 'SW-2025-002': 'UK0225',
        'SW-2025-003': 'UK0325', 'SW-2025-004': 'AE0125',
        'SW-2024-001': 'UK0124', 'SW-2023-001': 'UK0123',
        'SW-2022-001': 'UK0122', 'SW-2022-002': 'UK0222',
        'SW-2021-001': 'XX0121', 'SW-2021-002': 'XX0221',
        'SW-2021-003': 'XX0321', 'SW-2021-004': 'XX0421',
        'SW-2021-005': 'XX0521', 'SW-2021-006': 'XX0621',
        'SW-2021-007': 'XX0721', 'SW-2021-008': 'XX0821',
        'SW-2020-001': 'XX0120', 'SW-2011-001': 'UK0111'
    };

    /* The immediately previous scheme (country – type – year), used by every
       build up to 1.x of this tab. Mapped explicitly so the migration never has
       to guess which row an ID belonged to. */
    var PREVIOUS_ID_MAP = {
        'GB-EDU-2025': 'UK0125', 'GB-EVT-2025': 'UK0225',
        'GB-ADV-2025': 'UK0325', 'AE-EDU-2025': 'AE0125',
        'GB-EDU-2024': 'UK0124', 'GB-EVT-2023': 'UK0123',
        'GB-EDU-2022': 'UK0122', 'GB-WEL-2022': 'UK0222',
        'XX-EDU-2021': 'XX0121', 'XX-EDU-2021-02': 'XX0221',
        'XX-EDU-2021-03': 'XX0321', 'XX-WEL-2021': 'XX0421',
        'XX-WEL-2021-02': 'XX0521', 'XX-GEN-2021': 'XX0621',
        'XX-EDU-2021-04': 'XX0721', 'XX-EDU-2021-05': 'XX0821',
        'XX-EDU-2020': 'XX0120', 'GB-WEL-2011': 'UK0111'
    };
    var ID_MIGRATION_KEY = 'swaProjectInventoryCcIds';
    var CLIENT_ID_MIGRATION_KEY = 'swaProjectInventoryClientIds';
    var ATTACH_KEY = 'swaProjectAttachments';

    /** Move stored attachments, edits and user-added rows onto the current IDs.
     *  Runs once per map; a migration failure must never block the inventory. */
    function migrateIds(mapping, markerKey) {
        try {
            if (typeof localStorage === 'undefined') return;
            if (localStorage.getItem(markerKey)) return;
            [ATTACH_KEY, 'swaProjectInventoryEdits'].forEach(function (key) {
                var raw = localStorage.getItem(key);
                if (!raw) return;
                var store = JSON.parse(raw);
                if (!store || typeof store !== 'object') return;
                var changed = false;
                Object.keys(store).forEach(function (oldId) {
                    if (!store[oldId]) return;
                    var newId = mapping[oldId];
                    if (!newId) return;
                    if (!store[newId]) store[newId] = store[oldId];
                    else if (Array.isArray(store[newId]) && Array.isArray(store[oldId])) store[newId] = store[newId].concat(store[oldId]);
                    else if (typeof store[newId] === 'object' && typeof store[oldId] === 'object') store[newId] = Object.assign({}, store[oldId], store[newId]);
                    delete store[oldId];
                    changed = true;
                });
                if (changed) localStorage.setItem(key, JSON.stringify(store));
            });
            // User-added rows keep their ID inside the row itself.
            try {
                var rows = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
                if (Array.isArray(rows)) {
                    var rowsChanged = false;
                    rows.forEach(function (row) {
                        var old = row && row.values ? row.values.id : null;
                        if (old && mapping[old]) { row.values.id = mapping[old]; rowsChanged = true; }
                    });
                    if (rowsChanged) localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
                }
            } catch (e2) { /* user rows are optional */ }
            localStorage.setItem(markerKey, '1');
        } catch (e) { /* a migration failure must never block the inventory */ }
    }

    migrateIds(LEGACY_ID_MAP, ID_MIGRATION_KEY);
    migrateIds(PREVIOUS_ID_MAP, CLIENT_ID_MIGRATION_KEY);
    var ATTACH_EMBED_LIMIT = 1024 * 1024;              // 1 MB copied into app storage
    var ATTACH_BUDGET = Math.round(4.5 * 1024 * 1024);  // how much a browser page can hold
    var ATTACH_SEQ = 0;
    var ATTACHMENT_TYPES = [
        { key: 'agreement', label: 'Agreement / MOU', icon: '📄' },
        { key: 'testimony', label: 'Testimonies', icon: '🗣️', what: 'Beneficiary and partner accounts of the project' },
        { key: 'thankyou', label: 'Thank-you letters', icon: '💌' },
        { key: 'video', label: 'Videos', icon: '🎬' },
        { key: 'receipt', label: 'Receipts & payments', icon: '🧾' },
        { key: 'report', label: 'Reports', icon: '📊' },
        { key: 'photo', label: 'Photos', icon: '🖼️' },
        { key: 'other', label: 'Other', icon: '📎' }
    ];

    function attachTypeMeta(key) {
        var found = ATTACHMENT_TYPES.filter(function (t) { return t.key === key; })[0];
        return found || ATTACHMENT_TYPES[ATTACHMENT_TYPES.length - 1];
    }

    function loadAttachments() {
        try {
            var raw = (typeof localStorage !== 'undefined') && localStorage.getItem(ATTACH_KEY);
            if (!raw) return {};
            var parsed = JSON.parse(raw);
            return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
        } catch (e) { return {}; }
    }

    /** Returns '' on success, or the reason it could not be saved. */
    function saveAttachments(map) {
        try {
            if (typeof localStorage === 'undefined') return 'Storage is not available here.';
            localStorage.setItem(ATTACH_KEY, JSON.stringify(map || {}));
            return '';
        } catch (e) {
            if (e && (e.name === 'QuotaExceededError' || /quota/i.test(String(e.message || '')))) {
                return 'App storage is full — remove some embedded attachments (1 MB each) or use the desktop app to link them instead.';
            }
            return 'Could not save the attachments: ' + (e && e.message ? e.message : e);
        }
    }

    function attachmentsFor(projectId) {
        var map = loadAttachments();
        var list = map[String(projectId)];
        return Array.isArray(list) ? list.slice() : [];
    }

    function attachmentHref(a) {
        if (!a) return '';
        if (a.stored === 'embed' && a.data) return a.data;
        if (a.path) return fileUrl(a.path);
        return '';
    }

    function attachmentSizeLabel(bytes) {
        var n = Number(bytes || 0);
        if (!n) return 'size unknown';
        if (n < 1024) return n + ' B';
        if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
        return (n / (1024 * 1024)).toFixed(1) + ' MB';
    }

    /** Best-effort type from the file itself; the user's choice always wins. */
    function guessAttachmentType(file) {
        var mime = String((file && file.type) || '').toLowerCase();
        var name = String((file && file.name) || '').toLowerCase();
        if (/^video\//.test(mime) || /\.(mp4|m4v|mov|avi|mkv|webm|wmv)$/.test(name)) return 'video';
        if (/^image\//.test(mime) || /\.(jpe?g|png|gif|webp|bmp|tiff?|heic|heif)$/.test(name)) return 'photo';
        return 'other';
    }

    /** The file's real path, in Electron only — never invented in a browser. */
    function filePathOf(file) {
        try {
            if (file && typeof file.path === 'string' && file.path) return file.path;
        } catch (e) { /* older Electron */ }
        try {
            var electron = (typeof require === 'function') ? require('electron') : null;
            if (electron && electron.webUtils && typeof electron.webUtils.getPathForFile === 'function') {
                return electron.webUtils.getPathForFile(file) || '';
            }
        } catch (e) { /* not Electron */ }
        return '';
    }

    function readAsDataUrl(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(String(reader.result || '')); };
            reader.onerror = function () { reject(reader.error || new Error('the file could not be read')); };
            reader.readAsDataURL(file);
        });
    }

    /**
     * Copy small files into app storage and link large ones (desktop only).
     * Resolves with what actually happened: what was added, what was skipped
     * and why — nothing is dropped silently.
     */
    function addAttachments(projectId, typeKey, fileList) {
        var files = Array.prototype.slice.call(fileList || []);
        return new Promise(function (resolve) {
            var map = loadAttachments();
            var key = String(projectId);
            var list = Array.isArray(map[key]) ? map[key].slice() : [];
            var startCount = list.length;
            var skipped = [];
            var used = JSON.stringify(map).length;
            var i = 0;

            function finish(error) {
                if (list.length) map[key] = list; else delete map[key];
                var saveError = saveAttachments(map);
                resolve({
                    added: list.length - startCount,
                    skipped: skipped,
                    error: error || saveError || ''
                });
            }

            function next() {
                if (i >= files.length) { finish(''); return; }
                var file = files[i++];
                var chosen = (typeKey && typeKey !== 'auto') ? typeKey : guessAttachmentType(file);
                var item = {
                    id: 'att-' + Date.now().toString(36) + '-' + (++ATTACH_SEQ).toString(36),
                    name: file.name || 'file',
                    type: chosen,
                    size: Number(file.size || 0),
                    mime: file.type || '',
                    addedAt: new Date().toISOString(),
                    stored: 'embed',
                    data: '',
                    path: ''
                };

                if (item.size > ATTACH_EMBED_LIMIT) {
                    var p = filePathOf(file);
                    if (!p) {
                        skipped.push({ name: item.name, size: item.size, reason: 'too large to copy (limit 1 MB) and a browser cannot link a local file — use the desktop app, or attach a smaller copy' });
                        next();
                        return;
                    }
                    if (used > ATTACH_BUDGET) {
                        skipped.push({ name: item.name, size: item.size, reason: 'the app storage budget is reached — remove some embedded files first' });
                        next();
                        return;
                    }
                    item.stored = 'link';
                    item.path = p;
                    list.push(item);
                    next();
                    return;
                }

                readAsDataUrl(file).then(function (data) {
                    if (used + data.length > ATTACH_BUDGET) {
                        skipped.push({ name: item.name, size: item.size, reason: 'the app storage budget (4.5 MB) is reached — remove some embedded files or link it from the desktop app' });
                        next();
                        return;
                    }
                    item.data = data;
                    used += data.length;
                    list.push(item);
                    next();
                }).catch(function (e) {
                    skipped.push({ name: item.name, size: item.size, reason: 'the file could not be read (' + (e && e.message ? e.message : e) + ')' });
                    next();
                });
            }

            next();
        });
    }

    function removeAttachment(projectId, attachmentId) {
        var map = loadAttachments();
        var key = String(projectId);
        var list = Array.isArray(map[key]) ? map[key] : [];
        map[key] = list.filter(function (a) { return a && a.id !== attachmentId; });
        if (!map[key].length) delete map[key];
        return saveAttachments(map);
    }

    function removeAttachmentsFor(projectId) {
        var map = loadAttachments();
        if (map[String(projectId)]) {
            delete map[String(projectId)];
            return saveAttachments(map);
        }
        return '';
    }

    /* ── Local edits (over the workbook) ──────────────────────────────────
       The workbook rows are never rewritten. A correction made in the app is
       stored as an override keyed by the row's original workbook ID, shown with
       an “edited” mark and resettable — the source value is still known and is
       disclosed on hover. User-added rows are edited in place.

       The table, the analytics and the exports all use the effective values, so
       a correction is visible everywhere — it is never a cosmetic overlay. */
    var EDIT_KEY = 'swaProjectInventoryEdits';

    function loadEdits() {
        try {
            var raw = (typeof localStorage !== 'undefined') && localStorage.getItem(EDIT_KEY);
            if (!raw) return {};
            var parsed = JSON.parse(raw);
            return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
        } catch (e) { return {}; }
    }

    function saveEdits(map) {
        try {
            if (typeof localStorage === 'undefined') return 'Storage is not available here.';
            localStorage.setItem(EDIT_KEY, JSON.stringify(map || {}));
            return '';
        } catch (e) {
            if (e && (e.name === 'QuotaExceededError' || /quota/i.test(String(e.message || '')))) {
                return 'App storage is full — remove an attachment or reset some edits.';
            }
            return 'Could not save the edits: ' + (e && e.message ? e.message : e);
        }
    }

    function countEdits(map) {
        var n = 0;
        Object.keys(map || {}).forEach(function (id) {
            var bucket = map[id];
            if (bucket && typeof bucket === 'object') n += Object.keys(bucket).length;
        });
        return n;
    }

    /** Attachments stay with the original workbook row even if its ID is edited. */
    function attachKeyOf(row) {
        if (!row) return '';
        if (row.origin === 'built-in' && row.baseId) return row.baseId;
        return String(row.values && row.values.id != null ? row.values.id : '');
    }

    /** Wrap each sourced array row (in the workbook's own column order) into a
     *  { values } object. Always the 17 workbook columns — a hidden column or an
     *  added one must never shift the mapping of the source arrays. */
    function objectRows(arrays, origin) {
        return (arrays || []).map(function (arr, i) {
            var values = {};
            BUILTIN_FIELDS.forEach(function (f, idx) { values[f.key] = arr[idx] == null ? '' : arr[idx]; });
            // Columns added in this app belong to every row. Their values live in
            // the edits map keyed by row ID, so the key must exist here or the
            // saved value would be dropped when the row is rebuilt.
            COLUMNS.custom.forEach(function (f) { if (!(f.key in values)) values[f.key] = ''; });
            var original = {};
            Object.keys(values).forEach(function (k) { original[k] = values[k]; });
            return {
                id: values.id + '::' + i, baseId: values.id, values: values,
                _original: original, _edited: {}, image: '', origin: origin
            };
        });
    }

    function rowsToArrays(rows) {
        return rows.map(function (r) {
            return FIELDS.map(function (f) { return r.values[f.key] || ''; });
        });
    }

    /** Every row in the inventory: the sourced set plus anything the user added,
     *  with any local corrections applied over the workbook values. */
    function allRows() {
        var edits = loadEdits();
        var builtIn = objectRows(ALL_PROJECTS, 'built-in');
        builtIn.forEach(function (r) {
            var bucket = edits[r.baseId];
            if (!bucket || typeof bucket !== 'object') return;
            Object.keys(bucket).forEach(function (k) {
                if (!Object.prototype.hasOwnProperty.call(r.values, k)) return;
                r.values[k] = bucket[k];
                r._edited[k] = 1;
            });
        });
        return builtIn.concat(loadUserProjects().map(function (r, i) {
            return { id: 'user::' + i, values: r.values, image: r.image || '', origin: 'user', userIndex: i, _edited: {} };
        }));
    }

    /* ═══ View model ═════════════════════════════════════════════════════
       One object holds everything the inventory view needs, so a re-render
       (sort, filter, page) never loses what the user was looking at. The tab
       and the column preset are remembered across launches. */

    var state = {
        tab: 'overview',
        sortKey: 'year',
        sortDir: -1,
        query: '',
        status: 'all',
        country: 'all',
        year: 'all',
        gapsOnly: false,
        // Every workbook field is a column by default; the "Key fields"
        // preset is still available but no longer hides columns on first run.
        columns: 'all',
        page: 1,
        pageSize: 25,
        expanded: {},
        auditOnly: null,
        // Per-column filters: key -> { text: 'keyword', values: ['exact', ...] }.
        columnFilters: {},
        // Open column-filter dropdown: { key, top, left } (fixed positioning).
        colPop: null,
        // Inline editing: the column being edited and its unsaved values
        // (internal row id -> value), so a re-render never loses typing.
        editColumn: null,
        editDraft: {},
        editNotice: '',
        // One cell being rewritten in place (row id + column key), and whether a
        // dropdown column has been switched to free text for this edit.
        cellEdit: null,
        cellFreeText: false,
        // The Columns panel: show/hide/add/delete columns.
        colManager: false,
        colNotice: '',
        // Inventory fills the window (the "Full screen" button / Esc).
        focus: false,
        // Transient message shown inside one row's attachment panel.
        attachNotice: null,
        // The app instance, so Esc can re-render from outside wire().
        _app: null,
        _escHandler: null,
        // Set when a tab is chosen explicitly (a click, or a caller switching
        // tabs). The remembered view must not then overwrite that choice.
        _tabChosen: false
    };

    function loadView() {
        try {
            var raw = (typeof localStorage !== 'undefined') && localStorage.getItem(VIEW_KEY);
            if (!raw) return;
            var v = JSON.parse(raw);
            if (!v || typeof v !== 'object') return;
            ['sortKey', 'sortDir', 'pageSize'].forEach(function (k) {
                if (v[k] != null) state[k] = v[k];
            });
            // Columns are deliberately NOT restored: every launch starts with all
            // 17 workbook columns on screen. The "Key fields" preset is a view
            // for the current session only, so a remembered preset can never hide
            // workbook columns from the next launch.
            state.columns = 'all';
            if (!state._tabChosen && v.tab != null) state.tab = v.tab;
            if (!/^\d+$/.test(String(state.pageSize))) state.pageSize = 25;
        } catch (e) { /* first run or unreadable — defaults are fine */ }
    }

    function saveView() {
        try {
            if (typeof localStorage === 'undefined') return;
            localStorage.setItem(VIEW_KEY, JSON.stringify({
                tab: state.tab, sortKey: state.sortKey, sortDir: state.sortDir,
                pageSize: state.pageSize
            }));
        } catch (e) { /* not essential */ }
    }

    /* ── Value helpers ─────────────────────────────────────────────────── */

    function isBlank(v) {
        var s = String(v == null ? '' : v).trim();
        return s === '' || s === '—' || s === '-';
    }

    /** First 4-digit year inside a value — "2019–2020" → 2019. */
    function yearOf(v) {
        var m = String(v || '').match(/([0-9]{4})/);
        return m ? parseInt(m[1], 10) : null;
    }

    /** Every 4-digit year inside a value — "2019–2020" → [2019, 2020]. */
    function yearsOf(v) {
        var out = [];
        var re = /([0-9]{4})/g, m;
        while ((m = re.exec(String(v || '')))) out.push(parseInt(m[1], 10));
        return out;
    }

    function isYearRange(v) {
        return !/^\s*\d{4}\s*$/.test(String(v || '')) && yearsOf(v).length > 1;
    }

    function numericOf(v) {
        var m = String(v || '').replace(/,/g, '').match(/(-?[0-9]+(?:\.[0-9]+)?)/);
        return m ? parseFloat(m[1]) : null;
    }

    /** Largest child/beneficiary count named in a "Beneficiaries" cell. */
    function beneficiaryCount(v) {
        var s = String(v || '').replace(/,/g, '');
        var all = s.match(/[0-9]+(?:\.[0-9]+)?/g);
        if (!all) return null;
        var nums = all.map(Number).filter(function (n) { return n >= 1; });
        if (!nums.length) return null;
        // "over 500", "1,300 children", "20 foster children" → the largest named
        // figure is what the source states; smaller numbers are usually ages or
        // grade numbers.
        return Math.max.apply(null, nums);
    }

    /** Normalised project status for grouping (never invents a value). */
    function statusGroup(v) {
        var s = String(v || '').toLowerCase();
        if (isBlank(v)) return 'Unknown';
        if (s.indexOf('deliver') !== -1) return 'Delivered';
        // The workbook says "Completed" for a finished project.
        if (s.indexOf('complet') !== -1) return 'Delivered';
        if (s.indexOf('progress') !== -1) return 'In progress';
        // ...and "Under procsseding" for one that is still running.
        if (/under\s*proc/.test(s)) return 'In progress';
        if (s.indexOf('plan') !== -1) return 'Planned';
        if (s.indexOf('clos') !== -1) return 'Closed';
        return 'Other';
    }

    /** Sort by any field, plus the analytic sorts the Overview tab offers. */
    function compareRows(a, b, key, dir) {
        if (key === 'index') return (a._seq - b._seq) * dir;
        if (key === 'completeness') return ((a._gaps - b._gaps) || (a._seq - b._seq)) * dir;
        if (key === 'gaps') return ((b._gaps - a._gaps) || (a._seq - b._seq)) * dir;
        if (key === 'beneficiaries') {
            var ab = a._benefCount == null ? -1 : a._benefCount;
            var bb = b._benefCount == null ? -1 : b._benefCount;
            if (ab !== bb) return (ab - bb) * dir;
            return a._seq - b._seq;
        }
        var av = a.values[key], bv = b.values[key];
        var ae = isBlank(av), be = isBlank(bv);
        if (ae && be) return (a._seq - b._seq);
        if (ae) return 1;   // blanks always sink, whatever the direction
        if (be) return -1;
        if (key === 'year') {
            var ay = yearOf(av), by = yearOf(bv);
            if (ay != null && by != null && ay !== by) return (ay - by) * dir;
        }
        var an = numericOf(av), bn = numericOf(bv);
        var bothNumeric = an != null && bn != null && /^[\s\d.,%£$€+-]*[0-9]/.test(String(av)) && /^[\s\d.,%£$€+-]*[0-9]/.test(String(bv));
        if (bothNumeric && an !== bn) return (an - bn) * dir;
        return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir;
    }

    function decorate(rows) {
        rows.forEach(function (r, i) {
            r._seq = i;
            r._gaps = isBlank(r.values.missing) ? 0 : 1;
            r._benefCount = beneficiaryCount(r.values.beneficiaries);
            r._year = yearOf(r.values.year);
        });
        return rows;
    }

    function viewRows() {
        var rows = decorate(allRows());
        var q = state.query.trim().toLowerCase();
        if (q) {
            rows = rows.filter(function (r) {
                return FIELDS.some(function (f) { return String(r.values[f.key] || '').toLowerCase().indexOf(q) !== -1; });
            });
        }
        if (state.status !== 'all') {
            rows = rows.filter(function (r) { return statusGroup(r.values.status) === state.status; });
        }
        if (state.country !== 'all') {
            rows = rows.filter(function (r) { return String(r.values.country || '').trim() === state.country; });
        }
        if (state.year !== 'all') {
            rows = rows.filter(function (r) { return String(yearOf(r.values.year)) === state.year; });
        }
        if (state.gapsOnly) rows = rows.filter(function (r) { return r._gaps > 0; });
        Object.keys(state.columnFilters).forEach(function (key) {
            var f = state.columnFilters[key];
            if (!f) return;
            var needle = String(f.text || '').trim().toLowerCase();
            var picks = f.values || [];
            if (!needle && !picks.length) return;
            rows = rows.filter(function (r) {
                var cell = String(r.values[key] == null ? '' : r.values[key]);
                if (needle && cell.toLowerCase().indexOf(needle) === -1) return false;
                if (picks.length && picks.indexOf(cell.trim()) === -1) return false;
                return true;
            });
        });
        if (state.auditOnly) {
            var ids = state.auditOnly;
            rows = rows.filter(function (r) { return ids.indexOf(r.values.id) !== -1; });
        }
        rows.sort(function (a, b) { return compareRows(a, b, state.sortKey, state.sortDir); });
        return rows;
    }

    /** Does a cell hold a real value — not a dash and not a dash with a note? */
    function hasValue(v) {
        var s = String(v == null ? '' : v).trim();
        if (!s || s === '—' || s === '-') return false;
        // "— (amount raised not published)" records the absence of a number, so
        // it must not be counted as a value in a "how much is recorded" tally.
        if (/^—\s*\(/.test(s)) return false;
        return true;
    }

    function hasAmount(v) {
        if (!hasValue(v)) return false;
        return /[£$€]|\b\d/.test(String(v));
    }

    function hasDate(v) {
        if (!hasValue(v)) return false;
        return /\d/.test(String(v));
    }

    function stats(rows) {
        var countries = {}, years = {}, gaps = 0, withAmount = 0, withDate = 0, knownKids = 0, kids = 0;
        var cells = 0, filled = 0, attachedRows = 0, attachFiles = 0, editedRows = 0;
        var attachMap = loadAttachments();
        var editMap = loadEdits();
        rows.forEach(function (r) {
            var c = String(r.values.country || '').trim();
            if (c && c !== '—') countries[c] = 1;
            yearsOf(r.values.year).forEach(function (y) { if (y > 1990 && y < 2100) years[y] = 1; });
            if (!isBlank(r.values.missing)) gaps++;
            if (hasAmount(r.values.donation)) withAmount++;
            if (hasDate(r.values.deliveryDate)) withDate++;
            var n = beneficiaryCount(r.values.beneficiaries);
            if (n != null) { knownKids++; kids += n; }
            var files = attachMap[r.origin === 'built-in' && r.baseId ? r.baseId : r.values.id];
            if (Array.isArray(files) && files.length) { attachedRows++; attachFiles += files.length; }
            if (r.origin === 'built-in' && r.baseId && editMap[r.baseId]) editedRows++;
            // "Missing information" is a notes column, not a fact about the
            // project, so it is excluded from the completeness figure. The
            // aggregate counts every other WORKBOOK field — an added or hidden
            // column must not move a data-quality figure.
            BUILTIN_FIELDS.forEach(function (f) {
                if (f.key === 'missing') return;
                cells++;
                if (hasValue(r.values[f.key])) filled++;
            });
        });
        var ys = Object.keys(years).map(Number).sort(function (a, b) { return a - b; });
        // The year filter must offer the years rows START in (the year the
        // charts use), otherwise picking the tail of a span (2027 in
        // "2025–2027") would always return an empty table.
        var firstYears = {};
        rows.forEach(function (r) {
            var y = yearOf(r.values.year);
            if (y != null) firstYears[y] = 1;
        });
        return {
            total: rows.length,
            userAdded: rows.filter(function (r) { return r.origin === 'user'; }).length,
            countries: Object.keys(countries).length,
            countryList: Object.keys(countries).sort(),
            yearList: Object.keys(firstYears).map(Number).sort(function (a, b) { return b - a; }),
            range: ys.length ? (ys[0] + '–' + ys[ys.length - 1]) : '—',
            gaps: gaps,
            withAmount: withAmount,
            withDate: withDate,
            attached: attachedRows,
            attachFiles: attachFiles,
            editedRows: editedRows,
            editedCells: countEdits(editMap),
            kidsKnown: knownKids,
            kidsTotal: kids,
            cells: cells,
            filled: filled,
            // Share of the 16×N field cells that hold a value — the honest
            // measure of how complete the inventory is. Counting whole rows
            // would read 0% because EVERY row still has something missing.
            documented: cells ? Math.round((filled / cells) * 100) : 0
        };
    }

    /* ═══ Analytics ══════════════════════════════════════════════════════
       Everything here is a straight tally of the recorded rows. Nothing is
       modelled: a "—" is excluded from a count rather than treated as zero, and
       the number of rows behind each figure is always available. */

    function tally(rows, pick) {
        var out = {};
        rows.forEach(function (r) {
            var k = pick(r);
            if (k == null || k === '' || k === '—') return;
            out[k] = (out[k] || 0) + 1;
        });
        return out;
    }

    function sortedEntries(obj, limit, byValue) {
        var list = Object.keys(obj).map(function (k) { return { key: k, value: obj[k] }; });
        list.sort(byValue === false
            ? function (a, b) { return String(a.key).localeCompare(String(b.key)); }
            : function (a, b) { return b.value - a.value || String(a.key).localeCompare(String(b.key)); });
        return limit ? list.slice(0, limit) : list;
    }

    function analytics(rows) {
        var byYearMap = {};
        rows.forEach(function (r) {
            var ys = yearsOf(r.values.year).filter(function (y) { return y > 1990 && y < 2100; });
            if (!ys.length) return;
            var y = String(Math.min.apply(null, ys));
            byYearMap[y] = (byYearMap[y] || 0) + 1;
        });
        var byYear = Object.keys(byYearMap).map(Number).sort(function (a, b) { return a - b; })
            .map(function (y) { return { year: y, count: byYearMap[String(y)] }; });

        var completeness = BUILTIN_FIELDS.map(function (f) {
            var documented = rows.filter(function (r) { return !isBlank(r.values[f.key]); }).length;
            return {
                key: f.key, field: f.field,
                documented: documented,
                percent: rows.length ? Math.round((documented / rows.length) * 100) : 0
            };
        });

        return {
            byYear: byYear,
            byCountry: sortedEntries(tally(rows, function (r) { return String(r.values.country || '').trim(); }), 12),
            byCategory: sortedEntries(tally(rows, function (r) { return String(r.values.category || '').trim(); }), 10),
            byInstitution: sortedEntries(tally(rows, function (r) { return String(r.values.instType || '').trim(); }), 8),
            byStatus: sortedEntries(tally(rows, function (r) { return statusGroup(r.values.status); }), null),
            completeness: completeness
        };
    }

    /* ═══ Data double-check ══════════════════════════════════════════════
       A second pass over the rows that finds the mistakes a spreadsheet hides:
       the same project recorded twice under two years, a year that is really a
       range, a country that is an abbreviation or a region, an amount mentioned
       in the description but missing from the amount column. Every finding
       names the rows it came from, so it can be checked rather than trusted.
    ═══════════════════════════════════════════════════════════════════ */

    var COUNTRY_FULL_NAME = {
        'UAE': 'United Arab Emirates',
        'USA': 'United States',
        'UK': 'United Kingdom',
        'Korea': 'South Korea',
        'Bosnia': 'Bosnia and Herzegovina'
    };

    function auditRows(rows) {
        var findings = [];
        var add = function (key, severity, title, detail, ids) {
            findings.push({ key: key, severity: severity, title: title, detail: detail, ids: ids || [] });
        };

        // 1. Same ID twice — the inventory could not be joined up.
        var byId = {};
        rows.forEach(function (r) { (byId[r.values.id] = byId[r.values.id] || []).push(r.values.id); });
        var dupIds = Object.keys(byId).filter(function (k) { return byId[k].length > 1; });
        if (dupIds.length) {
            add('dup-id', 'high', 'Duplicate Project ID',
                'Two or more rows share an ID, so a spreadsheet cannot tell them apart.', dupIds);
        }

        // 2. The same description on rows from different years — usually one
        //    project reported on two year pages, which double-counts it.
        var byText = {};
        rows.forEach(function (r) {
            var t = String(r.values.description || '').replace(/\s+/g, ' ').trim().slice(0, 90);
            if (t.length < 40) return;
            (byText[t] = byText[t] || []).push(r);
        });
        var repeats = [];
        Object.keys(byText).forEach(function (t) {
            var group = byText[t];
            var years = {};
            group.forEach(function (r) { years[String(r.values.year)] = 1; });
            if (group.length > 1 && Object.keys(years).length > 1) {
                group.forEach(function (r) { repeats.push(r.values.id); });
            }
        });
        if (repeats.length) {
            add('repeat-verdict', 'high', 'The same description appears under two different years',
                'These rows describe the same work in the same words under two different years. Either it is one project ' +
                'entered twice (so a total would count it twice) or two separate grants — the workbook does not say.',
                repeats);
        }

        // 3. A year that is really a range — fine to keep, but it cannot be
        //    plotted on a single-year axis without choosing a side.
        var rangeIds = rows.filter(function (r) { return isYearRange(r.values.year); }).map(function (r) { return r.values.id; });
        if (rangeIds.length) {
            add('year-range', 'medium', 'Year recorded as a range',
                'The Year cell holds a span such as “2019–2020”. The analytics place these rows at the first year of the ' +
                'span, which is a choice — the source does not split the work between the two years.', rangeIds);
        }

        // 4. Country cells that are not a country.
        var composite = rows.filter(function (r) {
            var c = String(r.values.country || '').trim();
            return /\(| and |,|\//.test(c);
        }).map(function (r) { return r.values.id; });
        if (composite.length) {
            add('country-composite', 'medium', 'Country cell is a region or a pair of countries',
                'These rows name more than one country (or a region), so a per-country total splits them arbitrarily.',
                composite);
        }

        // 5. Abbreviated country names — readable, but inconsistent with the
        //    rest of the column and easy to miss in a pivot table.
        var abbrev = rows.filter(function (r) { return COUNTRY_FULL_NAME[String(r.values.country || '').trim()]; })
            .map(function (r) { return r.values.id; });
        if (abbrev.length) {
            add('country-abbrev', 'low', 'Country written as an abbreviation',
                'The column mixes full country names with short forms (UAE, USA…). Spelling one way or the other keeps ' +
                'grouping reliable.', abbrev);
        }

        // 6. An institution is named as the type but no organisation is recorded.
        var orphanOrg = rows.filter(function (r) {
            var t = String(r.values.instType || '');
            return !isBlank(r.values.instType) && t.indexOf('Program') === -1 && isBlank(r.values.org);
        }).map(function (r) { return r.values.id; });
        if (orphanOrg.length) {
            add('org-missing', 'medium', 'Institution type recorded, organisation missing',
                'The row says what kind of institution received the support but not which one, so the beneficiary ' +
                'cannot be contacted or checked.', orphanOrg);
        }

        // 7. Money talked about in the description but nothing in the amount cell.
        // Deliberately narrow: a currency figure, or an explicit cost/budget
        // word. The bare word "fund" is NOT enough — "funds were dedicated…"
        // says nothing about an amount, and flagging it would be noise.
        var moneyIds = rows.filter(function (r) {
            if (hasAmount(r.values.donation)) return false;
            var d = String(r.values.description || '');
            return /£\s?[0-9]|\$\s?[0-9]|[0-9]+\s?(pounds|dollars|USD|GBP|euros)|\b(budget|cost|costs|amount of)\b/i.test(d);
        }).map(function (r) { return r.values.id; });
        if (moneyIds.length) {
            add('amount-missing', 'low', 'Description mentions money; the amount cell is empty',
                'The text refers to funding or a cost but no amount is recorded, so any total is incomplete.',
                moneyIds);
        }

        // 8. No delivery date at all (a dash, or a note with no date in it).
        var dateRows = rows.filter(function (r) { return !hasDate(r.values.deliveryDate); });
        if (dateRows.length) {
            add('no-date', 'info', dateRows.length + ' of ' + rows.length + ' rows have no delivery date',
                'Only the year is documented, so “when was this delivered?” cannot be answered from the inventory.',
                dateRows.map(function (r) { return r.values.id; }));
        }

        // 9. No amount at all.
        var amountRows = rows.filter(function (r) { return !hasAmount(r.values.donation); });
        if (amountRows.length) {
            add('no-amount', 'info', amountRows.length + ' of ' + rows.length + ' rows state no amount',
                'The workbook records what was done more often than what it cost. A financial total from this inventory ' +
                'would be built on the rows that do carry a figure, and not on the rest.',
                amountRows.map(function (r) { return r.values.id; }));
        }

        // 10. Beneficiary count unknown.
        var noKids = rows.filter(function (r) { return beneficiaryCount(r.values.beneficiaries) == null; }).length;
        if (noKids) {
            add('no-beneficiaries', 'info', noKids + ' of ' + rows.length + ' rows have no stated number of beneficiaries',
                'The reach of the programme cannot be summed from the inventory alone.',
                rows.filter(function (r) { return beneficiaryCount(r.values.beneficiaries) == null; }).map(function (r) { return r.values.id; }));
        }

        // 11. The same project name in the same year. Compare the calendar
        //     year, not the raw cell: "10th May 2021" and "28th June 2021" are
        //     the same year even though the strings differ.
        var byName = {};
        rows.forEach(function (r) {
            var n = String(r.values.name || '').trim().toLowerCase();
            if (!n) return;
            var y = yearOf(r.values.year);
            var k = (y == null ? String(r.values.year) : String(y)) + '|' + n;
            (byName[k] = byName[k] || []).push(r.values.id);
        });
        var sameName = [];
        Object.keys(byName).forEach(function (k) { if (byName[k].length > 1) sameName = sameName.concat(byName[k]); });
        if (sameName.length) {
            add('dup-name', 'medium', 'Same project name in the same year',
                'Two rows carry an identical name for one year — check whether one is a duplicate entry.', sameName);
        }

        // 12. A year outside the range the workbook covers.
        var outside = rows.filter(function (r) {
            var y = yearOf(r.values.year);
            return y != null && (y < 2011 || y > 2026);
        }).map(function (r) { return r.values.id; });
        if (outside.length) {
            add('year-outside', 'medium', 'Year outside 2011–2026',
                'The tracker is being filled from 2026 backwards and the earliest row is 2011; a row outside that ' +
                'window is either a typo or a different source.', outside);
        }

        // 13. No source named for the row.
        var noSource = rows.filter(function (r) { return isBlank(r.values.fileLocation); }).map(function (r) { return r.values.id; });
        if (noSource.length) {
            add('no-source', 'high', 'No file location recorded',
                'The File location cell is empty, so the row does not say which folder or document holds the evidence. ' +
                'The workbook is the source of the row, but the row still cannot be checked against its own filing.', noSource);
        }

        var order = { high: 0, medium: 1, low: 2, info: 3 };
        findings.sort(function (a, b) { return order[a.severity] - order[b.severity] || b.ids.length - a.ids.length; });
        return findings;
    }

    function auditTotals(findings) {
        var t = { high: 0, medium: 0, low: 0, info: 0, rowsFlagged: {} };
        findings.forEach(function (f) {
            t[f.severity] += 1;
            f.ids.forEach(function (id) { t.rowsFlagged[id] = 1; });
        });
        t.rowsFlaggedCount = Object.keys(t.rowsFlagged).length;
        return t;
    }

    /* ═══ Export ═════════════════════════════════════════════════════════ */

    function downloadBlob(blob, filename) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }

    function toCsv(fields, rows) {
        var quote = function (v) {
            var s = String(v == null ? '' : v).replace(/\r?\n/g, ' ');
            return /[",]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        };
        var lines = [fields.map(function (f) { return quote(f.field); }).join(',')];
        rows.forEach(function (r) { lines.push(r.map(quote).join(',')); });
        return '\ufeff' + lines.join('\r\n');
    }

    /** Filename that says exactly which slice of the inventory it holds. */
    function exportName(rows, ext, filtered) {
        var stamp = new Date().toISOString().slice(0, 10);
        return 'SmallWorld-Project-Inventory' + (filtered ? '-filtered-' + rows.length + 'rows' : '') + '-' + stamp + '.' + ext;
    }

    function exportXlsx(app, rows, filtered) {
        var status = document.getElementById('pinvExportStatus');
        try {
            var arrays = rowsToArrays(rows);
            var bytes = buildXlsx(FIELDS, arrays, 'Project Inventory');
            var blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            downloadBlob(blob, exportName(arrays, 'xlsx', filtered));
            if (status) status.textContent = 'Exported ' + arrays.length + ' rows × ' + FIELDS.length + ' fields' + (filtered ? ' (the filtered view)' : '') + '.';
            if (app.logBuildEvent) app.logBuildEvent('project-inventory-export',
                'Exported ' + arrays.length + ' inventory rows to .xlsx' + (filtered ? ' (filtered view)' : ''));
        } catch (err) {
            if (status) status.textContent = 'Export failed: ' + (err && err.message ? err.message : err);
            if (app.logError) app.logError('Project inventory export failed: ' + (err && err.message ? err.message : err));
        }
    }

    function exportCsv(app, rows, filtered) {
        var status = document.getElementById('pinvExportStatus');
        try {
            var arrays = rowsToArrays(rows);
            var csv = toCsv(FIELDS, arrays);
            downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), exportName(arrays, 'csv', filtered));
            if (status) status.textContent = 'Exported ' + arrays.length + ' rows as CSV' + (filtered ? ' (the filtered view)' : '') + '.';
        } catch (err) {
            if (status) status.textContent = 'CSV export failed: ' + (err && err.message ? err.message : err);
        }
    }

    function exportJson(app, rows, filtered) {
        var status = document.getElementById('pinvExportStatus');
        try {
            var payload = {
                generatedAt: new Date().toISOString(),
                fields: FIELDS,
                rowCount: rows.length,
                filtered: !!filtered,
                audit: auditRows(rows).map(function (f) {
                    return { severity: f.severity, title: f.title, detail: f.detail, rows: f.ids };
                }),
                rows: rows.map(function (r) {
                    var o = {};
                    FIELDS.forEach(function (f) { o[f.field] = r.values[f.key] || ''; });
                    o._origin = r.origin;
                    o._editedFields = r._edited ? Object.keys(r._edited).map(function (k) {
                        var f = FIELDS.filter(function (x) { return x.key === k; })[0];
                        return f ? f.field : k;
                    }) : [];
                    // A manifest only — the copied file data stays in the app, so
                    // the JSON does not balloon to megabytes.
                    o.Attachments = attachmentsFor(attachKeyOf(r)).map(function (a) {
                        var meta = attachTypeMeta(a.type);
                        return {
                            name: a.name, type: meta.label, typeKey: meta.key,
                            size: a.size, stored: a.stored, path: a.path || '', addedAt: a.addedAt || ''
                        };
                    });
                    return o;
                })
            };
            downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
                exportName(rows, 'json', filtered));
            if (status) status.textContent = 'Exported ' + rows.length + ' rows as JSON (with the double-check findings).';
        } catch (err) {
            if (status) status.textContent = 'JSON export failed: ' + (err && err.message ? err.message : err);
        }
    }

    /* ═══ Method guide (researched, honest) ══════════════════════════════ */

    var DATA_METHODS = [
        {
            rank: '1', title: 'Business Discovery — Instagram Graph API (official)',
            gives: 'The target account’s public posts with REAL like and comment counts (plus caption, media type, permalink, timestamp, view count), paginated by cursor.',
            needs: 'A token from YOUR Instagram Business/Creator account linked to a Facebook Page, with instagram_basic + instagram_manage_insights + pages_read_engagement. The target does not have to authorise anything. Personal accounts are not readable this way, and hidden like counts are omitted.',
            status: 'Wired in — add the token in Settings → Instagram Graph API.'
        },
        {
            rank: '2', title: 'Rendered browser page (no sign-in needed)',
            gives: 'The live profile header (followers, following, post count, bio, website) and the newest posts — real likes, comments, exact date, caption, hashtags — read from the rendered page and each post page.',
            needs: 'Nothing. Instagram caps anonymous browsing, so only about 24 posts are reachable; the cap is stated in the coverage line rather than hidden.',
            status: 'Default method — this is what runs when no token is configured.'
        },
        {
            rank: '3', title: 'Instaloader with a signed-in session',
            gives: 'Post-by-post history including older posts, once a real Instagram session exists.',
            needs: 'A signed-in session (Settings → Instagram Login). Anonymous lookup is blocked by Instagram. Grey area: the session is a credential, and Meta’s automated-collection terms require permission.',
            status: 'Tried automatically when a session is saved.'
        },
        {
            rank: '4', title: 'Third-party scraping APIs (not wired in)',
            gives: 'Some vendors advertise full public history plus likes/comments/captions, e.g. Apify ($2.70/1,000 results), Bright Data (5,000 free records/month), ScrapeCreators, EnsembleData (50 units/day free).',
            needs: 'An account and payment at the vendor. Unofficial: paying a vendor does not make collection Meta-authorised, and coverage limits are not guaranteed.',
            status: 'Not integrated — listed so the trade-off is visible.'
        }
    ];

    /* ═══ Live data ══════════════════════════════════════════════════════ */

    function coverageLine(app) {
        var posts = app.currentPosts || [];
        var total = (app.currentProfile && app.currentProfile.posts) || null;
        var pct = (total && posts.length) ? Math.round((posts.length / total) * 1000) / 10 : null;
        if (!posts.length) {
            return 'No posts retrieved yet. Run a scan — or load the last saved scan, which needs no network call. ' +
                'Counts are as observed at retrieval time.';
        }
        var line = posts.length + (total ? ' of ' + total : '') + ' posts' + (pct != null ? ' (' + pct + '%)' : '');
        line += total && posts.length < total
            ? ' — a recent subset, not the complete history.'
            : ' retrieved.';
        line += ' Counts are as observed at retrieval time.';
        return line;
    }

    /**
     * The last scan saved on this machine, for any account. This is what the
     * app can show instantly while a live scan runs, and after a failed one.
     */
    function lastSavedCard(app) {
        var snap = null;
        if (typeof app.latestSnapshot === 'function') snap = app.latestSnapshot();
        var onScreen = app.currentProfile && app.currentProfile.username;
        if (!snap) {
            return '<div class="card pinv-card" style="padding:1rem;">' +
                '<div class="pinv-card-title">💾 Last saved scan</div>' +
                '<p class="pinv-muted" style="font-size:.8rem;line-height:1.55;margin:.35rem 0 0;">' +
                'Nothing saved yet. Every scan is written down automatically — results, coverage and the date — so the next ' +
                'launch (and any failed scan) can show the most recent data instead of an empty screen.</p></div>';
        }
        var rows = [
            ['Account', '@' + snap.username],
            ['Saved', new Date(snap.savedAt).toLocaleString() + ' · ' + app.snapshotAgeLabel(snap.savedAt)],
            ['Posts in this scan', String(snap.scanPosts != null ? snap.scanPosts : (snap.posts || []).length)],
            ['Posts known in total', String(snap.knownPosts != null ? snap.knownPosts : (snap.posts || []).length)],
            ['Account total', snap.profilePosts != null ? app.fmt(snap.profilePosts) : 'not reported'],
            ['Walk reached the first post', snap.complete === true ? 'yes' : 'no — a partial walk'],
            ['Methods', (snap.methods && snap.methods.length)
                ? snap.methods.map(function (m) { return m.name + '=' + m.status; }).join(', ')
                : 'not recorded for this scan']
        ];
        if (snap.truncated) rows.push(['Note', 'kept the newest ' + (snap.knownPosts || '') + ' posts (storage limit)']);
        if (snap.previousScanAt) rows.push(['Merged with', 'a scan saved ' + app.snapshotAgeLabel(snap.previousScanAt)]);
        return '<div class="card pinv-card" style="padding:1rem;">' +
            '<div class="pinv-card-title">💾 Last saved scan' +
            (onScreen && onScreen.toLowerCase() === snap.username ? ' <span class="pinv-badge user">on screen</span>' : '') + '</div>' +
            '<table class="pinv-kv">' + rows.map(function (r) {
                return '<tr><th>' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>';
            }).join('') + '</table>' +
            '<div class="pinv-row-actions">' +
            '<button id="pinvLoadSnapshot" class="btn btn-secondary" style="font-size:.76rem;">💾 Load this saved scan</button>' +
            '<button id="pinvRefreshLive2" class="btn btn-primary" style="font-size:.76rem;">🔄 Scan live now</button>' +
            '</div>' +
            '<div class="pinv-muted" style="font-size:.72rem;margin-top:.5rem;">Loading the saved scan makes no network request. ' +
            'A live scan merges into it, so older posts collected earlier are never lost.</div>' +
            '</div>';
    }

    function renderLivePanel(app) {
        var profile = app.currentProfile || null;
        var posts = (app.currentPosts || []).slice().sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
        var avatar = profile && (profile._profilePicData || profile.profilePicUrl);

        var fetched = profile && profile.fetchedAt ? new Date(profile.fetchedAt).toLocaleString() : '—';
        var header = profile ? (
            '<div class="pinv-profile">' +
            (avatar ? '<img src="' + esc(avatar) + '" alt="" class="pinv-avatar">' : '<div class="pinv-avatar pinv-avatar-empty">📷</div>') +
            '<div style="min-width:0;">' +
            '<div class="pinv-profile-name">' + esc(profile.fullName || profile.username || '—') + '</div>' +
            '<div class="pinv-profile-handle">@' + esc(profile.username || '') +
            (profile.isVerified ? ' · verified' : '') + '</div>' +
            '</div></div>' +
            '<div class="pinv-profile-stats">' +
            '<span><b>' + esc(app.fmt ? app.fmt(profile.followers) : profile.followers) + '</b> followers</span>' +
            '<span><b>' + esc(app.fmt ? app.fmt(profile.posts) : profile.posts) + '</b> posts on the account</span>' +
            '<span><b>' + posts.length + '</b> retrieved</span>' +
            (profile.externalUrl ? '<a href="' + esc(profile.externalUrl) + '" target="_blank" rel="noopener">' + esc(profile.externalUrl.replace(/^https?:\/\//, '').slice(0, 34)) + ' ↗</a>' : '') +
            '</div>' +
            (profile.bio ? '<div class="pinv-profile-bio">' + esc(profile.bio.slice(0, 240)) + '</div>' : '') +
            '<div class="pinv-muted" style="font-size:.7rem;margin-top:.4rem;">Profile fetched ' + esc(fetched) + '</div>'
        ) : '<div class="pinv-empty">No profile loaded yet.</div>';

        var postCards = posts.slice(0, 12).map(function (p) {
            var img = p._thumbnailData || p.thumbnail;
            var date = p.timestamp ? new Date(p.timestamp * 1000).toLocaleDateString() : (p.ogDate || '—');
            var engagement = (p.likes != null || p.comments != null)
                ? '<div><b>' + esc(app.fmt ? app.fmt(p.likes) : p.likes) + '</b> ❤️ · <b>' + esc(app.fmt ? app.fmt(p.comments) : p.comments) + '</b> 💬</div>'
                : '<div class="pinv-muted">engagement not exposed</div>';
            return '<div class="pinv-post">' +
                (img ? '<img src="' + esc(img) + '" alt="' + esc(p.shortcode) + '" loading="lazy">' : '<div class="pinv-noimg">📷</div>') +
                '<div class="pinv-post-meta">' + engagement +
                '<div class="pinv-muted">' + esc(date) + ' · ' + esc(p.postType || 'post') + '</div>' +
                (p.shortcode ? '<a href="' + esc(p.url || ('https://www.instagram.com/p/' + p.shortcode + '/')) + '" target="_blank" rel="noopener">open ↗</a>' : '') +
                '</div></div>';
        }).join('');

        return '' +
            '<div class="pinv-live">' +
            '<div class="card pinv-card" style="padding:1rem;">' + header +
            '<div class="pinv-row-actions">' +
            '<button id="pinvRefreshLive" class="btn btn-secondary" style="font-size:.76rem;">🔄 Scan live now</button>' +
            (profile ? '<button id="pinvFullHistory" class="btn btn-secondary" style="font-size:.76rem;">📚 Walk the full history</button>' : '') +
            '</div>' +
            '<div id="pinvLiveStatus" class="pinv-muted" style="font-size:.72rem;margin-top:.4rem;"></div>' +
            '</div>' +
            '<div>' +
            '<div class="pinv-coverage">📉 ' + esc(coverageLine(app)) + '</div>' +
            (postCards ? '<div class="pinv-posts">' + postCards + '</div>'
                : '<div class="pinv-empty">No posts on screen. Load the saved scan or run a scan to fill this in.</div>') +
            '</div></div>';
    }

    /* ═══ Small building blocks ══════════════════════════════════════════ */

    function statTile(value, label, hint) {
        return '<div class="pinv-stat" title="' + esc(hint || label) + '"><b>' + esc(value) + '</b><span>' + esc(label) + '</span></div>';
    }

    function bar(value, max, cls) {
        var pct = max ? Math.max(2, Math.round((value / max) * 100)) : 0;
        return '<span class="pinv-bar ' + (cls || '') + '" style="width:' + pct + '%"></span>';
    }

    /** A horizontal bar list — the fallback when Chart.js is unavailable. */
    function barList(entries, total) {
        if (!entries.length) return '<p class="pinv-muted">Nothing to chart yet.</p>';
        var max = entries.reduce(function (m, e) { return Math.max(m, e.value); }, 0);
        return '<div class="pinv-barlist">' + entries.map(function (e) {
            var pct = total ? Math.round((e.value / total) * 100) : null;
            return '<div class="pinv-barlist-row">' +
                '<span class="pinv-barlist-label" title="' + esc(e.key) + '">' + esc(e.key) + '</span>' +
                '<span class="pinv-barlist-track">' + bar(e.value, max) + '</span>' +
                '<span class="pinv-barlist-value">' + e.value + (pct != null ? ' <span class="pinv-muted">' + pct + '%</span>' : '') + '</span>' +
                '</div>';
        }).join('') + '</div>';
    }

    /* ═══ Tabs ═══════════════════════════════════════════════════════════ */

    var TABS = [
        { id: 'overview', label: '📊 Overview & analytics', hint: 'What the inventory adds up to — and what it cannot' },
        { id: 'inventory', label: '🗂️ Inventory', hint: 'Every project, sortable and filterable' },
        { id: 'add', label: '➕ Add a project', hint: 'Record a project you have the details for' },
        { id: 'live', label: '📡 Live Instagram data', hint: 'The most recent scan, and how to get more' },
        { id: 'guide', label: '📖 Field guide & sources', hint: 'What to record, where the data came from' }
    ];

    function renderTabs() {
        return '<div class="pinv-tabs" role="tablist">' + TABS.map(function (t) {
            var on = state.tab === t.id;
            return '<button class="pinv-tab' + (on ? ' active' : '') + '" data-tab="' + t.id + '" role="tab" aria-selected="' + on + '" title="' + esc(t.hint) + '">' +
                esc(t.label) + '</button>';
        }).join('') + '</div>';
    }

    /* ═══ Overview ═══════════════════════════════════════════════════════ */

    function renderOverview(app) {
        var rows = allRows();
        var s = stats(rows);
        var a = analytics(rows);
        var findings = auditRows(rows);
        var totals = auditTotals(findings);
        var hasChart = typeof window !== 'undefined' && typeof window.Chart !== 'undefined';

        var statusEntries = a.byStatus.map(function (e) { return e; });
        var statusTotal = statusEntries.reduce(function (n, e) { return n + e.value; }, 0);

        // Fields that are almost always empty are the story of this inventory:
        // the sources say what was done, rarely what it cost or exactly when.
        var weakest = a.completeness.slice().sort(function (x, y) { return x.percent - y.percent; }).slice(0, 4);
        var strongest = a.completeness.slice().sort(function (x, y) { return y.percent - x.percent; }).slice(0, 3);

        var locationRows = rows.filter(function (r) { return hasValue(r.values.location); }).length;
        // Beneficiary figures are NOT added up: the rows describe different
        // things (a workshop for 20, a programme for 1,300) and some repeat the
        // same project on two year pages, so a sum would be a made-up number.
        var kidsRows = rows.filter(function (r) { return beneficiaryCount(r.values.beneficiaries) != null; });
        var biggest = kidsRows.slice().sort(function (x, y) {
            return beneficiaryCount(y.values.beneficiaries) - beneficiaryCount(x.values.beneficiaries);
        })[0];
        var kidsLine = kidsRows.length
            ? kidsRows.length + ' rows state a figure; the largest single figure named is ' +
              beneficiaryCount(biggest.values.beneficiaries).toLocaleString() + ' (' + biggest.values.id + ')'
            : 'no row states a figure';

        return '' +
            '<div class="pinv-hero">' +
            '<img src="' + esc(heroImage(app)) + '" alt="SmallWorld Foundation" onerror="this.style.display=\'none\'">' +
            '<div class="pinv-hero-text">' +
            '<h2>SmallWorld Foundation — Project Inventory</h2>' +
            '<p>' + s.total + ' projects from the SmallWorld Project Inventory &amp; Progress Tracker workbook — ' +
            'the same fields and rows the team records there, with every gap left visible.</p>' +
            '</div>' +
            '<div class="pinv-hero-side">' +
            '<span class="pinv-badge" style="color:#a78bfa;">' + s.total + ' projects</span>' +
            '<span class="pinv-badge delivered">' + s.documented + '% documented</span>' +
            '</div>' +
            '</div>' +

            '<div class="pinv-stats">' +
            statTile(s.total, 'Projects', 'Rows imported from the tracker workbook plus your own additions') +
            statTile(s.countries, 'Countries', s.countryList.slice(0, 6).join(', ') + (s.countryList.length > 6 ? '…' : '')) +
            statTile(s.range, 'Years covered', 'First and last year recorded in the workbook') +
            statTile(s.documented + '%', 'Fields filled in', s.filled + ' of ' + s.cells + ' data-field cells hold a value — a dash counts as empty, and the notes column is excluded') +
            statTile(s.withAmount, 'Amounts stated (of ' + s.total + ')', 'Rows whose donation cell records an amount — the biggest hole in this data') +
            statTile(s.userAdded, 'Added by you', 'Projects you recorded yourself in this app') +
            '</div>' +

            '<div class="section-title">📈 What the inventory adds up to</div>' +
            '<div class="pinv-chart-grid">' +
            '<div class="pinv-chart-card"><h4>Projects per year</h4>' +
            '<p class="pinv-muted">One bar per year the sources cover. Rows whose year is a span (2019–2020) sit at the first year of the span.</p>' +
            (hasChart ? '<div class="pinv-canvas-wrap"><canvas id="pinvYearChart"></canvas></div>'
                : barList(a.byYear.map(function (e) { return { key: String(e.year), value: e.count }; }), s.total)) +
            '</div>' +
            '<div class="pinv-chart-card"><h4>Projects per country</h4>' +
            '<p class="pinv-muted">Top 12 of ' + s.countries + ' countries. Composite rows (“Syria and Turkey”) are counted once, under their own label.</p>' +
            (hasChart ? '<div class="pinv-canvas-wrap"><canvas id="pinvCountryChart"></canvas></div>' : barList(a.byCountry, s.total)) +
            '</div>' +
            '<div class="pinv-chart-card"><h4>Project status</h4>' +
            '<p class="pinv-muted">Grouped from the wording in the workbook: “Completed” counts as Delivered, “Under procsseding” as In progress.</p>' +
            (hasChart ? '<div class="pinv-canvas-wrap"><canvas id="pinvStatusChart"></canvas></div>' : barList(statusEntries, statusTotal)) +
            '</div>' +
            '<div class="pinv-chart-card"><h4>Type of support</h4>' +
            '<p class="pinv-muted">The support category recorded for each project.</p>' +
            barList(a.byCategory, s.total) +
            '</div>' +
            '</div>' +

            '<div class="pinv-two-col">' +
            '<div class="card pinv-card"><div class="pinv-card-title">🧮 Reach, as far as the sources state it</div>' +
            '<table class="pinv-kv">' +
            '<tr><th>Beneficiary figures</th><td>' + esc(kidsLine) + '</td></tr>' +
            '<tr><th>Rows with a beneficiary figure</th><td>' + s.kidsKnown + ' of ' + s.total + ' (the rest say “count not stated”)</td></tr>' +
            '<tr><th>Rows with a named beneficiary organisation</th><td>' + rows.filter(function (r) { return hasValue(r.values.org); }).length + ' of ' + s.total + '</td></tr>' +
            '<tr><th>Rows with a city/town recorded</th><td>' + locationRows + ' of ' + s.total + '</td></tr>' +
            '<tr><th>Rows with an amount</th><td>' + s.withAmount + ' of ' + s.total + '</td></tr>' +
            '<tr><th>Rows with a delivery date</th><td>' + s.withDate + ' of ' + s.total + '</td></tr>' +
            '<tr><th>Rows with attachments</th><td>' + s.attached + ' of ' + s.total +
            (s.attachFiles ? ' (' + s.attachFiles + ' files)' : '') + '</td></tr>' +
            '<tr><th>Rows with “Missing information” filled in</th><td>' + s.gaps + ' of ' + s.total + '</td></tr>' +
            '</table>' +
            '<p class="pinv-muted" style="font-size:.74rem;">The beneficiary figures are deliberately not added up: they count ' +
            'different things (a school programme with 1,000+ pupils, a single course with 10), and a total would imply a ' +
            'precision the workbook does not have. The workbook leaves the “Missing information” column blank, so the ' +
            'double-check below reports the gaps each row actually shows.</p>' +
            '</div>' +

            '<div class="card pinv-card"><div class="pinv-card-title">🧩 Where the data is strong and where it is thin</div>' +
            '<div class="pinv-strength">' +
            '<div><div class="pinv-muted">Best recorded</div>' + strongest.map(function (c) {
                return '<div class="pinv-strength-row"><span>' + esc(c.field) + '</span><span class="pinv-strong">' + c.percent + '%</span></div>';
            }).join('') + '</div>' +
            '<div><div class="pinv-muted">Thinnest</div>' + weakest.map(function (c) {
                return '<div class="pinv-strength-row"><span>' + esc(c.field) + '</span><span class="pinv-weak">' + c.percent + '%</span></div>';
            }).join('') + '</div>' +
            '</div>' +
            '<div class="pinv-barlist" style="margin-top:.7rem;">' + a.completeness.map(function (c) {
                return '<div class="pinv-barlist-row">' +
                    '<span class="pinv-barlist-label" title="' + esc(c.field) + '">' + esc(c.field) + '</span>' +
                    '<span class="pinv-barlist-track">' + bar(c.percent, 100, c.percent < 25 ? 'warn' : (c.percent > 75 ? 'good' : '')) + '</span>' +
                    '<span class="pinv-barlist-value">' + c.percent + '%</span>' +
                    '</div>';
            }).join('') + '</div>' +
            '</div>' +
            '</div>' +

            renderAuditSummary(findings, totals) +

            renderInstagramAnalytics(app);
    }

    /**
     * The identification picture: the live profile photo of the account whose
     * data this is, falling back to the app's own logo file. A picture of the
     * organisation is a genuine identifier; nothing is invented to fill the gap.
     */
    function heroImage(app) {
        var p = app.currentProfile;
        if (p && (p._profilePicData || p.profilePicUrl)) return p._profilePicData || p.profilePicUrl;
        return IDENTITY_IMAGE;
    }

    function renderAuditSummary(findings, totals) {
        var sevClass = { high: 'danger', medium: 'warn', low: 'info', info: 'muted' };
        var sevLabel = { high: 'Check now', medium: 'Worth fixing', low: 'Cosmetic', info: 'Coverage note' };
        return '<div class="section-title">🔍 Double-check — what a second pass found</div>' +
            '<div class="card pinv-card">' +
            '<p class="pinv-muted" style="font-size:.8rem;margin:0 0 .7rem;line-height:1.55;">' +
            'These checks compare the rows with each other, not with the outside world: the same project recorded twice, ' +
            'a year that is really a range, a country written two ways, an amount mentioned but not recorded. ' +
            '<b>' + findings.length + ' finding' + (findings.length === 1 ? '' : 's') + ' across ' + totals.rowsFlaggedCount +
            ' row' + (totals.rowsFlaggedCount === 1 ? '' : 's') + '</b> — every finding names the rows it came from, and ' +
            '<em>Show these rows</em> opens them in the inventory. Nothing is corrected automatically: the sources decide what is ' +
            'right, so a correction is a decision, not a guess.</p>' +
            '<div class="pinv-audit-grid">' + findings.map(function (f, i) {
                var open = state.expanded['audit-' + f.key];
                return '<div class="pinv-audit ' + sevClass[f.severity] + '">' +
                    '<div class="pinv-audit-head">' +
                    '<span class="pinv-audit-sev">' + esc(sevLabel[f.severity]) + '</span>' +
                    '<span class="pinv-audit-title">' + esc(f.title) + '</span>' +
                    (f.ids.length ? '<span class="pinv-audit-count">' + f.ids.length + ' row' + (f.ids.length === 1 ? '' : 's') + '</span>' : '') +
                    '</div>' +
                    '<div class="pinv-audit-detail">' + esc(f.detail) + '</div>' +
                    (f.ids.length ? '<div class="pinv-audit-rows">' + f.ids.slice(0, 12).map(function (id) {
                        return '<button class="pinv-chip" data-goto="' + esc(id) + '" title="Show this row in the inventory">' + esc(id) + '</button>';
                    }).join('') + (f.ids.length > 12 ? '<span class="pinv-muted">+' + (f.ids.length - 12) + ' more</span>' : '') + '</div>' : '') +
                    (f.ids.length ? '<button class="btn btn-secondary pinv-audit-filter" data-audit="' + esc(f.key) + '" style="font-size:.7rem;padding:.2rem .5rem;">Show these rows</button>' : '') +
                    '</div>';
            }).join('') + '</div>' +
            '</div>';
    }

    /** The Instagram side of the same story: what the feed shows right now. */
    function renderInstagramAnalytics(app) {
        var posts = app.currentPosts || [];
        var profile = app.currentProfile || null;
        if (!posts.length) {
            return '<div class="section-title">📸 The Instagram side</div>' +
                '<div class="card pinv-card"><p class="pinv-muted" style="font-size:.8rem;margin:0;line-height:1.55;">' +
                'No posts loaded, so there is nothing to chart. Open <b>Live Instagram data</b> and load the saved scan ' +
                '(no network needed) or run a scan.</p></div>';
        }
        var withLikes = posts.filter(function (p) { return p.likes != null; });
        var withComments = posts.filter(function (p) { return p.comments != null; });
        var sum = function (list, k) { return list.reduce(function (n, p) { return n + (p[k] || 0); }, 0); };
        var avgLikes = withLikes.length ? Math.round(sum(withLikes, 'likes') / withLikes.length) : null;
        var avgComments = withComments.length ? Math.round(sum(withComments, 'comments') / withComments.length) : null;
        var dated = posts.filter(function (p) { return p.timestamp; });
        var first = dated.length ? Math.min.apply(null, dated.map(function (p) { return p.timestamp; })) : null;
        var last = dated.length ? Math.max.apply(null, dated.map(function (p) { return p.timestamp; })) : null;
        var er = (profile && profile.followers && avgLikes != null)
            ? (((avgLikes + (avgComments || 0)) / profile.followers) * 100) : null;
        var best = withLikes.slice().sort(function (a, b) { return (b.likes || 0) - (a.likes || 0); })[0];

        return '<div class="section-title">📸 The Instagram side</div>' +
            '<div class="pinv-two-col">' +
            '<div class="card pinv-card"><div class="pinv-card-title">Feed snapshot — ' + posts.length + ' posts</div>' +
            '<table class="pinv-kv">' +
            '<tr><th>Followers (as shown)</th><td>' + esc(profile && profile.followers != null ? app.fmt(profile.followers) : '—') + '</td></tr>' +
            '<tr><th>Posts on the account</th><td>' + esc(profile && profile.posts != null ? app.fmt(profile.posts) : '—') + '</td></tr>' +
            '<tr><th>Retrieved</th><td>' + posts.length + (profile && profile.posts ? ' of ' + app.fmt(profile.posts) + ' (' + Math.round(posts.length / profile.posts * 1000) / 10 + '%)' : '') + '</td></tr>' +
            '<tr><th>Posts with like counts</th><td>' + withLikes.length + ' of ' + posts.length + '</td></tr>' +
            '<tr><th>Average likes</th><td>' + (avgLikes != null ? app.fmt(avgLikes) : '—') + '</td></tr>' +
            '<tr><th>Average comments</th><td>' + (avgComments != null ? app.fmt(avgComments) : '—') + '</td></tr>' +
            '<tr><th>Engagement rate</th><td>' + (er != null ? er.toFixed(2) + '%' : '— (needs a follower count and likes)') + '</td></tr>' +
            (first ? '<tr><th>Oldest retrieved post</th><td>' + new Date(first * 1000).toLocaleDateString() + '</td></tr>' : '') +
            (last ? '<tr><th>Newest retrieved post</th><td>' + new Date(last * 1000).toLocaleDateString() + '</td></tr>' : '') +
            '</table>' +
            '<p class="pinv-muted" style="font-size:.74rem;">Averages use only the posts whose counts Instagram actually ' +
            'exposed — the row “posts with like counts” says how many that is.</p>' +
            '</div>' +
            '<div class="card pinv-card"><div class="pinv-card-title">Best performing post in the retrieved set</div>' +
            (best ? '<div class="pinv-best">' +
                (best._thumbnailData || best.thumbnail ? '<img src="' + esc(best._thumbnailData || best.thumbnail) + '" alt="" loading="lazy">' : '<div class="pinv-noimg">📷</div>') +
                '<div>' +
                '<div><b>' + esc(app.fmt(best.likes)) + '</b> likes · <b>' + esc(app.fmt(best.comments)) + '</b> comments</div>' +
                '<div class="pinv-muted">' + esc(best.timestamp ? new Date(best.timestamp * 1000).toLocaleDateString() : (best.ogDate || 'date unknown')) +
                ' · ' + esc(best.postType || 'post') + '</div>' +
                (best.caption ? '<div class="pinv-caption">' + esc(String(best.caption).slice(0, 220)) + '</div>' : '<div class="pinv-muted">caption not exposed</div>') +
                (best.shortcode ? '<a href="https://www.instagram.com/p/' + esc(best.shortcode) + '/" target="_blank" rel="noopener">open on Instagram ↗</a>' : '') +
                '</div></div>'
                : '<p class="pinv-muted">No post in the retrieved set carries a like count.</p>') +
            '</div>' +
            '</div>';
    }

    /* ═══ Inventory ══════════════════════════════════════════════════════ */

    var KEY_FIELDS = ['id', 'year', 'name', 'country', 'category', 'status', 'missing'];

    /** Columns actually shown, in the guide's order, then the added ones. */
    function visibleFields() {
        if (state.columns !== 'key') return FIELDS;
        var custom = COLUMNS.custom.map(function (f) { return f.key; });
        return FIELDS.filter(function (f) {
            return KEY_FIELDS.indexOf(f.key) !== -1 || custom.indexOf(f.key) !== -1;
        });
    }

    function statusOptions() {
        var groups = ['all'].concat(analytics(allRows()).byStatus.map(function (e) { return e.key; }));
        return groups;
    }

    function sortOptionsHtml() {
        var presets = [
            { k: 'year', label: 'Year (newest first)' },
            { k: 'name', label: 'Project name (A–Z)' },
            { k: 'country', label: 'Country (A–Z)' },
            { k: 'completeness', label: 'Most complete first' },
            { k: 'gaps', label: 'Most missing information first' },
            { k: 'beneficiaries', label: 'Largest beneficiary count' },
            { k: 'index', label: 'Source order (as recorded)' }
        ];
        var fieldOpts = FIELDS.map(function (f) { return { k: f.key, label: 'Field: ' + f.field }; });
        return presets.concat(fieldOpts).map(function (o) {
            return '<option value="' + o.k + '"' + (state.sortKey === o.k ? ' selected' : '') + '>' + esc(o.label) + '</option>';
        }).join('');
    }

    /** One attachment's row inside the expanded project. */
    function renderAttachmentItem(projectId, a) {
        var meta = attachTypeMeta(a.type);
        var href = attachmentHref(a);
        var name = esc(a.name || 'file');
        var nameHtml = href
            ? '<a class="pinv-attach-name" href="' + esc(href) + '"' +
              (a.stored === 'embed' ? ' download="' + name + '"' : ' target="_blank" rel="noopener"') +
              ' title="' + esc(a.path || a.name || '') + '">' + name + '</a>'
            : '<span class="pinv-attach-name">' + name + '</span>';
        return '<div class="pinv-attach-item">' +
            '<span class="pinv-attach-fileicon">' + esc(meta.icon) + '</span>' +
            nameHtml +
            '<span class="pinv-attach-meta">' + esc(attachmentSizeLabel(a.size)) +
            (a.stored === 'link' ? ' · linked file' : ' · copied into the app') + '</span>' +
            '<button class="pinv-attach-del" data-attach-del="' + esc(a.id) + '" data-attach-for="' + esc(projectId) + '" ' +
            'title="Remove this attachment" aria-label="Remove ' + name + '">✕</button>' +
            '</div>';
    }

    /** Attachments for one project, grouped and counted by type. */
    function renderAttachments(projectId, attachments) {
        var groups = {};
        (attachments || []).forEach(function (a) {
            var k = attachTypeMeta(a.type).key;
            (groups[k] = groups[k] || []).push(a);
        });
        var grouped = ATTACHMENT_TYPES.filter(function (t) { return groups[t.key]; }).map(function (t) {
            var items = groups[t.key];
            return '<div class="pinv-attach-group">' +
                '<div class="pinv-attach-group-title">' + esc(t.icon) + ' ' + esc(t.label) +
                ' <span class="pinv-muted">' + items.length + '</span></div>' +
                items.map(function (a) { return renderAttachmentItem(projectId, a); }).join('') +
                '</div>';
        }).join('');

        var notice = (state.attachNotice && state.attachNotice.id === projectId) ? state.attachNotice : null;
        var options = '<option value="auto">Auto (by file type)</option>' + ATTACHMENT_TYPES.map(function (t) {
            return '<option value="' + t.key + '">' + esc(t.icon + ' ' + t.label) + '</option>';
        }).join('');

        return '<div class="pinv-attach" data-attach-project="' + esc(projectId) + '">' +
            '<div class="pinv-attach-head">' +
            '<div class="pinv-attach-title">📎 Attachments <span class="pinv-muted">' +
            (attachments.length ? attachments.length + ' file' + (attachments.length === 1 ? '' : 's') + ' · grouped by type' : 'none yet — choose a type, then add files') +
            '</span></div>' +
            '<div class="pinv-attach-controls">' +
            '<select data-attach-type="' + esc(projectId) + '" title="Attachment type for the files you add">' + options + '</select>' +
            '<label class="btn btn-secondary pinv-attach-pick" title="Attach files to this project">＋ Add files' +
            '<input type="file" multiple data-attach-input="' + esc(projectId) + '"></label>' +
            '</div></div>' +
            (notice ? '<p class="pinv-attach-status' + (notice.error ? ' error' : '') + '">' + esc(notice.text) + '</p>' : '') +
            (grouped || '<p class="pinv-muted" style="margin:.3rem 0 0;font-size:.76rem;">No attachments yet.</p>') +
            '<p class="pinv-attach-note">Files up to 1 MB are copied into this app, so they open offline and in the browser preview. ' +
            'Larger files are never copied — the desktop app keeps a link to the file on disk. Attachments live beside the row; ' +
            'the 17 workbook columns stay exactly as recorded.</p>' +
            '</div>';
    }

    function renderInventoryTable(rows) {
        var fields = visibleFields();
        var editField = state.editColumn ? FIELDS.filter(function (f) { return f.key === state.editColumn; })[0] : null;
        var editDraftCount = Object.keys(state.editDraft).length;
        var size = String(state.pageSize) === 'all' ? rows.length : parseInt(state.pageSize, 10);
        var pages = Math.max(1, Math.ceil(rows.length / (size || 25)));
        if (state.page > pages) state.page = pages;
        var start = (state.page - 1) * (size || 25);
        var pageRows = String(state.pageSize) === 'all' ? rows : rows.slice(start, start + size);
        var offset = String(state.pageSize) === 'all' ? 0 : start;

        var head = '<th class="pinv-sticky" title="Identification — a photograph of the project where the sources have one, otherwise a generated tile"><span class="pinv-th-inner"><span class="pinv-th-label">Picture</span></span></th>' +
            '<th class="pinv-numcol" data-sort="index" title="Sort by the order the rows were recorded"><span class="pinv-th-inner"><span class="pinv-th-label">#</span></span></th>' +
            fields.map(function (f) {
                var on = state.sortKey === f.key;
                var cf = state.columnFilters[f.key];
                var active = !!(cf && ((cf.text && String(cf.text).trim()) || (cf.values && cf.values.length)));
                var thCls = (on ? 'pinv-active ' : '') + ((active || state.editColumn === f.key) ? 'pinv-hasfilter ' : '') +
                    (f.key === 'id' ? 'pinv-idcol' : '');
                return '<th data-sort="' + f.key + '" data-key="' + f.key + '"' + (thCls.trim() ? ' class="' + thCls.trim() + '"' : '') +
                    ' title="Sort by ' + esc(f.field) + ' — ' + esc(f.what) + '"><span class="pinv-th-inner">' +
                    '<span class="pinv-th-label">' + esc(f.field) + '</span>' +
                    '<span class="pinv-sort">' + (on ? (state.sortDir > 0 ? '▲' : '▼') : '↕') + '</span>' +
                    '<span class="pinv-th-actions">' +
                    '<button class="pinv-colfilter' + (active ? ' active' : '') + '" data-colfilter="' + f.key + '" ' +
                    'title="Filter ' + esc(f.field) + ' by a value or keyword" aria-label="Filter ' + esc(f.field) + '">▾</button>' +
                    '<button class="pinv-editcol' + (state.editColumn === f.key ? ' active' : '') + '" data-editcol="' + f.key + '" ' +
                    'title="Edit ' + esc(f.field) + ' values inline" aria-label="Edit ' + esc(f.field) + '">✎</button>' +
                    '</span></span></th>';
            }).join('') + '<th class="pinv-numcol"></th>';

        var body = pageRows.map(function (r) {
            var open = !!state.expanded[r.values.id];
            var badge = r.origin === 'user' ? '<span class="pinv-badge user">yours</span>' : '';
            var cells = fields.map(function (f) {
                var v = r.values[f.key] || '';
                var blank = isBlank(v);
                var cls = blank ? ' pinv-blank' : '';
                var attrs = ' data-cell-row="' + esc(r.id) + '" data-cell-key="' + f.key + '"';
                if (state.editColumn === f.key) {
                    var hasDraft = Object.prototype.hasOwnProperty.call(state.editDraft, r.id);
                    var shown = hasDraft ? state.editDraft[r.id] : String(v);
                    return '<td class="pinv-editing"' + attrs + '><input class="pinv-cellinput" data-cell-row="' + esc(r.id) +
                        '" data-cell-key="' + f.key + '" list="pinvEditList" autocomplete="off" value="' + esc(shown) + '" ' +
                        'aria-label="' + esc(f.field) + ' for ' + esc(r.values.id) + '"></td>';
                }
                // Double-click any cell to rewrite just that cell, with a
                // dropdown when the column has a known set of values.
                if (state.cellEdit && state.cellEdit.row === r.id && state.cellEdit.key === f.key) {
                    return renderCellEditor(r, f);
                }
                var edited = !!(r._edited && r._edited[f.key]);
                var editedCls = edited ? ' pinv-edited' : '';
                var hasOriginal = !!(r._original && Object.prototype.hasOwnProperty.call(r._original, f.key));
                var editedTitle = edited
                    ? (hasOriginal
                        ? 'Edited in this app — the workbook says: ' + String(r._original[f.key] == null ? '' : r._original[f.key])
                        : 'Typed into a column added in this app')
                    : '';
                if (f.key === 'id') {
                    var files = attachmentsFor(attachKeyOf(r)).length;
                    var clip = files ? '<span class="pinv-attach-count" title="' + files + ' attachment' + (files === 1 ? '' : 's') + ' on this project">📎 ' + files + '</span>' : '';
                    return '<td class="pinv-id pinv-idcol' + editedCls + '"' + attrs + (editedTitle ? ' title="' + esc(editedTitle) + '"' : '') + '>' + esc(v) + badge + clip + '</td>';
                }
                if (f.key === 'status') {
                    var g = statusGroup(v);
                    return '<td class="pinv-status-cell' + editedCls + '"' + attrs + ' title="' + esc(v) + '">' +
                        '<span class="pinv-badge ' + (g === 'Delivered' ? 'delivered' : (g === 'Planned' ? 'planned' : 'progress')) + '">' + esc(g) + '</span>' +
                        '<div class="pinv-sub">' + esc(v) + '</div></td>';
                }
                if (f.key === 'year' && isYearRange(v)) {
                    return '<td' + attrs + (editedTitle ? ' title="' + esc(editedTitle) + '"' : '') + '>' +
                        '<span class="pinv-clamp">⚑ ' + esc(v) + '</span>' +
                        '<div class="pinv-sub" title="A span, not a single year">span</div></td>';
                }
                var title = editedTitle || (String(v).length > 30 ? v : '');
                return '<td' + attrs + (cls || edited ? ' class="' + (cls + editedCls).trim() + '"' : '') + (title ? ' title="' + esc(title) + '"' : '') +
                    '>' + (blank
                        ? '<span class="pinv-dash" aria-label="nothing recorded">—</span>'
                        : '<span class="pinv-clamp">' + esc(v) + '</span>') + '</td>';
            }).join('');

            var main = '<tr class="' + (open ? 'pinv-open' : '') + '" data-row="' + esc(r.values.id) + '">' +
                '<td class="pinv-sticky pinv-art"><img class="pinv-thumb" src="' + esc(imageFor(r)) + '" alt="" loading="lazy" ' +
                'onerror="this.onerror=null;this.src=this.dataset.fallback" data-fallback="' + esc(flagTile(r.values.id, r.values.country)) + '"></td>' +
                '<td class="pinv-num">' + (offset + pageRows.indexOf(r) + 1) + '</td>' +
                cells +
                '<td class="pinv-num pinv-expandcell"><button class="pinv-expand" data-expand="' + esc(r.values.id) + '" aria-expanded="' + open + '" title="' +
                (open ? 'Hide every field' : 'Show every field for this project') + '">' + (open ? '▾' : '▸') + '</button></td>' +
                '</tr>';

            if (!open) return main;

            var detail = FIELDS.map(function (f) {
                var v = r.values[f.key] || '';
                var isEdited = !!(r._edited && r._edited[f.key]);
                var hasOrig = !!(r._original && Object.prototype.hasOwnProperty.call(r._original, f.key));
                return '<div class="pinv-detail-field' + (isBlank(v) ? ' pinv-flag' : '') + '">' +
                    '<dt>' + esc(f.field) + (isEdited ? ' <span class="pinv-edited-tag">edited</span>' : '') + '</dt>' +
                    '<dd>' + esc(v) +
                    (isEdited && hasOrig ? '<div class="pinv-edited-orig">Workbook value: ' + esc(r._original[f.key]) + '</div>' : '') +
                    '<div class="pinv-muted">' + esc(f.what) + '</div></dd></div>';
            }).join('');
            var actions = r.origin === 'user'
                ? '<button class="btn btn-secondary pinv-edit" data-user="' + r.userIndex + '" style="font-size:.7rem;padding:.2rem .5rem;">Edit</button>' +
                  '<button class="btn btn-danger pinv-del" data-user="' + r.userIndex + '" style="font-size:.7rem;padding:.2rem .5rem;">Delete</button>'
                : '';
            var links = '';
            var loc = String(r.values.fileLocation || '');
            var urls = loc.match(/https?:\/\/[^\s|]+/g) || [];
            links = urls.slice(0, 3).map(function (u) {
                return '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u.replace(/^https?:\/\//, '').slice(0, 40)) + ' ↗</a>';
            }).join(' ');

            // The detail block spans the picture + ID columns, so the 64px preview
            // has room inside the sticky block instead of overflowing it.
            return main + '<tr class="pinv-detail-row"><td class="pinv-sticky pinv-detail-art" colspan="2">' +
                '<img src="' + esc(imageFor(r)) + '" alt="" loading="lazy" onerror="this.onerror=null;this.src=this.dataset.fallback" data-fallback="' + esc(flagTile(r.values.id, r.values.country)) + '">' +
                '<div class="pinv-detail-id">' + esc(r.values.id) + '</div>' +
                (links ? '<div class="pinv-detail-links">' + links + '</div>' : '') +
                '</td><td colspan="' + (fields.length + 1) + '">' +
                '<dl class="pinv-detail">' + detail + '</dl>' +
                renderAttachments(attachKeyOf(r), attachmentsFor(attachKeyOf(r))) +
                (actions ? '<div class="pinv-row-actions">' + actions + '</div>' : '') +
                '</td></tr>';
        }).join('');

        if (!rows.length) {
            return '<div class="pinv-empty">No rows match this filter. Clear the search or the filters above.</div>';
        }

        var editBar = state.editColumn && editField
            ? '<div class="pinv-editbar">' +
              '<span>✎ Editing <b>' + esc(editField.field) + '</b> — type a value or pick a suggestion. ' +
              '<span id="pinvEditCount">' + (editDraftCount ? '<b>' + editDraftCount + '</b> unsaved change' + (editDraftCount === 1 ? '' : 's') + '.' : '') + '</span></span>' +
              '<span class="pinv-editbar-actions">' +
              '<button id="pinvEditSave" class="btn btn-primary" style="font-size:.74rem;">Save changes</button>' +
              '<button id="pinvEditCancel" class="btn btn-secondary" style="font-size:.74rem;">Cancel</button>' +
              '</span></div>'
            : '';

        var listValues = {};
        if (state.editColumn) {
            allRows().forEach(function (rr) {
                var val = String(rr.values[state.editColumn] == null ? '' : rr.values[state.editColumn]).trim();
                if (val && val !== '—') listValues[val] = 1;
            });
        }
        var dataList = state.editColumn
            ? '<datalist id="pinvEditList">' + Object.keys(listValues).slice(0, 500).map(function (val) {
                return '<option value="' + esc(val) + '"></option>';
            }).join('') + '</datalist>'
            : '';

        var pager = '';
        if (String(state.pageSize) !== 'all' && pages > 1) {
            pager = '<div class="pinv-pager">' +
                '<button class="btn btn-secondary" data-page="' + (state.page - 1) + '"' + (state.page === 1 ? ' disabled' : '') + '>‹ Prev</button>' +
                '<span>Page ' + state.page + ' of ' + pages + ' · rows ' + (start + 1) + '–' + Math.min(rows.length, start + size) + ' of ' + rows.length + '</span>' +
                '<button class="btn btn-secondary" data-page="' + (state.page + 1) + '"' + (state.page === pages ? ' disabled' : '') + '>Next ›</button>' +
                '</div>';
        }

        // Fixed column widths (not auto layout): every row is the same height and
        // a long description can never push a column wider than its budget.
        var cols = '<colgroup><col class="pinv-col-art"><col class="pinv-col-num">' +
            fields.map(function (f) { return '<col style="width:' + columnWidth(f) + 'px">'; }).join('') +
            '<col class="pinv-col-num"></colgroup>';

        return editBar + '<div class="pinv-table-wrap"><table class="pinv-table">' + cols +
            '<thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>' +
            dataList + pager + renderColumnFilterPopover();
    }

    /** Width budget per column, in pixels. Workbook columns get a hand-picked
        width so the grid reads like a spreadsheet; an added column gets a
        sensible default by type. */
    function columnWidth(f) {
        var widths = {
            id: 112, year: 104, name: 236, country: 112, location: 146,
            org: 204, instType: 138, description: 248, category: 168,
            beneficiaries: 168, donation: 112, deliveryDate: 148, status: 126,
            documentation: 176, fileLocation: 158, missing: 168, duration: 138
        };
        if (Object.prototype.hasOwnProperty.call(widths, f.key)) return widths[f.key];
        return f.type === 'dropdown' ? 148 : 168;
    }

    /** The per-column dropdown: exact values, a keyword, or both. */
    function renderColumnFilterPopover() {
        if (!state.colPop) return '';
        var key = state.colPop.key;
        var field = FIELDS.filter(function (f) { return f.key === key; })[0];
        if (!field) return '';
        var seen = {};
        allRows().forEach(function (r) {
            var v = String(r.values[key] == null ? '' : r.values[key]).trim();
            if (v && v !== '—') seen[v] = 1;
        });
        var values = Object.keys(seen).sort(function (a, b) {
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });
        var cur = state.columnFilters[key] || { text: '', values: [] };
        var picked = cur.values || [];
        var top = Math.max(8, state.colPop.top || 8);
        var left = Math.max(8, state.colPop.left || 8);
        return '<div class="pinv-colpop" data-colpop="' + esc(key) + '" style="top:' + top + 'px;left:' + left + 'px;">' +
            '<div class="pinv-colpop-head"><strong>Filter — ' + esc(field.field) + '</strong>' +
            '<button class="pinv-colpop-close" data-colpop-close="1" title="Close" aria-label="Close">✕</button></div>' +
            '<input type="search" data-colpop-text placeholder="Keyword in this column…" value="' + esc(cur.text || '') + '" spellcheck="false">' +
            '<div class="pinv-colpop-values">' +
            (values.length
                ? values.slice(0, 200).map(function (v) {
                    return '<label><input type="checkbox" data-colpop-value="' + esc(v) + '"' +
                        (picked.indexOf(v) !== -1 ? ' checked' : '') + '> <span title="' + esc(v) + '">' + esc(v) + '</span></label>';
                }).join('') + (values.length > 200 ? '<div class="pinv-muted" style="font-size:.66rem;">' + (values.length - 200) + ' more — narrow it with the keyword box.</div>' : '')
                : '<div class="pinv-muted" style="font-size:.68rem;">No values recorded in this column.</div>') +
            '</div>' +
            '<div class="pinv-colpop-actions">' +
            '<button class="btn btn-secondary" data-colpop-edit="1" style="font-size:.72rem;margin-right:auto;">✎ Edit column</button>' +
            '<button class="btn btn-secondary" data-colpop-clear="1" style="font-size:.72rem;">Clear</button>' +
            '<button class="btn btn-primary" data-colpop-apply="1" style="font-size:.72rem;">Apply</button>' +
            '</div></div>';
    }

    /* ── One-cell editing (double-click any cell) ──────────────────────────
       Every column is editable, including the 17 workbook columns: a workbook
       correction is stored as an override (marked “edited”, resettable), it
       never rewrites the source. Columns with a known set of values offer a
       dropdown; free-text columns offer a suggestion list and accept anything. */

    /* Workbook columns whose values repeat, so a dropdown is the right control. */
    var CELL_SELECTS = ['status', 'country', 'instType', 'category', 'year'];

    /** Distinct non-blank values recorded in one column, alphabetically. */
    function distinctValues(key) {
        var seen = {};
        allRows().forEach(function (r) {
            var v = String(r.values[key] == null ? '' : r.values[key]).trim();
            if (v && v !== '—') seen[v] = 1;
        });
        return Object.keys(seen).sort(function (a, b) {
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        }).slice(0, 120);
    }

    /** Options for the editor: a dropdown column's own list, a known-set column's
     *  recorded values, or none (free text). */
    function cellOptions(f) {
        if (f.type === 'select') return (f.options || []).slice();
        if (f.key === 'country') return countryChoices();
        if (CELL_SELECTS.indexOf(f.key) !== -1) return distinctValues(f.key);
        return [];
    }

    function renderCellEditor(r, f) {
        var v = String(r.values[f.key] == null ? '' : r.values[f.key]);
        var opts = cellOptions(f);
        var at = ' data-cell-row="' + esc(r.id) + '" data-cell-key="' + f.key + '"';
        var label = f.field + ' for ' + (r.values.id || 'this row');

        if (opts.length && !state.cellFreeText) {
            if (opts.indexOf(v) === -1 && v) opts = [v].concat(opts);
            var choices = '<option value=""' + (v ? '' : ' selected') + '>—</option>' +
                opts.map(function (o) {
                    return '<option value="' + esc(o) + '"' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>';
                }).join('') +
                '<option value="__free">✎ Type a different value…</option>';
            return '<td class="pinv-editing-cell pinv-cellselect"' + at + '>' +
                '<select class="pinv-cellinput" data-cell-commit="1"' + at +
                ' aria-label="' + esc(label) + ' — choose a value">' + choices + '</select></td>';
        }

        return '<td class="pinv-editing-cell"' + at + '>' +
            '<input class="pinv-cellinput" data-cell-commit="1"' + at +
            ' list="pinvCellList" autocomplete="off" spellcheck="false" value="' + esc(v) + '"' +
            ' aria-label="' + esc(label) + '"></td>';
    }

    function startCellEdit(app, rowId, key) {
        if (!rowId || !key) return;
        if (state.editColumn) {          // leave the bulk editor cleanly
            state.editColumn = null;
            state.editDraft = {};
        }
        state.cellEdit = { row: rowId, key: key };
        state.cellFreeText = false;
        state.colPop = null;
        renderPage(app);
        var el = document.querySelector('.pinv-editing-cell .pinv-cellinput');
        if (el && el.focus) {
            el.focus();
            if (el.select) { try { el.select(); } catch (e) { /* some inputs refuse */ } }
        }
    }

    function cancelCellEdit(app) {
        if (!state.cellEdit) return;
        state.cellEdit = null;
        state.cellFreeText = false;
        renderPage(app);
    }

    function commitCellEdit(app, value) {
        var target = state.cellEdit;
        if (!target) return;
        var row = allRows().filter(function (r) { return r.id === target.row; })[0];
        state.cellEdit = null;
        state.cellFreeText = false;
        if (!row) { renderPage(app); return; }
        applyEdits(app, target.key, [{ row: row, value: String(value == null ? '' : value).trim() }], 'Cell');
    }

    /**
     * Write a set of { row, value } changes for one column. This is the single
     * place an edit is persisted, so the cell editor and the bulk column editor
     * validate, disclose and store a change identically.
     */
    function applyEdits(app, key, proposed, what) {
        var current = function (r) { return String(r.values[key] == null ? '' : r.values[key]).trim(); };
        var changes = [];
        (proposed || []).forEach(function (c) {
            if (!c || !c.row) return;
            if (c.value === current(c.row)) return;
            changes.push(c);
        });
        if (!changes.length) {
            state.editNotice = 'No change — the cell already holds that value.';
            renderPage(app);
            return;
        }

        // Validate IDs before writing anything: empty, malformed or duplicated
        // IDs would break the row/attachment identity.
        var problems = [];
        if (key === 'id') {
            var rows = allRows();
            var projected = {};
            rows.forEach(function (r) { projected[r.id] = r.values.id; });
            changes.forEach(function (c) {
                if (!c.value) problems.push('Project ID cannot be empty.');
                else if (!/^[A-Z]{2}\d{4}$/.test(c.value)) problems.push('“' + c.value + '” does not follow the client-ID pattern (for example UK0126 — country, a 2-digit number, then the 2-digit year).');
                projected[c.row.id] = c.value;
            });
            var seen = {};
            Object.keys(projected).forEach(function (rid) {
                if (seen[projected[rid]]) problems.push('Two rows would share the ID ' + projected[rid] + ' — edit one of them.');
                seen[projected[rid]] = 1;
            });
        }
        if (problems.length) {
            state.editNotice = problems[0];
            renderPage(app);
            return;
        }

        var edits = loadEdits();
        var users = loadUserProjects();
        var saved = 0;
        changes.forEach(function (c) {
            var r = c.row;
            if (r.origin === 'user') {
                var u = users[r.userIndex];
                if (!u || !u.values) return;
                var oldId = u.values.id;
                u.values[key] = c.value || '—';
                if (key === 'id' && oldId && oldId !== c.value) {
                    var at = loadAttachments();
                    if (at[oldId]) { at[c.value] = at[oldId]; delete at[oldId]; saveAttachments(at); }
                }
                saved++;
                return;
            }
            var bucket = edits[r.baseId] = edits[r.baseId] || {};
            var original = r._original ? String(r._original[key] == null ? '' : r._original[key]) : '';
            if (c.value === original) delete bucket[key];
            else bucket[key] = c.value;
            if (!Object.keys(bucket).length) delete edits[r.baseId];
            saved++;
        });
        saveUserProjects(users);
        var err = saveEdits(edits);
        if (err) {
            state.editNotice = err;
            renderPage(app);
            return;
        }
        state.editColumn = null;
        state.editDraft = {};
        state.editNotice = saved + ' value' + (saved === 1 ? '' : 's') + ' updated' +
            (key === 'id' ? ' — attachments stay with the row.' : '.');
        if (app && app.logBuildEvent) app.logBuildEvent('project-inventory-edit', saved + ' ' + key + ' value(s) updated' + (what ? ' (' + what + ')' : ''));
        renderPage(app);
    }

    /* ── Columns manager: show, hide, add, delete ──────────────────────────
       Workbook columns are hidden, never deleted — the source data and the
       exported workbook keep all 17. A column added here is a real column: it is
       stored, exported and editable like the rest, and deleting it removes the
       values typed into it. */
    function renderColumnsManager() {
        if (!state.colManager) return '';
        var row = function (f, custom) {
            var on = COLUMNS.hidden.indexOf(f.key) === -1;
            return '<label class="pinv-colrow">' +
                '<input type="checkbox" data-coltoggle="' + esc(f.key) + '"' + (on ? ' checked' : '') + '>' +
                '<span class="pinv-colname">' + esc(f.field) + '</span>' +
                '<span class="pinv-coltype">' + (custom
                    ? (f.locked ? 'tracker · locked' : (f.type === 'select' ? 'dropdown · ' + (f.options || []).length + ' options' : 'added column'))
                    : 'workbook') + '</span>' +
                (custom
                    ? (f.locked
                        ? '<span class="pinv-collock" title="Part of the tracker — hide it instead of deleting it">🔒</span>'
                        : '<button class="pinv-coldel" data-coldel="' + esc(f.key) + '" title="Delete this column and the values typed into it" aria-label="Delete ' + esc(f.field) + '">✕</button>')
                    : '') +
                '</label>';
        };
        return '<div class="card pinv-card pinv-colmanager" id="pinvColManager">' +
            '<div class="pinv-card-title">▦ Columns — show, hide, add or remove</div>' +
            '<p class="pinv-muted" style="font-size:.76rem;line-height:1.5;margin:-.2rem 0 .7rem;">' +
            'Workbook columns are <b>hidden, never deleted</b> — the recorded values stay intact and can be shown again at any time. ' +
            'Columns you add are yours: text or a dropdown, editable per cell, and included in the table and the exports.</p>' +
            '<div class="pinv-collist">' +
            BUILTIN_FIELDS.map(function (f) { return row(f, false); }).join('') +
            COLUMNS.custom.map(function (f) { return row(f, true); }).join('') +
            '</div>' +
            '<div class="pinv-addcol">' +
            '<input type="text" id="pinvNewColName" placeholder="New column name (e.g. Contact person)" maxlength="80">' +
            '<select id="pinvNewColType" title="Text: type any value. Dropdown: pick from the options below.">' +
            '<option value="text">Text</option><option value="select">Dropdown</option></select>' +
            '<input type="text" id="pinvNewColOptions" placeholder="Dropdown options, comma separated (e.g. Yes, No, Pending)">' +
            '<button id="pinvAddCol" class="btn btn-primary" style="font-size:.76rem;">＋ Add column</button>' +
            '<button id="pinvColsReset" class="btn btn-secondary" style="font-size:.76rem;" title="Show every workbook column again">Show all</button>' +
            '</div>' +
            (state.colNotice ? '<p class="pinv-editnotice" style="margin:.5rem 0 0;">' + esc(state.colNotice) + '</p>' : '') +
            '<p class="pinv-muted" style="font-size:.7rem;margin:.55rem 0 0;">Double-click any cell in the table to rewrite it — ' +
            'dropdown columns and known-value columns (status, country, year…) offer a list, the rest accept free text. ' +
            'An edit to a workbook column is marked <em>edited</em> and can be reset; it never rewrites the source file.</p>' +
            '</div>';
    }

    function renderInventory(app) {
        var rows = viewRows();
        var s = stats(allRows());
        var auditActive = state.auditOnly ? state.auditOnly.length : 0;
        var editedTotal = countEdits(loadEdits());
        var colActive = Object.keys(state.columnFilters).filter(function (k) {
            var f = state.columnFilters[k];
            return !!(f && ((f.text && String(f.text).trim()) || (f.values && f.values.length)));
        });
        var colChips = colActive.map(function (k) {
            var f = state.columnFilters[k];
            var field = FIELDS.filter(function (x) { return x.key === k; })[0];
            var label = field ? field.field : k;
            var bits = [];
            if (f.text && String(f.text).trim()) bits.push('“' + f.text.trim() + '”');
            if (f.values && f.values.length) bits.push(f.values.length === 1 ? f.values[0] : f.values.length + ' values');
            return '<button class="pinv-filter-chip" data-colfilter-clear="' + esc(k) + '" title="Remove this column filter">' +
                esc(label) + ': ' + esc(bits.join(' + ')) + ' ✕</button>';
        }).join('');

        var countryOpts = ['all'].concat(s.countryList).map(function (c) {
            return '<option value="' + esc(c) + '"' + (state.country === c ? ' selected' : '') + '>' +
                (c === 'all' ? 'All countries' : esc(c)) + '</option>';
        }).join('');
        var yearOpts = ['all'].concat(s.yearList.map(String)).map(function (y) {
            return '<option value="' + esc(y) + '"' + (state.year === y ? ' selected' : '') + '>' +
                (y === 'all' ? 'All years' : esc(y)) + '</option>';
        }).join('');
        var statusOpts = statusOptions().map(function (v) {
            return '<option value="' + esc(v) + '"' + (state.status === v ? ' selected' : '') + '>' +
                (v === 'all' ? 'All statuses' : esc(v)) + '</option>';
        }).join('');

        return '' +
            '<div class="pinv-toolbar pinv-toolbar-top">' +
            '<input type="search" id="pinvSearch" placeholder="Search every field — country, school, year, missing document…" value="' + esc(state.query) + '">' +
            '<span class="pinv-toolbar-count">' + rows.length + ' of ' + s.total + ' rows' + (auditActive ? ' · filtered to ' + auditActive + ' flagged rows' : '') +
            (colActive.length ? ' · ' + colActive.length + ' column filter' + (colActive.length === 1 ? '' : 's') : '') + '</span>' +
            (auditActive ? '<button id="pinvClearAudit" class="btn btn-secondary" style="font-size:.74rem;">✕ Clear the double-check filter</button>' : '') +
            (colActive.length ? '<button id="pinvClearColFilters" class="btn btn-secondary" style="font-size:.74rem;">✕ Clear column filters</button>' : '') +
            '</div>' +
            (colChips ? '<div class="pinv-filter-chips">' + colChips + '</div>' : '') +
            (state.editNotice ? '<div class="pinv-editnotice">' + esc(state.editNotice) + '</div>' : '') +
            renderColumnsManager() +

            '<div class="pinv-toolbar">' +
            '<label class="pinv-field"><span>Sort by</span><select id="pinvSort">' + sortOptionsHtml() + '</select></label>' +
            '<button id="pinvDir" class="btn btn-secondary" style="font-size:.76rem;" title="Flip the sort direction">' + (state.sortDir > 0 ? '▲ Ascending' : '▼ Descending') + '</button>' +
            '<label class="pinv-field"><span>Status</span><select id="pinvStatus">' + statusOpts + '</select></label>' +
            '<label class="pinv-field"><span>Country</span><select id="pinvCountry">' + countryOpts + '</select></label>' +
            '<label class="pinv-field"><span>Year</span><select id="pinvYear">' + yearOpts + '</select></label>' +
            '<label class="pinv-field"><span>Columns</span><select id="pinvColumns">' +
            '<option value="all"' + (state.columns === 'all' ? ' selected' : '') + '>All ' + FIELDS.length + ' fields (recommended)</option>' +
            '<option value="key"' + (state.columns === 'key' ? ' selected' : '') + '>Key fields</option>' +
            '</select></label>' +
            '<label class="pinv-field"><span>Rows</span><select id="pinvPageSize">' +
            [25, 50, 100, 'all'].map(function (n) {
                return '<option value="' + n + '"' + (String(state.pageSize) === String(n) ? ' selected' : '') + '>' + (n === 'all' ? 'All' : n) + '</option>';
            }).join('') +
            '</select></label>' +
            '<button id="pinvColumnsBtn" class="btn btn-secondary' + (state.colManager ? ' active' : '') + '" style="font-size:.76rem;" ' +
            'title="Show, hide, add or remove columns">▦ Columns</button>' +
            '<button id="pinvFocus" class="btn btn-secondary" style="font-size:.76rem;" ' +
            'title="Fill the window with the inventory — Esc exits">' + (state.focus ? '⛶ Exit full screen' : '⛶ Full screen') + '</button>' +
            '<label class="pinv-check"><input type="checkbox" id="pinvGaps"' + (state.gapsOnly ? ' checked' : '') + '> Only rows with missing information</label>' +
            '</div>' +

            '<div class="section-title">🗂️ Inventory <span class="pinv-section-note">Tap a row to open every field. Double-click any cell to rewrite it. Click a column heading to sort by it.</span></div>' +

            renderInventoryTable(rows) +

            '<div class="pinv-actions">' +
            '<button id="pinvAddToggle" class="btn btn-primary">➕ Add project</button>' +
            '<button id="pinvExportXlsx" class="btn btn-secondary">⬇️ Excel — all ' + s.total + ' rows</button>' +
            '<button id="pinvExportXlsxFiltered" class="btn btn-secondary">⬇️ Excel — this view (' + rows.length + ')</button>' +
            '<button id="pinvExportCsv" class="btn btn-secondary">⬇️ CSV — this view</button>' +
            '<button id="pinvExportJson" class="btn btn-secondary">⬇️ JSON + findings</button>' +
            (editedTotal ? '<button id="pinvResetEdits" class="btn btn-danger">↺ Reset my edits (' + editedTotal + ')</button>' : '') +
            '<span id="pinvExportStatus" class="pinv-muted" style="font-size:.74rem;align-self:center;"></span>' +
            '</div>' +
            '<div class="pinv-muted pinv-focus-hide" style="font-size:.72rem;margin-bottom:1.5rem;">The Excel file is written from the same rows and ' +
            'columns the table uses, so the file and the screen cannot drift apart. “This view” exports exactly the rows left after ' +
            'your filters and in the order you sorted them. Every column heading is sortable; blanks always sink to the bottom.</div>' +

            '<div id="pinvAddWrap" class="pinv-hidden">' + renderAddForm() + '</div>';
    }

    /* ═══ Add a project ══════════════════════════════════════════════════ */

    function renderAddForm() {
        var LONG = ['Brief description', 'Beneficiaries', 'Available documentation', 'File location', 'Missing information'];

        var groups = [
            { title: '1 · What it is', keys: ['id', 'year', 'name', 'category', 'status'] },
            { title: '2 · Who it reached', keys: ['country', 'location', 'org', 'instType', 'beneficiaries'] },
            { title: '3 · Description', keys: ['description'] },
            { title: '4 · Money, dates and duration', keys: ['donation', 'deliveryDate', 'duration'] },
            { title: '5 · Evidence', keys: ['documentation', 'fileLocation', 'missing'] }
        ];

        var groupHtml = groups.map(function (g) {
            return '<div class="pinv-form-group"><div class="pinv-form-group-title">' + esc(g.title) + '</div>' +
                '<div class="pinv-form">' + g.keys.map(function (key) {
                    var f = FIELDS.filter(function (x) { return x.key === key; })[0];
                    if (!f) return '';
                    // Country is a dropdown: the brief's list, not a free-text box.
                    if (f.key === 'country') {
                        return '<label title="' + esc(f.what) + '">' + esc(f.field) +
                            '<select data-field="country"><option value="">— not recorded —</option>' +
                            countryChoices().map(function (c) {
                                return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
                            }).join('') + '</select></label>';
                    }
                    var long = LONG.indexOf(f.field) !== -1;
                    var tag = long ? 'textarea' : 'input';
                    return '<label class="' + (long ? 'pinv-wide' : '') + '" title="' + esc(f.what) + '">' + esc(f.field) +
                        '<' + tag + (long ? '' : ' type="text"') + ' data-field="' + f.key + '" placeholder="' + esc(f.what.slice(0, 64)) + '"></' + tag + '></label>';
                }).join('') + '</div></div>';
        }).join('');

        // Columns added in this app belong in the form too — a dropdown column
        // offers its options, a text column is a text box.
        var customHtml = COLUMNS.custom.length
            ? '<div class="pinv-form-group"><div class="pinv-form-group-title">7 · Columns you added</div>' +
              '<div class="pinv-form">' + COLUMNS.custom.map(function (f) {
                  var label = '<label title="' + esc(f.what) + '">' + esc(f.field);
                  if (f.type === 'select') {
                      return label + '<select data-field="' + f.key + '"><option value="">—</option>' +
                          (f.options || []).map(function (o) {
                              return '<option value="' + esc(o) + '">' + esc(o) + '</option>';
                          }).join('') + '</select></label>';
                  }
                  return label + '<input type="text" data-field="' + f.key + '" placeholder="' + esc(f.field) + '"></label>';
              }).join('') + '</div></div>'
            : '';

        return '<div class="card pinv-card" id="pinvAddCard" style="margin-bottom:1.5rem;">' +
            '<div class="pinv-card-title">➕ Add a project</div>' +
            '<p class="pinv-muted" style="font-size:.78rem;line-height:1.55;margin:-.2rem 0 .9rem;">' +
            'Saved in this app only (localStorage). Leave a field blank rather than guessing — a blank is stored and exported as “—” ' +
            'and belongs in <em>Missing information</em>. The Project ID is generated for you if it is left empty, and a project ' +
            'ID that already exists is rejected rather than silently duplicated.</p>' +
            groupHtml +
            '<div class="pinv-form-group"><div class="pinv-form-group-title">6 · Identification picture</div>' +
            '<div class="pinv-form">' +
            '<label class="pinv-wide" title="A photograph, logo or folder image that identifies the project. A C:\\ path is converted to a file:// URL.">' +
            'Picture (URL, or a C:\\ path to a photograph)' +
            '<input type="text" id="pinvUserImage" placeholder="https://… or C:\\Users\\…\\photo.jpg"></label>' +
            '<div class="pinv-image-preview"><div class="pinv-muted">Preview</div><img id="pinvImagePreview" alt="" style="display:none;"><div id="pinvImageFallback" class="pinv-tile-fallback">A generated tile is used until a picture is given</div></div>' +
            '</div></div>' +
            customHtml +
            '<div class="pinv-actions">' +
            '<button id="pinvSaveBtn" class="btn btn-primary">💾 Save project</button>' +
            '<button id="pinvCancelBtn" class="btn btn-secondary">Cancel</button>' +
            '<button id="pinvResetBtn" class="btn btn-danger">Remove all my added projects</button>' +
            '<span id="pinvAddStatus" class="pinv-muted" style="font-size:.74rem;align-self:center;"></span>' +
            '</div></div>';
    }

    /* ═══ Live tab ═══════════════════════════════════════════════════════ */

    function renderLiveTab(app) {
        return '' +
            '<div class="section-title">💾 The most recent scan, ready before the network is</div>' +
            '<div class="pinv-two-col">' +
            lastSavedCard(app) +
            '<div class="card pinv-card" style="padding:1rem;">' +
            '<div class="pinv-card-title">🔁 Every scan is kept, even a failed one</div>' +
            '<ul class="pinv-list">' +
            '<li>The main process writes each post it collects to disk as it walks, so an interrupted, throttled or failed scan still leaves the newest results behind.</li>' +
            '<li>Finishing a scan merges the run into the account’s saved snapshot instead of replacing it — a 24-post anonymous peek can never wipe a 600-post walk.</li>' +
            '<li>A scan that collects nothing new leaves the earlier result untouched.</li>' +
            '<li>Partial walks stay labelled partial: the coverage line and the <em>reached the first post</em> flag travel with the data.</li>' +
            '</ul></div>' +
            '</div>' +

            '<div class="section-title">📡 Live data from Instagram</div>' +
            renderLivePanel(app) +

            '<div class="section-title">🔎 How to get accurate live data (researched)</div>' +
            DATA_METHODS.map(function (m) {
                return '<div class="pinv-method"><div class="pinv-rank">' + m.rank + '</div><div class="pinv-mtext">' +
                    '<b>' + esc(m.title) + '</b><br><b>Gives:</b> ' + esc(m.gives) +
                    '<br><b>Needs:</b> ' + esc(m.needs) +
                    '<br><span class="pinv-muted">' + esc(m.status) + '</span></div></div>';
            }).join('') +

            '<div class="card pinv-card">' +
            '<div class="pinv-card-title">Why the number of posts matters more than the number of likes</div>' +
            '<p class="pinv-muted" style="font-size:.8rem;line-height:1.6;margin:0;">' +
            'An anonymous scan reaches roughly the newest 24 posts. Any average computed on those describes the last few weeks, ' +
            'not the account. That is why every screen states how many posts it is looking at and what share of the account that is, ' +
            'and why the full-history walk exists: it is the only way the analytics describe the whole account.</p>' +
            '</div>';
    }

    /* ═══ Guide tab ══════════════════════════════════════════════════════ */

    function renderGuideTab() {
        return '' +
            '<div class="section-title">📋 Field guide — what to record in each field</div>' +
            '<div class="card pinv-card" style="padding:0;overflow-x:auto;">' +
            '<table class="data-table" style="margin-bottom:0;"><thead><tr><th style="width:220px;">Field</th><th>What to record in each field</th></tr></thead>' +
            '<tbody>' + BUILTIN_FIELDS.map(function (f) {
                return '<tr><td><strong>' + esc(f.field) + '</strong></td><td>' + esc(f.what) + '</td></tr>';
            }).join('') +
            COLUMNS.custom.map(function (f) {
                return '<tr><td><strong>' + esc(f.field) + '</strong>' +
                    '<div class="pinv-muted" style="font-size:.66rem;">' + (f.locked ? 'part of the tracker' : 'added column') + '</div></td>' +
                    '<td>' + esc(f.what) +
                    (f.type === 'select' && (f.options || []).length ? '<div class="pinv-muted" style="font-size:.7rem;margin-top:.15rem;">Options: ' + esc(f.options.join(' · ')) + '</div>' : '') +
                    '</td></tr>';
            }).join('') + '</tbody></table></div>' +

            '<div class="section-title">🔎 Sources used — and what each one could not give</div>' +
            SOURCES.map(function (s2) {
                return '<div class="card pinv-card pinv-source">' +
                    '<div class="pinv-source-name">' + esc(s2.name) + '</div>' +
                    '<div class="pinv-source-what">' + esc(s2.what) + '</div>' +
                    '<div class="pinv-source-url">' + esc(s2.url) + '</div>' +
                    '<div class="pinv-source-gap"><strong>Gap:</strong> ' + esc(s2.gap) + '</div>' +
                    '</div>';
            }).join('') +

            '<div class="section-title">🗂️ Where the workbook says the files are</div>' +
            '<div class="card pinv-card">' +
            '<p class="pinv-muted" style="font-size:.8rem;line-height:1.6;margin:0;">' +
            'The File location column is reproduced as the workbook records it — “SmallWorld PC” on six rows and blank ' +
            'on the rest. The app shows that text as documentation; it is not a path it can open, and the export keeps ' +
            'it exactly as written.</p>' +
            '</div>' +

            '<div class="section-title">📎 Attachments</div>' +
            '<div class="card pinv-card">' +
            '<p class="pinv-muted" style="font-size:.8rem;line-height:1.6;margin:0 0 .5rem;">' +
            'Open any project row to attach evidence to it. Files are grouped by type: ' +
            ATTACHMENT_TYPES.map(function (t) { return t.label; }).join(' · ') + '.</p>' +
            '<p class="pinv-muted" style="font-size:.8rem;line-height:1.6;margin:0;">' +
            'Files up to 1 MB are copied into this app, so they work offline and in the browser preview. ' +
            'Larger files are never copied: the desktop app keeps a link to the file on disk, and the browser ' +
            'preview refuses them instead of pretending they were saved. Attachments are kept beside the ' +
            'workbook row — the 17 columns and the .xlsx export stay exactly as recorded.</p>' +
            '</div>' +

            '<div class="section-title">📊 Dashboard integration &amp; next steps</div>' +
            '<div class="card pinv-card">' +
            '<p class="pinv-muted" style="font-size:.8rem;line-height:1.6;margin:0 0 .5rem;">' +
            'All 17 fields feed the Overview tab: projects per year, country, status and support category; completeness ' +
            'for every field; reach figures; attachments and local edits; and the double-check findings. The same ' +
            'corrected values are used by every export.</p>' +
            '<ul class="pinv-list" style="padding-left:1.1rem;margin:0;">' +
            '<li>Record the country for the 2020–2021 rows now coded <b>XX</b> — that segment means “not recorded”, not a country.</li>' +
            '<li>Attach the evidence listed in Available documentation: agreements/MOUs, testimonies, thank-you letters, videos, receipts, reports and photographs.</li>' +
            '<li>Give amounts and delivery dates as a single figure and date (not a free-text range) so a total can be trusted.</li>' +
            '<li>Agree the detailed Support category list; the app groups the workbook wording exactly as recorded.</li>' +
            '<li>When the team issues final Project IDs, enter them in the workbook and re-import — or use the ✎ editor on the Project ID column.</li>' +
            '</ul></div>' +

            '<div class="section-title">📝 How this inventory was built</div>' +
            '<ul class="pinv-list" style="padding-left:1.1rem;">' +
            METHOD_NOTES.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') +
            '</ul>' +
            '<div class="pinv-actions" style="margin-bottom:2rem;">' +
            '<button id="pinvExportGuide" class="btn btn-secondary">⬇️ Download the field guide (CSV)</button>' +
            '</div>';
    }

    /* ═══ Render ═════════════════════════════════════════════════════════ */

    function destroyCharts() {
        if (charts) {
            Object.keys(charts).forEach(function (k) {
                try { charts[k].destroy(); } catch (e) { }
                delete charts[k];
            });
        }
    }

    var charts = null;

    function drawCharts(app) {
        if (typeof window === 'undefined' || typeof window.Chart === 'undefined') return;
        var rows = allRows();
        var a = analytics(rows);
        destroyCharts();
        charts = {};

        var theme = (app && typeof app.chartTheme === 'function') ? app.chartTheme() : null;
        var gridColor = (theme && theme.grid) || 'rgba(148,163,184,.15)';
        var tickColor = (theme && theme.tick) || '#94a3b8';
        var palette = ['#7c3aed', '#10b981', '#f59e0b', '#60a5fa', '#f472b6', '#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#38bdf8', '#c084fc'];

        var base = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        };
        var axes = function (opts) {
            var o = opts || {};
            return {
                x: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 10 } }, beginAtZero: o.beginAtZero !== false },
                y: { grid: { color: gridColor }, ticks: { color: tickColor, precision: 0, font: { size: 10 } }, beginAtZero: true }
            };
        };

        var yearEl = document.getElementById('pinvYearChart');
        if (yearEl) {
            charts.year = new Chart(yearEl, {
                type: 'bar',
                data: {
                    labels: a.byYear.map(function (e) { return String(e.year); }),
                    datasets: [{
                        label: 'Projects',
                        data: a.byYear.map(function (e) { return e.count; }),
                        backgroundColor: 'rgba(124,58,237,.65)',
                        borderColor: '#7c3aed',
                        borderWidth: 1,
                        borderRadius: 4
                    }]
                },
                options: Object.assign({}, base, { scales: axes() })
            });
        }

        var countryEl = document.getElementById('pinvCountryChart');
        if (countryEl) {
            charts.country = new Chart(countryEl, {
                type: 'bar',
                data: {
                    labels: a.byCountry.map(function (e) { return e.key; }),
                    datasets: [{
                        label: 'Projects',
                        data: a.byCountry.map(function (e) { return e.value; }),
                        backgroundColor: a.byCountry.map(function (e, i) { return palette[i % palette.length] + 'b0'; }),
                        borderWidth: 0,
                        borderRadius: 4
                    }]
                },
                options: Object.assign({}, base, {
                    indexAxis: 'y',
                    scales: {
                        x: { grid: { color: gridColor }, ticks: { color: tickColor, precision: 0, font: { size: 10 } }, beginAtZero: true },
                        y: { grid: { display: false }, ticks: { color: tickColor, font: { size: 10 } } }
                    }
                })
            });
        }

        var statusEl = document.getElementById('pinvStatusChart');
        if (statusEl) {
            charts.status = new Chart(statusEl, {
                type: 'doughnut',
                data: {
                    labels: a.byStatus.map(function (e) { return e.key; }),
                    datasets: [{
                        data: a.byStatus.map(function (e) { return e.value; }),
                        backgroundColor: a.byStatus.map(function (e, i) { return palette[i % palette.length]; }),
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '58%',
                    plugins: {
                        legend: { position: 'bottom', labels: { color: tickColor, boxWidth: 10, font: { size: 10 } } }
                    }
                }
            });
        }
    }

    function renderPage(app) {
        var host = document.getElementById('projectsBody');
        if (!host) return;
        if (!state._viewLoaded) { loadView(); state._viewLoaded = true; }
        state._app = app;

        var body = '';
        if (state.tab === 'overview') body = renderOverview(app);
        else if (state.tab === 'inventory') body = renderInventory(app);
        else if (state.tab === 'add') body = renderAddForm();
        else if (state.tab === 'live') body = renderLiveTab(app);
        else body = renderGuideTab();

        // Full-screen view: a fixed overlay that fills the window above the
        // titlebar/sidebar, with its own always-visible exit control.
        host.classList.toggle('pinv-focus', !!state.focus);
        document.documentElement.classList.toggle('swa-inv-focus', !!state.focus);
        flattenAncestors(host, !!state.focus);
        var focusBar = state.focus
            ? '<div class="pinv-focus-bar"><span>⛶ <b>Inventory</b> · full screen · scroll inside the grid · Esc exits</span>' +
              '<button id="pinvFocusExit" class="btn btn-secondary" style="font-size:.72rem;">✕ Exit full screen</button></div>'
            : '';
        host.innerHTML = focusBar + renderTabs() + '<div class="pinv-panel">' + body + '</div>';

        // Esc (or the browser leaving fullscreen) closes the focus view.
        if (!state._fsBound) {
            state._fsBound = true;
            document.addEventListener('fullscreenchange', function () {
                if (!document.fullscreenElement && state.focus) {
                    state.focus = false;
                    renderPage(state._app || app);
                }
            });
        }

        wire(app);
        // Charts must be drawn after their canvases are in the DOM.
        if (state.tab === 'overview') {
            try { drawCharts(app); } catch (e) {
                if (app && app.logError) app.logError('Project inventory charts failed: ' + (e && e.message ? e.message : e));
            }
        } else {
            destroyCharts();
        }
    }

    /* A `position: fixed` box is only fixed to the window while no ancestor has
       a transform/filter — those make the ancestor the containing block. GSAP
       leaves `transform: translate(0, 0)` on the page it animated, which is why
       the full-screen view used to sit inset inside the page instead of filling
       it. Marking the ancestors lets one CSS rule cancel that while focused. */
    function flattenAncestors(host, on) {
        var marked = document.querySelectorAll('.pinv-fs-flat');
        Array.prototype.forEach.call(marked, function (n) { n.classList.remove('pinv-fs-flat'); });
        if (!on || !host) return;
        var el = host.parentElement;
        while (el && el !== document.body) {
            el.classList.add('pinv-fs-flat');
            el = el.parentElement;
        }
    }

    /* ═══ Events ═════════════════════════════════════════════════════════ */

    function setFocus(app, on) {
        state.focus = !!on;
        state._app = app;
        renderPage(app);
        // Also ask for real fullscreen where the browser allows it. The CSS
        // overlay already fills the window, so a refusal leaves it usable.
        try {
            if (on && !document.fullscreenElement && document.documentElement.requestFullscreen) {
                var p = document.documentElement.requestFullscreen();
                if (p && p.catch) p.catch(function () { });
            } else if (!on && document.fullscreenElement && document.exitFullscreen) {
                var q = document.exitFullscreen();
                if (q && q.catch) q.catch(function () { });
            }
        } catch (e) { /* the overlay is enough */ }
    }

    /* ── Inline column editing (every column, dropdown suggestions) ─────── */

    function startColumnEdit(app, key) {
        if (state.editColumn && state.editColumn !== key && Object.keys(state.editDraft).length) {
            state.editNotice = 'Save or cancel the current column first.';
            renderPage(app);
            return;
        }
        state.editColumn = (state.editColumn === key) ? null : key;
        state.editDraft = {};
        state.editNotice = '';
        state.colPop = null;
        renderPage(app);
    }

    function cancelColumnEdit(app) {
        state.editColumn = null;
        state.editDraft = {};
        state.editNotice = '';
        renderPage(app);
    }

    /** Save the pending cell drafts for the column being edited (bulk mode). */
    function saveColumnEdits(app) {
        var key = state.editColumn;
        if (!key) return;
        var rows = allRows();
        var byInternal = {};
        rows.forEach(function (r) { byInternal[r.id] = r; });

        var changes = [];
        Object.keys(state.editDraft).forEach(function (rowId) {
            var r = byInternal[rowId];
            if (!r) return;
            changes.push({ row: r, value: String(state.editDraft[rowId] == null ? '' : state.editDraft[rowId]).trim() });
        });
        if (!changes.length) {
            state.editColumn = null;
            state.editDraft = {};
            state.editNotice = 'No changes to save.';
            renderPage(app);
            return;
        }
        applyEdits(app, key, changes, 'Column');
    }

    function goToTab(app, tab) {
        state.tab = tab;
        state._tabChosen = true;
        state.page = 1;
        state.editColumn = null;
        state.editDraft = {};
        state.editNotice = '';
        state.cellEdit = null;
        state.cellFreeText = false;
        state.colManager = false;
        state.colNotice = '';
        saveView();
        renderPage(app);
        var host = document.getElementById('projectsBody');
        if (host) host.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }

    function showOnlyRows(app, ids) {
        state.auditOnly = ids.slice();
        state.tab = 'inventory';
        state.page = 1;
        state.query = '';
        state.gapsOnly = false;
        state.country = 'all';
        state.year = 'all';
        state.status = 'all';
        state.columnFilters = {};
        state.colPop = null;
        state.editColumn = null;
        state.editDraft = {};
        state.editNotice = '';
        state.cellEdit = null;
        state.cellFreeText = false;
        saveView();
        renderPage(app);
    }

    function openRow(app, id) {
        state.expanded[id] = !state.expanded[id];
        var rows = viewRows();
        var idx = -1;
        rows.forEach(function (r, i) { if (r.values.id === id) idx = i; });
        if (idx !== -1 && String(state.pageSize) !== 'all') {
            var size = parseInt(state.pageSize, 10);
            state.page = Math.floor(idx / size) + 1;
        }
        renderPage(app);
        var el = document.querySelector('[data-row="' + id.replace(/"/g, '\\"') + '"]');
        if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    function wire(app) {
        var host = document.getElementById('projectsBody');
        if (!host) return;

        // Sub-tab navigation
        host.querySelectorAll('.pinv-tab').forEach(function (b) {
            b.addEventListener('click', function () { goToTab(app, b.getAttribute('data-tab')); });
        });

        var search = document.getElementById('pinvSearch');
        if (search) {
            var t = null;
            search.addEventListener('input', function () {
                clearTimeout(t);
                var v = search.value;
                t = setTimeout(function () {
                    state.query = v;
                    state.page = 1;
                    renderPage(app);
                    var el = document.getElementById('pinvSearch');
                    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
                }, 180);
            });
        }

        // Click a heading to sort by it; click again to flip.
        host.querySelectorAll('th[data-sort]').forEach(function (th) {
            th.addEventListener('click', function () {
                var key = th.getAttribute('data-sort');
                if (state.sortKey === key) state.sortDir = -state.sortDir;
                else { state.sortKey = key; state.sortDir = key === 'year' ? -1 : 1; }
                saveView();
                renderPage(app);
            });
        });

        /* Per-column filter dropdown: pick exact values, type a keyword, or both. */
        host.querySelectorAll('[data-colfilter]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var key = btn.getAttribute('data-colfilter');
                if (state.colPop && state.colPop.key === key) { state.colPop = null; renderPage(app); return; }
                var rect = btn.getBoundingClientRect();
                var vw = window.innerWidth || 1200;
                var vh = window.innerHeight || 800;
                var left = Math.min(Math.max(8, rect.left), Math.max(8, vw - 328));
                var top = rect.bottom + 6;
                if (top + 380 > vh) top = Math.max(8, rect.top - 386);
                state.colPop = { key: key, top: top, left: left };
                renderPage(app);
            });
        });
        var pop = host.querySelector('[data-colpop]');
        if (pop) {
            var popText = pop.querySelector('[data-colpop-text]');
            if (popText) {
                popText.addEventListener('input', function () {
                    var q = String(popText.value || '').trim().toLowerCase();
                    pop.querySelectorAll('.pinv-colpop-values label').forEach(function (label) {
                        label.style.display = (!q || label.textContent.toLowerCase().indexOf(q) !== -1) ? '' : 'none';
                    });
                });
                popText.focus();
                popText.setSelectionRange(popText.value.length, popText.value.length);
            }
            var applyColFilter = function () {
                var key = pop.getAttribute('data-colpop');
                var text = popText ? String(popText.value || '').trim() : '';
                var picked = [];
                pop.querySelectorAll('[data-colpop-value]:checked').forEach(function (b) {
                    picked.push(b.getAttribute('data-colpop-value'));
                });
                if (text || picked.length) state.columnFilters[key] = { text: text, values: picked };
                else delete state.columnFilters[key];
                state.colPop = null;
                state.page = 1;
                renderPage(app);
            };
            pop.querySelectorAll('[data-colpop-apply]').forEach(function (b) { b.addEventListener('click', applyColFilter); });
            pop.querySelectorAll('[data-colpop-edit]').forEach(function (b) {
                b.addEventListener('click', function () {
                    var key = pop.getAttribute('data-colpop');
                    state.colPop = null;
                    startColumnEdit(app, key);
                });
            });
            pop.querySelectorAll('[data-colpop-clear]').forEach(function (b) {
                b.addEventListener('click', function () {
                    delete state.columnFilters[pop.getAttribute('data-colpop')];
                    state.colPop = null;
                    state.page = 1;
                    renderPage(app);
                });
            });
            pop.querySelectorAll('[data-colpop-close]').forEach(function (b) {
                b.addEventListener('click', function () { state.colPop = null; renderPage(app); });
            });
            pop.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); applyColFilter(); }
                else if (e.key === 'Escape') { e.preventDefault(); state.colPop = null; renderPage(app); }
            });
        }
        host.querySelectorAll('[data-colfilter-clear]').forEach(function (b) {
            b.addEventListener('click', function () {
                delete state.columnFilters[b.getAttribute('data-colfilter-clear')];
                state.page = 1;
                renderPage(app);
            });
        });
        var clearCols = document.getElementById('pinvClearColFilters');
        if (clearCols) clearCols.addEventListener('click', function () {
            state.columnFilters = {};
            state.colPop = null;
            state.page = 1;
            renderPage(app);
        });
        // Click anywhere outside the dropdown to close it (once, not per render).
        if (!state._popBound) {
            state._popBound = true;
            document.addEventListener('mousedown', function (e) {
                if (!state.colPop) return;
                var el = e.target;
                if (el && el.closest && (el.closest('.pinv-colpop') || el.closest('[data-colfilter]'))) return;
                state.colPop = null;
                renderPage(state._app);
            });
        }

        var bind = function (id, prop, isNumber) {
            var el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', function () {
                state[prop] = isNumber ? el.value : el.value;
                state.page = 1;
                saveView();
                renderPage(app);
            });
        };
        bind('pinvSort', 'sortKey');
        bind('pinvStatus', 'status');
        bind('pinvCountry', 'country');
        bind('pinvYear', 'year');
        bind('pinvColumns', 'columns');
        bind('pinvPageSize', 'pageSize');

        var dirBtn = document.getElementById('pinvDir');
        if (dirBtn) dirBtn.addEventListener('click', function () {
            state.sortDir = -state.sortDir; saveView(); renderPage(app);
        });

        var gaps = document.getElementById('pinvGaps');
        if (gaps) gaps.addEventListener('change', function () {
            state.gapsOnly = gaps.checked; state.page = 1; renderPage(app);
        });

        var clearAudit = document.getElementById('pinvClearAudit');
        if (clearAudit) clearAudit.addEventListener('click', function () {
            state.auditOnly = null; state.page = 1; renderPage(app);
        });

        /* Inline edit mode: one column at a time, suggestions from the data. */
        host.querySelectorAll('[data-editcol]').forEach(function (b) {
            b.addEventListener('click', function (e) {
                e.stopPropagation();
                startColumnEdit(app, b.getAttribute('data-editcol'));
            });
        });
        host.querySelectorAll('.pinv-cellinput').forEach(function (inp) {
            inp.addEventListener('click', function (e) { e.stopPropagation(); });
            inp.addEventListener('mousedown', function (e) { e.stopPropagation(); });
            inp.addEventListener('input', function () {
                state.editDraft[inp.getAttribute('data-cell-row')] = inp.value;
                var count = document.getElementById('pinvEditCount');
                if (count) {
                    var n = Object.keys(state.editDraft).length;
                    count.innerHTML = n ? '<b>' + n + '</b> unsaved change' + (n === 1 ? '' : 's') + '.' : '';
                }
            });
        });
        var editSave = document.getElementById('pinvEditSave');
        if (editSave) editSave.addEventListener('click', function () { saveColumnEdits(app); });
        var editCancel = document.getElementById('pinvEditCancel');
        if (editCancel) editCancel.addEventListener('click', function () { cancelColumnEdit(app); });
        var resetEdits = document.getElementById('pinvResetEdits');
        if (resetEdits) resetEdits.addEventListener('click', function () {
            if (typeof confirm === 'function' &&
                !confirm('Remove every edit made in this app and go back to the workbook values?')) return;
            var err = saveEdits({});
            state.editColumn = null;
            state.editDraft = {};
            state.editNotice = err || 'All local edits were reset to the workbook values.';
            renderPage(app);
        });

        host.querySelectorAll('[data-page]').forEach(function (b) {
            b.addEventListener('click', function () {
                var p = parseInt(b.getAttribute('data-page'), 10);
                if (p >= 1) { state.page = p; renderPage(app); }
            });
        });

        host.querySelectorAll('[data-expand]').forEach(function (b) {
            b.addEventListener('click', function (e) {
                e.stopPropagation();
                openRow(app, b.getAttribute('data-expand'));
            });
        });
        /* Row click opens the row — unless it turns into a double-click on a
           cell, which means “edit this cell”. The open is deferred a moment so
           the second click can cancel it. */
        host.querySelectorAll('tr[data-row]').forEach(function (tr) {
            tr.addEventListener('click', function (e) {
                if (e.target && e.target.closest && e.target.closest('button, input, select, a, .pinv-editing-cell')) return;
                if (state.cellEdit) return;      // typing in a cell, not opening a row
                tr._openTimer = setTimeout(function () { openRow(app, tr.getAttribute('data-row')); }, 220);
            });
            tr.addEventListener('dblclick', function () { clearTimeout(tr._openTimer); });
        });

        /* Double-click any cell to rewrite it in place (dropdown where it fits). */
        host.querySelectorAll('td[data-cell-key]').forEach(function (td) {
            td.addEventListener('dblclick', function (e) {
                e.preventDefault();
                e.stopPropagation();
                // The first click of the double-click queued "open this row" —
                // cancel it, or the row would re-render under the new editor.
                var tr = td.closest ? td.closest('tr') : null;
                if (tr && tr._openTimer) clearTimeout(tr._openTimer);
                startCellEdit(app, td.getAttribute('data-cell-row'), td.getAttribute('data-cell-key'));
            });
        });
        host.querySelectorAll('[data-cell-commit]').forEach(function (el) {
            el.addEventListener('click', function (e) { e.stopPropagation(); });
            el.addEventListener('mousedown', function (e) { e.stopPropagation(); });
            el.addEventListener('dblclick', function (e) { e.stopPropagation(); });
            if (el.tagName === 'SELECT') {
                el.addEventListener('change', function () {
                    if (el.value === '__free') {
                        state.cellFreeText = true;
                        renderPage(app);
                        var input = document.querySelector('.pinv-editing-cell .pinv-cellinput');
                        if (input && input.focus) { input.focus(); if (input.select) input.select(); }
                        return;
                    }
                    commitCellEdit(app, el.value);
                });
                return;
            }
            el.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); commitCellEdit(app, el.value); }
                else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelCellEdit(app); }
            });
            el.addEventListener('blur', function () { commitCellEdit(app, el.value); });
        });

        /* Columns manager. */
        var colsBtn = document.getElementById('pinvColumnsBtn');
        if (colsBtn) colsBtn.addEventListener('click', function () {
            state.colManager = !state.colManager;
            state.colNotice = '';
            renderPage(app);
        });
        host.querySelectorAll('[data-coltoggle]').forEach(function (box) {
            box.addEventListener('change', function () {
                var err = setColumnVisible(box.getAttribute('data-coltoggle'), box.checked);
                state.colNotice = err || (box.checked ? 'Column shown.' : 'Column hidden — the data is kept.');
                renderPage(app);
            });
        });
        host.querySelectorAll('[data-coldel]').forEach(function (b) {
            b.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                var key = b.getAttribute('data-coldel');
                var col = COLUMNS.custom.filter(function (f) { return f.key === key; })[0];
                if (!col) return;
                if (typeof confirm === 'function' &&
                    !confirm('Delete the column “' + col.field + '” and every value typed into it?')) return;
                var err = deleteColumn(key);
                state.colNotice = err || ('Column “' + col.field + '” deleted.');
                renderPage(app);
            });
        });
        var addColBtn = document.getElementById('pinvAddCol');
        if (addColBtn) addColBtn.addEventListener('click', function () {
            var nameEl = document.getElementById('pinvNewColName');
            var typeEl = document.getElementById('pinvNewColType');
            var optEl = document.getElementById('pinvNewColOptions');
            var options = optEl ? String(optEl.value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
            var err = addColumn({
                field: nameEl ? nameEl.value : '',
                type: typeEl && typeEl.value === 'select' ? 'select' : 'text',
                options: options
            });
            if (!err) {
                var added = COLUMNS.custom[COLUMNS.custom.length - 1];
                state.colNotice = 'Column “' + (added ? added.field : 'new') + '” added — double-click a cell to fill it.';
                if (app.logBuildEvent) app.logBuildEvent('project-inventory-column', 'Added column ' + (added ? added.field : ''));
            } else {
                state.colNotice = err;
            }
            renderPage(app);
        });
        var colsReset = document.getElementById('pinvColsReset');
        if (colsReset) colsReset.addEventListener('click', function () {
            var err = showAllColumns();
            state.colNotice = err || 'Every column is shown again.';
            renderPage(app);
        });

        /* Attachments: choose a type, pick files, see them grouped by type. */
        host.querySelectorAll('[data-attach-input]').forEach(function (input) {
            input.addEventListener('change', function () {
                var id = input.getAttribute('data-attach-input');
                var panel = input.closest ? input.closest('.pinv-attach') : null;
                var sel = panel ? panel.querySelector('select[data-attach-type]') : null;
                var type = sel ? sel.value : 'auto';
                var files = input.files;
                if (!files || !files.length) return;
                addAttachments(id, type, files).then(function (res) {
                    var bits = [];
                    if (res.added) bits.push(res.added + ' attachment' + (res.added === 1 ? '' : 's') + ' added');
                    if (!res.added && !res.skipped.length && !res.error) bits.push('No files were added');
                    if (res.skipped.length) {
                        bits.push('Skipped ' + res.skipped.length + ': ' + res.skipped.map(function (s) {
                            return s.name + ' — ' + s.reason;
                        }).join('; '));
                    }
                    if (res.error) bits.push(res.error);
                    state.attachNotice = { id: id, text: bits.join('. '), error: !!res.error || res.skipped.length > 0 };
                    if (app.logBuildEvent) app.logBuildEvent('project-attachment-add',
                        id + ': ' + res.added + ' added, ' + res.skipped.length + ' skipped');
                    renderPage(app);
                });
            });
        });
        host.querySelectorAll('[data-attach-del]').forEach(function (b) {
            b.addEventListener('click', function (e) {
                e.stopPropagation();
                var id = b.getAttribute('data-attach-for');
                var err = removeAttachment(id, b.getAttribute('data-attach-del'));
                state.attachNotice = { id: id, text: err || 'Attachment removed.', error: !!err };
                renderPage(app);
            });
        });

        /* Full-screen inventory: fill the window, leave with the button or Esc. */
        var focusBtn = document.getElementById('pinvFocus');
        if (focusBtn) focusBtn.addEventListener('click', function () { setFocus(app, !state.focus); });
        var focusExit = document.getElementById('pinvFocusExit');
        if (focusExit) focusExit.addEventListener('click', function () { setFocus(app, false); });
        if (state._escHandler) document.removeEventListener('keydown', state._escHandler);
        state._escHandler = function (e) {
            if (e.key !== 'Escape') return;
            if (state.cellEdit) cancelCellEdit(state._app || app);
            else if (state.focus) setFocus(state._app || app, false);
            else if (state.editColumn) cancelColumnEdit(state._app || app);
        };
        document.addEventListener('keydown', state._escHandler);

        host.querySelectorAll('[data-audit]').forEach(function (b) {
            b.addEventListener('click', function () {
                var key = b.getAttribute('data-audit');
                var f = auditRows(allRows()).filter(function (x) { return x.key === key; })[0];
                if (f) showOnlyRows(app, f.ids);
            });
        });
        host.querySelectorAll('[data-goto]').forEach(function (b) {
            b.addEventListener('click', function () {
                var id = b.getAttribute('data-goto');
                state.tab = 'inventory';
                state.expanded[id] = true;
                state.auditOnly = null;
                state.query = '';
                saveView();
                renderPage(app);
                var el = document.querySelector('[data-row="' + id.replace(/"/g, '\\"') + '"]');
                if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
            });
        });

        var addToggle = document.getElementById('pinvAddToggle');
        if (addToggle) addToggle.addEventListener('click', function () {
            var wrap = document.getElementById('pinvAddWrap');
            if (wrap) wrap.classList.toggle('pinv-hidden');
        });

        var cancel = document.getElementById('pinvCancelBtn');
        if (cancel) cancel.addEventListener('click', function () {
            var card = document.getElementById('pinvAddCard');
            if (card) card.removeAttribute('data-editing');
            if (state.tab === 'add') { goToTab(app, 'inventory'); return; }
            var wrap = document.getElementById('pinvAddWrap');
            if (wrap) wrap.classList.add('pinv-hidden');
        });

        var save = document.getElementById('pinvSaveBtn');
        if (save) save.addEventListener('click', function () { saveProject(app); });

        var reset = document.getElementById('pinvResetBtn');
        if (reset) reset.addEventListener('click', function () {
            // Remove the rows AND the attachments that belonged to them — an
            // attachment with no row would be unreachable data. Built-in rows
            // keep theirs.
            loadUserProjects().forEach(function (r) {
                if (r && r.values && r.values.id) removeAttachmentsFor(r.values.id);
            });
            saveUserProjects([]);
            renderPage(app);
            if (app.logBuildEvent) app.logBuildEvent('project-inventory-reset', 'Removed user-added project rows and their attachments');
        });

        host.querySelectorAll('.pinv-edit').forEach(function (b) {
            b.addEventListener('click', function (e) { e.stopPropagation(); startEdit(app, parseInt(b.getAttribute('data-user'), 10)); });
        });
        host.querySelectorAll('.pinv-del').forEach(function (b) {
            b.addEventListener('click', function (e) {
                e.stopPropagation();
                var list = loadUserProjects();
                var idx = parseInt(b.getAttribute('data-user'), 10);
                var removed = list[idx];
                if (removed && removed.values && removed.values.id) removeAttachmentsFor(removed.values.id);
                list.splice(idx, 1);
                saveUserProjects(list);
                renderPage(app);
            });
        });

        var imgInput = document.getElementById('pinvUserImage');
        if (imgInput) {
            var preview = document.getElementById('pinvImagePreview');
            var fallback = document.getElementById('pinvImageFallback');
            var updatePreview = function () {
                var v = String(imgInput.value || '').trim();
                if (!v) {
                    if (preview) { preview.style.display = 'none'; preview.removeAttribute('src'); }
                    if (fallback) fallback.style.display = '';
                    return;
                }
                var src = /^[A-Za-z]:[\\/]/.test(v) ? fileUrl(v) : v;
                if (preview) { preview.src = src; preview.style.display = ''; }
                if (fallback) fallback.style.display = 'none';
            };
            imgInput.addEventListener('input', updatePreview);
            imgInput.addEventListener('change', updatePreview);
            updatePreview();
        }

        var exAll = document.getElementById('pinvExportXlsx');
        if (exAll) exAll.addEventListener('click', function () { exportXlsx(app, allRows(), false); });
        var exFiltered = document.getElementById('pinvExportXlsxFiltered');
        if (exFiltered) exFiltered.addEventListener('click', function () { exportXlsx(app, viewRows(), true); });
        var exCsv = document.getElementById('pinvExportCsv');
        if (exCsv) exCsv.addEventListener('click', function () { exportCsv(app, viewRows(), true); });
        var exJson = document.getElementById('pinvExportJson');
        if (exJson) exJson.addEventListener('click', function () { exportJson(app, viewRows(), true); });
        var exGuide = document.getElementById('pinvExportGuide');
        if (exGuide) exGuide.addEventListener('click', function () {
            var csv = 'Field,What to record in each field\n' + FIELDS.map(function (f) {
                var q = function (s) { s = String(s).replace(/\r?\n/g, ' '); return /[",]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
                return q(f.field) + ',' + q(f.what);
            }).join('\n');
            downloadBlob(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), 'SmallWorld-Project-Field-Guide.csv');
        });

        var loadSnap = document.getElementById('pinvLoadSnapshot');
        if (loadSnap) loadSnap.addEventListener('click', function () {
            if (typeof app.restoreLatestSnapshot === 'function') {
                app.restoreLatestSnapshot();
                renderPage(app);
            }
        });

        var refresh = document.getElementById('pinvRefreshLive');
        if (refresh) refresh.addEventListener('click', function () { scanLive(app, false); });
        var refresh2 = document.getElementById('pinvRefreshLive2');
        if (refresh2) refresh2.addEventListener('click', function () { scanLive(app, false); });

        var fh = document.getElementById('pinvFullHistory');
        if (fh) fh.addEventListener('click', function () { scanLive(app, true); });
    }

    function scanLive(app, fullHistory) {
        var status = document.getElementById('pinvLiveStatus');
        var user = (app.currentProfile && app.currentProfile.username) ||
            (app.settings && app.settings.defaultUsername) || 'smallworld_foundation';
        if (status) status.textContent = (fullHistory ? 'Walking the full history of ' : 'Scanning ') + '@' + user +
            ' — the saved scan stays on screen until this finishes.';
        var run = fullHistory && app.scanFullHistory
            ? Promise.resolve(app.scanFullHistory())
            : Promise.resolve(app.fetchProfile(user));
        run.then(function () {
            if (app.logBuildEvent) app.logBuildEvent('project-inventory-live-refresh',
                (fullHistory ? 'Full-history' : 'Live') + ' refresh from the inventory');
            renderPage(app);
            var s2 = document.getElementById('pinvLiveStatus');
            if (s2) s2.textContent = 'Done — ' + ((app.currentPosts || []).length) + ' posts on screen now.';
        }).catch(function (e) {
            renderPage(app);
            var s2 = document.getElementById('pinvLiveStatus');
            if (s2) s2.textContent = 'Scan failed: ' + (e && e.message ? e.message : e) +
                ' — the last saved scan is still shown below.';
        });
    }

    function startEdit(app, index) {
        var list = loadUserProjects();
        var row = list[index];
        if (!row) return;
        if (state.tab !== 'add') goToTab(app, 'add');
        var wrap = document.getElementById('pinvAddWrap');
        if (wrap) wrap.classList.remove('pinv-hidden');
        FIELDS.forEach(function (f) {
            var el = document.querySelector('[data-field="' + f.key + '"]');
            if (el) el.value = row.values[f.key] || '';
        });
        var img = document.getElementById('pinvUserImage');
        if (img) { img.value = row.image || ''; img.dispatchEvent(new Event('input')); }
        var card = document.getElementById('pinvAddCard');
        if (card) card.setAttribute('data-editing', String(index));
        var status = document.getElementById('pinvAddStatus');
        if (status) status.textContent = 'Editing #' + (index + 1) + ' — save to apply.';
    }

    /** Next free client ID for a country and year: CC + 01.. + YY.
     *  The number restarts for each country-year and skips anything already in
     *  use, so hand-typed and generated IDs cannot collide. */
    function nextClientId(country, yearValue) {
        var code = countryCodeFor(country);
        var m = String(yearValue || '').match(/(\d{4})/);
        var yy = (m ? m[1] : String(new Date().getFullYear())).slice(-2);
        var used = {};
        allRows().forEach(function (r) {
            var id = String(r.values.id || '');
            if (id.length === 6 && id.slice(0, 2) === code && id.slice(-2) === yy) used[id.slice(2, 4)] = 1;
        });
        var n = 1;
        while (used[String(n).padStart(2, '0')]) n++;
        return code + String(n).padStart(2, '0') + yy;
    }

    function saveProject(app) {
        var status = document.getElementById('pinvAddStatus');
        var values = {};
        FIELDS.forEach(function (f) {
            var el = document.querySelector('[data-field="' + f.key + '"]');
            values[f.key] = el ? String(el.value || '').trim() : '';
        });
        if (!values.name && !values.description) {
            if (status) status.textContent = 'Give the project a name or a description first.';
            return;
        }
        var list = loadUserProjects();
        var card = document.getElementById('pinvAddCard');
        var editing = card && card.getAttribute('data-editing');
        var editingIndex = (editing != null && editing !== '') ? parseInt(editing, 10) : null;

        // Double-check before saving: an ID that already exists is a duplicate.
        if (values.id) {
            var clash = null;
            allRows().forEach(function (r, i) {
                if (r.values.id === values.id && !(r.origin === 'user' && r.userIndex === editingIndex)) clash = r;
            });
            if (clash) {
                if (status) status.textContent = 'Project ID ' + values.id + ' already exists (' +
                    (clash.values.name || 'existing row') + '). Use a different ID or leave it blank.';
                return;
            }
            if (!/^[A-Z]{2}\d{4}$/.test(values.id)) {
                if (status) status.textContent = 'Project IDs look like UK0126 — a 2-letter country code, a 2-digit ' +
                    'number (01, 02, 03, 04…) and the last two digits of the year; leave it blank to have one generated.';
                return;
            }
        } else {
            values.id = nextClientId(values.country, values.year);
        }

        FIELDS.forEach(function (f) { if (!values[f.key]) values[f.key] = '—'; });
        if (isBlank(values.missing)) {
            values.missing = 'Added by hand — verify against a source document before relying on it.';
        }
        var img = document.getElementById('pinvUserImage');
        var image = img ? String(img.value || '').trim() : '';
        if (image && /^[A-Za-z]:[\\/]/.test(image)) image = fileUrl(image);

        if (editingIndex != null) list[editingIndex] = { values: values, image: image };
        else list.push({ values: values, image: image });
        saveUserProjects(list);

        if (card) card.removeAttribute('data-editing');
        FIELDS.forEach(function (f) {
            var el = document.querySelector('[data-field="' + f.key + '"]');
            if (el) el.value = '';
        });
        if (img) { img.value = ''; img.dispatchEvent(new Event('input')); }
        if (app.logBuildEvent) app.logBuildEvent('project-inventory-add', 'Saved project ' + values.id);

        state.tab = 'inventory';
        state.query = values.id;
        state.page = 1;
        saveView();
        renderPage(app);
        var s2 = document.getElementById('pinvAddStatus');
        if (s2) s2.textContent = 'Saved ' + values.id + '.';
    }

    /* ═══ Public surface ═════════════════════════════════════════════════ */

    var api = {
        FIELDS: FIELDS,
        PROJECTS: ALL_PROJECTS,
        SOURCES: SOURCES,
        METHOD_NOTES: METHOD_NOTES,
        DATA_METHODS: DATA_METHODS,
        ATTACHMENT_TYPES: ATTACHMENT_TYPES,
        ATTACH_EMBED_LIMIT: ATTACH_EMBED_LIMIT,
        attachmentsFor: attachmentsFor,
        buildXlsx: buildXlsx,
        sheetName: 'Project Inventory',
        /* Read-only accessors so the inventory's own numbers can be checked by
           a test in Node without a browser (test_project_inventory.js). */
        rows: function () { return allRows(); },
        stats: function () { return stats(allRows()); },
        analytics: function () { return analytics(allRows()); },
        audit: function () { return auditRows(allRows()); },
        /* Column model: which columns are shown, plus the added ones. Also the
           write path, so the tests can prove add / hide / delete / restore
           without a browser. Every call returns '' on success or the reason. */
        columns: function () {
            return {
                visible: FIELDS.map(function (f) { return f.key; }),
                hidden: COLUMNS.hidden.slice(),
                custom: COLUMNS.custom.map(function (f) {
                    return { key: f.key, field: f.field, type: f.type, options: (f.options || []).slice(), locked: !!f.locked };
                })
            };
        },
        addColumn: function (def) { return addColumn(def); },
        setColumnVisible: function (key, visible) { return setColumnVisible(key, visible); },
        deleteColumn: function (key) { return deleteColumn(key); },
        showAllColumns: function () { return showAllColumns(); },
        cellOptions: function (key) {
            var f = FIELDS.filter(function (x) { return x.key === key; })[0];
            return f ? cellOptions(f) : [];
        },
        /* The same CSV the Download button produces, so the file on disk and the
           exported file can never disagree (generate-project-inventory.js). */
        buildCsv: function () { return toCsv(FIELDS, rowsToArrays(allRows())); },
        /* Client IDs and the country list (checked by test_project_inventory.js). */
        COUNTRY_OPTIONS: COUNTRY_OPTIONS.slice(),
        countryCodeFor: countryCodeFor,
        countryChoices: countryChoices,
        nextClientId: nextClientId
    };

    /* Node path (generate-project-inventory.js writes the workbook file). */
    if (typeof window === 'undefined' && typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    /* Browser path — attach to the app prototype like every other module. */
    if (typeof window !== 'undefined' && typeof InstagramAnalytics !== 'undefined' && InstagramAnalytics.prototype) {
        var P = InstagramAnalytics.prototype;

        P.projectInventoryFields = function () { return FIELDS; };
        P.projectInventoryColumns = function () { return api.columns(); };
        P.addProjectInventoryColumn = function (def) { return addColumn(def); };
        P.setProjectInventoryColumn = function (key, visible) { return setColumnVisible(key, visible); };
        P.deleteProjectInventoryColumn = function (key) { return deleteColumn(key); };
        P.showAllProjectInventoryColumns = function () { return showAllColumns(); };
        P.projectInventoryRows = function () { return ALL_PROJECTS; };
        P.projectInventorySources = function () { return SOURCES; };
        P.projectInventoryDataMethods = function () { return DATA_METHODS; };
        P.projectInventoryViewRows = function () { return viewRows(); };
        P.projectInventoryStats = function () { return stats(allRows()); };
        P.projectInventoryAnalytics = function () { return analytics(allRows()); };
        P.projectInventoryAudit = function () { return auditRows(allRows()); };
        // Getter with no argument — passing a tab name switches to it (and the
        // page re-render that follows is the caller's job).
        P.projectInventoryTab = function (tab) {
            if (tab) { state.tab = tab; state._tabChosen = true; state.page = 1; }
            return state.tab;
        };
        P.setProjectInventorySort = function (key, dir) {
            state.sortKey = key;
            if (dir) state.sortDir = dir > 0 ? 1 : -1;
            saveView();
            renderPage(this);
        };

        P.renderProjectInventoryPage = function () { renderPage(this); };

        // Called by ui.js navigateTo when leaving the Projects page, so the
        // inventory's full-screen overlay cannot hide the titlebar elsewhere.
        P.projectInventoryBlur = function () {
            state.focus = false;
            state.colPop = null;
            state.editColumn = null;
            state.editDraft = {};
            state.editNotice = '';
            state.cellEdit = null;
            state.cellFreeText = false;
            state.colManager = false;
            document.documentElement.classList.remove('swa-inv-focus');
            flattenAncestors(null, false);
            var host = document.getElementById('projectsBody');
            if (host) { host.classList.remove('pinv-focus'); host.innerHTML = ''; }
            if (document.fullscreenElement && document.exitFullscreen) {
                try {
                    var p = document.exitFullscreen();
                    if (p && p.catch) p.catch(function () { });
                } catch (e) { /* already out */ }
            }
        };

        P.exportProjectInventoryExcel = function () { exportXlsx(this, allRows(), false); };

        P._inventoryReady = true;
    }
})();
