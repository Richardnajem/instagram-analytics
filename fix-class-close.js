const fs = require('fs');
let c = fs.readFileSync('app.js', 'utf8');
const instIdx = c.lastIndexOf('window.app = new InstagramAnalytics');
if (instIdx === -1) { console.log('Could not find window.app initialization'); process.exit(1); }
// Check: the last 50 chars before window.app should end with \n}\n\n for class close
const before = c.substring(instIdx - 50, instIdx);
const trimmed = before.trimEnd();
// Count how many closing braces are at the end of trimmed
const match = trimmed.match(/\}\s*$/);
if (match) {
    // There's at least one } - count how many levels of indentation closing
    const lastLine = trimmed.split('\n').pop() || '';
    if (lastLine.trim() === '}' && !lastLine.startsWith('}')) {
        // This is an indented method close - we need a non-indented } to close the class
        // Insert a class-closing brace before window.app
        c = c.substring(0, instIdx) + '}\n\n' + c.substring(instIdx);
        fs.writeFileSync('app.js', c, 'utf8');
        console.log('Fixed: added missing class-closing brace');
        process.exit(0);
    }
}
console.log('Class appears to already have proper closing brace');
