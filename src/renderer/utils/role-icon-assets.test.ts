import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import sources from '../public/assets/role-icons/sources.json';

describe('bundled role artwork', () => {
  it('contains a valid PNG matching the manifest for every downloaded asset', () => {
    expect(sources.assets.length).toBe(92);
    for (const asset of sources.assets) {
      const bytes = readFileSync(resolve('src/renderer/public/assets/role-icons', `${asset.name}.png`));
      expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(bytes.length).toBe(asset.bytes);
      expect(bytes.readUInt32BE(16)).toBe(asset.width);
      expect(bytes.readUInt32BE(20)).toBe(asset.height);
    }
  });
});
