import fs from 'node:fs/promises';
// The status rule validate.mjs writes, applied at generation time, so re-running a generator
// leaves the manifest byte-identical and keeps an exact-hash qualified design qualified.
export async function qualification(out,m){
 let report;try{report=JSON.parse(await fs.readFile(out+'/native-report.json'));}catch{return {};}
 const cases=report.builds.filter(b=>b.blueprintSha256===m.blueprintSha256&&[m.id,m.id+'-supplemented'].includes(b.id));
 if(!cases.length)return {};
 const optional=m.optionalInputs.length>0;
 return {status:cases.length===(optional?2:1)&&cases.every(b=>b.passed)?(optional?'native-verified-required-and-supplemented':'native-verified-raw-inputs'):'native-verification-incomplete',nativeReport:'native-report.json'};
}
