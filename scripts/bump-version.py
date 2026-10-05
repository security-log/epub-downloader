"""Calculate the next release version and changelog fields from PR labels."""

import json
import re
import sys


def bump_version(tag, labels):
    match = re.fullmatch(r'v([0-9]+)\.([0-9]+)\.([0-9]+)', tag)
    if not match:
        raise ValueError('Expected a vX.Y.Z release tag')
    if not isinstance(labels, list) or any(not isinstance(label, str) for label in labels):
        raise ValueError('Expected a JSON array of label names')
    major, minor, patch = map(int, match.groups())
    if 'release:major' in labels:
        major, minor, patch = major + 1, 0, 0
        category = 'Breaking changes'
    elif 'release:minor' in labels:
        minor, patch = minor + 1, 0
        category = 'Added'
    else:
        patch += 1
        category = 'Fixed' if 'release:patch' in labels else 'Changed'
    return {
        'version': f'{major}.{minor}.{patch}',
        'category': category,
        'update_changelog': 'skip-changelog' not in labels,
    }


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('Usage: python3 scripts/bump-version.py <vX.Y.Z> <labels-json>')
    try:
        print(json.dumps(bump_version(sys.argv[1], json.loads(sys.argv[2]))))
    except ValueError as error:
        raise SystemExit(str(error))
