'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),I=require('../tools/import-plays.cjs'),D=I.loadCore();
const capture=I.readCapture(fs.readFileSync(path.join(__dirname,'fixtures/captures/2026-10-17-1445-capture.txt'),'utf8'));
const team={schema_version:1,team:{id:'dig-in-gribbin-14u',name:'Dig In (Gribbin) 14U'},players:[],games:[],plate_appearances:[]};
I.buildTeam(capture,team.team.name,team,'regression','VSA Select DMV 14U',D);
D.validateData(team);
assert(!team.players.some(p=>/Ball 1|picked off|Courtesy runner/.test(p.name)),'Runner context must not become a player');
const andres=team.baserunning_entries.filter(e=>e.inning===6&&e.runner_id.endsWith('-andres-tecua'));
assert.equal(andres.length,1,'The courtesy entry must be counted once');
assert(andres[0].replaced_runner_id.endsWith('-dean-simmons'));assert(andres[0].reach_pa_id);
assert.equal(D.baserunningSummary(team).unlinkedAttempts,0);
const ambiguous=JSON.parse(JSON.stringify(team));
ambiguous.baserunning_entries.push({id:'unresolved-entry',game_id:'regression',inning:7,half:'bottom',runner_id:andres[0].runner_id,replaced_runner_id:andres[0].replaced_runner_id,entry_type:'courtesy_runner',source_text:'Synthetic conflicting substitution',unresolved_trip:true});
D.validateData(ambiguous);
assert.equal(D.baserunningSummary(ambiguous).stealTendency,null,'An unresolved opportunity must not yield a guessed percentage');
assert.equal(D.baserunningSummary(ambiguous,{batter:'dig-in-gribbin-14u-deven-downs',game:'all'}).unknownOnBase,0,'One runner conflict must not affect another player');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'teams.json')));D.validateManifest(manifest);
for(const entry of manifest.teams){const current=JSON.parse(fs.readFileSync(path.join(root,entry.data_file)));D.validateData(current);const s=D.baserunningSummary(current);assert(s.stealTendency===null||(s.stealTendency>=0&&s.stealTendency<=1));
 for(const game of current.games)for(const correction of game.data_corrections||[]){
  if(correction.id!=='confirmed-declan-class-seventh-inning-trip')continue;
  const reach=current.plate_appearances.find(p=>p.id===correction.reach_pa_id),attempt=current.baserunning_events.find(e=>e.id===correction.attempt_id);
  assert.equal(reach.result,'single');assert.equal(attempt.result,'caught_stealing');assert.equal(attempt.to_base,'2B');
  assert.equal(attempt.runner_id,reach.batter_id);assert.equal(attempt.reach_pa_id,reach.id);assert.equal(attempt.runner_entry_id,undefined);
  assert(!current.baserunning_entries.some(e=>e.id===correction.original_entry.id));
  assert(game.source_play_by_play.includes(correction.original_entry.source_text),'Conflicting original annotation remains preserved');
  const summary=D.baserunningSummary(current,{batter:attempt.runner_id,game:game.id});assert.equal(summary.unknownOnBase,0);assert.equal(summary.unlinkedAttempts,0);
 }
}
assert(fs.readFileSync(path.join(root,'index.html'),'utf8').includes("running.onBase===null?'Trip data needs review'"));
console.log('PASS: compound runner context, unique courtesy trips, unresolved-opportunity withholding, unaffected players and current team validation.');
