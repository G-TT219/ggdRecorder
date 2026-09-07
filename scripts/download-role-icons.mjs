// Refresh bundled official role assets. Run: node scripts/download-role-icons.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const source = await readFile(new URL('src/renderer/utils/role-icons.ts', root), 'utf8');
const names = [...new Set([...source.matchAll(/\d+: '([A-Za-z]+)'/g)].map(match => match[1]))];
if (names.length < 80) throw new Error('Role mapping could not be parsed; refusing incomplete download');
const directory = new URL('src/renderer/public/assets/role-icons/', root);
await mkdir(directory, { recursive: true });
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const records = [];
const missing = [];
let next = 0;
async function download(name) {
  const variants = [...new Set([name.replace(/([a-z])([A-Z])/g, '$1 $2'), name])];
  for (const suffix of ['', '-64x64']) {
    for (const variant of variants) {
      const url = `https://gaggle.fun/assets/images/ggd/role-icons/${encodeURIComponent(variant + suffix)}.png`;
      for (let retry = 0; retry < 2; retry++) {
        try {
          const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
          if (!response.ok || !response.headers.get('content-type')?.includes('image/png')) break;
          const data = Buffer.from(await response.arrayBuffer());
          if (!data.subarray(0, 8).equals(signature) || data.length < 24) break;
          await writeFile(new URL(`${name}.png`, directory), data);
          records.push({ name, source: url, bytes: data.length,
            width: data.readUInt32BE(16), height: data.readUInt32BE(20) });
          console.log(`Downloaded ${name} (${data.length} bytes)`);
          return;
        } catch (error) {
          if (retry === 1) console.warn(`${name}: ${error.message}`);
        }
      }
    }
  }
  missing.push(name);
  console.warn(`No official PNG found: ${name}`);
}
await Promise.all(Array.from({ length: 6 }, async () => {
  while (next < names.length) await download(names[next++]);
}));
await writeFile(new URL('sources.json', directory), JSON.stringify({
  downloadedAt: new Date().toISOString(),
  source: 'https://gaggle.fun/',
  notice: 'Official Goose Goose Duck role artwork belongs to its respective rights holders.',
  assets: records.sort((a, b) => a.name.localeCompare(b.name)),
  missing: missing.sort(),
}, null, 2) + '\n');
console.log(`Saved ${records.length}/${names.length} icons to ${fileURLToPath(directory)}; missing: ${missing.join(', ') || 'none'}`);
if (missing.length) process.exitCode = 1;
