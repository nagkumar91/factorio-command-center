"""Test maximum resources in newly generated terrain using an isolated scenario."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

root = Path(__file__).resolve().parent.parent
source = root / '.cache/flight-game'
cache = root / '.cache/flight-resource-native'
app = Path.home() / 'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app/Contents'
scenario = cache / 'scenarios/flight-resource-validation'
scenario.mkdir(parents=True, exist_ok=True)
for name in ['progression.lua', 'map-settings.lua']:
    shutil.copy2(source / 'scenarios/flight-forest' / name, scenario / name)
control = (root / 'flight-map/control.lua').read_bytes()
test = (root / 'tests/flight-future-resources.lua').read_bytes()
(scenario / 'control.lua').write_bytes(control + b'\n' + test)
(cache / 'config.ini').write_text(f'[path]\nread-data={app}/data\nwrite-data={cache}\n[general]\nlocale=en\n')
command = [str(app / 'MacOS/factorio'), '--config', str(cache / 'config.ini'), '--mod-directory', str(source / 'mods')]
output = cache / 'script-output/flight-max-resource-report.json'
output.unlink(missing_ok=True)
with (cache / 'validation.log').open('w') as log:
    subprocess.run(command + ['--scenario2map', 'flight-resource-validation'], stdout=log, stderr=log, check=True)
    subprocess.run(command + ['--benchmark', str(cache / 'saves/flight-resource-validation.zip'), '--benchmark-ticks', '3', '--benchmark-runs', '1'], stdout=log, stderr=log, check=True)
report = json.loads(output.read_text())
assert report['passed'] and report['futureChunkResourceEntities'] > 0 and report['maxAmount'] == 4294967295
report['scenarioControlSha256'] = hashlib.sha256(control).hexdigest()
report['testSourceSha256'] = hashlib.sha256(test).hexdigest()
report['prototypeSha256'] = hashlib.sha256((source / 'script-output/data-raw-dump.json').read_bytes()).hexdigest()
(root / 'flight-map/native-max-resources-report.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
