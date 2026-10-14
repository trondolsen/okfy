const path = require('node:path');

const suiteRoot = path.resolve(__dirname, '..');
const repositoryRoot = path.resolve(suiteRoot, '..');
const fixturesRoot = path.join(suiteRoot, 'fixtures');
const fixtureUrl = '/test/fixtures';

// Generated results are written under the same folder that is mounted writable in the
// container (PLAYWRIGHT_OUTPUT_DIR), so they are visible to the static server too.
const outputRoot = path.resolve(
  process.env.PLAYWRIGHT_OUTPUT_DIR ?? path.join(repositoryRoot, 'tmp/test')
);
const artifactsRoot = path.join(outputRoot, 'okfy');

// Each fixture is copied into its own served bundle root — a folder holding the fixture
// files at the top level plus a copy of okfy.html — so the tool loads it as the bundle at
// the page root (there is no ?bundle parameter). Built by support/prepare-roots.mjs.
const rootsDir = path.join(outputRoot, 'root');
const rootsUrl = '/tmp/test/root';

// A URL for a generated bundle root's explorer page, e.g. /tmp/test/root/basic/okfy.html
function fixtureExplorer(name) {
  return `${rootsUrl}/${name}/okfy.html`;
}

// The served root of a generated bundle, e.g. /tmp/test/root/basic/
function fixtureRoot(name) {
  return `${rootsUrl}/${name}/`;
}

module.exports = {
  suiteRoot,
  repositoryRoot,
  fixturesRoot,
  fixtureUrl,
  explorerPath: path.join(repositoryRoot, 'okfy.html'),
  explorerUrl: '/okfy.html',
  rootsDir,
  rootsUrl,
  fixtureExplorer,
  fixtureRoot,
  baseURL: 'http://127.0.0.1:8080',
  artifactsRoot,
};
