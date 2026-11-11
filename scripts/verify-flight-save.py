"""Verify the loaded runtime state of a private copy of the installed flight save."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import time

root = Path(__file__).resolve().parent.parent
source = root / '.cache/flight-game'
cache = root / '.cache/flight-save-readcheck'
app = Path.home() / 'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app/Contents'
report = json.loads((root / 'flight-map/native-report.json').read_text())
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--save', type=Path, help='Verify this generated save before installation')
args = parser.parse_args()
installed = args.save or (Path.home() / 'Library/Application Support/factorio/saves' / report['installedSaveName'])
assert hashlib.sha256(installed.read_bytes()).hexdigest() == report['saveSha256']
cache.mkdir(parents=True, exist_ok=True)
shutil.copy2(installed, cache / 'flight-check.zip')
(cache / 'config.ini').write_text(f'[path]\nread-data={app}/data\nwrite-data={cache}\n[general]\nlocale=en\n')
(cache / 'server-settings.json').write_text(json.dumps({'name': 'Private flight verification', 'description': '', 'visibility': {'public': False, 'lan': False}, 'require_user_verification': False, 'auto_pause': False, 'autosave_interval': 0}))
output = cache / 'script-output/flight-runtime-check.json'
output.unlink(missing_ok=True)
before = cache / 'script-output/flight-player-before.json'
before.unlink(missing_ok=True)
command = [str(app / 'MacOS/factorio'), '--config', str(cache / 'config.ini'), '--mod-directory', str(source / 'mods'), '--start-server', str(cache / 'flight-check.zip'), '--server-settings', str(cache / 'server-settings.json'), '--bind', '127.0.0.1', '--port', '34297']

def send(process, lua):
    # Repetition is safe and also handles the console's first-use confirmation.
    for _ in range(2):
        process.stdin.write('/silent-command ' + lua + '\n')
        process.stdin.flush()
        time.sleep(.2)

def await_file(process, path, seconds=20):
    deadline = time.monotonic() + seconds
    while not path.exists():
        if process.poll() is not None:
            raise RuntimeError('Native server exited; inspect .cache/flight-save-readcheck/server.log')
        if time.monotonic() > deadline:
            raise RuntimeError('Native query timed out; inspect .cache/flight-save-readcheck/server.log')
        time.sleep(.2)

with (cache / 'server.log').open('w') as log:
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=log, stderr=log, text=True)
    try:
        deadline = time.monotonic() + 45
        while 'InGame' not in (cache / 'server.log').read_text():
            if process.poll() is not None or time.monotonic() > deadline:
                raise RuntimeError('Native server did not become ready; inspect server.log')
            time.sleep(.2)
        send(process, "helpers.write_file('flight-player-before.json',helpers.table_to_json({chests=game.surfaces.nauvis.count_entities_filtered{name='steel-chest',force=game.forces.player}}),false)")
        await_file(process, before)
        checks = [
            "storage.flight_readcheck={validationKind='loaded-save-runtime-state',playerJoinSimulated=false,playerCount=#game.players}",
            "assert(game.forces.player.recipes['wood-processing'].enabled);storage.flight_readcheck.treeRecipe=true",
            "assert(settings.global['starter-init-auto-grant-on-join'].value==false);storage.flight_readcheck.starterAutoGrant=false",
            "local f=game.forces.player;assert(not f.technologies['construction-robotics'].researched and not f.technologies['logistic-robotics'].researched);storage.flight_readcheck.robotResearch=false",
            "local r=storage.flight_readcheck;r.resources={};r.resourceEntities=0;for _,e in pairs(game.surfaces.nauvis.find_entities_filtered{type='resource'})do assert(e.amount==4294967295);assert(not e.initial_amount or e.initial_amount==4294967295);r.resourceEntities=r.resourceEntities+1;r.resources[e.name]=(r.resources[e.name]or 0)+e.amount end;r.maxResourcePerEntity=4294967295",
            "local s=game.surfaces.nauvis;assert(s.count_entities_filtered{name='solar-panel'}==480 and s.count_entities_filtered{name='accumulator'}==420);storage.flight_readcheck.solarPanels=480;storage.flight_readcheck.accumulators=420;storage.flight_readcheck.trees=s.count_entities_filtered{type='tree'};assert(storage.flight_readcheck.trees>=3616)",
            "storage.flight_readcheck.steelChests=game.surfaces.nauvis.count_entities_filtered{name='steel-chest',force=game.forces.player};helpers.write_file('flight-runtime-check.json',helpers.table_to_json(storage.flight_readcheck),false)",
        ]
        for lua in checks:
            assert len(lua) < 480, 'Native console lines are bounded'
            send(process, lua)
        await_file(process, output)
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
result = json.loads(output.read_text())
assert result.get('treeRecipe') is True
assert result.get('starterAutoGrant') is False
assert result.get('robotResearch') is False
assert result.get('maxResourcePerEntity') == 4294967295 and result.get('resourceEntities', 0) > 0
assert set(report['resources']).issubset(result['resources'])
for name, minimum in report['resources'].items():
    assert result['resources'][name] >= minimum, name
result['passed'] = True
result['steelChestsBeforeChecks'] = json.loads(before.read_text())['chests']
assert result['steelChests'] == result['steelChestsBeforeChecks'], 'Unexpected supply chests appeared during runtime checks'
assert hashlib.sha256(installed.read_bytes()).hexdigest() == report['saveSha256'], 'Source save changed'
result['saveSha256'] = report['saveSha256']
result['prototypeSha256'] = report['prototypeSha256']
result['scenarioControlSha256'] = report['scenarioSha256']['control.lua']
(root / 'flight-map/native-loaded-save-report.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
