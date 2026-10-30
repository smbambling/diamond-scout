'use strict';

// Diagnostics only. This module never calls the import writer.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const I=require('./import-plays.cjs');
const norm=s=>s.normalize('NFC').replace(/[\u00a0\u202f]/g,' ').replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/\s+/g,' ').trim().toLowerCase();
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const safe=s=>String(s).replace(/[\x00-\x08\x0b-\x1f\x7f]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));

function collectInputs(paths){
  const inputs=[],seen=new Set(),folders=new Set();
  function read(file){
    const name=path.resolve(file);if(seen.has(name))return;seen.add(name);
    try{inputs.push({name,raw:fs.readFileSync(name,'utf8')});}catch(error){inputs.push({name,error:error.message});}
  }
  for(const supplied of paths){
    const name=path.resolve(supplied);
    try{
      if(fs.statSync(name).isDirectory()){
        if(folders.has(name))continue;folders.add(name);
        const files=fs.readdirSync(name,{withFileTypes:true}).filter(entry=>entry.isFile()&&!entry.name.startsWith('.')&&(/\.txt$/i.test(entry.name)||/^gamechanger-(game|boxscore)-.*\.json$/i.test(entry.name))).map(entry=>entry.name).sort();
        if(!files.length)inputs.push({name,error:'Folder contains no regular Plays TXT or gamechanger-game/boxscore JSON captures. Subfolders are not scanned.'});
        for(const file of files)read(path.join(name,file));
      }else read(name);
    }catch(error){if(!seen.has(name)){seen.add(name);inputs.push({name,error:error.message});}}
  }
  return inputs;
}

function inspectBatch(root,inputs,options={}){
  const normalized=[],extraBoxes=[],extraBundles=[];
  for(const input of inputs){try{const expanded=I.expandInputs([input]);normalized.push(...expanded.inputs);extraBoxes.push(...expanded.options.boxInputs);extraBundles.push(...expanded.options.bundleInputs);}catch(error){normalized.push({...input,error:error.message});}}
  inputs=normalized;options={...options,boxInputs:[...(options.boxInputs||[]),...extraBoxes],bundleInputs:[...(options.bundleInputs||[]),...extraBundles]};
  const projectIssues=[],files=[];let state;
  try{state=I.planImports(root,[],options).state;}catch(error){projectIssues.push({severity:'error',code:'project_error',message:error.message});}
  for(const input of inputs){
    const file={file:input.name,status:'blocked',checked_teams:[],unchecked_teams:[],metadata:null,teams:[],issues:[]};files.push(file);
    const lines=typeof input.raw==='string'?input.raw.replace(/^\uFEFF/,'').split(/\r?\n/):[];
    const add=(issue,details={})=>{
      const entry={severity:'error',...details,...issue};
      if(!Number.isInteger(entry.line))entry.line=null;
      const record=entry.record;delete entry.record;
      entry.context=record?record.map(row=>({line:row.line,text:row.raw})):entry.line?lines.slice(Math.max(0,entry.line-2),Math.min(lines.length,entry.line+1)).map((text,index)=>({line:Math.max(1,entry.line-1)+index,text})):[];
      if(!file.issues.some(old=>old.severity===entry.severity&&old.line===entry.line&&old.team===entry.team&&old.message===entry.message))file.issues.push(entry);
    };
    if(input.error||typeof input.raw!=='string'){add({code:'input_error',message:input.error||'Input text is unavailable.'});continue;}
    file.input_sha256=sha(input.raw);
    const captureIssues=[];let capture;
    try{capture=I.readCapture(input.raw,options,captureIssues);}catch(error){captureIssues.push({code:'capture_error',message:error.message,line:error.line});}
    for(const issue of captureIssues)add(issue);
    if(!capture)continue;
    file.metadata={date:capture.date,start_time:capture.time,timezone:capture.timezone,source_url:capture.url,source_event_id:capture.eventId,coverage:capture.coverage};
    file.source_sha256=capture.sourceHash;
    const targets=[...capture.halves.values()].filter(name=>{
      if(!capture.onlyTeam)return true;
      const existing=state?.manifest.teams.find(team=>options.aliases?.[name]?team.id===options.aliases[name]:norm(team.name)===norm(name));
      return [name,existing?.name,existing?.id,options.aliases?.[name]].filter(Boolean).some(value=>norm(value)===norm(capture.onlyTeam));
    });
    file.checked_teams=targets;
    file.unchecked_teams=[...capture.halves.values()].filter(name=>!targets.includes(name));
    if(!targets.length)add({code:'team_selection',message:'Requested team not found or could not be resolved: '+capture.onlyTeam});
    for(const block of capture.blocks){
      if(capture.onlyTeam&&!targets.some(name=>norm(name)===norm(block.team)))continue;
      const recordIssues=[];let records=[];
      try{records=I.parseBlock(block,recordIssues);}catch(error){recordIssues.push({code:'record_error',message:error.message,line:error.line||block.line});}
      for(const issue of recordIssues)add(issue,{team:block.team,inning:block.inning,half:block.half});
      for(const record of records)for(const message of record.warnings)add({severity:'warning',code:'source_notice',line:record.lines[0].line,message},{team:block.team,inning:block.inning,half:block.half,record:record.lines});
    }
    // Each team is planned against a private copy. A blocked file never enters later batch state.
    let candidate=state;
    for(const team of targets){
      if(!candidate||file.issues.some(issue=>issue.severity==='error'&&(!issue.team||norm(issue.team)===norm(team))))continue;
      try{
        const plan=I.planImports(root,[input],{...options,team},candidate);
        candidate=plan.state;
        const result=plan.report[0];
        file.teams.push({team:result.team,team_id:result.team_id,status:result.status==='added'||plan.report.some(r=>r.status==='box-score-attached')?'ready':'duplicate',game_id:result.game_id,data_file:result.data_file,counts:result.counts||null});
        for(const warning of plan.report.flatMap(r=>r.status==='duplicate'?[]:r.warnings||[])){
          const match=warning.match(/^Line (\d+): (.*)$/),message=match?match[2]:warning;
          add({severity:'warning',code:'plan_notice',line:match?Number(match[1]):null,message},{team});
        }
      }catch(error){add({code:'planning_error',line:error.line,message:error.message},{team});}
    }
    if(!projectIssues.length&&!file.issues.some(issue=>issue.severity==='error')){
      state=candidate;
      file.status=file.teams.length&&file.teams.every(team=>team.status==='duplicate')?'duplicate':'ready';
    }
  }
  for(const input of options.boxInputs||[]){try{const box=require('./box-score.cjs').read(input);if(!files.some(f=>f.metadata?.source_event_id===box.box.source_event_id))projectIssues.push({severity:'error',code:'unmatched_box_score',message:'Box score does not match a supplied plays capture: '+input.name});}catch(error){projectIssues.push({severity:'error',code:'invalid_box_score',message:error.message});}}
  for(const file of files){
    file.issues.sort((a,b)=>(a.severity==='error'?0:1)-(b.severity==='error'?0:1)||(a.line??Infinity)-(b.line??Infinity)||a.message.localeCompare(b.message));
    file.errors=file.issues.filter(issue=>issue.severity==='error').length;file.warnings=file.issues.length-file.errors;
  }
  const errors=projectIssues.length+files.reduce((n,file)=>n+file.errors,0),warnings=files.reduce((n,file)=>n+file.warnings,0);
  return {report_type:'diamond-scout-preflight',schema_version:1,generated_at:new Date().toISOString(),ready_for_import:inputs.length>0&&errors===0,source_completeness:'Not verified; preflight validates only supplied text and repository compatibility.',summary:{files:files.length,ready:files.filter(file=>file.status==='ready').length,duplicates:files.filter(file=>file.status==='duplicate').length,blocked:files.filter(file=>file.status==='blocked').length,errors,warnings},project_issues:projectIssues,files};
}

function renderText(report){
  const s=report.summary,output=['Diamond-Scout batch preflight',s.files+' file(s): '+s.ready+' ready, '+s.duplicates+' duplicate, '+s.blocked+' blocked; '+s.errors+' error(s), '+s.warnings+' note(s).'];
  for(const issue of report.project_issues)output.push('\nPROJECT ERROR: '+safe(issue.message));
  for(const file of report.files){
    output.push('\n'+file.status.toUpperCase()+': '+safe(file.file));
    if(file.metadata)output.push('  Capture metadata: '+(file.metadata.date||'unknown date')+' '+(file.metadata.start_time||'unknown time')+' '+(file.metadata.timezone||'unknown timezone'));
    if(file.unchecked_teams.length)output.push('  Outside requested scope: '+safe(file.unchecked_teams.join(', ')));
    for(const team of file.teams){
      let text='  '+team.status.toUpperCase()+': '+safe(team.team);
      if(team.counts){const n=team.counts;text+=' — '+n.complete+' complete + '+n.incomplete+' incomplete PAs; '+n.pitches+' pitches; '+n.fair_contacts+' fair contacts; '+n.foul_catches+' foul catches; '+n.hits+' hits; '+n.steal_attempts+' attempts';}
      output.push(text);
    }
    for(const issue of file.issues){
      output.push('  '+(issue.severity==='error'?'ERROR':'NOTE')+(issue.line?' line '+issue.line:'')+(issue.option?' '+issue.option:'')+(issue.team?' ['+safe(issue.team)+(issue.half?' · '+issue.half+' '+issue.inning:'')+']':'')+': '+safe(issue.message));
      for(const row of issue.context)output.push('    '+row.line+': '+safe(row.text));
    }
  }
  output.push('\n'+(report.ready_for_import?(s.ready?'Preflight passed. Review notes, then use the normal import command with --write.':'Preflight passed. All selected games are duplicates; no import is needed. Review source notes as appropriate.'):'Batch blocked. Review the listed source cases together, then rerun preflight.'));
  output.push('No team JSON, manifest, backups or app files were changed. Capture completeness is not verified.');
  return output.join('\n')+'\n';
}
function renderMarkdown(report){
  const text=renderText(report),runs=text.match(/`+/g)||[],fence='`'.repeat(Math.max(3,...runs.map(run=>run.length+1)));
  return '# Diamond-Scout batch preflight\n\nGenerated: '+report.generated_at+'\n\n'+fence+'text\n'+text+fence+'\n';
}

function writeReport(root,destination,report,inputs){
  const output=path.resolve(destination),extension=path.extname(output).toLowerCase();
  if(!['.json','.md'].includes(extension))throw Error('--report must end in .json or .md.');
  const real=file=>{let current=path.resolve(file),tail=[];while(!fs.existsSync(current)){const parent=path.dirname(current);if(parent===current)break;tail.unshift(path.basename(current));current=parent;}return path.join(fs.realpathSync(current),...tail);};
  const relative=path.relative(real(root),real(output));
  if(!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative)&&!relative.startsWith('work'+path.sep+'preflight'+path.sep))throw Error('Reports inside this project must be under work/preflight/ to protect source and runtime files.');
  if(inputs.some(input=>real(input.name)===real(output)))throw Error('Report path is an input capture; refusing to overwrite it.');
  if(fs.lstatSync(output,{throwIfNoEntry:false})?.isSymbolicLink())throw Error('Report path is a symlink; choose a direct path.');
  if(fs.existsSync(output)){
    const previous=fs.readFileSync(output,'utf8');let ours=false;
    if(extension==='.json'){try{ours=JSON.parse(previous).report_type==='diamond-scout-preflight';}catch{}}
    else ours=previous.startsWith('# Diamond-Scout batch preflight\n');
    if(!ours)throw Error('Report destination contains a different file; choose a new report path.');
  }
  fs.mkdirSync(path.dirname(output),{recursive:true});
  const temporary=output+'.tmp-'+crypto.randomBytes(6).toString('hex');
  try{fs.writeFileSync(temporary,extension==='.json'?JSON.stringify(report,null,2)+'\n':renderMarkdown(report),{flag:'wx'});fs.renameSync(temporary,output);}
  finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
  return output;
}

function runCLI(root,paths,options={}){
  if(options.write)throw Error('--preflight cannot be combined with --write. Preflight never imports data.');
  const inputs=collectInputs(paths),report=inspectBatch(root,inputs,options);
  process.stdout.write(renderText(report));
  if(options.report)console.log('Report saved: '+writeReport(root,options.report,report,inputs));
  if(!report.ready_for_import)process.exitCode=1;
  return report;
}
module.exports={collectInputs,inspectBatch,renderText,renderMarkdown,writeReport,runCLI};
