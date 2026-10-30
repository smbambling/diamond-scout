'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const C=require('../tools/gamechanger-capture.js'),I=require('../tools/import-plays.cjs'),D=I.loadCore();
const raw=fs.readFileSync(path.join(__dirname,'fixtures/game-captures/2026-10-03-winchester-dig-in.json'),'utf8'),bundle=JSON.parse(raw),expanded=I.expandInputs([{name:'game.json',raw}]);
const capture=I.readCapture(expanded.inputs[0].raw);assert(capture.footer.startsWith('Get the App'));assert(capture.source.endsWith('Cole Gore walks, Tyler pitching.'));assert(capture.raw.includes(capture.footer));
const winchester={schema_version:1,team:{id:'winchester',name:'Winchester Wildcats 14U'},players:[],games:[],plate_appearances:[]};
I.buildTeam(capture,winchester.team.name,winchester,'test-game','Dig In (Gribbin) 14U',D);D.validateData(winchester);
assert.equal(winchester.plate_appearances.length,31);assert.equal(D.pitchSummary(winchester.plate_appearances).n,117);assert.equal(winchester.plate_appearances.filter(p=>p.status==='complete').length,30);assert.equal(D.summarize(winchester.plate_appearances).n,18);
assert.equal(winchester.games[0].source_capture_footer,capture.footer);assert(!winchester.players.some(p=>/Privacy|Get the App/.test(p.name)));
const cleaned=C.extractPlays(bundle.plays);assert.equal(cleaned,capture.source);
const withoutFooter=I.readCapture(bundle.plays.slice(0,bundle.plays.indexOf('\nGet the App')));assert.equal(withoutFooter.sourceHash,capture.sourceHash,'Site footer must not create a distinct game fingerprint');
for(const ending of ['\nUnknown runner action.','\nTop 6th - Winchester Wildcats 14U\nCole Gore at bat']){
 const text=bundle.plays+ending;assert.equal(C.stripPlaysFooter(text).footer,null,'Unrecognized content or later plays cannot be silently discarded');
 assert.throws(()=>I.buildTeam(I.readCapture(text),winchester.team.name,{schema_version:1,team:winchester.team,players:[],games:[],plate_appearances:[]},'bad','Opponent',D),/Unexpected text|Inning order conflicts/);
}
const crlf=I.readCapture(bundle.plays.replaceAll('\n','\r\n'));assert(crlf.footer.includes('\r\n'));assert(crlf.source.includes('\r\n'));
console.log('PASS: actual combined-capture footer removal, original footer retention, 31 PAs/117 pitches, stable source fingerprints, CRLF and strict rejection of unfamiliar trailing text.');
