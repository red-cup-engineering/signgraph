/** The original L-Space Wang/bead fixture is retained as raw NI bytes, not re-generated data. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeNiUri } from '@red-cup-engineering/uri-services-section/ni-uri';
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const archive = fileURLToPath(new URL('./fixtures/lspace-wang-bead-ni-workload.tar.gz', import.meta.url));


function readWorkload(t) {
  const out = mkdtempSync(join(tmpdir(), 'signgraph-ni-wang-bead-'));
  t.after(() => rmSync(out, { recursive: true, force: true }));
  // Extract a checked-in, bounded, source-owned fixture. Never accept a user tarball or path here.
  const unpack = spawnSync('tar', ['-xzf', archive, '-C', out], { encoding: 'utf8' });
  assert.equal(unpack.status, 0, unpack.stderr);
  const root = join(out, 'lspace-561-ni-workload');
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  const records = [manifest.root, ...manifest.objects];
  const parsed = new Map();
  for (const record of records) {
    assert.match(record.physicalRelativePath, /^objects\/immutable\/sha-256\/[A-Za-z0-9_-]{2}\/[A-Za-z0-9_-]{43}$/u);
    const path = join(root, record.physicalRelativePath);
    const bytes = readFileSync(path);
    assert.equal(bytes.byteLength, record.size);
    assert.equal(makeNiUri(bytes), record.ni);
    assert.equal(readFileSync(path + '.media-type', 'utf8'), record.mediaType + '\n');
    parsed.set(record.name ?? 'root', record.mediaType === 'text/markdown' ? bytes.toString('utf8') : JSON.parse(bytes.toString('utf8')));
  }
  const tree = parsed.get('root');
  assert.equal(tree.kind, 'semiotic-content.content-tree');
  assert.deepEqual(tree.entries, manifest.objects.map(({ name, ni }) => ({ name, ni }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en')));
  assert.equal(tree.entries.length, 5);
  return { manifest, parsed };
}

test('NI archive: unchanged Wang/bead workload is a complete source-held Merkle collection', t => {
  const { manifest, parsed } = readWorkload(t);
  assert.equal(manifest.rootNi, manifest.root.ni);
  assert.equal(manifest.rootNi, 'ni:///sha-256;N7dY7wRtq_CO8EfSUgSz74mcGr4E7JsyAoCUhPCFJpU');
  const grid = parsed.get('tile-grid');
  const loom = parsed.get('bead-loom');
  assert.deepEqual([grid.height, grid.width], [2, 2]);
  assert.equal(grid.tiles.length, 4);
  assert.equal(grid.seams.length, 4);
  const byTile = new Map(grid.tiles.map(tile => [tile.id, tile]));
  for (const seam of grid.seams) {
    assert.equal(byTile.get(seam.from).ports[seam.fromPort], seam.color);
    assert.equal(byTile.get(seam.to).ports[seam.toPort], seam.color);
  }
  assert.equal(loom.joining.length, 4);
  const chu = parsed.get('chu');
  assert.equal(chu.pts.length, 4);
  assert.equal(chu.sts.length, 24);
  assert.equal(chu.r.length, 96);
  for (const row of chu.r) {
    const [port, color] = row.st.split('=');
    const held = byTile.get(row.pt).ports[port] === color;
    assert.equal(row.reading, held ? 'potential' : 'absurd');
  }
});

test('native SignGraph: Wang matching section glues; changed bead seam remains obstructed', async t => {
  const { parsed } = readWorkload(t);
  // Import the actual original graph owner instead of reimplementing Laplacians.
  const { cellularSheaf, cochain, coboundary, apply } = await import('../src/cellular-sheaf.mjs');
  const { readingOfSides } = await import('@red-cup-engineering/computer-data-engineering-services-section/four');
  assert.equal(readingOfSides('knowledge', true, false), 'potential');
  assert.equal(readingOfSides('knowledge', false, true), 'active');
  const fixture = parsed.get('sheaf');
  const model = cellularSheaf(fixture.sheaf);
  const x = cochain(model, fixture.cochain);
  const delta = apply(coboundary(model), x);
  assert.equal(delta.length, 24);  // four seams, six color coordinates each
  assert.ok(delta.every(v => v === 0));
  const changed = x.slice();
  const ports = fixture.vertexPortBasis.order;
  const palette = fixture.vertexPortBasis.palette;
  const width = palette.length;
  const east = ports.indexOf('east');
  const nwStart = 0; // model's first vertex is northwest
  changed[nwStart + east * width + palette.indexOf('gold')] = 0;
  changed[nwStart + east * width + palette.indexOf('sky')] = 1;
  const obstruction = apply(coboundary(model), changed);
  const energy = obstruction.reduce((sum, v) => sum + v * v, 0);
  assert.equal(energy, fixture.illustratedCounterexample.expectedSquaredDirichletEnergy);
  assert.equal(energy, 2);
  assert.ok(obstruction.slice(width).every(v => v === 0), 'other seams remain compatible');
  assert.equal(obstruction.slice(0, width).filter(v => v !== 0).length, 2);
});
