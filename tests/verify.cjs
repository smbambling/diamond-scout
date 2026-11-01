'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const core=html.match(/<script id="diamond-scout-core">([\s\S]*?)<\/script>/)[1];
const app=html.match(/<script id="diamond-scout-app">([\s\S]*?)<\/script>/)[1];
const ctx=vm.createContext({});vm.runInContext(core,ctx);new vm.Script(app);const D=ctx.DiamondScout;
// Check the fixed Navy & Ice colors for text/control contrast.
const tokens=selector=>Object.fromEntries([...html.match(selector)[1].matchAll(/--([\w-]+):([^;}]+)/g)].map(([,k,v])=>[k,v]));
const light=tokens(/:root\{([^}]+)\}/);
function luminance(hex){const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return rgb.reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);}
function contrast(a,b){const [hi,lo]=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (hi+.05)/(lo+.05);}
for(const foreground of ['text','secondary','muted'])for(const background of ['panel','bg','raised','control','hover'])assert(contrast(light[foreground],light[background])>=4.5,foreground+' on '+background+' must remain readable');
assert(contrast(light.text,light.panel)>=7);assert(contrast(light.secondary,light.panel)>=7);
assert(contrast(light['selected-text'],light['selected-bg'])>=4.5);assert(contrast(light['on-accent'],light.accent)>=4.5);
assert(contrast(light.error,light.raised)>=4.5);assert(contrast(light['control-border'],light.control)>=3);
assert.equal(light.bg,'#F4F6F8');assert.equal(light.panel,'#FFFFFF');assert.equal(light.accent,'#0052CC');
const heatBands=['none','low','mid','warm','hot'];
const fieldNatural=['#DDE5ED','#88B594','#D9BC68','#E69759','#DA6860'];
assert.deepEqual(heatBands.map(b=>light['heat-'+b]),fieldNatural);
for(const palette of [light]){
 assert(contrast(palette['marker-empty-text'],palette['heat-none'])>=4.5);
 for(const band of heatBands.slice(1))assert(contrast(palette['marker-text'],palette['heat-'+band])>=4.5,'Readable marker text on '+band);
}
assert.equal(new Set(fieldNatural).size,5,'Keep all five heat bands distinct');
for(const palette of [light])assert(contrast(palette['map-label-text'],palette['map-label-bg'])>=7,'Map label colors must contrast');
const repositoryHistory=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/shockers-four-games.json'))),manifest=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/teams.json')));
const september12='2026-09-12-0830-shockers-vs-stars-camarata';
const history={...repositoryHistory,games:repositoryHistory.games.filter(g=>g.id!==september12),plate_appearances:repositoryHistory.plate_appearances.filter(p=>p.game_id!==september12),baserunning_events:repositoryHistory.baserunning_events.filter(e=>e.game_id!==september12),baserunning_entries:repositoryHistory.baserunning_entries.filter(e=>e.game_id!==september12),runner_outs:[]};
const originalPAs=history.plate_appearances.filter(p=>p.game_id==='supplied-game-001');
const originalPlayers=new Set(originalPAs.map(p=>p.batter_id));
const data={...history,baserunning_events:[],baserunning_entries:[],runner_outs:[],games:history.games.filter(g=>g.id==='supplied-game-001'),players:history.players.filter(p=>originalPlayers.has(p.id)),plate_appearances:originalPAs};
D.validateData(history);
// Every manifest entry resolves to a validated, separate team file.
for(const entry of manifest.teams){const teamData=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/teams',path.basename(entry.data_file))));D.validateData(teamData);assert.equal(teamData.team.id,entry.id);}
const gambrillsEntry=manifest.teams.find(t=>t.id==='gambrills-athletic-club-14u');assert(gambrillsEntry);assert.equal(manifest.teams[0].id,'shockers-14u');
const gambrills=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/teams',path.basename(gambrillsEntry.data_file)))),gambrillsGame=gambrills.games[0],gambrillsPAs=gambrills.plate_appearances;
assert.equal(gambrills.games.length,1);assert.equal(gambrills.players.length,11);assert.equal(gambrillsGame.date,'2026-08-30');assert.equal(gambrillsGame.start_time,'10:00');assert.equal(gambrillsGame.timezone,null);assert.equal(gambrillsGame.batting_half,'top');assert.equal(gambrillsGame.opponent,'Shockers 14U');
assert.equal(gambrillsPAs.length,27);assert(gambrillsPAs.every(p=>p.status==='complete'&&p.half==='top'));assert.equal(D.pitchSummary(gambrillsPAs).n,81);assert.equal(D.summarize(gambrillsPAs).n,21);assert.equal(D.summarize(gambrillsPAs).hits,9);assert.equal(D.foulSummary(gambrillsPAs).n,0);
assert.deepEqual([1,2,3,4,5].map(i=>gambrillsPAs.filter(p=>p.inning===i).reduce((n,p)=>n+p.pitches.length,0)),[21,11,12,11,26]);
assert.deepEqual(JSON.parse(JSON.stringify(D.summarize(gambrillsPAs).counts)),{LF:3,CF:4,RF:5,'3B':1,SS:6,P:1,'2B':1,'1B':0,C:0});
assert.equal(gambrillsGame.source_play_by_play,history.games.find(g=>g.id==='2026-08-30-1000-shockers-vs-gambrills').source_play_by_play);assert.equal(require('node:crypto').createHash('sha256').update(gambrillsGame.source_play_by_play).digest('hex'),gambrillsGame.source_sha256);
assert.equal(manifest.teams.filter(t=>t.id===gambrills.team.id).length,1);
assert(gambrills.players.every(player=>player.id.startsWith(gambrills.team.id+'-')));assert(gambrillsPAs.every(pa=>!history.plate_appearances.some(p=>p.id===pa.id)));
for(const pa of gambrillsPAs){
 assert(gambrillsGame.source_play_by_play.includes(pa.source_text));assert(gambrillsGame.source_play_by_play.includes(pa.source_pitch_sequence));
 const outcomes=pa.source_pitch_sequence.replace(/\.$/,'').split(', ').flatMap(t=>{
  if(/^Ball [1-4]$/.test(t))return ['ball'];if(/^Strike [1-3] looking$/.test(t))return ['called_strike'];if(/^Strike [1-3] swinging$/.test(t))return ['swinging_strike'];if(t==='Foul')return ['foul'];if(t==='In play')return ['in_play'];return [];
 });assert.deepEqual(pa.pitches.map(p=>p.outcome),outcomes,'Gambrills pitch/event sequence: '+pa.id);
}
const gambrillsHBP=gambrillsPAs.find(p=>p.result==='hit_by_pitch');assert.equal(gambrillsHBP.pitches.length,2);assert(gambrillsHBP.pitches.every(p=>p.outcome==='ball'));
const gambrillsDP=gambrillsPAs.find(p=>p.result==='double_play');assert.match(gambrillsDP.source_text,/lines into a double play/);assert.equal(gambrillsDP.batted_ball.contact_type,'line_drive');assert.equal(gambrillsDP.batted_ball.fielding_position,'SS');
const gambrillsRunning=D.baserunningSummary(gambrills,{batter:'all',game:'all'});assert.equal(gambrillsRunning.attempts,2);assert.equal(gambrillsRunning.stolen,2);assert.equal(gambrillsRunning.onBase,15);assert.equal(gambrillsRunning.attemptsPerGame,2);
for(const event of gambrillsRunning.events){const pa=gambrillsPAs.find(p=>p.id===event.source_pa_id);assert(pa.source_pitch_sequence.includes(event.source_text));assert.notEqual(pa.batter_id,event.runner_id);assert.equal(event.to_base,'2B');}
// Both teams in the September 12 source remain separate, with original regressions above/below.
const stars=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/teams/stars-camarata-14u.json'))),starsGame=stars.games[0];
const sep12Game=repositoryHistory.games.find(g=>g.id===september12),sep12=D.filter(repositoryHistory,{batter:'all',game:september12});
D.validateData(repositoryHistory);D.validateData(stars);
assert.equal(sep12Game.date,'2026-09-12');assert.equal(sep12Game.start_time,'08:30');assert.equal(sep12Game.timezone,null);assert.equal(D.gameWhen(sep12Game),'2026-09-12 · 8:30 AM');
assert.equal(sep12Game.source_play_by_play,fs.readFileSync(path.join(root,'tests/fixtures/captures/2026-09-12-shockers-stars.txt'),'utf8').trim());assert.equal(starsGame.source_play_by_play,sep12Game.source_play_by_play);
assert.equal(stars.players.length,11);assert.equal(stars.games.length,1);assert.equal(starsGame.batting_half,'bottom');assert.equal(starsGame.date,sep12Game.date);assert.equal(starsGame.start_time,sep12Game.start_time);
for(const [teamData,pas,expected,byInning] of [[repositoryHistory,sep12,[33,32,90,22,7,4,20],[12,8,26,8,18,18,0]],[stars,stars.plate_appearances,[27,27,107,20,5,3,11],[12,21,18,15,20,21,0]]]){
 const game=teamData===stars?starsGame:sep12Game,state={batter:'all',game:game.id},running=D.baserunningSummary(teamData,state);
 assert.deepEqual([pas.length,pas.filter(p=>p.status==='complete').length,D.pitchSummary(pas).n,D.summarize(pas).n,D.summarize(pas).hits,running.attempts,running.onBase],expected);
 assert.equal(require('node:crypto').createHash('sha256').update(game.source_play_by_play).digest('hex'),game.source_sha256);
 assert.deepEqual([1,2,3,4,5,6,7].map(i=>pas.filter(p=>p.inning===i).reduce((n,p)=>n+p.pitches.length,0)),byInning);
 for(const pa of pas.filter(p=>p.status==='complete')){
  assert(game.source_play_by_play.includes(pa.source_text));assert(game.source_play_by_play.includes(pa.source_pitch_sequence));
  const outcomes=pa.source_pitch_sequence.replace(/\.$/,'').split(', ').flatMap(t=>{
   if(/^Ball [1-4]$/.test(t))return ['ball'];if(/^Strike [1-3] looking$/.test(t))return ['called_strike'];if(/^Strike [1-3] swinging$/.test(t))return ['swinging_strike'];if(t==='Foul')return ['foul'];if(t==='In play')return ['in_play'];return [];
  });assert.deepEqual(pa.pitches.map(p=>p.outcome),outcomes,'September 12 pitch order: '+pa.id);
 }
 assert.equal(pas.flatMap(p=>p.pitches).filter(p=>p.outcome==='hit_by_pitch').length,0,'No HBP terminal pitches may be invented');assert.equal(D.foulSummary(pas).n,0);
}
assert.deepEqual(JSON.parse(JSON.stringify(D.summarize(stars.plate_appearances).counts)),{LF:3,CF:5,RF:0,'3B':5,SS:2,P:2,'2B':0,'1B':2,C:1});
assert.equal(sep12.filter(p=>p.result==='hit_by_pitch').length,5);assert.equal(stars.plate_appearances.filter(p=>p.result==='hit_by_pitch').length,1);
assert.equal(sep12.at(-1).status,'incomplete');assert.equal(sep12.at(-1).batter_id,'shockers-14u-logan-sumrow');assert.equal(sep12.at(-1).pitches.length,0);
const fcdp=sep12.find(p=>p.result==='fielders_choice_double_play');assert(fcdp);assert.equal(fcdp.batted_ball.fielding_position,'CF');assert.equal(fcdp.batted_ball.contact_type,'ground_ball');assert.equal(D.battingSummary([fcdp]).ab,1);assert.equal(D.battingSummary([fcdp]).hits,0);assert.equal(D.onBaseStatus(fcdp),true);assert.equal(D.summarize([fcdp]).n,1);assert.equal(D.battingSummary([fcdp]).unclassified,0);
const buntFC=sep12.find(p=>p.result==='fielders_choice'&&p.batted_ball.contact_type==='bunt');assert(buntFC);assert.equal(buntFC.batted_ball.fielding_position,'P');
const catcher=stars.plate_appearances.find(p=>p.batted_ball?.fielding_position==='C');assert(catcher);assert.equal(catcher.result,'pop_out');assert.equal(D.summarize([catcher]).unknown,0);assert.equal(D.summarize([catcher]).middle,1);assert.match(D.fieldSvg([catcher]),/data-position="C"/);assert.match(D.fieldSvg([catcher]),/viewBox="0 0 600 470"/);assert.equal((D.fieldSvg([catcher]).match(/class="fielder-marker"/g)||[]).length,9);
assert.equal(stars.runner_outs.length,1);assert.equal(stars.runner_outs[0].reason,'offensive_interference');assert.equal(stars.runner_outs[0].runner_id,'stars-camarata-14u-mark-trey-poncy');assert(starsGame.source_play_by_play.includes(stars.runner_outs[0].source_text));
assert.equal(stars.baserunning_entries.length,1);assert.equal(stars.baserunning_entries[0].runner_id,'stars-camarata-14u-logan-pinkerton');assert.equal(D.baserunningSummary(stars,{batter:'stars-camarata-14u-logan-pinkerton',game:'all'}).onBase,2,'Own single plus courtesy trip');
assert.equal(repositoryHistory.plate_appearances.length,127);assert.equal(D.battingSummary(repositoryHistory.plate_appearances).complete,124);assert.equal(D.pitchSummary(repositoryHistory.plate_appearances).n,426);assert.equal(D.summarize(repositoryHistory.plate_appearances).n,83);assert.equal(D.summarize(repositoryHistory.plate_appearances).hits,30);assert.equal(D.baserunningSummary(repositoryHistory,{batter:'all',game:'all'}).onBase,70);assert.equal(D.baserunningSummary(repositoryHistory,{batter:'all',game:'all'}).attempts,12);
const originalSnapshot=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/shockers-before-sep12-2026.json')));
for(const key of ['games','players','plate_appearances','baserunning_events','baserunning_entries']){
 const prior=repositoryHistory[key].slice(0,originalSnapshot[key].length);
 // Visit links annotate existing attempts; all earlier source fields stay unchanged.
 const withoutLinks=key==='baserunning_events'?prior.map(({reach_pa_id,runner_entry_id,...event})=>event):prior;
 assert.deepEqual(withoutLinks,originalSnapshot[key],key+' must preserve pre-import source records');
}
const invalidOut=JSON.parse(JSON.stringify(stars));invalidOut.runner_outs[0].runner_id='missing';assert.throws(()=>D.validateData(invalidOut),/runner out/);
const duplicateOut=JSON.parse(JSON.stringify(stars));duplicateOut.runner_outs.push(duplicateOut.runner_outs[0]);assert.throws(()=>D.validateData(duplicateOut),/duplicate runner out/);
const runnerOnlyOut={...stars,plate_appearances:[],baserunning_events:[],baserunning_entries:[],runner_outs:[{...stars.runner_outs[0],reach_pa_id:null}]};assert.equal(D.baserunningSummary(runnerOnlyOut,{batter:stars.runner_outs[0].runner_id,game:'all'}).games,1);assert.equal(D.baserunningSummary(runnerOnlyOut,{batter:stars.runner_outs[0].runner_id,game:'all'}).onBase,0);
// October 25 loaded-text capture: preserve raw NBSPs, uncommon results and both teams.
// Target the original named game, so later imports do not alter its independent expectations.
function october25History(file){
 const full=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/teams',path.basename(file)))),game=full.games.find(g=>g.source_event_id==='bbd7b60b-a503-4abf-8dfe-91e7105aabc5');assert(game,'October 25 source game must remain available');
 const scoped={...full,games:[game]};for(const key of ['plate_appearances','baserunning_events','baserunning_entries','runner_outs'])scoped[key]=(full[key]||[]).filter(record=>record.game_id===game.id);
 const ids=new Set(scoped.plate_appearances.map(p=>p.batter_id));for(const record of [...scoped.baserunning_events,...scoped.baserunning_entries,...scoped.runner_outs]){ids.add(record.runner_id);if(record.replaced_runner_id)ids.add(record.replaced_runner_id);}scoped.players=full.players.filter(p=>ids.has(p.id));return scoped;
}
const dig=october25History('data/dig-in-gribbin-14u.json'),bba=october25History('data/bba-14u-east.json');
const captureOct25=fs.readFileSync(path.join(root,'tests/fixtures/captures/2026-10-25-dig-in-bba-capture.txt'),'utf8'),oct25Source=captureOct25.split('\nPLAY-BY-PLAY\n')[1].trim();
assert(oct25Source.includes('\u00a0'));assert.equal(dig.players.length,11);assert.equal(bba.players.length,12);
for(const [team,expected,inningPitches] of [[dig,[19,19,76,13,3,4,8,3],[26,9,28,13]],[bba,[24,23,88,16,8,0,15,0],[11,66,11,0]]]){
 D.validateData(team);const game=team.games[0],pas=team.plate_appearances,running=D.baserunningSummary(team,{batter:'all',game:'all'});
 assert.equal(team.games.length,1);assert.equal(game.date,'2026-10-25');assert.equal(game.start_time,'10:00');assert(game.timezone==null||typeof game.timezone==='string','Current game timezone may be explicitly corrected; original unknown capture metadata is checked by import.cjs');assert.equal(D.gameWhen(game),'2026-10-25 · 10:00 AM');assert.equal(game.source_event_id,'bbd7b60b-a503-4abf-8dfe-91e7105aabc5');assert.match(game.source_capture_coverage,/^loaded browser text only; completeness not verified\.?$/);assert.equal(game.source_play_by_play,oct25Source);assert.equal(require('node:crypto').createHash('sha256').update(oct25Source).digest('hex'),game.source_sha256);
 assert.deepEqual([pas.length,pas.filter(p=>p.status==='complete').length,D.pitchSummary(pas).n,D.summarize(pas).n,D.summarize(pas).hits,running.attempts,running.onBase,running.attemptedVisits],expected);
 assert.deepEqual([1,2,3,4].map(i=>pas.filter(p=>p.inning===i).reduce((n,p)=>n+p.pitches.length,0)),inningPitches);
 assert.equal(D.foulSummary(pas).n,0);assert.equal(D.summarize(pas).unknown,0);assert.equal(D.battingSummary(pas).unclassified,0);
 assert.equal(manifest.teams.filter(t=>t.id===team.team.id).length,1);
 for(const player of team.players)assert(pas.some(pa=>pa.batter_id===player.id),'No non-player text may become a roster entry');
 for(const pa of pas){assert(oct25Source.includes(pa.source_text));if(!pa.source_pitch_sequence)continue;assert(oct25Source.includes(pa.source_pitch_sequence));
  const tokens=pa.source_pitch_sequence.replace(/\u00a0/g,' ').replace(/\.$/,'').split(', '),outcomes=tokens.flatMap(t=>{
   if(/^Ball [1-4]$/.test(t))return ['ball'];if(/^Strike [1-3] looking$/.test(t))return ['called_strike'];if(/^Strike [1-3] swinging$/.test(t))return ['swinging_strike'];if(t==='Foul')return ['foul'];if(t==='Foul tip')return ['foul_tip'];if(t==='In play')return ['in_play'];return [];
  });assert.deepEqual(pa.pitches.map(p=>p.outcome),outcomes,'October pitch/event order: '+pa.id);
 }
}
assert.deepEqual(JSON.parse(JSON.stringify(D.summarize(dig.plate_appearances).counts)),{LF:2,CF:3,RF:1,'3B':0,SS:1,P:3,'2B':3,'1B':0,C:0});
assert.deepEqual(JSON.parse(JSON.stringify(D.summarize(bba.plate_appearances).counts)),{LF:3,CF:2,RF:2,'3B':1,SS:6,P:0,'2B':1,'1B':1,C:0});
const interference=dig.plate_appearances.find(p=>p.result==='catchers_interference');assert(interference);assert.equal(interference.batted_ball,null);assert.equal(interference.pitches.length,5);assert.equal(interference.pitches.at(-1).outcome,'ball');assert.equal(interference.pitches.at(-1).count_after.balls,4);assert.match(interference.notes[0],/Ball 4/);assert.equal(D.battingSummary([interference]).ab,0);assert.equal(D.battingSummary([interference]).walks,0);assert.equal(D.battingSummary([interference]).obp,null);assert.equal(D.onBaseStatus(interference),true);
const digBatting=D.battingSummary(dig.plate_appearances);assert.equal(digBatting.ab,16);assert.equal(digBatting.walks,2);assert.equal(digBatting.strikeouts,3);assert.equal(digBatting.obp,5/18);assert.equal(digBatting.avg,3/16);
const invalidInterference=JSON.parse(JSON.stringify(dig));invalidInterference.plate_appearances.find(p=>p.result==='catchers_interference').batted_ball=dig.plate_appearances.find(p=>p.batted_ball).batted_ball;assert.throws(()=>D.validateData(invalidInterference),/interference/);
const thirdStrike=dig.plate_appearances.find(p=>p.result==='dropped_third_strike');assert.equal(thirdStrike.reached_base,false);assert.equal(D.onBaseStatus(thirdStrike),false);assert.equal(thirdStrike.batted_ball,null);assert.equal(D.battingSummary([thirdStrike]).strikeouts,1);
const foulTip=dig.plate_appearances.find(p=>p.result==='strikeout_foul_tip');assert.equal(foulTip.pitches.at(-1).outcome,'foul_tip');assert.equal(foulTip.pitches.at(-1).count_before.strikes,2);assert.equal(foulTip.pitches.at(-1).count_after.strikes,3);assert.equal(foulTip.batted_ball,null);assert.equal(D.pitchSummary([foulTip]).outcomes.foul_tip,1);
const stealHome=dig.baserunning_events.find(e=>e.to_base==='home');assert(stealHome);assert.equal(stealHome.source_text,'Declan Class scores on steal of home');assert.equal(stealHome.reach_pa_id,dig.baserunning_events.find(e=>e.runner_id===stealHome.runner_id&&e.to_base==='2B').reach_pa_id);assert.equal(D.baserunningSummary(dig,{batter:stealHome.runner_id,game:'all'}).stealTendency,1);assert.equal(D.baserunningSummary(dig,{batter:'all',game:'all'}).stealTendency,3/8);
assert.equal(bba.plate_appearances.filter(p=>p.inning===2).length,16);assert.equal(bba.plate_appearances.at(-1).status,'incomplete');assert.equal(bba.plate_appearances.at(-1).batter_id,'bba-14u-east-ben-thorn');assert.equal(bba.plate_appearances.at(-1).pitches.length,0);
const bbaDP=bba.plate_appearances.find(p=>p.result==='double_play');assert.equal(bbaDP.batted_ball.contact_type,'fly_ball');assert.equal(bbaDP.batted_ball.fielding_position,'RF');assert.equal(D.summarize([bbaDP]).n,1);
assert.equal(bba.plate_appearances.filter(p=>p.batter_id==='bba-14u-east-liam-mcdermott').length,1);assert.equal(bba.baserunning_entries.length,0,'Batter substitution is not a courtesy-runner entry');
// Source-backed Aug 30 import; retain independent original-game regressions below.
const imported=history.games.find(g=>g.id==='2026-08-30-1000-shockers-vs-gambrills');
assert(imported);assert.equal(imported.date,'2026-08-30');assert.equal(imported.start_time,'10:00');assert.equal(imported.timezone,null);
assert.equal(D.gameWhen(imported),'2026-08-30 · 10:00 AM');
assert.equal(require('node:crypto').createHash('sha256').update(imported.source_play_by_play).digest('hex'),imported.source_sha256);
const added=D.filter(history,{batter:'all',game:imported.id});
assert.equal(added.length,35);assert.equal(added.filter(p=>p.status==='complete').length,34);
assert.equal(D.pitchSummary(added).n,129);assert.equal(D.summarize(added).n,16);assert.equal(D.summarize(added).hits,6);assert.equal(D.foulSummary(added).n,0);
assert.deepEqual([1,2,3,4,5].map(i=>added.filter(p=>p.inning===i).reduce((n,p)=>n+p.pitches.length,0)),[42,49,16,22,0]);
assert.equal(added.at(-1).status,'incomplete');assert.equal(added.at(-1).batter_id,'shockers-14u-kenyon-whitmore');assert.equal(added.at(-1).pitches.length,0);
assert.equal(added.filter(p=>p.result==='hit_by_pitch').length,3);
assert.equal(added.flatMap(p=>p.pitches).filter(p=>p.outcome==='hit_by_pitch').length,0,'Do not manufacture unlisted HBP terminal pitches');
assert.equal(added.filter(p=>p.result==='infield_fly').length,1);
for(const pa of added.filter(p=>p.status==='complete')){
 const outcomes=pa.source_pitch_sequence.replace(/\.$/,'').split(', ').flatMap(t=>{
  if(/^Ball [1-4]$/.test(t))return ['ball'];if(/^Strike [1-3] looking$/.test(t))return ['called_strike'];if(/^Strike [1-3] swinging$/.test(t))return ['swinging_strike'];if(t==='Foul')return ['foul'];if(t==='In play')return ['in_play'];return [];
 });
 assert.deepEqual(pa.pitches.map(p=>p.outcome),outcomes,'Preserve recorded pitch/event sequence: '+pa.id);
}
assert.equal(history.plate_appearances.length,94);assert.equal(D.pitchSummary(history.plate_appearances).complete,92);
assert.equal(D.pitchSummary(history.plate_appearances).n,336);assert.equal(D.summarize(history.plate_appearances).n,61);assert.equal(D.summarize(history.plate_appearances).hits,23);
assert.equal(history.players.filter(p=>p.id==='shockers-14u-kenyon-whitmore').length,1);
// Independent source-backed September 13 import checks.
const metro=history.games.find(g=>g.id==='2026-09-13-shockers-vs-metro-senators-central');
assert(metro);assert.equal(metro.date,'2026-09-13');assert.equal(metro.start_time,null);assert.equal(metro.timezone,null);
assert.equal(D.gameWhen(metro),'2026-09-13');
assert.equal(require('node:crypto').createHash('sha256').update(metro.source_play_by_play).digest('hex'),metro.source_sha256);
const metroPAs=D.filter(history,{batter:'all',game:metro.id});
assert.equal(metroPAs.length,33);assert.equal(metroPAs.filter(p=>p.status==='complete').length,32);
assert.equal(D.pitchSummary(metroPAs).n,103);assert.equal(D.summarize(metroPAs).n,26);assert.equal(D.summarize(metroPAs).hits,12);assert.equal(D.foulSummary(metroPAs).n,0);
assert.deepEqual([1,2,3,4,5,6].map(i=>metroPAs.filter(p=>p.inning===i).reduce((n,p)=>n+p.pitches.length,0)),[24,19,33,11,16,0]);
assert.deepEqual(JSON.parse(JSON.stringify(D.summarize(metroPAs).counts)),{LF:4,CF:7,RF:4,'3B':3,SS:5,P:1,'2B':0,'1B':2,C:0});
assert.equal(metroPAs.at(-1).status,'incomplete');assert.equal(metroPAs.at(-1).batter_id,'shockers-14u-logan-sumrow');assert.equal(metroPAs.at(-1).pitches.length,0);
assert.equal(metroPAs.filter(p=>p.result==='sacrifice_bunt').length,1);assert.equal(metroPAs.filter(p=>p.result==='sacrifice_fly').length,1);
const buntHit=metroPAs.find(p=>p.result==='single'&&p.batted_ball.contact_type==='bunt');assert(buntHit);assert.equal(buntHit.batted_ball.fielding_position,'3B');
const homer=metroPAs.find(p=>p.result==='home_run');assert.match(homer.source_text,/inside the park home run/);assert.equal(homer.batted_ball.fielding_position,'CF');
const loganMetro=D.battingSummary(metroPAs.filter(p=>p.batter_id==='shockers-14u-logan-sumrow'));
assert.equal(loganMetro.complete,2);assert.equal(loganMetro.incomplete,1);assert.equal(loganMetro.hits,2);assert.equal(loganMetro.slg,3);
for(const pa of metroPAs.filter(p=>p.status==='complete')){
 assert(metro.source_play_by_play.includes(pa.source_text));assert(metro.source_play_by_play.includes(pa.source_pitch_sequence));
 const outcomes=pa.source_pitch_sequence.replace(/\.$/,'').split(', ').flatMap(t=>{
  if(/^Ball [1-4]$/.test(t))return ['ball'];if(/^Strike [1-3] looking$/.test(t))return ['called_strike'];if(/^Strike [1-3] swinging$/.test(t))return ['swinging_strike'];if(t==='Foul')return ['foul'];if(t==='In play')return ['in_play'];return [];
 });
 assert.deepEqual(pa.pitches.map(p=>p.outcome),outcomes,'September pitch/event sequence: '+pa.id);
 assert.equal(pa.pitches.at(-1).outcome,pa.batted_ball?'in_play':pa.result==='walk'?'ball':'swinging_strike');
}
const metroRunning=D.baserunningSummary(history,{batter:'all',game:metro.id});assert.equal(metroRunning.attempts,5);assert.equal(metroRunning.stolen,5);assert.equal(metroRunning.caught,0);
assert.deepEqual(['jackson-zangrilli','logan-sumrow','bryce-ziegler','blake-weber'].map(name=>D.baserunningSummary(history,{batter:'shockers-14u-'+name,game:metro.id}).stolen),[2,1,1,1]);
for(const event of metroRunning.events){const pa=metroPAs.find(p=>p.id===event.source_pa_id);assert(pa.source_pitch_sequence.includes(event.source_text));assert.notEqual(pa.batter_id,event.runner_id);}
assert.equal(history.games.filter(g=>g.source_sha256===metro.source_sha256).length,1,'Identical attachment copies must import once');
// Runner events belong to the runner, even when another teammate is batting.
const running=D.baserunningSummary(history,{batter:'all',game:'all'});
assert.equal(running.attempts,8);assert.equal(running.stolen,8);assert.equal(running.caught,0);assert.equal(running.successRate,1);
for(const name of ['keaghan-galotta-withrow','jackson-zangrilli','bryce-ziegler']){
 const r=D.baserunningSummary(history,{batter:'shockers-14u-'+name,game:imported.id});
 assert.equal(r.attempts,1);assert.equal(r.stolen,1);
 const event=r.events[0],pa=history.plate_appearances.find(p=>p.id===event.source_pa_id);
 assert.notEqual(pa.batter_id,event.runner_id);assert(pa.source_pitch_sequence.includes(event.source_text));assert.equal(event.to_base,'2B');
}
assert.equal(D.baserunningSummary(history,{batter:'shockers-14u-nate-henson',game:'all'}).attempts,0);
assert.equal(D.baserunningSummary(history,{batter:'all',game:data.games[0].id}).successRate,null);
assert.equal(D.baserunningSummary(data,{batter:'all',game:'all'}).attempts,0);
const runningFixture=JSON.parse(JSON.stringify(history)),event=runningFixture.baserunning_events[0];
runningFixture.baserunning_events.push({...event,id:'synthetic-caught',result:'caught_stealing',source_text:'Synthetic caught stealing fixture.'});
D.validateData(runningFixture);
const mixed=D.baserunningSummary(runningFixture,{batter:event.runner_id,game:'all'});
assert.equal(mixed.attempts,2);assert.equal(mixed.caught,1);assert.equal(mixed.successRate,.5);
runningFixture.baserunning_events.push({...event,id:'synthetic-unknown',result:'unknown',to_base:null});
assert.equal(D.baserunningSummary(runningFixture,{batter:event.runner_id,game:'all'}).successRate,null);
for(const change of [e=>{e.runner_id='missing'},e=>{e.game_id='missing'},e=>{e.result='pickoff'},e=>{e.to_base='1B'},e=>{e.source_pa_id='missing'},e=>{e.source_text=''}]){
 const bad=JSON.parse(JSON.stringify(history));change(bad.baserunning_events[0]);assert.throws(()=>D.validateData(bad),/baserunning/);
}
const duplicateRunner=JSON.parse(JSON.stringify(history));duplicateRunner.baserunning_events.push(duplicateRunner.baserunning_events[0]);assert.throws(()=>D.validateData(duplicateRunner),/duplicate baserunning/);
// Attempt frequency uses reaches and participation, not successful-steal counts.
assert.equal(running.onBase,50);assert.equal(running.games,3);assert.equal(running.attemptsPerGame,8/3);assert.equal(running.attemptsPerOnBase,8/50);
assert.equal(metroRunning.onBase,18);assert.equal(metroRunning.games,1);
assert.equal(D.baserunningSummary(history,{batter:'all',game:imported.id}).onBase,23);
assert.equal(D.baserunningSummary(history,{batter:'shockers-14u-nate-henson',game:imported.id}).onBase,3,'Two batting reaches plus one courtesy entry');
const courtesy=history.baserunning_entries[0];assert.equal(history.baserunning_entries.length,1);
assert(history.plate_appearances.find(p=>p.id===courtesy.source_pa_id).source_pitch_sequence.includes(courtesy.source_text));
assert.equal(D.baserunningSummary(history,{batter:'shockers-14u-logan-sumrow',game:metro.id}).onBase,1,'Double counts; inside-the-park HR and incomplete PA do not');
const frequencyFixture={schema_version:1,team:{id:'frequency-team',name:'Synthetic frequency fixture'},players:[{id:'a',name:'Batter A'},{id:'r',name:'Runner R'}],games:[{id:'g1',opponent:'Synthetic opponent',date:null},{id:'g2',opponent:'Synthetic unused game',date:null}],plate_appearances:[
 {...originalPAs[0],id:'reach',game_id:'g1',batter_id:'a',result:'single',status:'complete',pitches:[],batted_ball:null},
 {...originalPAs[0],id:'hr',game_id:'g1',batter_id:'a',result:'home_run',status:'complete',pitches:[],batted_ball:null}],
 baserunning_entries:[{id:'courtesy',game_id:'g1',runner_id:'r',replaced_runner_id:'a',entry_type:'courtesy_runner',source_pa_id:'hr',reach_pa_id:'reach',source_text:'Synthetic runner replacement.'}],
 baserunning_events:[{id:'attempt1',game_id:'g1',runner_id:'a',result:'caught_stealing',to_base:'2B',source_text:'Synthetic caught-stealing attempt.'},{id:'attempt2',game_id:'g1',runner_id:'a',result:'unknown',to_base:null,source_text:'Synthetic attempt with no outcome.'},{id:'attempt3',game_id:'g1',runner_id:'r',result:'stolen_base',to_base:'3B',source_text:'Synthetic runner-only steal.'}]};
D.validateData(frequencyFixture);
const teamFrequency=D.baserunningSummary(frequencyFixture,{batter:'all',game:'all'});
assert.equal(teamFrequency.attempts,3);assert.equal(teamFrequency.onBase,1,'Replacement must not duplicate the team trip');assert.equal(teamFrequency.games,1,'Unused game does not count');assert.equal(teamFrequency.attemptsPerOnBase,3,'Multiple attempts on one trip can exceed one');
const runnerOnly=D.baserunningSummary(frequencyFixture,{batter:'r',game:'all'});assert.equal(runnerOnly.games,1);assert.equal(runnerOnly.onBase,1);assert.equal(runnerOnly.attemptsPerGame,1);
const batterFrequency=D.baserunningSummary(frequencyFixture,{batter:'a',game:'all'});assert.equal(batterFrequency.attempts,2);assert.equal(batterFrequency.onBase,1);assert.equal(batterFrequency.unknown,1);
const emptyFrequency=D.baserunningSummary(frequencyFixture,{batter:'a',game:'g2'});assert.equal(emptyFrequency.onBase,0);assert.equal(emptyFrequency.games,0);assert.equal(emptyFrequency.attemptsPerGame,null);assert.equal(emptyFrequency.attemptsPerOnBase,null);
for(const result of ['single','double','triple','walk','hit_by_pitch','reached_on_error','fielders_choice'])assert.equal(D.onBaseStatus({...originalPAs[0],result}),true,result);
for(const result of ['home_run','sacrifice_fly','sacrifice_bunt','double_play','ground_out','fly_out','strikeout_swinging','foul_out'])assert.equal(D.onBaseStatus({...originalPAs[0],result}),false,result);
assert.equal(D.onBaseStatus({...originalPAs[0],result:'single',status:'incomplete'}),false);
const ambiguousReach={...originalPAs[0],result:'dropped_third_strike'};assert.equal(D.onBaseStatus(ambiguousReach),null);assert.equal(D.onBaseStatus({...ambiguousReach,reached_base:true}),true);assert.equal(D.onBaseStatus({...ambiguousReach,reached_base:false}),false);
const uncertain=JSON.parse(JSON.stringify(frequencyFixture));uncertain.baserunning_entries=[];uncertain.plate_appearances[0].result='dropped_third_strike';
assert.equal(D.baserunningSummary(uncertain,{batter:'a',game:'all'}).onBase,null);assert.equal(D.baserunningSummary(uncertain,{batter:'a',game:'all'}).unknownOnBase,1);
uncertain.plate_appearances[0].reached_base=true;assert.equal(D.baserunningSummary(uncertain,{batter:'a',game:'all'}).onBase,1);
for(const change of [e=>{e.runner_id='missing'},e=>{e.replaced_runner_id=e.runner_id},e=>{e.game_id='missing'},e=>{e.source_pa_id='missing'},e=>{e.reach_pa_id='hr'},e=>{e.entry_type='steal'},e=>{e.source_text=''}]){
 const invalid=JSON.parse(JSON.stringify(frequencyFixture));change(invalid.baserunning_entries[0]);assert.throws(()=>D.validateData(invalid),/baserunning entry/);
}
const duplicateEntry=JSON.parse(JSON.stringify(frequencyFixture));duplicateEntry.baserunning_entries.push(duplicateEntry.baserunning_entries[0]);assert.throws(()=>D.validateData(duplicateEntry),/duplicate baserunning entry/);
// Steal tendency counts unique on-base trips with any attempt, never attempts per trip.
const currentTendency=D.baserunningSummary(repositoryHistory,{batter:'all',game:'all'});
assert.equal(currentTendency.attemptedVisits,11);assert.equal(currentTendency.unlinkedAttempts,0);assert.equal(currentTendency.stealTendency,11/70);
const jacksonMetro=D.baserunningSummary(repositoryHistory,{batter:'shockers-14u-jackson-zangrilli',game:metro.id});assert.equal(jacksonMetro.attempts,2);assert.equal(jacksonMetro.attemptedVisits,1);assert.equal(jacksonMetro.stealTendency,.5);
for(const team of [repositoryHistory,gambrills,stars])for(const event of team.baserunning_events){
 const reach=team.plate_appearances.find(p=>p.id===event.reach_pa_id),source=team.plate_appearances.find(p=>p.id===event.source_pa_id);
 assert.equal(reach.batter_id,event.runner_id);assert.equal(reach.game_id,event.game_id);assert.equal(reach.inning,source.inning);assert(reach.sequence<source.sequence);assert.equal(D.onBaseStatus(reach),true);assert(source.source_pitch_sequence.includes(event.source_text));
}
const linkedFixture=JSON.parse(JSON.stringify(frequencyFixture));linkedFixture.baserunning_events[0].reach_pa_id='reach';linkedFixture.baserunning_events[1].reach_pa_id='reach';linkedFixture.baserunning_events[2].runner_entry_id='courtesy';D.validateData(linkedFixture);
const linkedTeam=D.baserunningSummary(linkedFixture,{batter:'all',game:'all'});assert.equal(linkedTeam.attempts,3);assert.equal(linkedTeam.attemptedVisits,1);assert.equal(linkedTeam.stealTendency,1,'Three attempts on one team trip must remain 100%');
assert.equal(D.baserunningSummary(linkedFixture,{batter:'r',game:'all'}).stealTendency,1,'Replacement entry links establish their own player tendency');
const unlinkedFixture=JSON.parse(JSON.stringify(linkedFixture));delete unlinkedFixture.baserunning_events[0].reach_pa_id;assert.equal(D.baserunningSummary(unlinkedFixture,{batter:'all',game:'all'}).stealTendency,null);assert.equal(D.baserunningSummary(unlinkedFixture,{batter:'all',game:'all'}).unlinkedAttempts,1);
const noAttemptsFixture={...linkedFixture,baserunning_events:[]};assert.equal(D.baserunningSummary(noAttemptsFixture,{batter:'all',game:'all'}).stealTendency,0);assert.equal(D.baserunningSummary(noAttemptsFixture,{batter:'all',game:'g2'}).stealTendency,null);
for(const change of [e=>{e.reach_pa_id='hr'},e=>{e.reach_pa_id='missing'},e=>{e.runner_entry_id='courtesy'},e=>{e.reach_pa_id=null;e.runner_entry_id='missing'}]){
 const invalid=JSON.parse(JSON.stringify(linkedFixture));change(invalid.baserunning_events[0]);assert.throws(()=>D.validateData(invalid),/baserunning visit/);
}
// Scout cards use completed PAs for outcomes and explicit fielder evidence for readiness.
// Keep the prior two-game Blake sample as an independent regression.
const blakeAll=history.plate_appearances.filter(p=>p.game_id!=='2026-09-13-shockers-vs-metro-senators-central'&&p.batter_id.endsWith('blake-weber'));
const bs=D.battingSummary(blakeAll);
assert.equal(bs.complete,6);assert.equal(bs.ab,3);assert.equal(bs.hits,1);
assert.equal(bs.walks,2);assert.equal(bs.hbp,1);assert.equal(bs.avg,1/3);assert.equal(bs.obp,4/6);assert.equal(bs.slg,1/3);
assert.equal(bs.outcomes.reduce((n,o)=>n+o.count,0),6);
assert.equal(D.battingSummary(history.plate_appearances).complete,92);
assert.equal(D.battingSummary(history.plate_appearances).incomplete,2);
assert.equal(D.battingSummary(history.plate_appearances).strikeouts,12);
assert.match(D.readiness(blakeAll).lead,/No standout position/);
assert.equal(D.readiness(blakeAll).detail,'SS 1/3 · 2B 1/3 · 1B 1/3');
assert.equal(D.summarize(blakeAll,'ground_ball').n,2);
assert.equal(D.battingSummary(blakeAll).complete,6,'A map filter must not redefine the outcome denominator');
assert.equal(D.battingSummary([]).avg,null);assert.equal(D.battingSummary([]).obp,null);
const genericResult=JSON.parse(JSON.stringify(blakeAll[0]));genericResult.result='fair_contact';
assert.equal(D.battingSummary([genericResult]).unclassified,1);
assert.equal(D.battingSummary([genericResult]).avg,null);
const partialStats=D.battingSummary([blakeAll[0],genericResult]);
assert.equal(partialStats.complete,2);assert.equal(partialStats.unclassified,1);assert.equal(partialStats.avg,null,'Unknown full-selection average stays unknown');
assert.equal(partialStats.classified.complete,1);assert.equal(partialStats.classified.unclassified,0);
assert.equal(partialStats.classified.avg,D.battingSummary([blakeAll[0]]).avg,'Partial display has an explicitly separate classified denominator');
assert.equal(D.battingSummary([genericResult]).classified.complete,0);assert.equal(D.battingSummary([genericResult]).classified.avg,null);
const unknownStrikeout={...genericResult,result:'strikeout_unspecified'};assert.equal(D.battingSummary([blakeAll[0],unknownStrikeout]).classified.strikeouts,D.battingSummary([blakeAll[0]]).strikeouts,'An unknown result cannot leak into classified counts');
const sacrifice=JSON.parse(JSON.stringify(blakeAll[0]));sacrifice.result='sacrifice_fly';
const sacStats=D.battingSummary([blakeAll[0],sacrifice]);
assert.equal(sacStats.ab,1);assert.equal(sacStats.avg,1);assert.equal(sacStats.obp,.5);
// Same-day rematches remain distinct through game IDs and displayed start times.
const rematch=JSON.parse(JSON.stringify(history));rematch.games.push({...imported,id:'test-rematch',start_time:'12:00'});rematch.plate_appearances.push({...added[0],id:'test-rematch-pa',game_id:'test-rematch'});
D.validateData(rematch);assert.equal(D.filter(rematch,{batter:'all',game:imported.id}).length,35);assert.equal(D.filter(rematch,{batter:'all',game:'test-rematch'}).length,1);
assert.equal(D.gameWhen(rematch.games.at(-1)),'2026-08-30 · 12:00 PM');
rematch.games.at(-1).start_time='25:00';assert.throws(()=>D.validateData(rematch),/start_time/);
D.validateManifest(manifest);D.validateData(data);
for(const data_file of ['https://example.test/team.json','//example.test/team.json','/team.json','../team.json','data/../team.json','data/%2e%2e/team.json','data\\team.json','data/team.json?x=1','data/team.json#x']){
 const badManifest=JSON.parse(JSON.stringify(manifest));badManifest.teams[0].data_file=data_file;
 assert.throws(()=>D.validateManifest(badManifest),/relative files inside this project/);
}
assert.equal(manifest.teams[0].id,data.team.id);
assert.equal(data.games[0].date,null,'No game date should be invented');
assert.equal(data.plate_appearances.length,26);
const total=D.summarize(data.plate_appearances),pitch=D.pitchSummary(data.plate_appearances);
assert.equal(total.n,19);assert.equal(total.hits,5);
assert.deepEqual(JSON.parse(JSON.stringify(total.counts)),{LF:6,CF:3,RF:0,'3B':3,SS:3,P:1,'2B':1,'1B':2,C:0});
assert.equal(pitch.n,104);assert.equal(pitch.complete,26);assert.equal(pitch.pitchesPerPA,4);
assert.equal(Object.values(pitch.outcomes).reduce((a,b)=>a+b,0),104);
const state={batter:'shockers-14u-matthew-chernoff',game:'all'};
const matt=D.filter(data,state),ms=D.summarize(matt);
assert.equal(ms.n,3);assert.equal(ms.counts['3B'],2);assert.equal(ms.hits,0);
assert.equal(matt.filter(p=>p.result==='double_play').length,1,'Double play is one fair-contact event');
const reeve=D.summarize(D.filter(data,{batter:'shockers-14u-reeve-johnson',game:'all'}));assert.equal(reeve.n,2);assert.equal(reeve.counts.SS,2);
const owen=D.filter(data,{batter:'shockers-14u-owen-keeton',game:'all'});assert.equal(owen.length,2);assert.equal(D.summarize(owen).n,0);assert.match(D.fieldSvg(owen),/No fair contact/);
assert.equal(D.summarize(matt,'ground_ball').n,2);
assert.equal(D.filter(data,{batter:'all',game:'unknown'}).length,0);
assert.equal(D.pitchSummary([]).pitchesPerPA,null);assert.equal(D.pct(0,0),'—');
// Known foul sequences must retain a two-strike count, not accumulate a third.
const gluck=data.plate_appearances.find(p=>p.batter_id.endsWith('nathan-gluck')&&p.inning===3);
assert.equal(gluck.pitches[2].count_before.strikes,2);assert.equal(gluck.pitches[2].count_after.strikes,2);
assert.equal(gluck.pitches.at(-1).count_before.strikes,2);
// The first pitch can itself be fair contact; exclude unclassified first pitches.
const blake=data.plate_appearances[0];assert.equal(D.pitchSummary([blake]).firstSwings,1);
const incomplete=JSON.parse(JSON.stringify(blake));incomplete.status='incomplete';
assert.equal(D.pitchSummary([incomplete]).complete,0);
const missing=JSON.parse(JSON.stringify(blake));missing.pitches=[];assert.equal(D.pitchSummary([missing]).complete,0);
const unknown=JSON.parse(JSON.stringify(blake));unknown.pitches[0].outcome='unknown';assert.equal(D.pitchSummary([unknown]).knownFirst,0);
// More than one game must filter without combining distinct game IDs.
const second=JSON.parse(JSON.stringify(data));second.games.push({...second.games[0],id:'second-game'});second.plate_appearances.push({...second.plate_appearances[0],id:'new-pa',game_id:'second-game'});D.validateData(second);
assert.equal(D.filter(second,{batter:'all',game:'second-game'}).length,1);
// Explicit areas must not assign or replace the recorded fielder.
const detailed=JSON.parse(JSON.stringify(data));const b=detailed.plate_appearances[0].batted_ball;b.fielding_position='CF';b.location={zone:'left_field_line',depth:'deep',precision:'described_area'};D.validateData(detailed);
assert.equal(D.summarize(detailed.plate_appearances).counts.CF,total.counts.CF+1);
assert.equal(D.summarize(detailed.plate_appearances).counts.LF,total.counts.LF);
assert.equal(D.summarize(detailed.plate_appearances).detailed,1);
assert.equal(JSON.stringify(D.describedLocations(detailed.plate_appearances)),JSON.stringify([{zone:'left_field_line',depth:'deep',count:1}]));
assert.doesNotMatch(D.fieldSvg(detailed.plate_appearances),/stroke-dasharray|<path[^>]+fill="var\(--heat-/);
const unassigned=JSON.parse(JSON.stringify(detailed.plate_appearances[0]));unassigned.batted_ball.fielding_position=null;
assert.equal(D.summarize([unassigned]).unknown,1);assert.equal(D.summarize([unassigned]).counts.LF,0);
assert.equal(D.describedLocations([unassigned]).length,1);
// A legacy zone with no fielder must not manufacture a fielder assignment either.
const zoneOnly=JSON.parse(JSON.stringify(blake));zoneOnly.batted_ball.fielding_position=null;
assert.equal(D.summarize([zoneOnly]).unknown,1);
// Fixed, nonoverlapping symbols replace all data-colored field territories.
const markerSvg=D.fieldSvg(data.plate_appearances);
// Field artwork is a local asset, reused by every map.
assert.match(html,/id="natural-field-artwork"[^>]+href="assets\/field\.png\?v=[a-f0-9]+"/);
assert(fs.existsSync(path.join(root,'assets/field.png')));
assert.equal((html.match(/data:image\/png;base64,/g)||[]).length,0);
assert.match(markerSvg,/<use class="natural-field" href="#natural-field-artwork"/);
// Relative colors distinguish low, middle and high shares while preserving zero and ties.
const heatPAs=['LF','LF','LF','LF','LF','LF','SS','SS','SS','SS','SS','SS','CF','CF','CF','RF','RF','3B','3B','P','P','2B'].map((position,i)=>({...data.plate_appearances.find(p=>p.batted_ball),id:'heat-'+i,batted_ball:{...blake.batted_ball,type:'ground_ball',fielding_position:position}}));
const heatSvg=D.fieldSvg(heatPAs),fills=Object.fromEntries([...heatSvg.matchAll(/data-position="([^"]+)"[^>]*>.*?<circle[^>]*fill="([^"]+)"/g)].map(m=>[m[1],m[2]]));
assert.equal(fills.LF,fills.SS,'Equal leaders share a color');assert.equal(fills.RF,fills.P,'Equal shares share a color');
assert.equal(fills['1B'],'var(--heat-none)');assert.equal(new Set([fills['2B'],fills.RF,fills.CF,fills.LF]).size,4,'1, 2, 3 and 6 contacts use distinct colors');
assert.match(heatSvg,/relative contact concentration/);
for(const color of Object.values(fills).filter(c=>c.startsWith('#')))assert(contrast(light['marker-text'],color)>=4.5,'Readable marker text on '+color);
// Larger future samples show full counts and the shared total without changing the data.
const largeSample=Array.from({length:456},(_,i)=>({...blake,batted_ball:{...blake.batted_ball,fielding_position:i<123?'LF':'CF'}}));
assert.equal(D.summarize(largeSample).n,456);
assert.match(D.fieldSvg(largeSample),/class="fielder-count"[^>]+>123<\/text>/);
assert.match(D.fieldSvg(largeSample),/class="contact-total-value"[^>]+>456<\/text>/);
assert.equal((D.fieldSvg(largeSample).match(/class="fielder-percent"/g)||[]).length,D.positions.filter(p=>p!=='C').length);
assert.match(D.fieldSvg(largeSample),/class="fielder-percent"[^>]+>27%<\/text>/);
assert.equal((markerSvg.match(/class="fielder-marker"/g)||[]).length,D.positions.filter(p=>p!=='C').length);
assert.equal((markerSvg.match(/class="fielder-count"/g)||[]).length,D.positions.filter(p=>p!=='C').length);
assert.match(markerSvg,/class="fielder-count"[^>]+>6<\/text>/);
assert.match(D.fieldSvg([]),/class="contact-total-value"[^>]+>0<\/text>/);
assert.doesNotMatch(markerSvg,/<path[^>]+fill="var\(--heat-/);
assert.match(markerSvg,/data-position="P"/);assert.match(markerSvg,/coverage, or ball-path map/);
assert(D.fielderLayout.P[1]-D.fielderRadius>200,'Pitcher marker stays below the second-base landmark');
assert.equal(D.fielderLayout.C[0],297,'Catcher marker is centered on home plate');
assert.equal(D.fielderLayout.C[1],390,'Catcher marker covers home plate');
assert(D.fielderLayout.C[1]+D.fielderRadius<470,'Catcher stays within the regular field image height');
for(let i=0;i<D.positions.length;i++)for(let j=i+1;j<D.positions.length;j++){
 const [x,y]=D.fielderLayout[D.positions[i]],[xx,yy]=D.fielderLayout[D.positions[j]];
 assert(Math.hypot(x-xx,y-yy)>2*D.fielderRadius,'Fielder markers must not overlap');
}
// White bases in the shared artwork must remain clear of every marker and label.
for(const [x,y] of Object.values(D.fielderLayout))for(const [bx,by] of [[180,291],[297,190],[412,291]]){
 assert(Math.hypot(x-bx,y-by)>D.fielderRadius+12,'Fielder marker must clear the base artwork');
}
// Preserve unknown location in denominator rather than making a mapped hit certain.
const unknownArea=JSON.parse(JSON.stringify(blake));unknownArea.batted_ball.fielding_position=null;unknownArea.batted_ball.location={zone:null,precision:'unknown'};assert.equal(D.summarize([unknownArea]).unknown,1);
// Reject duplicate IDs, invalid foreign keys and ungrounded detailed zones.
const bad=JSON.parse(JSON.stringify(data));bad.plate_appearances.push(bad.plate_appearances[0]);assert.throws(()=>D.validateData(bad),/duplicate/);
const bad2=JSON.parse(JSON.stringify(data));bad2.plate_appearances[0].batter_id='missing';assert.throws(()=>D.validateData(bad2),/Invalid plate appearance/);
const bad3=JSON.parse(JSON.stringify(data));bad3.plate_appearances[0].batted_ball.location.depth='deep';assert.throws(()=>D.validateData(bad3),/Detailed zones/);
const escaped=D.esc('<img src=x onerror=alert(1)>');assert(!escaped.includes('<'));
// Missing pitch counts must remain missing; do not discard a recorded pitch.
const unknownCount=JSON.parse(JSON.stringify(data));unknownCount.plate_appearances[0].pitches[0].count_before=null;
D.validateData(unknownCount);assert.equal(D.pitchSummary(unknownCount.plate_appearances).n,104);
assert.equal(D.formatCount(null),'Not recorded');assert.equal(D.formatCount({balls:3,strikes:2}),'3–2');
const invalidDate=JSON.parse(JSON.stringify(data));invalidDate.games[0].date='2026-02-30';assert.throws(()=>D.validateData(invalidDate),/real YYYY-MM-DD/);
invalidDate.games[0].date='2026-10-28';D.validateData(invalidDate);
// An unknown contact type still belongs in all fair contact and can be isolated.
const unknownType=JSON.parse(JSON.stringify(blake));unknownType.batted_ball.contact_type='unknown';
assert.equal(D.summarize([unknownType],'unknown').n,1);assert.equal(D.summarize([unknownType],'fly_ball').n,0);
// Foul catches are completed PAs and swings, but never fair contact or hits.
// Synthetic fixtures exercise all regions; none are written to the source history.
const withFouls=JSON.parse(JSON.stringify(data));
for(const [i,zone]of [null,'left_foul_territory','right_foul_territory','behind_home_plate'].entries()){
 const pa=JSON.parse(JSON.stringify(blake));pa.id='test-foul-'+i;pa.sequence=27+i;pa.result='foul_out';
 pa.batted_ball=null;pa.source_text='Synthetic foul-catch fixture';pa.pitches[0].outcome='foul_out';pa.pitches[0].count_after=null;
 pa.foul_contact={contact_type:'fly_ball',fielding_position:zone?null:'C',location:{zone,precision:zone?'described_area':'unknown',depth:null},source_text:pa.source_text};
 withFouls.plate_appearances.push(pa);
}
D.validateData(withFouls);
assert.equal(D.summarize(withFouls.plate_appearances).n,19);assert.equal(D.summarize(withFouls.plate_appearances).hits,5);
const fsu=D.foulSummary(withFouls.plate_appearances);assert.equal(fsu.n,4);assert.equal(fsu.unknown,1);
assert.equal(fsu.counts.left_foul_territory,1);assert.equal(fsu.counts.right_foul_territory,1);assert.equal(fsu.counts.behind_home_plate,1);
assert.equal(D.foulSummary(withFouls.plate_appearances,'fair_contact').n,0);assert.equal(D.foulSummary(withFouls.plate_appearances,'fly_ball').n,4);
assert.equal(D.foulSummary(withFouls.plate_appearances,'ground_ball').n,0);assert.equal(D.foulSummary(withFouls.plate_appearances,'foul_out').n,4);
assert.equal(D.contacts(withFouls.plate_appearances,'foul_out').length,0);
const fp=D.pitchSummary(withFouls.plate_appearances);assert.equal(fp.n,108);assert.equal(fp.swings,56);assert.equal(fp.whiffs,16);assert.equal(fp.firstSwings,16);
assert.equal(fp.knownFirst,30);assert.equal(fp.complete,30);assert.equal(fp.outcomes.foul_out,4);
for(const mutate of [pa=>{pa.batted_ball=blake.batted_ball},pa=>{pa.foul_contact.location.zone='left_field'},pa=>{pa.foul_contact.location.zone='left_foul_territory';pa.foul_contact.location.precision='fielder_zone'},pa=>{pa.result='strikeout_foul_tip'},pa=>{pa.status='incomplete'},pa=>{pa.pitches[0].outcome='in_play'}]){
 const invalid=JSON.parse(JSON.stringify(withFouls));mutate(invalid.plate_appearances.at(-1));assert.throws(()=>D.validateData(invalid),/foul/i);
}
// Every listed history file must exist, validate, and match the manifest identity.
for(const team of manifest.teams){const d=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/teams',path.basename(team.data_file))));D.validateData(d);assert.equal(d.team.id,team.id);}
for(const player of data.players){const pas=D.filter(data,{batter:player.id,game:'all'});for(const compact of [false,true]){const svg=D.fieldSvg(pas,{compact});assert(!/NaN|Infinity|undefined/.test(svg));assert.match(svg,/role="img"/);}}
console.log('PASS: source totals, contact counting, pitch denominators, empty states, filtering, multi-game history, detailed zones, unknown data, validation and escaping.');
console.log(JSON.stringify({plateAppearances:26,fairContact:total.n,hits:total.hits,pitches:pitch.n,firstPitchSwings:pitch.firstSwings,knownFirstPitches:pitch.knownFirst,swings:pitch.swings,whiffs:pitch.whiffs,pitchOutcomes:pitch.outcomes},null,2));

// The real manifest is independent of historical fixtures: only validate teams the user retains.
const runtimeManifest=JSON.parse(fs.readFileSync(path.join(root,'teams.json')));D.validateManifest(runtimeManifest);
for(const entry of runtimeManifest.teams){const current=JSON.parse(fs.readFileSync(path.join(root,entry.data_file)));D.validateData(current);assert.equal(current.team.id,entry.id);}

assert.equal(D.pct(0,0),'—');assert.equal(D.pct(0,20),'0%');assert.equal(D.pct(1,1000),'0.1%','A nonzero observed rate must not display as zero');
