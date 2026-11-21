// The robot workshop offers two qualified versions, written to the manifest's "versions" field in the shared
// convention (scripts/blueprint-versions.mjs): newest first, each figure read from that version's own exact-hash
// native report. Crafts per window stay in the reports and the README; the field carries rates only.
import {familyVersions} from '../blueprint-versions.mjs';

export const EARLIER={folder:'history/luna-underground-30edbea3',manifestFile:'selected-manifest.json'};
export const VERSIONS=[
 {label:'Smaller, pair swapped',summary:'Recommended: 96 × 18 = 1,728 tiles, 9.4% fewer tiles and one assembling machine fewer (45 assembling machines 2 and 3 chemical plants). Over 30 minutes it made one construction robot and two roboports fewer than the earlier version, still meeting every target, and it recovered faster after blocked output.'},
 {label:'Earlier, one more assembler',summary:'Earlier version: 106 × 18 = 1,908 tiles, 46 assembling machines 2 and 3 chemical plants. Choose it if you have the room and want the last few crafts: one more construction robot and two more roboports per 30 minutes in its measured run.'},
];

/** Newest first: the published version, then the earlier 106 x 18 version. family is blueprint-sources/flight-robots. */
export async function versionList(family,published){
 const [current,earlier]=VERSIONS;
 return familyVersions(family,[
  {...current,file:published.file,report:'native-report.json',width:published.footprint.width,height:published.footprint.height},
  {...earlier,file:EARLIER.folder+'/'+published.file,manifest:EARLIER.folder+'/'+EARLIER.manifestFile,report:EARLIER.folder+'/native-report.json'},
 ]);
}
