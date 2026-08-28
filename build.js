const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const esbuild = require('esbuild');

const SRC_DIR = './src';
const BUILD_DIR = './build';

const INTRO = 'src/intro.js';
const OUTRO = 'src/outro.js';

// Mirrors the Makefile's TEST_SUPPORT + UNIT_TESTS. The unit tests are a glob
// there, so new test/unit/*.test.{js,ts} files are picked up automatically.
const TEST_SUPPORT = [
  'test/support/assert.ts',
  'test/support/trigger-event.ts',
  'test/support/jquery-stub.ts',
];

// Mirrors the Makefile's BASE_SOURCES.
const BASE_SOURCES = [
  'src/utils.ts',
  'src/dom.ts',
  'src/unicode.ts',
  'src/browser.ts',
  'src/animate.ts',
  'src/services/aria.ts',
  'src/domFragment.ts',
  'src/tree.ts',
  'src/cursor.ts',
  'src/controller.ts',
  'src/publicapi.ts',
  'src/services/parser.util.ts',
  'src/services/saneKeyboardEvents.util.ts',
  'src/services/exportText.ts',
  'src/services/focusBlur.ts',
  'src/services/keystroke.ts',
  'src/services/latex.ts',
  'src/services/mouse.ts',
  'src/services/scrollHoriz.ts',
  'src/services/textarea.ts',
];

const SOURCES_FULL = [
  INTRO,
  ...BASE_SOURCES,
  'src/commands/math.ts',
  'src/commands/text.ts',
  'src/commands/math/advancedSymbols.ts',
  'src/commands/math/basicSymbols.ts',
  'src/commands/math/commands.ts',
  'src/commands/math/LatexCommandInput.ts',
  'src/commands/math/matrix.ts',
  'src/commands/math/iterate.ts',
  OUTRO,
];

// Mirrors the Makefile's SOURCES_BASIC. test/unit.html loads the basic bundle
// and calls MathQuill.noConflict() against it — without it, noConflict()
// restores window.MathQuill to undefined and every suite dies on "MQ is not
// defined", so this is required for the unit tests to run at all.
const SOURCES_BASIC = [
  INTRO,
  ...BASE_SOURCES,
  'src/commands/math.ts',
  'src/commands/math/basicSymbols.ts',
  'src/commands/math/commands.ts',
  OUTRO,
];

if (!fs.existsSync(BUILD_DIR)) {
  fs.mkdirSync(BUILD_DIR, { recursive: true });
}

/**
 * Concatenate the given files, optionally escape non-ASCII, transpile to ES5,
 * and stamp the version — the same recipe the Makefile uses.
 *
 * @param files       ordered source paths to concatenate
 * @param escapeNonAscii the main bundle escapes non-ASCII (the Makefile pipes
 *   through script/escape-non-ascii); the test bundle does not, so unicode in
 *   assertions survives
 * @returns the built JS
 */
function bundle(files, escapeNonAscii) {
  let combined = '';
  for (const file of files) {
    combined += fs.readFileSync(file, 'utf8') + '\n';
  }

  if (escapeNonAscii) {
    combined = combined.replace(/[^\x00-\x7F]/g, (char) => {
      return '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0');
    });
  }

  const result = ts.transpileModule(combined, {
    compilerOptions: {
      target: ts.ScriptTarget.ES5,
      module: ts.ModuleKind.None,
    },
  });

  return result.outputText.replace(/\{VERSION\}/g, 'v0.10.1-matrix');
}

// The MPL notice the readable bundle carries in its `/** … */` banner, kept on
// the minified artifacts as a one-line legal comment: MPL-2.0 requires the
// notice to travel with the form, and a `/*! */` comment is the form that
// survives every minifier (esbuild's `legalComments: 'inline'` default) without
// reintroducing a doc-comment banner.
const LEGAL_BANNER =
  '/*! MathQuill v0.10.1-matrix | MPL-2.0 | http://mozilla.org/MPL/2.0/ */\n';

/**
 * Format a byte count for the build log.
 * @param {number} n - Number of bytes.
 * @returns {string} The size in whole kilobytes, e.g. '182KB'.
 */
function kb(n) {
  return `${(n / 1024).toFixed(0)}KB`;
}

/**
 * Write the minified twin of a built bundle (spec/obfuscation.md §3). Identifier
 * mangling + whitespace ONLY — property mangling is off, because the MathQuill
 * public API (`MQ.MathField`, `.latex()`, config keys, `LatexCmds` entries) is
 * all property names crossing into the app.
 *
 * The whole bundle is one IIFE, so every declaration in it is function-scoped
 * and mangleable; nothing is exposed except through `window.MathQuill`.
 *
 * @param {string} name - Bundle basename without extension, e.g. 'mathquill'.
 * @returns {void} Writes `build/<name>.min.js` and logs the size delta.
 */
function writeMinified(name) {
  const srcPath = path.join(BUILD_DIR, `${name}.js`);
  const outPath = path.join(BUILD_DIR, `${name}.min.js`);
  const source = fs.readFileSync(srcPath, 'utf8');

  // `target: es5` is a syntax-level assertion, not a downlevel step: the input
  // is already ES5 (ts.transpileModule above), so this only stops esbuild from
  // emitting newer syntax in its own rewrites. `charset` defaults to ascii,
  // which preserves the escape-non-ASCII property of the readable build.
  const result = esbuild.transformSync(source, {
    loader: 'js',
    minify: true,
    target: 'es5',
    legalComments: 'none',
  });

  fs.writeFileSync(outPath, LEGAL_BANNER + result.code);
  console.log(
    `Built ${name}.min.js (${kb(source.length)} → ${kb(
      LEGAL_BANNER.length + result.code.length
    )})`
  );
}

fs.writeFileSync(
  path.join(BUILD_DIR, 'mathquill.js'),
  bundle(SOURCES_FULL, true)
);
console.log('Built mathquill.js');

fs.writeFileSync(
  path.join(BUILD_DIR, 'mathquill-basic.js'),
  bundle(SOURCES_BASIC, true)
);
console.log('Built mathquill-basic.js');

// Minified twins of the two shipped bundles. The readable builds stay exactly
// as they were — test/unit.html, matrix-test.html and every debugging flow read
// them; only the vendored copy in the app is minified (spec/obfuscation.md §3).
writeMinified('mathquill');
writeMinified('mathquill-basic');

// Test bundle: the full sources with the test support + unit suites spliced in
// before the outro, so test/unit.html works without `make` (unavailable on
// Windows, which is the documented build path for this fork).
const unitTests = fs
  .readdirSync('test/unit')
  .filter((f) => /\.test\.(js|ts)$/.test(f))
  .sort()
  .map((f) => path.posix.join('test/unit', f));

const testSources = [
  INTRO,
  ...SOURCES_FULL.filter((f) => f !== INTRO && f !== OUTRO),
  ...TEST_SUPPORT,
  ...unitTests,
  OUTRO,
];

fs.writeFileSync(
  path.join(BUILD_DIR, 'mathquill.test.js'),
  bundle(testSources, false)
);
console.log(`Built mathquill.test.js (${unitTests.length} suites)`);

const { execSync } = require('child_process');
try {
  execSync('npx lessc src/css/main.less build/mathquill.css', {
    stdio: 'inherit',
  });
  console.log('Built mathquill.css');
} catch (e) {
  console.error('Failed to build CSS:', e.message);
}

try {
  execSync(
    'npx lessc --modify-var="basic=true" src/css/main.less build/mathquill-basic.css',
    { stdio: 'inherit' }
  );
  console.log('Built mathquill-basic.css');
} catch (e) {
  console.error('Failed to build basic CSS:', e.message);
}

const fontSrc = 'src/fonts';
const fontDst = path.join(BUILD_DIR, 'fonts');
if (!fs.existsSync(fontDst)) {
  fs.mkdirSync(fontDst, { recursive: true });
}

const fonts = fs.readdirSync(fontSrc);
for (const font of fonts) {
  fs.copyFileSync(path.join(fontSrc, font), path.join(fontDst, font));
}
console.log('Copied fonts');

console.log('Build complete!');
