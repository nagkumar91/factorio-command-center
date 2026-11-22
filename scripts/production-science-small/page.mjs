/** Guide page of the small production-science module: site/production-science-small/. It is the circuit suppliers' page
 * (scripts/circuit-supplier-pages.mjs) for this family, headed SCIENCE, with a line naming the supplier blueprints its
 * circuits can come from instead of the Suppliers line. Every figure is read from the manifests, never typed here.
 * CLI: node scripts/production-science-small/page.mjs   (run from factorio-command-center/; no game data needed)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildCircuitSupplierPages} from '../circuit-supplier-pages.mjs';

const ROOT=fileURLToPath(new URL('../../',import.meta.url));
export const ID='production-science-small';
const num=n=>String(Number(n.toFixed(1)));
const words=s=>s.replaceAll('-',' ');

/** "Circuits from: …" with each circuit's panel figure, the supplier guide that makes it and that supplier's rate. */
export async function circuitSourcesLine(m,root=ROOT){
 const parts=[];
 for(const [item,id] of Object.entries(m.circuitSuppliers||{})){
  const [s]=JSON.parse(await fs.readFile(path.join(root,'blueprint-sources',id,'manifest.json'),'utf8'));
  const label=s.name.split(' · ')[0],need=m.inputs.find(p=>p.item===item).perMinute,rate=s.targets[item];
  parts.push(`${words(item)}s (${num(need)} per minute) from the <a href="../${id}/index.html" data-circuit-source="${id}">${label}</a>, which makes ${num(rate)} per minute`);
 }
 return `<p class="suppliers" data-circuit-sources>Circuits from: ${parts.join('; ')}.</p>`;
}

export const buildProductionSciencePage=({root=ROOT}={})=>buildCircuitSupplierPages({root,ids:[ID],eyebrow:'SCIENCE',links:m=>circuitSourcesLine(m,root),noun:'module'});
if(process.argv[1]&&await fs.realpath(process.argv[1]).catch(()=>null)===fileURLToPath(import.meta.url))console.log(JSON.stringify(await buildProductionSciencePage(),null,2));
