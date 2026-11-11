#!/usr/bin/env python3
"""Package the validated local save and built website for offline use; never publish saves."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--destination', type=Path, default=Path.home() / 'Downloads' / 'Factorio Flight Kit - 2026-11-10')
args = parser.parse_args()
report = json.loads((ROOT / 'flight-map/native-report.json').read_text())
save = Path.home() / 'Library/Application Support/factorio/saves' / report['installedSaveName']
if hashlib.sha256(save.read_bytes()).hexdigest() != report['saveSha256']:
    raise SystemExit('Installed save differs from the validated save; no kit written.')
dist = ROOT / 'dist'
for required in ['flight-factories.html', 'flight-factories-data.js', 'flight-map.svg']:
    if not (dist / required).is_file():
        raise SystemExit('Build the website before packaging: npm run build')
if (dist / 'flight-factories-data.js').read_bytes() != (ROOT / 'site/flight-factories-data.js').read_bytes():
    raise SystemExit('Built catalogue is stale; run npm run build again.')
target = args.destination.expanduser().resolve()
if target.exists():
    raise SystemExit(f'Destination already exists; choose a new --destination: {target}')
target.mkdir(parents=True)
shutil.copy2(save, target / save.name)
shutil.copytree(dist, target / 'website')
shutil.copy2(ROOT / 'flight-map/README.md', target / 'Game guide.md')
for filename in ['native-report.json', 'native-loaded-save-report.json', 'native-max-resources-report.json', 'progression-audit.json']:
    shutil.copy2(ROOT / 'flight-map' / filename, target / filename)
(target / 'START HERE.txt').write_text(f'''FACTORIO FLIGHT KIT

PLAY: Factorio > Single player > Load game > {save.stem}
The save is already installed. This folder also holds a backup copy.
Use the existing installed mod profile; versions are listed in native-report.json.

FACTORIES: Open website/flight-factories.html in your browser.
Keep the website folder together. Icons, previews, plans and blueprint strings
work offline. Open the verified blueprint book at the top of the catalogue,
copy its complete text, and use Import string in Factorio.
Calculated targets and native-tested production are labeled separately.

START: Connect to the solar substations north of spawn. Collect supplies south
of spawn. Research robots yourself. Read Game guide.md for progression, tree
planting, and the marked ground exchange/specimens near 240,100.

RESOURCES: 4,294,967,295 per resource entity, including future deposits.
Resources deplete normally. Normal enemies remain outside the large safe start.

Validated original save SHA-256: {report['saveSha256']}
''')
print(target)
