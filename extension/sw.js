/**
 * Service worker entry point (Chrome)
 * Chrome MV3 only accepts a single background service worker, so this loads
 * the same scripts Firefox lists in `background.scripts`, in the same order.
 */

importScripts(
  'compat.js',
  'lib/jszip.min.js',
  'cache.js',
  'pool.js',
  'platform.js',
  'download.js',
  'background.js'
);
