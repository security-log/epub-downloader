/**
 * WebExtension namespace shim
 * Firefox exposes the promise-based `browser` namespace; Chrome exposes the
 * same promise-based APIs under `chrome` in Manifest V3.
 */

globalThis.browser ??= globalThis.chrome;
