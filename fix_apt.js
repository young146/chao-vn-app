const fs = require('fs');
let c = fs.readFileSync('public_html/form/secondhand/index.html', 'utf8');

// The file has a multi-line issue: somewhere there's 'D\\\n'. Le Roi Soleil'
// Let's find the actual broken sequence
const idx = c.indexOf('Le Roi Soleil');
const region = c.substring(idx - 80, idx + 30);
console.log('REGION:', JSON.stringify(region));

// Find the exact broken sequence - since there's a newline in there,
// search for the start ' before D
// The region shows: 'D\\\n  (continued on next line)  '. Le Roi Soleil'
// We want to find the opening ' that starts 'D...' and replace until the closing '

// Strategy: find the index of the opening ' that immediately precedes 'D'
// We know D is at idx - some offset
const dIdx = c.lastIndexOf("'D", idx);
console.log('D index:', dIdx, 'Le Roi index:', idx);

if (dIdx !== -1) {
    // Find the closing ' after 'Le Roi Soleil'
    const closeQuote = c.indexOf("'", idx + 'Le Roi Soleil'.length);
    console.log('Close quote at:', closeQuote);
    console.log('Segment:', JSON.stringify(c.substring(dIdx, closeQuote + 1)));

    // Replace: from dIdx to closeQuote+1 (inclusive)
    // Replace with: "D'. Le Roi Soleil"
    const replacement = '"D\'' + '. Le Roi Soleil"';
    const fixed = c.substring(0, dIdx) + replacement + c.substring(closeQuote + 1);

    fs.writeFileSync('public_html/form/secondhand/index.html', fixed, 'utf8');

    // Verify
    const v = fs.readFileSync('public_html/form/secondhand/index.html', 'utf8');
    const newIdx = v.indexOf('Le Roi Soleil');
    console.log('AFTER FIX:', JSON.stringify(v.substring(newIdx - 15, newIdx + 20)));
    console.log('SUCCESS!');
}
