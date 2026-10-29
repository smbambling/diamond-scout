'use strict';
const path=require('node:path'),fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const repositoryHistory=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/shockers-four-games.json')));
const gambrills=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/teams/gambrills-athletic-club-14u.json')));
const september12='2026-09-12-0830-shockers-vs-stars-camarata';
const history={...repositoryHistory,games:repositoryHistory.games.filter(g=>g.id!==september12),plate_appearances:repositoryHistory.plate_appearances.filter(p=>p.game_id!==september12),baserunning_events:repositoryHistory.baserunning_events.filter(e=>e.game_id!==september12),baserunning_entries:repositoryHistory.baserunning_entries.filter(e=>e.game_id!==september12),runner_outs:[]};
const previousHistory={...history,games:history.games.filter(g=>g.id!=='2026-09-13-shockers-vs-metro-senators-central'),plate_appearances:history.plate_appearances.filter(p=>p.game_id!=='2026-09-13-shockers-vs-metro-senators-central'),baserunning_events:history.baserunning_events.filter(e=>e.game_id!=='2026-09-13-shockers-vs-metro-senators-central')};
const originalPAs=history.plate_appearances.filter(p=>p.game_id==='supplied-game-001'),originalPlayers=new Set(originalPAs.map(p=>p.batter_id));
const data={...history,baserunning_events:[],baserunning_entries:[],runner_outs:[],games:history.games.filter(g=>g.id==='supplied-game-001'),players:history.players.filter(p=>originalPlayers.has(p.id)),plate_appearances:originalPAs};
const manifest=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/teams.json')));
const clone=x=>JSON.parse(JSON.stringify(x));
async function openApp({scoutOnly=false,href='https://diamond-scout.test/',files={'teams.json':manifest,'data/shockers-14u.json':data}}={}){
 const elements={},requested=[],repository=clone(files),url=new URL(href),base=new URL('./',url),documentRoot={dataset:{}};
 for(const [,id]of html.matchAll(/\bid="([^"]+)"/g))elements[id]={id,value:'',hidden:/\bhidden(?:\s|>|=)/.test(html.match(new RegExp('<[^>]*\\bid="'+id+'"[^>]*>'))?.[0]||''),_html:'',textContent:'',attrs:{},dataset:{},listeners:{},addEventListener(k,f){this.listeners[k]=f},setAttribute(k,v){this.attrs[k]=v},scrollIntoView(){},focus(){},click(){return this.listeners.click?.({target:this})},set innerHTML(s){this._html=s;if(this.id.endsWith('-select'))this.value=s.match(/<option value="([^"]+)"/)?.[1]||''},get innerHTML(){return this._html}};
 for(const v of ['scout','contact','pitches','log'])elements['tab-'+v].dataset.view=v;
 const context=vm.createContext({console,URL,Map,Set,Promise,location:{href:url.href,origin:url.origin,protocol:url.protocol},window:{innerWidth:Number(process.env.DIAMOND_TEST_WIDTH||1280),addEventListener(){}},matchMedia(){return {matches:true}},document:{documentElement:documentRoot,getElementById(id){assert(elements[id],'Missing DOM element: '+id);return elements[id]},querySelectorAll(s){assert.equal(s,'[data-view]');return ['scout','contact','pitches','log'].map(v=>elements['tab-'+v])}},fetch:async (target,options)=>{
  requested.push({url:target.toString(),options});
  assert.equal(target.origin,url.origin);assert(target.pathname.startsWith(base.pathname));
  assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');
  const key=target.pathname.slice(base.pathname.length),value=repository[key];
  return {ok:value!==undefined,status:value===undefined?404:200,json:async()=>clone(value)};
 }});
 for(const [,code]of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))vm.runInContext(scoutOnly?code:code.replace('const SCOUT_ONLY=true;','const SCOUT_ONLY=false;'),context);
 await new Promise(setImmediate);
 return {elements,requested,repository,documentRoot};
}
(async()=>{
 // Default production mode is Scout only; historical view checks below opt in to retained code.
 assert.match(html,/const SCOUT_ONLY=true;/);assert(!html.includes('id="help-button"'));
 const scoutOnly=await openApp({scoutOnly:true}),SO=scoutOnly.elements;
 assert.equal(SO.app.hidden,false);assert.equal(SO['view-navigation'].hidden,true);assert.equal(SO['expand-field'].hidden,true);assert.equal(SO['expand-field'].disabled,true);
 for(const view of ['contact','pitches','log']){const tab=SO['tab-'+view];assert.equal(tab.hidden,true);assert.equal(tab.disabled,true);tab.click();assert.equal(SO['view-'+view].hidden,true);assert.equal(SO.app.dataset.view,'scout');}
 SO['expand-field'].click();assert.equal(SO['view-scout'].hidden,false);assert.equal(SO['view-contact'].hidden,true);assert.equal(SO['view-guide'].hidden,true);
 assert.equal(scoutOnly.documentRoot.dataset.scoutOnly,'true');
 assert(!/type="file"|Open JSON files|localData|FileReader/.test(html),'No manual import interface or fallback');
 const {elements:E,requested}=await openApp();
 assert.equal(E['tab-scout'].tabIndex,0);assert.equal(E['view-scout'].hidden,false);
 E['filter-toggle'].click();assert.equal(E['filter-panel'].hidden,false);assert.equal(E['filter-toggle'].attrs['aria-expanded'],'true');
 E['filter-toggle'].click();assert.equal(E['filter-panel'].hidden,true);
 E['expand-field'].click();assert.equal(E['view-contact'].hidden,false);assert.equal(E['view-scout'].hidden,true);
 E['tab-scout'].click();assert.equal(E['view-scout'].hidden,false);
 assert.equal(E.app.hidden,false);assert.equal(E.status.hidden,true);
 assert.deepEqual(requested.map(r=>r.url),['https://diamond-scout.test/teams.json','https://diamond-scout.test/data/shockers-14u.json']);
 assert.equal(E['page-title'].textContent,'Shockers 14U');assert.match(E['main-field'].innerHTML,/19 fair contacts/);
 assert.equal((E['batter-gallery'].innerHTML.match(/class="batter-card"/g)||[]).length,12);
 assert.equal((E['log-table'].innerHTML.match(/<li>/g)||[]).length,104);
 assert.match(E['log-table'].innerHTML,/Rawlings Tigers NOVA/);assert.match(E['log-table'].innerHTML,/count before: 0–0/);
 assert(!html.includes('id="area-totals"'));assert(!html.includes('id="location-note"'));assert.equal(E['foul-details'].hidden,true);assert.equal(E['described-section'].hidden,true);assert.match(E['map-title'].textContent,/contact by recorded fielder/);assert.match(E['game-summary'].innerHTML,/104 recorded pitches · 19 fair contacts/);
 E['game-summary'].listeners.click({target:{closest:()=>({dataset:{game:data.games[0].id}})}});
 assert.equal(E['game-select'].value,data.games[0].id);assert.equal(E['log-count'].textContent,'26 plate appearances');
 E['game-select'].value='all';E['game-select'].listeners.change();
 E['batter-select'].value='shockers-14u-matthew-chernoff';E['batter-select'].listeners.change();
 assert.match(E['main-field'].innerHTML,/3 fair contacts/);assert.match(E['pitch-stats'].innerHTML,/2.3/);
 E['contact-select'].value='ground_ball';E['contact-select'].listeners.change();
 assert.match(E['main-field'].innerHTML,/2 fair contacts/);assert.match(E['pitch-stats'].innerHTML,/2.3/);
 E['tab-pitches'].click();assert.equal(E['view-pitches'].hidden,false);assert.equal(E['view-contact'].hidden,true);assert.equal(E['contact-filter'].hidden,true);
 assert.equal(E['tab-contact'].tabIndex,-1);assert.equal(E['tab-pitches'].tabIndex,0);assert.match(E['filter-context'].textContent,/All plate appearances/);
 E['all-batters'].click();assert.equal(E['batter-select'].value,'all');
 // Resolve both JSON paths relative to the app, including static hosts with a subdirectory.
 const nested=await openApp({href:'https://diamond-scout.test/diamond-scout/index.html?preview=1'});
 assert.equal(nested.elements.app.hidden,false);
 assert.deepEqual(nested.requested.map(r=>r.url),['https://diamond-scout.test/diamond-scout/teams.json','https://diamond-scout.test/diamond-scout/data/shockers-14u.json']);
 const local=await openApp({href:'http://127.0.0.1:8000/'});assert.equal(local.elements.app.hidden,false);
 const disk=await openApp({href:'file:///project/index.html'});assert.equal(disk.requested.length,0);assert.match(disk.elements.status.textContent,/python3 -m http.server/);assert.equal(disk.elements.app.hidden,true);
 // Missing repository files explain the error and can be retried after the file is fixed.
 const missing=await openApp({files:{}});assert.match(missing.elements.status.textContent,/teams.json \(HTTP 404\)/);
 Object.assign(missing.repository,clone({'teams.json':manifest,'data/shockers-14u.json':data}));const repaired=await openApp({files:missing.repository});assert.equal(repaired.elements.app.hidden,false);
 // Failed team selection retains the last valid view and recovery selector.
 const extended=clone(manifest);extended.teams.push({id:'unavailable',name:'Unavailable team',data_file:'data/unavailable.json'});
 const multi=await openApp({files:{'teams.json':extended,'data/shockers-14u.json':data}});
 multi.elements['team-select'].value='unavailable';await multi.elements['team-select'].listeners.change();
 assert.equal(multi.elements.app.hidden,false);assert.equal(multi.elements['team-select'].value,data.team.id);assert.match(multi.elements.status.textContent,/Still showing Shockers 14U/);
 // Refreshing the page fetches updated repository history and resets stale filters.
 const next=clone(data);next.team.name='Updated team';multi.repository['data/shockers-14u.json']=next;
 const updated=await openApp({files:multi.repository});assert.equal(updated.elements['page-title'].textContent,'Updated team');assert.equal(updated.elements['contact-select'].value,'all');
 const broken=clone(next);broken.plate_appearances.push(broken.plate_appearances[0]);multi.repository['data/shockers-14u.json']=broken;
 const invalid=await openApp({files:multi.repository});assert.match(invalid.elements.status.textContent,/duplicate/);assert.equal(invalid.elements.app.hidden,true);
 // Explicit location descriptions appear separately and do not turn into fielder territories.
 const precise=clone(data);precise.plate_appearances[0].batted_ball.fielding_position='CF';precise.plate_appearances[0].batted_ball.location={zone:'left_center',precision:'described_area',depth:'deep'};
 const described=await openApp({files:{'teams.json':manifest,'data/shockers-14u.json':precise}});
 assert.equal(described.elements['described-section'].hidden,false);assert.match(described.elements['described-locations'].innerHTML,/Left center · deep/);
 assert.doesNotMatch(described.elements['main-field'].innerHTML,/<path[^>]+fill="var\(--heat-/);
 // Unknown counts and metadata render safely, retaining every recorded pitch.
 const sparse=clone(data),pitch=sparse.plate_appearances[0].pitches[0];pitch.count_before=null;pitch.pitch_type='<script>bad</script>';pitch.location={zone:'<img src=x>'};pitch.velocity_mph=72;
 const sparseApp=await openApp({files:{'teams.json':manifest,'data/shockers-14u.json':sparse}});
 assert.match(sparseApp.elements['log-table'].innerHTML,/count before: Not recorded/);assert.match(sparseApp.elements['log-table'].innerHTML,/72 mph/);
 assert.match(sparseApp.elements['log-table'].innerHTML,/&lt;script&gt;bad&lt;\/script&gt;/);assert(!sparseApp.elements['log-table'].innerHTML.includes('<img'));
 assert.match(sparseApp.elements['count-table'].innerHTML,/1 fair contacts had no recorded terminal pitch count/);
 assert.equal((sparseApp.elements['log-table'].innerHTML.match(/<li>/g)||[]).length,104);
 // A source-supplied foul catch renders separately and respects every contact filter.
 const foulData=clone(data),foulPA=clone(data.plate_appearances[0]);foulPA.id='synthetic-foul';foulPA.sequence=27;foulPA.result='foul_out';foulPA.batted_ball=null;
 foulPA.pitches[0].outcome='foul_out';foulPA.pitches[0].count_after=null;foulPA.source_text='Synthetic catch in left foul territory.';
 foulPA.foul_contact={contact_type:'fly_ball',fielding_position:'3B',location:{zone:'left_foul_territory',precision:'described_area',depth:null},source_text:foulPA.source_text};
 foulData.plate_appearances.push(foulPA);
 const foulApp=await openApp({files:{'teams.json':manifest,'data/shockers-14u.json':foulData}}),F=foulApp.elements;
 assert.match(F['main-field'].innerHTML,/19 fair contacts/);assert.match(F['foul-field'].innerHTML,/1 foul catches/);
 assert.match(F['log-table'].innerHTML,/Foul catch · Fly ball/);assert.match(F['log-table'].innerHTML,/Foul catch \(out\)/);
 assert.equal((F['log-table'].innerHTML.match(/<li>/g)||[]).length,105);
 assert.equal(F['foul-details'].hidden,false);
 const pitchStats=F['pitch-stats'].innerHTML;
 F['contact-select'].value='foul_out';F['contact-select'].listeners.change();assert.match(F['main-field'].innerHTML,/0 fair contacts/);assert.match(F['foul-field'].innerHTML,/1 foul catches/);assert.equal(F['pitch-stats'].innerHTML,pitchStats);
 F['contact-select'].value='fair_contact';F['contact-select'].listeners.change();assert.match(F['main-field'].innerHTML,/19 fair contacts/);assert.match(F['foul-field'].innerHTML,/No foul catches/);assert.equal(F['foul-details'].hidden,true);
 F['contact-select'].value='all';F['contact-select'].listeners.change();F['batter-select'].value='shockers-14u-owen-keeton';F['batter-select'].listeners.change();assert.match(F['foul-field'].innerHTML,/No foul catches/);
 // Preserve the prior two-game interaction regression, then check full history below.
 const current=await openApp({files:{'teams.json':manifest,'data/shockers-14u.json':previousHistory}}),C=current.elements;
 C['batter-select'].value='shockers-14u-jackson-zangrilli';C['batter-select'].listeners.change();
 assert.match(C['quick-read'].innerHTML,/Steal tendency/);assert.match(C['quick-read'].innerHTML,/Steal tendency: 25%; 1\/4 trips; show sample counts/);
 C['contact-select'].value='ground_ball';C['contact-select'].listeners.change();assert.match(C['quick-read'].innerHTML,/Steal tendency: 25%; 1\/4 trips; show sample counts/);
 C['game-select'].value='supplied-game-001';C['game-select'].listeners.change();assert.match(C['quick-read'].innerHTML,/No steal attempts recorded/);assert.doesNotMatch(C['quick-read'].innerHTML,/Steal tendency: 25%; 1\/4 trips; show sample counts/);
 C['game-select'].value='all';C['game-select'].listeners.change();C['contact-select'].value='all';C['contact-select'].listeners.change();
 C['batter-select'].value='shockers-14u-nate-henson';C['batter-select'].listeners.change();assert.match(C['quick-read'].innerHTML,/No steal attempts recorded/);assert.match(C['quick-read'].innerHTML,/Steal tendency: 0%; 0\/4 trips; show sample counts/);
 C['batter-select'].value='shockers-14u-blake-weber';C['batter-select'].listeners.change();
 assert.equal(C['batter-context'].textContent,'6 completed PAs · 2 games');
 assert(!html.includes('leader-strip'));
 assert.equal((C['scout-field'].innerHTML.match(/class="fielder-count"/g)||[]).length,8);
 assert.match(C['scout-field'].innerHTML,/class="fielder-count"[^>]+>1<\/text>/);
 assert.match(C['scout-field'].innerHTML,/class="contact-total-value"[^>]+>3<\/text>/);
 assert.match(C['quick-read'].innerHTML,/67%/);assert.match(C['quick-read'].innerHTML,/50%/);
 assert.match(C['outcome-context'].textContent,/6 completed PAs/);
 assert.match(C['batting-stats'].innerHTML,/\.333/);assert.match(C['batting-stats'].innerHTML,/\.667/);
 assert.equal(C['field-batting-stats'].innerHTML,C['batting-stats'].innerHTML);
 assert.match(C['batting-stats'].innerHTML,/BB%/);assert.match(C['batting-stats'].innerHTML,/33%/);assert.match(C['batting-stats'].innerHTML,/K%/);assert.match(C['batting-stats'].innerHTML,/0%/);
 assert(html.indexOf('id="view-pitches"')<html.indexOf('id="outcome-rows"'));
 assert.match(C['quick-read'].innerHTML,/<details class="scout-metric">/);
 assert(!html.includes('id="recent-appearances"'));assert(!html.includes('id="open-history"'));assert(!html.includes('id="batting-details"'));
 C['outcome-more'].click();assert.equal(C['outcome-extra'].hidden,false);assert.equal(C['outcome-more'].attrs['aria-expanded'],'true');
 const entireOutcomes=C['outcome-rows'].innerHTML+C['outcome-extra'].innerHTML;
 C['contact-select'].value='ground_ball';C['contact-select'].listeners.change();
 assert.match(C['scout-field'].innerHTML,/2 fair contacts/);
 assert.match(C['scout-field'].innerHTML,/class="contact-total-value"[^>]+>2<\/text>/);
 assert.equal(C['outcome-rows'].innerHTML+C['outcome-extra'].innerHTML,entireOutcomes);
 C['game-select'].value='supplied-game-001';C['game-select'].listeners.change();assert.equal(C['outcome-extra'].hidden,true);
 C['game-select'].value='all';C['game-select'].listeners.change();C['contact-select'].value='all';C['contact-select'].listeners.change();
 C['all-batters'].click();
 assert.match(C['main-field'].innerHTML,/35 fair contacts/);assert.equal(C['log-count'].textContent,'61 plate appearances');
 assert.equal((C['batter-gallery'].innerHTML.match(/class="batter-card"/g)||[]).length,13);
 assert.equal((C['log-table'].innerHTML.match(/<li>/g)||[]).length,233);
 assert.match(C['game-select'].innerHTML,/2026-08-30 · 10:00 AM/);assert.match(C['game-summary'].innerHTML,/2026-08-30 · 10:00 AM/);assert.match(C['log-table'].innerHTML,/2026-08-30 · 10:00 AM/);
 C['game-select'].value='2026-08-30-1000-shockers-vs-gambrills';C['game-select'].listeners.change();
 assert.equal(C['log-count'].textContent,'35 plate appearances');assert.match(C['main-field'].innerHTML,/16 fair contacts/);assert.match(C['filter-context'].textContent,/10:00 AM/);
 assert.match(C['log-table'].innerHTML,/Unknown \(incomplete\)/);assert.match(C['log-table'].innerHTML,/Infield fly \(out\)/);
 // Full repository history includes September without changing earlier regression fixtures.
 const metroApp=await openApp({files:{'teams.json':manifest,'data/shockers-14u.json':history}}),M=metroApp.elements;
 assert.equal(M['log-count'].textContent,'94 plate appearances');assert.match(M['main-field'].innerHTML,/61 fair contacts/);assert.equal((M['log-table'].innerHTML.match(/<li>/g)||[]).length,336);assert.match(M['quick-read'].innerHTML,/Steal tendency: 14%; 7\/50 trips; show sample counts/);
 M['game-select'].value='2026-09-13-shockers-vs-metro-senators-central';M['game-select'].listeners.change();
 assert.equal(M['log-count'].textContent,'33 plate appearances');assert.match(M['main-field'].innerHTML,/26 fair contacts/);assert.equal((M['log-table'].innerHTML.match(/<li>/g)||[]).length,103);
 assert.match(M['filter-context'].textContent,/2026-09-13/);assert.match(M['game-select'].innerHTML,/Metro Senators 14U Central/);assert.match(M['quick-read'].innerHTML,/Steal tendency: 22%; 4\/18 trips; show sample counts/);
 M['batter-select'].value='shockers-14u-logan-sumrow';M['batter-select'].listeners.change();
 assert.equal(M['batter-context'].textContent,'2 completed PAs · 1 game · 1 incomplete');assert.match(M['outcome-context'].textContent,/2 completed PAs · 1 incomplete excluded/);
 assert.match(M['log-table'].innerHTML,/inside the park home run/);assert.match(M['log-table'].innerHTML,/Unknown \(incomplete\)/);assert.match(M['batting-stats'].innerHTML,/3.000/);assert.match(M['quick-read'].innerHTML,/Steal tendency: 100%; 1\/1 trips; show sample counts/);
 M['tab-pitches'].click();assert.equal(M['view-pitches'].hidden,false);
 M['batter-select'].value='shockers-14u-jackson-zangrilli';M['batter-select'].listeners.change();assert.match(M['quick-read'].innerHTML,/Steal tendency: 50%; 1\/2 trips; show sample counts/);
 M['contact-select'].value='ground_ball';M['contact-select'].listeners.change();assert.match(M['quick-read'].innerHTML,/Steal tendency: 50%; 1\/2 trips; show sample counts/);assert.match(M['quick-read'].innerHTML,/2 total attempts/);assert.match(M['quick-read'].innerHTML,/2.0 attempts\/game/);
 M['tab-log'].click();assert.equal(M['view-log'].hidden,false);assert.equal(M['log-count'].textContent,'3 plate appearances');
 // Attempts include caught steals and unknown outcomes; neither is a new on-base visit.
 const stealFixture=clone(previousHistory),stealEvent=stealFixture.baserunning_events[0];
 stealFixture.baserunning_events.push({...stealEvent,id:'synthetic-display-caught',result:'caught_stealing',source_text:'Synthetic caught-stealing display fixture.'});
 const stealApp=await openApp({files:{'teams.json':manifest,'data/shockers-14u.json':stealFixture}}),S=stealApp.elements;
 S['batter-select'].value=stealEvent.runner_id;S['batter-select'].listeners.change();
 assert.match(S['quick-read'].innerHTML,/Steal tendency: 50%; 1\/2 trips; show sample counts/);
 assert.match(S['quick-read'].innerHTML.match(/<details class="scout-metric"><summary aria-label="Steal tendency:[\s\S]*?<\/details>/)[0],/50%/);
 stealFixture.baserunning_events.push({...stealEvent,id:'synthetic-display-unknown',result:'unknown',to_base:null});
 const unknownSteals=await openApp({files:{'teams.json':manifest,'data/shockers-14u.json':stealFixture}}),U=unknownSteals.elements;
 U['batter-select'].value=stealEvent.runner_id;U['batter-select'].listeners.change();assert.match(U['quick-read'].innerHTML,/Steal tendency: 50%; 1\/2 trips; show sample counts/);
 // New manifest team loads its own history; switching resets stale player/game filters.
 const bothTeams=await openApp({files:{'teams.json':manifest,'data/shockers-14u.json':history,'data/gambrills-athletic-club-14u.json':gambrills}}),B=bothTeams.elements;
 assert.match(B['team-select'].innerHTML,/Gambrills Athletic Club 14U/);
 B['team-select'].value=gambrills.team.id;await B['team-select'].listeners.change();
 assert.equal(B['page-title'].textContent,'Gambrills Athletic Club 14U');assert.equal(B['log-count'].textContent,'27 plate appearances');assert.match(B['main-field'].innerHTML,/21 fair contacts/);assert.equal((B['log-table'].innerHTML.match(/<li>/g)||[]).length,81);assert.equal((B['batter-gallery'].innerHTML.match(/class="batter-card"/g)||[]).length,11);
 assert.match(B['quick-read'].innerHTML,/Steal tendency: 13%; 2\/15 trips/);assert.match(B['game-select'].innerHTML,/2026-08-30 · 10:00 AM/);assert.match(B['log-table'].innerHTML,/lines into a double play/);
 B['batter-select'].value='gambrills-athletic-club-14u-wesson-shepherd';B['batter-select'].listeners.change();assert.match(B['quick-read'].innerHTML,/Steal tendency: 33%; 1\/3 trips/);
 B['contact-select'].value='ground_ball';B['contact-select'].listeners.change();assert.match(B['quick-read'].innerHTML,/Steal tendency: 33%; 1\/3 trips/);
 B['tab-log'].click();assert.equal(B['log-count'].textContent,'3 plate appearances');
 B['team-select'].value='shockers-14u';await B['team-select'].listeners.change();assert.equal(B['batter-select'].value,'all');assert.equal(B['contact-select'].value,'all');assert.equal(B['log-count'].textContent,'94 plate appearances');assert.match(B['quick-read'].innerHTML,/Steal tendency: 14%; 7\/50 trips/);
 const missingReach=clone(previousHistory);missingReach.plate_appearances[0].result='unclassified';
 const missingReachApp=await openApp({files:{'teams.json':manifest,'data/shockers-14u.json':missingReach}});
 assert.match(missingReachApp.elements['quick-read'].innerHTML,/Steal tendency: —; Trip data needs review/);
 // Full current repository: both September 12 sides and standalone runner-only history.
 const allFiles={'teams.json':manifest};for(const team of manifest.teams)allFiles[team.data_file]=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/teams',path.basename(team.data_file))));
 allFiles['data/shockers-14u.json']=repositoryHistory;
 const actual=await openApp({files:allFiles}),A=actual.elements;
 assert.equal(A['log-count'].textContent,'127 plate appearances');assert.match(A['quick-read'].innerHTML,/Steal tendency: 16%; 11\/70 trips/);
 A['game-select'].value=september12;A['game-select'].listeners.change();assert.equal(A['log-count'].textContent,'33 plate appearances');assert.match(A['main-field'].innerHTML,/22 fair contacts/);assert.equal((A['log-table'].innerHTML.match(/<li>/g)||[]).length,90);assert.match(A['log-table'].innerHTML,/Fielder’s choice double play/);assert.equal(A['runner-out-section'].hidden,true);
 A['team-select'].value='stars-camarata-14u';await A['team-select'].listeners.change();assert.equal(A['page-title'].textContent,'Stars Camarata 14U');assert.equal(A['log-count'].textContent,'27 plate appearances');assert.match(A['main-field'].innerHTML,/20 fair contacts/);assert.match(A['main-field'].innerHTML,/data-position="C"/);assert.equal((A['log-table'].innerHTML.match(/<li>/g)||[]).length,107);assert.match(A['quick-read'].innerHTML,/Steal tendency: 27%; 3\/11 trips/);assert.equal(A['runner-out-section'].hidden,false);assert.match(A['runner-out-events'].innerHTML,/offensive interference/);assert.match(A['runner-out-events'].innerHTML,/no additional PA, pitch or fair contact/);
 A['batter-select'].value='stars-camarata-14u-mark-trey-poncy';A['batter-select'].listeners.change();assert.equal(A['log-count'].textContent,'2 plate appearances');assert.equal(A['runner-out-section'].hidden,false);
 A['batter-select'].value='stars-camarata-14u-logan-pinkerton';A['batter-select'].listeners.change();assert.equal(A['runner-out-section'].hidden,true);assert.match(A['quick-read'].innerHTML,/Steal tendency: 50%; 1\/2 trips/);
 A['batter-select'].value='stars-camarata-14u-kyle-reynolds';A['batter-select'].listeners.change();A['contact-select'].value='fly_ball';A['contact-select'].listeners.change();assert.match(A['scout-field'].innerHTML,/data-position="C"/);assert.match(A['scout-field'].innerHTML,/1 fair contacts/);assert.equal(A['log-count'].textContent,'3 plate appearances');
 // The captured October game is available for both teams, including unusual scoring.
 const octoberFiles={'teams.json':manifest};for(const team of manifest.teams)octoberFiles[team.data_file]=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/teams',path.basename(team.data_file))));
 const october=await openApp({files:octoberFiles}),O=october.elements;
 O['team-select'].value='dig-in-gribbin-14u';await O['team-select'].listeners.change();const octDig=octoberFiles['data/dig-in-gribbin-14u.json'].games.find(g=>g.source_event_id==='bbd7b60b-a503-4abf-8dfe-91e7105aabc5');assert(octDig);O['game-select'].value=octDig.id;O['game-select'].listeners.change();assert.equal(O['page-title'].textContent,'Dig In (Gribbin) 14U');assert.equal(O['log-count'].textContent,'19 plate appearances');assert.equal((O['log-table'].innerHTML.match(/<li>/g)||[]).length,76);assert.match(O['main-field'].innerHTML,/13 fair contacts/);assert.match(O['quick-read'].innerHTML,/Steal tendency: 38%; 3\/8 trips/);assert.match(O['log-table'].innerHTML,/Catcher’s interference/);assert.match(O['log-table'].innerHTML,/Ball 4/);assert.match(O['batting-stats'].innerHTML,/\.278/);
 O['batter-select'].value='dig-in-gribbin-14u-declan-class';O['batter-select'].listeners.change();assert.match(O['quick-read'].innerHTML,/Steal tendency: 100%; 1\/1 trips/);assert.match(O['quick-read'].innerHTML,/2 total attempts/);
 O['contact-select'].value='ground_ball';O['contact-select'].listeners.change();assert.match(O['quick-read'].innerHTML,/Steal tendency: 100%; 1\/1 trips/);
 O['team-select'].value='bba-14u-east';await O['team-select'].listeners.change();const octBba=octoberFiles['data/bba-14u-east.json'].games.find(g=>g.source_event_id==='bbd7b60b-a503-4abf-8dfe-91e7105aabc5');assert(octBba);O['game-select'].value=octBba.id;O['game-select'].listeners.change();assert.equal(O['log-count'].textContent,'24 plate appearances');assert.equal((O['log-table'].innerHTML.match(/<li>/g)||[]).length,88);assert.match(O['main-field'].innerHTML,/16 fair contacts/);assert.match(O['quick-read'].innerHTML,/Steal tendency: 0%; 0\/15 trips/);assert.match(O['game-select'].innerHTML,/2026-10-25 · 10:00 AM/);
 O['batter-select'].value='bba-14u-east-ben-thorn';O['batter-select'].listeners.change();assert.equal(O['batter-context'].textContent,'2 completed PAs · 1 game · 1 incomplete');assert.equal(O['log-count'].textContent,'3 plate appearances');assert.match(O['outcome-context'].textContent,/2 completed PAs · 1 incomplete excluded/);
 // One unresolved out must not blank every available batting value or disappear from history.
 const partialHistory=clone(data),partialBatter=data.players[0].id,otherBatter=data.players.find(p=>p.id!==partialBatter).id;
 const partialPA=(id,result,batter,status='complete')=>({...clone(data.plate_appearances[0]),id,batter_id:batter,status,result,pitches:[],batted_ball:null,source_text:'Synthetic partial-stat fixture '+result});
 partialHistory.plate_appearances=[partialPA('known-hit','single',partialBatter),partialPA('known-walk','walk',otherBatter),{...partialPA('other-out','batter_out',partialBatter),reached_base:false},partialPA('unfinished','unknown',partialBatter,'incomplete')];
 const partialApp=await openApp({files:{'teams.json':manifest,'data/shockers-14u.json':partialHistory}}),partialE=partialApp.elements;
 assert.match(partialE['batting-stats'].innerHTML,/AVG\*/);assert.match(partialE['batting-stats'].innerHTML,/1\.000/);assert.match(partialE['batting-stats'].innerHTML,/1\/1/);assert.match(partialE['batting-stats'].innerHTML,/50%/);assert.match(partialE['batting-stats'].innerHTML,/0%/);
 assert.equal(partialE['batting-note'].hidden,false);assert.match(partialE['batting-note'].textContent,/Stats use 2 of 3 completed PAs; 1 result needs review/);assert.equal(partialE['field-batting-note'].textContent,partialE['batting-note'].textContent);assert.equal(partialE['field-batting-stats'].innerHTML,partialE['batting-stats'].innerHTML);
 assert.equal(partialE['log-count'].textContent,'4 plate appearances');assert.match(partialE['log-table'].innerHTML,/Synthetic partial-stat fixture batter_out/);assert.match(partialE['batting-stats'].attrs['aria-label'],/2 of 3 classified/);
 const partialMarkup=partialE['batting-stats'].innerHTML;partialE['contact-select'].value='ground_ball';partialE['contact-select'].listeners.change();assert.equal(partialE['batting-stats'].innerHTML,partialMarkup);
 partialE['batter-select'].value=otherBatter;partialE['batter-select'].listeners.change();assert.equal(partialE['batting-note'].hidden,true);assert.doesNotMatch(partialE['batting-stats'].innerHTML,/AVG\*/);assert.match(partialE['batting-stats'].innerHTML,/100%/);
 const unknownOnly=clone(partialHistory);unknownOnly.plate_appearances=[partialHistory.plate_appearances[2]];
 const unknownOnlyApp=await openApp({files:{'teams.json':manifest,'data/shockers-14u.json':unknownOnly}});assert.match(unknownOnlyApp.elements['batting-note'].textContent,/Stats use 0 of 1/);assert.doesNotMatch(unknownOnlyApp.elements['batting-stats'].innerHTML,/0\/0|NaN|Infinity/);assert.equal((unknownOnlyApp.elements['batting-stats'].innerHTML.match(/>—<\/strong>/g)||[]).length,6);
 // Pitches recorded before a runner-only pickoff count for the team, without invented batter stats.
 const orphanHistory=clone(data);orphanHistory.runner_outs=[{id:'orphan-out',game_id:data.games[0].id,runner_id:data.players[0].id,inning:1,half:'top',reason:'picked_off',source_text:'Synthetic runner-only pickoff.',source_pitch_sequence:'Ball 1.',batter_id:null,pitches:[{sequence:1,outcome:'ball',count_before:{balls:0,strikes:0},count_after:{balls:1,strikes:0}}]}];
 const orphanApp=await openApp({files:{'teams.json':manifest,'data/shockers-14u.json':orphanHistory}}),orphanE=orphanApp.elements;
 assert.match(orphanE['game-summary'].innerHTML,/105 recorded pitches/);assert.equal(orphanE['log-count'].textContent,'26 plate appearances');assert.match(orphanE['runner-out-events'].innerHTML,/1 recorded pitches; batter not identified/);
 const cleanPitchApp=await openApp();for(const fields of [orphanE,cleanPitchApp.elements]){fields['batter-select'].value=data.players[0].id;fields['batter-select'].listeners.change();}assert.equal(orphanE['pitch-stats'].innerHTML,cleanPitchApp.elements['pitch-stats'].innerHTML,'Unknown-batter pitches must not be attributed to the picked-off runner');
 // Entry-backed opportunities reach the actual renderer without manufacturing extra batting rows.
 const importer=require('../tools/import-plays.cjs'),placementCore=importer.loadCore(),placementSource=importer.readCapture(fs.readFileSync(path.join(root,'tests/fixtures/captures/2026-10-18-dig-in-dirtbags-capture.txt'),'utf8'));
 const placementTeams=[['placed-dig','Dig In (Gribbin) 14U'],['placed-dirt','SBGC Dirtbags Mid-Atlantic 14U']];
 const placementManifest={schema_version:1,teams:placementTeams.map(([id,name])=>({id,name,data_file:'data/'+id+'.json'}))},placementFiles={'teams.json':placementManifest};
 for(const [id,name] of placementTeams){const d={schema_version:1,team:{id,name},players:[],games:[],plate_appearances:[]};importer.buildTeam(placementSource,name,d,'placed-game-'+id,'Fixture opponent',placementCore);placementFiles['data/'+id+'.json']=d;}
 const placementApp=await openApp({files:placementFiles}),P=placementApp.elements;
 assert.equal(P.app.hidden,false);assert.equal(P['log-count'].textContent,'30 plate appearances');assert.equal((P['log-table'].innerHTML.match(/<li>/g)||[]).length,98);assert.match(P['quick-read'].innerHTML,/Steal tendency: 50%; 7\/14 trips/);assert.match(P['quick-read'].innerHTML,/placed runners count as on-base opportunities/);
 P['batter-select'].value='placed-dig-deven-downs';P['batter-select'].listeners.change();assert.match(P['quick-read'].innerHTML,/Steal tendency: 75%; 3\/4 trips/);
 P['contact-select'].value='ground_ball';P['contact-select'].listeners.change();assert.match(P['quick-read'].innerHTML,/Steal tendency: 75%; 3\/4 trips/);
 P['team-select'].value='placed-dirt';await P['team-select'].listeners.change();assert.equal(P['log-count'].textContent,'31 plate appearances');assert.equal((P['log-table'].innerHTML.match(/<li>/g)||[]).length,113);assert.match(P['quick-read'].innerHTML,/Steal tendency: 7%; 1\/14 trips/);assert.match(P['log-table'].innerHTML,/is intentionally walked/);
 // A page refresh starts a new application and fetches changed JSON with no-store.
 const refreshedFiles={'teams.json':clone(manifest),'data/shockers-14u.json':clone(history)};refreshedFiles['data/shockers-14u.json'].team.name='Fresh after page refresh';
 const refreshed=await openApp({files:refreshedFiles});assert.equal(refreshed.elements['page-title'].textContent,'Fresh after page refresh');
 assert.equal(refreshed.requested.length,2);assert(refreshed.requested.every(r=>r.options.cache==='no-store'));
 // The app has one fixed palette and no preference storage or theme controls.
 assert(!/DiamondScoutTheme|data-theme|localStorage|id="theme-select"|diamond-scout-theme/.test(html));
 assert.match(html,/<meta name="theme-color" content="#F4F6F8">/);
 // Smoke-test the current retained teams separately from fixed historical expectations.
 const runtimeManifest=JSON.parse(fs.readFileSync(path.join(root,'teams.json'))),runtimeFiles={'teams.json':runtimeManifest};
 for(const team of runtimeManifest.teams)runtimeFiles[team.data_file]=JSON.parse(fs.readFileSync(path.join(root,team.data_file)));
 const runtimeApp=await openApp({files:runtimeFiles});assert.equal(runtimeApp.elements.app.hidden,false);
 for(const team of runtimeManifest.teams){runtimeApp.elements['team-select'].value=team.id;await runtimeApp.elements['team-select'].listeners.change();assert.equal(runtimeApp.elements['page-title'].textContent,team.name);assert.equal(runtimeApp.elements.app.hidden,false);}
 console.log('PASS ('+(process.env.DIAMOND_TEST_WIDTH||1280)+'px viewport model): automatic repository JSON loading, subdirectory hosting, file-protocol guidance, page-refresh recovery, full pitch history, filters, gallery, navigation, and safe missing-data rendering.');
})();
