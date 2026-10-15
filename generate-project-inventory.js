/* generate-project-inventory.js — writes the Project Inventory workbook.
 *
 * Uses the very same field list, rows and xlsx builder the Projects tab uses
 * (project-inventory.js), so the file on disk and the app's "Download
 * inventory" button can never disagree.
 *
 *   node generate-project-inventory.js
 *
 * Output: SmallWorld-Project-Inventory.xlsx in the project root.
 */
const fs = require('fs');
const path = require('path');
const inv = require('./project-inventory.js');

const out = path.join(__dirname, 'SmallWorld-Project-Inventory.xlsx');
const bytes = inv.buildXlsx(inv.FIELDS, inv.PROJECTS, inv.sheetName);

fs.writeFileSync(out, Buffer.from(bytes));
console.log('Wrote ' + path.basename(out) + ' — ' + inv.PROJECTS.length + ' rows × ' +
    inv.FIELDS.length + ' columns (' + bytes.length + ' bytes)');
console.log('Columns: ' + inv.FIELDS.map(f => f.field).join(' | '));
