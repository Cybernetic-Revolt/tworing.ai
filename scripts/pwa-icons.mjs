// Regenerate the PWA icon set: `node scripts/pwa-icons.mjs` (run from the repo root).
// PWA icons rendered from the single brand mark (src/app/icon.svg). "any" icons keep the
// rounded-square tile; the maskable one paints the tile edge-to-edge and shrinks the mark
// into the 80% safe zone so Android's circle/squircle crop never clips the rings.
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
const svg = readFileSync("src/app/icon.svg", "utf8");
const mark = svg.replace(/<rect[^>]*\/>/, ""); // mark without the tile
const tile = (size, inner, radius) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#18181b"/>
  <g transform="translate(${(size - inner) / 2} ${(size - inner) / 2}) scale(${inner / 32})">
    ${mark.replace(/<svg[^>]*>|<\/svg>/g, "")}
  </g>
</svg>`;
const out = async (name, size, inner, radius) =>
  writeFileSync(`public/icons/${name}`, await sharp(Buffer.from(tile(size, inner, radius))).png().toBuffer());
await out("icon-192.png", 192, 192, 42);
await out("icon-512.png", 512, 512, 112);
await out("apple-touch-icon.png", 180, 180, 0);       // iOS rounds the corners itself
await out("maskable-512.png", 512, 400, 0);           // full-bleed tile, mark in the safe zone
// Monochrome status-bar badge (Android): white mark on transparent.
const badge = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 32 32">
  <g fill="#fff" stroke="#fff">${mark.replace(/<svg[^>]*>|<\/svg>/g, "").replace(/#34d399/g, "#fff").replace(/stroke-opacity="0.55"/g, "")}</g></svg>`;
writeFileSync("public/icons/badge-96.png", await sharp(Buffer.from(badge)).png().toBuffer());
for (const f of ["icon-192.png","icon-512.png","apple-touch-icon.png","maskable-512.png","badge-96.png"]) {
  const m = await sharp(`public/icons/${f}`).metadata(); console.log(f, m.width, m.height, m.format);
}
