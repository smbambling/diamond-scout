'use strict';
const fs=require('node:fs'),path=require('node:path');
// Read-only checks shared by the importer and the repository audit.
function metricIssues(data,game,D){
 const pas=data.plate_appearances.filter(p=>p.game_id===game.id),issues=[];
 const running=D.baserunningSummary(data,{game:game.id,batter:'all'}),batting=D.battingSummary(pas);
 if(running.unlinkedAttempts){
  const events=running.events.filter(e=>!e.reach_pa_id&&!e.runner_entry_id);
  issues.push('Steal tendency unavailable: '+running.unlinkedAttempts+' attempt(s) need trip links'+(events.length?' ('+events.map(e=>e.source_text+'; inning '+e.inning).join(' | ')+')':'')+'. Check runner substitutions and the preceding reach in the saved Plays capture.');
 }
 if(running.unknownOnBase)issues.push('Steal tendency unavailable: '+running.unknownOnBase+' on-base opportunity record(s) need review. Check unresolved replacements or reach status in saved Plays.');
 if(batting.unclassified)issues.push('Full AVG/OBP/SLG unavailable: '+batting.unclassified+' completed result(s) need scoring classification. Resolve against the saved source; do not guess a hit or out.');
 const pitches=pas.flatMap(p=>p.pitches),unknown=pitches.filter(p=>p.outcome==='unknown').length;
 if(unknown)issues.push('Pitch metrics have partial coverage: '+unknown+' pitch outcome(s) are unclassified. Review the source pitch text.');
 const missing=pas.filter(p=>p.status==='complete'&&!p.pitches.length).length;
 if(missing)issues.push('Pitch metrics have partial coverage: '+missing+' completed PA(s) have no recorded pitches. Retry capture if Plays was not fully loaded.');
 const unclearFirst=pas.filter(p=>p.pitches.length&&(!p.pitches[0].count_before||p.pitches[0].count_before.balls!==0||p.pitches[0].count_before.strikes!==0)).length;
 if(unclearFirst)issues.push('First-pitch metrics have partial coverage: '+unclearFirst+' sequence(s) lack a verified opening 0–0 count. Review missing or edited pitch text.');
 if(!game.box_score)issues.push('Pitching summary unavailable: no paired Box score. Capture Plays + Box score for this game.');
 else if(!game.pitching_scout?.pitchers?.length)issues.push('Pitching summary unavailable: no usable team pitching table. Retry capture with the pitching table loaded.');
 else if(game.pitching_scout.pitchers.some(p=>!p.sample))issues.push('Pitch tendencies / inning detail have partial or unavailable coverage: '+(game.pitching_scout.reason||'Pitcher sequences did not reconcile.')+' Review the paired Plays and Box score.');
 return issues;
}
if(require.main===module){
 const root=path.resolve(__dirname,'..'),D=require('./import-plays.cjs').loadCore(),manifest=JSON.parse(fs.readFileSync(path.join(root,'teams.json')));let affected=0;
 for(const team of manifest.teams){const data=D.validateData(JSON.parse(fs.readFileSync(path.join(root,team.data_file))));for(const game of data.games){const issues=metricIssues(data,game,D);if(!issues.length)continue;affected++;console.log('\n'+team.name+' · '+(game.date||'Undated')+' · '+game.opponent+' ['+game.id+']');for(const issue of issues)console.log('  '+issue);}}
 console.log('\n'+affected+' game/team record(s) with missing or partial metric coverage. Read-only audit; no files changed.');
}
module.exports={metricIssues};
