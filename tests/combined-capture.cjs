'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const C=require('../tools/gamechanger-capture.js'),I=require('../tools/import-plays.cjs'),P=require('../tools/preflight-plays.cjs'),root=path.resolve(__dirname,'..');
const plays=fs.readFileSync(path.join(__dirname,'fixtures/captures/2026-10-25-dig-in-bba-capture.txt'),'utf8'),box=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/box-score/2026-10-25-dig-in-bba.json'))),urls=C.gameScreens(box.source_url);
const header='Sun Oct 25, 2026, 10:00 AM - 12:00 PM ET\n';
(async()=>{
 const fakePopup={closed:false,location:{href:urls.plays},document:{readyState:'complete',body:{innerText:header+plays}}};
 const visible=await C.readGameWindow(fakePopup,urls.plays,'plays',()=>false,[],{timeout:100,settle:0,poll:1});assert(visible.text.includes('Top')); 
 await assert.rejects(()=>C.readGameWindow(null,urls.plays,'plays',()=>false),/blocked or closed/);
 await assert.rejects(()=>C.readGameWindow({...fakePopup,closed:true},urls.plays,'plays',()=>false),/blocked or closed/);
 await assert.rejects(()=>C.readGameWindow(fakePopup,urls.plays,'plays',()=>true),/cancelled/);
 await assert.rejects(()=>C.readGameWindow({...fakePopup,document:{readyState:'complete',body:{innerText:'Loading'}}},urls.plays,'plays',()=>false,[],{timeout:8,poll:1}),/Timed out reading Plays/);
 const calls=[],bundle=await C.captureBoth(box.source_url,async(url,kind)=>{calls.push(kind);return {url,text:header+(kind==='plays'?C.extractPlays(plays):'Box score'),data:kind==='box'?box:undefined};});
 assert.deepEqual(calls,['plays','box']);assert.equal(bundle.source_event_id,box.source_event_id);assert.equal(bundle.detected.date,'2026-10-25');
 const raw=C.formatCombined(bundle,{date:'2026-10-25',time:'10:00',timezone:'ET'}),saved=JSON.parse(raw);assert.equal(saved.detected,undefined);assert.equal(saved.box_score.timezone,'ET');assert(saved.plays.includes('PLAY-BY-PLAY'));assert.equal(saved.plays.includes('Back to Schedule'),false);
 const input={name:'gamechanger-game-2026-10-25.json',raw},expanded=I.expandInputs([input]);assert.equal(expanded.inputs.length,1);assert.equal(expanded.options.boxInputs.length,1);assert.equal(expanded.options.bundleInputs.length,1);
 assert.match(JSON.parse(C.formatCombined(bundle,{date:'2026-10-25',assignTo:['black','orange']})).plays,/Assign to: black, orange/);
 const suggested={...bundle,detected:{...bundle.detected,needsYearConfirmation:true}};assert.throws(()=>C.formatCombined(suggested,{date:'2026-10-25'}),/Confirm/);
 assert.doesNotThrow(()=>C.formatCombined(suggested,{date:'2026-10-25',yearConfirmed:true}));
 const limited=structuredClone(bundle);limited.box_score.teams.forEach(t=>t.tables=[]);limited.box_score.warnings=['Notes only; table unavailable'];
 const limitedCaptured=await C.captureBoth(box.source_url,async(url,kind)=>({url,text:header+(kind==='plays'?plays:''),data:kind==='box'?limited.box_score:undefined}));assert(limitedCaptured.warnings.some(w=>w.includes('Notes only')));
 await assert.rejects(()=>C.captureBoth(box.source_url,async(url,kind)=>({url:kind==='box'?url.replace(box.source_event_id,'other'):url,text:header+plays,data:box})),/redirected/);
 await assert.rejects(()=>C.captureBoth(box.source_url,async(url,kind)=>({url,text:(kind==='box'?header.replace('10:00','11:00'):header)+plays,data:box})),/disagree on time/);
 const wrongTeams=structuredClone(box);wrongTeams.teams[0].name='Wrong team';await assert.rejects(()=>C.captureBoth(box.source_url,async(url,kind)=>({url,text:header+plays,data:wrongTeams})),/team names/);
 const wrong=structuredClone(saved);wrong.source_event_id='different';assert.throws(()=>I.expandInputs([{name:'wrong.json',raw:JSON.stringify(wrong)}]),/mismatched/);
 assert.throws(()=>I.expandInputs([{name:'broken.json',raw:'{broken'}]),/Invalid game capture/);
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'diamond-combined-'));
 try{
  fs.mkdirSync(path.join(folder,'data'));fs.writeFileSync(path.join(folder,'index.html'),fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script id="diamond-scout-core">[\s\S]*?<\/script>/)[0]);
  fs.writeFileSync(path.join(folder,'teams.json'),JSON.stringify({schema_version:1,teams:[{id:'seed',name:'Seed',data_file:'data/seed.json'}]}));fs.writeFileSync(path.join(folder,'data/seed.json'),JSON.stringify({schema_version:1,team:{id:'seed',name:'Seed'},players:[],games:[],plate_appearances:[]}));
  for (const team of C.inspectPlays(bundle.plays).teams) {
   const single={name:input.name,raw:C.formatCombined(bundle,{date:'2026-10-25',team})};
   const chosen=I.planImports(folder,[single]);
   assert.equal(chosen.changes.size,2,'Only selected history and manifest change');
   assert(chosen.report.every(r=>r.team===team),'Plays and box-score reconciliation honor selection');
   assert.equal(chosen.report.filter(r=>r.status==='added').length,1);
   assert.equal(P.inspectBatch(folder,[single],{preflight:true}).ready_for_import,true);
   assert(C.formatCapture({text:bundle.plays,url:bundle.plays_url,team}).includes('Import: only '+team));
  }
  assert.throws(()=>C.formatCombined(bundle,{team:'Missing team'}),/Choose a team/);
  const preflight=P.inspectBatch(folder,[input],{preflight:true});assert.equal(preflight.ready_for_import,true);assert(preflight.files[0].issues.some(i=>i.message.includes('Brian Gribbin TB')));
  const plan=I.planImports(folder,[input]);assert.equal(plan.changes.size,3);assert.equal(plan.inputs.length,3);I.writePlan(plan);
  const history=JSON.parse(fs.readFileSync(path.join(folder,'data/dig-in-gribbin-14u.json')));assert(history.games[0].box_score);assert.equal(history.games[0].timezone,'ET');assert.equal(history.plate_appearances.length,19);
  assert.equal(I.planImports(folder,[input]).changes.size,0);assert.equal(P.inspectBatch(folder,[input],{preflight:true}).summary.duplicates,1);
  assert.throws(()=>I.planImports(folder,[{name:'box.json',raw:JSON.stringify(box)}]),/Box-score-only/);
  const captures=path.join(folder,'captures');fs.mkdirSync(captures);fs.writeFileSync(path.join(captures,input.name),raw);fs.writeFileSync(path.join(captures,'unrelated.json'),'{}');assert.equal(P.collectInputs([captures]).length,1);
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
 console.log('PASS: sequential two-screen capture, year confirmation, metadata/team/event guards, partial warnings, combined JSON expansion, preflight, backed-up temporary writes, idempotency and folder discovery. Live capture-window compatibility remains unverified.');
})().catch(error=>{console.error(error);process.exitCode=1;});
