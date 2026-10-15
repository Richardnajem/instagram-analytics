/* ═══════════════════════════════════════════════════════════════════════════
   project-inventory.js — SmallWorld project inventory (Projects tab)

   What this module is for
   ----------------------
   Turns the agreed *field guide* below into a working inventory: the guide is
   rendered as a two-column table (Field / What to record in each field) and the
   same fields become the columns of the inventory, one row per project. The
   inventory can be exported as a real .xlsx workbook.

   Data-honesty rules (see AGENTS.md §"Data-honesty rules")
   -------------------------------------------------------
   1. Nothing is invented. Every value is either taken from a named source or
      shown as "—". Where a value is unknown the row's "Missing information"
      cell says what is still needed.
   2. Sources are named per row (the File location column) so each entry can be
      checked. The Sources panel states what was reachable and what was not.
   3. Instagram captions could not be read without a signed-in session, so no
      caption text is used anywhere in this inventory.

   Runtime notes
   -------------
   - Loaded with a plain <script> tag after ui.js (no bundler in this project),
     and also requireable from Node by generate-project-inventory.js so the
     exported workbook and the tab cannot drift apart.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    /* ── The field guide ──────────────────────────────────────────────────
       These 16 fields (in this order) are the guide, the table columns and the
       spreadsheet columns. Order matters: it is the column order in the xlsx. */
    var FIELDS = [
        { key: 'id',          field: 'Project ID',              what: 'A unique code to identify each project.' },
        { key: 'year',        field: 'Year',                    what: 'The year of the project.' },
        { key: 'name',        field: 'Project name',            what: 'The recorded project name; if none exists, use a descriptive title.' },
        { key: 'country',     field: 'Country',                 what: 'The country supported by the project.' },
        { key: 'location',    field: 'Location',                what: 'The state, city, town or community where the project took place.' },
        { key: 'org',         field: 'Beneficiary organization', what: 'The name of the institution receiving the support.' },
        { key: 'instType',    field: 'Institution type',        what: 'School, orphanage, organization or program.' },
        { key: 'description', field: 'Brief description',       what: 'A short explanation of what SmallWorld supported.' },
        { key: 'category',    field: 'Support category',        what: 'School supplies, computers, teaching, scholarships or other support.' },
        { key: 'beneficiaries', field: 'Beneficiaries',         what: 'Number of children supported; ages, boys/girls and school grades, where documented.' },
        { key: 'donation',    field: 'Donation',                what: 'The amount contributed and the currency.' },
        { key: 'deliveryDate', field: 'Delivery date',          what: 'The recorded date when the support was delivered.' },
        { key: 'status',      field: 'Project status',          what: 'Planned, in progress, delivered or closed.' },
        { key: 'documentation', field: 'Available documentation', what: 'Agreements, receipts, photographs and reports available for the project.' },
        { key: 'fileLocation', field: 'File location',          what: 'A link to the folder or original source containing the project information.' },
        { key: 'missing',     field: 'Missing information',     what: 'Information or documents that still need to be located or confirmed.' }
    ];

    /* ── Source shortcuts used in the rows below ─────────────────────────── */
    var SITE = 'https://www.smallworldfoundation.com/';
    function web(page) { return 'Website — ' + page + ': ' + SITE + page; }
    var GALA = 'C:\\Users\\richa\\OneDrive\\Desktop\\CAMERA PROJECTS\\GALA\\';
    var SWDOCS = 'C:\\Users\\richa\\OneDrive\\Desktop\\CAMERA PROJECTS\\Smallworld\\';
    var IG = 'Instagram @smallworld_foundation: https://www.instagram.com/smallworld_foundation/';

    var MISS_WEB = 'Beneficiary organisation, exact location, child count/ages, amount and currency, delivery date, and the agreement/receipt — the source is a one-line website summary.';
    var MISS_WEB_GALA = MISS_WEB + ' No gala photograph is linked to this project yet, although the GALA folder holds the 2011–2016 event archive.';

    /* ── Inventory rows ───────────────────────────────────────────────────
       Arrays, in FIELDS order. "—" always means "not documented in the
       available sources" (never a guess). */
    var PROJECTS = [
        /* ── 2011 ─────────────────────────────────────────────────────────── */
        ['SW-2011-001', '2011', 'Nutrition education programme', 'Australia', '—', '—', 'Program',
            'Supported nutrition education for children, families and the community, helping them make healthier food choices.',
            'Teaching', 'Children, families and the community — count not stated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only); no agreement, receipt or report attached', web('2011achievements.html'), MISS_WEB],

        ['SW-2011-002', '2011', 'Education and health care for 100 children', 'Bosnia', '—', '—', 'Program',
            'Provided proper education for 100 children and access to health and medical care for 100 children (reported as one Bosnia entry).',
            'Teaching + other support', '100 children', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2011achievements.html'),
            'Whether the education and health-care lines describe the same 100 children or two grants; beneficiary organisation; location; amount and currency; delivery date.'],

        ['SW-2011-003', '2011', 'Integrated General & Vocational (IGV) schools', 'Bangladesh', '—',
            '2 Integrated General & Vocational (IGV) schools and 10 technical schools', 'School',
            'Provided integrated general and vocational education, skills training and employment support.',
            'Teaching', 'Students across 12 schools — count not stated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2011achievements.html'), MISS_WEB],

        ['SW-2011-004', '2011', 'Vocational skills training', 'Palestine', '—', '—', 'Program',
            'Developed secretarial and administrative skills, beauty, hand embroidery and machine sewing skills for children.',
            'Teaching', 'Children — count not stated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2011achievements.html'), MISS_WEB],

        ['SW-2011-005', '2011', 'Conductive education for children with motor disabilities', 'Hungary', '—', '—', 'Program',
            'Supported the education of persons with motor disabilities through conductive education and pedagogical rehabilitation.',
            'Teaching', 'Children — count not stated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2011achievements.html'), MISS_WEB],

        ['SW-2011-006', '2011', 'Mental and physical well-being of foster children', 'Indonesia', '—', '—', 'Program',
            'Supported 20 foster children with their mental and physical well-being.',
            'Other support', '20 foster children', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2011achievements.html'), MISS_WEB],

        ['SW-2011-007', '2011', 'Foster children support package', 'Jordan', '—', '—', 'Program',
            'Covered the expenses of 20 foster children, including clothing, medical and education expenses.',
            'Other support', '20 foster children', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2011achievements.html'), MISS_WEB],

        ['SW-2011-008', '2011', 'Social-emotional learning programme', 'Panama',
            'Chorrillo, San Felipe, Santa Ana and Barraza (Panama City)', '9 at-risk-area schools (partner not named)', 'School',
            'Delivered a social-emotional learning programme to 1,300 children in 9 schools located in at-risk areas.',
            'Teaching', '1,300 children (grades 4–5)', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2011achievements.html') + ' | ' + web('america.html'), MISS_WEB],

        ['SW-2011-009', '2011', 'Arts and creativity classes', 'Armenia', '—', '—', 'Program',
            'Supported 100 children in classes for dance, painting, photography, embroidery, theatre arts, poetry, storytelling, woodcraft, miniature and singing, art therapy and English.',
            'Teaching', '100 children', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2011achievements.html'), MISS_WEB],

        ['SW-2011-010', '2011', 'Smile Park mobile playground', 'Japan', 'Fukushima', '—', 'Program',
            'Built the largest-scale mobile indoor playground to reach 2,334 children affected by the Fukushima nuclear accident.',
            'Other support', '2,334 children', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2011achievements.html'), MISS_WEB],

        ['SW-2011-011', '2011', 'Children’s hospice auditorium', 'Kuwait', '—', 'Bayt Abdullah Children’s Hospice', 'Organization',
            'Funds were dedicated to building an auditorium — a space where children with terminal illnesses and their families can gather and learn.',
            'Other support (construction)', 'Over 500 children and their families', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2011achievements.html') + ' | ' + web('middleeast.html'), MISS_WEB],

        ['SW-2011-012', '2011', 'Sports competitions for children', 'Ukraine', '—', '—', 'Program',
            'Organised sports competitions for 633 children.',
            'Other support', '633 children', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2011achievements.html'), MISS_WEB],

        ['SW-2011-013', '2011', 'Free cleft lip/palate surgeries', 'China', '—', '—', 'Program',
            'Supported surgeries free of charge for children born with CLP from low-income families. The same page also records support for childhood cancer research.',
            'Other support (medical)', 'Children — count not stated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2011achievements.html'), MISS_WEB],

        ['SW-2011-014', '2011', 'Nutrition and health care', 'Colombia', '—', '—', 'Program',
            'Provided nutrition and health care for 70 children.',
            'Other support', '70 children', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2011achievements.html'), MISS_WEB],

        ['SW-2011-015', '2011', 'Autism assessments and therapy', 'Lebanon', '—', 'Lebanese Autism Society', 'Organization',
            'Provided psychological and special-education assessments around Lebanon plus psychomotor and speech therapy and special-education intervention sessions.',
            'Other support', 'Children with autism — count not stated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2011achievements.html') + ' | ' + web('middleeast.html'), MISS_WEB],

        ['SW-2011-016', '2011', 'Hearing aids for children with disabilities', 'Turkey', '—',
            'TESYEV — Disabled Sports Support and Education Foundation', 'Organization',
            'Provided handicapped children with hearing aids and supported the development of activities for disabled children.',
            'Other support', 'Children — count not stated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2011achievements.html') + ' | ' + web('middleeast.html'), MISS_WEB],

        ['SW-2011-017', '2011', 'Childhood cancer research grant', 'USA', '—', 'Alex’s Lemonade Stand', 'Organization',
            'Dedicated a fund to the NGO in order to support childhood cancer research.',
            'Other support (grant)', 'Not applicable — research grant', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2011achievements.html') + ' | ' + web('america.html'), MISS_WEB],

        ['SW-2011-018', '2011', 'Walkathon 2011', 'UAE', 'Abu Dhabi', '—', 'Program (awareness campaign)',
            'First walkathon, led by H.E. Sheikh Nahyan Mubarak Al Nahyan; every participant signed a petition against child slavery and child abuse.',
            'Other support (awareness)', 'Not applicable — awareness campaign', '—', '2011', 'Delivered (as reported)',
            'Website campaigns entry (text only)', web('campaigns.html'), MISS_WEB],

        /* ── 2012 ─────────────────────────────────────────────────────────── */
        ['SW-2012-001', '2012', 'Vocational training courses', 'Egypt', '—', '—', 'Program',
            'Provided vocational training to 10 underprivileged children in mechanics, carpentry, accessory making and hairdressing to open future job opportunities.',
            'Teaching', '10 children', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2012achievements.html'), MISS_WEB],

        ['SW-2012-002', '2012', 'Vocational training courses', 'Colombia', '—', '—', 'Program',
            'Provided vocational training to 7 children in integral coiffure, food manipulation, finance, accounting and music.',
            'Teaching', '7 children', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2012achievements.html'), MISS_WEB],

        ['SW-2012-003', '2012', 'School enrolment preparation', 'India', 'Harijan community', 'Association Aangan', 'Program',
            'Helped prepare 288 children for enrolment in public schools by providing vocational and semi-educational courses.',
            'Teaching', '288 children', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2012achievements.html') + ' | ' + web('visitsontheground.html'),
            'Beneficiary org confirmed as Association Aangan; exact city/town, amount and currency, delivery date and agreement/receipt still needed.'],

        ['SW-2012-004', '2012', 'School-year sponsorship and home sanitation', 'Italy', '—', '—', 'Program',
            'Sponsored 10 children to attend the school year 2012/2013 and enrol in different schools, and improved health conditions by organising works to the toilets and septic tanks of the children’s houses.',
            'Scholarships + other support', '10 children', '—', 'School year 2012/2013', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2012achievements.html'), MISS_WEB],

        ['SW-2012-005', '2012', 'Vocational training and non-formal education', 'Bangladesh', '—', '—', 'Program',
            '27 children who are victims of abandoned parents or family disintegration benefited from vocational training and non-formal education support.',
            'Teaching', '27 children', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2012achievements.html'), MISS_WEB],

        ['SW-2012-006', '2012', 'Two-year child sponsorship', 'Jordan', '—', '—', 'Program',
            'Sponsored 3 children for two consecutive years, giving them the chance to get their education and protection from exploitation.',
            'Scholarships', '3 children', '—', 'Two consecutive years (start year not stated)', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2012achievements.html'),
            'Start year of the two-year term; beneficiary organisation; location; amount and currency; agreement/receipt.'],

        ['SW-2012-007', '2012', 'One-year education support', 'Lebanon', '—', '—', 'Program',
            'Supported and educated 17 children for one year, reinforcing the educative role of their families.',
            'Teaching', '17 children', '—', 'One year (start date not stated)', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2012achievements.html'), MISS_WEB],

        ['SW-2012-008', '2012', 'Education and skills for 34 children', 'Mexico', '—', 'DIF Torreon', 'Organization',
            'Helped 34 children get their education and acquire a skill for a normal, happy and secure life.',
            'Teaching', '34 children', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2012achievements.html') + ' | ' + web('america.html'), MISS_WEB],

        ['SW-2012-009', '2012', 'Child sponsorship', 'Panama', '—', 'Panamanian non-profit partner (not named)', 'Organization',
            'Sponsored 5 children and helped them get proper education to secure their future.',
            'Scholarships', '5 children', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2012achievements.html'),
            'Partner organisation name; location; amount and currency; delivery date; agreement/receipt.'],

        ['SW-2012-010', '2012', 'School and college sponsorship', 'Philippines', '—', '—', 'Program',
            'Sponsored 12 children and helped them get education in schools, supporting many of them throughout college education.',
            'Scholarships', '12 children', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2012achievements.html'), MISS_WEB],

        ['SW-2012-011', '2012', 'Child-education department for trafficking victims', 'UAE', '—', 'EWA’A (EWAA Center)', 'Organization',
            'Initiated a child education department responsible for educating the victims of human trafficking.',
            'Program (services)', 'Victims of human trafficking — count not stated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2012achievements.html'), MISS_WEB],

        ['SW-2012-012', '2012', 'Long-term education sponsorship', 'Ukraine', '—', '—', 'Program',
            'Gave 17 children of various ages the chance to get education for five to six years depending on their age.',
            'Scholarships', '17 children', '—', 'Five to six years (start date not stated)', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2012achievements.html'),
            'Start year of the multi-year sponsorship; beneficiary organisation; amount and currency; agreement/receipt.'],

        /* ── 2013 ─────────────────────────────────────────────────────────── */
        ['SW-2013-001', '2013', 'Gala Dinner and Grand Event (Ricky Martin)', 'UAE', 'Abu Dhabi', '—', 'Program (fundraising event)',
            'Gala dinner hosting more than 500 guests and the SmallWorld Grand Event with more than 1,000 guests, with Mega Star Ricky Martin supporting as a philanthropist. Funds were raised to educate children in more than 15 countries worldwide.',
            'Other support (fundraising)', 'Not applicable — fundraising event', '— (amount raised not published)', '2013', 'Delivered (as reported)',
            'Website achievements entry; photo archive of the gala/celebrity nights (6,373 files, 2011–2016) and a short Ricky Martin bio document',
            web('2013achievements.html') + ' | ' + GALA + 'Celebrities\\Ricky Martin\\ | ' + GALA + 'SMALLWORLD CELEBRITY\\',
            'Total raised and the specific country projects the proceeds funded; which photo sub-folder documents which night; the amount has to come from a receipt or bank record, not the event write-up.'],

        ['SW-2013-002', '2013', 'Sponsorship of 34 children', 'Mexico', '—', 'DIF Torreon', 'Organization',
            'Sponsored 34 children with extreme cases of poverty, sexual and emotional abuse and helped them get proper school education, saving them from exploitation.',
            'Scholarships', '34 children', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2013achievements.html') + ' | ' + web('america.html'), MISS_WEB],

        ['SW-2013-003', '2013', 'Sponsorship of orphan teenage girls', 'Panama', '—', '—', 'Organization',
            'Supported the education of 5 orphan teenage girls from abusive family backgrounds to help them become productive members of their communities.',
            'Scholarships', '5 orphan teenage girls', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2013achievements.html'), MISS_WEB],

        ['SW-2013-004', '2013', 'University sponsorship', 'Philippines', '—', '—', 'Program',
            'Made a difference in the lives of 4 deserving college students by giving them the opportunity to continue their studies.',
            'Scholarships', '4 college students', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2013achievements.html'), MISS_WEB],

        ['SW-2013-005', '2013', 'Ricky Martin Foundation grant', 'Puerto Rico', '—', 'Ricky Martin Foundation', 'Organization',
            'Funds received from SmallWorld in 2013; 10 children were enrolled into formal education and vocational training. The November 2014 partner report states the beneficiaries "perform in accordance to project’s goals".',
            'Teaching', '10 children', '—', '—', 'Delivered (as reported)',
            'Website regional impact entry citing the partner report', web('america.html'), MISS_WEB],

        /* ── 2014 ─────────────────────────────────────────────────────────── */
        ['SW-2014-001', '2014', 'Non-formal education for refugees', 'Lebanon', '—', '—', 'Program',
            'Contributed to the education of Syrian and Palestinian refugees with little or no access to Lebanese public schools by delivering appropriate, effective and sustainable non-formal education.',
            'Teaching', 'Refugee children — count not stated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2014achievements.html'), MISS_WEB],

        ['SW-2014-002', '2014', 'Professional teacher support', 'Lebanon', '—', '—', 'Program',
            'Provided a professional teacher to educate underprivileged children and help them enhance their knowledge and skills.',
            'Teaching', 'Children — count not stated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2014achievements.html'), MISS_WEB],

        ['SW-2014-003', '2014', 'Primary education for 10 children', 'Mexico', '—', 'DIF Torreon', 'Organization',
            'Supported primary education for two executive years by covering tuition fees, transport, school supplies, lunch and uniforms.',
            'Scholarships', '10 children', '—', 'Two years (start year not stated)', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2014achievements.html') + ' | ' + web('america.html'),
            'Start year of the two-year support; amount and currency; agreement/receipt.'],

        ['SW-2014-004', '2014', 'University sponsorship', 'Philippines', '—', '—', 'Program',
            '4 underprivileged children were supported throughout their university education for 4 years.',
            'Scholarships', '4 children', '—', '4 years (start year not stated)', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2014achievements.html'),
            'Start year of the four-year support; beneficiary organisation; amount and currency; agreement/receipt.'],

        ['SW-2014-005', '2014', 'Primary education support', 'Spain', '—', '—', 'Program',
            'Contributed to the primary education of 11 underprivileged children.',
            'Scholarships', '11 children', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2014achievements.html'), MISS_WEB],

        ['SW-2014-006', '2014', 'Special education for children with disabilities', 'Brazil', '—', 'Vida Nova Association', 'Organization',
            'Provided individualised care in physical, cognitive and psycho-social support; partner reports state the funds received in 2014 supported the special education of 15 children.',
            'Other support', '15–16 children (the two source lines differ: 16 in care, 15 in special education)', '—', '—', 'Delivered (as reported)',
            'Website achievements entry; partner report not yet received by SmallWorld',
            web('2014achievements.html') + ' | ' + web('america.html'),
            'Which figure is correct (15 or 16); amount and currency; delivery date; the partner progress report (the source notes it had not been received).'],

        ['SW-2014-007', '2014', 'Clinical therapy for children with special needs', 'Greece', '—', '—', 'Program',
            'Provided clinical therapy for underprivileged children with special needs with the help of a network of specialists.',
            'Other support', 'Children — count not stated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2014achievements.html'), MISS_WEB],

        ['SW-2014-008', '2014', 'Child mistreatment expert', 'Spain', '—', '—', 'Program',
            'Dedicated an expert on child mistreatment to exclusively assist children at risk from the education system.',
            'Program (services)', 'Children at risk — count not stated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2014achievements.html'), MISS_WEB],

        ['SW-2014-009', '2014', 'Basic education, training and nutrition', 'Bangladesh', 'Dhaka',
            'Drop-In Center (DIC) for street and working children', 'Organization',
            'Supported 40 children with basic education, training and workshops, nutrition and recreational activities. DIC provides daily meals, basic education and counselling, and children received vocational training in accessories fabrication.',
            'Teaching', '40 children', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2014achievements.html') + ' | ' + web('visitsontheground.html'), MISS_WEB],

        ['SW-2014-010', '2014', 'The Great Gatsby Gala Dinner', 'UAE', '—', '—', 'Program (fundraising event)',
            'Fundraising gala dinner documented by the photo archive in the GALA folder: "2014 THE GREAT GATSBY GALA DINNER" (2,657 images) and "2014 Grand Event Pics" (2,903 images).',
            'Other support (fundraising)', 'Not applicable — fundraising event', '— (amount raised not published)', '2014', 'Delivered — event documented',
            'Photo archive only; no financial record, guest list or programme document',
            GALA + '2014 THE GREAT GATSBY GALA DINNER\\ | ' + GALA + '2014 Grand Event Pics\\',
            'Amount raised and the projects the proceeds funded; receipts or bank records; the gallery/venues and formal event programme.']
    ];

    /* ── Additional 2015–2026 rows, kept in the same 16-field order ──────── */
    var PROJECTS_2 = [
        /* ── 2015 ─────────────────────────────────────────────────────────── */
        ['SW-2015-001', '2015', 'Non-formal education', 'India', '—', '—', 'Program',
            'Contributed to the education of children who have little or no access to Indian public schools by delivering non-formal education.',
            'Teaching', 'Children — count not stated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2015achievements.html'), MISS_WEB],

        ['SW-2015-002', '2015', 'Integral development in Bogotá', 'Colombia', 'Bogotá', '—', 'Program',
            'Contributed to the integral development of children, youth and their families living in social and economic vulnerability.',
            'Other support', 'Children, youth and families — count not stated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2015achievements.html'), MISS_WEB],

        ['SW-2015-003', '2015', 'Non-formal education for refugees', 'Lebanon', '—', '—', 'Program',
            'Contributed to the education of Syrian and Palestinian refugees with little or no access to Lebanese public schools.',
            'Teaching', 'Refugee children — count not stated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2015achievements.html'), MISS_WEB],

        ['SW-2015-004', '2015', 'Street children back to school', 'Mexico', '—', '—', 'Program',
            'Provided the chance for street children to return to school and continue their education.',
            'Teaching', 'Street children — count not stated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2015achievements.html') + ' | ' + web('2021achievements.html'),
            MISS_WEB + ' The same line also appears on the 2021 page — confirm whether this was one grant or two.'],

        ['SW-2015-005', '2015', 'School fees and educational equipment', 'Nigeria', '—', '—', 'Program',
            'Provided school fees, educational tools and equipment for female children who come from violent backgrounds.',
            'Scholarships + school supplies', 'Female children — count not stated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2015achievements.html'), MISS_WEB],

        ['SW-2015-006', '2015', 'Non-formal education', 'Philippines', '—', '—', 'Program',
            'Contributed to the education of children with little or no access to Philippine public schools by delivering non-formal education.',
            'Teaching', 'Children — count not stated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2015achievements.html'), MISS_WEB],

        ['SW-2015-007', '2015', 'Scholarships for migrant children', 'Thailand', '—',
            'Center for the Protection of Children’s Rights Foundation (CPCR)', 'Organization',
            'Supported migrant children with scholarships, educational tools, basic needs and preparation costs for children aged 15 and above pursuing non-formal education. CPCR also took care of 130 child abuse and neglect cases, using the grant mainly to guarantee security and healthcare.',
            'Scholarships', 'Migrant children — count not stated; 130 abuse/neglect cases handled by CPCR', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only); grant was delivered through a fundraising event held in Abu Dhabi',
            web('2015achievements.html') + ' | ' + web('visitsontheground.html'),
            MISS_WEB + ' Which UAE fundraising event funded the grant, and the number of scholarship beneficiaries.'],

        ['SW-2015-008', '2015', 'Education for trafficking victims', 'UAE', '—', '—', 'Program',
            'Contributed to the education of children who are victims of human trafficking and have little or no access to UAE public schools.',
            'Teaching', 'Children — count not stated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2015achievements.html'), MISS_WEB],

        ['SW-2015-009', '2015', 'Vocational training in design and handicrafts', 'Egypt', '—', '—', 'Program',
            'Empowered 10 underprivileged children with skills in fashion design, accessories and jewellery design and handicrafts, in conjunction with training centres.',
            'Teaching', '10 children', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2015achievements.html'), MISS_WEB],

        ['SW-2015-010', '2015', 'Music and sports talent development', 'Ukraine', '—', '—', 'Program',
            'Supported 15 underprivileged children in developing their talents in music and sports.',
            'Other support', '15 children', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2015achievements.html') + ' | ' + web('2021achievements.html'),
            MISS_WEB + ' The same line also appears on the 2021 page — confirm whether this was one grant or two.'],

        ['SW-2015-011', '2015', 'Therapeutic intervention for at-risk teenagers', 'Spain', '—', '—', 'Program',
            'Supported 15 individuals (ages 12–16) with a common profile of poor, deficient or non-existent family structure through therapeutic intervention.',
            'Other support', '15 young people (ages 12–16)', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2015achievements.html'), MISS_WEB],

        /* ── 2016 ─────────────────────────────────────────────────────────── */
        ['SW-2016-001', '2016', 'Library for orphans in Dire Dawa', 'Ethiopia', 'Dire Dawa (Eastern Ethiopia)', 'Luqman Primary School', 'School',
            'Funded the building and equipping of a library for 500 orphans, with capacity to lend all elementary fundamental books to 300 children, reducing drop-outs in a poor area hit by clashes between the Somali and Oromia regions.',
            'Other support (construction) + school supplies', '500 orphans; lending capacity for 300 children', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only) and project page text',
            web('2016achievements.html') + ' | ' + web('20172018achievements.html') + ' | ' + web('projects.html'),
            MISS_WEB + ' Reported on both the 2016 and the 2017–2018 pages — confirm whether this was one grant or two.'],

        ['SW-2016-002', '2016', 'Ten computers for IT lessons', 'Lebanon', '—', '—', 'Program',
            'Provided 10 computers to properly equip a dedicated classroom / computer lab for IT lessons for Syrian refugees.',
            'Computers', 'Refugee children — count not stated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2016achievements.html'), MISS_WEB],

        ['SW-2016-003', '2016', 'Arabic and Art teacher', 'Lebanon', '—', '—', 'Program',
            'Provided a professional teacher to educate children and enhance their knowledge and skills in Arabic and Art.',
            'Teaching', 'Children — count not stated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2016achievements.html'), MISS_WEB],

        ['SW-2016-004', '2016', 'Child mistreatment expert for at-risk children', 'Spain', '—', '—', 'Program',
            'Assisted 15 at-risk children (ages 8–17), their families and professionals working in child protection by dedicating an expert on child mistreatment.',
            'Program (services)', '15 children (ages 8–17)', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2016achievements.html'), MISS_WEB],

        ['SW-2016-005', '2016', 'Walkathon 2016', 'UAE', 'Abu Dhabi', '—', 'Program (awareness campaign)',
            'Second walkathon with workshops where children created an art piece and sent a letter of hope to an anonymous child elsewhere, signing "Today I walked for you".',
            'Other support (awareness)', 'Not applicable — awareness campaign', '—', '2016', 'Delivered (as reported)',
            'Website campaigns entry (text only)', web('campaigns.html'), MISS_WEB],

        /* ── 2017–2018 ────────────────────────────────────────────────────── */
        ['SW-2017-001', '2017–2018', 'Computer laboratory in Fas', 'Morocco', 'Fas (Fez)', 'Sajlamasa school', 'School',
            'Established a fully equipped computer laboratory for underprivileged children, in collaboration with the UAE Red Crescent; the Ambassador of the United Arab Emirates in Morocco presented the donation to the school on SmallWorld’s behalf.',
            'Computers', 'Children — count not stated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry and project page text (text only)',
            web('20172018achievements.html') + ' | ' + web('projects.html') + ' | ' + web('visitsontheground.html'),
            MISS_WEB + ' Exact delivery date and the hand-over record from the UAE Embassy.'],

        ['SW-2017-002', '2017–2018', 'Socotra nursery', 'Yemen', 'Socotra', '— (partner: UAE Red Crescent)', 'School (nursery)',
            'Built a fully equipped nursery next to a school for hundreds of children, giving them access to basic education and a preparatory curriculum before joining school.',
            'Other support (construction)', 'Hundreds of children — count not stated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry and project page text (text only)',
            web('20172018achievements.html') + ' | ' + web('projects.html') + ' | ' + web('middleeast.html'), MISS_WEB],

        /* ── 2019 ─────────────────────────────────────────────────────────── */
        ['SW-2019-001', '2019', 'Computer laboratory for 540 students', 'Lebanon', 'Bekaa', '—', 'School',
            'A fully equipped computer laboratory was provided for 540 students.',
            'Computers', '540 students', '—', '—', 'Delivered (as reported)',
            'Website achievements entry and project page text (text only)',
            web('achievements2019.html') + ' | ' + web('projects.html'), MISS_WEB],

        ['SW-2019-002', '2019', 'IT laboratory for orphaned children', 'Lebanon', '—', 'Home orphanages', 'Orphanage',
            'An IT laboratory for abandoned and orphaned children.',
            'Computers', 'Orphaned children — count not stated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry and project page text (text only)',
            web('achievements2019.html') + ' | ' + web('projects.html'), MISS_WEB],

        ['SW-2019-003', '2019', 'Barber Center vocational training', 'Lebanon', '—', '—', 'Program',
            'A barber centre for boys to facilitate a vocational training programme teaching barber services.',
            'Teaching', 'Boys — count not stated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry and project page text (text only)',
            web('achievements2019.html') + ' | ' + web('projects.html'), MISS_WEB],

        ['SW-2019-004', '2019', 'Computer laboratory for drop-outs', 'Lebanon', 'Tripoli', '—', 'Program',
            'A computer laboratory was installed and fully equipped for underprivileged children who have no access to computers or proper education; many are drop-outs with a history of abuse.',
            'Computers', 'Children — count not stated', '—', '—', 'Delivered (as reported)',
            'Website project page text (text only)', web('projects.html'), MISS_WEB],

        /* ── 2019–2020 ────────────────────────────────────────────────────── */
        ['SW-2020-001', '2019–2020', 'Fifteen computers for home orphanages', 'Lebanon', '—', 'Home orphanages', 'Orphanage',
            'Supported computer laboratory projects by donating 15 computers for home orphanages, giving children computer skills and access to educational programmes.',
            'Computers', 'Underprivileged children — count not stated; 15 computers donated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('20192020achievements.html'), MISS_WEB],

        ['SW-2020-002', '2019–2020', 'Educative material for autistic children', 'UAE', '—', '—', 'Program',
            'Supported autistic children in need of educative material to continue their educational journeys.',
            'School supplies', 'Autistic children — count not stated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('20192020achievements.html'), MISS_WEB],

        ['SW-2020-003', '2019–2020', 'Intensive academic catch-up programme', 'UAE', '—', '—', 'Program',
            'Provided 25 underprivileged children with an intensive programme in English, Maths, Arabic and Science so they could sit the ADEC governmental exam and re-enrol in schools after two years out of school.',
            'Teaching', '25 children', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('20192020achievements.html'), MISS_WEB],

        ['SW-2020-004', '2019–2020', '256 laptops with UNHCR', 'UAE', 'Sharjah and Ajman', 'UNHCR (partnership)', 'Organization',
            'Provided disadvantaged Syrian children with 256 laptops as part of the "Virtual Learning Developmental Support Program".',
            'Computers', '256 children — 256 laptops', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('20192020achievements.html'),
            MISS_WEB + ' Partnership agreement/MoU with UNHCR and the delivery record.'],

        /* ── 2021 ─────────────────────────────────────────────────────────── */
        ['SW-2021-001', '2021', '81 laptops for remote education', 'UAE', 'Ras Al Khaimah, Sharjah and Ajman', '—', 'Program',
            'Donated 81 laptops as an in-kind contribution to enable 81 vulnerable Syrian children to continue their remote education during COVID-19 measures.',
            'Computers', '81 children — 81 laptops', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2021achievements.html'),
            MISS_WEB + ' In-kind donation record or delivery note per emirate.'],

        ['SW-2021-002', '2021', 'School supplies for autistic students', 'UAE', 'Abu Dhabi', 'Emirates Autism Center', 'Organization',
            'In-kind donation of school supplies, stationery and keyboards to enable autistic students with their distance learning.',
            'School supplies', 'Autistic students — count not stated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2021achievements.html'), MISS_WEB],

        ['SW-2021-003', '2021', 'Five laptops for distance learning', 'UAE', '—', 'Basmat Amal Initiative', 'Organization',
            'Donated 5 laptops to support children with low economic resources to continue their distance learning.',
            'Computers', '5 laptops', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2021achievements.html'), MISS_WEB],

        ['SW-2021-004', '2021', 'Educational tools for autistic children', 'UAE', '—', 'Orange Seeds Nursery', 'Organization',
            'Supported Orange Seeds Nursery with an in-kind donation of educational tools for autistic children with low economic resources.',
            'School supplies', 'Autistic children — count not stated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2021achievements.html'), MISS_WEB],

        ['SW-2021-005', '2021', 'Filmmaking training', 'UAE', '—', 'Basmat Amal Initiative', 'Organization',
            'Sponsored 7 children in learning all aspects of filmmaking, from storyboarding to filming to editing.',
            'Teaching', '7 children', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2021achievements.html'), MISS_WEB],

        ['SW-2021-006', '2021', 'Library books and materials', 'UAE', 'Abu Dhabi', 'Basmat Amal Initiative', 'Organization',
            'In-kind donation of Arabic and English dictionaries, printable activity books, story books, magazines and activity books for the library at the Basmat Amal premises.',
            'School supplies', 'Students of Basmat Amal Initiative — count not stated', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2021achievements.html'), MISS_WEB],

        /* ── 2022 ─────────────────────────────────────────────────────────── */
        ['SW-2022-001', '2022', 'Drop-out prevention workshops', 'India', '—', '—', 'Program',
            'Supported 120 disadvantaged children at risk of dropping out of school with child-friendly teaching techniques and workshops.',
            'Teaching', '120 children', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2022achievements.html'), MISS_WEB],

        ['SW-2022-002', '2022', 'School supplies for 400 children', 'Malawi', '—', '—', 'Program',
            'Supported 400 vulnerable children with school supplies to continue their education.',
            'School supplies', '400 children', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2022achievements.html'), MISS_WEB],

        ['SW-2022-003', '2022', 'Laptops for Syrian families', 'UAE', '—', '—', 'Program',
            'Supported 5 Syrian underprivileged families with laptops to help their children with online education.',
            'Computers', '5 families', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2022achievements.html'), MISS_WEB],

        ['SW-2022-004', '2022', 'Earthquake emergency response', 'Syria and Turkey', '—', '—', 'Program',
            'Supported 50 families who lost everything in the earthquake with warm blankets, clothes, kitchen supplies and materials to build shelters.',
            'Other support (emergency)', '50 families', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2022achievements.html'),
            MISS_WEB + ' Beneficiary count is expressed in families, not children.'],

        ['SW-2022-005', '2022', 'Social and emotional learning', 'United Kingdom', '—', '—', 'Program',
            'Supported 100 disadvantaged children from reception to year 6 who have learning difficulties with social and emotional learning.',
            'Teaching', '100 children (reception to year 6)', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2022achievements.html'), MISS_WEB],

        /* ── 2023 ─────────────────────────────────────────────────────────── */
        ['SW-2023-001', '2023', 'Education and psychosocial support in temporary learning spaces', 'Middle East (multiple countries)', '—', '—', 'Program',
            'Ran education activities in 16 temporary learning spaces with an estimated 5,800 children taking part in non-formal education and psychosocial support, and resumed activities in 20 schools while working with other international organisations to make schools safe.',
            'Teaching', 'Estimated 5,800 children', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2023achievements.html'),
            'Country-level split, partner organisations, amount and currency and delivery dates.'],

        ['SW-2023-002', '2023', 'Education kits for children in camps', 'Turkey', 'Gaziantep (two temporary camps)', '—', 'Program',
            'Supplied more than 500 education kits for children in two temporary camps, plus 16 teacher kits and 17 sets of rain boots for teachers and school staff, and transported 14 teachers into villages.',
            'School supplies', 'More than 500 children; 14 teachers supported', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2023achievements.html'),
            MISS_WEB + ' Which organisation distributed the kits and when.'],

        ['SW-2023-003', '2023', 'Tents and shelter support', 'Syria', '22 temporary camps', '—', 'Program',
            'Provided 116 new tents to families; partners on site continued distributing hot meals, supporting 28,794 people, and providing heaters, fuel and food parcels.',
            'Other support (shelter)', '116 families; 28,794 people reached overall', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2023achievements.html'),
            MISS_WEB + ' Beneficiary figures cover whole families/populations, not children only.'],

        ['SW-2023-004', '2023', 'Essential items after heavy rains', 'Turkey', 'Adıyaman, Gaziantep, Kahramanmaraş and Hatay', '—', 'Program',
            'Delivered essential items such as tarpaulin, ropes, blankets and raincoats; expert teams advised the national Repair Task Force and supported assessments in Nurdağı.',
            'Other support (NFI)', 'Not quantified in the source', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2023achievements.html'), MISS_WEB],

        ['SW-2023-005', '2023', 'Water, sanitation and hygiene', 'Syria', '22 temporary camps', '—', 'Program',
            'Provided daily water trucking and waste management for 36,346 people across 22 temporary camps.',
            'Other support (WASH)', '36,346 people', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2023achievements.html'), MISS_WEB],

        ['SW-2023-006', '2023', 'Hygiene and dignity kits', 'Turkey', '—', '—', 'Program',
            'Distributed 977 hygiene kits (shampoo, toothbrushes, toilet roll) and 2,516 dignity kits (sanitary products), supporting 6,120 people.',
            'Other support', '6,120 people', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2023achievements.html'), MISS_WEB],

        ['SW-2023-007', '2023', 'Primary healthcare and nutrition screening', 'Syria', '—', '—', 'Program',
            'Provided access to more than 952 children, with 1,473 adults accessing primary healthcare through mobile clinics, and screened children under five for malnutrition treatment.',
            'Other support (health)', '952 children; 1,473 adults', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2023achievements.html'), MISS_WEB],

        ['SW-2023-008', '2023', 'Ramadan dry food distribution', 'Turkey', 'Hatay, Gaziantep, Kahramanmaraş and Adıyaman', '—', 'Program',
            'Delivered dry food including rice, dates and flour to around 10,000 families during the month of Ramadan.',
            'Other support (food)', 'Around 10,000 families', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2023achievements.html'), MISS_WEB],

        ['SW-2023-009', '2023', 'Cash assistance for homeless families', 'Syria', '—', '—', 'Program',
            'Provided cash transfers to more than 1,900 families who had been left homeless.',
            'Other support (cash)', 'More than 1,900 families', '—', '—', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2023achievements.html'), MISS_WEB],

        /* ── 2024 ─────────────────────────────────────────────────────────── */
        ['SW-2024-001', '2024', 'Safe study spaces in Calderdale', 'United Kingdom', 'Calderdale', '—', 'Program',
            'Support for disadvantaged children aged 11–18: safe study spaces, tutoring sessions and an office as a safe space to study independently, aimed at young people affected by abuse, neglect or trauma. Term of one year; up to 4 hours over approximately 200 sessions.',
            'Teaching', 'Children aged 11–18 — count not stated; ~200 sessions of up to 4 hours', '—', 'Term of one year (start date not stated)', 'Delivered (as reported)',
            'Website achievements entry (text only)', web('2024achievements.html'),
            MISS_WEB + ' Number of children, start and end dates and the grant agreement.'],

        /* ── 2025 ─────────────────────────────────────────────────────────── */
        ['SW-2025-001', '2025', 'Youth leadership programme for young refugees', 'United Kingdom', '—', '—', 'Program',
            'An 8-week youth leadership programme starting after Christmas, focused on developing knowledge and skills for entry-level job opportunities, to empower young refugees without access to university-level education.',
            'Teaching', 'Young refugees — count not stated', '—', 'Programme starts after Christmas', 'In progress (as reported)',
            'Website achievements entry (text only)', web('2025achievements.html'),
            MISS_WEB + ' Exact start date, delivery partner and participant numbers.'],

        ['SW-2025-002', '2025', 'National refugee education helpline', 'United Kingdom', '—', '—', 'Program',
            'A dedicated support line giving refugees, asylum seekers and caregivers advice and resources on the UK education system. Key deliverables: direct support to 2,000 refugees with education-related queries, an impact report (beneficiary data, education levels, testimonies, case outcomes) and a financial accountability report.',
            'Program (services)', 'Direct support to 2,000 refugees; reported in queries rather than children', '—', 'Not stated', 'In progress (as reported)',
            'Website achievements entry (text only); the impact and financial accountability reports are described as deliverables, not yet in the folder',
            web('2025achievements.html'),
            'Delivery partner; the impact report and the financial accountability report; the grant agreement and amount.'],

        /* ── 2026 — local documents ───────────────────────────────────────── */
        ['SW-2026-001', '2026', 'Rethinking School — Empowering Education for a Changing World', 'United Kingdom', '—',
            'Big Education (Registration No. 07648389)', 'Organization',
            'Two-year partnership supporting the Rethinking School Project, helping UK state schools move beyond exam-focused learning through the Head, Heart and Hand framework. Pilot in two UK schools — one primary, one secondary — delivering teacher training and leadership development, student workshops on wellbeing, creativity and teamwork, learning toolkits, mentoring and ongoing support, and collaborative exchanges. A Partnership Engagement Addendum sets out four structured engagement visits over two years (board, volunteer, community and children’s impact visit) and SmallWorld representation at public events such as the Next Generation Schools Conference (March 2026).',
            'Teaching', '1,000+ students and their educators (two schools)',
            '£10,000 (funding request stated in the proposal; no confirmation of receipt in the folder)',
            'Not yet delivered — two-year term; conference mentioned for March 2026', 'Planned / in progress',
            'Project proposal PDF (funding request) and the Partnership Engagement Addendum DOCX; both contain no financial schedule, invoice or receipt',
            SWDOCS + 'SWF Proposal The Rethinking School Project.pdf | ' + SWDOCS + 'SmallWorld and Big Education_ Benhind the partnership Agreement .docx',
            'Confirmation that the £10,000 was granted and received (signed agreement, invoice or receipt); the names of the two schools; the partnership start and end dates; the number of pupils in each school; a delivery/impact report.'],

        /* ── Gala and event archive (GALA folder) ─────────────────────────── */
        ['SW-GALA-001', '2014', 'Madame Salam 2014 event', 'UAE', '—', '—', 'Program (fundraising event)',
            'Event documented by the "MADAM SALAM 2014" photo archive (Day 1 and Day 2 sub-folders) in the GALA folder, an event held in honour of founder and president Mrs Salam Hamzeh Ghaith.',
            'Other support (fundraising)', 'Not applicable — fundraising event', '— (amount raised not published)', '2014', 'Delivered — event documented',
            'Photo archive only (two day-folders); no financial or programme document', GALA + 'MADAM SALAM 2014\\',
            'Amount raised and which projects it funded; venue, date and guest list; consent/permissions for using the photographs.'],

        ['SW-GALA-002', '2011–2016', 'SmallWorld celebrity and gala photo archive', 'UAE', '—', '—', 'Program (fundraising event)',
            'The GALA folder holds 6,373 photo files dated 2011–2016 covering the celebrity nights (folder "SMALLWORLD CELEBRITY", "SALAM WITH CELEBRITIES" — including Billy Zane and other guests) and the grand event photographs that accompanied the fundraising galas.',
            'Other support (fundraising)', 'Not applicable — archive of fundraising events', '— (amounts raised not published)', 'Files dated 2011–2016', 'Delivered — events documented, archive not yet indexed',
            'Photographs only; one celebrity bio document (Ricky Martin, DOCX + PDF) and two logo PDFs. No agreements, receipts or reports.',
            GALA + 'SMALLWORLD CELEBRITY\\ | ' + GALA + 'SALAM WITH CELEBRITIES\\ | ' + GALA + 'Celebrities\\',
            'Which photographs belong to which event and year (only file dates are available); amounts raised per gala; which country projects each gala funded.'],

        ['SW-GALA-003', '2011', 'Early gala and celebrity photographs', 'UAE', '—', '—', 'Program (fundraising event)',
            'Photographs at the root of the GALA folder dated 31 March 2011 (series DSC_01xx and AJI_3663, 2011), the earliest images in the archive, alongside later series dated 2012–2016.',
            'Other support (fundraising)', 'Not applicable — event photographs', '— (amount raised not published)', 'Files dated 2011', 'Delivered — events documented, archive not yet indexed',
            'Photographs only; no event record', GALA + '(root folder)',
            'Which event each early photo series documents; the linked funding need; missing year folders between 2016 and the present.']
    ];

    var ALL_PROJECTS = PROJECTS.concat(PROJECTS_2);

    /* ── Sources panel content ────────────────────────────────────────────
       States plainly what was reachable and what was not, so the inventory can
       never be mistaken for a complete record. */
    var SOURCES = [
        {
            name: 'Instagram — @smallworld_foundation (SmallWorld Foundation)',
            what: 'Profile data read from the public profile page: 3,429 followers, 6 following, 676 posts. Bio: "NGO that educates thousands of #children all around the globe ; Based in #UK , Founder & President @salamzhg". Used for organisation identity and scale only.',
            url: IG,
            gap: 'Post captions were NOT readable: the profile’s post data is only served to a signed-in session, and the anonymous reader returned no post objects (the local scan file smallworld_full_scan.json likewise holds 12 posts with empty captions). No caption text is used anywhere in this inventory. To capture captions, sign in to Instagram in the browser the scan uses (or install the OpenCLI browser extension) and re-run the profile scan.'
        },
        {
            name: 'Website — smallworldfoundation.com',
            what: 'Home page (global impact), Events, Projects, Campaigns, Visits on the Ground, Our Reach (Asia / Africa / America / Europe / Middle East / Oceania) and the Achievements pages for 2011, 2012, 2013, 2014, 2015, 2016, 2017–2018, 2019, 2019–2020, 2021, 2022, 2023, 2024 and 2025.',
            url: SITE,
            gap: 'These pages are narrative summaries: they almost never state an amount, a currency or a delivery date. Several page sections are repeated verbatim between years (for example the health/medical block on 2011 reappears on 2015, and the Syria/Turkey block on 2023 reappears on 2024), so repeats are flagged instead of being counted twice.'
        },
        {
            name: 'Local photo archive — CAMERA PROJECTS\\GALA',
            what: '6,373 files (2011–2016): "2014 THE GREAT GATSBY GALA DINNER" (2,657 images), "2014 Grand Event Pics" (2,903), "MADAM SALAM 2014" (Day 1 + Day 2), "SMALLWORLD CELEBRITY", "SALAM WITH CELEBRITIES", "Celebrities\\Ricky Martin" plus early 2011 series at the folder root.',
            url: GALA,
            gap: 'Photographs and file dates only — no financial records, receipts or guest lists. One celebrity bio document and two logo PDFs were also found. No image is linked to a specific project, so gala rows say so.'
        },
        {
            name: 'Local documents — CAMERA PROJECTS\\Smallworld',
            what: 'SWF Proposal The Rethinking School Project.pdf (funding request: £10,000) and "SmallWorld and Big Education_ Behind the partnership Agreement .docx" (Partnership Engagement Addendum). Country images (Armenia, Bangladesh, Egypt, Greece, India, Japan, Mexico, Nigeria, Turkey, USA) and volunteering images that match the website’s country programmes.',
            url: SWDOCS,
            gap: 'The only source in this inventory that states an amount. No invoice, receipt, signed grant agreement or bank record is present, so the £10,000 is recorded as requested, not as paid.'
        }
    ];

    var METHOD_NOTES = [
        'One row = one documented support activity. Where the same activity is reported on two pages (for example the Ethiopia library on the 2016 and 2017–2018 pages) it is kept as one row and the repeat is flagged in Missing information rather than counted twice.',
        '“—” means the sources do not document that field. Nothing here is estimated or inferred from a similar project.',
        'Amounts and currencies are almost never published. The only figure the sources state is the £10,000 funding request for the Rethinking School project; every other row reads “—”.',
        'Delivery dates are recorded only when a source gives one; many rows therefore show “—” even though the year is known.',
        'Beneficiary counts are copied as published, including the ones expressed in people or families rather than children — those rows say so.'
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
       Each row gets a visual identifier. A REAL photograph is used only when
       the sources contain one for that country or event; otherwise a generated
       tile (flag + project id) is drawn. Nothing is passed off as a photo of a
       project that has no photograph in the sources. */
    var SW_MEDIA = 'C:\\Users\\richa\\OneDrive\\Desktop\\CAMERA PROJECTS\\Smallworld\\';
    var GALA_MEDIA = 'C:\\Users\\richa\\OneDrive\\Desktop\\CAMERA PROJECTS\\GALA\\';

    var COUNTRY_IMAGE = {
        'Armenia': 'armenia.jpg',
        'Bangladesh': 'bangladesh1.jpg',
        'Egypt': 'egypt.jpg',
        'Greece': 'greece.jpg',
        'India': 'india.jpg',
        'Japan': 'japan.jpg',
        'Mexico': 'mexico.jpg',
        'Nigeria': 'nigeria.jpg',
        'Turkey': 'turkey.jpg',
        'USA': 'usa.jpg'
    };

    var GALA_IMAGE = {
        'SW-GALA-001': GALA_MEDIA + 'MADAM SALAM 2014\\MADAM SALAM (Day 1)\\',
        'SW-GALA-002': GALA_MEDIA + 'SMALLWORLD CELEBRITY\\',
        'SW-GALA-003': GALA_MEDIA + 'SMALLWORLD CELEBRITY\\',
        'SW-2014-010': GALA_MEDIA + '2014 THE GREAT GATSBY GALA DINNER\\'
    };

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
        'Syria': '\u{1F1F8}\u{1F1FE}', 'United Kingdom': '\u{1F1EC}\u{1F1E7}', 'Venezuela': '\u{1F1FB}\u{1F1EA}',
        'Malaysia': '\u{1F1F2}\u{1F1FE}', 'Russia': '\u{1F1F7}\u{1F1FA}', 'Tunisia': '\u{1F1F9}\u{1F1F3}',
        'Sudan': '\u{1F1F8}\u{1F1E9}', 'Korea': '\u{1F1F0}\u{1F1F7}'
    };

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

    /** The image for a row: an explicit one, else a source photograph, else a tile. */
    function imageFor(row) {
        if (row.image) return row.image;
        var countryFile = COUNTRY_IMAGE[row.values.country];
        if (countryFile) return fileUrl(SW_MEDIA + countryFile);
        if (GALA_IMAGE[row.values.id]) return fileUrl(GALA_IMAGE[row.values.id] + 'NAD_0289.JPG');
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

    /** Wrap each sourced array row (in FIELDS order) into a { values } object. */
    function objectRows(arrays, origin) {
        return (arrays || []).map(function (arr, i) {
            var values = {};
            FIELDS.forEach(function (f, idx) { values[f.key] = arr[idx] == null ? '' : arr[idx]; });
            return { id: values.id + '::' + i, values: values, image: '', origin: origin };
        });
    }

    function rowsToArrays(rows) {
        return rows.map(function (r) {
            return FIELDS.map(function (f) { return r.values[f.key] || ''; });
        });
    }

    /** Every row in the inventory: the sourced set plus anything the user added. */
    function allRows() {
        return objectRows(ALL_PROJECTS, 'built-in')
            .concat(loadUserProjects().map(function (r, i) {
                return { id: 'user::' + i, values: r.values, image: r.image || '', origin: 'user', userIndex: i };
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
        columns: 'key',
        page: 1,
        pageSize: 25,
        expanded: {},
        auditOnly: null,
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
            ['sortKey', 'sortDir', 'columns', 'pageSize'].forEach(function (k) {
                if (v[k] != null) state[k] = v[k];
            });
            if (!state._tabChosen && v.tab != null) state.tab = v.tab;
            if (!/^\d+$/.test(String(state.pageSize))) state.pageSize = 25;
        } catch (e) { /* first run or unreadable — defaults are fine */ }
    }

    function saveView() {
        try {
            if (typeof localStorage === 'undefined') return;
            localStorage.setItem(VIEW_KEY, JSON.stringify({
                tab: state.tab, sortKey: state.sortKey, sortDir: state.sortDir,
                columns: state.columns, pageSize: state.pageSize
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
        if (s.indexOf('progress') !== -1) return 'In progress';
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
            rows = rows.filter(function (r) { return String(r.values.year || '').trim() === state.year; });
        }
        if (state.gapsOnly) rows = rows.filter(function (r) { return r._gaps > 0; });
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
        var cells = 0, filled = 0;
        rows.forEach(function (r) {
            var c = String(r.values.country || '').trim();
            if (c && c !== '—') countries[c] = 1;
            yearsOf(r.values.year).forEach(function (y) { if (y > 1990 && y < 2100) years[y] = 1; });
            if (!isBlank(r.values.missing)) gaps++;
            if (hasAmount(r.values.donation)) withAmount++;
            if (hasDate(r.values.deliveryDate)) withDate++;
            var n = beneficiaryCount(r.values.beneficiaries);
            if (n != null) { knownKids++; kids += n; }
            // "Missing information" is a notes column that is filled on EVERY
            // row by design, so including it would flatter the completeness
            // figure. The aggregate counts the 15 data fields only.
            FIELDS.forEach(function (f) {
                if (f.key === 'missing') return;
                cells++;
                if (hasValue(r.values[f.key])) filled++;
            });
        });
        var ys = Object.keys(years).map(Number).sort(function (a, b) { return a - b; });
        return {
            total: rows.length,
            userAdded: rows.filter(function (r) { return r.origin === 'user'; }).length,
            countries: Object.keys(countries).length,
            countryList: Object.keys(countries).sort(),
            yearList: Object.keys(years).map(Number).sort(function (a, b) { return b - a; }),
            range: ys.length ? (ys[0] + '–' + ys[ys.length - 1]) : '—',
            gaps: gaps,
            withAmount: withAmount,
            withDate: withDate,
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

        var completeness = FIELDS.map(function (f) {
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
                'These rows describe the same work in the same words on two year pages. Either it is one project ' +
                'reported twice (so a total would count it twice) or two separate grants — the source does not say.',
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
                'The sources publish what was done, not what it cost — and where a total is mentioned it is a note ' +
                'that the amount was not published. A financial total from this inventory would be built on almost no data.',
                amountRows.map(function (r) { return r.values.id; }));
        }

        // 10. Beneficiary count unknown.
        var noKids = rows.filter(function (r) { return beneficiaryCount(r.values.beneficiaries) == null; }).length;
        if (noKids) {
            add('no-beneficiaries', 'info', noKids + ' of ' + rows.length + ' rows have no stated number of beneficiaries',
                'The reach of the programme cannot be summed from the inventory alone.',
                rows.filter(function (r) { return beneficiaryCount(r.values.beneficiaries) == null; }).map(function (r) { return r.values.id; }));
        }

        // 11. The same project name in the same year.
        var byName = {};
        rows.forEach(function (r) {
            var n = String(r.values.name || '').trim().toLowerCase();
            if (!n) return;
            var k = String(r.values.year) + '|' + n;
            (byName[k] = byName[k] || []).push(r.values.id);
        });
        var sameName = [];
        Object.keys(byName).forEach(function (k) { if (byName[k].length > 1) sameName = sameName.concat(byName[k]); });
        if (sameName.length) {
            add('dup-name', 'medium', 'Same project name in the same year',
                'Two rows carry an identical name for one year — check whether one is a duplicate entry.', sameName);
        }

        // 12. A year outside the range the sources cover.
        var outside = rows.filter(function (r) {
            var y = yearOf(r.values.year);
            return y != null && (y < 2011 || y > 2026);
        }).map(function (r) { return r.values.id; });
        if (outside.length) {
            add('year-outside', 'medium', 'Year outside 2011–2026',
                'The sources cover 2011 onwards; a row outside that window is either a typo or a new source.', outside);
        }

        // 13. No source named for the row.
        var noSource = rows.filter(function (r) { return isBlank(r.values.fileLocation); }).map(function (r) { return r.values.id; });
        if (noSource.length) {
            add('no-source', 'high', 'No source recorded',
                'The row does not say where the information came from, so it cannot be checked.', noSource);
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
            '<p>' + s.total + ' projects from the foundation’s website, the Instagram profile and the local CAMERA PROJECTS archive — ' +
            'with what each source could and could not tell us.</p>' +
            '</div>' +
            '<div class="pinv-hero-side">' +
            '<span class="pinv-badge" style="color:#a78bfa;">' + s.total + ' projects</span>' +
            '<span class="pinv-badge delivered">' + s.documented + '% documented</span>' +
            '</div>' +
            '</div>' +

            '<div class="pinv-stats">' +
            statTile(s.total, 'Projects', 'Rows in the inventory, sourced plus your own additions') +
            statTile(s.countries, 'Countries', s.countryList.slice(0, 6).join(', ') + (s.countryList.length > 6 ? '…' : '')) +
            statTile(s.range, 'Years covered', 'First and last year found in the sources') +
            statTile(s.documented + '%', 'Fields filled in', s.filled + ' of ' + s.cells + ' data-field cells hold a value — a dash, or “not published”, counts as empty, and the notes column is excluded') +
            statTile(s.withAmount, 'Amounts stated (of ' + s.total + ')', 'Rows that state a real amount — the biggest hole in this data') +
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
            '<p class="pinv-muted">Grouped from the wording in the source: “Delivered (as reported)” counts as Delivered.</p>' +
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
            '<tr><th>Rows still carrying gaps</th><td>' + s.gaps + ' of ' + s.total + ' (every row asks for something more)</td></tr>' +
            '</table>' +
            '<p class="pinv-muted" style="font-size:.74rem;">The beneficiary figures are deliberately not added up: they count ' +
            'different things (a party for 200, a surgery for 1), some rows describe the same project on two year pages, and a total ' +
            'would imply a precision the sources do not have.</p>' +
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

    /** Columns actually shown, in the guide's order. */
    function visibleFields() {
        return state.columns === 'key'
            ? FIELDS.filter(function (f) { return KEY_FIELDS.indexOf(f.key) !== -1; })
            : FIELDS;
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

    function renderInventoryTable(rows) {
        var fields = visibleFields();
        var size = String(state.pageSize) === 'all' ? rows.length : parseInt(state.pageSize, 10);
        var pages = Math.max(1, Math.ceil(rows.length / (size || 25)));
        if (state.page > pages) state.page = pages;
        var start = (state.page - 1) * (size || 25);
        var pageRows = String(state.pageSize) === 'all' ? rows : rows.slice(start, start + size);
        var offset = String(state.pageSize) === 'all' ? 0 : start;

        var head = '<th class="pinv-sticky" title="Identification — a photograph of the project where the sources have one, otherwise a generated tile">Picture</th>' +
            '<th data-sort="index" title="Sort by the order the rows were recorded">#</th>' +
            fields.map(function (f) {
                var on = state.sortKey === f.key;
                return '<th data-sort="' + f.key + '" title="Sort by ' + esc(f.field) + ' — ' + esc(f.what) + '">' + esc(f.field) +
                    '<span class="pinv-sort">' + (on ? (state.sortDir > 0 ? '▲' : '▼') : '↕') + '</span></th>';
            }).join('') + '<th></th>';

        var body = pageRows.map(function (r) {
            var open = !!state.expanded[r.values.id];
            var badge = r.origin === 'user' ? '<span class="pinv-badge user">yours</span>' : '';
            var cells = fields.map(function (f) {
                var v = r.values[f.key] || '';
                var cls = isBlank(v) ? ' pinv-flag' : '';
                if (f.key === 'id') return '<td class="pinv-id">' + esc(v) + badge + '</td>';
                if (f.key === 'status') {
                    var g = statusGroup(v);
                    return '<td><span class="pinv-badge ' + (g === 'Delivered' ? 'delivered' : (g === 'Planned' ? 'planned' : 'progress')) + '">' + esc(g) + '</span>' +
                        '<div class="pinv-sub">' + esc(v) + '</div></td>';
                }
                if (f.key === 'year' && isYearRange(v)) {
                    return '<td>⚑ ' + esc(v) + '<div class="pinv-sub" title="A span, not a single year">span</div></td>';
                }
                var title = String(v).length > 60 ? ' title="' + esc(v) + '"' : '';
                return '<td' + (cls ? ' class="' + cls.trim() + '"' : '') + title + '><span class="pinv-clamp">' + esc(v) + '</span></td>';
            }).join('');

            var main = '<tr class="' + (open ? 'pinv-open' : '') + '" data-row="' + esc(r.values.id) + '">' +
                '<td class="pinv-sticky"><img class="pinv-thumb" src="' + esc(imageFor(r)) + '" alt="" loading="lazy" ' +
                'onerror="this.onerror=null;this.src=this.dataset.fallback" data-fallback="' + esc(flagTile(r.values.id, r.values.country)) + '"></td>' +
                '<td class="pinv-num">' + (offset + pageRows.indexOf(r) + 1) + '</td>' +
                cells +
                '<td class="pinv-num"><button class="pinv-expand" data-expand="' + esc(r.values.id) + '" aria-expanded="' + open + '" title="' +
                (open ? 'Hide every field' : 'Show every field for this project') + '">' + (open ? '▾' : '▸') + '</button></td>' +
                '</tr>';

            if (!open) return main;

            var detail = FIELDS.map(function (f) {
                var v = r.values[f.key] || '';
                return '<div class="pinv-detail-field' + (isBlank(v) ? ' pinv-flag' : '') + '">' +
                    '<dt>' + esc(f.field) + '</dt><dd>' + esc(v) + '<div class="pinv-muted">' + esc(f.what) + '</div></dd></div>';
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

            return main + '<tr class="pinv-detail-row"><td class="pinv-sticky pinv-detail-art">' +
                '<img src="' + esc(imageFor(r)) + '" alt="" loading="lazy" onerror="this.onerror=null;this.src=this.dataset.fallback" data-fallback="' + esc(flagTile(r.values.id, r.values.country)) + '">' +
                '<div class="pinv-detail-id">' + esc(r.values.id) + '</div>' +
                (links ? '<div class="pinv-detail-links">' + links + '</div>' : '') +
                '</td><td colspan="' + (fields.length + 2) + '">' +
                '<dl class="pinv-detail">' + detail + '</dl>' +
                (actions ? '<div class="pinv-row-actions">' + actions + '</div>' : '') +
                '</td></tr>';
        }).join('');

        if (!rows.length) {
            return '<div class="pinv-empty">No rows match this filter. Clear the search or the filters above.</div>';
        }

        var pager = '';
        if (String(state.pageSize) !== 'all' && pages > 1) {
            pager = '<div class="pinv-pager">' +
                '<button class="btn btn-secondary" data-page="' + (state.page - 1) + '"' + (state.page === 1 ? ' disabled' : '') + '>‹ Prev</button>' +
                '<span>Page ' + state.page + ' of ' + pages + ' · rows ' + (start + 1) + '–' + Math.min(rows.length, start + size) + ' of ' + rows.length + '</span>' +
                '<button class="btn btn-secondary" data-page="' + (state.page + 1) + '"' + (state.page === pages ? ' disabled' : '') + '>Next ›</button>' +
                '</div>';
        }

        return '<div class="pinv-table-wrap"><table class="pinv-table"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>' + pager;
    }

    function renderInventory(app) {
        var rows = viewRows();
        var s = stats(allRows());
        var auditActive = state.auditOnly ? state.auditOnly.length : 0;

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
            '<span class="pinv-toolbar-count">' + rows.length + ' of ' + s.total + ' rows' + (auditActive ? ' · filtered to ' + auditActive + ' flagged rows' : '') + '</span>' +
            (auditActive ? '<button id="pinvClearAudit" class="btn btn-secondary" style="font-size:.74rem;">✕ Clear the double-check filter</button>' : '') +
            '</div>' +

            '<div class="pinv-toolbar">' +
            '<label class="pinv-field"><span>Sort by</span><select id="pinvSort">' + sortOptionsHtml() + '</select></label>' +
            '<button id="pinvDir" class="btn btn-secondary" style="font-size:.76rem;" title="Flip the sort direction">' + (state.sortDir > 0 ? '▲ Ascending' : '▼ Descending') + '</button>' +
            '<label class="pinv-field"><span>Status</span><select id="pinvStatus">' + statusOpts + '</select></label>' +
            '<label class="pinv-field"><span>Country</span><select id="pinvCountry">' + countryOpts + '</select></label>' +
            '<label class="pinv-field"><span>Year</span><select id="pinvYear">' + yearOpts + '</select></label>' +
            '<label class="pinv-field"><span>Columns</span><select id="pinvColumns">' +
            '<option value="key"' + (state.columns === 'key' ? ' selected' : '') + '>Key fields (recommended)</option>' +
            '<option value="all"' + (state.columns === 'all' ? ' selected' : '') + '>All 16 fields</option>' +
            '</select></label>' +
            '<label class="pinv-field"><span>Rows</span><select id="pinvPageSize">' +
            [25, 50, 100, 'all'].map(function (n) {
                return '<option value="' + n + '"' + (String(state.pageSize) === String(n) ? ' selected' : '') + '>' + (n === 'all' ? 'All' : n) + '</option>';
            }).join('') +
            '</select></label>' +
            '<label class="pinv-check"><input type="checkbox" id="pinvGaps"' + (state.gapsOnly ? ' checked' : '') + '> Only rows with missing information</label>' +
            '</div>' +

            '<div class="section-title">🗂️ Inventory <span class="pinv-section-note">Tap a row to open every field for that project. Click any column heading to sort by it.</span></div>' +

            renderInventoryTable(rows) +

            '<div class="pinv-actions">' +
            '<button id="pinvAddToggle" class="btn btn-primary">➕ Add project</button>' +
            '<button id="pinvExportXlsx" class="btn btn-secondary">⬇️ Excel — all ' + s.total + ' rows</button>' +
            '<button id="pinvExportXlsxFiltered" class="btn btn-secondary">⬇️ Excel — this view (' + rows.length + ')</button>' +
            '<button id="pinvExportCsv" class="btn btn-secondary">⬇️ CSV — this view</button>' +
            '<button id="pinvExportJson" class="btn btn-secondary">⬇️ JSON + findings</button>' +
            '<span id="pinvExportStatus" class="pinv-muted" style="font-size:.74rem;align-self:center;"></span>' +
            '</div>' +
            '<div class="pinv-muted" style="font-size:.72rem;margin-bottom:1.5rem;">The Excel file is written from the same rows and ' +
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
            { title: '4 · Money and dates', keys: ['donation', 'deliveryDate'] },
            { title: '5 · Evidence', keys: ['documentation', 'fileLocation', 'missing'] }
        ];

        var groupHtml = groups.map(function (g) {
            return '<div class="pinv-form-group"><div class="pinv-form-group-title">' + esc(g.title) + '</div>' +
                '<div class="pinv-form">' + g.keys.map(function (key) {
                    var f = FIELDS.filter(function (x) { return x.key === key; })[0];
                    if (!f) return '';
                    var long = LONG.indexOf(f.field) !== -1;
                    var tag = long ? 'textarea' : 'input';
                    return '<label class="' + (long ? 'pinv-wide' : '') + '" title="' + esc(f.what) + '">' + esc(f.field) +
                        '<' + tag + (long ? '' : ' type="text"') + ' data-field="' + f.key + '" placeholder="' + esc(f.what.slice(0, 64)) + '"></' + tag + '></label>';
                }).join('') + '</div></div>';
        }).join('');

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
            '<input type="text" id="pinvUserImage" placeholder="https://… or C:\\Users\\…\\CAMERA PROJECTS\\…\\photo.jpg"></label>' +
            '<div class="pinv-image-preview"><div class="pinv-muted">Preview</div><img id="pinvImagePreview" alt="" style="display:none;"><div id="pinvImageFallback" class="pinv-tile-fallback">A generated tile is used until a picture is given</div></div>' +
            '</div></div>' +
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
            '<tbody>' + FIELDS.map(function (f) {
                return '<tr><td><strong>' + esc(f.field) + '</strong></td><td>' + esc(f.what) + '</td></tr>';
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

        var body = '';
        if (state.tab === 'overview') body = renderOverview(app);
        else if (state.tab === 'inventory') body = renderInventory(app);
        else if (state.tab === 'add') body = renderAddForm();
        else if (state.tab === 'live') body = renderLiveTab(app);
        else body = renderGuideTab();

        host.innerHTML = renderTabs() + '<div class="pinv-panel">' + body + '</div>';

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

    /* ═══ Events ═════════════════════════════════════════════════════════ */

    function goToTab(app, tab) {
        state.tab = tab;
        state._tabChosen = true;
        state.page = 1;
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
        host.querySelectorAll('tr[data-row]').forEach(function (tr) {
            tr.addEventListener('click', function () { openRow(app, tr.getAttribute('data-row')); });
        });

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
            saveUserProjects([]);
            renderPage(app);
            if (app.logBuildEvent) app.logBuildEvent('project-inventory-reset', 'Removed user-added project rows');
        });

        host.querySelectorAll('.pinv-edit').forEach(function (b) {
            b.addEventListener('click', function (e) { e.stopPropagation(); startEdit(app, parseInt(b.getAttribute('data-user'), 10)); });
        });
        host.querySelectorAll('.pinv-del').forEach(function (b) {
            b.addEventListener('click', function (e) {
                e.stopPropagation();
                var list = loadUserProjects();
                list.splice(parseInt(b.getAttribute('data-user'), 10), 1);
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
            if (!/^SW-[A-Za-z0-9-]+$/.test(values.id)) {
                if (status) status.textContent = 'Project IDs follow the pattern SW-YEAR-NNN (for example SW-2026-004); ' +
                    'leave it blank to have one generated.';
                return;
            }
        } else {
            var n = 1;
            var existing = {};
            allRows().forEach(function (r) { existing[r.values.id] = 1; });
            do { values.id = 'SW-USER-' + String(n).padStart(3, '0'); n++; } while (existing[values.id]);
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
        buildXlsx: buildXlsx,
        sheetName: 'Project Inventory',
        /* Read-only accessors so the inventory's own numbers can be checked by
           a test in Node without a browser (test_project_inventory.js). */
        rows: function () { return allRows(); },
        stats: function () { return stats(allRows()); },
        analytics: function () { return analytics(allRows()); },
        audit: function () { return auditRows(allRows()); }
    };

    /* Node path (generate-project-inventory.js writes the workbook file). */
    if (typeof window === 'undefined' && typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    /* Browser path — attach to the app prototype like every other module. */
    if (typeof window !== 'undefined' && typeof InstagramAnalytics !== 'undefined' && InstagramAnalytics.prototype) {
        var P = InstagramAnalytics.prototype;

        P.projectInventoryFields = function () { return FIELDS; };
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

        P.exportProjectInventoryExcel = function () { exportXlsx(this, allRows(), false); };

        P._inventoryReady = true;
    }
})();
