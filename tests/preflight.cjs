'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),cp=require('node:child_process');
const I=require('../tools/import-plays.cjs'),P=require('../tools/preflight-plays.cjs');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'diamond-preflight-'));
const core=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script id="diamond-scout-core">[\s\S]*?<\/script>/)[0];
const input=(raw,name='capture.txt')=>({name,raw}),hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
let count=0;
function project(){
  const folder=path.join(temp,'project-'+(++count));fs.mkdirSync(path.join(folder,'data'),{recursive:true});fs.writeFileSync(path.join(folder,'index.html'),core);
  fs.writeFileSync(path.join(folder,'teams.json'),JSON.stringify({schema_version:1,teams:[{id:'seed',name:'Existing Team',data_file:'data/seed.json'}]}));
  fs.writeFileSync(path.join(folder,'data/seed.json'),JSON.stringify({schema_version:1,team:{id:'seed',name:'Existing Team'},players:[],games:[],plate_appearances:[]}));return folder;
}
function snapshot(folder){return Object.fromEntries(fs.readdirSync(folder,{recursive:true}).filter(file=>fs.statSync(path.join(folder,file)).isFile()).map(file=>[file,hash(fs.readFileSync(path.join(folder,file)))]));}
function capture(body,date='2026-10-01',time='10:00',directive='both teams (default)'){return 'Import: '+directive+'\nDate: '+date+'\nStart time: '+time+'\nPLAY-BY-PLAY\n'+body;}
const pa='Single\nBall 1, In play.\nAlex Young singles on a line drive to center fielder Chris Smith.';
const one='Top 1st - Falcons 14U\n'+pa;
const two='Bottom 1st - Owls 14U\n'+pa.replace('Alex Young','Pat Day')+'\n'+one;
const run=(args)=>cp.spawnSync(process.execPath,[path.join(root,'tools/import-plays.cjs'),...args],{cwd:temp,encoding:'utf8'});
const runtime=()=>Object.fromEntries(['index.html','teams.json',...fs.readdirSync(path.join(root,'data')).filter(file=>file.endsWith('.json')).map(file=>'data/'+file)].map(file=>[file,hash(fs.readFileSync(path.join(root,file)))]));
const originalRuntime=runtime();
try{
  const folder=project(),before=snapshot(folder);
  const bad=capture(one.replace('Ball 1, In play.','Ball 1, Mystery pitch, Another token, In play.')+'\nWalk\nOther Runner steals second, Ball 1, Ball 2, Ball 3, Ball 4.\nPat Day walks, Chris Smith pitching.');
  const report=P.inspectBatch(folder,[input(bad,'bad.txt'),input(capture(one.replace('Falcons','Hawks')),'good.txt')]);
  assert.equal(report.ready_for_import,false);assert.equal(report.files.length,2);assert.equal(report.files[0].errors,3);assert.equal(report.files[1].status,'ready');
  assert.deepEqual(report.files[0].issues.filter(i=>i.severity==='error').map(i=>i.code).sort(),['unsupported_runner_event','unsupported_token','unsupported_token']);
  assert(report.files[0].issues.some(i=>i.token==='Mystery pitch'));assert(report.files[0].issues.some(i=>i.token==='Another token'));
  const badLine=bad.split('\n').findIndex(line=>line.includes('Mystery pitch'))+1,firstIssue=report.files[0].issues.find(i=>i.token==='Mystery pitch');assert.equal(firstIssue.line,badLine);assert(firstIssue.context.some(row=>row.line===badLine&&row.text.includes('Mystery pitch')));
  assert.deepEqual(snapshot(folder),before,'Preflight never creates JSON, backups, locks or reports by default');
  const diagnosticPlan=I.planImports(folder,[input(capture(one))],{},I.planImports(folder,[]).state);assert.throws(()=>I.writePlan(diagnosticPlan),/Diagnostic plans cannot be written/);assert.deepEqual(snapshot(folder),before);

  // Recover at new record boundaries, including an unfamiliar result heading.
  const unknownHeading=capture(one+'\nObstruction\nMystery pitch, In play.\nPat Day singles on a fly ball to left fielder Chris Smith.\nWalk\nAnother pitch, Ball 1, Ball 2, Ball 3, Ball 4.\nSam Lane walks, Chris Smith pitching.');
  const recovered=P.inspectBatch(folder,[input(unknownHeading)]).files[0];assert(recovered.issues.some(i=>i.code==='unsupported_heading'&&i.token==='Obstruction'));assert(recovered.issues.some(i=>i.token==='Mystery pitch'));assert(recovered.issues.some(i=>i.token==='Another pitch'));
  assert.equal(recovered.status,'blocked');
  const metadata=P.inspectBatch(folder,[input(capture(bad.split('PLAY-BY-PLAY\n')[1],'2026-02-30','28:00'))]).files[0];
  assert(metadata.issues.some(i=>/real YYYY-MM-DD/.test(i.message)));assert(metadata.issues.some(i=>/Start time/.test(i.message)));assert(metadata.issues.some(i=>i.token==='Mystery pitch'),'Metadata errors do not hide independent play errors');
  const badOverride=P.inspectBatch(folder,[input(capture(one))],{date:'not-a-date'}).files[0].issues.find(i=>i.option==='--date');assert(badOverride);assert.equal(badOverride.line,null,'An invalid command-line override must not blame a valid source line');
  const repeated=P.inspectBatch(folder,[input(capture(one+'\n'+one))]).files[0];assert(repeated.issues.some(i=>/Repeated inning/.test(i.message)));

  // Independent teams are checked; a bad file's tentative team changes never poison later files.
  const brokenTwo=capture(two.replace('Alex Young singles','Alex Young teleports'));
  const rollback=P.inspectBatch(folder,[input(brokenTwo,'blocked.txt'),input(capture(two),'fixed.txt')]);assert.equal(rollback.files[0].status,'blocked');assert.equal(rollback.files[1].status,'ready');assert.equal(rollback.files[1].teams.filter(team=>team.status==='ready').length,2);
  const semantic=P.inspectBatch(folder,[input(capture(two))],{aliases:{'Falcons 14U':'missing-falcons','Owls 14U':'missing-owls'}});assert.equal(semantic.files[0].issues.filter(i=>i.code==='planning_error').length,2);
  const selected=P.inspectBatch(folder,[input(capture(two.replace('Alex Young singles','Alex Young teleports'),'2026-10-01','10:00','only Owls 14U'))]);assert.equal(selected.ready_for_import,true);assert.deepEqual(selected.files[0].checked_teams,['Owls 14U']);assert.deepEqual(selected.files[0].unchecked_teams,['Falcons 14U']);
  const aliased=P.inspectBatch(folder,[input(capture(one))],{team:'seed',aliases:{'Falcons 14U':'seed'}});assert.equal(aliased.ready_for_import,true);assert.equal(aliased.files[0].teams[0].team_id,'seed');

  // A single in-memory batch catches duplicates and metadata conflicts across input files.
  const duplicates=P.inspectBatch(folder,[input(capture(two),'first.txt'),input(capture(two),'again.txt'),input(capture(two,'2026-10-02'),'conflict.txt'),input(capture(one.replace('Falcons','Hawks')),'last.txt')]);
  assert.deepEqual(duplicates.files.map(file=>file.status),['ready','duplicate','blocked','ready']);assert.equal(duplicates.files[2].errors,2);assert(duplicates.files[2].issues.every(i=>/conflicting date/.test(i.message)));
  const split=project();I.writePlan(I.planImports(split,[input(capture(two))],{team:'Falcons 14U'}));const splitBefore=snapshot(split);
  const splitReport=P.inspectBatch(split,[input(capture(two))]);assert.equal(splitReport.ready_for_import,true);assert.deepEqual(splitReport.files[0].teams.map(team=>team.status),['ready','duplicate']);assert.deepEqual(snapshot(split),splitBefore);

  // Broken repository state and unreadable captures are reported without hiding text diagnostics.
  const missingProject=project();fs.unlinkSync(path.join(missingProject,'teams.json'));
  const brokenProject=P.inspectBatch(missingProject,[input(bad)]);assert.equal(brokenProject.project_issues.length,1);assert.equal(brokenProject.files[0].errors,3);assert.equal(brokenProject.ready_for_import,false);
  const readError=P.inspectBatch(folder,[{name:'missing.txt',error:'Cannot read this capture'},input(capture(one))]);assert.equal(readError.files[0].errors,1);assert.equal(readError.files[1].status,'ready');
  const crlf=P.inspectBatch(folder,[input(bad.replaceAll(' ','\u00a0').replaceAll('\n','\r\n'))]);assert.equal(crlf.files[0].errors,3);assert.equal(crlf.files[0].issues.find(i=>i.token==='Mystery\u00a0pitch').line,badLine);

  // All archived captures are permanent regression inputs; notes do not imply completeness.
  const sourceInputs=fs.readdirSync(path.join(root,'tests/fixtures/captures')).filter(file=>file.endsWith('.txt')).map(file=>input(fs.readFileSync(path.join(root,'tests/fixtures/captures',file),'utf8'),file));
  const archivedProject=project(),archived=P.inspectBatch(archivedProject,sourceInputs);assert.equal(archived.ready_for_import,true);assert.equal(archived.summary.blocked,0);assert(archived.summary.warnings>0);assert.match(archived.source_completeness,/Not verified/);assert.doesNotThrow(()=>I.planImports(archivedProject,sourceInputs),'A passing preflight must agree with the real import planner');

  // Folder mode is deterministic, nonrecursive, TXT-only, and keeps all read failures visible.
  const captures=path.join(temp,'captures');fs.mkdirSync(path.join(captures,'nested'),{recursive:true});
  fs.writeFileSync(path.join(captures,'b.TXT'),capture(one.replace('Falcons','Hawks')));fs.writeFileSync(path.join(captures,'a.txt'),capture(one));fs.writeFileSync(path.join(captures,'ignored.json'),'{}');fs.writeFileSync(path.join(captures,'nested','ignored.txt'),capture(one));
  const collected=P.collectInputs([captures,path.join(captures,'a.txt'),path.join(temp,'missing.txt')]);assert.deepEqual(collected.map(i=>path.basename(i.name)),['a.txt','b.TXT','missing.txt']);assert(collected[2].error);
  const empty=path.join(temp,'empty');fs.mkdirSync(empty);assert(P.collectInputs([empty])[0].error);assert.equal(P.collectInputs([empty,empty]).length,1);

  // Reports are optional; only report outputs can be replaced, never project or source files.
  const md=path.join(temp,'report.md'),js=path.join(temp,'report.json');P.writeReport(folder,md,report,[]);P.writeReport(folder,js,report,[]);assert.match(fs.readFileSync(md,'utf8'),/Mystery pitch/);assert.equal(JSON.parse(fs.readFileSync(js)).ready_for_import,false);
  P.writeReport(folder,md,report,[]);P.writeReport(folder,js,report,[]);
  for(const target of ['teams.json','data/seed.json','tools/report.json'])assert.throws(()=>P.writeReport(folder,path.join(folder,target),report,[]),/work\/preflight/);
  assert.throws(()=>P.writeReport(folder,path.join(folder,'index.html'),report,[]),/\.json or \.md/);
  assert.throws(()=>P.writeReport(folder,md,report,[{name:md}]),/input capture/);
  const unrelated=path.join(temp,'unrelated.json');fs.writeFileSync(unrelated,'{"keep":true}');assert.throws(()=>P.writeReport(folder,unrelated,report,[]),/different file/);assert.equal(fs.readFileSync(unrelated,'utf8'),'{"keep":true}');
  assert.throws(()=>P.writeReport(folder,path.join(temp,'report.txt'),report,[]),/\.json or \.md/);
  const alias=path.join(temp,'linked-data');fs.symlinkSync(path.join(folder,'data'),alias);assert.throws(()=>P.writeReport(folder,path.join(alias,'new.json'),report,[]),/work\/preflight/);

  // CLI status and explicit write prohibition; diagnostics cannot turn into partial imports.
  const cliReport=path.join(temp,'cli-report.json'),cli=run(['--preflight',captures,'--report',cliReport]);assert.equal(cli.status,0,cli.stderr);assert.match(cli.stdout,/2 file\(s\)/);assert.equal(JSON.parse(fs.readFileSync(cliReport)).ready_for_import,true);
  const badFile=path.join(temp,'bad.txt');fs.writeFileSync(badFile,bad);
  const failed=run(['--preflight',badFile,path.join(captures,'a.txt'),'--report',path.join(temp,'failed.md')]);assert.equal(failed.status,1);assert.match(failed.stdout,/Mystery pitch/);assert.match(failed.stdout,/Another token/);assert.match(failed.stdout,/steals second/);assert.match(failed.stdout,/READY:/);assert(fs.existsSync(path.join(temp,'failed.md')));
  const forbidden=run(['--preflight',captures,'--write']);assert.equal(forbidden.status,1);assert.match(forbidden.stderr,/cannot be combined/);
  const misplaced=run([path.join(captures,'a.txt'),'--report',path.join(temp,'nope.json')]);assert.equal(misplaced.status,1);assert.match(misplaced.stderr,/with --preflight only/);
  assert.deepEqual(runtime(),originalRuntime,'All real repository runtime files remain unchanged');
  console.log('PASS: all-file/all-record preflight diagnostics, metadata recovery, source line context, team scope, repository and cross-file conflicts, duplicate detection, folder mode, safe Markdown/JSON reports, exit codes and no runtime writes.');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
