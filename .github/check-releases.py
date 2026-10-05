"""Run with python3 .github/check-releases.py; uses only temporary repositories."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import textwrap
import zipfile

ROOT = Path(__file__).resolve().parents[1]
RELEASE = ROOT / '.github/workflows/release.yml'
PRERELEASE = ROOT / '.github/workflows/prerelease.yml'
PACKAGE = ROOT / '.github/actions/package-extension/action.yml'


def block(path, name):
    lines = path.read_text().splitlines()
    start = next(i for i, line in enumerate(lines) if line.strip() == f'- name: {name}')
    start = next(i for i in range(start, len(lines)) if lines[i].strip() == 'run: |')
    indent = len(lines[start]) - len(lines[start].lstrip())
    end = start + 1
    while end < len(lines) and (not lines[end].strip() or lines[end].startswith(' ' * (indent + 2))):
        end += 1
    return textwrap.dedent('\n'.join(lines[start + 1:end]))


def command(repo, *args):
    return subprocess.run(args, cwd=repo, check=True, capture_output=True, text=True).stdout.strip()


def run(repo, path, name, **env):
    output = repo / 'output'
    output.write_text('')
    result = subprocess.run(['bash', '-c', block(path, name)], cwd=repo,
                            env=dict(os.environ, GITHUB_OUTPUT=str(output), **env), capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(f'{name} failed:\n{result.stdout}\n{result.stderr}')
    return dict(line.split('=', 1) for line in output.read_text().splitlines())


with tempfile.TemporaryDirectory(prefix='check-releases-') as directory:
    repo = Path(directory) / 'repo'
    repo.mkdir()
    origin = str(Path(directory) / 'origin.git')
    command(repo, 'git', 'init', '--bare', origin)
    command(repo, 'git', 'init', '-b', 'main')
    command(repo, 'git', 'config', 'user.name', 'Release check')
    command(repo, 'git', 'config', 'user.email', 'check@example.invalid')
    command(repo, 'git', 'remote', 'add', 'origin', origin)
    shutil.copytree(ROOT / 'extension', repo / 'extension')
    shutil.copytree(ROOT / 'scripts', repo / 'scripts')
    for filename in ('sw.js', 'offscreen.html', 'offscreen.js'):
        (repo / 'extension' / filename).unlink(missing_ok=True)
    manifest_path = repo / 'extension/manifest.json'
    manifest = json.loads(manifest_path.read_text())
    manifest['version'] = '1.3.0'
    manifest_path.write_text(json.dumps(manifest))
    (repo / 'CHANGELOG.md').write_text('# Changelog\n\n## [Unreleased]\n\n## [1.3.0]\n')
    command(repo, 'git', 'add', 'extension', 'scripts', 'CHANGELOG.md')
    command(repo, 'git', 'commit', '-m', 'Initial source')
    command(repo, 'git', 'tag', 'v1.3.0')
    command(repo, 'git', 'push', 'origin', 'main', '--tags')

    for labels, expected, category in [([], 'v1.3.1', 'Changed'),
                                      (['release:patch'], 'v1.3.1', 'Fixed'),
                                      (['release:minor'], 'v1.4.0', 'Added'),
                                      (['release:major'], 'v2.0.0', 'Breaking changes'),
                                      (['release:patch', 'release:minor', 'release:major'], 'v2.0.0', 'Breaking changes'),
                                      (['skip-changelog'], 'v1.3.1', 'Changed')]:
        stable = run(repo, RELEASE, 'Calculate release version', LABELS=json.dumps(labels), PR_NUMBER='42')
        candidate = run(repo, PRERELEASE, 'Calculate candidate version', LABELS=json.dumps(labels), PR_NUMBER='42')
        assert stable['tag'] == expected and stable['category'] == category
        assert stable['update_changelog'] == str('skip-changelog' not in labels).lower()
        assert candidate['version'] == stable['version']
        assert candidate['tag'] == f'{expected}-rc.pr-42'

    for tag, labels in [('1.3.0', '[]'), ('v1.3.0-rc', '[]'), ('v1.3.0', '{}'),
                        ('v1.3.0', '[1]'), ('v1.3.0', 'not-json')]:
        result = subprocess.run(['python3', 'scripts/bump-version.py', tag, labels], cwd=repo,
                                capture_output=True, text=True)
        assert result.returncode != 0

    original_changelog = (repo / 'CHANGELOG.md').read_text()
    # Both PRs merge before the first queued release starts.
    merges = {}
    for number in ('42', '43'):
        (repo / 'extension' / f'pr-{number}.txt').write_text(f'Source from PR {number}')
        command(repo, 'git', 'add', 'extension')
        command(repo, 'git', 'commit', '-m', f'Merge PR {number}')
        merges[number] = command(repo, 'git', 'rev-parse', 'HEAD')
    command(repo, 'git', 'push', 'origin', 'main')
    for number, labels, expected in [('42', '[]', 'v1.3.1'), ('43', '["skip-changelog"]', 'v1.3.2')]:
        version = run(repo, RELEASE, 'Calculate release version', LABELS=labels, PR_NUMBER=number)
        assert version['tag'] == expected
        if number == '42':
            # Main advances after checkout while this release is preparing metadata.
            concurrent = Path(directory) / 'concurrent'
            command(repo, 'git', 'clone', '--branch', 'main', origin, str(concurrent))
            (concurrent / 'extension/later-main.txt').write_text('Concurrent change')
            command(concurrent, 'git', 'add', 'extension/later-main.txt')
            command(concurrent, 'git', '-c', 'user.name=Check', '-c', 'user.email=check@example.invalid',
                    'commit', '-m', 'Advance main during release')
            command(concurrent, 'git', 'push', 'origin', 'main')
        run(repo, RELEASE, 'Update extension version and create tag',
            VERSION=version['version'], TAG=version['tag'], CATEGORY=version['category'],
            UPDATE_CHANGELOG=version['update_changelog'], PR_NUMBER=number,
            PREVIOUS_TAG=version['previous_tag'], MERGE_SHA=merges[number],
            PR_TITLE='Example PR', PR_URL=f'https://example.invalid/{number}')
        remote_tag = command(repo, 'git', 'ls-remote', 'origin', f'refs/tags/{expected}')
        assert remote_tag
        assert command(repo, 'git', 'rev-parse', f'{expected}^{{commit}}') == merges[number]
        assert command(repo, 'git', 'show', f'{expected}:extension/pr-{number}.txt') == f'Source from PR {number}'
        retry = run(repo, RELEASE, 'Calculate release version', LABELS=labels, PR_NUMBER=number)
        assert retry['tag'] == expected and retry.get('reused') == 'true', retry
        assert retry['previous_tag'] == version['previous_tag']
        assert f'## [{version["version"]}]' not in original_changelog
    assert (repo / 'CHANGELOG.md').read_text().count('## [1.3.1]') == 1
    assert '## [1.3.2]' not in (repo / 'CHANGELOG.md').read_text()
    assert 'extension/pr-43.txt' not in command(repo, 'git', 'ls-tree', '-r', '--name-only', 'v1.3.1').splitlines()
    assert command(repo, 'git', 'show', 'origin/main:extension/pr-43.txt') == 'Source from PR 43'
    assert command(repo, 'git', 'show', 'origin/main:extension/later-main.txt') == 'Concurrent change'
    assert 'extension/later-main.txt' not in command(repo, 'git', 'ls-tree', '-r', '--name-only', 'v1.3.2').splitlines()
    assert run(repo, RELEASE, 'Calculate release version', LABELS='[]', PR_NUMBER='42')['tag'] == 'v1.3.1'

    # A PR may already set the target version and opt out of the changelog.
    run(repo, RELEASE, 'Set release manifest version', VERSION='1.3.3')
    command(repo, 'git', 'add', 'extension/manifest.json')
    command(repo, 'git', 'commit', '-m', 'PR already sets its release version')
    merge = command(repo, 'git', 'rev-parse', 'HEAD')
    command(repo, 'git', 'push', 'origin', 'main')
    run(repo, RELEASE, 'Update extension version and create tag',
        VERSION='1.3.3', TAG='v1.3.3', CATEGORY='Changed', UPDATE_CHANGELOG='false',
        PREVIOUS_TAG='v1.3.2', MERGE_SHA=merge, PR_NUMBER='44', PR_TITLE='Version update', PR_URL='https://example.invalid/44')
    assert command(repo, 'git', 'rev-parse', 'HEAD') == merge
    assert run(repo, RELEASE, 'Calculate release version', LABELS='[]', PR_NUMBER='44')['tag'] == 'v1.3.3'

    for workflow in (RELEASE, PRERELEASE):
        assert run(repo, workflow, 'Select browser builds', TAG='v1.3.1')['targets'] == '["firefox"]'
    for filename in ('sw.js', 'offscreen.html', 'offscreen.js'):
        (repo / 'extension' / filename).write_text('// Chrome fixture')
    command(repo, 'git', 'add', 'extension')
    command(repo, 'git', 'commit', '-m', 'Chrome fixture')
    command(repo, 'git', 'tag', 'v1.4.0')
    for workflow in (RELEASE, PRERELEASE):
        assert run(repo, workflow, 'Select browser builds', TAG='v1.4.0')['targets'] == '["firefox","chrome"]'
        assert run(repo, workflow, 'Select browser builds', TAG='v1.3.1')['targets'] == '["firefox"]'

    for target in ('firefox', 'chrome'):
        command(repo, 'git', 'checkout', 'v1.3.1' if target == 'firefox' else 'main')
        run(repo, RELEASE, 'Set release manifest version', VERSION='1.3.1')
        package = run(repo, PACKAGE, 'Build package', TARGET=target, VERSION='ci')['package']
        command(repo, 'sha256sum', '-c', package + '.sha256')
        with zipfile.ZipFile(repo / package) as archive:
            assert archive.testzip() is None
            assert 'test-jszip.html' not in archive.namelist() and 'README.md' not in archive.namelist()
            manifest = json.loads(archive.read('manifest.json'))
            assert manifest['version'] == '1.3.1'
            if target == 'chrome':
                assert manifest['background'] == {'service_worker': 'sw.js'}
                assert 'sw.js' in archive.namelist() and 'offscreen' in manifest['permissions']
                assert 'browser_specific_settings' not in manifest
                assert manifest['minimum_chrome_version'] == '116'
            else:
                assert manifest['background']['scripts'] and 'sw.js' not in archive.namelist()
                assert 'pr-43.txt' not in archive.namelist() and 'later-main.txt' not in archive.namelist()
            contents = {name: archive.read(name) for name in archive.namelist()}

        with zipfile.ZipFile(repo / package, 'a') as archive:
            archive.writestr('stale-build.txt', 'Must disappear on the next build')
        local_package = command(repo, 'bash', 'scripts/build-extension.sh', target, 'ci')
        assert local_package == package
        with zipfile.ZipFile(repo / local_package) as archive:
            assert {name: archive.read(name) for name in archive.namelist()} == contents
        command(repo, 'sha256sum', '-c', local_package + '.sha256')
        assert command(repo, 'bash', 'scripts/build-extension.sh', target) == f'oreilly-epub-downloader-v1.3.1-{target}.zip'

        (repo / 'build' / 'preserve.txt').write_text('Invalid inputs must not delete an existing build')
        for arguments in [('unknown', 'ci'), (target, '../bad-version')]:
            result = subprocess.run(['bash', 'scripts/build-extension.sh', *arguments], cwd=repo,
                                    capture_output=True, text=True)
            assert result.returncode != 0 and (repo / 'build' / 'preserve.txt').exists()
        command(repo, 'git', 'restore', 'extension/manifest.json')

print('Release checks passed: queued PR snapshots, version labels, retries, changelog, browser selection, packages and checksums.')
