// Runs every Playwright suite against the built site: `npm run test:e2e` (builds first).
// Suites are discovered by name: tests/*browser*.mjs plus flight-workshops-navigation.mjs and fusion-website.mjs.
// Usage: node tests/run-browser-suites.mjs [--jobs N] [name-filter...]   (default 6 at once)
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';

const args=process.argv.slice(2),ji=args.indexOf('--jobs');
const jobs=ji>=0?Number(args.splice(ji,2)[1]):Number(process.env.E2E_JOBS||6);
const dir=new URL('./',import.meta.url),root=new URL('../',import.meta.url);
const extra=new Set(['flight-workshops-navigation.mjs','fusion-website.mjs']);
const suites=(await fs.readdir(dir)).filter(f=>f.endsWith('.mjs')&&f!==import.meta.url.split('/').pop()&&(f.includes('browser')||extra.has(f))&&(!args.length||args.some(a=>f.includes(a)))).sort();
if(!suites.length||!(jobs>=1)){console.error('No suites found or bad --jobs');process.exit(2);}

const run=name=>new Promise(resolve=>{
  const start=Date.now(),child=spawn(process.execPath,['tests/'+name],{cwd:root,stdio:['ignore','pipe','pipe']});let out='';
  child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>out+=d);
  child.on('close',code=>resolve({name,code,out,seconds:((Date.now()-start)/1000).toFixed(1)}));
});
const failures=[],queue=[...suites];
await Promise.all(Array.from({length:Math.min(jobs,suites.length)},async()=>{
  while(queue.length){
    const r=await run(queue.shift());
    if(r.code===0)console.log(`PASS ${r.name} (${r.seconds}s)`);
    else{failures.push(r);
      // First lines of the error: skip the node stack boilerplate and keep the message.
      const lines=r.out.split('\n').filter(l=>l.trim()&&!/^\s*(\^|triggerUncaughtException|node:internal)/.test(l)).slice(0,6);
      console.log(`FAIL ${r.name} (${r.seconds}s, exit ${r.code})\n${lines.map(l=>'     '+l).join('\n')}`);}
  }
}));
console.log(`\n${suites.length-failures.length}/${suites.length} browser suites passed`+(failures.length?`; failed: ${failures.map(f=>f.name).sort().join(', ')}`:''));
process.exit(failures.length?1:0);
