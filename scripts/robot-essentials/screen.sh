#!/bin/sh
# Short exploration screen: generate into the scratch candidate folder, run 10+10 minutes, summarize.
# usage: scripts/robot-essentials/screen.sh [warmup] [measure] [extra env...]
set -e
cd "$(dirname "$0")/../.."
W=${1:-10}; M=${2:-10}
export RE_OUT=${RE_OUT:-.cache/robot-essentials/candidate}
node scripts/robot-essentials/generate.mjs | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log("footprint",j.footprint.width+"x"+j.footprint.height,"=",j.area,"machines",j.machines,"entities",j.entities)})'
rm -rf .cache/robot-essentials/explore-run
ESSENTIALS_EXPLORE=1 RE_SOURCE=$RE_OUT RE_WARMUP=$W RE_MEASURE=$M RE_BLOCKED=${RE_BLOCKED:-0} RE_SETTLE=${RE_SETTLE:-0} RE_RECOVERY=${RE_RECOVERY:-0} RE_PHASES=${RE_PHASES:-0} RE_RUN_ROOT=.cache/robot-essentials/explore-run node scripts/robot-essentials/validate.mjs >/dev/null 2>.cache/robot-essentials/explore-run.err || true
node scripts/robot-essentials/summary.mjs .cache/robot-essentials/explore-report.json
