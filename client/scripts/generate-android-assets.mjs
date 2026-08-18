import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

/** Rasterises the app's single source-of-truth icon into the PNGs @capacitor/assets needs to
 * cut every Android density from. Generated rather than committed: the SVG stays the only
 * icon anyone has to edit, and the binaries never go stale against it. */
const clientDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = path.join(clientDir, 'assets');
const BACKGROUND = '#0f1115'; // same as the icon's own backdrop and the app's theme colour

const svg = await readFile(path.join(clientDir, 'public', 'icon.svg'));
await mkdir(assetsDir, { recursive: true });

// density is what the SVG is rasterised at before resizing — too low and the star's points
// come out soft at 1024.
const render = (size) => sharp(svg, { density: 400 }).resize(size, size).png();

await render(1024).toFile(path.join(assetsDir, 'icon.png'));

// Splash: the icon alone on a flat field, sized so it survives the centre crop Android
// applies on tall and wide screens alike.
const emblem = await render(820).toBuffer();
const splash = await sharp({ create: { width: 2732, height: 2732, channels: 4, background: BACKGROUND } })
  .composite([{ input: emblem, gravity: 'center' }])
  .png()
  .toBuffer();

await sharp(splash).toFile(path.join(assetsDir, 'splash.png'));
await sharp(splash).toFile(path.join(assetsDir, 'splash-dark.png')); // already dark

console.log(`Icônes Android générées dans ${assetsDir}`);
