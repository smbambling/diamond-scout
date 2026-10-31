'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),D=require('../tools/import-plays.cjs').loadCore();
const history=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/teams/dig-in-gribbin-14u.json'))),box=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/box-score/2026-10-25-dig-in-bba.json')));
history.games[0].box_score={source_capture:box};const numbers=D.playerJerseyNumbers(history);
assert.equal(numbers.get('dig-in-gribbin-14u-deven-downs'),'22');assert.equal(numbers.get('dig-in-gribbin-14u-quinn-kasprzak'),'3');assert.equal(numbers.size,11);
assert(!numbers.has('bba-14u-east-teddy-fleszar'),'Opponent rows must not supply this team’s numbers');
const data={team:{name:'Team'},players:[{id:'one',name:'Alex Young'},{id:'two',name:'Pat Day'},{id:'three',name:'Unknown',identity_status:'unidentified'}],games:[{box_score:{source_capture:{teams:[{name:'Team',tables:[{kind:'batting',columns:['LINEUP','AB'],rows:[['Alex Young #00 (SS, P)','1'],['Pat Day #0','1'],['Unknown #9','1']]}]}]}}}]};
assert.equal(D.playerJerseyNumbers(data).get('one'),'00');assert.equal(D.playerJerseyNumbers(data).get('two'),'0');assert(!D.playerJerseyNumbers(data).has('three'));
const changed=structuredClone(data.games[0]);changed.box_score.source_capture.teams[0].tables[0].rows[0][0]='Alex Young #12';data.games.push(changed);assert(!D.playerJerseyNumbers(data).has('one'),'Conflicting numbers must not be guessed');assert.equal(D.playerJerseyNumbers(data).get('two'),'0');
data.players.push({id:'duplicate',name:'Pat Day'});assert(!D.playerJerseyNumbers(data).has('two'),'Ambiguous name matches must not assign a number');
assert.equal(D.playerJerseyNumbers({team:{name:'Team'},players:data.players,games:[{}]}).size,0);
console.log('PASS: recorded box-score numbers, player identity, opponent isolation, zero/leading-zero jerseys, conflicting evidence and name-only fallback.');

// Actual browser DOM labels concatenate the name and number without a space.
const actual=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/game-captures/2026-10-03-winchester-dig-in.json')));
for(const [team,name,expected] of [['Winchester Wildcats 14U','Cole Gore','5'],['Dig In (Gribbin) 14U','Deven Downs','22']]){
 const captured={team:{name:team},players:[{id:'player',name}],games:[{box_score:{source_capture:actual.box_score}}]};assert.equal(D.playerJerseyNumbers(captured).get('player'),expected);
}

const unsorted=[{id:'ten-z',name:'Zach',jersey:'10'},{id:'unknown-z',name:'Zed'},{id:'two',name:'Two',jersey:'2'},{id:'double-zero',name:'Double zero',jersey:'00'},{id:'zero',name:'Zero',jersey:'0'},{id:'ten-a',name:'Adam',jersey:'10'},{id:'unknown-a',name:'Amy',jersey:null}];
const beforeOrder=unsorted.map(p=>p.id).join(',');
assert.deepEqual([...D.sortPlayersByJersey(unsorted)].map(p=>p.id),['zero','double-zero','two','ten-a','ten-z','unknown-a','unknown-z']);assert.equal(unsorted.map(p=>p.id).join(','),beforeOrder,'Sorting never mutates source roster');
