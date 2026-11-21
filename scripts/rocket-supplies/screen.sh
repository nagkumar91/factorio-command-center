#!/bin/sh
# Exploration screen: generate a candidate into .cache, run the native harness with SPACE_EXPLORE=1
# (full protocol lengths unless RS_WARMUP/RS_MEASURE/... are set), print the summary.
# usage: RS_OPTIONS='{...}' scripts/rocket-supplies/screen.sh
set -e
cd "$(dirname "$0")/../.."
export RS_OUT=${RS_OUT:-.cache/rocket-supplies/candidate}
node scripts/rocket-supplies/generate.mjs | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log("footprint",j.footprint.width+"x"+j.footprint.height,"=",j.area,"machines",j.machines,"entities",j.entities,"supply",JSON.stringify(j.supply))})'
SPACE_EXPLORE=1 RS_SOURCE=$RS_OUT RS_RUN_ROOT=.cache/rocket-supplies/explore-run node scripts/rocket-supplies/validate.mjs >/dev/null 2>.cache/rocket-supplies/explore.err || true
grep -h "FLIGHT_SCIENCE\|Error" .cache/rocket-supplies/explore.err | head -5 || true
node scripts/rocket-supplies/summary.mjs .cache/rocket-supplies/explore-report.json
