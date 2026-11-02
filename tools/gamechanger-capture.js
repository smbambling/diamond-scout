/* Diamond-Scout: capture already-loaded GameChanger plays in your signed-in browser. */
(async function () {
  'use strict';

  const captureVersion = '1a09c9315faaf685';
  const organizationTeams = [{"id":"14u-black","name":"Rawlings Tigers NOVA — 14U Black"}];

  function tableWarnings(teams){
    return teams.flatMap(team=>['batting','pitching'].filter(kind=>!(team.tables||[]).some(table=>table.kind===kind)).map(kind=>kind[0].toUpperCase()+kind.slice(1)+' table missing for '+team.name+'. Retry capture after both Box score sections finish loading.'));
  }
  function captureFilename({kind='game',date='',time='',teams=[],eventId=''}){
    const slug=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    return ['gamechanger',kind,date||'unknown-date',time?time.replace(':',''):'unknown-time',teams.length?teams.map(name=>slug(name).slice(0,45)||'team').join('-vs-'):'unknown-teams',...(eventId?[slug(eventId).slice(-12)]:[])].join('-')+(kind==='plays'?'.txt':'.json');
  }

  const inningHeading = /^(?:Top|Bottom)\s+\d+(?:st|nd|rd|th)\s*[-–—]\s*\S/im;
  const clean = value => String(value || '').replace(/\r\n?/g, '\n').trim();

  function stripPlaysFooter(text){
    const original=String(text),lines=original.split(/\r?\n/);
    const allowed=/^(?:Get the App|Status|Visit gc\.com|Privacy|Terms|CA Disclosures|Your Privacy Choices|Dick'?s Sporting Goods logo|GameChanger is a proud member of the DICK'S Sporting Goods Family\.|© GameChanger Media, Inc\..*All rights reserved\..*)$/i;
    for(let i=0;i<lines.length;i++){
      if(lines[i].trim()!=='Get the App')continue;
      const tail=lines.slice(i).map(line=>line.trim()).filter(Boolean);
      if(tail.length>=5&&tail[1]==='Status'&&tail[2]==='Visit gc.com'&&tail.includes('Privacy')&&tail.includes('Terms')&&tail.every(line=>allowed.test(line))){
        let start=0;for(let n=0;n<i;n++)start=original.indexOf('\n',start)+1;
        return {plays:original.slice(0,start).trimEnd(),footer:original.slice(start)};
      }
    }
    return {plays:original,footer:null};
  }
  function extractPlays(text) {
    const original = clean(text);
    const match = inningHeading.exec(original);
    if (!match) throw new Error('No inning/team heading found. Open Plays, or select the plays including a heading such as “Top 1st - Team Name”, then try again.');
    // Remove only the recognized trailing site footer; unfamiliar play text is retained.
    return stripPlaysFooter(original.slice(match.index)).plays;
  }

  function inspectPlays(text) {
    const headings = [...clean(text).matchAll(/^(Top|Bottom)\s+(\d+)(?:st|nd|rd|th)\s*[-–—]\s*(.+)$/gim)];
    const teams = [...new Set(headings.map(match => match[3].trim()))];
    return {
      headings: headings.length,
      teams,
      topFirst: headings.some(match => match[1].toLowerCase() === 'top' && Number(match[2]) === 1),
      bottomFirst: headings.some(match => match[1].toLowerCase() === 'bottom' && Number(match[2]) === 1)
    };
  }

  function sourceUrl(value) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !(url.hostname === 'gc.com' || url.hostname.endsWith('.gc.com'))) {
      throw new Error('Run this capture on the GameChanger website after signing in.');
    }
    // Exclude query strings, fragments and any URL credentials from saved files.
    return url.origin + url.pathname;
  }

  function detectGameMetadata(pageText, pageUrl) {
    const text = clean(pageText).replace(/[\u00a0\u202f]/g, ' ');
    const empty = notice => ({ date: '', time: '', timezone: '', needsYearConfirmation: false, notice });
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const weekdays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    let seasonYear = null;
    try {
      const season = new URL(pageUrl).pathname.match(/\/((?:19|20)\d{2})-(?:spring|summer|fall|winter)(?:-|\/)/i);
      if (season) seasonYear = Number(season[1]);
    } catch (_) { /* A URL without a season year provides no year hint. */ }
    const pattern = /\b(?:(Sun(?:day)?|Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?)\s*,?\s+)?(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*|\s+)(?:((?:19|20)\d{2})(?:,\s*|\s+))?(\d{1,2}):(\d{2})\s*([AP])\.?M\.?(?:\s*[-–—]\s*\d{1,2}:\d{2}\s*[AP]\.?M\.?)?(?:\s+(ET|EST|EDT|CT|CST|CDT|MT|MST|MDT|PT|PST|PDT|AKT|AKST|AKDT|HT|HST|UTC|GMT))?\b/gi;
    const candidates = [];
    for (const match of text.matchAll(pattern)) {
      const [, weekday, monthName, dayText, yearText, hourText, minuteText, meridiem, zone] = match;
      const month = months.indexOf(monthName.slice(0, 3).toLowerCase()), day = Number(dayText);
      const hour = Number(hourText), minute = Number(minuteText);
      if (hour < 1 || hour > 12 || minute > 59) continue;
      const time = String((hour % 12) + (meridiem.toUpperCase() === 'P' ? 12 : 0)).padStart(2, '0') + ':' + minuteText;
      const year = yearText ? Number(yearText) : seasonYear;
      let date = '', conflict = false;
      if (year) {
        const value = new Date(Date.UTC(year, month, day));
        const valid = value.getUTCFullYear() === year && value.getUTCMonth() === month && value.getUTCDate() === day;
        const weekdayMatches = !weekday || weekdays[value.getUTCDay()] === weekday.slice(0, 3).toLowerCase();
        if (valid && weekdayMatches) date = value.toISOString().slice(0, 10);
        else conflict = true;
      } else {
        // Validate month/day without manufacturing a game year (2000 permits Feb 29).
        const value = new Date(Date.UTC(2000, month, day));
        if (value.getUTCMonth() !== month || value.getUTCDate() !== day) continue;
      }
      candidates.push({ date, time, timezone: zone ? zone.toUpperCase() : '', needsYearConfirmation: !!date && !yearText, conflict, monthDay: (month + 1) + '/' + day, header: match[0] });
    }
    if (!candidates.length) return empty('Game date/time not detected. Enter known values or leave them blank.');
    const groups = new Set(candidates.map(candidate => (candidate.date || candidate.monthDay) + '|' + candidate.time));
    const zones = new Set(candidates.map(candidate => candidate.timezone).filter(Boolean));
    if (groups.size > 1 || zones.size > 1) return empty('Multiple game dates/times were found. Confirm the intended game and enter its date/time.');
    const chosen = candidates.find(candidate => candidate.date && !candidate.needsYearConfirmation) || candidates[0];
    const timezone = [...zones][0] || '';
    const notice = chosen.conflict ? 'The date and weekday/year disagree. Confirm the full date; the detected start time is editable.' :
      chosen.needsYearConfirmation ? 'Date suggested from the season URL. Confirm the year before export. Start time comes from: ' + chosen.header :
      !chosen.date ? 'Found ' + chosen.header + ', but no game year. Enter the full date or leave it unknown.' : 'Date and start time detected from: ' + chosen.header;
    return { date: chosen.date, time: chosen.time, timezone, needsYearConfirmation: chosen.needsYearConfirmation, monthDay:chosen.monthDay, notice };
  }

  function detectRecapDate(pageText){
    const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    // Match the game heading, not an article publication timestamp or unrelated date.
    const pattern=/^\s*(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2}),?\s+((?:19|20)\d{2})\s+(?:vs\.?|at)\s+([^\n]+)$/gim;
    const candidates=[];
    for(const match of clean(pageText).replace(/[\u00a0\u202f]/g,' ').matchAll(pattern)){
      const month=months.indexOf(match[1].slice(0,3).toLowerCase()),day=Number(match[2]),year=Number(match[3]),value=new Date(Date.UTC(year,month,day));
      if(value.getUTCFullYear()!==year||value.getUTCMonth()!==month||value.getUTCDate()!==day)continue;
      candidates.push({date:value.toISOString().slice(0,10),monthDay:(month+1)+'/'+day,header:match[0].trim()});
    }
    if(!candidates.length)throw Error('No explicit game date found in the Recap heading.');
    if(new Set(candidates.map(c=>c.date)).size!==1)throw Error('Multiple game dates found on Recap.');
    return candidates[0];
  }

  function validateDetectedDate(metadata, date, yearConfirmed) {
    if (metadata.needsYearConfirmation && date && date === metadata.date && !yearConfirmed) {
      throw new Error('Confirm the suggested game year, edit the date, or leave the date blank before exporting.');
    }
  }

  function formatCapture({ text, date = '', time = '', timezone = '', url, team = '', assignTo = [], tournament = '' }) {
    if(typeof tournament!=='string'||tournament.length>160||/[\x00-\x1f\x7f]/.test(tournament))throw Error('Use a single-line tournament name of up to 160 characters.');
    tournament=tournament.trim();
    const plays = extractPlays(text);
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) {
      throw new Error('Use a full game date, including year, or leave it unknown.');
    }
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Use a 24-hour start time, or leave it unknown.');
    if (timezone && (timezone.length > 80 || /[\r\n\u0000]/.test(timezone))) throw new Error('Use a single-line timezone label, or leave it unknown.');
    if (team && (!inspectPlays(plays).teams.includes(team) || /[\r\n]/.test(team))) throw new Error('Choose a team found in the captured plays.');
    if(!Array.isArray(assignTo)||assignTo.some(id=>typeof id!=='string'||!/^[a-z0-9][a-z0-9-]*$/.test(id)))throw Error('Choose valid organization team IDs.');
    return [
      'Use TEAM-DATA-PROMPT.md to add this game',
      team ? 'Import: only ' + team : 'Import: both teams (default)',
      ...(assignTo.length?['Assign to: '+[...new Set(assignTo)].join(', ')]:[]),
      ...(tournament?['Tournament: '+tournament]:[]),
      'Date: ' + (date || 'unknown'),
      'Start time: ' + (time || 'unknown'),
      'Timezone: ' + (timezone || 'unknown'),
      'Source: ' + sourceUrl(url),
      'Capture version: '+captureVersion,
      'Capture coverage: loaded browser text only; completeness not verified.',
      '',
      'PLAY-BY-PLAY',
      plays
    ].join('\n');
  }


  const notePattern = /^(2B|3B|HR|TB|SB|CS|E|SF|SH|HBP|WP|Pitches-Strikes|Batters Faced):\s*(.+)$/;
  const teamKey=value=>clean(value).replace(/\s+/g,' ').replace(/\)\s*(?=\d{1,2}u\b)/gi,') ').toLowerCase();
  function extractBoxNotes(text,knownTeams=[]) {
    const lines=clean(text).split('\n').map(line=>line.trim()).filter(Boolean);
    const inferred=lines.filter(line=>line.length<=120&&!line.includes('@')&&/\b(?:\d{1,2}\s*u|jv|varsity)\b/i.test(line)&&!notePattern.test(line));
    const names=[...new Map([...inferred,...knownTeams].map(name=>[teamKey(name),clean(name)])).values()];
    const teams=[],byName=new Map();let current=null;
    for(let i=0;i<lines.length;i++){
      const name=names.find(name=>teamKey(name)===teamKey(lines[i]));
      if(name){current=name;continue;}
      const match=lines[i].match(notePattern);if(!match)continue;
      // With plain copied text, a non-stat team heading may directly precede notes.
      if(!current){const prior=lines[i-1];if(prior&&!prior.includes('@')&&prior.length<=120&&!/^(?:\d+(?:\.\d+)?|TEAM|LINEUP|PITCHING|AB|R|H|RBI|BB|SO|IP|ER)$/i.test(prior)&&!notePattern.test(prior))current=prior;}
      if(!current)throw Error('Cannot identify a team section for box-score notes. Team headings were not readable; no notes were assigned.');
      const key=teamKey(current);let team=byName.get(key);
      if(!team){team={name:current,notes:[]};byName.set(key,team);teams.push(team);}
      if(!team.notes.includes(lines[i]))team.notes.push(lines[i]);
    }
    if(!teams.length)throw Error('No box-score team notes found. Open Box score and load both team sections.');
    return teams;
  }
  function extractBoxScore(doc,url,knownTeams=[]){
    const linkedNames=[...doc.querySelectorAll('a[href*="/teams/"]')].map(node=>clean(node.textContent)).filter(name=>name.length>2&&name.length<=120&&!name.includes('@')&&!/^(?:home|back to schedule|schedule|support)$/i.test(name));
    const teams=extractBoxNotes(doc.body.innerText,[...knownTeams,...linkedNames]),warnings=[];
    // Read rendered cells directly: text selection can omit non-selectable tables.
    const tables=[...doc.querySelectorAll('table,[role="table"],[role="grid"]')];
    const visible=node=>{const rect=node.getBoundingClientRect();return rect.width>0&&rect.height>0;};
    const headings=[...doc.querySelectorAll('h1,h2,h3,h4,div,span')].filter(node=>visible(node)&&teams.some(t=>teamKey(node.textContent)===teamKey(t.name)));
    for(const team of teams){team.tables=[];}
    for(const table of tables.filter(visible)){
      const rows=[...table.querySelectorAll('tr,[role="row"]')].map(row=>[...row.querySelectorAll('th,td,[role="columnheader"],[role="cell"],[role="gridcell"]')].map(cell=>clean(cell.textContent))).filter(row=>row.length);
      const headerIndex=rows.findIndex(row=>row.includes('AB')||row.includes('IP'));if(headerIndex<0)continue;
      const rect=table.getBoundingClientRect();
      const anchors=headings.map(node=>({node,rect:node.getBoundingClientRect()})).filter(h=>h.rect.top<=rect.top+5&&Math.abs(h.rect.left-rect.left)<Math.max(80,rect.width*.25)).sort((a,b)=>b.rect.top-a.rect.top);
      const anchor=anchors[0];if(!anchor){warnings.push('A table could not be associated with a team; it was not assigned.');continue;}
      teams.find(t=>teamKey(t.name)===teamKey(anchor.node.textContent)).tables.push({kind:rows[headerIndex].includes('AB')?'batting':'pitching',columns:rows[headerIndex],rows:rows.slice(headerIndex+1)});
    }
    warnings.push(...tableWarnings(teams));
    const canvases=[...doc.querySelectorAll('canvas')].filter(visible).length;
    if(canvases)warnings.push(canvases+' visible canvas element(s); canvas-drawn rows cannot be read as text by this helper.');
    return {schema_version:1,capture_version:captureVersion,kind:'diamond-scout-box-score',source_url:sourceUrl(url),source_event_id:new URL(url).pathname.match(/\/schedule\/([^/]+)/)?.[1]||null,coverage:'Rendered DOM tables and team notes only; completeness not verified',teams,warnings};
  }
  function formatBoxCapture(box,{date='',time='',timezone='',url}){
    // Reuse the same strict metadata validation as the Plays export.
    formatCapture({text:'Top 1st - Metadata validation',date,time,timezone,url});
    return JSON.stringify({...box,capture_version:captureVersion,date:date||null,start_time:time||null,timezone:timezone||null},null,2);
  }

  function gameScreens(value){
    const safe=sourceUrl(value),url=new URL(safe),match=url.pathname.match(/^(.*\/schedule\/([^/]+))(?:\/[^/]*)?\/?$/);
    if(!match)throw Error('Open a game page before capturing.');
    return {eventId:match[2],plays:url.origin+match[1]+'/plays',box:url.origin+match[1]+'/box-score',recap:url.origin+match[1]+'/recap'};
  }
  async function captureBoth(value,readScreen,onProgress=()=>{}){
    const urls=gameScreens(value);
    onProgress('Reading Plays…');const plays=await readScreen(urls.plays,'plays');
    onProgress('Reading Box score…');const box=await readScreen(urls.box,'box',inspectPlays(plays.text).teams);
    if(plays.url!==urls.plays||box.url!==urls.box)throw Error('A game screen redirected. No combined capture was created.');
    const first=detectGameMetadata(plays.text,urls.plays),second=detectGameMetadata(box.text,urls.box);
    for(const key of ['time','timezone'])if(first[key]&&second[key]&&first[key]!==second[key])throw Error('Plays and Box score disagree on '+key+'. Review the game before capturing.');
    if(first.monthDay&&second.monthDay&&first.monthDay!==second.monthDay)throw Error('Plays and Box score disagree on date.');
    const explicit=[first,second].filter(m=>m.date&&!m.needsYearConfirmation);
    if(new Set(explicit.map(m=>m.date)).size>1)throw Error('Plays and Box score disagree on date.');
    const detected={...first,date:explicit[0]?.date||first.date||second.date};
    for(const key of ['time','timezone'])if(!detected[key])detected[key]=second[key];
    detected.needsYearConfirmation=!!detected.date&&!explicit.length;
    if(explicit.length)detected.notice=explicit[0].notice;
    const extracted=extractPlays(plays.text),summary=inspectPlays(extracted);
    if(summary.teams.length!==2||box.data.teams.length!==2||!summary.teams.every(name=>box.data.teams.some(team=>teamKey(team.name)===teamKey(name))))throw Error('The team names on Plays and Box score do not match two teams. Review both screens.');
    if(box.data.source_event_id!==urls.eventId)throw Error('Box-score game ID does not match Plays.');
    const recapWarnings=[];let recapDate=null;
    if(!explicit.length){
      onProgress('Checking Recap for the full game date…');let recap;
      try{recap=await readScreen(urls.recap,'recap',summary.teams);}catch(error){
        if(error.message==='Capture cancelled.')throw error;
        recapWarnings.push('Recap date unavailable; confirm or enter the year if needed.');
      }
      if(recap){
        if(recap.url!==urls.recap)throw Error('Recap redirected to another page. No combined capture was created.');
        try{recapDate=detectRecapDate(recap.text);}catch{recapWarnings.push('Recap did not provide one clear full game date; confirm or enter the year if needed.');}
        if(recapDate){
          if([first,second].some(m=>m.monthDay&&m.monthDay!==recapDate.monthDay))throw Error('Recap and Plays/Box score disagree on date. Review the game before capturing.');
          detected.date=recapDate.date;detected.needsYearConfirmation=false;
          detected.notice='Full game date from Recap: '+recapDate.header+(detected.time?'. Start time retained from Plays/Box score.':'');
        }
      }
    }
    return {schema_version:1,capture_version:captureVersion,kind:'diamond-scout-game',source_event_id:urls.eventId,plays:extracted,plays_url:urls.plays,box_score:box.data,coverage:'Loaded rendered game screens only; completeness not verified',...(recapDate?{recap_date:{source_url:urls.recap,...recapDate}}:{}),warnings:[...box.data.warnings,...recapWarnings,...(!summary.topFirst||!summary.bottomFirst?['A first-inning half is missing from Plays.']:[])],detected};
  }
  function formatCombined(bundle,{date='',time='',timezone='',yearConfirmed=false,team='',assignTo=[],tournament=''}){
    validateDetectedDate(bundle.detected,date,yearConfirmed);
    const {detected,...saved}=bundle;
    return JSON.stringify({...saved,capture_version:captureVersion,plays:formatCapture({text:bundle.plays,date,time,timezone,url:bundle.plays_url,team,assignTo,tournament}),box_score:JSON.parse(formatBoxCapture(bundle.box_score,{date,time,timezone,url:bundle.box_score.source_url}))},null,2);
  }
  async function readGameWindow(popup,url,kind,cancelled,knownTeams=[],timing={}){
    if(!popup||popup.closed)throw Error('The capture window was blocked or closed. Allow the game capture window, or capture the current screen only.');
    try{if(sourceUrl(popup.location.href)!==url)popup.location.href=url;}catch{try{popup.location.href=url;}catch{throw Error('The capture window could not navigate to the game.');}}
    let last='',stable=0,firstReady=0,lastError='';const started=Date.now();
    while(Date.now()-started<(timing.timeout??18000)){
      if(cancelled())throw Error('Capture cancelled.');
      if(popup.closed)throw Error('The capture window was closed or isolated by the browser. Use separate-screen capture.');
      try{
        const doc=popup.document;
        if(doc?.readyState==='complete'&&sourceUrl(popup.location.href)===url){
          const text=doc.body?.innerText||'';
          let data;if(kind==='plays')extractPlays(text);else if(kind==='recap')data=detectRecapDate(text);else data=extractBoxScore(doc,url,knownTeams);
          const signature=kind==='plays'?extractPlays(text):JSON.stringify(data);
          if(signature===last)stable++;else{last=signature;stable=0;firstReady=Date.now();}
          const notesOnly=kind==='box'&&tableWarnings(data.teams).length>0;
          if(stable>=3&&Date.now()-firstReady>=(notesOnly?(timing.notesSettle??3500):(timing.settle??1000)))return {url,text,data};
        }
      }catch(error){lastError=error.message;}
      await new Promise(resolve=>setTimeout(resolve,timing.poll??400));
    }
    throw Error('Timed out reading '+(kind==='plays'?'Plays':kind==='recap'?'Recap':'Box score')+' in the capture window.'+(lastError?' Last check: '+lastError:'')+' Use the current-screen option to retain the visible data.');
  }
  async function collectGame(url){
    const urls=gameScreens(url),openCapture=()=>window.open(urls.plays,'diamond-scout-game-capture','popup,width=1400,height=1000');
    let popup=openCapture();
    const busy=document.createElement('dialog');busy.id='diamond-scout-capture-progress-dialog';
    busy.style.cssText='max-width:560px;padding:24px;border:1px solid #718096;border-radius:16px;background:#F4F6F8;color:#0A192F;font:16px/1.5 system-ui';
    busy.innerHTML='<h2 style="margin-top:0">Capture game</h2><p role="status" id="diamond-capture-progress">Reading Plays and Box score. Recap is checked for a full date when needed.</p><p>Keep the capture window open until reading finishes.</p><button type="button" id="diamond-capture-retry" hidden>Retry capture</button> <button type="button" id="diamond-capture-single">Capture current screen only</button> <button type="button" id="diamond-capture-cancel">Cancel</button>';
    for(const button of busy.querySelectorAll('button'))button.style.cssText='min-height:48px;padding:10px;font:inherit';
    document.body.appendChild(busy);busy.showModal();let cancelled=false,resolveChoice;
    const choose=action=>{cancelled=true;resolveChoice(action);};
    busy.querySelector('#diamond-capture-single').addEventListener('click',()=>choose('single'));
    busy.querySelector('#diamond-capture-cancel').addEventListener('click',()=>choose('cancel'));
    busy.querySelector('#diamond-capture-retry').addEventListener('click',()=>{popup=openCapture();choose('retry');});
    busy.addEventListener('cancel',event=>{event.preventDefault();choose('cancel');});
    try{
      while(true){
        cancelled=false;const choice=new Promise(resolve=>{resolveChoice=resolve;});busy.querySelector('#diamond-capture-retry').hidden=true;
        try{return await captureBoth(url,(target,kind,teams)=>readGameWindow(popup,target,kind,()=>cancelled,teams,kind==='recap'?{timeout:8000}:{}),message=>{busy.querySelector('#diamond-capture-progress').textContent=message;});}
        catch(error){
          if(!cancelled){busy.querySelector('#diamond-capture-progress').textContent=error.message+' Retry capture, capture the current screen only, or cancel.';busy.querySelector('#diamond-capture-retry').hidden=false;}
          const action=await choice;
          if(action==='retry')continue;
          if(action==='single')return null;
          throw Error('Capture cancelled.');
        }
      }
    }finally{try{if(popup&&!popup.closed)popup.close();}catch{}busy.remove();}
  }
  function scheduleUrl(value){
    const url=new URL(sourceUrl(value));
    if(url.hostname!=='web.gc.com'||!/^\/teams\/[^/]+\/[^/]+\/schedule\/?$/.test(url.pathname))throw Error('Use a team schedule URL from web.gc.com.');
    return url.origin+url.pathname.replace(/\/$/,'');
  }
  function extractSchedule(doc,value){
    const url=scheduleUrl(value),games=[],skipped=[],seen=new Set(),months=['January','February','March','April','May','June','July','August','September','October','November','December'];
    const text=node=>clean(node?.textContent||'').replace(/\s+/g,' ');
    for(const month of doc.querySelectorAll('.ScheduleListByMonth__eventMonth')){
      const header=text(month.previousElementSibling?.querySelector('[data-testid="schedule-section-title"]'));
      const m=header.match(/^([A-Za-z]+) (\d{4})$/),monthIndex=m?months.findIndex(name=>name.toLowerCase()===m[1].toLowerCase()):-1;
      for(const row of month.querySelectorAll('.ScheduleListByMonth__dayRow'))for(const link of row.querySelectorAll('a.ScheduleListByMonth__event')){
        let target;try{target=new URL(link.getAttribute('href'),url);}catch{continue;}
        const prefix=new URL(url).pathname+'/',suffix=target.pathname.slice(prefix.length);
        if(target.origin!==new URL(url).origin||!target.pathname.startsWith(prefix)||!suffix||suffix.includes('/'))continue;
        if(seen.has(suffix))continue;seen.add(suffix);
        const titleNode=link.querySelector('.ScheduleListByMonth__title'),title=text(titleNode),score=text(link.querySelector('.ScheduleListByMonth__scoreOrTimeText'));
        const day=Number(text(row.querySelector('.ScheduleListByMonth__dateText'))),date=m&&monthIndex>=0&&day>0?m[2]+'-'+String(monthIndex+1).padStart(2,'0')+'-'+String(day).padStart(2,'0'):'';
        const validDate=date&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date;
        const completed=/^(?:W|L|T)\s+\d+\s*[-–]\s*\d+$/i.test(score),opponent=/^(?:@|vs\.)\s+\S/.test(title);
        const item={eventId:suffix,url:target.origin+target.pathname,title,date:validDate?date:'',score};
        if(!opponent||/\b(?:cancelled|canceled|postponed|suspended|in progress|live)\b/i.test(title+' '+score)){skipped.push({...item,reason:'Not an eligible completed game'});continue;}
        if(!completed){skipped.push({...item,reason:'No final W/L/T result'});continue;}
        if(!validDate){skipped.push({...item,reason:'Schedule date unavailable'});continue;}
        games.push(item);
      }
    }
    return {url,team:text(doc.querySelector('.NewTeamNavBar__teamName')),games:games.sort((a,b)=>b.date.localeCompare(a.date)),skipped};
  }
  async function captureScheduleGames(games,readScreen,options={},onProgress=()=>{},cancelled=()=>false){
    const successes=[],failures=[];
    for(const [index,game] of games.entries()){
      if(cancelled())break;
      try{
        onProgress('Game '+(index+1)+' of '+games.length+' · '+game.title);
        const bundle=await captureBoth(game.url,readScreen,message=>onProgress('Game '+(index+1)+' of '+games.length+' · '+game.title+' · '+message));
        if(cancelled())break;
        if(bundle.source_event_id!==game.eventId)throw Error('Captured game ID differs from the selected schedule game.');
        if(bundle.detected.date&&!bundle.detected.needsYearConfirmation&&bundle.detected.date!==game.date)throw Error('Schedule and game screen disagree on date.');
        if(bundle.detected.monthDay&&bundle.detected.monthDay!==Number(game.date.slice(5,7))+'/'+Number(game.date.slice(8,10)))throw Error('Schedule and game screen disagree on date.');
        const team=options.onlyTeam?inspectPlays(bundle.plays).teams.find(name=>name.normalize('NFC').replace(/\s+/g,' ').trim().toLowerCase()===options.onlyTeam.normalize('NFC').replace(/\s+/g,' ').trim().toLowerCase()):'';
        if(options.onlyTeam&&!team)throw Error('The schedule team was not found in captured Plays.');
        const saved=JSON.parse(formatCombined(bundle,{date:game.date,time:bundle.detected.time,timezone:bundle.detected.timezone,yearConfirmed:true,team,assignTo:options.assignTo||[],tournament:options.tournament||''}));
        saved.schedule_evidence={date:game.date,title:game.title,result:game.score};successes.push(saved);
      }catch(error){if(cancelled())break;failures.push({...game,error:error.message});}
    }
    return {successes,failures,cancelled:cancelled()};
  }
  async function showScheduleScanner(initialUrl){
    const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const dialog=document.createElement('dialog');dialog.id='diamond-scout-schedule-dialog';dialog.style.cssText='width:680px;max-width:94vw;max-height:90vh;overflow:auto;padding:22px;border:1px solid #cbd5e1;border-radius:16px;background:#F4F6F8;color:#0A192F;font:15px/1.5 system-ui';
    dialog.innerHTML='<h2>Capture team schedule</h2><label>Schedule URL<input id="ds-schedule-url" type="url" style="display:block;width:100%;box-sizing:border-box"></label><button id="ds-schedule-load">Load / rescan schedule</button><p id="ds-schedule-info"></p><div id="ds-schedule-list" style="max-height:230px;overflow:auto"></div><div id="ds-schedule-settings"><fieldset><legend>Teams to import</legend><label style="display:flex;align-items:center;gap:8px;min-height:48px"><input id="ds-schedule-only" type="checkbox" aria-describedby="ds-schedule-only-help"><span id="ds-schedule-only-label">Only import the schedule team</span></label><p id="ds-schedule-only-help" style="margin:4px 0;font-size:13px">Checked: import this team only. Unchecked: import both teams from each game.</p></fieldset><fieldset><legend>Assign scouting to your teams (optional)</legend>'+organizationTeams.map(t=>'<label style="display:block"><input type="checkbox" data-assign="'+escape(t.id)+'"> '+escape(t.name)+'</label>').join('')+'</fieldset><label>Tournament (optional; applies to all selected games)<input id="ds-schedule-tournament" maxlength="160" style="display:block;width:100%;box-sizing:border-box"></label></div><p id="ds-schedule-status" role="status" aria-live="polite"></p><div id="ds-schedule-results"></div><div style="display:flex;flex-wrap:wrap;gap:8px"><button id="ds-schedule-start">Capture selected games</button><button id="ds-schedule-retry" hidden>Retry failed games</button><button id="ds-schedule-download" disabled>Download captured games</button><button id="ds-schedule-cancel" hidden>Stop capture</button><button id="ds-schedule-close">Close</button></div>';
    document.body.appendChild(dialog);dialog.showModal();const field=id=>dialog.querySelector('#ds-schedule-'+id);
    for(const button of dialog.querySelectorAll('button'))button.style.cssText='min-height:48px;padding:8px 12px;font:inherit';
    field('url').value=initialUrl;let schedule=null,popup=null,busy=false,stopped=false,successes=new Map(),failures=[],batchOptions=null,batchSchedule=null,wasCancelled=false;
    const closePopup=()=>{try{if(popup&&!popup.closed)popup.close();}catch{}popup=null;};
    const summary=()=>{field('results').textContent=successes.size+' captured · '+failures.length+' failed'+(wasCancelled?' · stopped early':'')+([...successes.values()].some(g=>g.warnings?.length)?'\n'+[...successes.values()].filter(g=>g.warnings?.length).map(g=>g.schedule_evidence.date+' '+g.schedule_evidence.title+': '+g.warnings.join(' ')).join('\n'):'')+(failures.length?'\n'+failures.map(f=>f.date+' '+f.title+': '+f.error).join('\n'):'');field('results').style.whiteSpace='pre-line';field('download').disabled=!successes.size;field('retry').hidden=!failures.length;};
    const setBusy=value=>{busy=value;for(const id of ['start','load','url','only','tournament','close'])field(id).disabled=value;for(const input of dialog.querySelectorAll('input[type="checkbox"]'))input.disabled=value;field('retry').disabled=value;field('download').disabled=value||!successes.size;field('cancel').hidden=!value;};
    function showList(next){schedule=next;field('only-label').textContent=next.team?'Only import '+next.team:'Only import the schedule team';field('list').innerHTML=next.games.map(g=>'<label style="display:flex;gap:8px;padding:7px"><input type="checkbox" data-event="'+escape(g.eventId)+'" checked><span>'+escape(g.date+' · '+g.title+' · '+g.score)+'</span></label>').join('');field('info').textContent=next.team+' · '+next.games.length+' completed games · '+next.skipped.length+' other events skipped. Only loaded schedule rows are included; scroll the schedule to load older events and rescan if needed.';field('start').disabled=!next.games.length;}
    field('load').addEventListener('click',async()=>{
      if(busy)return;
      try{const target=scheduleUrl(field('url').value);stopped=false;
        if(target===scheduleUrl(initialUrl)){showList(extractSchedule(document,target));return;}
        popup=window.open(target,'diamond-scout-game-capture','popup,width=1400,height=1000');setBusy(true);const started=Date.now();let last='',stable=0;
        while(Date.now()-started<18000){if(stopped)throw Error('Schedule loading stopped.');if(!popup||popup.closed)throw Error('Allow the schedule capture window, then retry.');try{if(popup.document.readyState==='complete'&&sourceUrl(popup.location.href)===target){const next=extractSchedule(popup.document,target),signature=JSON.stringify(next);stable=signature===last?stable+1:0;last=signature;if(stable>=3&&(next.games.length||next.skipped.length)){showList(next);return;}}}catch(error){if(error.message.includes('Allow'))throw error;}await new Promise(resolve=>setTimeout(resolve,500));}
        throw Error('Schedule did not load. Open it directly and run the bookmark there.');
      }catch(error){field('status').textContent=error.message;}finally{closePopup();setBusy(false);}
    });
    async function run(games,options){
      if(busy||!games.length)return;stopped=false;setBusy(true);
      try{const result=await captureScheduleGames(games,(url,kind,teams)=>readGameWindow(popup,url,kind,()=>stopped,teams,kind==='recap'?{timeout:8000}:{}),options,message=>{field('status').textContent=message;},()=>stopped);
        for(const game of result.successes)successes.set(game.source_event_id,game);failures=result.failures;wasCancelled=wasCancelled||result.cancelled;
        if(result.cancelled){const finished=new Set([...result.successes.map(g=>g.source_event_id),...result.failures.map(g=>g.eventId)]);failures.push(...games.filter(g=>!finished.has(g.eventId)).map(g=>({...g,error:'Not completed because capture was stopped.'})));}
        field('status').textContent=result.cancelled?'Stopped. Completed captures are available to download.':'Capture finished. Warnings remain inside each game export.';
      }finally{closePopup();setBusy(false);summary();}
    }
    field('start').addEventListener('click',()=>{
      if(busy||!schedule)return;const selected=new Set([...dialog.querySelectorAll('input[data-event]:checked')].map(i=>i.dataset.event)),games=schedule.games.filter(g=>selected.has(g.eventId));if(!games.length){field('status').textContent='Select at least one completed game.';return;}
      if(field('only').checked&&!schedule.team){field('status').textContent='Schedule team name unavailable. Reload the schedule before choosing team-only capture.';return;}
      popup=window.open(gameScreens(games[0].url).plays,'diamond-scout-game-capture','popup,width=1400,height=1000');successes.clear();failures=[];wasCancelled=false;batchSchedule=schedule.url;batchOptions={onlyTeam:field('only').checked?schedule.team:'',assignTo:[...dialog.querySelectorAll('input[data-assign]:checked')].map(i=>i.dataset.assign),tournament:field('tournament').value};void run(games,batchOptions);
    });
    field('retry').addEventListener('click',()=>{if(busy||!failures.length)return;popup=window.open(gameScreens(failures[0].url).plays,'diamond-scout-game-capture','popup,width=1400,height=1000');void run([...failures],batchOptions);});
    field('cancel').addEventListener('click',()=>{stopped=true;});
    field('close').addEventListener('click',()=>{if(!busy){closePopup();dialog.remove();}});
    dialog.addEventListener('cancel',event=>{event.preventDefault();if(busy)stopped=true;else{closePopup();dialog.remove();}});
    field('download').addEventListener('click',()=>{if(busy||!successes.size)return;const value={schema_version:1,kind:'diamond-scout-schedule',capture_version:captureVersion,source_url:batchSchedule,games:[...successes.values()],failures,cancelled:wasCancelled};const blob=new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'}),objectUrl=URL.createObjectURL(blob),link=document.createElement('a');link.href=objectUrl;link.download='gamechanger-game-schedule-'+new URL(batchSchedule).pathname.split('/')[2]+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);});
    showList(extractSchedule(document,initialUrl));
  }
  if (typeof document === 'undefined' && typeof module !== 'undefined' && module.exports) {
    module.exports = { scheduleUrl, extractSchedule, captureScheduleGames, captureVersion, captureFilename, tableWarnings, collectGame, stripPlaysFooter, extractPlays, inspectPlays, sourceUrl, formatCapture, detectGameMetadata, detectRecapDate, validateDetectedDate, extractBoxNotes, extractBoxScore, formatBoxCapture, gameScreens, captureBoth, formatCombined, readGameWindow };
    return;
  }

  try {
    const url = sourceUrl(location.href);
    const existing = document.getElementById('diamond-scout-capture-dialog')||document.getElementById('diamond-scout-capture-progress-dialog')||document.getElementById('diamond-scout-schedule-dialog');
    if (existing) { existing.focus(); return; }
    if(/\/teams\/[^/]+\/[^/]+\/schedule\/?$/.test(new URL(url).pathname)){await showScheduleScanner(url);return;}
    let combined=await collectGame(url);
    let detected = combined?combined.detected:detectGameMetadata(document.body.innerText, location.href);
    const boxMode=/\/box-score\/?$/.test(new URL(url).pathname);
    let box=!combined&&boxMode?extractBoxScore(document,url):null;
    const selected = clean(window.getSelection()?.toString());
    let text;
    if(combined){text=JSON.stringify(combined,null,2);}
    else if(boxMode){text=JSON.stringify(box,null,2);}
    else if (selected) {
      text = extractPlays(selected);
    } else {
      const candidates = [...document.querySelectorAll('main,[role="main"]'), document.body];
      const candidate = candidates.find(element => inningHeading.test(element.innerText || ''));
      text = extractPlays(candidate?.innerText);
    }

    const dialog = document.createElement('dialog');
    dialog.id = 'diamond-scout-capture-dialog';
    dialog.setAttribute('aria-labelledby', 'diamond-scout-capture-title');
    dialog.style.cssText = 'width:min(900px,94vw);max-height:90vh;overflow:auto;padding:20px;border:1px solid #8B9BAF;border-radius:16px;background:#F4F6F8;color:#0A192F;font:16px/1.5 system-ui,sans-serif;box-sizing:border-box';
    // This markup is fixed; page text and user input are assigned only as text/value.
    dialog.innerHTML = '<h2 id="diamond-scout-capture-title" style="margin:0 0 8px;font-size:22px">Review GameChanger plays</h2>' +
      '<p style="margin:0 0 12px">Choose the teams and assignments, then download. Capture problems appear below; the importer performs the final data checks.</p>' +
      '<p id="diamond-scout-capture-summary" style="margin:0 0 12px;font-weight:600" role="status"></p>' +
      '<p id="diamond-scout-capture-warnings" hidden role="alert" style="padding:12px;border-left:4px solid #B54708;background:#FFF1D6;white-space:pre-line"></p>' +
      '<p id="diamond-scout-capture-metadata" style="font-size:13px" role="status"></p>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">' +
      '<label style="display:grid;gap:4px;flex:1">Game date (optional)<input id="diamond-scout-capture-date" type="date" style="font:inherit;min-height:48px;padding:8px;box-sizing:border-box;min-width:0"></label>' +
      '<label style="display:grid;gap:4px;flex:1">Start time (optional)<input id="diamond-scout-capture-time" type="time" style="font:inherit;min-height:48px;padding:8px;box-sizing:border-box;min-width:0"></label>' +
      '<label style="display:grid;gap:4px;flex:1">Timezone (as shown)<input id="diamond-scout-capture-zone" type="text" maxlength="80" placeholder="unknown" style="font:inherit;min-height:48px;padding:8px;box-sizing:border-box;min-width:0"></label></div>' +
      '<label id="diamond-scout-capture-tournament-label" style="display:grid;gap:4px;margin-bottom:12px">Tournament (optional)<input id="diamond-scout-capture-tournament" type="text" maxlength="160" placeholder="e.g. Halloween Havoc 2026" style="font:inherit;min-height:48px;padding:8px;box-sizing:border-box;min-width:0"></label>' +
      '<label id="diamond-scout-capture-team-label" style="display:grid;gap:4px;margin-bottom:12px">Teams to import<select id="diamond-scout-capture-team" style="font:inherit;min-height:48px;padding:8px"><option value="">Both teams (default)</option></select></label>' +
      '<fieldset id="diamond-scout-capture-assign-label" style="margin:0 0 12px;padding:12px;border:1px solid #8B9BAF;border-radius:10px"><legend>Assign scouting to your teams (optional)</legend><div id="diamond-scout-capture-assign-options"></div><small>Links the teams you import as opponents. Shared scouting data is stored once.</small></fieldset>' +
      '<label id="diamond-scout-capture-year-label" hidden style="gap:8px;align-items:center;min-height:48px;margin-bottom:12px"><input id="diamond-scout-capture-year-confirm" type="checkbox" style="width:24px;height:24px">I confirm the suggested game year from the season URL.</label>' +
      '<details id="diamond-scout-capture-raw"><summary style="min-height:44px;cursor:pointer">Captured data (troubleshooting)</summary><label style="display:grid;gap:4px">Captured data<textarea id="diamond-scout-capture-text" spellcheck="false" style="font:16px/1.4 ui-monospace,monospace;width:100%;min-height:260px;padding:10px;box-sizing:border-box;resize:vertical"></textarea></label></details>' +
      '<p style="font-size:13px">Dates are never inferred from capture time. No login credentials, cookies or browser storage are read. Nothing is uploaded or imported into team history by this helper.</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:10px"><button id="diamond-scout-capture-download" type="button">Download TXT</button><button id="diamond-scout-capture-copy" type="button">Copy import prompt</button><button id="diamond-scout-capture-retry" type="button">Retry capture</button><button id="diamond-scout-capture-close" type="button">Close</button></div>';
    document.body.appendChild(dialog);
    const field = id => dialog.querySelector('#diamond-scout-capture-' + id);
    for (const button of dialog.querySelectorAll('button')) button.style.cssText = 'font:inherit;min-height:48px;padding:10px 14px;border-radius:10px;border:1px solid #8B9BAF;background:white;color:#0A192F;cursor:pointer';
    field('download').style.background = '#0052CC'; field('download').style.color = '#FFFFFF';
    if(combined){field('title').textContent='Plays + Box score capture';field('download').textContent='Download game JSON';field('copy').textContent='Copy game JSON';}
    else if(boxMode){field('title').textContent='Review GameChanger box score';field('download').textContent='Download box-score JSON';field('copy').textContent='Copy box-score JSON';}
    field('tournament-label').hidden=boxMode&&!combined;
    if(boxMode&&!combined)field('tournament-label').style.display='none';
    field('team-label').hidden = boxMode && !combined;
    if (boxMode && !combined) field('team-label').style.display = 'none';
    const importTeams = combined ? inspectPlays(combined.plays).teams : boxMode ? [] : inspectPlays(text).teams;
    for (const name of importTeams) {
      const option = document.createElement('option'); option.value = name; option.textContent = 'Only ' + name; field('team').appendChild(option);
    }
    field('assign-label').hidden=boxMode&&!combined;
    if(boxMode&&!combined)field('assign-label').style.display='none';
    if(!organizationTeams.length)field('assign-options').textContent='No organization teams configured. Update teams.json and reinstall the capture bookmark.';
    for(const team of organizationTeams){
      const label=document.createElement('label'),checkbox=document.createElement('input');
      label.style.cssText='display:flex;gap:10px;align-items:center;min-height:44px';
      checkbox.type='checkbox';checkbox.value=team.id;checkbox.style.cssText='width:22px;height:22px';
      label.appendChild(checkbox);label.appendChild(document.createTextNode(team.name));field('assign-options').appendChild(label);
    }
    field('text').value = text;
    field('date').value = detected.date;
    field('time').value = detected.time;
    field('zone').value = detected.timezone;
    field('metadata').textContent = detected.notice;
    function updateYearConfirmation() {
      const needed = detected.needsYearConfirmation && field('date').value === detected.date;
      field('year-label').hidden = !needed;
      field('year-label').style.display = needed ? 'flex' : 'none';
    }
    field('date').addEventListener('input', updateYearConfirmation);
    updateYearConfirmation();

    function updateSummary(){
      let warnings=[];
      try{
        if(combined||boxMode){
          const value=JSON.parse(field('text').value),boxData=combined?value.box_score:value;
          warnings=[...(value.warnings||[]),...tableWarnings(boxData.teams)];
          field('summary').textContent=boxData.teams.map(t=>t.name).join(' vs. ');
        }else{
          const summary=inspectPlays(field('text').value);field('summary').textContent=summary.teams.join(' vs. ')+' · '+summary.headings+' inning headings';
          if(!summary.topFirst||!summary.bottomFirst)warnings.push('A first-inning half is missing. Retry capture, or keep this partial capture for import review.');
        }
      }catch{warnings=['Captured data could not be read. Retry capture or open Captured data for troubleshooting.'];}
      field('warnings').hidden=!warnings.length;field('warnings').textContent=[...new Set(warnings)].join('\n');
    }
    function output() {
      const assignTo=[...field('assign-options').querySelectorAll('input:checked')].map(input=>input.value);
      validateDetectedDate(detected, field('date').value, field('year-confirm').checked);
      if(combined)return formatCombined(JSON.parse(field('text').value),{date:field('date').value,time:field('time').value,timezone:field('zone').value.trim(),yearConfirmed:field('year-confirm').checked,team:field('team').value,assignTo,tournament:field('tournament').value});
      if(boxMode)return formatBoxCapture(JSON.parse(field('text').value),{date:field('date').value,time:field('time').value,timezone:field('zone').value.trim(),url});
      return formatCapture({ text: field('text').value, date: field('date').value, time: field('time').value, timezone: field('zone').value.trim(), url, team: field('team').value, assignTo, tournament:field('tournament').value });
    }
    field('retry').addEventListener('click',async()=>{
      field('retry').disabled=true;field('download').disabled=true;field('copy').disabled=true;
      try{
        const next=await collectGame(url);if(!next)return;
        const previous=detected;combined=next;detected=next.detected;box=null;
        field('text').value=JSON.stringify(next,null,2);
        for(const [id,key] of [['date','date'],['time','time'],['zone','timezone']])if(field(id).value===previous[key])field(id).value=detected[key];
        const chosen=field('team').value;field('team').innerHTML='<option value="">Both teams (default)</option>';
        for(const name of inspectPlays(next.plays).teams){const option=document.createElement('option');option.value=name;option.textContent='Only '+name;field('team').appendChild(option);}
        field('team').value=inspectPlays(next.plays).teams.includes(chosen)?chosen:'';
        for(const id of ['team-label','assign-label','tournament-label']){field(id).hidden=false;field(id).style.display=id==='assign-label'?'block':'grid';}
        field('title').textContent='Plays + Box score capture';field('download').textContent='Download game JSON';field('copy').textContent='Copy game JSON';
        field('metadata').textContent=detected.notice;field('year-confirm').checked=false;updateYearConfirmation();updateSummary();
      }catch(error){if(error.message!=='Capture cancelled.'){field('warnings').hidden=false;field('warnings').textContent=error.message+' Previous capture retained.';}}
      finally{field('retry').disabled=false;field('download').disabled=false;field('copy').disabled=false;}
    });
    field('text').addEventListener('input', updateSummary);
    field('download').addEventListener('click', () => {
      try {
        const blob = new Blob([output() + '\n'], { type: combined||boxMode?'application/json;charset=utf-8':'text/plain;charset=utf-8' });
        const objectUrl = URL.createObjectURL(blob), link = document.createElement('a');
        link.href = objectUrl; link.download=captureFilename({kind:combined?'game':boxMode?'boxscore':'plays',date:field('date').value,time:field('time').value,teams:combined?inspectPlays(JSON.parse(field('text').value).plays).teams:boxMode?JSON.parse(field('text').value).teams.map(t=>t.name):inspectPlays(field('text').value).teams,eventId:new URL(url).pathname.match(/\/schedule\/([^/]+)/)?.[1]||''});
        dialog.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
        field('summary').textContent = 'Download requested. Import the downloaded file with tools/import-plays.cjs, or attach it in your Diamond-Scout conversation.';
      } catch (error) { field('summary').textContent = error.message; }
    });
    field('copy').addEventListener('click', async () => {
      try {
        const value = output();
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable; use Download TXT instead.');
        await navigator.clipboard.writeText(value);
        field('summary').textContent = 'Import prompt copied. Paste it into your Diamond-Scout conversation.';
      } catch (error) { field('summary').textContent = error.message || 'Clipboard blocked; use Download TXT instead.'; }
    });
    field('close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove());
    updateSummary(); dialog.showModal();
  } catch (error) { if(error.message!=='Capture cancelled.')window.alert('Diamond-Scout capture: ' + error.message); }
})();
