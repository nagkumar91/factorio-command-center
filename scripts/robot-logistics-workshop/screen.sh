#!/bin/sh
# Exploration run: generate into a scratch folder under .cache, run the full native protocol there, summarize.
# Never touches blueprint-sources. usage: scripts/robot-logistics-workshop/screen.sh [name] ; RLW_OPTIONS='{...}' for variants.
set -e
cd "$(dirname "$0")/../.."
NAME=${1:-candidate}
DIR=.cache/robot-logistics-workshop/$NAME
rm -rf "$DIR" "$DIR-run"; mkdir -p "$DIR"
RLW_OUT=$DIR node scripts/robot-logistics-workshop/generate.mjs | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log("footprint",j.footprint.width+"x"+j.footprint.height,"=",j.area,"machines",j.machines,"entities",j.entities,"limits",j.maximumStock+"/"+j.capacity,"sha",j.blueprintSha256.slice(0,8))})'
FIVE_SOURCE=$DIR FIVE_RUN_ROOT=$DIR-run node scripts/robot-logistics-workshop/validate.mjs >"$DIR-run.out" 2>&1 || true
if [ -f "$DIR/native-report.json" ]; then node scripts/robot-logistics-workshop/summary.mjs "$DIR/native-report.json"; else tail -12 "$DIR-run.out"; fi
rm -f "$DIR-run/test.zip"
