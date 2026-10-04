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
    subprocess.run(['bash', '-c', block(path, name)], cwd=repo, check=True,
                   env=dict(os.environ, GITHUB_OUTPUT=str(output), **env), capture_output=True, text=True)
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
    for filename in ('sw.js', 'offscreen.html', 'offscreen.js'):
        (repo / 'extension' / filename).unlink(missing_ok=True)
    manifest_path = repo / 'extension/manifest.json'
    manifest = json.loads(manifest_path.read_text())
    manifest['version'] = '1.3.0'
    manifest_path.write_text(json.dumps(manifest))
    (repo / 'CHANGELOG.md').write_text('# Changelog\n\n## [Unreleased]\n\n## [1.3.0]\n')
    command(repo, 'git', 'add', 'extension', 'CHANGELOG.md')
    command(repo, 'git', 'commit', '-m', 'Initial source')
    command(repo, 'git', 'tag', 'v1.3.0')

    for labels, expected in [('[]', 'v1.3.1'), ('["release:patch"]', 'v1.3.1'),
                             ('["release:minor"]', 'v1.4.0'),
                             ('["release:minor","release:major"]', 'v2.0.0')]:
        assert run(repo, RELEASE, 'Calculate release version', LABELS=labels, PR_NUMBER='42')['tag'] == expected

    original_changelog = (repo / 'CHANGELOG.md').read_text()
    for number, labels, expected in [('42', '[]', 'v1.3.1'), ('43', '["skip-changelog"]', 'v1.3.2')]:
        version = run(repo, RELEASE, 'Calculate release version', LABELS=labels, PR_NUMBER=number)
        assert version['tag'] == expected
        run(repo, RELEASE, 'Update extension version and create tag',
            VERSION=version['version'], TAG=version['tag'], CATEGORY=version['category'],
            UPDATE_CHANGELOG=version['update_changelog'], PR_NUMBER=number,
            PREVIOUS_TAG=version['previous_tag'], PR_TITLE='Example PR', PR_URL=f'https://example.invalid/{number}')
        remote_tag = command(repo, 'git', 'ls-remote', 'origin', f'refs/tags/{expected}')
        assert remote_tag
        retry = run(repo, RELEASE, 'Calculate release version', LABELS=labels, PR_NUMBER=number)
        assert retry['tag'] == expected and retry['reused'] == 'true'
        assert retry['previous_tag'] == version['previous_tag']
        assert f'## [{version["version"]}]' not in original_changelog
    assert (repo / 'CHANGELOG.md').read_text().count('## [1.3.1]') == 1
    assert '## [1.3.2]' not in (repo / 'CHANGELOG.md').read_text()
    assert run(repo, RELEASE, 'Calculate release version', LABELS='[]', PR_NUMBER='42')['tag'] == 'v1.3.1'

    for workflow in (RELEASE, PRERELEASE):
        assert run(repo, workflow, 'Select browser builds', TAG='v1.3.1')['targets'] == '["firefox"]'
    for filename in ('sw.js', 'offscreen.html', 'offscreen.js'):
        (repo / 'extension' / filename).write_text('// Chrome fixture')
    command(repo, 'git', 'add', 'extension')
    command(repo, 'git', 'commit', '-m', 'Chrome fixture')
    command(repo, 'git', 'tag', 'v1.3.3')
    for workflow in (RELEASE, PRERELEASE):
        assert run(repo, workflow, 'Select browser builds', TAG='v1.3.3')['targets'] == '["firefox","chrome"]'
        assert run(repo, workflow, 'Select browser builds', TAG='v1.3.1')['targets'] == '["firefox"]'

    for target in ('firefox', 'chrome'):
        run(repo, PACKAGE, 'Stage files', TARGET=target)
        package = run(repo, PACKAGE, 'Create ZIP', TARGET=target, VERSION='ci')['package']
        command(repo, 'sha256sum', '-c', package + '.sha256')
        with zipfile.ZipFile(repo / package) as archive:
            assert archive.testzip() is None
            assert 'test-jszip.html' not in archive.namelist() and 'README.md' not in archive.namelist()
            manifest = json.loads(archive.read('manifest.json'))
            if target == 'chrome':
                assert manifest['background'] == {'service_worker': 'sw.js'}
                assert 'sw.js' in archive.namelist() and 'offscreen' in manifest['permissions']
                assert 'browser_specific_settings' not in manifest
            else:
                assert manifest['background']['scripts'] and 'sw.js' not in archive.namelist()

print('Release checks passed: version labels, retries, changelog, browser selection, packages and checksums.')
