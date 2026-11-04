/* generate-project-inventory.js — writes the Project Inventory workbook.
 *
 * Uses the very same field list, rows and xlsx builder the Projects tab uses
 * (project-inventory.js), so the file on disk and the app's "Download
 * inventory" button can never disagree.
 *
 *   node generate-project-inventory.js
 *
 * Output: SmallWorld-Project-Inventory.xlsx and .csv in the project root, both
 * carrying the current client IDs (UK0125, UK0225, …).
 */
const fs = require('fs');
const path = require('path');
const inv = require('./project-inventory.js');

const out = path.join(__dirname, 'SmallWorld-Project-Inventory.xlsx');
const outCsv = path.join(__dirname, 'SmallWorld-Project-Inventory.csv');
const bytes = inv.buildXlsx(inv.FIELDS, inv.PROJECTS, inv.sheetName);

fs.writeFileSync(out, Buffer.from(bytes));
fs.writeFileSync(outCsv, inv.buildCsv(), 'utf8');
console.log('Wrote ' + path.basename(out) + ' and ' + path.basename(outCsv) + ' — ' +
    inv.PROJECTS.length + ' rows × ' + inv.FIELDS.length + ' columns (' + bytes.length + ' bytes)');
console.log('Columns: ' + inv.FIELDS.map(f => f.field).join(' | '));
console.log('IDs: ' + inv.PROJECTS.slice(0, 4).map(r => r[0]).join(', ') + ', …');
