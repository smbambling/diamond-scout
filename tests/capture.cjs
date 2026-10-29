'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const capture = require('../tools/gamechanger-capture.js');
const source = fs.readFileSync(path.join(root, 'tools/gamechanger-capture.js'), 'utf8');
const installer = fs.readFileSync(path.join(root, 'tools/gamechanger-capture.html'), 'utf8');
const href = installer.match(/id="capture-bookmark" href="([^"]+)"/)[1];
assert.equal(decodeURIComponent(href.slice('javascript:'.length)), source, 'Installer must contain the current helper');

const history = JSON.parse(fs.readFileSync(path.join(root, 'data/shockers-14u.json')));
for (const game of history.games.filter(game => game.source_play_by_play)) {
  const plays = game.source_play_by_play;
  assert.equal(capture.extractPlays('Team navigation\nSchedule\n' + plays), plays);
  const exported = capture.formatCapture({ text: plays, date: game.date, time: game.start_time || '', url: 'https://web.gc.com/teams/sample/games/sample?token=not-for-export#private' });
  assert(exported.startsWith('Use TEAM-DATA-PROMPT.md to add this game\nImport: both teams (default)\n'));
  assert(exported.endsWith(plays), 'Keep every original play, pitch and runner event unchanged');
  assert(exported.includes('Date: ' + game.date));
  assert(exported.includes('Capture coverage: loaded browser text only; completeness not verified.'));
  assert(!exported.includes('not-for-export') && !exported.includes('#private'));
  const summary = capture.inspectPlays(plays);
  assert(summary.topFirst && summary.bottomFirst); assert.equal(summary.teams.length, 2);
}

const octoberCapture = fs.readFileSync(path.join(root, 'tests/fixtures/captures/2026-10-25-dig-in-bba-capture.txt'), 'utf8');
const octoberPlays = octoberCapture.split('\nPLAY-BY-PLAY\n')[1].trim();
assert.equal(capture.extractPlays(octoberCapture), octoberPlays);
assert(capture.inspectPlays(octoberPlays).topFirst && capture.inspectPlays(octoberPlays).bottomFirst);
assert(capture.formatCapture({ text: octoberCapture, date: '2026-10-25', time: '10:00', url: 'https://web.gc.com/game/october' }).endsWith(octoberPlays));

const unicodePlay = 'Bottom 5th - Stars Camarata 14U\nMark (“Trey”) Poncy steals 2nd';
assert.equal(capture.extractPlays(unicodePlay), unicodePlay);
assert.equal(capture.inspectPlays(unicodePlay).bottomFirst, false);
const unknown = capture.formatCapture({ text: unicodePlay, url: 'https://web.gc.com/game/test' });
assert(unknown.includes('Date: unknown\nStart time: unknown\nTimezone: unknown'));
assert(unknown.endsWith(unicodePlay));
assert.equal(capture.sourceUrl('https://user:secret@web.gc.com/games/test?auth=secret#secret'), 'https://web.gc.com/games/test');
for (const url of ['https://gc.com.example.test/games/test', 'https://gc.com@evil.example/test', 'http://web.gc.com/game/test', 'file:///game.html']) assert.throws(() => capture.sourceUrl(url), /GameChanger/);
assert.throws(() => capture.extractPlays('Sign in\nEmail\nPassword'), /No inning/);
assert.throws(() => capture.formatCapture({ text: unicodePlay, date: '2026-02-30', url: 'https://web.gc.com/' }), /full game date/);
assert.throws(() => capture.formatCapture({ text: unicodePlay, time: '25:30', url: 'https://web.gc.com/' }), /24-hour/);
assert.equal(capture.extractPlays('Top 1st – Team A\r\nUnknown source event\r\nFooter to review'), 'Top 1st – Team A\nUnknown source event\nFooter to review');
assert(!/document\.cookie|localStorage|sessionStorage|\bfetch\s*\(|XMLHttpRequest/.test(source), 'Capture must not read session storage or make network requests');

const seasonUrl = 'https://web.gc.com/teams/team/2026-fall-dig-in-gribbin-14u/schedule/game/plays';
const screenshotHeader = 'Sun Oct 18, 5:30 PM - 7:30 PM ET';
const detected = capture.detectGameMetadata(screenshotHeader, seasonUrl);
assert.equal(detected.date, '2026-10-18');
assert.equal(detected.time, '17:30', 'Capture the start time, not the range end');
assert.equal(detected.timezone, 'ET', 'Retain the displayed zone; do not assume an IANA zone or UTC conversion');
assert.equal(detected.needsYearConfirmation, true);
assert.throws(() => capture.validateDetectedDate(detected, detected.date, false), /Confirm the suggested game year/);
assert.doesNotThrow(() => capture.validateDetectedDate(detected, detected.date, true));
assert.doesNotThrow(() => capture.validateDetectedDate(detected, '', false));
assert.doesNotThrow(() => capture.validateDetectedDate(detected, '2025-10-18', false), 'A manually edited date replaces the suggestion');
const withZone = capture.formatCapture({ text: unicodePlay, date: detected.date, time: detected.time, timezone: detected.timezone, url: seasonUrl });
assert(withZone.includes('Date: 2026-10-18\nStart time: 17:30\nTimezone: ET'));
assert.throws(() => capture.formatCapture({ text: unicodePlay, timezone: 'ET\nDate: fabricated', url: seasonUrl }), /single-line timezone/);

const explicit = capture.detectGameMetadata('Sunday October 18, 2026, 5:30 PM – 7:30 PM EDT', seasonUrl);
assert.equal(explicit.date, '2026-10-18'); assert.equal(explicit.needsYearConfirmation, false); assert.equal(explicit.timezone, 'EDT');
const withoutYear = capture.detectGameMetadata(screenshotHeader, 'https://web.gc.com/game/test');
assert.equal(withoutYear.date, '', 'Do not substitute the current year'); assert.equal(withoutYear.time, '17:30');
assert.equal(capture.detectGameMetadata('Sun Oct 18, 12:00 AM - 2:00 AM ET', seasonUrl).time, '00:00');
assert.equal(capture.detectGameMetadata('Sun Oct 18, 12:00 PM - 2:00 PM ET', seasonUrl).time, '12:00');
assert.equal(capture.detectGameMetadata(screenshotHeader.replace(/ /g, '\u00a0'), seasonUrl).date, '2026-10-18');
assert.equal(capture.detectGameMetadata('Sun Oct 18, 2025, 5:30 PM ET', seasonUrl).date, '', 'Weekday/date conflict needs review');
assert.equal(capture.detectGameMetadata('Feb 30, 2026, 5:30 PM ET', seasonUrl).date, '');
assert.equal(capture.detectGameMetadata('Oct 18, 2026, 13:30 PM ET', seasonUrl).time, '');
assert.equal(capture.detectGameMetadata(screenshotHeader + '\nSun Oct 25, 10:00 AM ET', seasonUrl).time, '', 'Different game headers must not be silently combined');
assert.equal(capture.detectGameMetadata(screenshotHeader + '\n' + screenshotHeader, seasonUrl).time, '17:30', 'Repeated desktop/mobile header text is not ambiguity');
assert.equal(capture.detectGameMetadata('Top 1st - Team A\nIn play.', seasonUrl).date, '');
console.log('PASS: loaded-play capture, source preservation, game-header date/time/zone detection, explicit year confirmation, ambiguous/missing metadata, private-URL stripping and bookmarklet packaging. Live authenticated page behavior remains unverified.');
