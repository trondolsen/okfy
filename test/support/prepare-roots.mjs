// Builds a served bundle root for every fixture, so the browser tests load a bundle as the
// page root (the tool has no ?bundle parameter). Each root is a folder holding the fixture's
// files at the top level plus a copy of okfy.html; it is written under the writable output
// folder, which the static server also serves (see paths.cjs).
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import paths from './paths.cjs';

const { fixturesRoot, rootsDir, repositoryRoot } = paths;

async function explorerFiles() {
  const [html, sw] = await Promise.all([
    readFile(join(repositoryRoot, 'okfy.html')),
    readFile(join(repositoryRoot, 'okfy-sw.js')),
  ]);
  return { html, sw };
}

// Write the explorer page and its companion service worker into a bundle root, so the page's
// own requests (it registers okfy-sw.js next to itself) do not 404.
async function writeExplorer(dest, files) {
  await mkdir(dest, { recursive: true });
  await writeFile(join(dest, 'okfy.html'), files.html);
  await writeFile(join(dest, 'okfy-sw.js'), files.sw);
}

export async function prepareRoots() {
  const files = await explorerFiles();
  await mkdir(rootsDir, { recursive: true });

  const names = (await readdir(fixturesRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  for (const name of names) {
    const dest = join(rootsDir, name);
    await mkdir(dest, { recursive: true });
    await cp(join(fixturesRoot, name), dest, { recursive: true });
    await writeExplorer(dest, files);
  }

  // A root with okfy.html but no index.md, to exercise the "nothing to load" path.
  await writeExplorer(join(rootsDir, 'missing'), files);
}

export default prepareRoots;
