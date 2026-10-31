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
async function openApp({storage={},storageBlocked=false,href='https://diamond-scout.test/',files={'teams.json':manifest,'data/shockers-14u.json':data}}={}){
 const elements={},requested=[],repository=clone(files),url=new URL(href),base=new URL('./',url),documentRoot={dataset:{}};
 for(const [,id]of html.matchAll(/\bid="([^"]+)"/g))elements[id]={id,value:'',hidden:/\bhidden(?:\s|>|=)/.test(html.match(new RegExp('<[^>]*\\bid="'+id+'"[^>]*>'))?.[0]||''),_html:'',textContent:'',attrs:{},dataset:{},listeners:{},addEventListener(k,f){this.listeners[k]=f},setAttribute(k,v){this.attrs[k]=v},scrollIntoView(){},focus(){},click(){return this.listeners.click?.({target:this})},set innerHTML(s){this._html=s;if(this.id.endsWith('-select'))this.value=s.match(/<option value="([^"]+)"/)?.[1]||''},get innerHTML(){return this._html}};
 for(const v of ['scout','pitching'])elements['tab-'+v].dataset.view=v;
 const context=vm.createContext({console,URL,Map,Set,Promise,localStorage:{getItem(key){if(storageBlocked)throw Error('Storage unavailable');return storage[key]??null;},setItem(key,value){if(storageBlocked)throw Error('Storage unavailable');storage[key]=value;}},location:{href:url.href,origin:url.origin,protocol:url.protocol},window:{scrollTo(options){elements.app.lastScroll=options;},innerWidth:Number(process.env.DIAMOND_TEST_WIDTH||1280),addEventListener(){}},matchMedia(){return {matches:true}},document:{documentElement:documentRoot,getElementById(id){assert(elements[id],'Missing DOM element: '+id);return elements[id]},querySelectorAll(s){assert.equal(s,'[data-view]');return ['scout','pitching'].map(v=>elements['tab-'+v])}},fetch:async (target,options)=>{
  requested.push({url:target.toString(),options});
  assert.equal(target.origin,url.origin);assert(target.pathname.startsWith(base.pathname));
  assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');
  const key=target.pathname.slice(base.pathname.length),value=repository[key];
  return {ok:value!==undefined,status:value===undefined?404:200,json:async()=>clone(value)};
 }});
 for(const [,code]of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))vm.runInContext(code,context);
 await new Promise(setImmediate);
 return {elements,requested,repository,documentRoot,storage};
}
function chooseGames(elements,selection){
 if(selection==='all'){elements['games-all'].click();return;}
 const wanted=new Set(Array.isArray(selection)?selection:[selection]);
 if(!wanted.size){elements['games-clear'].click();return;}
 const options=[...elements['game-select'].innerHTML.matchAll(/<input[^>]*data-game-id="([^"]+)"([^>]*)>/g)].map(m=>({id:m[1],checked:/\bchecked\b/.test(m[2])}));
 for(const option of options.filter(o=>wanted.has(o.id)&&!o.checked))elements['game-select'].listeners.change({target:{dataset:{gameId:option.id},checked:true}});
 for(const option of options.filter(o=>!wanted.has(o.id)&&o.checked))elements['game-select'].listeners.change({target:{dataset:{gameId:option.id},checked:false}});
}
function tapMetric(elements,group,key){elements[group].listeners.click({target:{closest:()=>({dataset:{metric:key}})}});}
function checkAttempts(elements,n){tapMetric(elements,'quick-read','quick-stealtendency');assert.match(elements['quick-detail'].innerHTML,new RegExp('<dt>Attempts</dt><dd class="num">'+n+'</dd>'));}
(async()=>{
 // Production exposes only Hitting and Pitching.
 assert(!/id="(?:view-log|view-guide|tab-log|close-help|view-contact|tab-contact|expand-field|batter-gallery)"|function renderLog|function pitchDetails/.test(html),'Deleted History and guide presentation stays removed');
 assert(!html.includes('id="help-button"'));
 const scoutOnly=await openApp({}),SO=scoutOnly.elements;
 assert.equal(SO.app.hidden,false);assert.equal(SO['view-navigation'].hidden,false);
 assert.equal(SO['view-scout'].hidden,false);
 SO['tab-pitching'].click();assert.equal(SO.app.lastScroll.top,0);assert.equal(SO['view-pitching'].hidden,false);assert.equal(SO['batter-header'].hidden,true);assert.match(SO['pitcher-context'].textContent,/No pitching summary/);SO['tab-scout'].click();assert.equal(SO['view-scout'].hidden,false);assert.equal(SO['batter-header'].hidden,false);
 const pitchingData=JSON.parse(fs.readFileSync(path.join(root,'data/dig-in-gribbin-14u.json')));
 const pitchingApp=await openApp({files:{'teams.json':{schema_version:1,teams:[{id:pitchingData.team.id,name:pitchingData.team.name,data_file:'data/pitching.json'}]},'data/pitching.json':pitchingData}}),PE=pitchingApp.elements;
 PE['tab-pitching'].click();assert.match(PE['pitcher-context'].textContent,/31 games/);assert.match(PE['pitching-tracked-context'].textContent,/562 batters faced/);
 PE['pitcher-select'].value='wesley hurt';PE['pitcher-select'].listeners.change();assert.match(PE['pitcher-select'].innerHTML,/#11 Wesley Hurt/);assert.match(PE['pitching-summary'].innerHTML,/Strike %/);
 assert.match(PE['pitching-summary'].innerHTML,/aria-controls="pitching-strikeout-detail"/);assert.equal(PE['pitching-strikeout-detail'].hidden,true);
 PE['pitching-summary'].listeners.click({target:{closest:selector=>selector==='#pitching-strikeout-toggle'?{}:null}});assert.equal(PE['pitching-strikeout-detail'].hidden,false);assert.match(PE['pitching-strikeout-detail'].innerHTML,/Looking/);assert.match(PE['pitching-strikeout-detail'].innerHTML,/Swinging/);assert.doesNotMatch(PE['pitching-strikeout-detail'].innerHTML,/tracked strikeouts|linked sequences|Box-score totals/);
 PE['pitching-summary'].listeners.click({target:{closest:selector=>selector==='#pitching-strikeout-toggle'?{}:null}});assert.equal(PE['pitching-strikeout-detail'].hidden,true);
 PE['pitching-summary'].listeners.click({target:{closest:selector=>selector==='#pitching-strike-toggle'?{}:null}});assert.equal(PE['pitching-strike-detail'].hidden,false);assert.equal(PE['pitching-strikeout-detail'].hidden,true);assert.match(PE['pitching-strike-detail'].innerHTML,/Swinging strikes/);assert.doesNotMatch(PE['pitching-tendencies'].innerHTML,/Swinging strikes/);
 assert.match(PE['pitching-avg'].innerHTML,/AVG against/);assert.doesNotMatch(PE['pitching-tendencies'].innerHTML,/AVG against/);assert.equal((PE['pitching-tendencies'].innerHTML.match(/class="pitching-metric(?: pitching-disclosure)?"/g)||[]).length,3);
 assert.match(PE['pitching-outcome-bars'].innerHTML,/Called strikes/);assert.match(PE['pitching-outcome-bars'].innerHTML,/Swinging strikes/);assert.match(PE['pitching-outcome-sample'].textContent,/tracked pitches/);
 chooseGames(PE,pitchingData.games[0].id);assert.match(PE['pitcher-context'].textContent,/1 game · 13 batters faced · 47 pitches/);
 PE['pitcher-select'].value='all';PE['pitcher-select'].listeners.change();assert.equal(PE['pitcher-leaders'].hidden,false);assert.match(PE['pitcher-leaders'].innerHTML,/Most used/);assert.match(PE['pitcher-leaders'].innerHTML,/Strikeout leader/);
 PE['pitcher-leaders'].listeners.click({target:{closest:()=>({dataset:{pitcher:'quinn kasprzak'}})}});assert.equal(PE['pitcher-select'].value,'quinn kasprzak');assert.equal(PE['pitcher-leaders'].hidden,true);
 assert.equal(PE['pitching-outcome-sample'].textContent,'41 tracked pitches');
 PE['pitching-tendencies'].listeners.click({target:{closest:()=>({})}});assert.equal(PE['pitching-first-strike-detail'].hidden,false);assert.equal(PE['pitching-strike-detail'].hidden,true);assert.match(PE['pitching-first-strike-detail'].innerHTML,/FPSO% · Outs/);assert.match(PE['pitching-first-strike-detail'].innerHTML,/FPSW% · Walks/);assert.match(PE['pitching-first-strike-detail'].innerHTML,/FPSH% · Hits/);assert.match(PE['pitching-first-strike-detail'].innerHTML,/4\/6/);PE['pitching-tendencies'].listeners.click({target:{closest:()=>({})}});assert.equal(PE['pitching-first-strike-detail'].hidden,true);
 const twoPitchGames=[pitchingData.games[0].id,pitchingData.games[1].id];
 chooseGames(PE,twoPitchGames);assert.equal(PE['pitcher-select'].value,'quinn kasprzak');assert.match(PE['game-selection-summary'].textContent,/2 of 31 games selected/);
 PE['pitcher-select'].value='all';PE['pitcher-select'].listeners.change();assert.match(PE['pitcher-context'].textContent,/2 games/);
 assert.equal(PE['pitching-outcome-sample'].textContent,'88 tracked pitches');
 chooseGames(PE,'all');
 PE['tab-scout'].click();assert.equal(PE['batter-header'].hidden,false);

 assert(!html.includes('Pitch tendencies use linked plays only.'));assert(!html.includes('0% Recorded zero'));assert.match(html,/pitching-summary-group:has\(>#pitching-strike-detail:not\(\[hidden\]\)\)/);
 assert(!/type="file"|Open JSON files|localData|FileReader/.test(html),'No manual import interface or fallback');
 const {elements:E,requested}=await openApp();
 for(const view of ['scout','pitching']){assert.equal(E['tab-'+view].hidden,false);assert.equal(E['tab-'+view].disabled,false);}
 E['tab-scout'].click();
 assert(html.indexOf('id="scout-field"')<html.indexOf('id="hitting-contact-bars"'));assert.doesNotMatch(E['batting-stats'].innerHTML,/H \/ AB/);assert.match(E['batting-stats'].innerHTML,/5\/23<\/small>/);assert.equal(E['sample-label'].hidden,true);
 assert.equal(E['tab-scout'].tabIndex,0);assert.equal(E['view-scout'].hidden,false);
 E['filter-toggle'].click();assert.equal(E['filter-panel'].hidden,false);assert.equal(E['filter-toggle'].attrs['aria-expanded'],'true');
 E['filter-toggle'].click();assert.equal(E['filter-panel'].hidden,true);
 E['tab-scout'].click();assert.equal(E['view-scout'].hidden,false);
 assert.equal(E.app.hidden,false);assert.equal(E.status.hidden,true);
 assert.doesNotMatch(html,/Tap a stat with/);assert.doesNotMatch(html,/text-decoration:underline dotted/);
 assert(!html.includes('id="scout-map-caption"'));assert.match(E['contact-profile-sample'].textContent,/19 fair contacts/);assert.match(E['hitting-contact-bars'].innerHTML,/Line drives/);assert.match(E['quick-read'].innerHTML,/metric-info/);assert.equal(E['batting-detail'].hidden,true);
 tapMetric(E,'batting-stats','batting-slg');assert.match(E['batting-detail'].innerHTML,/Extra-base hits/);assert.match(E['batting-detail'].innerHTML,/Doubles/);assert.equal(E['batting-detail'].dataset.row,'first');assert.equal(E['quick-detail'].hidden,true);
 assert.doesNotMatch(E['batting-stats'].innerHTML,/data-metric="batting-(avg|bb|k)"/);
 assert.equal((E['batting-stats'].innerHTML.match(/class="metric-info"/g)||[]).length,2);
 assert.match(E['batting-stats'].innerHTML,/3\/26<\/small>/);assert.match(E['batting-stats'].innerHTML,/4\/26<\/small>/);
 tapMetric(E,'batting-stats','batting-obp');assert.equal(E['batting-detail'].dataset.row,'first');assert.match(E['batting-detail'].innerHTML,/Walks/);
 assert.doesNotMatch(E['quick-read'].innerHTML,/data-metric="quick-(groundballs|linedrives|1stpitchswing)"/);
 assert.equal((E['quick-read'].innerHTML.match(/metric-static/g)||[]).length,3);
 assert.equal((E['quick-read'].innerHTML.match(/class="metric-subcount"/g)||[]).length,4);
 assert.equal((E['quick-read'].innerHTML.match(/class="metric-info"/g)||[]).length,1);
 assert.match(E['quick-read'].innerHTML,/12\/26<\/small>/);
 assert.match(E['quick-read'].innerHTML,/Pitches \/ PA/);assert.match(E['quick-read'].innerHTML,/104\/26 PA/);assert.match(E['quick-read'].innerHTML,/>4\.0<\/strong>/);
 assert.match(E['quick-read'].innerHTML,/Whiff rate/);assert.match(E['quick-read'].innerHTML,/16\/52 swings/);assert.doesNotMatch(E['quick-read'].innerHTML,/data-metric="quick-whiffrate"/);
 tapMetric(E,'quick-read','quick-stealtendency');assert.equal(E['batting-detail'].hidden,true);assert.equal(E['quick-detail'].hidden,false);assert.match(E['quick-detail'].innerHTML,/Attempts/);
 tapMetric(E,'quick-read','quick-stealtendency');assert.equal(E['quick-detail'].hidden,true);

 assert.doesNotMatch(E['quick-read'].innerHTML,/Percentage =|attempts\/game|Reaches exclude/);

 assert.deepEqual(requested.map(r=>r.url),['https://diamond-scout.test/teams.json','https://diamond-scout.test/data/shockers-14u.json']);
 assert.equal(E['page-title'].textContent,'Shockers 14U');assert.match(E['scout-field'].innerHTML,/19 fair contacts/);

 assert(!html.includes('id="area-totals"'));assert(!html.includes('id="location-note"'));
 chooseGames(E,data.games[0].id);
 assert.equal(E['game-selection-summary'].textContent,'All recorded games');
 chooseGames(E,'all');
 E['batter-select'].value='shockers-14u-matthew-chernoff';E['batter-select'].listeners.change();
 assert.match(E['scout-field'].innerHTML,/3 fair contacts/);
 E['contact-select'].value='ground_ball';E['contact-select'].listeners.change();
 assert.match(E['scout-field'].innerHTML,/2 fair contacts/);

 E['batter-select'].value='all';E['batter-select'].listeners.change();assert.equal(E['batter-select'].value,'all');
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

 assert.doesNotMatch(described.elements['scout-field'].innerHTML,/<path[^>]+fill="var\(--heat-/);
 // Unknown terminal counts remain supported in the retained Approach view.
 const sparse=clone(data),pitch=sparse.plate_appearances[0].pitches[0];pitch.count_before=null;pitch.pitch_type='<script>bad</script>';pitch.location={zone:'<img src=x>'};pitch.velocity_mph=72;
 const sparseApp=await openApp({files:{'teams.json':manifest,'data/shockers-14u.json':sparse}});

 // A source-supplied foul catch renders separately and respects every contact filter.
 const foulData=clone(data),foulPA=clone(data.plate_appearances[0]);foulPA.id='synthetic-foul';foulPA.sequence=27;foulPA.result='foul_out';foulPA.batted_ball=null;
 foulPA.pitches[0].outcome='foul_out';foulPA.pitches[0].count_after=null;foulPA.source_text='Synthetic catch in left foul territory.';
 foulPA.foul_contact={contact_type:'fly_ball',fielding_position:'3B',location:{zone:'left_foul_territory',precision:'described_area',depth:null},source_text:foulPA.source_text};
 foulData.plate_appearances.push(foulPA);
 const foulApp=await openApp({files:{'teams.json':manifest,'data/shockers-14u.json':foulData}}),F=foulApp.elements;
 assert.match(F['scout-field'].innerHTML,/19 fair contacts/);

 F['contact-select'].value='foul_out';F['contact-select'].listeners.change();assert.match(F['scout-field'].innerHTML,/0 fair contacts/);
 F['contact-select'].value='fair_contact';F['contact-select'].listeners.change();assert.match(F['scout-field'].innerHTML,/19 fair contacts/);
 F['contact-select'].value='all';F['contact-select'].listeners.change();F['batter-select'].value='shockers-14u-owen-keeton';F['batter-select'].listeners.change();
 // Preserve the prior two-game interaction regression, then check full history below.
 const current=await openApp({files:{'teams.json':manifest,'data/shockers-14u.json':previousHistory}}),C=current.elements;
 C['batter-select'].value='shockers-14u-jackson-zangrilli';C['batter-select'].listeners.change();
 assert.match(C['quick-read'].innerHTML,/Steal tendency/);assert.match(C['quick-read'].innerHTML,/Steal tendency: 25%; 1\/4 trips; show details/);
 C['contact-select'].value='ground_ball';C['contact-select'].listeners.change();assert.match(C['quick-read'].innerHTML,/Steal tendency: 25%; 1\/4 trips; show details/);
 chooseGames(C,'supplied-game-001');checkAttempts(C,0);assert.doesNotMatch(C['quick-read'].innerHTML,/Steal tendency: 25%; 1\/4 trips; show details/);
 chooseGames(C,'all');C['contact-select'].value='all';C['contact-select'].listeners.change();
 C['batter-select'].value='shockers-14u-nate-henson';C['batter-select'].listeners.change();checkAttempts(C,0);assert.match(C['quick-read'].innerHTML,/Steal tendency: 0%; 0\/4 trips; show details/);
 C['batter-select'].value='shockers-14u-blake-weber';C['batter-select'].listeners.change();
 assert.equal(C['batter-context'].textContent,'6 PA · 2 games');
 assert(!html.includes('leader-strip'));
 assert.equal((C['scout-field'].innerHTML.match(/class="fielder-count"/g)||[]).length,8);
 assert.match(C['scout-field'].innerHTML,/class="fielder-count"[^>]+>1<\/text>/);
 assert.match(C['scout-field'].innerHTML,/class="contact-total-value"[^>]+>3<\/text>/);
 assert.match(C['hitting-contact-bars'].innerHTML,/67%/);assert.match(C['quick-read'].innerHTML,/50%/);

 assert.match(C['batting-stats'].innerHTML,/\.333/);assert.match(C['batting-stats'].innerHTML,/\.667/);

 assert.match(C['batting-stats'].innerHTML,/BB%/);assert.match(C['batting-stats'].innerHTML,/33%/);assert.match(C['batting-stats'].innerHTML,/K%/);assert.match(C['batting-stats'].innerHTML,/0%/);
 assert(!html.includes('id="view-pitches"'));assert(!html.includes('id="tab-pitches"'));assert(!html.includes('function renderPitches'));assert(!html.includes('function renderOutcomes'));
 assert.match(C['quick-read'].innerHTML,/<button type="button" class="scout-metric"/);
 assert(!html.includes('id="recent-appearances"'));assert(!html.includes('id="open-history"'));assert(!html.includes('id="batting-details"'));

 C['contact-select'].value='ground_ball';C['contact-select'].listeners.change();
 assert.match(C['scout-field'].innerHTML,/2 fair contacts/);
 assert.match(C['scout-field'].innerHTML,/class="contact-total-value"[^>]+>2<\/text>/);

 chooseGames(C,'supplied-game-001');
 chooseGames(C,'all');C['contact-select'].value='all';C['contact-select'].listeners.change();
 C['batter-select'].value='all';C['batter-select'].listeners.change();
 assert.match(C['scout-field'].innerHTML,/35 fair contacts/);

 assert.match(C['game-select'].innerHTML,/2026-08-30 · 10:00 AM/);
 chooseGames(C,'2026-08-30-1000-shockers-vs-gambrills');
 assert.match(C['scout-field'].innerHTML,/16 fair contacts/);assert.match(C['filter-context'].textContent,/10:00 AM/);

 // Checkbox selection combines games and survives refresh without caching JSON.
 const multiStore={},multiFiles={'teams.json':manifest,'data/shockers-14u.json':history};
 const multiApp=await openApp({storage:multiStore,files:multiFiles}),ME=multiApp.elements;
 chooseGames(ME,['supplied-game-001','2026-08-30-1000-shockers-vs-gambrills']);
 assert.equal(ME['game-selection-summary'].textContent,'2 of 3 games selected');assert.match(ME['scout-field'].innerHTML,/35 fair contacts/);assert.match(ME['batter-context'].textContent,/60 PA · 2 games · 1 incomplete/);
 assert.equal((ME['game-select'].innerHTML.match(/ checked/g)||[]).length,2);
 const listedIds=[...ME['game-select'].innerHTML.matchAll(/data-game-id="([^"]+)"/g)].map(m=>m[1]);const expectedGames=[...history.games].sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.start_time||'').localeCompare(a.start_time||''));assert.deepEqual(listedIds,expectedGames.map(g=>g.id));
 ME['tab-pitching'].click();assert.match(ME['filter-context'].textContent,/2 of 3 games selected/);ME['tab-scout'].click();
 const multiRefresh=await openApp({storage:multiStore,files:multiFiles});assert.equal(multiRefresh.elements['game-selection-summary'].textContent,'2 of 3 games selected');assert.equal(multiRefresh.requested.length,2);
 ME['game-select'].listeners.change({target:{dataset:{gameId:'supplied-game-001'},checked:false}});assert.match(ME['scout-field'].innerHTML,/16 fair contacts/);
 ME['games-clear'].click();assert.equal(ME['game-selection-summary'].textContent,'No games selected');assert.match(ME['scout-field'].innerHTML,/0 fair contacts/);assert.doesNotMatch(ME['quick-read'].innerHTML,/>0%<|NaN|Infinity/);
 const emptyRefresh=await openApp({storage:multiStore,files:multiFiles});assert.equal(emptyRefresh.elements['game-selection-summary'].textContent,'No games selected');
 ME['games-all'].click();assert.equal(ME['game-selection-summary'].textContent,'All recorded games');assert.match(ME['scout-field'].innerHTML,/61 fair contacts/);
 const staleKey=Object.keys(multiStore)[0];multiStore[staleKey]=JSON.stringify({team:history.team.id,batter:'all',games:['deleted-game','supplied-game-001']});
 const partialRestore=await openApp({storage:multiStore,files:multiFiles});assert.match(partialRestore.elements['scout-field'].innerHTML,/19 fair contacts/);
 multiStore[staleKey]=JSON.stringify({team:history.team.id,batter:'all',games:['deleted-game']});assert.equal((await openApp({storage:multiStore,files:multiFiles})).elements['game-selection-summary'].textContent,'All recorded games');
 // Compact active-filter indicator tracks game/contact filters for the current tab.
 assert.equal(ME['filter-toggle'].dataset.active,'false');assert.equal(ME['filter-active-badge'].hidden,true);
 chooseGames(ME,['supplied-game-001','2026-08-30-1000-shockers-vs-gambrills']);
 assert.equal(ME['filter-toggle'].dataset.active,'true');assert.equal(ME['filter-active-badge'].textContent,'2');
 ME['filter-toggle'].click();assert.equal(ME['filter-panel'].hidden,false);ME['filters-done'].click();assert.equal(ME['filter-panel'].hidden,true);assert.equal(ME['filter-toggle'].attrs['aria-expanded'],'false');assert.equal(ME['game-selection-summary'].textContent,'2 of 3 games selected');assert.match(ME['filter-toggle'].attrs['aria-label'],/2 of 3 games/);
 ME['filter-toggle'].click();ME['filter-toggle'].click();assert.equal(ME['filter-active-badge'].hidden,false,'Closing filters keeps active selection visible');
 ME['games-clear'].click();assert.equal(ME['filter-active-badge'].textContent,'0');ME['games-all'].click();
 ME['contact-select'].value='ground_ball';ME['contact-select'].listeners.change();assert.equal(ME['filter-active-badge'].textContent,'•');assert.match(ME['filter-toggle'].attrs['aria-label'],/Ground ball/);
 ME['tab-pitching'].click();assert.equal(ME['filter-active-badge'].hidden,true,'Hidden contact filter does not affect pitching');
 ME['tab-scout'].click();assert.equal(ME['filter-active-badge'].hidden,false);ME['contact-select'].value='all';ME['contact-select'].listeners.change();assert.equal(ME['filter-active-badge'].hidden,true);
 // Player arrows use dropdown order and wrap through players without returning to team totals.
 const navApp=await openApp(),NE=navApp.elements;
 NE['batter-next'].click();assert.equal(NE['batter-select'].value,data.players[0].id);
 NE['batter-previous'].click();assert.equal(NE['batter-select'].value,data.players.at(-1).id);
 NE['batter-next'].click();assert.equal(NE['batter-select'].value,data.players[0].id);
 NE['batter-select'].value=data.players[1].id;NE['batter-select'].listeners.change();NE['batter-next'].click();assert.equal(NE['batter-select'].value,data.players[2].id);
 assert.equal(NE.app.lastScroll,undefined,'Player arrows never scroll away from the current field');
 NE['games-clear'].click();assert.equal(NE['batter-select'].value,'all');assert.equal(NE['batter-next'].disabled,true);
 assert.equal(NE['pitcher-next'].disabled,true);assert.equal(NE['pitcher-previous'].disabled,true);
 const singlePlayer={...data,players:[data.players[0]],plate_appearances:data.plate_appearances.filter(p=>p.batter_id===data.players[0].id)};
 const onePlayer=await openApp({files:{'teams.json':manifest,'data/shockers-14u.json':singlePlayer}});onePlayer.elements['batter-next'].click();assert.equal(onePlayer.elements['batter-next'].disabled,true);assert.equal(onePlayer.elements['batter-previous'].disabled,true);
 const pitchNav=await openApp({files:{'teams.json':{schema_version:1,teams:[{id:pitchingData.team.id,name:pitchingData.team.name,data_file:'data/pitching.json'}]},'data/pitching.json':pitchingData}}),PN=pitchNav.elements;
 const pitcherIds=[...PN['pitcher-select'].innerHTML.matchAll(/<option value="([^"]+)"/g)].map(m=>m[1]).filter(id=>id!=='all');
 PN['pitcher-next'].click();assert.equal(PN['pitcher-select'].value,pitcherIds[0]);PN['pitcher-previous'].click();assert.equal(PN['pitcher-select'].value,pitcherIds.at(-1));PN['pitcher-next'].click();assert.equal(PN['pitcher-select'].value,pitcherIds[0]);
 chooseGames(PN,[]);assert.equal(PN['pitcher-select'].value,'all');assert.equal(PN['pitcher-next'].disabled,true);assert.equal(PN['pitcher-previous'].disabled,true);
 // Player options follow recorded participation across all selected games.
 const participantData=clone(data);participantData.players.push({id:'other-only-player',name:'Other Game Only'},{id:'roster-only-bench',name:'Roster Only Bench'});participantData.games.push({id:'other-only-game',opponent:'Other opponent',date:'2026-09-01'});participantData.plate_appearances.push({...clone(data.plate_appearances[0]),id:'other-only-pa',game_id:'other-only-game',batter_id:'other-only-player'});
 const participantApp=await openApp({files:{'teams.json':manifest,'data/shockers-14u.json':participantData}}),PA=participantApp.elements;
 assert.match(PA['batter-select'].innerHTML,/Other Game Only/);assert.doesNotMatch(PA['batter-select'].innerHTML,/Roster Only Bench/);
 PA['batter-select'].value='other-only-player';PA['batter-select'].listeners.change();chooseGames(PA,data.games[0].id);
 assert.equal(PA['batter-select'].value,'all');assert.doesNotMatch(PA['batter-select'].innerHTML,/other-only-player/);
 PA['batter-previous'].click();assert.equal(PA['batter-select'].value,data.players.at(-1).id);PA['batter-next'].click();assert.equal(PA['batter-select'].value,data.players[0].id);
 const activeOptions=PA['batter-select'].innerHTML;PA['contact-select'].value='ground_ball';PA['contact-select'].listeners.change();assert.equal(PA['batter-select'].innerHTML,activeOptions,'Contact type does not change game participation');
 chooseGames(PA,['other-only-game']);assert.equal(PA['batter-select'].value,'all');assert.equal((PA['batter-select'].innerHTML.match(/<option/g)||[]).length,2);PA['batter-next'].click();assert.equal(PA['batter-select'].value,'other-only-player');
 PA['games-all'].click();assert.match(PA['batter-select'].innerHTML,/Other Game Only/);assert.doesNotMatch(PA['batter-select'].innerHTML,/Roster Only Bench/);
 chooseGames(PN,pitchingData.games[0].id);assert.match(PN['pitcher-select'].innerHTML,/Wesley Hurt/);assert.match(PN['pitcher-select'].innerHTML,/Quinn Kasprzak/);assert.doesNotMatch(PN['pitcher-select'].innerHTML,/Dean Simmons/);
 PN['pitcher-next'].click();assert.equal(PN['pitcher-select'].value,'wesley hurt');PN['pitcher-next'].click();assert.equal(PN['pitcher-select'].value,'quinn kasprzak');PN['pitcher-next'].click();assert.equal(PN['pitcher-select'].value,'wesley hurt');
 PN['pitcher-select'].value='quinn kasprzak';PN['pitcher-select'].listeners.change();chooseGames(PN,pitchingData.games[1].id);assert.equal(PN['pitcher-select'].value,'all');assert.doesNotMatch(PN['pitcher-select'].innerHTML,/Quinn Kasprzak/);
 PN['games-clear'].click();assert.equal((PN['pitcher-select'].innerHTML.match(/<option/g)||[]).length,1);assert.equal(PN['pitcher-next'].disabled,true);
 // Full repository history includes September without changing earlier regression fixtures.
 const metroApp=await openApp({files:{'teams.json':manifest,'data/shockers-14u.json':history}}),M=metroApp.elements;
 assert.match(M['scout-field'].innerHTML,/61 fair contacts/);assert.match(M['quick-read'].innerHTML,/Steal tendency: 14%; 7\/50 trips; show details/);
 chooseGames(M,'2026-09-13-shockers-vs-metro-senators-central');
 assert.match(M['scout-field'].innerHTML,/26 fair contacts/);
 assert.match(M['filter-context'].textContent,/2026-09-13/);assert.match(M['game-select'].innerHTML,/Metro Senators 14U Central/);assert.match(M['quick-read'].innerHTML,/Steal tendency: 22%; 4\/18 trips; show details/);
 M['batter-select'].value='shockers-14u-logan-sumrow';M['batter-select'].listeners.change();
 assert.equal(M['batter-context'].textContent,'2 PA · 1 game · 1 incomplete');
 assert.match(M['batting-stats'].innerHTML,/3.000/);assert.match(M['quick-read'].innerHTML,/Steal tendency: 100%; 1\/1 trips; show details/);

 M['batter-select'].value='shockers-14u-jackson-zangrilli';M['batter-select'].listeners.change();assert.match(M['quick-read'].innerHTML,/Steal tendency: 50%; 1\/2 trips; show details/);
 M['contact-select'].value='ground_ball';M['contact-select'].listeners.change();assert.match(M['quick-read'].innerHTML,/Steal tendency: 50%; 1\/2 trips; show details/);checkAttempts(M,2);assert.doesNotMatch(M['quick-read'].innerHTML,/attempts\/game|Percentage =/);

 // Attempts include caught steals and unknown outcomes; neither is a new on-base visit.
 const stealFixture=clone(previousHistory),stealEvent=stealFixture.baserunning_events[0];
 stealFixture.baserunning_events.push({...stealEvent,id:'synthetic-display-caught',result:'caught_stealing',source_text:'Synthetic caught-stealing display fixture.'});
 const stealApp=await openApp({files:{'teams.json':manifest,'data/shockers-14u.json':stealFixture}}),S=stealApp.elements;
 S['batter-select'].value=stealEvent.runner_id;S['batter-select'].listeners.change();
 assert.match(S['quick-read'].innerHTML,/Steal tendency: 50%; 1\/2 trips; show details/);
 assert.match(S['quick-read'].innerHTML,/aria-label="Steal tendency: 50%/);
 stealFixture.baserunning_events.push({...stealEvent,id:'synthetic-display-unknown',result:'unknown',to_base:null});
 const unknownSteals=await openApp({files:{'teams.json':manifest,'data/shockers-14u.json':stealFixture}}),U=unknownSteals.elements;
 U['batter-select'].value=stealEvent.runner_id;U['batter-select'].listeners.change();assert.match(U['quick-read'].innerHTML,/Steal tendency: 50%; 1\/2 trips; show details/);
 // New manifest team loads its own history; switching resets stale player/game filters.
 const bothTeams=await openApp({files:{'teams.json':manifest,'data/shockers-14u.json':history,'data/gambrills-athletic-club-14u.json':gambrills}}),B=bothTeams.elements;
 assert.match(B['team-select'].innerHTML,/Gambrills Athletic Club 14U/);
 B['team-select'].value=gambrills.team.id;await B['team-select'].listeners.change();
 assert.equal(B['page-title'].textContent,'Gambrills Athletic Club 14U');assert.match(B['scout-field'].innerHTML,/21 fair contacts/);
 assert.match(B['quick-read'].innerHTML,/Steal tendency: 13%; 2\/15 trips/);assert.match(B['game-select'].innerHTML,/2026-08-30 · 10:00 AM/);
 B['batter-select'].value='gambrills-athletic-club-14u-wesson-shepherd';B['batter-select'].listeners.change();assert.match(B['quick-read'].innerHTML,/Steal tendency: 33%; 1\/3 trips/);
 B['contact-select'].value='ground_ball';B['contact-select'].listeners.change();assert.match(B['quick-read'].innerHTML,/Steal tendency: 33%; 1\/3 trips/);

 B['team-select'].value='shockers-14u';await B['team-select'].listeners.change();assert.equal(B['batter-select'].value,'all');assert.equal(B['contact-select'].value,'all');assert.match(B['quick-read'].innerHTML,/Steal tendency: 14%; 7\/50 trips/);
 const missingReach=clone(previousHistory);missingReach.plate_appearances[0].result='unclassified';
 const missingReachApp=await openApp({files:{'teams.json':manifest,'data/shockers-14u.json':missingReach}});
 assert.match(missingReachApp.elements['quick-read'].innerHTML,/Steal tendency: Unavailable; Trip data needs review/);
 // Full current repository: both September 12 sides and standalone runner-only history.
 const allFiles={'teams.json':manifest};for(const team of manifest.teams)allFiles[team.data_file]=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/teams',path.basename(team.data_file))));
 allFiles['data/shockers-14u.json']=repositoryHistory;
 const actual=await openApp({files:allFiles}),A=actual.elements;
 assert.match(A['quick-read'].innerHTML,/Steal tendency: 16%; 11\/70 trips/);
 chooseGames(A,september12);assert.match(A['scout-field'].innerHTML,/22 fair contacts/);
 A['team-select'].value='stars-camarata-14u';await A['team-select'].listeners.change();assert.equal(A['page-title'].textContent,'Stars Camarata 14U');assert.match(A['scout-field'].innerHTML,/20 fair contacts/);assert.match(A['scout-field'].innerHTML,/data-position="C"/);assert.match(A['quick-read'].innerHTML,/Steal tendency: 27%; 3\/11 trips/);
 A['batter-select'].value='stars-camarata-14u-mark-trey-poncy';A['batter-select'].listeners.change();
 A['batter-select'].value='stars-camarata-14u-logan-pinkerton';A['batter-select'].listeners.change();assert.match(A['quick-read'].innerHTML,/Steal tendency: 50%; 1\/2 trips/);
 A['batter-select'].value='stars-camarata-14u-kyle-reynolds';A['batter-select'].listeners.change();A['contact-select'].value='fly_ball';A['contact-select'].listeners.change();assert.match(A['scout-field'].innerHTML,/data-position="C"/);assert.match(A['scout-field'].innerHTML,/1 fair contacts/);
 // The captured October game is available for both teams, including unusual scoring.
 const octoberFiles={'teams.json':manifest};for(const team of manifest.teams)octoberFiles[team.data_file]=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/teams',path.basename(team.data_file))));
 const october=await openApp({files:octoberFiles}),O=october.elements;
 O['team-select'].value='dig-in-gribbin-14u';await O['team-select'].listeners.change();const octDig=octoberFiles['data/dig-in-gribbin-14u.json'].games.find(g=>g.source_event_id==='bbd7b60b-a503-4abf-8dfe-91e7105aabc5');assert(octDig);chooseGames(O,octDig.id);assert.equal(O['page-title'].textContent,'Dig In (Gribbin) 14U');assert.match(O['scout-field'].innerHTML,/13 fair contacts/);assert.match(O['quick-read'].innerHTML,/Steal tendency: 38%; 3\/8 trips/);assert.match(O['batting-stats'].innerHTML,/\.278/);
 O['batter-select'].value='dig-in-gribbin-14u-declan-class';O['batter-select'].listeners.change();assert.match(O['quick-read'].innerHTML,/Steal tendency: 100%; 1\/1 trips/);checkAttempts(O,2);
 O['contact-select'].value='ground_ball';O['contact-select'].listeners.change();assert.match(O['quick-read'].innerHTML,/Steal tendency: 100%; 1\/1 trips/);
 O['team-select'].value='bba-14u-east';await O['team-select'].listeners.change();const octBba=octoberFiles['data/bba-14u-east.json'].games.find(g=>g.source_event_id==='bbd7b60b-a503-4abf-8dfe-91e7105aabc5');assert(octBba);chooseGames(O,octBba.id);assert.match(O['scout-field'].innerHTML,/16 fair contacts/);assert.match(O['quick-read'].innerHTML,/Steal tendency: 0%; 0\/15 trips/);assert.match(O['game-select'].innerHTML,/2026-10-25 · 10:00 AM/);
 O['batter-select'].value='bba-14u-east-ben-thorn';O['batter-select'].listeners.change();assert.equal(O['batter-context'].textContent,'2 PA · 1 game · 1 incomplete');
 // One unresolved out must not blank every available batting value or disappear from history.
 const partialHistory=clone(data),partialBatter=data.players[0].id,otherBatter=data.players.find(p=>p.id!==partialBatter).id;
 const partialPA=(id,result,batter,status='complete')=>({...clone(data.plate_appearances[0]),id,batter_id:batter,status,result,pitches:[],batted_ball:null,source_text:'Synthetic partial-stat fixture '+result});
 partialHistory.plate_appearances=[partialPA('known-hit','single',partialBatter),partialPA('known-walk','walk',otherBatter),{...partialPA('other-out','batter_out',partialBatter),reached_base:false},partialPA('unfinished','unknown',partialBatter,'incomplete')];
 const partialApp=await openApp({files:{'teams.json':manifest,'data/shockers-14u.json':partialHistory}}),partialE=partialApp.elements;
 assert.match(partialE['batting-stats'].innerHTML,/AVG\*/);assert.match(partialE['batting-stats'].innerHTML,/1\.000/);assert.match(partialE['batting-stats'].innerHTML,/1\/1/);assert.match(partialE['batting-stats'].innerHTML,/50%/);assert.match(partialE['batting-stats'].innerHTML,/0%/);
 assert.equal(partialE['batting-note'].hidden,false);assert.match(partialE['batting-note'].innerHTML,/Stats use 2 of 3 completed PAs; 1 result needs review/);assert.match(partialE['batting-note'].innerHTML,/<summary>1 PA needs review ⓘ<\/summary>/);
 assert.match(partialE['batting-stats'].attrs['aria-label'],/2 of 3 classified/);
 const partialMarkup=partialE['batting-stats'].innerHTML;partialE['contact-select'].value='ground_ball';partialE['contact-select'].listeners.change();assert.equal(partialE['batting-stats'].innerHTML,partialMarkup);
 partialE['batter-select'].value=otherBatter;partialE['batter-select'].listeners.change();assert.equal(partialE['batting-note'].hidden,true);assert.doesNotMatch(partialE['batting-stats'].innerHTML,/AVG\*/);assert.match(partialE['batting-stats'].innerHTML,/100%/);
 const unknownOnly=clone(partialHistory);unknownOnly.plate_appearances=[partialHistory.plate_appearances[2]];
 const unknownOnlyApp=await openApp({files:{'teams.json':manifest,'data/shockers-14u.json':unknownOnly}});assert.match(unknownOnlyApp.elements['batting-note'].innerHTML,/Stats use 0 of 1/);assert.doesNotMatch(unknownOnlyApp.elements['batting-stats'].innerHTML,/0\/0|NaN|Infinity/);assert.equal((unknownOnlyApp.elements['batting-stats'].innerHTML.match(/>—<\/strong>/g)||[]).length,5);
 // Pitches recorded before a runner-only pickoff count for the team, without invented batter stats.
 const orphanHistory=clone(data);orphanHistory.runner_outs=[{id:'orphan-out',game_id:data.games[0].id,runner_id:data.players[0].id,inning:1,half:'top',reason:'picked_off',source_text:'Synthetic runner-only pickoff.',source_pitch_sequence:'Ball 1.',batter_id:null,pitches:[{sequence:1,outcome:'ball',count_before:{balls:0,strikes:0},count_after:{balls:1,strikes:0}}]}];
 const orphanApp=await openApp({files:{'teams.json':manifest,'data/shockers-14u.json':orphanHistory}}),orphanE=orphanApp.elements;

 const cleanPitchApp=await openApp();for(const fields of [orphanE,cleanPitchApp.elements]){fields['batter-select'].value=data.players[0].id;fields['batter-select'].listeners.change();}
 // Entry-backed opportunities reach the actual renderer without manufacturing extra batting rows.
 const importer=require('../tools/import-plays.cjs'),placementCore=importer.loadCore(),placementSource=importer.readCapture(fs.readFileSync(path.join(root,'tests/fixtures/captures/2026-10-18-dig-in-dirtbags-capture.txt'),'utf8'));
 const placementTeams=[['placed-dig','Dig In (Gribbin) 14U'],['placed-dirt','SBGC Dirtbags Mid-Atlantic 14U']];
 const placementManifest={schema_version:1,teams:placementTeams.map(([id,name])=>({id,name,data_file:'data/'+id+'.json'}))},placementFiles={'teams.json':placementManifest};
 for(const [id,name] of placementTeams){const d={schema_version:1,team:{id,name},players:[],games:[],plate_appearances:[]};importer.buildTeam(placementSource,name,d,'placed-game-'+id,'Fixture opponent',placementCore);placementFiles['data/'+id+'.json']=d;}
 const placementApp=await openApp({files:placementFiles}),P=placementApp.elements;
 assert.equal(P.app.hidden,false);assert.match(P['quick-read'].innerHTML,/Steal tendency: 50%; 7\/14 trips/);checkAttempts(P,7);
 P['batter-select'].value='placed-dig-deven-downs';P['batter-select'].listeners.change();assert.match(P['quick-read'].innerHTML,/Steal tendency: 75%; 3\/4 trips/);
 P['contact-select'].value='ground_ball';P['contact-select'].listeners.change();assert.match(P['quick-read'].innerHTML,/Steal tendency: 75%; 3\/4 trips/);
 P['team-select'].value='placed-dirt';await P['team-select'].listeners.change();assert.match(P['quick-read'].innerHTML,/Steal tendency: 7%; 1\/14 trips/);
 // A page refresh starts a new application and fetches changed JSON with no-store.
 const refreshedFiles={'teams.json':clone(manifest),'data/shockers-14u.json':clone(history)};refreshedFiles['data/shockers-14u.json'].team.name='Fresh after page refresh';
 const refreshed=await openApp({files:refreshedFiles});assert.equal(refreshed.elements['page-title'].textContent,'Fresh after page refresh');
 assert.equal(refreshed.requested.length,2);assert(refreshed.requested.every(r=>r.options.cache==='no-store'));
 // The app has one fixed palette and no preference storage or theme controls.
 assert(!/DiamondScoutTheme|data-theme|id="theme-select"|diamond-scout-theme/.test(html));
 assert.match(html,/<meta name="theme-color" content="#F4F6F8">/);
 // Persist only selection IDs; every new page still requests current manifest and JSON.
 const savedStore={},savedFiles={'teams.json':manifest,'data/shockers-14u.json':history,'data/gambrills-athletic-club-14u.json':gambrills};
 const firstVisit=await openApp({storage:savedStore,files:savedFiles});firstVisit.elements['team-select'].value='gambrills-athletic-club-14u';await firstVisit.elements['team-select'].listeners.change();
 firstVisit.elements['batter-select'].value='gambrills-athletic-club-14u-wesson-shepherd';firstVisit.elements['batter-select'].listeners.change();
 const freshFiles=clone(savedFiles);freshFiles['data/gambrills-athletic-club-14u.json'].team.name='Fresh Gambrills';
 const restored=await openApp({storage:savedStore,files:freshFiles});assert.equal(restored.elements['batter-select'].value,'gambrills-athletic-club-14u-wesson-shepherd');assert.equal(restored.elements['team-select'].value,'gambrills-athletic-club-14u');assert.equal(restored.elements['page-title'].textContent,'Fresh Gambrills');assert.equal(restored.requested.length,2);
 const savedKey=Object.keys(savedStore)[0];savedStore[savedKey]=JSON.stringify({team:'gambrills-athletic-club-14u',batter:'removed-batter'});
 const missingSavedBatter=await openApp({storage:savedStore,files:savedFiles});assert.equal(missingSavedBatter.elements['batter-select'].value,'all');
 savedStore[savedKey]=JSON.stringify({team:'deleted-team',batter:'deleted-batter'});const missingSavedTeam=await openApp({storage:savedStore});assert.equal(missingSavedTeam.elements['team-select'].value,manifest.teams[0].id);
 savedStore[savedKey]='broken json';assert.equal((await openApp({storage:savedStore})).elements.app.hidden,false);
 assert.equal((await openApp({storageBlocked:true})).elements.app.hidden,false);
 assert.equal((await openApp({storage:savedStore,href:'https://diamond-scout.test/other/'})).elements['batter-select'].value,'all');
 const unavailable=await openApp({files:{'teams.json':manifest,'data/shockers-14u.json':{...data,plate_appearances:[],baserunning_entries:[],baserunning_events:[],runner_outs:[]}}});
 assert.match(unavailable.elements['contact-profile-sample'].textContent,/No fair contact/);assert.match(unavailable.elements['quick-read'].innerHTML,/No first-pitch data/);assert.match(unavailable.elements['quick-read'].innerHTML,/Steal tendency: Unavailable/);assert.doesNotMatch(unavailable.elements['quick-read'].innerHTML,/>0%<|0\/0/);
 assert.match(E['quick-read'].innerHTML,/Steal tendency: 0%; 0\/11 trips|Steal tendency: 0%; 0\//);
 // Jersey prefixes change labels only; selection IDs and saved data remain stable.
 const numbered=clone(data),numberedPlayer=numbered.players[0];numbered.games[0].box_score={source_capture:{teams:[{name:numbered.team.name,tables:[{kind:'batting',columns:['LINEUP','AB'],rows:[[numberedPlayer.name+' #00 (SS)','1']]}]}]}};
 const numberedApp=await openApp({files:{'teams.json':manifest,'data/shockers-14u.json':numbered}});
 assert(numberedApp.elements['batter-select'].innerHTML.includes('value="'+numberedPlayer.id+'">#00 '+numberedPlayer.name+'</option>'));
 numberedApp.elements['batter-select'].value=numberedPlayer.id;numberedApp.elements['batter-select'].listeners.change();assert.equal(numberedApp.elements['batter-select'].value,numberedPlayer.id);
 // Smoke-test the current retained teams separately from fixed historical expectations.
 const runtimeManifest=JSON.parse(fs.readFileSync(path.join(root,'teams.json'))),runtimeFiles={'teams.json':runtimeManifest};
 for(const team of runtimeManifest.teams)runtimeFiles[team.data_file]=JSON.parse(fs.readFileSync(path.join(root,team.data_file)));
 const runtimeApp=await openApp({files:runtimeFiles});assert.equal(runtimeApp.elements.app.hidden,false);
 for(const team of runtimeManifest.teams){runtimeApp.elements['team-select'].value=team.id;await runtimeApp.elements['team-select'].listeners.change();assert.equal(runtimeApp.elements['page-title'].textContent,team.name);assert.equal(runtimeApp.elements.app.hidden,false);}
 console.log('PASS ('+(process.env.DIAMOND_TEST_WIDTH||1280)+'px viewport model): automatic repository JSON loading, subdirectory hosting, file-protocol guidance, page-refresh recovery, pitch summaries, filters, navigation, and safe missing-data rendering.');
})();
