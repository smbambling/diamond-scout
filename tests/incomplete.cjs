'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const I=require('../tools/import-plays.cjs'),D=I.loadCore();
function convert(raw,name){const capture=I.readCapture(raw),data={schema_version:1,team:{id:'fixture',name},players:[],games:[],plate_appearances:[]};I.buildTeam(capture,name,data,'fixture-game','Opponent',D);D.validateData(data);return data;}
const raw=fs.readFileSync(path.join(__dirname,'fixtures/captures/2026-08-29-tigers-vols-capture.txt'),'utf8');
const vols=convert(raw,'Virginia Vols Nelson 14U'),liam=vols.players.find(p=>p.name==='Liam Clark'),pa=vols.plate_appearances.find(p=>p.batter_id===liam.id&&p.status==='incomplete');
assert(pa);assert.equal(pa.result,'unknown');assert.equal(pa.batted_ball,null);
assert.deepEqual(pa.pitches.map(p=>p.outcome),['ball','ball']);assert.deepEqual(pa.pitches.map(p=>p.count_before),[{balls:0,strikes:0},{balls:1,strikes:0}]);
assert.equal(pa.source_pitch_sequence,'Ball 1,\u00a0Ball 2.');assert.equal(pa.source_text,'Liam Clark at bat');
assert.equal(vols.plate_appearances.length,31);assert.equal(D.pitchSummary(vols.plate_appearances).n,117);assert.equal(D.battingSummary(vols.plate_appearances).complete,30);assert.equal(D.summarize(vols.plate_appearances).n,15);
const tigers=convert(raw,'Rawlings Tigers NOVA - Black 14U');assert.equal(tigers.plate_appearances.length,24);assert.equal(D.pitchSummary(tigers.plate_appearances).n,107);
const synthetic='Top 1st - Falcons\nAlex Young at bat\nBall 1, Sam Lane steals 2nd, Ball 2.\nSingle\nIn play.\nSam Lane singles on a ground ball to shortstop Pat Day.';
const context=convert(synthetic,'Falcons'),attempt=context.baserunning_events[0];assert.equal(attempt.result,'stolen_base');assert(attempt.reach_pa_id);assert(attempt.source_pa_id);assert.equal(context.plate_appearances.find(p=>p.id===attempt.source_pa_id).status,'incomplete');
const empty=convert('Top 1st - Falcons\nAlex Young at bat','Falcons');assert.equal(empty.plate_appearances[0].pitches.length,0);assert.equal(empty.plate_appearances[0].source_pitch_sequence,null);
assert.throws(()=>convert('Top 1st - Falcons\nAlex Young at bat\nUnrecognized pitch.','Falcons'),/Unsupported pitch\/context token/);
const diagnostic=[];const invalid=I.readCapture('Top 1st - Falcons\nAlex Young at bat\nMystery pitch, Ball 1.');I.parseBlock(invalid.blocks[0],diagnostic);assert(diagnostic.some(d=>d.token==='Mystery pitch'));
console.log('PASS: incomplete PA pitches, source preservation, runner context, both-team totals, empty at-bats and strict unknown-token/preflight diagnostics.');
