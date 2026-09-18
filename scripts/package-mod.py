"""Package the local mod; --install copies it to Factorio with a backup."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import argparse
import hashlib
import json
import os
import shutil

parser = argparse.ArgumentParser()
parser.add_argument('--install', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
source = root / 'starter_initializer'
info = json.loads((source / 'info.json').read_text())
folder = f"{info['name']}_{info['version']}"
archive = root / f'{folder}.zip'
temp_archive = archive.with_suffix('.zip.tmp')
with ZipFile(temp_archive, 'w', ZIP_DEFLATED) as package:
    for file in sorted(source.rglob('*')):
        if file.is_file() and not file.name.startswith('.'):
            package.write(file, str(Path(folder) / file.relative_to(source)))
with ZipFile(temp_archive) as package:
    assert package.testzip() is None
temp_archive.replace(archive)
print(f'Packaged {archive.name}')
if args.install:
    mods = Path(os.environ.get('FACTORIO_MODS', str(Path.home() / 'Library/Application Support/factorio/mods')))
    if not (mods / 'mod-list.json').is_file():
        raise SystemExit('Factorio mod-list.json not found; set FACTORIO_MODS to the installed mods directory.')
    backups = root / '.cache/mod-backups'
    backups.mkdir(parents=True, exist_ok=True)
    for old in mods.glob('starter_initializer_*.zip'):
        backup = backups / old.name
        if not backup.exists():
            shutil.copy2(old, backup)
    installed = mods / archive.name
    temporary = installed.with_suffix('.zip.tmp')
    shutil.copy2(archive, temporary)
    temporary.replace(installed)
    assert hashlib.sha256(installed.read_bytes()).digest() == hashlib.sha256(archive.read_bytes()).digest()
    print(f'Installed Starter Initializer {info["version"]}. Existing versions backed up under .cache/mod-backups/.')
    print('Restart Factorio and load the save to apply the update. Manual /starter_init_grant remains available.')
