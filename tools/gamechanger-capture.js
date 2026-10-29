/* Diamond-Scout: capture already-loaded GameChanger plays in your signed-in browser. */
(function () {
  'use strict';

  const inningHeading = /^(?:Top|Bottom)\s+\d+(?:st|nd|rd|th)\s*[-–—]\s*\S/im;
  const clean = value => String(value || '').replace(/\r\n?/g, '\n').trim();

  function extractPlays(text) {
    const original = clean(text);
    const match = inningHeading.exec(original);
    if (!match) throw new Error('No inning/team heading found. Open Plays, or select the plays including a heading such as “Top 1st - Team Name”, then try again.');
    // Retain all following text: unfamiliar plays must not be silently discarded.
    return original.slice(match.index);
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

  function formatCapture({ text, date = '', time = '', timezone = '', url }) {
    const plays = extractPlays(text);
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) {
      throw new Error('Use a full game date, including year, or leave it unknown.');
    }
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Use a 24-hour start time, or leave it unknown.');
    if (timezone && (timezone.length > 80 || /[\r\n\u0000]/.test(timezone))) throw new Error('Use a single-line timezone label, or leave it unknown.');
    return [
      'Use TEAM-DATA-PROMPT.md to add this game',
      'Import: both teams (default)',
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

  if (typeof document === 'undefined' && typeof module !== 'undefined' && module.exports) {
    module.exports = { extractPlays, inspectPlays, sourceUrl, formatCapture, detectGameMetadata, validateDetectedDate };
    return;
  }

  try {
    const url = sourceUrl(location.href);
    const existing = document.getElementById('diamond-scout-capture-dialog');
    if (existing) { existing.focus(); return; }
    const detected = detectGameMetadata(document.body.innerText, location.href);
    const selected = clean(window.getSelection()?.toString());
    let text;
    if (selected) {
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
      '<p style="margin:0 0 12px">This saves loaded text only. Expand the innings and review the first and last plays. Scrolling alone may not retain every play on the page.</p>' +
      '<p id="diamond-scout-capture-summary" style="margin:0 0 12px;font-weight:600" role="status"></p>' +
      '<p id="diamond-scout-capture-metadata" style="font-size:13px" role="status"></p>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">' +
      '<label style="display:grid;gap:4px;flex:1">Game date (optional)<input id="diamond-scout-capture-date" type="date" style="font:inherit;min-height:48px;padding:8px;box-sizing:border-box;min-width:0"></label>' +
      '<label style="display:grid;gap:4px;flex:1">Start time (optional)<input id="diamond-scout-capture-time" type="time" style="font:inherit;min-height:48px;padding:8px;box-sizing:border-box;min-width:0"></label>' +
      '<label style="display:grid;gap:4px;flex:1">Timezone (as shown)<input id="diamond-scout-capture-zone" type="text" maxlength="80" placeholder="unknown" style="font:inherit;min-height:48px;padding:8px;box-sizing:border-box;min-width:0"></label></div>' +
      '<label id="diamond-scout-capture-year-label" hidden style="gap:8px;align-items:center;min-height:48px;margin-bottom:12px"><input id="diamond-scout-capture-year-confirm" type="checkbox" style="width:24px;height:24px">I confirm the suggested game year from the season URL.</label>' +
      '<label style="display:grid;gap:4px">Play-by-play — edit out navigation or other page text<textarea id="diamond-scout-capture-text" spellcheck="false" style="font:16px/1.4 ui-monospace,monospace;width:100%;min-height:260px;padding:10px;box-sizing:border-box;resize:vertical"></textarea></label>' +
      '<p style="font-size:13px">Dates are never inferred from capture time. No login credentials, cookies or browser storage are read. Nothing is uploaded or imported into team history by this helper.</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:10px"><button id="diamond-scout-capture-download" type="button">Download TXT</button><button id="diamond-scout-capture-copy" type="button">Copy import prompt</button><button id="diamond-scout-capture-close" type="button">Close</button></div>';
    document.body.appendChild(dialog);
    const field = id => dialog.querySelector('#diamond-scout-capture-' + id);
    for (const button of dialog.querySelectorAll('button')) button.style.cssText = 'font:inherit;min-height:48px;padding:10px 14px;border-radius:10px;border:1px solid #8B9BAF;background:white;color:#0A192F;cursor:pointer';
    field('download').style.background = '#0052CC'; field('download').style.color = '#FFFFFF';
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
      const summary = inspectPlays(field('text').value);
      field('summary').textContent = summary.headings + ' inning headings · ' + (summary.teams.join(' / ') || 'No teams detected') +
        (!summary.topFirst || !summary.bottomFirst ? '. A first-inning half is missing; check for a partial capture.' : '. Both first-inning halves found; this does not prove the capture is complete.');
    }
    function output() {
      validateDetectedDate(detected, field('date').value, field('year-confirm').checked);
      return formatCapture({ text: field('text').value, date: field('date').value, time: field('time').value, timezone: field('zone').value.trim(), url });
    }
    field('text').addEventListener('input', updateSummary);
    field('download').addEventListener('click', () => {
      try {
        const blob = new Blob([output() + '\n'], { type: 'text/plain;charset=utf-8' });
        const objectUrl = URL.createObjectURL(blob), link = document.createElement('a');
        link.href = objectUrl; link.download = 'gamechanger-plays-' + (field('date').value || 'unknown-date') + '.txt';
        dialog.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
        field('summary').textContent = 'Download requested. Attach the TXT file when asking to import the game.';
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
  } catch (error) { window.alert('Diamond-Scout capture: ' + error.message); }
})();
