// Serve only the public website directory. No dependencies or directory listings.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=await fs.realpath(process.env.SITE_DIR||fileURLToPath(new URL('../site',import.meta.url)));
const port=Number(process.env.PORT||18090),host=process.env.HOST||'0.0.0.0';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8','.lua':'text/plain; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.zip':'application/zip'};
const server=http.createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname.split('/').some(p=>p.startsWith('.'))){res.writeHead(404);res.end();return;}
  let target=path.resolve(root,'.'+pathname);
  if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(404);res.end();return;}
  let stat=await fs.stat(target);if(stat.isDirectory()){target=path.join(target,'index.html');stat=await fs.stat(target);}
  const real=await fs.realpath(target);if(!real.startsWith(root+path.sep)||!stat.isFile()){res.writeHead(404);res.end();return;}
  const ext=path.extname(target),data=req.method==='HEAD'?null:await fs.readFile(real);
  res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':['.png','.woff2'].includes(ext)?'public, max-age=86400':'no-cache','X-Content-Type-Options':'nosniff'});res.end(data);
 }catch(e){res.writeHead(e.code==='ENOENT'||e.code==='ENOTDIR'?404:400);res.end('Not found');}
});
server.listen(port,host,()=>console.log(`Factorio Command Center listening on ${host}:${port}`));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
