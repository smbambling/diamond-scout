'use strict';
// Sidecar evidence and reconciliation only. Never rewrites play results or pitch sequences.
const crypto=require('node:crypto');
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
const norm=s=>String(s).normalize('NFC').replace(/[\u00a0\u202f]/g,' ').replace(/[’‘]/g,"'").replace(/\s+/g,' ').replace(/\)\s*(?=\d{1,2}u\b)/gi,') ').trim().toLowerCase();
const playerName=s=>String(s).replace(/\s*#\S+(?:\s*\([^)]*\))?\s*$/,'').replace(/\s*\([^)]*\)\s*$/,'').trim();
function read(input){
 let box;try{box=JSON.parse(input.raw);}catch{throw Error('Invalid box-score JSON: '+input.name);}
 if(box.schema_version!==1||box.kind!=='diamond-scout-box-score'||!Array.isArray(box.teams)||!box.teams.length)throw Error('Unsupported box-score capture: '+input.name);
 const url=new URL(box.source_url);if(url.protocol!=='https:'||!(url.hostname==='gc.com'||url.hostname.endsWith('.gc.com')))throw Error('Invalid box-score source URL.');
 const event=url.pathname.match(/\/schedule\/([^/]+)/)?.[1];if(!event||box.source_event_id!==event)throw Error('Box-score URL and event ID must match.');
 if(url.search||url.hash||url.username||url.password)throw Error('Box-score URL must not contain credentials, queries or fragments.');
 if(box.date!=null&&(!/^\d{4}-\d{2}-\d{2}$/.test(box.date)||!Number.isFinite(Date.parse(box.date))||new Date(box.date).toISOString().slice(0,10)!==box.date))throw Error('Invalid box-score game date.');
 if(box.start_time!=null&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(box.start_time))throw Error('Invalid box-score start time.');
 if(box.timezone!=null&&(typeof box.timezone!=='string'||box.timezone.length>80||/[\r\n\u0000]/.test(box.timezone)))throw Error('Invalid box-score timezone.');
 const names=new Set();
 for(const team of box.teams){
  if(typeof team.name!=='string'||!team.name.trim()||team.name.includes('@')||names.has(norm(team.name))||!Array.isArray(team.notes)||!team.notes.every(s=>typeof s==='string')||!Array.isArray(team.tables))throw Error('Invalid or repeated box-score team.');names.add(norm(team.name));
  for(const table of team.tables){
   if(!['batting','pitching'].includes(table.kind)||!Array.isArray(table.columns)||!table.columns.every(s=>typeof s==='string')||!Array.isArray(table.rows))throw Error('Invalid box-score table.');
   if(table.rows.some(row=>!Array.isArray(row)||row.length!==table.columns.length||!row.every(s=>typeof s==='string')))throw Error('Incomplete/misaligned box-score rows for '+team.name+'. Recapture or review the table.');
   if(new Set(table.columns.map(norm)).size!==table.columns.length)throw Error('Repeated box-score columns.');
  }
 }
 return {box,raw:input.raw,sha256:digest(input.raw),file:input.name};
}
function reconcile(data,game,capture,D){
 const box=capture.box,team=box.teams.find(t=>norm(t.name)===norm(data.team.name));if(!team)throw Error('No box-score team matches '+data.team.name+'.');
 for(const [key,field]of [['date','date'],['start_time','start_time'],['timezone','timezone']])if(box[key]!=null&&game[field]!=null&&box[key]!==game[field])throw Error('Box score has conflicting '+key+' for '+data.team.name+'.');
 const pas=data.plate_appearances.filter(p=>p.game_id===game.id),events=(data.baserunning_events||[]).filter(e=>e.game_id===game.id),comparisons=[],notes=Array.isArray(box.warnings)?box.warnings.filter(w=>typeof w==='string'):[];
 const stat=(selected,attempts,code)=>{
  const b=D.battingSummary(selected);
  const known={AB:b.unclassified?null:b.ab,H:b.hits,BB:b.walks,SO:b.strikeouts,HBP:b.hbp,TB:selected.reduce((n,p)=>n+({single:1,double:2,triple:3,home_run:4}[p.result]||0),0),SB:attempts.filter(e=>e.result==='stolen_base').length,CS:attempts.filter(e=>e.result==='caught_stealing').length};
  if(['2B','3B','HR','SF','SH'].includes(code))return selected.filter(p=>p.result===({'2B':'double','3B':'triple',HR:'home_run',SF:'sacrifice_fly',SH:'sacrifice_bunt'}[code])).length;
  return Object.hasOwn(known,code)?known[code]:null;
 };
 const compare=(who,code,expected,actual)=>{comparisons.push({player:who,stat:code,box_score:expected,plays:actual,status:actual===null?'unavailable':actual===expected?'match':'conflict'});};
 const player=id=>data.players.find(p=>p.id===id);
 const findPlayer=name=>{const found=data.players.filter(p=>norm(p.name)===norm(playerName(name)));return found.length===1?found[0]:null;};
 const tables=team.tables.filter(t=>t.kind==='batting');if(tables.length>1)throw Error('Multiple batting tables for '+team.name+'; review duplicate sections.');
 if(!tables.length)notes.push('Batting table not captured; validation is limited to explicit note entries. Absence of a note is not a recorded zero.');
 for(const table of tables){
  const nameIndex=table.columns.findIndex(c=>!['AB','R','H','RBI','BB','SO','HBP','SF','SH','TB','SB','CS'].includes(c.toUpperCase()));if(nameIndex<0)throw Error('Box-score player-name column is missing.');
  const seen=new Set();
  for(const row of table.rows){const name=row[nameIndex];if(!name.trim())throw Error('Box-score player name is missing.');const total=/^(?:team|totals?)$/i.test(name.trim());const p=total?null:findPlayer(name);
   if(!total&&!p){notes.push('Unmatched box-score player: '+playerName(name)+'. No identity inferred.');continue;}
   const who=total?'TEAM':p.name;if(seen.has(who))throw Error('Repeated batting row: '+who);seen.add(who);
   for(let i=0;i<row.length;i++){if(i===nameIndex)continue;const code=table.columns[i].toUpperCase();if(['R','RBI'].includes(code))continue;if(!/^\d+$/.test(row[i]))throw Error('Missing/invalid '+code+' in batting row '+who+'.');
    compare(who,code,Number(row[i]),stat(total?pas:pas.filter(a=>a.batter_id===p.id),total?events:events.filter(e=>e.runner_id===p.id),code));
   }
  }
 }
 for(const line of team.notes){const match=line.match(/^(2B|3B|HR|TB|SB|CS|HBP|SF|SH):\s*(.+)$/);if(!match)continue;
  for(const item of match[2].split(/,(?!\s*(?:Jr\.|Sr\.|II|III|IV)(?=\s|$))\s*/i)){
   const entry=item.trim().match(/^(.+?)(?:\s+(\d+))?$/);const p=findPlayer(entry[1]);if(!p){notes.push('Unmatched box-score note player: '+entry[1]+'.');continue;}
   const number=Number(entry[2]||1);compare(p.name,match[1],number,stat(pas.filter(a=>a.batter_id===p.id),events.filter(e=>e.runner_id===p.id),match[1]));
  }
 }
 const conflicts=comparisons.filter(c=>c.status==='conflict'),unavailable=comparisons.filter(c=>c.status==='unavailable');
 return {source_url:box.source_url,source_event_id:box.source_event_id,source_sha256:capture.sha256,coverage:box.coverage||'Completeness unverified',source_capture:box,source_json:capture.raw,comparisons,notes,status:conflicts.length?'review':unavailable.length||notes.length?'partial':'matched',conflict_count:conflicts.length,unavailable_count:unavailable.length};
}
module.exports={read,reconcile};
