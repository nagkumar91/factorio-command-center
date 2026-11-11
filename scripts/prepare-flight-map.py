"""Build a reproducible local scenario/save without changing installed mod settings."""
import argparse, hashlib, json, pathlib, shutil, subprocess, sys, zipfile
ROOT=pathlib.Path(__file__).resolve().parent.parent
CACHE=ROOT/'.cache/flight-game'
HOME=pathlib.Path.home()
USER=HOME/'Library/Application Support/factorio'
APP=HOME/'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app/Contents'
parser=argparse.ArgumentParser()
parser.add_argument('--install',action='store_true',help='Copy save to the game saves folder without overwriting another save')
parser.add_argument('--dump',action='store_true',help='Refresh the isolated prototype dump')
args=parser.parse_args()
(CACHE/'mods').mkdir(parents=True,exist_ok=True)
if not (CACHE/'mods/mod-list.json').exists():
 for f in (USER/'mods').iterdir():
  if f.suffix=='.zip' or f.name in ['mod-list.json','mod-settings.dat']:shutil.copy2(f,CACHE/'mods'/f.name)
(CACHE/'config.ini').write_text(f'[path]\nread-data={APP}/data\nwrite-data={CACHE}\n[general]\nlocale=en\n')
command=[str(APP/'MacOS/factorio'),'--config',str(CACHE/'config.ini'),'--mod-directory',str(CACHE/'mods')]
if args.dump or not (CACHE/'script-output/data-raw-dump.json').exists():subprocess.run(command+['--dump-data'],check=True)
SCENARIO=CACHE/'scenarios/flight-forest'
SCENARIO.mkdir(parents=True,exist_ok=True)
def lua(v):
 if isinstance(v,dict):return '{'+','.join('['+json.dumps(k)+']='+lua(x) for k,x in v.items())+'}'
 if isinstance(v,list):return '{'+','.join(map(lua,v))+'}'
 if isinstance(v,bool):return str(v).lower()
 if v is None:return 'nil'
 return json.dumps(v)
for f in (ROOT/'flight-map').glob('*.lua'):shutil.copy2(f,SCENARIO/f.name)
(SCENARIO/'map-settings.lua').write_text('return '+lua(json.loads((ROOT/'flight-map/map-gen-settings.json').read_text())))
(SCENARIO/'description.json').write_text(json.dumps({'name':'Flight Forest','description':'Rich resources, solar starter grid, active enemies beyond a large safe start. Research your own robots.'}))
subprocess.run(command+['--scenario2map','flight-forest'],check=True)
save=CACHE/'saves/flight-forest.zip'
assert save.exists()
loaded_report=CACHE/'script-output/flight-map-loaded-report.json'
loaded_report.unlink(missing_ok=True)
with (CACHE/'reload.log').open('w') as log:
 subprocess.run(command+['--benchmark',str(save),'--benchmark-ticks','3600','--benchmark-runs','1'],stdout=log,stderr=log,check=True)
report=json.loads((CACHE/'script-output/flight-map-report.json').read_text())
loaded=json.loads(loaded_report.read_text())
assert loaded['passed'] and loaded['treeRecipe'] and loaded['resourceEntities']>0 and loaded['solarPanels']==480
report['reloadValidation']={**loaded,'ticks':3600}
report['saveSha256']=hashlib.sha256(save.read_bytes()).hexdigest()
report['prototypeSha256']=hashlib.sha256((CACHE/'script-output/data-raw-dump.json').read_bytes()).hexdigest()
report['scenarioSha256']={f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in SCENARIO.glob('*.lua')}
report['seed']=20261110
report['mods']=json.loads((CACHE/'mods/mod-list.json').read_text())['mods']
versions={}
for f in (CACHE/'mods').glob('*.zip'):
 with zipfile.ZipFile(f) as z:
  info=json.loads(z.read(next(n for n in z.namelist() if n.count('/')==1 and n.endswith('/info.json'))))
  old=versions.get(info['name'],'0.0.0')
  if tuple(map(int,info['version'].split('.'))) > tuple(map(int,old.split('.'))):versions[info['name']]=info['version']
for mod in report['mods']:mod['version']=versions.get(mod['name'],'2.0.77')
(ROOT/'flight-map/native-report.json').write_text(json.dumps(report,indent=2)+'\n')
subprocess.run([sys.executable,str(ROOT/'scripts/verify-flight-save.py'),'--save',str(save)],check=True)
loaded_path=ROOT/'flight-map/native-loaded-save-report.json'
loaded_state=json.loads(loaded_path.read_text())
report['loadedSaveValidation']={'passed':loaded_state['passed'],'report':'flight-map/native-loaded-save-report.json','sha256':hashlib.sha256(loaded_path.read_bytes()).hexdigest(),'saveSha256':loaded_state['saveSha256'],'resourceEntities':loaded_state['resourceEntities'],'resourceTypes':len(loaded_state['resources'])}
(ROOT/'flight-map/native-report.json').write_text(json.dumps(report,indent=2)+'\n')
if args.install:
 target=USER/'saves/Flight Forest - Max Resources - Ready - 2026-11-10.zip'
 if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest()!=report['saveSha256']:
  target=target.with_name(target.stem+' - '+report['saveSha256'][:8]+'.zip')
 if not target.exists():shutil.copy2(save,target)
 report['installedSaveName']=target.name
 (ROOT/'flight-map/native-report.json').write_text(json.dumps(report,indent=2)+'\n')
 print('Installed:',target)
print('Validated save:',save)
