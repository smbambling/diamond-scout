'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const I=require('../tools/import-plays.cjs'),D=I.loadCore(),root=path.resolve(__dirname,'..');
const raw=fs.readFileSync(path.join(__dirname,'fixtures/captures/2026-09-20-tigers-arlington-capture.txt'),'utf8');
function convert(gameId){const data={schema_version:1,team:{id:'arlington',name:'Arlington United 14U Regional'},players:[],games:[],plate_appearances:[]};I.buildTeam(I.readCapture(raw),data.team.name,data,gameId,'Tigers',D);D.validateData(data);return data;}
const data=convert('fixture-game'),unknown=data.players.filter(p=>p.identity_status==='unidentified');
assert.equal(unknown.length,4);assert.equal(new Set(unknown.map(p=>p.id)).size,4);
const batters=unknown.filter(p=>p.name.startsWith('Unidentified batter'));assert.equal(batters.length,3);
const anonymous=data.plate_appearances.filter(p=>batters.some(b=>b.id===p.batter_id));
assert.deepEqual(anonymous.map(p=>p.result),['fielders_choice','hit_by_pitch','strikeout_looking']);
for(const p of anonymous){assert(raw.includes(p.source_text));assert(raw.includes(p.source_pitch_sequence));assert(p.pitches.length>0);}
assert(anonymous.find(p=>p.result==='fielders_choice').source_text.startsWith('grounds into'));
assert.equal(data.plate_appearances.length,38);assert.equal(D.battingSummary(data.plate_appearances).complete,37);
assert.equal(D.pitchSummary(data.plate_appearances).n,137);assert.equal(D.summarize(data.plate_appearances).n,21);
const attempt=data.baserunning_events.find(e=>e.source_text==='steals 2nd');assert(attempt);assert.equal(attempt.result,'stolen_base');assert.equal(attempt.to_base,'2B');assert.equal(attempt.reach_pa_id,undefined);assert.equal(attempt.runner_entry_id,undefined);
assert(unknown.some(p=>p.id===attempt.runner_id));assert(!anonymous.some(p=>p.batter_id===attempt.runner_id));
const summary=D.baserunningSummary(data);assert.equal(summary.attempts,15);assert.equal(summary.unlinkedAttempts,1);assert.equal(summary.stealTendency,null);
const rematch=convert('same-day-rematch');assert(!rematch.players.filter(p=>p.identity_status==='unidentified').some(p=>unknown.some(q=>q.id===p.id||q.name===p.name)),'Unknown records must not merge across games');
assert.throws(()=>convertBad('Top 1st - Falcons\nSingle\nIn play.\nteleports to first.'),/Expected exactly one batter-result/);
assert.throws(()=>convertBad('Top 1st - Falcons\nWalk\nIn play.\nsingles on a ground ball to shortstop.'),/conflicts with the batter description/);
function convertBad(source){const d={schema_version:1,team:{id:'falcons',name:'Falcons'},players:[],games:[],plate_appearances:[]};I.buildTeam(I.readCapture(source),'Falcons',d,'bad','Opponent',D);}
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'diamond-unidentified-'));
try{
 fs.mkdirSync(path.join(folder,'data'));fs.writeFileSync(path.join(folder,'index.html'),fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script id="diamond-scout-core">[\s\S]*?<\/script>/)[0]);
 fs.writeFileSync(path.join(folder,'teams.json'),JSON.stringify({schema_version:1,teams:[{id:'seed',name:'Seed',data_file:'data/seed.json'}]}));
 fs.writeFileSync(path.join(folder,'data/seed.json'),JSON.stringify({schema_version:1,team:{id:'seed',name:'Seed'},players:[],games:[],plate_appearances:[]}));
 const input=[{name:'capture.txt',raw}],plan=I.planImports(folder,input);assert.equal(plan.changes.size,3);
 I.writePlan(plan);const manifest=JSON.parse(fs.readFileSync(path.join(folder,'teams.json')));
 for(const t of manifest.teams)D.validateData(JSON.parse(fs.readFileSync(path.join(folder,t.data_file))));
 const repeated=I.planImports(folder,input);assert.equal(repeated.changes.size,0,'Repeat import must not duplicate unknown appearances or attempts');
}finally{fs.rmSync(folder,{recursive:true,force:true});}
console.log('PASS: unnamed batter/runner preservation, distinct unknown identities, exact source/pitch/contact totals, unknown trip withholding, strict malformed-input checks and duplicate-safe writes in a temporary project.');
