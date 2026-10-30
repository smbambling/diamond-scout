/* Diamond-Scout: capture already-loaded GameChanger plays in your signed-in browser. */
(async function () {
  'use strict';

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
    return { date: chosen.date, time: chosen.time, timezone, needsYearConfirmation: chosen.needsYearConfirmation, notice };
  }

  function validateDetectedDate(metadata, date, yearConfirmed) {
    if (metadata.needsYearConfirmation && date && date === metadata.date && !yearConfirmed) {
      throw new Error('Confirm the suggested game year, edit the date, or leave the date blank before exporting.');
    }
  }

  function formatCapture({ text, date = '', time = '', timezone = '', url, team = '' }) {
    const plays = extractPlays(text);
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) {
      throw new Error('Use a full game date, including year, or leave it unknown.');
    }
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Use a 24-hour start time, or leave it unknown.');
    if (timezone && (timezone.length > 80 || /[\r\n\u0000]/.test(timezone))) throw new Error('Use a single-line timezone label, or leave it unknown.');
    if (team && (!inspectPlays(plays).teams.includes(team) || /[\r\n]/.test(team))) throw new Error('Choose a team found in the captured plays.');
    return [
      'Use TEAM-DATA-PROMPT.md to add this game',
      team ? 'Import: only ' + team : 'Import: both teams (default)',
      'Date: ' + (date || 'unknown'),
      'Start time: ' + (time || 'unknown'),
      'Timezone: ' + (timezone || 'unknown'),
      'Source: ' + sourceUrl(url),
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
    for(const team of teams)if(!team.tables.some(t=>t.kind==='batting'))warnings.push(team.name+': batting table unavailable from rendered DOM; notes only. Do not treat this as a complete box score.');
    const canvases=[...doc.querySelectorAll('canvas')].filter(visible).length;
    if(canvases)warnings.push(canvases+' visible canvas element(s); canvas-drawn rows cannot be read as text by this helper.');
    return {schema_version:1,kind:'diamond-scout-box-score',source_url:sourceUrl(url),source_event_id:new URL(url).pathname.match(/\/schedule\/([^/]+)/)?.[1]||null,coverage:'Rendered DOM tables and team notes only; completeness not verified',teams,warnings};
  }
  function formatBoxCapture(box,{date='',time='',timezone='',url}){
    // Reuse the same strict metadata validation as the Plays export.
    formatCapture({text:'Top 1st - Metadata validation',date,time,timezone,url});
    return JSON.stringify({...box,date:date||null,start_time:time||null,timezone:timezone||null},null,2);
  }

  function gameScreens(value){
    const safe=sourceUrl(value),url=new URL(safe),match=url.pathname.match(/^(.*\/schedule\/([^/]+))(?:\/[^/]*)?\/?$/);
    if(!match)throw Error('Open a game page before capturing.');
    return {eventId:match[2],plays:url.origin+match[1]+'/plays',box:url.origin+match[1]+'/box-score'};
  }
  async function captureBoth(value,readScreen,onProgress=()=>{}){
    const urls=gameScreens(value);
    onProgress('Reading Plays…');const plays=await readScreen(urls.plays,'plays');
    onProgress('Reading Box score…');const box=await readScreen(urls.box,'box',inspectPlays(plays.text).teams);
    if(plays.url!==urls.plays||box.url!==urls.box)throw Error('A game screen redirected. No combined capture was created.');
    const first=detectGameMetadata(plays.text,urls.plays),second=detectGameMetadata(box.text,urls.box);
    for(const key of ['date','time','timezone'])if(first[key]&&second[key]&&first[key]!==second[key])throw Error('Plays and Box score disagree on '+key+'. Review the game before capturing.');
    const detected={...first};
    for(const key of ['date','time','timezone'])if(!detected[key])detected[key]=second[key];
    detected.needsYearConfirmation=!!detected.date&&(first.needsYearConfirmation||second.needsYearConfirmation);
    const extracted=extractPlays(plays.text),summary=inspectPlays(extracted);
    if(summary.teams.length!==2||box.data.teams.length!==2||!summary.teams.every(name=>box.data.teams.some(team=>teamKey(team.name)===teamKey(name))))throw Error('The team names on Plays and Box score do not match two teams. Review both screens.');
    if(box.data.source_event_id!==urls.eventId)throw Error('Box-score game ID does not match Plays.');
    return {schema_version:1,kind:'diamond-scout-game',source_event_id:urls.eventId,plays:extracted,plays_url:urls.plays,box_score:box.data,coverage:'Loaded rendered game screens only; completeness not verified',warnings:[...box.data.warnings,...(!summary.topFirst||!summary.bottomFirst?['A first-inning half is missing from Plays.']:[])],detected};
  }
  function formatCombined(bundle,{date='',time='',timezone='',yearConfirmed=false,team=''}){
    validateDetectedDate(bundle.detected,date,yearConfirmed);
    const {detected,...saved}=bundle;
    return JSON.stringify({...saved,plays:formatCapture({text:bundle.plays,date,time,timezone,url:bundle.plays_url,team}),box_score:JSON.parse(formatBoxCapture(bundle.box_score,{date,time,timezone,url:bundle.box_score.source_url}))},null,2);
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
          let data;if(kind==='plays')extractPlays(text);else data=extractBoxScore(doc,url,knownTeams);
          const signature=kind==='plays'?extractPlays(text):JSON.stringify(data);
          if(signature===last)stable++;else{last=signature;stable=0;firstReady=Date.now();}
          const notesOnly=kind==='box'&&data.teams.some(t=>!t.tables.some(table=>table.kind==='batting'));
          if(stable>=3&&Date.now()-firstReady>=(notesOnly?(timing.notesSettle??3500):(timing.settle??1000)))return {url,text,data};
        }
      }catch(error){lastError=error.message;}
      await new Promise(resolve=>setTimeout(resolve,timing.poll??400));
    }
    throw Error('Timed out reading '+(kind==='plays'?'Plays':'Box score')+' in the capture window.'+(lastError?' Last check: '+lastError:'')+' Use the current-screen option to retain the visible data.');
  }
  async function collectGame(url){
    const urls=gameScreens(url);
    // Open synchronously from the bookmark click, before awaiting, to avoid popup blocking.
    const popup=window.open(urls.plays,'diamond-scout-game-capture','popup,width=1400,height=1000');
    const busy=document.createElement('dialog');busy.id='diamond-scout-capture-dialog';
    busy.style.cssText='max-width:560px;padding:24px;border:1px solid #718096;border-radius:16px;background:#F4F6F8;color:#0A192F;font:16px/1.5 system-ui';
    busy.innerHTML='<h2 style="margin-top:0">Capture game</h2><p role="status" id="diamond-capture-progress">Reading Plays and Box score in a temporary capture window. No inning expansion is needed.</p><p>Keep the temporary window open while capture runs. If the browser blocks it, use Capture current screen only.</p><button type="button" id="diamond-capture-single" style="min-height:48px;padding:10px">Capture current screen only</button> <button type="button" id="diamond-capture-cancel" style="min-height:48px;padding:10px">Cancel</button>';
    document.body.appendChild(busy);busy.showModal();let cancelled=false,single=false,wake;
    const choice=new Promise(resolve=>{wake=resolve;});
    const finish=value=>{cancelled=true;single=value;wake();};
    busy.querySelector('#diamond-capture-single').addEventListener('click',()=>finish(true));
    busy.querySelector('#diamond-capture-cancel').addEventListener('click',()=>finish(false));
    busy.addEventListener('cancel',()=>finish(false));
    try{
      try{return await captureBoth(url,(target,kind,teams)=>readGameWindow(popup,target,kind,()=>cancelled,teams),message=>{busy.querySelector('#diamond-capture-progress').textContent=message;});}
      catch(error){if(!cancelled){busy.querySelector('#diamond-capture-progress').textContent=error.message+' You can capture the current screen separately or cancel.';await choice;}if(single)return null;throw Error('Capture cancelled.');}
    }finally{try{if(popup&&!popup.closed)popup.close();}catch{}busy.remove();}
  }
  if (typeof document === 'undefined' && typeof module !== 'undefined' && module.exports) {
    module.exports = { stripPlaysFooter, extractPlays, inspectPlays, sourceUrl, formatCapture, detectGameMetadata, validateDetectedDate, extractBoxNotes, extractBoxScore, formatBoxCapture, gameScreens, captureBoth, formatCombined, readGameWindow };
    return;
  }

  try {
    const url = sourceUrl(location.href);
    const existing = document.getElementById('diamond-scout-capture-dialog');
    if (existing) { existing.focus(); return; }
    const combined=await collectGame(url);
    const detected = combined?combined.detected:detectGameMetadata(document.body.innerText, location.href);
    const boxMode=/\/box-score\/?$/.test(new URL(url).pathname);
    const box=!combined&&boxMode?extractBoxScore(document,url):null;
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
      '<p style="margin:0 0 12px">This saves currently loaded data only. No inning expansion is needed on Plays. On Box score, load both teams and check the captured table counts. A notes-only capture is incomplete.</p>' +
      '<p id="diamond-scout-capture-summary" style="margin:0 0 12px;font-weight:600" role="status"></p>' +
      '<p id="diamond-scout-capture-metadata" style="font-size:13px" role="status"></p>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">' +
      '<label style="display:grid;gap:4px;flex:1">Game date (optional)<input id="diamond-scout-capture-date" type="date" style="font:inherit;min-height:48px;padding:8px;box-sizing:border-box;min-width:0"></label>' +
      '<label style="display:grid;gap:4px;flex:1">Start time (optional)<input id="diamond-scout-capture-time" type="time" style="font:inherit;min-height:48px;padding:8px;box-sizing:border-box;min-width:0"></label>' +
      '<label style="display:grid;gap:4px;flex:1">Timezone (as shown)<input id="diamond-scout-capture-zone" type="text" maxlength="80" placeholder="unknown" style="font:inherit;min-height:48px;padding:8px;box-sizing:border-box;min-width:0"></label></div>' +
      '<label id="diamond-scout-capture-team-label" style="display:grid;gap:4px;margin-bottom:12px">Teams to import<select id="diamond-scout-capture-team" style="font:inherit;min-height:48px;padding:8px"><option value="">Both teams (default)</option></select></label>' +
      '<label id="diamond-scout-capture-year-label" hidden style="gap:8px;align-items:center;min-height:48px;margin-bottom:12px"><input id="diamond-scout-capture-year-confirm" type="checkbox" style="width:24px;height:24px">I confirm the suggested game year from the season URL.</label>' +
      '<label style="display:grid;gap:4px">Captured data — review before exporting<textarea id="diamond-scout-capture-text" spellcheck="false" style="font:16px/1.4 ui-monospace,monospace;width:100%;min-height:260px;padding:10px;box-sizing:border-box;resize:vertical"></textarea></label>' +
      '<p style="font-size:13px">Dates are never inferred from capture time. No login credentials, cookies or browser storage are read. Nothing is uploaded or imported into team history by this helper.</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:10px"><button id="diamond-scout-capture-download" type="button">Download TXT</button><button id="diamond-scout-capture-copy" type="button">Copy import prompt</button><button id="diamond-scout-capture-close" type="button">Close</button></div>';
    document.body.appendChild(dialog);
    const field = id => dialog.querySelector('#diamond-scout-capture-' + id);
    for (const button of dialog.querySelectorAll('button')) button.style.cssText = 'font:inherit;min-height:48px;padding:10px 14px;border-radius:10px;border:1px solid #8B9BAF;background:white;color:#0A192F;cursor:pointer';
    field('download').style.background = '#0052CC'; field('download').style.color = '#FFFFFF';
    if(combined){field('title').textContent='Review complete game capture';field('download').textContent='Download game JSON';field('copy').textContent='Copy game JSON';}
    else if(boxMode){field('title').textContent='Review GameChanger box score';field('download').textContent='Download box-score JSON';field('copy').textContent='Copy box-score JSON';}
    field('team-label').hidden = boxMode && !combined;
    if (boxMode && !combined) field('team-label').style.display = 'none';
    const importTeams = combined ? inspectPlays(combined.plays).teams : boxMode ? [] : inspectPlays(text).teams;
    for (const name of importTeams) {
      const option = document.createElement('option'); option.value = name; option.textContent = 'Only ' + name; field('team').appendChild(option);
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

    function updateSummary() {
      if(combined){try{const value=JSON.parse(field('text').value);field('summary').textContent=inspectPlays(value.plays).headings+' inning headings · '+value.box_score.teams.map(t=>t.name+': '+t.tables.length+' table(s)').join(' / ')+'. '+value.warnings.join(' ');}catch{field('summary').textContent='Invalid game JSON; undo edits or capture again.';}return;}
      if(boxMode){try{const value=JSON.parse(field('text').value);field('summary').textContent=value.teams.map(t=>t.name+': '+t.tables.length+' table(s)').join(' / ')+'. '+value.warnings.join(' ');}catch{field('summary').textContent='Invalid box-score JSON; undo the edit or capture again.';}return;}
      const summary = inspectPlays(field('text').value);
      field('summary').textContent = summary.headings + ' inning headings · ' + (summary.teams.join(' / ') || 'No teams detected') +
        (!summary.topFirst || !summary.bottomFirst ? '. A first-inning half is missing; check for a partial capture.' : '. Both first-inning halves found; this does not prove the capture is complete.');
    }
    function output() {
      validateDetectedDate(detected, field('date').value, field('year-confirm').checked);
      if(combined)return formatCombined(JSON.parse(field('text').value),{date:field('date').value,time:field('time').value,timezone:field('zone').value.trim(),yearConfirmed:field('year-confirm').checked,team:field('team').value});
      if(boxMode)return formatBoxCapture(JSON.parse(field('text').value),{date:field('date').value,time:field('time').value,timezone:field('zone').value.trim(),url});
      return formatCapture({ text: field('text').value, date: field('date').value, time: field('time').value, timezone: field('zone').value.trim(), url, team: field('team').value });
    }
    field('text').addEventListener('input', updateSummary);
    field('download').addEventListener('click', () => {
      try {
        const blob = new Blob([output() + '\n'], { type: combined||boxMode?'application/json;charset=utf-8':'text/plain;charset=utf-8' });
        const objectUrl = URL.createObjectURL(blob), link = document.createElement('a');
        link.href = objectUrl; link.download = (combined?'gamechanger-game-':boxMode?'gamechanger-boxscore-':'gamechanger-plays-') + (field('date').value || 'unknown-date') + (combined||boxMode?'.json':'.txt');
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
