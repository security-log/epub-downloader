/* Browser regression tests; open test-regressions.html to run. */
(async () => {
  const output = document.getElementById('results');
  const checks = [];
  const check = (name, condition) => {
    if (!condition) throw new Error(`FAIL: ${name}`);
    checks.push(`PASS: ${name}`);
  };
  const rejects = async (fn) => {
    try { await fn(); return false; } catch (_) { return true; }
  };
  const originalFetch = globalThis.fetch;
  const originalSaveFile = BookCache.saveFile;

  try {
    check('allows HTTPS learning host', validateAuthenticatedUrl('/api/files/1').startsWith('https://learning.oreilly.com/'));
    for (const url of [
      'http://learning.oreilly.com/file',
      'https://learning.oreilly.com:8443/file',
      'https://learning.oreilly.com.attacker.test/file',
      'https://attacker-learning.oreilly.com/file',
      'https://user@learning.oreilly.com/file',
      'javascript:alert(1)'
    ]) {
      check(`rejects ${url}`, await rejects(() => validateAuthenticatedUrl(url)));
    }

    let fetchCount = 0;
    globalThis.fetch = async (url, options) => {
      fetchCount++;
      check('pagination request carries bearer token only to trusted host',
        new URL(url).hostname === 'learning.oreilly.com' && options.headers.Authorization === 'Bearer test-token');
      return { ok: true, json: async () => ({ results: [], next: 'https://evil.example/steal' }) };
    };
    check('rejects hostile pagination URL', await rejects(() => getAllFiles('/api/files', 'test-token')));
    check('does not fetch hostile pagination URL', fetchCount === 1);

    const file = { url: 'https://learning.oreilly.com/file', full_path: 'chapter.txt', media_type: 'text/plain', kind: 'file' };
    fetchCount = 0;
    check('rejects hostile file URL before authenticated fetch', await rejects(() => downloadAllFiles(
      new JSZip(), [{ ...file, url: 'https://learning.oreilly.com.evil.test/file' }],
      'test-token', {}, 'urn:test', 1, 0, () => {}
    )));
    check('sends no request for hostile file URL', fetchCount === 0);
    globalThis.fetch = async () => ({ ok: true, headers: { get: () => 'text/plain' }, text: async () => 'chapter' });
    let releaseWrite;
    BookCache.saveFile = () => new Promise(resolve => { releaseWrite = resolve; });
    let settled = false;
    const delayed = downloadAllFiles(new JSZip(), [file], 'test-token', {}, 'urn:test', 1, 0, () => {})
      .then(() => { settled = true; });
    await new Promise(resolve => setTimeout(resolve, 30));
    check('waits for delayed IndexedDB write', !settled && typeof releaseWrite === 'function');
    releaseWrite();
    await delayed;
    check('finishes after IndexedDB write commits', settled);

    BookCache.saveFile = async () => { throw new Error('simulated IndexedDB failure'); };
    check('propagates failed IndexedDB write', await rejects(() => downloadAllFiles(
      new JSZip(), [file], 'test-token', {}, 'urn:test', 1, 0, () => {}
    )));

    BookCache.getCachedFiles = async () => new Map([
      ['package.opf', { content: '<package/>', mediaType: 'application/oebps-package+xml' }],
      ['chapter.xhtml', { content: '<html/>', mediaType: 'application/xhtml+xml' }]
    ]);
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
    const blob = await buildEPUB(zip, 'urn:test');
    const archive = await JSZip.loadAsync(blob);
    const paths = Object.keys(archive.files);
    check('EPUB places mimetype first', paths[0] === 'mimetype');
    check('EPUB stores mimetype without compression', archive.file('mimetype').options.compression === 'STORE');
    check('EPUB includes container and package', paths.includes('META-INF/container.xml') && paths.includes('OEBPS/package.opf'));
    check('container points to package', (await archive.file('META-INF/container.xml').async('string')).includes('OEBPS/package.opf'));

    output.textContent = checks.join('\n');
  } catch (error) {
    output.textContent = `${checks.join('\n')}\nFAIL: ${error.stack || error}`;
    output.style.color = 'red';
  } finally {
    globalThis.fetch = originalFetch;
    BookCache.saveFile = originalSaveFile;
  }
})();
