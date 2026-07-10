/**
 * Build script for O'Reilly EPUB Downloader
 * Builds for Firefox and/or Chrome with minification and polyfill.
 *
 * Background scripts are merged into a single file because:
 * - Chrome MV3 requires `background.service_worker` (single file)
 * - Firefox supports `background.scripts` (array) in MV3
 *
 * Usage:
 *   TARGET=firefox npm run build   # builds only for Firefox
 *   TARGET=chrome npm run build    # builds only for Chrome
 *   TARGET=both npm run build      # builds for both (default)
 *   npm run build                  # same as TARGET=both
 */

import { mkdir, rm, copyFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { minify } from 'terser';
import * as csso from 'csso';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST_BASE = join(ROOT, 'dist');

// Load order for background scripts (they share scope via script-loading order)
const BACKGROUND_MERGE_ORDER = [
  ['browser-polyfill.js',   join(ROOT, 'node_modules', 'webextension-polyfill', 'dist', 'browser-polyfill.js')],
  ['jszip.js',              join(ROOT, 'src', 'lib', 'jszip.min.js')],
  ['cache.js',              join(ROOT, 'src', 'background', 'cache.js')],
  ['pool.js',               join(ROOT, 'src', 'background', 'pool.js')],
  ['download.js',           join(ROOT, 'src', 'background', 'download.js')],
  ['background.js',         join(ROOT, 'src', 'background', 'background.js')],
];

const CSS_FILES = [
  ['styles/popup.css', join(ROOT, 'src', 'styles', 'popup.css')],
];

async function ensureDir(path) {
  if (!existsSync(path)) await mkdir(path, { recursive: true });
}

async function copyDir(src, dest) {
  await ensureDir(dest);
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await ensureDir(dirname(destPath));
      await copyFile(srcPath, destPath);
    }
  }
}

/**
 * Merge all background scripts into a single file.
 * Each script is wrapped with a labeled header comment for traceability.
 */
async function mergeBackgroundScripts(distDir) {
  const chunks = [];
  for (const [label, srcPath] of BACKGROUND_MERGE_ORDER) {
    if (!existsSync(srcPath)) {
      console.warn(`  ⚠ Warning: ${label} not found at ${srcPath}`);
      continue;
    }
    const code = readFileSync(srcPath, 'utf8');
    chunks.push(`/*** ${label} ***/\n${code}\n`);
  }
  const merged = chunks.join('\n');
  const destPath = join(distDir, 'background.js');
  writeFileSync(destPath, merged);
  return destPath;
}

/**
 * Generate a target-specific manifest.
 */
function generateManifest(target, destPath) {
  const srcPath = join(ROOT, 'public', 'manifest.json');
  const manifest = JSON.parse(readFileSync(srcPath, 'utf8'));

  if (target === 'chrome') {
    // Chrome MV3: service_worker (single file)
    manifest.background = {
      service_worker: 'background.js',
    };
    delete manifest.browser_specific_settings;
  } else {
    // Firefox MV3: background.scripts (array supported)
    manifest.background = {
      scripts: ['background.js'],
    };
  }

  // Add polyfill to content_scripts only if not already present
  if (manifest.content_scripts && Array.isArray(manifest.content_scripts)) {
    for (const cs of manifest.content_scripts) {
      if (cs.js && Array.isArray(cs.js) && !cs.js.includes('browser-polyfill.js')) {
        cs.js.unshift('browser-polyfill.js');
      }
    }
  }

  writeFileSync(destPath, JSON.stringify(manifest, null, 2));
  console.log(`  ✓ manifest.json (${target})`);
}

async function minifyJsFile(filePath) {
  try {
    const code = readFileSync(filePath, 'utf8');
    const result = await minify(code, {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
      mangle: true,
      format: { comments: false },
    });
    if (result.error) throw result.error;
    writeFileSync(filePath, result.code);
  } catch (err) {
    // Don't fail build if minification fails - the merged file is still usable
    console.warn(`  ⚠️  Minification warning for ${filePath}:`, err.message);
  }
}

async function minifyCssFile(filePath) {
  try {
    const css = readFileSync(filePath, 'utf8');
    const result = csso.minify(css).css;
    writeFileSync(filePath, result);
  } catch (err) {
    console.error(`  ✗ Failed to minify ${filePath}:`, err.message);
  }
}

async function buildTarget(target) {
  const distTarget = join(DIST_BASE, target);
  console.log(`\nBuilding for ${target}...`);

  // 1. Clean
  if (existsSync(distTarget)) await rm(distTarget, { recursive: true, force: true });
  await ensureDir(distTarget);

  // 2. Manifest
  generateManifest(target, join(distTarget, 'manifest.json'));

  // 3. Copy icons
  await copyDir(join(ROOT, 'public', 'icons'), join(distTarget, 'icons'));
  console.log('  ✓ icons/');

  // 4. Copy polyfill (separate — needed for content_scripts)
  await copyFile(
    join(ROOT, 'node_modules', 'webextension-polyfill', 'dist', 'browser-polyfill.js'),
    join(distTarget, 'browser-polyfill.js')
  );
  console.log('  ✓ browser-polyfill.js');

  // 5. Copy lib (jszip — needed for web_accessible_resources)
  await copyDir(join(ROOT, 'src', 'lib'), join(distTarget, 'lib'));
  console.log('  ✓ lib/');

  // 6. Merge + minify all background scripts into a single file
  const bgPath = await mergeBackgroundScripts(distTarget);
  await minifyJsFile(bgPath);
  const bgSize = readFileSync(bgPath, 'utf8').length;
  console.log(`  ✓ background.js (${(bgSize / 1024).toFixed(1)} KB, ${BACKGROUND_MERGE_ORDER.length} files merged)`);

  // 7. Copy content script
  await copyFile(
    join(ROOT, 'src', 'content', 'content.js'),
    join(distTarget, 'content.js')
  );
  console.log('  ✓ content.js');

  // 8. Copy popup files
  await copyFile(
    join(ROOT, 'src', 'popup', 'popup.html'),
    join(distTarget, 'popup.html')
  );
  await copyFile(
    join(ROOT, 'src', 'popup', 'popup.js'),
    join(distTarget, 'popup.js')
  );
  await copyFile(
    join(ROOT, 'src', 'popup', 'print.html'),
    join(distTarget, 'print.html')
  );
  await copyFile(
    join(ROOT, 'src', 'popup', 'print.js'),
    join(distTarget, 'print.js')
  );
  console.log('  ✓ popup files + print.html + print.js');

  // 9. Minify popup.js
  await minifyJsFile(join(distTarget, 'popup.js'));

  // 10. Minify content.js
  await minifyJsFile(join(distTarget, 'content.js'));

  // 11. Copy + minify CSS
  for (const [, srcPath] of CSS_FILES) {
    const destPath = join(distTarget, 'styles', 'popup.css');
    await ensureDir(join(distTarget, 'styles'));
    await copyFile(srcPath, destPath);
    await minifyCssFile(destPath);
  }
  console.log('  ✓ styles/popup.css');

  console.log(`✅ Build for ${target} complete!`);
}

async function build() {
  const targetEnv = process.env.TARGET || 'both';
  let targets = [];
  if (targetEnv === 'both') {
    targets = ['firefox', 'chrome'];
  } else if (targetEnv === 'firefox' || targetEnv === 'chrome') {
    targets = [targetEnv];
  } else {
    console.error(`Invalid TARGET="${targetEnv}". Use "firefox", "chrome", or "both".`);
    process.exit(1);
  }

  if (existsSync(DIST_BASE)) await rm(DIST_BASE, { recursive: true, force: true });
  await ensureDir(DIST_BASE);

  for (const target of targets) {
    await buildTarget(target);
  }

  console.log('\n🎉 All builds complete!');
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});