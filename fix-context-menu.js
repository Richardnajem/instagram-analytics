const fs = require('fs');
let c = fs.readFileSync('app.js', 'utf8');

// Find the insertion point - we need to find where the context menu methods were inserted
// (which is after the class closing brace) and move them inside the class
const ctxIdx = c.lastIndexOf('/* ── Context Menu ── */');

if (ctxIdx === -1) {
    console.log('Context menu header not found - methods may already be inside class');
    process.exit(0);
}

// Find the class closing brace BEFORE the context menu methods
// Look backwards from ctxIdx to find the last '}'
const beforeCtx = c.substring(0, ctxIdx);
const classCloseIdx = beforeCtx.lastIndexOf('}');

// The structure is:
// ... class methods ...
//     }
// }
// /* ── Context Menu ── */ ...
// }
// // Initialise
// window.app = new InstagramAnalytics();

// We need to find where the INSTANTIATION line is
const instIdx = c.lastIndexOf('window.app = new InstagramAnalytics');

// Extract the context menu methods (everything between ctxIdx and instIdx)
let contextMethods = c.substring(ctxIdx, instIdx);
// Remove the trailing newlines/whitespace before instIdx
contextMethods = contextMethods.trim();

// Now reconstruct the file:
// 1. Everything before the class close (before classCloseIdx)
// 2. The context menu methods
// 3. The class closing brace
// 4. The rest

const classContent = c.substring(0, classCloseIdx);
const afterClass = c.substring(instIdx); // window.app = new...

// The classCloseIdx currently points to the LAST } before ctxIdx
// But we need to verify this is the class close brace and not a method close brace
// Let's look at what's before and after

const newFile = classContent + '\n\n' + contextMethods + '\n}\n\n\n// Initialise\n\n' + afterClass;

fs.writeFileSync('app.js', newFile, 'utf8');
console.log('Fixed: moved context menu methods inside class');
