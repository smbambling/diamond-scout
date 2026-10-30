'use strict';
// Derived evidence only; never changes batting history or original captures.
const key=s=>String(s).normalize('NFC').replace(/[’‘]/g,"'").replace(/\)\s*(?=\d{1,2}u\b)/gi,') ').replace(/\s+/g,' ').trim().toLowerCase();
const clean=s=>s.replace(/\s*#\d+(?:\s*\([^)]*\))?\s*$/,'').replace(/\s*\([WLS][^)]*\)\s*$/,'').trim();
function derive(data,game,I,D){
 const team=game.box_score?.source_capture?.teams?.find(t=>key(t.name)===key(data.team.name));
 if(!team)return null;
 const tables=team.tables.filter(t=>t.kind==='pitching');
 if(tables.length!==1)return null;
 const table=tables[0],number=s=>/^\d+$/.test(s)?Number(s):null;
 if(table.columns[0]!=='PITCHING')return null;
 const pitchers=table.rows.filter(r=>! /^(team|totals?)$/i.test(r[0].trim())).map(row=>{
  const stats=Object.fromEntries(table.columns.slice(1).map((c,i)=>[c,c==='IP'?row[i+1]:number(row[i+1])]));
  const name=clean(row[0]), jersey=row[0].match(/#(\d+)/)?.[1]||null;
  const find=prefix=>team.notes.filter(n=>n.startsWith(prefix)).flatMap(n=>n.slice(prefix.length).trim().split(/,\s*/)).find(s=>key(s.replace(/\s+\d+(?:-\d+)?$/,''))===key(name));
  const bf=find('Batters Faced:')?.match(/\s(\d+)$/),ps=find('Pitches-Strikes:')?.match(/\s(\d+)-(\d+)$/);
  return {name,jersey,stats,bf:bf?+bf[1]:null,pitches:ps?+ps[1]:null,strikes:ps?+ps[2]:null,sample:null};
 });
 if(new Set(pitchers.map(p=>key(p.name))).size!==pitchers.length)return null;
 const result={version:1,pitchers,status:'summary-only',reason:'Pitch sequences unavailable until the full opposing batting log reconciles with pitching totals.'};
 if(!pitchers.length||pitchers.length>8||pitchers.some(p=>p.bf===null||p.bf<1||p.pitches===null))return result;
 try{
  const capture=I.readCapture('PLAY-BY-PLAY\n'+game.source_play_by_play),other=[...capture.halves.values()].filter(n=>key(n)!==key(data.team.name));
  if(other.length!==1)return result;
  const opponent={schema_version:1,team:{id:'pitching-evidence',name:other[0]},players:[],games:[],plate_appearances:[],baserunning_events:[],baserunning_entries:[]};
  I.buildTeam(capture,other[0],opponent,'pitching-evidence',data.team.name,D);
  const pas=opponent.plate_appearances.filter(p=>p.status==='complete');
  if(pas.length!==pitchers.reduce((n,p)=>n+p.bf,0)||opponent.runner_outs?.some(o=>o.pitches?.length))return result;
  const solutions=[];
  function search(offset,remaining,stints){
   if(solutions.length>1)return;
   if(!remaining.length){if(offset===pas.length)solutions.push(stints);return;}
   for(const i of remaining){const p=pitchers[i],slice=pas.slice(offset,offset+p.bf),b=D.battingSummary(slice);
    if(slice.length!==p.bf||slice.some(a=>!a.pitches.length||a.pitcher?.name&&key(a.pitcher.name)!==key(p.name)))continue;
    if(slice.reduce((n,a)=>n+a.pitches.length,0)!==p.pitches)continue;
    if([['H',b.hits],['BB',b.walks],['SO',b.strikeouts]].some(([c,n])=>p.stats[c]!==null&&p.stats[c]!==n))continue;
    search(offset+p.bf,remaining.filter(j=>j!==i),[...stints,{i,pas:slice}]);
   }
  }
  search(0,pitchers.map((_,i)=>i),[]);
  if(solutions.length!==1){result.reason=solutions.length?'Pitcher stint boundaries are ambiguous.':'Pitching totals and recorded opposing plays do not fully reconcile.';return result;}
  for(const stint of solutions[0]){
   const pas=stint.pas,b=D.battingSummary(pas),strike=new Set(['called_strike','swinging_strike','foul','foul_tip','foul_out','in_play']);
   const first=pas.map(a=>a.pitches[0]).filter(p=>p?.count_before?.balls===0&&p.count_before.strikes===0&&p.outcome!=='unknown');
   const known=pas.flatMap(a=>a.pitches).filter(p=>['ball','hit_by_pitch',...strike].includes(p.outcome)),fair=pas.filter(a=>a.batted_ball);
   const strikeouts={looking:0,swinging:0,unknown:0};
   for(const pa of pas){
    if(pa.result==='strikeout_looking')strikeouts.looking++;
    else if(['strikeout_swinging','strikeout_foul_tip'].includes(pa.result))strikeouts.swinging++;
    else if(pa.result==='dropped_third_strike'){
     const terminal=pa.pitches.at(-1)?.outcome;
     strikeouts[terminal==='called_strike'?'looking':['swinging_strike','foul_tip'].includes(terminal)?'swinging':'unknown']++;
    }
   }
   pitchers[stint.i].sample={outcomes:D.pitchSummary(pas).outcomes,strikeouts,bf:pas.length,first:first.length,first_strikes:first.filter(p=>strike.has(p.outcome)).length,known:known.length,whiffs:known.filter(p=>p.outcome==='swinging_strike').length,contacts:fair.length,ground:fair.filter(a=>a.batted_ball.contact_type==='ground_ball').length,hits:b.hits,ab:b.ab,unclassified:b.unclassified,first_sequence:pas[0].sequence,last_sequence:pas.at(-1).sequence};
  }
  result.status='reconciled';result.reason='Unique contiguous stints match batters faced, pitch totals, hits, walks, strikeouts and explicit pitcher names. Mid-appearance changes cannot be resolved automatically.';
 }catch(error){result.reason='Opposing play log requires review: '+error.message;}
 return result;
}
module.exports={derive};
