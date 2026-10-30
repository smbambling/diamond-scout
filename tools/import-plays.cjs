#!/usr/bin/env node
'use strict';

// Local, dependency-free GameChanger text importer. The hosted app never loads this file.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const norm = s => s.normalize('NFC').replace(/[\u00a0\u202f]/g, ' ').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
const key = s => norm(s).toLowerCase();
const slug = s => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const canonical = s => norm(s);
const clone = s => JSON.parse(JSON.stringify(s));
const json = s => JSON.stringify(s, null, 2) + '\n';
const fail = (message,details={}) => { throw Object.assign(Error(message),details); };
const labels = new Set(['Single', 'Double', 'Triple', 'Home Run', 'Walk', 'Intentional Walk', 'Hit By Pitch', 'Strikeout', 'Ground Out', 'Fly Out', 'Line Out', 'Pop Out', 'Error', "Fielder's Choice", 'FC Double Play', 'Double Play', 'Sacrifice Fly', 'Sacrifice Bunt', 'Infield Fly', 'Foul Out', 'Dropped 3rd Strike', "Catcher's Interference", 'Runner Out', 'Caught Stealing']);
const resultLabels = {single:['Single'],double:['Double'],triple:['Triple'],home_run:['Home Run'],walk:['Walk','Intentional Walk'],hit_by_pitch:['Hit By Pitch'],strikeout_swinging:['Strikeout'],strikeout_looking:['Strikeout'],strikeout_foul_tip:['Strikeout'],dropped_third_strike:['Dropped 3rd Strike','Strikeout'],catchers_interference:["Catcher's Interference"],reached_on_error:['Error'],fielders_choice:["Fielder's Choice"],fielders_choice_double_play:['FC Double Play'],double_play:['Double Play'],sacrifice_bunt:['Sacrifice Bunt'],sacrifice_fly:['Sacrifice Fly'],infield_fly:['Infield Fly'],ground_out:['Ground Out'],fly_out:['Fly Out'],pop_out:['Pop Out'],line_out:['Line Out'],foul_out:['Foul Out','Pop Out','Fly Out','Line Out']};
const positions = {'left fielder':'LF', 'center fielder':'CF', 'right fielder':'RF', 'third baseman':'3B', 'shortstop':'SS', 'pitcher':'P', 'second baseman':'2B', 'first baseman':'1B', 'catcher':'C'};
const zones = {LF:'left_field', CF:'center_field', RF:'right_field', '3B':'third_base_area', SS:'shortstop_area', P:'pitcher_area', '2B':'second_base_area', '1B':'first_base_area', C:'catcher_area'};
const batterPattern = /^(.+?) (walks\b|is intentionally walked\b|is hit by pitch\b|strikes out\b|singles\b|doubles\b|triples\b|homers\b|hits\b|grounds\b|bunts\b|flies\b|pops\b|lines\b|out on\b|sacrifices\b|reaches\b|fouls out\b|is out on foul tip\b|out at first on dropped 3rd strike\b)/;
labels.add('Batter Out');
labels.add('Inning Ended');
resultLabels.batter_out=['Batter Out'];
const otherOutPattern=/^(.+?) out \(other\)(?:,|\.|$)/;
const batterMatch=text=>{
  const named=text.match(batterPattern)||text.match(otherOutPattern);if(named)return named;
  // A missing name is not a missing appearance. Mark identity explicitly unknown.
  const unnamed=('Unidentified '+text).match(batterPattern)||('Unidentified '+text).match(otherOutPattern);
  return unnamed?Object.assign(unnamed,{identity_unknown:true}):null;
};
const unnamedRunnerPattern=/^(?:steals (?:2nd|3rd|home)|scores on steal of home|(?:is )?caught stealing(?: (?:2nd|3rd|home))?|attempts to steal(?: (?:2nd|3rd|home))?)(?:[,.]|$)/i;

function loadCore(root = ROOT) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const script = html.match(/<script id="diamond-scout-core">([\s\S]*?)<\/script>/);
  if (!script) fail('Cannot find the app data validator in index.html.');
  const context = vm.createContext({});
  vm.runInContext(script[1], context, {timeout: 1000});
  return context.DiamondScout;
}

function dateValue(value) {
  if (!value || /^(unknown|null)$/i.test(value)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) fail('Date must be a real YYYY-MM-DD date (including year), or unknown.');
  return value;
}
function timeValue(value) {
  if (!value || /^(unknown|null)$/i.test(value)) return null;
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return value;
  const m = value.match(/^(1[0-2]|[1-9]):([0-5]\d)\s*(AM|PM)$/i);
  if (!m) fail('Start time must be HH:MM (24-hour) or h:mm AM/PM, or unknown.');
  return String(Number(m[1]) % 12 + (/pm/i.test(m[3]) ? 12 : 0)).padStart(2,'0') + ':' + m[2];
}
function sourceUrl(value) {
  if (!value || /^(unknown|null)$/i.test(value)) return null;
  let url; try { url = new URL(value); } catch { fail('Source must be a valid http(s) URL or unknown.'); }
  if (!['http:', 'https:'].includes(url.protocol)) fail('Source must use http(s).');
  return url.origin + url.pathname; // No credentials, private query tokens or fragments.
}

function readCapture(raw, options = {}, diagnostics=null) {
  const reject=(message,details={})=>{if(!diagnostics)fail(message,details);diagnostics.push({code:'capture_error',...details,message});};
  const checked=(fn,details)=>{try{return fn();}catch(error){reject(error.message,details);return null;}};
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/);
  const heading = line => norm(line).match(/^(Top|Bottom)\s+(\d+)(?:st|nd|rd|th)\s*[-–—]\s*(.+)$/i);
  const first = lines.findIndex(line => heading(line));
  if (first < 0) {reject('No inning/team headings found. Use captured Plays text, not a box score.');return null;}
  const prefix = lines.slice(0, first).join('\n');
  const meta = {},metaLines={};
  for (const [index,line] of prefix.split('\n').entries()) {
    const m = norm(line).match(/^(Date|Start time|Timezone|Source|Capture coverage|Import):\s*(.*)$/i);
    if (m) {
      const field = m[1].toLowerCase();
      if (meta[field] !== undefined && meta[field] !== m[2]) reject('Conflicting capture metadata: ' + m[1],{line:index+1});
      meta[field] = m[2];metaLines[field]=index+1;
    }
  }
  const location=(field,option)=>options[option]!=null?{option:'--'+option}:{line:metaLines[field]};
  const date = checked(()=>dateValue(options.date ?? meta.date),location('date','date'));
  const time = checked(()=>timeValue(options.time ?? meta['start time']),location('start time','time'));
  let timezone = options.timezone ?? meta.timezone ?? null;
  if (timezone && /^(unknown|null)$/i.test(timezone)) timezone = null;
  if (timezone && (timezone.length > 80 || /[\r\n\x00]/.test(timezone))) {reject('Timezone must be one short, supplied label.',location('timezone','timezone'));timezone=null;}
  const url = checked(()=>sourceUrl(options.source ?? meta.source),location('source','source'));
  const eventId = options.eventId || url?.match(/\/schedule\/([^/]+)/)?.[1] || null;
  let onlyTeam = options.team;
  if (!onlyTeam && meta.import && !/^both teams(?:\s*\(default\))?$/i.test(meta.import)) {
    const m = meta.import.match(/^only\s+(.+)$/i);
    if (!m) reject('Unrecognized Import directive. Use "both teams" or "only Team Name", or --team.',{line:metaLines.import});
    else onlyTeam = m[1];
  }
  // Retain original source bytes (including NBSP/CRLF) separately from parsing normalization.
  const original = raw.replace(/^\uFEFF/, '');
  let offset = 0;
  for (let i = 0; i < first; i++) offset = original.indexOf('\n', offset) + 1;
  const source = original.slice(offset).trim();
  const blocks = [];
  for (let i = first; i < lines.length; i++) {
    const h = heading(lines[i]);
    if (h) blocks.push({half:h[1].toLowerCase(), inning:Number(h[2]), team:h[3].trim(), lines:[], line:i+1});
    else if (norm(lines[i])) blocks.at(-1).lines.push({raw:lines[i], line:i+1});
  }
  const halves = new Map(), seen = new Set();
  for (const block of blocks) {
    if (!block.inning) reject('Invalid inning at line ' + block.line,{line:block.line});
    if (halves.has(block.half) && key(halves.get(block.half)) !== key(block.team)) reject('More than one team bats in the same half. Split multiple games into separate files.',{line:block.line});
    halves.set(block.half, block.team);
    const identity = block.inning + block.half;
    if (seen.has(identity)) reject('Repeated inning heading at line ' + block.line + '. Review overlapping capture sections.',{line:block.line});
    seen.add(identity);
  }
  if (halves.size === 2 && key(halves.get('top')) === key(halves.get('bottom'))) reject('Both halves name the same team.');
  const order = options.order || 'newest-first';
  if (!['newest-first','oldest-first'].includes(order)) reject('--order must be newest-first or oldest-first.');
  const rank = block => block.inning * 2 + (block.half === 'bottom' ? 1 : 0);
  for (let i=1; i<blocks.length; i++) if ((rank(blocks[i])-rank(blocks[i-1])) * (order === 'newest-first' ? -1 : 1) < 0) reject('Inning order conflicts with --order ' + order + '. Check the capture or choose --order oldest-first.',{line:blocks[i].line});
  return {date, time, timezone, url, eventId, onlyTeam, source, raw, sourceHash:hash(source), coverage:meta['capture coverage'] || 'Supplied text only; completeness not verified', blocks, halves, order};
}

function resultFor(text, label) {
  if (/^out \(other\)(?:,|\.|$)/i.test(text)) return 'batter_out';
  if (/^(?:is out on foul tip|strikes out.*foul tip)/i.test(text)) return 'strikeout_foul_tip';
  if (/dropped (?:3rd|third) strike/i.test(text)) return 'dropped_third_strike';
  if (/^reaches on catcher'?s interference/i.test(text)) return 'catchers_interference';
  if (/^(?:walks\b|is intentionally walked\b)/i.test(text)) return 'walk';
  if (/^is hit by pitch/i.test(text)) return 'hit_by_pitch';
  if (/^strikes out swinging/i.test(text)) return 'strikeout_swinging';
  if (/^strikes out looking/i.test(text)) return 'strikeout_looking';
  if (label === 'Foul Out' || /^(?:fouls out)\b/i.test(text) || /\bfoul (?:territory|ground)\b/i.test(text)) return 'foul_out';
  if (/^singles\b/i.test(text)) return 'single';
  if (/^doubles\b/i.test(text)) return 'double';
  if (/^triples\b/i.test(text)) return 'triple';
  if (/^(?:homers\b|hits (?:an? )?(?:inside[ -]the[ -]park )?home run\b)/i.test(text)) return 'home_run';
  if (/reaches on an? error/i.test(text)) return 'reached_on_error';
  if (/fielder'?s choice double play/i.test(text)) return 'fielders_choice_double_play';
  if (/fielder'?s choice/i.test(text)) return 'fielders_choice';
  if (/into (?:a )?double play/i.test(text)) return 'double_play';
  if (/^(?:sacrifices\b|out on sacrifice bunt\b)/i.test(text)) return 'sacrifice_bunt';
  if (/^out on sacrifice fly/i.test(text)) return 'sacrifice_fly';
  if (/^out on infield fly/i.test(text)) return 'infield_fly';
  if (/^(?:grounds|bunts) out/i.test(text)) return 'ground_out';
  if (/^flies out/i.test(text)) return 'fly_out';
  if (/^pops out/i.test(text)) return 'pop_out';
  if (/^lines out/i.test(text)) return 'line_out';
  fail('Unsupported batter result: ' + text);
}

function contactFor(text, result, raw) {
  if (['walk','hit_by_pitch','strikeout_swinging','strikeout_looking','strikeout_foul_tip','dropped_third_strike','catchers_interference','batter_out'].includes(result)) return null;
  const type = /\bbunt|^sacrifices\b/i.test(text) ? 'bunt' : /ground ball|^grounds\b/i.test(text) ? 'ground_ball' : /line drive|^lines\b/i.test(text) ? 'line_drive' : /fly|^flies\b|^pops\b/i.test(text) ? 'fly_ball' : 'unknown';
  const fielder = text.match(/\b(left fielder|center fielder|right fielder|third baseman|shortstop|pitcher|second baseman|first baseman|catcher)\b/i);
  const position = fielder ? positions[fielder[0].toLowerCase()] : null;
  let zone = position ? zones[position] : null, precision = position ? 'fielder_zone' : 'unknown';
  const depth = /\bshallow\b/i.test(text) ? 'shallow' : /\bdeep\b/i.test(text) ? 'deep' : null;
  if (result === 'foul_out') {
    zone = /\b(?:left|third.base.side) foul (?:territory|ground)\b/i.test(text) ? 'left_foul_territory' : /\b(?:right|first.base.side) foul (?:territory|ground)\b/i.test(text) ? 'right_foul_territory' : /\bbehind (?:home plate|the plate)\b/i.test(text) ? 'behind_home_plate' : null;
    precision = zone ? 'described_area' : 'unknown';
  } else {
    const area = /\b(?:down |along )?(?:the )?left.field line\b/i.test(text) ? 'left_field_line' : /\b(?:down |along )?(?:the )?right.field line\b/i.test(text) ? 'right_field_line' : /\bleft.center(?:.field)?(?: gap)?\b/i.test(text) ? 'left_center' : /\bright.center(?:.field)?(?: gap)?\b/i.test(text) ? 'right_center' : null;
    if (area) { zone = area; precision = 'described_area'; }
    else if (depth) {
      const outfield = text.match(/\b(left|center|right) field\b/i);
      zone = outfield ? outfield[1].toLowerCase() + '_field' : null;
      precision = zone ? 'described_area' : 'unknown';
    }
  }
  return {contact_type:type, fielding_position:position, location:{zone, precision, direction:null, depth:precision === 'described_area' ? depth : null}, source_text:raw};
}

// Non-pitch context is preserved and processed separately; unfamiliar tokens stop the import.
function splitEvents(text){return text.split(/,(?!\s*(?:Jr\.|Sr\.|II|III|IV)(?=\s|$))\s*/i);}
function isContext(token) {
  if(unnamedRunnerPattern.test(token))return true;
  if(/^Score changed to \d+-\d+$/i.test(token)||/^\(Play Edit\) .+ in for .+$/i.test(token))return true;
  if(/^Outs changed to [0-3]$/i.test(token))return true;
  if (/^Balk(?: by pitcher .+)?$/i.test(token)) return true;
  if (/^.+ gets placed on (?:1st|2nd|3rd)$/i.test(token)) return true;
  return /^(?:Pickoff attempt at (?:1st|2nd|3rd)|Lineup changed: .+|(?:Courtesy|Pinch) runner .+ in for .+|.+ (?:advances to |remains at |held up at |did not score|scores\b|steals\b|caught stealing\b|is caught stealing\b|out (?:at |advancing |due to )|attempts to steal\b|picked off\b))/i.test(token);
}
const fieldingRole='(?:'+Object.keys(positions).join('|')+')';
const fieldingChain=new RegExp('^'+fieldingRole+'(?: [^,\\d]+?)?(?: to '+fieldingRole+'(?: [^,\\d]+?)?)+$','i');
const singleFielder=new RegExp('^'+fieldingRole+'(?: [^,\\d]+)?$','i');
function parsePitches(rawLines, result, warnings, diagnostics=null) {
  // Keep separators so a comma-delimited throw belongs to the original runner event verbatim.
  const tokens = rawLines.flatMap(line => {
    const parts=line.raw.replace(/\.\s*$/, '').split(/(,(?!\s*(?:Jr\.|Sr\.|II|III|IV)(?=\s|$))\s*)/i);
    return parts.flatMap((raw,index)=>index%2 || !norm(raw)?[]:[{raw,line:line.line,separator:index?parts[index-1]:'\n'}]);
  });
  const pitches = [], context = []; let balls=0, strikes=0, known=true, contextTail=false;
  for (const {raw:rawToken,line,separator} of tokens) {
    const token = norm(rawToken); let outcome, nb=balls, ns=strikes, valid=true;
    let m;
    if ((m=token.match(/^Ball ([1-4])$/i))) { outcome='ball'; nb=Number(m[1]); valid=nb===balls+1; }
    else if ((m=token.match(/^Strike ([1-3]) (looking|swinging)$/i))) { outcome=m[2].toLowerCase()==='looking'?'called_strike':'swinging_strike'; ns=Number(m[1]); valid=ns===strikes+1; }
    else if (/^Foul$/i.test(token)) { outcome='foul'; ns=Math.min(2,strikes+1); }
    else if (/^Foul tip$/i.test(token)) { outcome='foul_tip'; ns=result==='strikeout_foul_tip'?strikes+1:Math.min(2,strikes+1); if (result==='strikeout_foul_tip' && strikes!==2) valid=false; }
    else if (/^In play$/i.test(token)) outcome=result==='foul_out'?'foul_out':'in_play';
    else if (/^Hit by pitch$/i.test(token)) outcome='hit_by_pitch';
    else if (/^Ball$/i.test(token)) { outcome='ball'; valid=false; }
    else if (/^Strike (looking|swinging)$/i.test(token)) { outcome=/looking/i.test(token)?'called_strike':'swinging_strike'; valid=false; }
    else if (isContext(token)) {
      // Validate runner wording during scanning as well as during conversion.
      try { runningToken(token); } catch(error) {
        const issue={code:'unsupported_runner_event',line,token:rawToken,message:error.message};
        if(!diagnostics)fail(issue.message,issue);diagnostics.push(issue);
      }
      context.push({raw:rawToken, text:token}); contextTail=true; continue;
    }
    else if (contextTail && (fieldingChain.test(token)||(singleFielder.test(token)&&!/\bto\b/i.test(token))) && /\b(?:caught stealing|picked off|out (?:at|advancing|due to))\b/i.test(context.at(-1).text)) {
      const previous=context.at(-1); previous.raw+=separator+rawToken; previous.text=norm(previous.raw); continue;
    }
    else {
      const issue={code:'unsupported_token',line,token:rawToken,message:'Unsupported pitch/context token: "'+token+'". No pitches were dropped.'};
      if(!diagnostics)fail(issue.message,issue);
      diagnostics.push(issue);known=false;contextTail=false;continue;
    }
    contextTail=false;
    if (balls>3 || strikes>2 || nb>4 || ns>3 || !valid) known=false;
    pitches.push({sequence:pitches.length+1, outcome, count_before:known?{balls,strikes}:null, count_after:known?{balls:nb,strikes:ns}:null, pitch_type:null, velocity_mph:null, location:null});
    balls=nb; strikes=ns;
  }
  if (!known) {
    // A partial sequence cannot establish an initial 0–0 count for earlier pitches either.
    for (const p of pitches) p.count_before=p.count_after=null;
    warnings.push('Pitch sequence has missing/conflicting count evidence; pitches retained with unknown counts.');
  }
  return {pitches, context};
}
function isScore(text) {
  return /^\d+ Outs?$/i.test(text) || /^.+?\s+\d+\s*-\s*.+?\s+\d+(?:\s*\|\s*\d+ Outs?)?$/i.test(text);
}

function parseBlock(block, diagnostics=null) {
  const segments=[]; let current=null;
  for (const line of block.lines) {
    const text=norm(line.raw);
    // Recovery boundaries are diagnostic only. Unknown headings are never accepted for import.
    const possibleHeading=diagnostics&&!labels.has(text)&&/^[A-Z][A-Za-z' –-]{1,49}$/.test(text)&&!batterMatch(text)&&!isContext(text)&&!['Foul','Foul tip','In play','Ball','Strike looking','Strike swinging','Hit by pitch'].includes(text)&&!/^.+ at bat$/.test(text);
    if (labels.has(text) || /^.+ at bat$/.test(text) || possibleHeading) {
      current={label:labels.has(text)||possibleHeading?text:null, unsupported:possibleHeading, lines:[], inning:block.inning, half:block.half, team:block.team}; segments.push(current);
    }
    if (!current) {
      const issue={line:line.line,code:'unexpected_text',message:'Unexpected text at line '+line.line+': '+text+'. Remove page navigation/footer text.'};
      if(!diagnostics)fail(issue.message,issue);diagnostics.push(issue);continue;
    }
    current.lines.push(line);
  }
  return segments.map(segment => {
    const diagnosticStart=diagnostics?.length||0;
    try {
      const warnings=[], lines=segment.lines;
      if(segment.unsupported){
        diagnostics.push({code:'unsupported_heading',line:lines[0].line,token:lines[0].raw,message:'Unsupported result heading: '+segment.label});
        const description=lines.find(line=>batterMatch(norm(line.raw)));
        const pitchLines=lines.filter(line=>line!==lines[0]&&line!==description&&!isScore(norm(line.raw)));
        parsePitches(pitchLines,'unknown',warnings,diagnostics);
        return null;
      }
      if (!segment.label) {
        const pitchLines=lines.slice(1).filter(line=>!isScore(norm(line.raw)));
        const {pitches,context}=parsePitches(pitchLines,'unknown',warnings,diagnostics);
        if(pitches.length)warnings.push('Unfinished at-bat has listed pitches but no completed result; retained as incomplete.');
        return {...segment, kind:'pa', name:norm(lines[0].raw).replace(/ at bat$/, ''), status:'incomplete', result:'unknown', pitches, context, warnings, source_text:lines[0].raw, source_pitch_sequence:pitchLines.length?pitchLines.map(line=>line.raw).join('\n'):null};
      }
      if(segment.label==='Inning Ended'){if(lines.some(l=>!['Inning Ended','3 Outs','Half-inning ended by scorekeeper.'].includes(norm(l.raw))))fail('Unrecognized inning-end context.');return {...segment,kind:'administrative',context:[],warnings};}
      if (['Runner Out','Caught Stealing'].includes(segment.label)) {
        const content=lines.filter(line=>norm(line.raw)!==segment.label&&!isScore(norm(line.raw))&&!/^Half-inning ended by out on the base paths\.$/.test(norm(line.raw)));
        const tokens=content.flatMap(line=>splitEvents(line.raw.replace(/\.$/,'')));
        const picked=tokens.map(raw=>({raw,m:norm(raw).match(/^(.+?) (?:picked off at (1st|2nd|3rd)|(?:is )?caught stealing (2nd|3rd|home)|out at (1st|2nd|3rd|home))(?:[.]|$)/i)})).filter(t=>t.m);
        if(picked.length){
          const parsed=parsePitches(content,'unknown',warnings,diagnostics);
          if(parsed.pitches.length)warnings.push(parsed.pitches.length+' recorded pitches end on a runner-only out with no identified batter; preserved separately, not assigned to a fabricated PA.');
          return {...segment,kind:'runner_out',name:picked[0].m[1],reason:/caught stealing/i.test(picked[0].raw)?'caught_stealing':'picked_off',source_text:content.map(l=>l.raw).join('\n'),source_pitch_sequence:content.map(l=>l.raw).join('\n'),pitches:parsed.pitches,context:parsed.context,runner_actions:picked.map(t=>({name:t.m[1],reason:/caught stealing/i.test(t.raw)?'caught_stealing':/picked off/i.test(t.raw)?'picked_off':'recorded_runner_out',marker:/is caught stealing/i.test(t.raw)?'is caught stealing':/caught stealing/i.test(t.raw)?'caught stealing':/picked off/i.test(t.raw)?'picked off':'out at'})),warnings};
        }
        const description=lines.find(line => /^.+ (?:out (?:due to|at|advancing)|(?:is )?caught stealing)\b/.test(norm(line.raw)));
        if (!description) fail('Unrecognized standalone runner out.');
        const m=norm(description.raw).match(/^(.+?) ((?:out (?:due to|at|advancing)|(?:is )?caught stealing)\b.*)$/);
        for (const line of lines) if (line!==description && norm(line.raw)!==segment.label && !isScore(norm(line.raw)) && !/^Half-inning ended by out on the base paths\.$/.test(norm(line.raw))) fail('Unclassified runner-out context: '+norm(line.raw));
        return {...segment, kind:'runner_out', name:m[1], reason:/offensive interference/i.test(m[2])?'offensive_interference':/caught stealing/i.test(m[2])?'caught_stealing':'recorded_runner_out', source_text:description.raw, context:[], warnings};
      }
      const descriptions=lines.filter(line => batterMatch(norm(line.raw)));
      if (descriptions.length!==1) fail('Expected exactly one batter-result description; found '+descriptions.length+'.');
      const description=descriptions[0], m=batterMatch(norm(description.raw)), name=m.identity_unknown?null:m[1], text=m.identity_unknown?norm(description.raw):norm(description.raw).slice(name.length+1);
      if(m.identity_unknown)warnings.push('Batter name is missing in the source; appearance retained under a separate unidentified-batter label, without inferring identity.');
      const result=resultFor(text,segment.label);
      if (!resultLabels[result]?.includes(segment.label)) fail('Result heading "'+segment.label+'" conflicts with the batter description.');
      const pitchLines=lines.filter(line => line!==description && norm(line.raw)!==segment.label && !isScore(norm(line.raw)));
      const extra=pitchLines.find(line=>line.line>description.line);
      if (extra) fail('Unexpected text after batter description.',{line:extra.line,code:'unexpected_text'});
      const {pitches,context}=parsePitches(pitchLines,result,warnings,diagnostics);
      if (!pitches.length) warnings.push('No recorded pitch sequence supplied; none invented.');
      if (result==='hit_by_pitch' && !pitches.some(p=>p.outcome==='hit_by_pitch')) warnings.push('HBP ruling has no listed terminal HBP pitch; listed pitches retained.');
      if (result==='catchers_interference' && pitches.at(-1)?.outcome==='ball' && norm(pitchLines.at(-1)?.raw||'').endsWith('Ball 4.')) warnings.push('Catcher interference ruling conflicts with listed Ball 4; both retained without a walk reclassification.');
      if (result==='walk' && /^is intentionally walked\b/i.test(text)) warnings.push('Intentional walk award; only explicitly listed pitches retained.');
      else if (result==='walk' && pitches.at(-1)?.count_after?.balls!==4) warnings.push('Walk ruling lacks a verified terminal Ball 4; no pitch added.');
      if ((result.startsWith('strikeout_') || result==='dropped_third_strike') && pitches.at(-1)?.count_after?.strikes!==3) warnings.push('Strikeout ruling lacks a verified terminal third strike; no pitch added.');
      const contact=contactFor(text,result,description.raw);
      if (contact && pitches.length && !['in_play','foul_out'].includes(pitches.at(-1).outcome)) warnings.push('Contact ruling lacks a listed terminal contact pitch; no pitch added.');
      if (contact && !contact.fielding_position) warnings.push('Contact has no explicit recorded fielder; retained in the denominator.');
      if (contact?.contact_type==='unknown') warnings.push('Contact type not supplied; retained as unknown.');
      if (result==='foul_out' && pitches.some(p=>p.outcome==='foul_out')) warnings.push('Listed terminal In play represents the explicit foul catch; stored as foul_out, original pitch text retained.');
      const pitcher=text.match(/(?:^|, )([^,]+) pitching(?:,|\.)/);
      const record={...segment, kind:'pa', name, identity_unknown:!!m.identity_unknown, status:'complete', result, pitches, context, warnings, batted_ball:result==='foul_out'?null:contact, pitcher:{name:pitcher?.[1]||null, attribution:pitcher?'explicit':'unknown'}, source_text:description.raw, source_pitch_sequence:pitchLines.length?pitchLines.map(line=>line.raw).join('\n'):null};
      if (result==='foul_out') record.foul_contact=contact;
      if (result==='batter_out') {
        record.reached_base=false;
        warnings.push('Source records Batter Out / out (other), without the ruling or contact description. PA and pitches retained; fair contact and official AB classification are unresolved. Full-selection batting rates remain unknown; the app separately labels stats from classified PAs until reviewed.');
      }
      if (result==='dropped_third_strike') {
        record.reached_base=/^out at first\b|\bout at (?:1st|first)\b/.test(text)?false:/^reaches\b/.test(text)?true:null;
        if (record.reached_base===null) warnings.push('Dropped-third-strike reach status unknown; steal tendency will be withheld.');
      }
      return record;
    } catch (error) {
      const line=error.line||segment.lines[0].line,message='Line '+line+' ('+block.team+', '+block.half+' '+block.inning+'): '+error.message;
      if(!diagnostics)fail(message,{...error,line});
      diagnostics.push({code:error.code||'record_error',line,token:error.token,message});return null;
    } finally {
      if(diagnostics)for(let i=diagnosticStart;i<diagnostics.length;i++)diagnostics[i].record=segment.lines;
    }
  }).filter(Boolean);
}

function runningToken(text) {
  let m;
  if(unnamedRunnerPattern.test(text))return {...runningToken('Unidentified runner '+text),name:null,identity_unknown:true};
  if ((m=text.match(/^(.+?) gets placed on (1st|2nd|3rd)$/i))) return {kind:'placement',name:m[1],base:{'1st':'1B','2nd':'2B','3rd':'3B'}[m[2].toLowerCase()]};
  if ((m=text.match(/^(Courtesy|Pinch) runner (.+) in for (.+?)[.]?$/i))) return {kind:'entry', name:m[2], replaced:m[3], type:m[1].toLowerCase()==='courtesy'?'courtesy_runner':'pinch_runner'};
  if ((m=text.match(/^(.+?) steals (2nd|3rd|home)(?:[.]|$)/i))) return {kind:'attempt', name:m[1], base:{'2nd':'2B','3rd':'3B',home:'home'}[m[2].toLowerCase()], result:'stolen_base'};
  if ((m=text.match(/^(.+?) scores on steal of home(?:[.]|$)/i))) return {kind:'attempt', name:m[1], base:'home', result:'stolen_base'};
  if ((m=text.match(/^(.+?) (?:is )?caught stealing(?: (2nd|3rd|home))?(?:[,.]|$)/i))) return {kind:'attempt', name:m[1], base:m[2]?{'2nd':'2B','3rd':'3B',home:'home'}[m[2].toLowerCase()]:null, result:'caught_stealing'};
  if ((m=text.match(/^(.+?) attempts to steal(?: (2nd|3rd|home))?(?:[.]|$)/i))) return {kind:'attempt', name:m[1], base:m[2]?{'2nd':'2B','3rd':'3B',home:'home'}[m[2].toLowerCase()]:null, result:'unknown'};
  if (/\b(?:steals|stealing|steal of|attempts to steal)\b/i.test(text)) fail('Unrecognized steal description: '+text+'. Resolve it before importing.');
  return null;
}

function buildTeam(capture, teamName, data, gameId, opponent, D) {
  const half=[...capture.halves].find(([,name])=>key(name)===key(teamName))[0];
  const blocks=capture.blocks.filter(b=>b.half===half).slice();
  if (capture.order==='newest-first') blocks.reverse();
  const timeline=blocks.flatMap(block=>{const records=parseBlock(block);return capture.order==='newest-first'?records.reverse():records;});
  if (!timeline.length) fail('No records supplied for '+teamName+'. No empty history was created.');
  const names=new Map();
  for (const player of data.players) {
    if (names.has(key(player.name))) fail('Ambiguous existing player name: '+player.name);
    names.set(key(player.name),player.id);
  }
  function playerId(name) {
    const k=key(name); if (names.has(k)) return names.get(k);
    const id=data.team.id+'-'+slug(name);
    if (!slug(name) || data.players.some(p=>p.id===id)) fail('Player ID collision for '+name+'. Resolve the player identity manually.');
    names.set(k,id); data.players.push({id,name,bats:null}); return id;
  }
  let sequence=0, inning=0; const active=new Map(), pas=[], events=[], entries=[], outs=[], warnings=[];
  function unidentifiedPlayer(role,label){
    const id=gameId+'-unidentified-'+role+'-'+label;
    if(data.players.some(p=>p.id===id))fail('Unidentified player ID collision: '+id);
    data.players.push({id,name:'Unidentified '+role+' ('+(capture.date||'undated')+', '+half+' '+inning+', '+(role==='batter'?'PA ':'event ')+label+', '+hash(gameId).slice(0,8)+')',bats:null,identity_status:'unidentified',source_game_id:gameId});return id;
  }
  for (const record of timeline) {
    if(record.kind==='administrative')continue;
    if (record.inning!==inning) { active.clear(); inning=record.inning; }
    const runner=record.identity_unknown?unidentifiedPlayer('batter',String(sequence+1)):playerId(record.name);
    const base={game_id:gameId,inning,half};
    let pa=null;
    if (record.kind==='pa') {
      sequence++;
      pa={...base,id:gameId+'-'+half+'-'+inning+'-pa-'+String(sequence).padStart(3,'0'),sequence,batter_id:runner,status:record.status,result:record.result,pitches:record.pitches,batted_ball:record.batted_ball||null,pitcher:record.pitcher||{name:null,attribution:'unknown'},source_text:record.source_text,source_pitch_sequence:record.source_pitch_sequence,source_events:record.lines.map(line=>line.raw)};
      if (record.foul_contact) pa.foul_contact=record.foul_contact;
      if (record.reached_base!==undefined) pa.reached_base=record.reached_base;
      if (record.warnings.length) pa.notes=[...record.warnings];
      pas.push(pa);
    }
    const processed=new Set();
    function apply(rawToken, isNarrative=false) {
      const text=norm(rawToken).replace(/\.$/, ''), action=runningToken(text);
      if (action) {
        const identity=JSON.stringify(action);
        if (isNarrative && processed.has(identity)) return; // Same event echoed in summary text.
        processed.add(identity);
        const id=action.identity_unknown?unidentifiedPlayer('runner',String(events.length+1)):playerId(action.name), visit=active.get(id);
        if(action.identity_unknown)warnings.push('Runner name is missing in the source; attempt retained under a separate unidentified-runner label, without guessing a trip link.');
        if (action.kind==='placement') {
          if(visit)fail('Runner placement conflicts with an active trip for '+action.name+'. Review duplicate placement context.');
          const entry={...base,id:gameId+'-entry-'+String(entries.length+1).padStart(3,'0'),runner_id:id,replaced_runner_id:null,entry_type:'placed_runner',placed_base:action.base,source_text:rawToken};
          if(pa)entry.source_pa_id=pa.id;
          entries.push(entry);active.set(id,{runner_entry_id:entry.id});
        } else if (action.kind==='entry') {
          const replaced=playerId(action.replaced), prior=active.get(replaced);
          if (id===replaced) fail('Runner replacement names the same player twice.');
          const entry={...base,id:gameId+'-entry-'+String(entries.length+1).padStart(3,'0'),runner_id:id,replaced_runner_id:replaced,entry_type:action.type,source_text:rawToken};
          if (pa) entry.source_pa_id=pa.id;
          if (prior?.runner_entry_id) entry.replaced_entry_id=prior.runner_entry_id;
          else if (prior?.reach_pa_id) entry.reach_pa_id=prior.reach_pa_id;
          else {warnings.push('Replacement for '+action.replaced+' has no known original reach; review trip linkage.');if(record.context.some(t=>/^\(Play Edit\)/.test(t.text))){entry.unresolved_trip=true;warnings.push('Play Edit conflicts with the recorded reach identity; original PA retained, running opportunity denominator withheld until reviewed.');}}
          entries.push(entry); active.delete(replaced); active.set(id,{runner_entry_id:entry.id,reach_pa_id:entry.reach_pa_id});
        } else {
          const event={...base,id:gameId+'-attempt-'+String(events.length+1).padStart(3,'0'),runner_id:id,result:action.result,to_base:action.base,source_text:rawToken};
          if (pa) event.source_pa_id=pa.id;
          if (visit?.runner_entry_id) event.runner_entry_id=visit.runner_entry_id;
          else if (visit?.reach_pa_id) event.reach_pa_id=visit.reach_pa_id;
          else warnings.push('Attempt by '+(action.name||'an unidentified runner')+' has no known on-base trip; tendency will be withheld.');
          events.push(event);
          if (action.result==='caught_stealing' || action.base==='home') active.delete(id);
        }
      }
      // Only explicit scores/outs end a tracked trip; holds, errors and advances do not.
      const gone=text.match(/^(.+?) (?:scores(?:\b|$)|out (?:at |advancing |due to )|doubled off at |picked off\b)/i);
      if (gone && names.has(key(gone[1]))) active.delete(names.get(key(gone[1])));
    }
    if(record.runner_actions){
      let actionIndex=0;
      for(const token of record.context){
        const action=record.runner_actions[actionIndex];
        if(action&&norm(token.raw).startsWith(action.name+' '+action.marker)){
          const id=playerId(action.name),visit=active.get(id),out={...base,id:gameId+'-runner-out-'+String(outs.length+1).padStart(3,'0'),runner_id:id,reason:action.reason,source_text:token.raw,source_events:record.lines.map(l=>l.raw)};
          if(visit?.reach_pa_id&&!visit.runner_entry_id)out.reach_pa_id=visit.reach_pa_id;
          actionIndex++;
          if(actionIndex===record.runner_actions.length&&record.pitches?.length){out.pitches=record.pitches;out.source_pitch_sequence=record.source_pitch_sequence;out.batter_id=null;out.notes=[...record.warnings];}
          outs.push(out);apply(token.raw);active.delete(id);
        }else apply(token.raw);
      }
      if(actionIndex!==record.runner_actions.length)fail('Runner-out context could not be reconciled without dropping an event.');
      for(const message of record.warnings)warnings.push('Line '+record.lines[0].line+': '+message);
      continue;
    }
    for (const token of record.context)if(!(record.kind==='runner_out'&&norm(token.raw).startsWith(record.name+' '+(record.reason==='picked_off'?'picked off':'caught stealing'))))apply(token.raw);
    if (pa) {
      if (D.onBaseStatus(pa)===true) active.set(runner,{reach_pa_id:pa.id});
      // Summary clauses contain explicit advances, scores, runner outs and occasionally steals.
      const clauses=splitEvents(record.source_text);
      for (const clause of clauses.slice(1)) apply(clause,true);
    } else {
      const visit=active.get(runner);
      const out={...base,id:gameId+'-runner-out-'+String(outs.length+1).padStart(3,'0'),runner_id:runner,reason:record.reason,source_text:record.source_text,source_events:record.lines.map(line=>line.raw)};
      if(record.pitches?.length){out.pitches=record.pitches;out.source_pitch_sequence=record.source_pitch_sequence;out.batter_id=null;out.notes=[...record.warnings];}
      if (visit?.reach_pa_id && !visit.runner_entry_id) out.reach_pa_id=visit.reach_pa_id;
      outs.push(out); if(record.reason==='caught_stealing'&&record.context.length){const token=record.context.find(t=>norm(t.raw).startsWith(record.name+' caught stealing'));if(token)apply(token.raw);}else apply(record.source_text);active.delete(runner);
    }
    for (const message of record.warnings) warnings.push('Line '+record.lines[0].line+': '+message);
  }
  const game={id:gameId,date:capture.date,start_time:capture.time,timezone:capture.timezone,opponent,batting_half:half,label:'vs. '+opponent,source:'Local GameChanger text converter',source_url:capture.url,source_event_id:capture.eventId,source_capture_coverage:capture.coverage,source_control_events:timeline.filter(r=>r.kind==='administrative').map(r=>({inning:r.inning,half:r.half,source_events:r.lines.map(l=>l.raw)})),source_scope:'Supplied '+half+' innings '+blocks.map(b=>b.inning).join(', ')+' only; completeness not verified',source_play_by_play:capture.source,source_sha256:capture.sourceHash,source_canonical_sha256:hash(canonical(capture.source)),notes:['No final score, missing innings or unlisted pitches were inferred. Original capture text retained.']};
  data.games.push(game); data.plate_appearances.push(...pas);
  data.baserunning_events=(data.baserunning_events||[]).concat(events);
  data.baserunning_entries=(data.baserunning_entries||[]).concat(entries);
  if (outs.length) data.runner_outs=(data.runner_outs||[]).concat(outs);
  D.validateData(data);
  const running=D.baserunningSummary(data,{game:gameId,batter:'all'});
  return {warnings,counts:{plate_appearances:pas.length,complete:pas.filter(p=>p.status==='complete').length,incomplete:pas.filter(p=>p.status==='incomplete').length,pitches:pas.reduce((n,p)=>n+p.pitches.length,0)+outs.reduce((n,o)=>n+(o.pitches?.length||0),0),runner_only_pitches:outs.reduce((n,o)=>n+(o.pitches?.length||0),0),fair_contacts:pas.filter(p=>p.batted_ball).length,foul_catches:pas.filter(p=>p.foul_contact).length,hits:pas.filter(p=>D.hit(p)).length,unclassified_batting_results:D.battingSummary(pas).unclassified,steal_attempts:events.length,stolen_bases:running.stolen,caught_stealing:running.caught,unknown_attempts:running.unknown,on_base_trips:running.onBase,trips_with_attempts:running.attemptedVisits,unlinked_attempts:running.unlinkedAttempts,runner_entries:entries.length,runner_only_outs:outs.length}};
}

function inside(root, relative) {
  const destination=path.resolve(root,relative), rel=path.relative(root,destination);
  if (!rel || rel.startsWith('..'+path.sep) || path.isAbsolute(rel)) fail('Output path escapes the project: '+relative);
  let current=root;
  for (const part of rel.split(path.sep)) {
    current=path.join(current,part);
    if (fs.lstatSync(current,{throwIfNoEntry:false})?.isSymbolicLink()) fail('Refusing a symlink in an output path: '+relative);
  }
  return destination;
}

// Expand a single downloaded game bundle into the existing Plays + box-score pipeline.
function expandInputs(inputs,options={}){
  const plays=[],boxes=[...(options.boxInputs||[])],bundles=[...(options.bundleInputs||[])];
  for(const input of inputs){
    if(input.error||typeof input.raw!=='string'||!/^\s*\{/.test(input.raw)){plays.push(input);continue;}
    let value;try{value=JSON.parse(input.raw);}catch{fail('Invalid game capture JSON: '+input.name);}
    if(value.kind==='diamond-scout-box-score'){require('./box-score.cjs').read(input);boxes.push(input);continue;}
    if(value.schema_version!==1||value.kind!=='diamond-scout-game'||typeof value.plays!=='string'||!value.box_score)fail('Unsupported game capture JSON: '+input.name);
    const box={name:input.name+' [box score]',raw:json(value.box_score)};require('./box-score.cjs').read(box);
    const capture=readCapture(value.plays,{});
    if(!value.source_event_id||capture.eventId!==value.source_event_id||value.box_score.source_event_id!==value.source_event_id)fail('Combined capture has mismatched Plays/Box score game IDs: '+input.name);
    plays.push({name:input.name,raw:value.plays,captureWarnings:Array.isArray(value.warnings)?value.warnings.filter(w=>typeof w==='string'):[]});boxes.push(box);bundles.push(input);
  }
  return {inputs:plays,options:{...options,boxInputs:boxes,bundleInputs:bundles}};
}

function planImports(root, inputs, options = {}, previousState=null) {
  const suppliedInputCount=inputs.length;
  ({inputs,options}=expandInputs(inputs,options));
  if(suppliedInputCount&&!inputs.length)fail('Box-score-only input needs a matching Plays TXT or combined game JSON capture.');
  if(previousState){
    return {...planWithState(root,inputs,options,{...previousState,manifest:clone(previousState.manifest),dataById:new Map([...previousState.dataById].map(([id,data])=>[id,clone(data)]))}),preflightOnly:true};
  }
  const D=loadCore(root), manifestFile=inside(root,'teams.json');
  const manifestBytes=fs.readFileSync(manifestFile),manifest=JSON.parse(manifestBytes); D.validateManifest(manifest);
  const initial=new Map([['teams.json',manifestBytes]]), dataById=new Map(), files=new Set();
  for (const entry of manifest.teams) {
    const file=inside(root,entry.data_file);
    if (files.has(file)) fail('Two manifest entries share one team file.'); files.add(file);
    const bytes=fs.readFileSync(file), data=JSON.parse(bytes); D.validateData(data);
    if (data.team.id!==entry.id) fail('Manifest/team identity mismatch: '+entry.data_file);
    initial.set(entry.data_file,bytes); dataById.set(entry.id,data);
  }
  return planWithState(root,inputs,options,{D,manifest,initial,dataById});
}
function planWithState(root,inputs,options,state){
  const {D,manifest,initial,dataById}=state;
  const report=[], touched=new Set(), visited=[];
  const B=require('./box-score.cjs'),boxes=(options.boxInputs||[]).map(B.read);
  for (const input of inputs) {
    const capture=readCapture(input.raw,options);
    let selected=0;
    for (const [half,name] of capture.halves) {
      const alias=options.aliases?.[name];
      const matches=manifest.teams.filter(entry=>alias?entry.id===alias:key(entry.name)===key(name));
      if (matches.length>1 || (alias&&!matches.length)) fail('Ambiguous or missing team match for '+name+'.');
      let entry=matches[0];
      if (capture.onlyTeam && ![key(name),key(entry?.id||''),key(entry?.name||'')].includes(key(capture.onlyTeam))) continue;
      selected++;
      if (!entry) {
        const id=slug(name);
        if (!id || manifest.teams.some(t=>t.id===id)) fail('Team ID collision for '+name+'. Use --team-alias "Captured Name=existing-id" for a known team, or review the names.');
        entry={id,name,data_file:'data/'+id+'.json'};
        if (fs.existsSync(inside(root,entry.data_file))) fail('Unregistered team file already exists: '+entry.data_file+'. Review it before importing.');
        manifest.teams.push(entry);
        dataById.set(id,{schema_version:1,team:{id,name},players:[],games:[],plate_appearances:[],baserunning_events:[],baserunning_entries:[]});
      }
      const data=dataById.get(entry.id);
      const other=[...capture.halves].find(([h])=>h!==half)?.[1];
      const opponentEntry=other && manifest.teams.find(t=>options.aliases?.[other]?t.id===options.aliases[other]:key(t.name)===key(other));
      const opponent=opponentEntry?.name || other || options.opponent || 'Unknown opponent';
      const exact=data.games.filter(game=>game.source_play_by_play && canonical(game.source_play_by_play)===canonical(capture.source));
      if (exact.length) {
        if (exact.length!==1) fail('Multiple existing games share this source; review '+entry.name+'.');
        const game=exact[0];
        for (const [field,value] of [['date',capture.date],['start_time',capture.time],['timezone',capture.timezone],['source_event_id',capture.eventId]]) if (value!=null && game[field]!=null && game[field]!==value) fail('Same plays have conflicting '+field+' for '+entry.name+'. Use the data-update prompt for corrections.');
        if (game.batting_half && game.batting_half!==half) fail('Same plays have conflicting batting halves for '+entry.name+'.');
        if (other && key(game.opponent)!==key(opponent)) fail('Same plays have conflicting opponents for '+entry.name+'.');
        visited.push({data,game,entry});
        report.push({file:input.name,team:entry.name,team_id:entry.id,status:'duplicate',game_id:game.id,warnings:['Identical plays already present; no records or metadata changed.',...(input.captureWarnings||[])]}); continue;
      }
      const overlap=data.games.find(game=>{
        if (capture.eventId && game.source_event_id) return capture.eventId===game.source_event_id;
        // Identical partial appearance text can reveal overlap even when dates/opponents are missing.
        // Do not use individual PA text to deduplicate: separate identical PAs remain separate.
        if (game.source_play_by_play && (!capture.date || !game.date) && (canonical(game.source_play_by_play).includes(canonical(capture.source)) || canonical(capture.source).includes(canonical(game.source_play_by_play)))) return true;
        if (key(game.opponent)!==key(opponent)) return false;
        return (!capture.date || !game.date || capture.date===game.date) && (!capture.time || !game.start_time || capture.time===game.start_time);
      });
      if (overlap) fail('Possible overlap/correction for '+entry.name+' ('+overlap.id+'). Different/partial plays must be merged with TEAM-DATA-PROMPT.md, not appended as a new game. Supply distinct date/time or event IDs for rematches.');
      const identity=capture.eventId || [capture.date,capture.time,opponent,capture.sourceHash].join('|');
      const gameId=[capture.date||'undated',capture.time?.replace(':','')||'unknown-time',entry.id,'vs',slug(opponent),hash(identity).slice(0,10)].join('-');
      if (data.games.some(g=>g.id===gameId)) fail('Generated game ID collision.');
      const built=buildTeam(capture,name,data,gameId,opponent,D);
      visited.push({data,game:data.games.find(g=>g.id===gameId),entry});
      built.warnings.push(...(input.captureWarnings||[]));
      if (!other) built.warnings.unshift('Only one batting side supplied; no opponent roster/history created.');
      if (!capture.date) built.warnings.unshift('Game date unknown; no year inferred.');
      if (!capture.time) built.warnings.unshift('Start time unknown.');
      report.push({file:input.name,team:entry.name,team_id:entry.id,status:'added',game_id:gameId,data_file:entry.data_file,...built}); touched.add(entry.id);
    }
    if (!selected) fail('Requested team not found in supplied inning headings: '+capture.onlyTeam);
  }
  const uniqueBoxes=new Map();
  for(const box of boxes){const prior=uniqueBoxes.get(box.box.source_event_id);if(prior&&prior.sha256!==box.sha256)fail('Conflicting box-score captures for event '+box.box.source_event_id+'. Review the versions.');uniqueBoxes.set(box.box.source_event_id,box);}
  for(const box of uniqueBoxes.values()){
    const matching=visited.filter(v=>v.game.source_event_id===box.box.source_event_id);
    if(!matching.length){if(!options.preflight&&inputs.length)fail('Box score does not match a supplied plays capture: '+box.file);continue;}
    for(const {data,game,entry}of matching){
      const evidence=B.reconcile(data,game,box,D);
      if(game.box_score&&game.box_score.source_sha256!==box.sha256)fail('A different box score is already attached for '+entry.name+'. Review corrections before replacing it.');
      const changed=!game.box_score;
      if(changed){game.box_score=evidence;touched.add(entry.id);}
      report.push({file:box.file,team:entry.name,team_id:entry.id,status:changed?'box-score-attached':'box-score-duplicate',game_id:game.id,warnings:[...evidence.notes,...evidence.comparisons.filter(c=>c.status==='conflict').map(c=>c.player+' '+c.stat+': plays '+c.plays+', box score '+c.box_score+'. Review needed; plays unchanged.'),'Box-score status: '+evidence.status+'. No play result or pitch sequence was overwritten.']});
    }
  }
  D.validateManifest(manifest);
  const changes=new Map();
  for (const id of touched) {
    const entry=manifest.teams.find(t=>t.id===id); D.validateData(dataById.get(id)); changes.set(entry.data_file,Buffer.from(json(dataById.get(id))));
  }
  if (json(manifest)!==json(JSON.parse(initial.get('teams.json')))) changes.set('teams.json',Buffer.from(json(manifest)));
  return {root,initial,changes,report,inputs:inputs.concat(options.boxInputs||[],options.bundleInputs||[]),state};
}

function writePlan(plan) {
  if(plan.preflightOnly)fail('Diagnostic plans cannot be written. Run the normal import command to create a fresh validated plan.');
  const lock=inside(plan.root,'.import-plays.lock');
  let handle;
  try { handle=fs.openSync(lock,'wx'); }
  catch (error) { if (error.code==='EEXIST') fail('Another import is running, or .import-plays.lock remains from an interrupted import. Check it before removing the lock.'); throw error; }
  try { fs.writeFileSync(handle,String(process.pid)+'\n'); return writeUnlocked(plan); }
  finally { fs.closeSync(handle); fs.unlinkSync(lock); }
}
function writeUnlocked(plan) {
  if (!plan.changes.size) return null;
  const {root,initial,changes}=plan;
  // Check for edits since planning and write all candidates before replacing any live files.
  for (const [relative,bytes] of initial) if (!fs.readFileSync(inside(root,relative)).equals(bytes)) fail('Project file changed during import: '+relative+'. Run again.');
  const stamp=new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(3).toString('hex');
  const backup=inside(root,'work/import-backups/'+stamp);
  fs.mkdirSync(backup,{recursive:true});
  const staged=new Map(), completed=[];
  try {
    const sources=path.join(backup,'sources'); fs.mkdirSync(sources);
    for (const [i,input] of plan.inputs.entries()) {
      const filename=String(i+1).padStart(3,'0')+'-'+(slug(path.basename(input.name))||'capture')+'.txt';
      fs.writeFileSync(path.join(sources,filename),input.raw,{flag:'wx'});
    }
    for (const [relative,bytes] of changes) {
      const destination=inside(root,relative), previous=initial.get(relative);
      if (!previous && fs.existsSync(destination)) fail('New output file appeared during import: '+relative);
      if (previous) { const target=path.join(backup,'before',relative); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target,previous,{flag:'wx'}); }
      const candidate=path.join(backup,'after',relative); fs.mkdirSync(path.dirname(candidate),{recursive:true}); fs.writeFileSync(candidate,bytes,{flag:'wx'});
      fs.mkdirSync(path.dirname(destination),{recursive:true});
      const temp=destination+'.import-'+stamp; staged.set(relative,temp); fs.writeFileSync(temp,bytes,{flag:'wx'});
    }
    fs.writeFileSync(path.join(backup,'report.json'),json({created_at:new Date().toISOString(),files:[...changes.keys()].map(file=>({file,existed:initial.has(file)})),imports:plan.report}));
    // Team histories first, manifest last. Roll back completed replacements on ordinary I/O errors.
    for (const [relative,temp] of staged) { fs.renameSync(temp,inside(root,relative)); completed.push(relative); }
  } catch (error) {
    const rollbackErrors=[];
    for (const relative of completed.reverse()) try {
      const destination=inside(root,relative);
      if (initial.has(relative)) fs.writeFileSync(destination,initial.get(relative)); else fs.unlinkSync(destination);
    } catch (restoreError) { rollbackErrors.push(relative+': '+restoreError.message); }
    fail(error.message+'; backup: '+backup+(rollbackErrors.length?'; rollback needs attention: '+rollbackErrors.join('; '):'; original data restored.'));
  } finally { for (const temp of staged.values()) if (fs.existsSync(temp)) fs.unlinkSync(temp); }
  return backup;
}

function parseArgs(args) {
  const options={aliases:{}}, files=[];
  const names={'--date':'date','--time':'time','--timezone':'timezone','--opponent':'opponent','--source':'source','--event-id':'eventId','--team':'team','--order':'order','--report':'report','--box-score':'boxScore'};
  for (let i=0;i<args.length;i++) {
    const arg=args[i];
    if (arg==='--write') options.write=true;
    else if (arg==='--preflight') options.preflight=true;
    else if (arg==='--help'||arg==='-h') options.help=true;
    else if (names[arg]||arg==='--team-alias') {
      const value=args[++i]; if (!value || value.startsWith('--')) fail('Missing value for '+arg);
      if (arg==='--team-alias') { const split=value.lastIndexOf('='); if (split<1 || split===value.length-1) fail('--team-alias must be "Captured Name=existing-team-id".'); options.aliases[value.slice(0,split)]=value.slice(split+1); }
      else if(arg==='--box-score')(options.boxScoreFiles??=[]).push(value);
      else options[names[arg]]=value;
    } else if (arg==='--') { files.push(...args.slice(i+1)); break; }
    else if (arg.startsWith('-')) fail('Unknown option: '+arg);
    else files.push(arg);
  }
  return {options,files};
}
const HELP=`Diamond-Scout local plays → JSON converter (Node.js 18+, no packages)

  node tools/import-plays.cjs /path/to/gamechanger-game.json
  node tools/import-plays.cjs /path/to/gamechanger-plays.txt
  node tools/import-plays.cjs /path/to/gamechanger-plays.txt --write
  node tools/import-plays.cjs /path/to/gamechanger-plays-*.txt --write
  node tools/import-plays.cjs --preflight /path/to/captures-folder
  node tools/import-plays.cjs --preflight /path/to/captures-folder --report work/preflight/latest.md

Preview is the default and changes no files. --write saves both teams, updates
teams.json for new teams, and creates work/import-backups/<timestamp>/.
All inputs are validated before any team file is written. Unknown descriptions
stop the import. Reimports skip identical games; overlapping games require review.

--preflight scans every file/team and collects independent errors together.
It accepts TXT paths or folders of TXT files (no subfolder recursion). It never
imports data. Optional --report saves .json or .md diagnostics; reports inside
this project belong under work/preflight/. Exit 1 means an error needs attention;
exit 0 means ready/duplicate, with any source notes still requiring review.

Optional box-score evidence (repeat for multiple games):
  --box-score /path/gamechanger-boxscore.json
Matches game event IDs, checks batting totals, and reports scoring differences.
Plays are never silently rewritten. Works with --preflight and --write.

Optional metadata overrides (apply to ALL input files):
  --date YYYY-MM-DD        --time HH:MM (or "8:30 AM")
  --timezone ET           --opponent "Team Name" (one-side capture only)
  --source URL            --event-id ID
  --team "Team Name"      Import only this captured team or existing team ID
  --team-alias "Captured Name=existing-team-id"  Reuse a differently named team
  --order oldest-first    Default: newest-first, as in GameChanger Plays

Dates/times are never inferred from the filename or computer clock. Raw captures
can omit metadata; those values stay unknown. Read tools/IMPORT-PLAYS.md for limits.
`;
function main(args = process.argv.slice(2)) {
  const {options,files}=parseArgs(args);
  if (options.help) { process.stdout.write(HELP); return; }
  if (!files.length) fail('Supply one or more Plays TXT or game JSON captures. Use --help for examples.');
  options.boxInputs=(options.boxScoreFiles||[]).map(file=>({name:path.resolve(file),raw:fs.readFileSync(file,'utf8')}));
  if(options.preflight)return require('./preflight-plays.cjs').runCLI(ROOT,files,options);
  if(options.report)fail('--report is available with --preflight only.');
  const inputs=files.map(file=>({name:path.resolve(file),raw:fs.readFileSync(file,'utf8')}));
  const plan=planImports(ROOT,inputs,options);
  const backup=options.write?writePlan(plan):null;
  for (const item of plan.report) {
    console.log('\n'+item.status.toUpperCase()+': '+item.team+' — '+path.basename(item.file));
    if (item.counts) console.log(JSON.stringify(item.counts,null,2));
    for (const warning of item.warnings) console.log('  Note: '+warning);
  }
  console.log('\n'+(options.write?'Saved':'Preview')+': '+plan.changes.size+' changed files'+(plan.changes.size?' ('+[...plan.changes.keys()].join(', ')+')':'.'));
  if (backup) console.log('Backup and report: '+backup+'\nRefresh Diamond-Scout to read the updated repository JSON.');
  else if (!options.write && plan.changes.size) console.log('Run the same command with --write to save this import.');
}
module.exports={expandInputs,readCapture,parseBlock,parsePitches,buildTeam,planImports,writePlan,loadCore,parseArgs};
if (require.main===module) try { main(); } catch (error) { console.error('\nImport stopped: '+error.message+'\nNo planned imports were saved (write errors include rollback status above).'); process.exitCode=1; }
