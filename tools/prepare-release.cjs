'use strict';
// Run before publishing: version local images and identify the complete runtime release.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),hash=value=>crypto.createHash('sha256').update(value).digest('hex').slice(0,16);
const versionImages=text=>text.replace(/assets\/[A-Za-z0-9._-]+\.png(?:\?v=[a-f0-9]+)?/g,url=>{
 const file=url.split('?')[0];return file+'?v='+hash(fs.readFileSync(path.join(root,file)));
});
let html=versionImages(fs.readFileSync(path.join(root,'index.html'),'utf8'));
let manifest=JSON.parse(fs.readFileSync(path.join(root,'site.webmanifest'),'utf8'));
for(const icon of manifest.icons)icon.src=versionImages(icon.src);
const manifestText=JSON.stringify(manifest,null,2)+'\n';
html=html.replace(/site\.webmanifest(?:\?v=[a-f0-9]+)?/g,'site.webmanifest?v='+hash(manifestText));
const canonical=html.replace(/const releaseVersion='[^']*';/,"const releaseVersion='RELEASE';");
const teams=JSON.parse(fs.readFileSync(path.join(root,'teams.json'),'utf8'));
// The bookmark is self-contained: embed current organization names without cross-site requests.
const capturePath=path.join(root,'tools/gamechanger-capture.js'),installerPath=path.join(root,'tools/gamechanger-capture.html');
let capture=fs.readFileSync(capturePath,'utf8');
capture=capture.replace(/  const organizationTeams = .*;/,()=> '  const organizationTeams = '+JSON.stringify((teams.organization_teams||[]).map(({id,name})=>({id,name})))+';');
const installer=fs.readFileSync(installerPath,'utf8').replace(/(id="capture-bookmark" href=")[^"]+"/,(_,prefix)=>prefix+'javascript:'+encodeURIComponent(capture)+'"');
fs.writeFileSync(capturePath,capture);fs.writeFileSync(installerPath,installer);
const runtime=[canonical,manifestText,fs.readFileSync(path.join(root,'teams.json')),...teams.teams.map(t=>fs.readFileSync(path.join(root,t.data_file)))];
const version=hash(Buffer.concat(runtime.map(x=>Buffer.from(x))));
html=html.replace(/const releaseVersion='[^']*';/,"const releaseVersion='"+version+"';");
fs.writeFileSync(path.join(root,'index.html'),html);
fs.writeFileSync(path.join(root,'site.webmanifest'),manifestText);
fs.writeFileSync(path.join(root,'version.json'),JSON.stringify({version})+'\n');
console.log('Prepared release '+version);
