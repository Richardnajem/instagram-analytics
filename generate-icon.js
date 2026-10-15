// generate-icon.js — Premium icon pipeline
// Converts assets/swa_logo.svg → PNGs at multiple sizes → assets/swa_icon.ico
// Usage: node generate-icon.js

'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ASSETS = __dirname + '/assets';
const SVG_PATH = ASSETS + '/swa_logo.svg';
const PNG_PATH = ASSETS + '/swa_logo.png';
const ICO_PATH = ASSETS + '/swa_icon.ico';

// Icon sizes to generate (including the PNG logo at 512)
const SIZES = [16, 24, 32, 48, 64, 96, 128, 256];
const LOGO_SIZE = 512;

async function main() {
    const svg = fs.readFileSync(SVG_PATH);
    console.log(`📄 Read SVG: ${(svg.length / 1024).toFixed(1)} KB`);

    // 1. Generate the main PNG logo (512x512)
    console.log(`\n🔷 Generating logo PNG (${LOGO_SIZE}x${LOGO_SIZE})...`);
    const logoPng = await sharp(svg)
        .resize(LOGO_SIZE, LOGO_SIZE)
        .png({ compressionLevel: 9 })
        .toBuffer();
    fs.writeFileSync(PNG_PATH, logoPng);
    console.log(`   ✅ Created assets/swa_logo.png (${(logoPng.length / 1024).toFixed(0)} KB)`);

    // 2. Generate PNGs at all icon sizes
    console.log(`\n🔷 Generating icon PNGs at ${SIZES.length} sizes...`);
    const iconPngs = {};
    for (const size of SIZES) {
        const png = await sharp(svg)
            .resize(size, size)
            .png({ compressionLevel: 9 })
            .toBuffer();
        iconPngs[size] = png;
        console.log(`   ✅ ${size}x${size} — ${(png.length / 1024).toFixed(0)} KB`);
    }

    // 3. Generate multi-resolution ICO
    console.log(`\n🔷 Assembling ICO with ${SIZES.length} resolutions...`);

    const entries = [];
    let offset = 6 + SIZES.length * 16; // header + all directory entries

    for (const size of SIZES) {
        const pngData = iconPngs[size];
        // For sizes > 256, ICO spec uses 0 to represent 256
        const icoSize = size >= 256 ? 0 : size;
        const entry = Buffer.alloc(16);
        entry.writeUInt8(icoSize, 0);   // width
        entry.writeUInt8(icoSize, 1);   // height
        entry.writeUInt8(0, 2);         // palette colors
        entry.writeUInt8(0, 3);         // reserved
        entry.writeUInt16LE(1, 4);      // color planes
        entry.writeUInt16LE(32, 6);     // bits per pixel
        entry.writeUInt32LE(pngData.length, 8);   // image size
        entry.writeUInt32LE(offset, 12);           // offset in file
        entries.push({ entry, data: pngData });
        offset += pngData.length;
    }

    // ICO header
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);            // reserved
    header.writeUInt16LE(1, 2);            // type: ICO
    header.writeUInt16LE(SIZES.length, 4); // image count

    const buffers = [header];
    for (const e of entries) buffers.push(e.entry);
    for (const e of entries) buffers.push(e.data);

    const icoData = Buffer.concat(buffers);
    fs.writeFileSync(ICO_PATH, icoData);
    console.log(`   ✅ Created assets/swa_icon.ico (${(icoData.length / 1024).toFixed(0)} KB, ${SIZES.length} sizes)`);

    // 4. Summary
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   🎯 Icon generation complete!`);
    console.log(`   📁 assets/swa_logo.svg   — Source`);
    console.log(`   🖼️  assets/swa_logo.png   — ${LOGO_SIZE}x${LOGO_SIZE} PNG (${(logoPng.length / 1024).toFixed(0)} KB)`);
    console.log(`   📦 assets/swa_icon.ico   — ${SIZES.length}-size ICO (${(icoData.length / 1024).toFixed(0)} KB)`);
    console.log(`   Sizes: ${SIZES.map(s => s + 'x' + s).join(', ')}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

main().catch(err => {
    console.error('❌ Icon generation failed:', err);
    process.exit(1);
});
