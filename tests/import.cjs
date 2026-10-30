'use strict';
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), os=require('node:os'), cp=require('node:child_process');
const I=require('../tools/import-plays.cjs');
const root=path.resolve(__dirname,'..'), D=I.loadCore(), temp=fs.mkdtempSync(path.join(os.tmpdir(),'diamond-import-test-'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script id="diamond-scout-core">[\s\S]*?<\/script>/)[0];
const oct=fs.readFileSync(path.join(root,'tests/fixtures/captures/2026-10-25-dig-in-bba-capture.txt'),'utf8');
const oct24=fs.readFileSync(path.join(root,'tests/fixtures/captures/2026-10-24-dig-in-fielders-choice-capture.txt'),'utf8');
const fontanaCapture=fs.readFileSync(path.join(root,'tests/fixtures/captures/2026-10-24-dig-in-stars-fontana-capture.txt'),'utf8');
const cyclonesCapture=fs.readFileSync(path.join(root,'tests/fixtures/captures/2026-10-18-dig-in-cyclones-capture.txt'),'utf8');
const dirtbagsCapture=fs.readFileSync(path.join(root,'tests/fixtures/captures/2026-10-18-dig-in-dirtbags-capture.txt'),'utf8');
const sep=fs.readFileSync(path.join(root,'tests/fixtures/captures/2026-09-12-shockers-stars.txt'),'utf8');
const shockers=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/teams/shockers-14u.json')));
const input=(raw,name='capture.txt')=>({raw,name});
let next=0;
function repo() {
  const folder=path.join(temp,String(++next)); fs.mkdirSync(path.join(folder,'data'),{recursive:true});
  fs.writeFileSync(path.join(folder,'index.html'),html);
  fs.writeFileSync(path.join(folder,'teams.json'),JSON.stringify({schema_version:1,teams:[{id:'seed',name:'Existing Team',data_file:'data/seed.json'}]}));
  fs.writeFileSync(path.join(folder,'data/seed.json'),JSON.stringify({schema_version:1,team:{id:'seed',name:'Existing Team'},players:[],games:[],plate_appearances:[]}));
  return folder;
}
function bytes(folder) {
  return Object.fromEntries(fs.readdirSync(folder,{recursive:true}).filter(file=>fs.statSync(path.join(folder,file)).isFile()).map(file=>[file,fs.readFileSync(path.join(folder,file)).toString('base64')]));
}
function capture(body,metadata='Date: 2026-10-01\nStart time: 10:00') {
  return metadata+'\nPLAY-BY-PLAY\n'+body;
}
const one='Top 1st - Falcons 14U\nSingle\nIn play.\nAlex Young singles on a line drive to center fielder Chris Smith.';
function parseTeam(raw,name) {
  const c=I.readCapture(raw), team={schema_version:1,team:{id:'test-team',name},players:[],games:[],plate_appearances:[]};
  const report=I.buildTeam(c,name,team,'test-game','Other team',D); return {c,team,report};
}
try {
  // Independently audited, existing source games: every listed pitch and contact classification.
  const regressions=[
    [sep,JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/teams/stars-camarata-14u.json'))),null],
    ...shockers.games.filter(g=>g.source_play_by_play).map(g=>[g.source_play_by_play,shockers,g.id]),
    [shockers.games.find(g=>g.id.includes('08-30')).source_play_by_play,JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/teams/gambrills-athletic-club-14u.json'))),null]
  ];
  for (const [source,old,gameId] of regressions) {
    const {team}=parseTeam(source,old.team.name), oldPas=old.plate_appearances.filter(p=>gameId?p.game_id===gameId:true);
    assert.equal(team.plate_appearances.length,oldPas.length,old.team.name);
    for (let i=0;i<oldPas.length;i++) {
      const a=team.plate_appearances[i],b=oldPas[i];
      assert.equal(a.source_text,b.source_text);
      assert.equal(a.result,b.result); assert.equal(a.status,b.status);
      assert.deepEqual(a.pitches,b.pitches,'Preserve every recorded pitch and known count');
      assert.deepEqual(a.batted_ball,b.batted_ball);
    }
    const oldGame=gameId||old.games[0].id;
    const oldRunning=D.baserunningSummary(old,{game:oldGame,batter:'all'}), running=D.baserunningSummary(team,{game:'all',batter:'all'});
    for(const field of ['attempts','stolen','onBase','attemptedVisits','unlinkedAttempts']) assert.equal(running[field],oldRunning[field],old.team.name+' '+field);
  }
  const dig=parseTeam(oct,'Dig In (Gribbin) 14U'),bba=parseTeam(oct,'BBA 14u East');
  assert.deepEqual([dig.report.counts.complete,dig.report.counts.pitches,dig.report.counts.fair_contacts,dig.report.counts.hits,dig.report.counts.steal_attempts,dig.report.counts.on_base_trips,dig.report.counts.trips_with_attempts],[19,76,13,3,4,8,3]);
  assert.deepEqual([bba.report.counts.complete,bba.report.counts.incomplete,bba.report.counts.pitches,bba.report.counts.fair_contacts,bba.report.counts.hits],[23,1,88,16,8]);
  assert.equal(bba.team.plate_appearances.filter(p=>p.inning===2).length,16);
  assert(dig.c.source.includes('\u00a0')); assert.equal(dig.team.games[0].source_play_by_play,dig.c.source);
  assert.equal(dig.team.games[0].start_time,'10:00'); assert.equal(dig.team.games[0].timezone,null);
  const ci=dig.team.plate_appearances.find(p=>p.result==='catchers_interference');
  assert.equal(ci.pitches.at(-1).outcome,'ball'); assert(ci.notes.some(n=>/conflicts/.test(n)));
  assert.equal(D.battingSummary([ci]).ab,0); assert.equal(D.onBaseStatus(ci),true);
  const tip=dig.team.plate_appearances.find(p=>p.result==='strikeout_foul_tip'); assert.equal(tip.pitches.at(-1).count_after.strikes,3);
  const dropped=dig.team.plate_appearances.find(p=>p.result==='dropped_third_strike'); assert.equal(dropped.reached_base,false);
  const declan=dig.team.baserunning_events.filter(e=>dig.team.players.find(p=>p.id===e.runner_id).name==='Declan Class');
  assert.equal(declan.length,2); assert.equal(declan[0].reach_pa_id,declan[1].reach_pa_id); assert.equal(declan[1].to_base,'home');

  // Real Oct 24 failure: a comma separates caught stealing from its defensive throw chain.
  const saale=parseTeam(oct24,'Dig In (Gribbin) 14U'),s=saale.report.counts;
  assert.deepEqual([s.complete,s.incomplete,s.pitches,s.fair_contacts,s.hits,s.steal_attempts,s.caught_stealing,s.on_base_trips,s.trips_with_attempts],[24,1,77,16,5,1,1,10,1]);
  assert.deepEqual([1,2,3,4,5,6].map(inning=>saale.team.plate_appearances.filter(p=>p.inning===inning).reduce((n,p)=>n+p.pitches.length,0)),[13,13,24,14,13,0]);
  const cs=saale.team.baserunning_events[0],sourcePA=saale.team.plate_appearances.find(p=>p.id===cs.source_pa_id),reachPA=saale.team.plate_appearances.find(p=>p.id===cs.reach_pa_id);
  assert.equal(saale.team.players.find(p=>p.id===cs.runner_id).name,'Wesley Hurt'); assert.equal(cs.to_base,'2B');
  assert.equal(reachPA.result,'single'); assert.equal(reachPA.inning,5); assert.equal(reachPA.batter_id,cs.runner_id);
  assert.equal(sourcePA.result,'dropped_third_strike'); assert.equal(sourcePA.reached_base,false); assert.equal(sourcePA.batted_ball,null);
  assert.deepEqual(sourcePA.pitches.map(p=>p.outcome),['swinging_strike','ball','called_strike','swinging_strike']);
  assert.deepEqual(sourcePA.pitches.map(p=>p.count_before),[{balls:0,strikes:0},{balls:0,strikes:1},{balls:1,strikes:1},{balls:1,strikes:2}]);
  assert.equal(cs.source_text,'Wesley Hurt caught stealing 2nd, catcher Gunnar Ronan to second baseman Atticus Johns');
  assert(saale.c.source.includes(cs.source_text)); assert.equal(saale.team.games[0].source_play_by_play,saale.c.source);
  assert(!saale.team.players.some(p=>/Gunnar Ronan|Atticus Johns/.test(p.name)),'Defensive participants do not become batting-team players');
  const selected24=I.planImports(repo(),[input(oct24)]); assert.equal(selected24.report.length,1); assert.equal(selected24.report[0].team,'Dig In (Gribbin) 14U');
  const opposing24=parseTeam(oct24,"Fielder's Choice Baseball 14U Saale");
  const buntOut=opposing24.team.plate_appearances.find(p=>p.source_text.startsWith('Jacob Bean bunts out'));
  assert.equal(buntOut.result,'ground_out'); assert.equal(buntOut.batted_ball.contact_type,'bunt'); assert.equal(buntOut.batted_ball.fielding_position,'P'); assert.equal(buntOut.pitches.length,2);

  // Real Stars Fontana capture: a balk and its advances do not add pitches or steal attempts.
  const fontana=parseTeam(fontanaCapture,'Stars Fontana 14U'),fontanaDig=parseTeam(fontanaCapture,'Dig In (Gribbin) 14U');
  for (const [parsed,expected] of [[fontana,[34,1,110,25,11,5]],[fontanaDig,[24,0,86,13,0,3]]]) {
    const n=parsed.report.counts;assert.deepEqual([n.complete,n.incomplete,n.pitches,n.fair_contacts,n.hits,n.steal_attempts],expected);
    assert.equal(parsed.team.games[0].source_play_by_play,parsed.c.source);
    // Independently classify only source-listed pitch tokens, leaving balk/advance text intact.
    for (const pa of parsed.team.plate_appearances) {
      const outcomes=(pa.source_pitch_sequence||'').replaceAll('\u00a0',' ').replace(/\.$/,'').split(/,\s*/).flatMap(token=>{
        if (/^Ball [1-4]$/.test(token))return ['ball'];if (/^Strike [1-3] looking$/.test(token))return ['called_strike'];if (/^Strike [1-3] swinging$/.test(token))return ['swinging_strike'];
        if (token==='Foul')return ['foul'];if (token==='Foul tip')return ['foul_tip'];if (token==='In play')return ['in_play'];return [];
      });assert.deepEqual(pa.pitches.map(p=>p.outcome),outcomes);
    }
  }
  const balkPA=fontana.team.plate_appearances.find(p=>p.source_text.startsWith('Emmitt Schilling triples'));
  assert.equal(balkPA.result,'triple');assert.equal(balkPA.pitches.length,1);assert.equal(balkPA.pitches[0].outcome,'in_play');
  assert.deepEqual(balkPA.pitches[0].count_before,{balls:0,strikes:0});assert.deepEqual(balkPA.pitches[0].count_after,{balls:0,strikes:0});
  assert(balkPA.source_pitch_sequence.includes('Balk by pitcher Declan Class'));assert(balkPA.source_pitch_sequence.includes('Ryder Delcore advances to 2nd'));
  assert(!fontana.team.baserunning_events.some(e=>e.source_pa_id===balkPA.id));assert(!fontana.team.players.some(p=>p.name==='Declan Class'));
  const withBalk='Balk by pitcher Declan Class, Ball 1, Strike 1 swinging, Balk by pitcher Declan Class, In play.';
  const balkSample=parseTeam(capture(one.replace('In play.',withBalk)),'Falcons 14U').team.plate_appearances[0];
  assert.equal(balkSample.source_pitch_sequence,withBalk);assert.deepEqual(balkSample.pitches.map(p=>p.outcome),['ball','swinging_strike','in_play']);
  assert.deepEqual(balkSample.pitches.at(-1).count_before,{balls:1,strikes:1});
  assert.equal(parseTeam(capture(one.replace('In play.','Balk, In play.')),'Falcons 14U').report.counts.pitches,1);

  // Real Cyclones capture: an unrecognized Batter Out heading previously swallowed the next PA.
  const cyclonesDig=parseTeam(cyclonesCapture,'Dig In (Gribbin) 14U'),cyclones=parseTeam(cyclonesCapture,'Central Maryland Cyclones Boyd 14U');
  for (const [parsed,expected,innings] of [[cyclonesDig,[34,1,127,20,1,9,8,1],[28,15,34,26,24,0]],[cyclones,[25,0,91,12,0,2,4,0],[15,15,17,21,23]]]) {
    const n=parsed.report.counts;
    assert.deepEqual([n.complete,n.incomplete,n.pitches,n.fair_contacts,n.foul_catches,n.hits,n.steal_attempts,n.unclassified_batting_results],expected);
    assert.deepEqual(innings.map((_,i)=>parsed.team.plate_appearances.filter(p=>p.inning===i+1).reduce((sum,p)=>sum+p.pitches.length,0)),innings);
    assert.equal(parsed.team.games[0].source_play_by_play,parsed.c.source);
    D.validateData(parsed.team);
  }
  const unspecified=cyclonesDig.team.plate_appearances.find(p=>p.result==='batter_out');
  assert.equal(unspecified.source_text,'Jack Wieland out (other),\u00a0Andres Tecua remains at 2nd,\u00a0Dean Simmons remains at 1st.');
  assert.equal(unspecified.inning,5);assert.equal(unspecified.status,'complete');assert.equal(unspecified.reached_base,false);
  assert.deepEqual(unspecified.pitches.map(p=>p.outcome),['called_strike','in_play']);assert.equal(unspecified.batted_ball,null);
  assert.equal(D.onBaseStatus(unspecified),false);assert(unspecified.notes.some(n=>/unresolved/.test(n)));
  const uncertainBatting=D.battingSummary(cyclonesDig.team.plate_appearances);assert.equal(uncertainBatting.unclassified,1);assert.equal(uncertainBatting.avg,null);assert.equal(uncertainBatting.obp,null);assert.equal(uncertainBatting.slg,null);
  const reachedThird=cyclonesDig.team.plate_appearances.find(p=>p.result==='dropped_third_strike');assert.equal(reachedThird.reached_base,true);assert.equal(D.onBaseStatus(reachedThird),true);assert.equal(reachedThird.batted_ball,null);
  const caughtFoul=cyclonesDig.team.plate_appearances.find(p=>p.foul_contact);assert.equal(caughtFoul.foul_contact.fielding_position,'1B');assert.equal(caughtFoul.foul_contact.location.zone,null);
  assert.equal(cyclones.report.counts.runner_only_outs,1);assert.equal(cyclones.report.counts.caught_stealing,1);assert.equal(cyclones.team.runner_outs[0].reason,'caught_stealing');
  const cyclonesRepo=repo(),cyclonesPlan=I.planImports(cyclonesRepo,[input(cyclonesCapture)]);assert.equal(cyclonesPlan.report.length,2);
  I.writePlan(cyclonesPlan);assert.equal(I.planImports(cyclonesRepo,[input(cyclonesCapture)]).changes.size,0,'Reimport does not duplicate generic outs or runner events');

  // Placed runners start a new on-base opportunity, without a PA, hit, pitch or automatic steal.
  const dirtDig=parseTeam(dirtbagsCapture,'Dig In (Gribbin) 14U'),dirt=parseTeam(dirtbagsCapture,'SBGC Dirtbags Mid-Atlantic 14U');
  for(const [parsed,expected]of [[dirtDig,[29,1,98,18,0,7,7,14,4]],[dirt,[31,0,113,17,1,3,1,14,1]]]){
    const n=parsed.report.counts;assert.deepEqual([n.complete,n.incomplete,n.pitches,n.fair_contacts,n.foul_catches,n.hits,n.steal_attempts,n.on_base_trips,n.runner_entries],expected);
    assert.equal(n.unlinked_attempts,0);assert.equal(parsed.team.games[0].source_play_by_play,parsed.c.source);D.validateData(parsed.team);
    const placements=parsed.team.baserunning_entries.filter(e=>e.entry_type==='placed_runner');assert.equal(placements.length,1);assert.equal(placements[0].placed_base,'2B');assert.equal(placements[0].replaced_runner_id,null);assert.equal(placements[0].reach_pa_id,undefined);
    const entryPA=parsed.team.plate_appearances.find(p=>p.id===placements[0].source_pa_id);assert.equal(entryPA.inning,7);assert(entryPA.source_pitch_sequence.includes(placements[0].source_text));
  }
  const placed=dirtDig.team.baserunning_entries.find(e=>e.entry_type==='placed_runner'),placedAttempt=dirtDig.team.baserunning_events.find(e=>e.runner_entry_id===placed.id);
  assert.equal(placed.source_text,'Deven Downs gets placed on 2nd');assert.equal(placedAttempt.to_base,'3B');assert.equal(placedAttempt.reach_pa_id,undefined);
  const placedSourcePA=dirtDig.team.plate_appearances.find(p=>p.id===placed.source_pa_id);assert.equal(placedSourcePA.batter_id,'test-team-brian-gribbin');assert.equal(placedSourcePA.result,'single');assert.deepEqual(placedSourcePA.pitches.map(p=>p.outcome),['ball','in_play']);
  const devenRunning=D.baserunningSummary(dirtDig.team,{batter:placed.runner_id,game:'all'});assert.equal(devenRunning.onBase,4);assert.equal(devenRunning.attemptedVisits,3);assert.equal(devenRunning.stealTendency,.75);
  assert.equal(D.baserunningSummary(dirtDig.team,{batter:'all',game:'all'}).stealTendency,.5);
  const intentional=dirt.team.plate_appearances.find(p=>p.source_text.startsWith('William Wright is intentionally walked'));
  assert.equal(intentional.result,'walk');assert.equal(intentional.pitches.length,1);assert.equal(intentional.pitches[0].outcome,'ball');assert.equal(intentional.pitches[0].count_after.balls,1);assert.equal(D.battingSummary([intentional]).walks,1);assert(intentional.notes.some(n=>/Intentional walk award/.test(n)));
  const replacedPlaced=parseTeam(capture(one.replace('In play.','Riley Lane gets placed on 2nd, Pinch runner Other Runner in for Riley Lane, Other Runner steals 3rd, In play.')),'Falcons 14U');
  assert.equal(replacedPlaced.report.counts.on_base_trips,2,'Placed trip plus the actual batter single; replacement does not add another team trip');
  const replacement=replacedPlaced.team.baserunning_entries[1];assert.equal(replacement.replaced_entry_id,replacedPlaced.team.baserunning_entries[0].id);
  const replacementSummary=D.baserunningSummary(replacedPlaced.team,{game:'all',batter:replacement.runner_id});assert.equal(replacementSummary.onBase,1);assert.equal(replacementSummary.stealTendency,1);
  for(const change of [e=>{e.placed_base='home'},e=>{e.replaced_runner_id=e.runner_id},e=>{e.reach_pa_id=placedSourcePA.id},e=>{e.replaced_entry_id=e.id},e=>{e.source_pa_id='missing'},e=>{e.inning=6}]){
    const invalid=JSON.parse(JSON.stringify(dirtDig.team));change(invalid.baserunning_entries.find(e=>e.id===placed.id));assert.throws(()=>D.validateData(invalid),/baserunning entry/);
  }
  const invalidParent=JSON.parse(JSON.stringify(replacedPlaced.team));invalidParent.baserunning_entries[1].replaced_entry_id=invalidParent.baserunning_entries[1].id;assert.throws(()=>D.validateData(invalidParent),/predecessor/);
  const earlyAttempt=JSON.parse(JSON.stringify(dirtDig.team));earlyAttempt.baserunning_events.find(e=>e.id===placedAttempt.id).source_pa_id=earlyAttempt.plate_appearances.find(p=>p.inning===6).id;assert.throws(()=>D.validateData(earlyAttempt),/baserunning visit entry/);
  const dirtRepo=repo(),dirtPlan=I.planImports(dirtRepo,[input(dirtbagsCapture)]);I.writePlan(dirtPlan);assert.equal(I.planImports(dirtRepo,[input(dirtbagsCapture)]).changes.size,0);

  // A preview is read-only. A batch write registers both teams and keeps existing bytes intact.
  const folder=repo(),before=bytes(folder), plan=I.planImports(folder,[input(oct)]);
  assert.deepEqual(bytes(folder),before); assert.equal(plan.report.length,2); assert.equal(plan.changes.size,3);
  const backup=I.writePlan(plan); assert(backup); assert.deepEqual(fs.readFileSync(path.join(folder,'data/seed.json')).toString('base64'),before['data/seed.json']);
  const manifest=JSON.parse(fs.readFileSync(path.join(folder,'teams.json')));
  assert.deepEqual(manifest.teams.map(t=>t.id),['seed','bba-14u-east','dig-in-gribbin-14u']);
  for(const entry of manifest.teams) D.validateData(JSON.parse(fs.readFileSync(path.join(folder,entry.data_file))));
  assert(fs.readFileSync(path.join(backup,'before/teams.json')).equals(Buffer.from(before['teams.json'],'base64')));
  const snapshot=bytes(folder),again=I.planImports(folder,[input(oct.replaceAll('\u00a0',' '))]);
  assert.equal(again.changes.size,0); assert(again.report.every(r=>r.status==='duplicate'));
  assert.equal(I.writePlan(again),null); assert.deepEqual(bytes(folder),snapshot);
  const batch=I.planImports(repo(),[input(oct),input(oct)]); assert.deepEqual(batch.report.map(r=>r.status),['added','added','duplicate','duplicate']);

  const emptyRepo=repo(), eventMeta='Date: 2026-10-01\nStart time: 10:00\nSource: https://web.gc.com/teams/test/schedule/event-empty/plays';
  const fullEmpty=capture('Top 2nd - Falcons 14U\nAlex Young at bat\n'+one,eventMeta);
  I.writePlan(I.planImports(emptyRepo,[input(fullEmpty)]));
  const emptySnapshot=bytes(emptyRepo);
  const omitted=I.planImports(emptyRepo,[input(capture(one,eventMeta))]);
  assert.equal(omitted.changes.size,0); assert.equal(omitted.report[0].status,'duplicate');
  assert.match(omitted.report[0].warnings[0],/unfinished appearance/);
  assert.deepEqual(bytes(emptyRepo),emptySnapshot);
  assert.throws(()=>I.planImports(emptyRepo,[input(capture(one.replace('center fielder','left fielder'),eventMeta))]),/overlap/);
  assert.throws(()=>I.planImports(emptyRepo,[input(capture(one))]),/overlap/);

  // Real histories: exact reimport preserves IDs and every existing byte; partial overlap stops.
  const real=repo();
  for (const teamId of ['shockers-14u','stars-camarata-14u']) fs.copyFileSync(path.join(root,'tests/fixtures/teams',teamId+'.json'),path.join(real,'data',teamId+'.json'));
  fs.writeFileSync(path.join(real,'teams.json'),JSON.stringify({schema_version:1,teams:['shockers-14u','stars-camarata-14u'].map(id=>({id,name:id==='shockers-14u'?'Shockers 14U':'Stars Camarata 14U',data_file:'data/'+id+'.json'}))}));
  const unchanged=bytes(real), duplicate=I.planImports(real,[input(sep)],{date:'2026-09-12',time:'08:30'});
  assert.equal(duplicate.changes.size,0); assert.deepEqual(bytes(real),unchanged);
  assert.throws(()=>I.planImports(real,[input(sep.replace('Foul, Foul, Ball 1','Foul, Ball 1'))],{date:'2026-09-12',time:'08:30'}),/overlap/);

  // Same-day rematches with different sources/start times append to the SAME team file.
  const first=I.planImports(folder,[input(capture(one))]); I.writePlan(first);
  const falconsBefore=JSON.parse(fs.readFileSync(path.join(folder,'data/falcons-14u.json'))),oldIds=falconsBefore.plate_appearances.map(p=>p.id);
  const second=I.planImports(folder,[input(capture(one.replace('center fielder','right fielder'),'Date: 2026-10-01\nStart time: 12:00'))]); I.writePlan(second);
  const falcons=JSON.parse(fs.readFileSync(path.join(folder,'data/falcons-14u.json')));
  assert.equal(falcons.games.length,2); assert.equal(falcons.players.length,1); assert.deepEqual(falcons.plate_appearances.slice(0,1).map(p=>p.id),oldIds);
  assert.throws(()=>I.planImports(folder,[input(capture(one.replace('center fielder','left fielder')))]),/overlap/);
  assert.throws(()=>I.planImports(folder,[input(capture(one,'Date: 2026-10-02\nStart time: 10:00'))]),/conflicting date/);
  assert.throws(()=>I.planImports(folder,[input(capture(one,'Date: 2026-02-30'))]),/real YYYY/);

  // Foul catches have their own denominator; broad/deep/line/gap areas never invent a fielder.
  const foul=parseTeam(capture('Top 1st - Falcons 14U\nFoul Out\nFoul, In play.\nAlex Young pops out to catcher Sam Day in foul territory.'),'Falcons 14U');
  const fp=foul.team.plate_appearances[0]; assert.equal(fp.batted_ball,null); assert.equal(fp.foul_contact.fielding_position,'C'); assert.equal(fp.foul_contact.location.zone,null); assert.equal(fp.pitches.at(-1).outcome,'foul_out');
  assert.equal(foul.report.counts.fair_contacts,0); assert.equal(foul.report.counts.foul_catches,1);
  const area=parseTeam(capture(one.replace('to center fielder Chris Smith','into deep left-center field')),'Falcons 14U').team.plate_appearances[0].batted_ball;
  assert.equal(area.fielding_position,null); assert.equal(area.location.zone,'left_center'); assert.equal(area.location.depth,'deep');
  const broad=parseTeam(capture(one),'Falcons 14U').team.plate_appearances[0].batted_ball;
  assert.equal(broad.location.precision,'fielder_zone'); assert.equal(broad.location.depth,null);

  // Identical PA descriptions in one game remain separate. Explicit oldest-first is supported.
  const repeated=one+'\nSingle\nIn play.\nAlex Young singles on a line drive to center fielder Chris Smith.';
  assert.equal(parseTeam(capture(repeated),'Falcons 14U').team.plate_appearances.length,2);
  const oldOrder=capture(one+'\nBottom 1st - Owls 14U\nWalk\nBall 1, Ball 2, Ball 3, Ball 4.\nPat Day walks, Sam Lee pitching.');
  assert.throws(()=>I.readCapture(oldOrder),/order/);
  assert.equal(I.planImports(repo(),[input(oldOrder)],{order:'oldest-first'}).report.length,2);
  const only=I.planImports(repo(),[input(oct)],{team:'Dig In (Gribbin) 14U'}); assert.equal(only.report.length,1); assert(only.changes.has('data/dig-in-gribbin-14u.json'));
  assert.throws(()=>I.planImports(repo(),[input(oct)],{team:'Missing team'}),/not found/);
  assert.equal(I.readCapture('Import: only BBA 14u East\n'+oct.replace('Import: both teams (default)\n','')).onlyTeam,'BBA 14u East');
  const aliasRepo=repo(),aliases={'Falcons 14U':'seed'};
  const mapped=I.planImports(aliasRepo,[input(capture(one))],{aliases}); assert(mapped.changes.has('data/seed.json')); assert(!mapped.changes.has('teams.json'));

  // Counts from truncated or contradictory sequences stay unknown; never fabricate pitches.
  for(const [date,inning,expectedOuts,expectedPitches,attemptText]of [['2026-09-24',3,2,6,'Cole Miller caught stealing 3rd'],['2026-10-06',4,1,2,'Hank Bambling scores on steal of home'],['2026-10-13',3,1,2,'Tyler Caiozzo steals 2nd']]){
    const raw=fs.readFileSync(path.join(root,'tests/fixtures/captures',date+'-fallprep-capture.txt'),'utf8'),parsed=parseTeam(raw,'FallPrep JV 2026 15U');
    const events=parsed.team.runner_outs.filter(o=>o.inning===inning);assert.equal(events.length,expectedOuts);
    assert.equal(events.reduce((sum,o)=>sum+(o.pitches?.length||0),0),expectedPitches,'Shared runner-out pitches counted exactly once');
    const attempts=parsed.team.baserunning_events.filter(e=>e.inning===inning&&e.source_text.startsWith(attemptText));assert.equal(attempts.length,1,'Each explicit attempt occurs once');assert(attempts[0].reach_pa_id||attempts[0].runner_entry_id);
    assert(!parsed.team.baserunning_events.some(e=>e.source_text.includes('picked off')));
    if(date==='2026-09-24'){assert.equal(events[0].reason,'caught_stealing');assert.equal(events[1].reason,'picked_off');assert(parsed.team.players.find(p=>p.id===events[0].runner_id).name==='Cole Miller');assert(parsed.team.players.find(p=>p.id===events[1].runner_id).name==='Hank Bambling');}
    if(date==='2026-10-06')assert.equal(attempts[0].to_base,'home');
    D.validateData(parsed.team);
  }
  const editedCapture=fs.readFileSync(path.join(root,'tests/fixtures/captures/2026-10-04-dig-in-royals-capture.txt'),'utf8');
  const edited=parseTeam(editedCapture,'Dig In (Gribbin) 14U');
  assert.equal(edited.team.games[0].source_control_events.length,1);assert(edited.team.games[0].source_control_events[0].source_events.includes('Half-inning ended by scorekeeper.'));
  const editPA=edited.team.plate_appearances.find(p=>p.source_pitch_sequence?.includes('(Play Edit)'));assert(editPA);assert.equal(editPA.result,'single');assert.equal(editPA.pitches.length,4);
  assert(editPA.source_pitch_sequence.includes('(Play Edit) Quinn Kasprzak in for Declan Class'));assert.equal(edited.team.players.find(p=>p.id===editPA.batter_id).name,'Joe Carey');
  assert(edited.team.baserunning_entries.some(e=>e.unresolved_trip===true));assert.equal(D.baserunningSummary(edited.team,{batter:'all',game:'all'}).onBase,null);
  const oneFielderOut=edited.team.runner_outs.find(o=>o.reason==='caught_stealing');assert(oneFielderOut);assert.equal(oneFielderOut.pitches.length,1);assert.equal(oneFielderOut.pitches[0].outcome,'ball');
  assert(edited.team.baserunning_events.some(e=>e.source_text.includes('Declan Class caught stealing 2nd, second baseman Auden Curley')));
  assert(!edited.team.players.some(p=>p.name==='Auden Curley'));
  const editedOpponent=parseTeam(editedCapture,'In The Dirt Royals 14U');assert.equal(editedOpponent.team.games[0].source_control_events.length,1);
  for(const [sourceFile,teamName,runnerPitchCount] of [['2026-10-10-1400-capture.txt','Wow Factor Premier',4],['2026-10-17-1445-capture.txt','Dig In (Gribbin) 14U',1]]){
    const raw=fs.readFileSync(path.join(root,'tests/fixtures/captures',sourceFile),'utf8'),parsed=parseTeam(raw,teamName);
    assert.equal(parsed.report.counts.runner_only_pitches,runnerPitchCount);
    const outs=parsed.team.runner_outs.filter(o=>o.pitches?.length);assert.equal(outs.length,1);assert.equal(outs[0].reason,'picked_off');assert.equal(outs[0].batter_id,null);
    assert.equal(outs[0].pitches.length,runnerPitchCount);assert.equal(parsed.report.counts.pitches,parsed.team.plate_appearances.reduce((n,p)=>n+p.pitches.length,0)+runnerPitchCount);
    const combined=D.pitchSummary(parsed.team.plate_appearances,outs.flatMap(o=>o.pitches));assert.equal(combined.n,parsed.report.counts.pitches);assert.equal(combined.knownFirst,D.pitchSummary(parsed.team.plate_appearances).knownFirst);
    assert(!parsed.team.baserunning_events.some(e=>e.source_text.includes('picked off')),'Pickoffs never become steal attempts');
    assert(raw.includes(outs[0].source_pitch_sequence));
  }
  const vsa=parseTeam(fs.readFileSync(path.join(root,'tests/fixtures/captures/2026-10-17-1445-capture.txt'),'utf8'),'VSA Select DMV 14U');
  const suffixRunner=vsa.team.players.find(p=>p.name==='Christopher Belcher, Jr.');assert(suffixRunner);assert(!vsa.team.players.some(p=>p.name==='Jr.'));
  const suffixSteal=vsa.team.baserunning_events.find(e=>e.runner_id===suffixRunner.id);assert(suffixSteal);assert.equal(suffixSteal.to_base,'2B');assert(suffixSteal.reach_pa_id);
  const changedOuts=vsa.team.plate_appearances.find(p=>p.source_pitch_sequence?.includes('Outs changed to 2'));assert(changedOuts);assert.deepEqual(changedOuts.pitches.map(p=>p.outcome),['ball','ball','ball','called_strike','foul','in_play']);assert(changedOuts.pitches.every(p=>p.count_before!==null));
  const count=parseTeam(capture(one.replace('In play.','Strike 2 looking, Foul, In play.')),'Falcons 14U');
  assert.equal(count.report.counts.pitches,3); assert(count.team.plate_appearances[0].pitches.every(p=>p.count_before===null&&p.count_after===null));
  const partialTip=parseTeam(capture('Top 1st - Falcons 14U\nStrikeout\nFoul tip.\nAlex Young is out on foul tip, Sam Lee pitching.'),'Falcons 14U');
  assert.equal(partialTip.report.counts.pitches,1); assert.equal(partialTip.team.plate_appearances[0].pitches[0].count_before,null);
  const unknown=I.readCapture(one); assert.equal(unknown.date,null); assert.equal(unknown.time,null);
  assert.equal(I.readCapture(capture(one,'Date: unknown\nStart time: 12:00 AM\nTimezone: ET')).time,'00:00');
  assert.equal(I.readCapture(capture(one,'Start time: 12:00 PM')).time,'12:00');
  assert.equal(I.readCapture(capture(one,'Source: https://user:secret@web.gc.com/x?token=private#secret')).url,'https://web.gc.com/x');
  const crlf=capture(one).replaceAll('\n','\r\n'); assert(I.readCapture(crlf).source.includes('\r\n'));
  const attempts=capture('Top 1st - Falcons 14U\nStrikeout\nPat Day attempts to steal 3rd, Strike 1 looking, Strike 2 looking, Strike 3 looking.\nMax Lane strikes out looking, Sam Lee pitching.\nSingle\nAlex Young is caught stealing 2nd, In play.\nPat Day singles on a ground ball to shortstop Chris Smith.\nSingle\nIn play.\nAlex Young singles on a ground ball to center fielder Chris Smith.');
  const running=parseTeam(attempts,'Falcons 14U');
  assert.equal(running.report.counts.steal_attempts,2); assert.equal(running.report.counts.caught_stealing,1); assert.equal(running.report.counts.unknown_attempts,1); assert.equal(running.report.counts.trips_with_attempts,2); assert.equal(running.report.counts.unlinked_attempts,0);
  const missingTrip=parseTeam(capture(one.replace('In play.','Other Runner steals 2nd, In play.')),'Falcons 14U');
  assert.equal(missingTrip.report.counts.unlinked_attempts,1); assert.equal(missingTrip.report.counts.trips_with_attempts,null);
  const standalone=capture('Top 1st - Falcons 14U\nCaught Stealing\n1 Out\nAlex Young caught stealing 2nd.\nSingle\nIn play.\nAlex Young singles on a ground ball to left fielder Chris Smith.');
  const stand=parseTeam(standalone,'Falcons 14U'); assert.equal(stand.report.counts.plate_appearances,1); assert.equal(stand.report.counts.caught_stealing,1); assert.equal(stand.report.counts.runner_only_outs,1); assert.equal(stand.report.counts.trips_with_attempts,1);

  // Unsupported input stops the entire batch and preserves every prior file.
  const badRepo=repo(),badBefore=bytes(badRepo);
  for (const bad of [one+'\nHome\nSettings',one.replace('In play.','Foul bunt, In play.'),one.replace('Single','Error'),one.replace('singles','teleports'),one+'\nTop 1st - Falcons 14U\n'+one.split('\n').slice(1).join('\n')]) {
    assert.throws(()=>I.planImports(badRepo,[input(oct),input(capture(bad))])); assert.deepEqual(bytes(badRepo),badBefore);
  }
  assert.throws(()=>I.planImports(badRepo,[input(capture(one.replace('Single','Batter Out')))]),/conflicts/,'Recognizing Batter Out does not accept a contradictory result description');
  assert.throws(()=>I.planImports(badRepo,[input(capture(one.replace('In play.','Alex Young steals second, In play.')))]),/Unrecognized steal/);
  assert.throws(()=>I.planImports(badRepo,[input(capture(one.replace('In play.','Balk by catcher Unknown, In play.')))]),/Unsupported pitch\/context token/);
  assert.throws(()=>I.planImports(badRepo,[input(capture(one.replace('In play.','Riley Lane gets placed on home, In play.')))]),/Unsupported pitch\/context token/);
  assert.throws(()=>I.planImports(badRepo,[input(capture(one.replace('In play.','Riley Lane gets placed on 2nd, Riley Lane gets placed on 2nd, In play.')))]),/active trip/);
  for (const pitchText of ['catcher Gunnar Ronan to second baseman Atticus Johns, In play.','Other Runner caught stealing 2nd, Ball 1, catcher Gunnar Ronan to second baseman Atticus Johns, In play.','Other Runner caught stealing 2nd, catcher Gunnar Ronan to mystery position Atticus Johns, In play.']) {
    assert.throws(()=>I.planImports(badRepo,[input(capture(one.replace('In play.',pitchText)))]),/Unsupported pitch\/context token/,'Only an immediately attached valid throw chain is accepted');
  }
  const collision=one+'\nSingle\nIn play.\nAlex-Young singles on a fly ball to left fielder Chris Smith.';
  assert.throws(()=>I.planImports(badRepo,[input(capture(collision))]),/collision/);

  // Failed replacements roll back; a changed source file or concurrent importer is rejected.
  const io=repo(),ioPlan=I.planImports(io,[input(oct)]),ioBefore=bytes(io),rename=fs.renameSync;
  let calls=0;
  fs.renameSync=(...args)=>{ if (++calls===2) throw Error('simulated disk failure'); return rename(...args); };
  try { assert.throws(()=>I.writePlan(ioPlan),/original data restored/); } finally { fs.renameSync=rename; }
  assert.equal(fs.readFileSync(path.join(io,'teams.json')).toString('base64'),ioBefore['teams.json']);
  assert(!fs.existsSync(path.join(io,'data/bba-14u-east.json'))); assert(!fs.existsSync(path.join(io,'.import-plays.lock')));
  const stale=repo(),stalePlan=I.planImports(stale,[input(oct)]); fs.appendFileSync(path.join(stale,'teams.json'),'\n'); assert.throws(()=>I.writePlan(stalePlan),/changed during import/);
  const locked=repo(),lockedPlan=I.planImports(locked,[input(oct)]); fs.writeFileSync(path.join(locked,'.import-plays.lock'),'test'); assert.throws(()=>I.writePlan(lockedPlan),/Another import/);
  const linked=repo(); fs.symlinkSync(path.join(temp,'external.json'),path.join(linked,'data/falcons-14u.json')); assert.throws(()=>I.planImports(linked,[input(capture(one))]),/symlink|Unregistered/);

  const help=cp.spawnSync(process.execPath,[path.join(root,'tools/import-plays.cjs'),'--help'],{cwd:temp,encoding:'utf8'}); assert.equal(help.status,0); assert.match(help.stdout,/Preview is the default/);
  const rejected=cp.spawnSync(process.execPath,[path.join(root,'tools/import-plays.cjs'),'--typo'],{encoding:'utf8'}); assert.equal(rejected.status,1); assert.match(rejected.stderr,/Unknown option/);
  console.log('PASS: real-game source/pitch/contact reconciliation, both-team batch imports, trip links, uncommon results, dry-run, duplicates, rematches, aliases, schema validation, backups, rollback and malformed-input rejection. All writes were confined to temporary test projects.');
} finally { fs.rmSync(temp,{recursive:true,force:true}); }
