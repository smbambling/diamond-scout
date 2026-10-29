# GameChanger play capture

To convert a captured TXT file into the app's team JSON locally, see [IMPORT-PLAYS.md](IMPORT-PLAYS.md): `node tools/import-plays.cjs "/path/to/plays.txt"` previews, and adding `--write` saves both teams with backups. The converter is separate from the browser capture helper described below.

Before a batch import, run `node tools/import-plays.cjs --preflight "/path/to/captures" --report work/preflight/latest.md`. This collects independent source/parser errors across TXT files and plays, with line context, while keeping all team data unchanged. See the converter guide for folder scope, optional JSON reports and import instructions after review.

This optional bookmarklet helps capture plays you can already view in your own signed-in GameChanger browser session. It saves reviewed text with the `TEAM-DATA-PROMPT.md` import request and supplied game metadata. It does not sign in, call private APIs, read browser session data, write team JSON, or change the hosted Diamond-Scout app.

## Install and use

1. Open `gamechanger-capture.html` from this folder in your browser. With the local preview running, use <http://127.0.0.1:8000/tools/gamechanger-capture.html>.
2. Show your browser’s bookmarks bar and drag **Capture GC plays** onto it. To update an existing installation, reload the installer page and replace the old bookmark with this new button; bookmarks contain their own copy of the code.
3. Sign into <https://web.gc.com/> normally. Open the relevant game and its **Plays** view if available to your account.
4. Expand innings and load the plays. Click the **Capture GC plays** bookmark while viewing that GameChanger page.
5. Review the captured text and the prefilled game date, start time and timezone. The helper reads the game header from the page even if you selected only the plays. Correct any field or leave missing metadata blank; capture time is never substituted for game time. If the page omits the year, a year from a season URL such as `2026-fall-...` is suggested only when the date/weekday agree, and you must confirm that year before export (or edit/clear the date).
6. Choose **Download TXT** or **Copy import prompt**. Attach or paste the result in the Diamond-Scout conversation. It already begins with **“Use TEAM-DATA-PROMPT.md to add this game”** and requests both teams by default.

If automatic text detection fails, select the play text, including inning and team headings, then click the bookmark again. If the browser or site blocks the bookmarklet, normal copy/paste remains available; browser security settings do not need to be changed.

## Capture limits

**First version: authenticated GameChanger page compatibility is unverified.** The helper recognizes the `Top 1st - Team Name` / `Bottom 1st - Team Name` format used in the supplied examples. Date/time detection is tested against the header format in the supplied screenshot, including nonbreaking spaces, ranges, noon/midnight, missing years and ambiguous dates. The actual signed-in DOM extraction, browser clipboard permissions, styling and download behavior have not been tested in a live browser here.

The helper reads the selected text, or searches the loaded main/page text for an inning heading. It retains everything from that heading onward so unfamiliar plays are not silently filtered out. Remove navigation or footer text in the review box before exporting. Selection is useful when the page contains other unrelated game text.

Only text presently available in the page is captured. GameChanger may load plays lazily or remove earlier rows while scrolling. Expand/load both sides and check the earliest and latest supplied plays, pitch sequences and runner events. Finding both first-inning halves is a sanity check, not proof of completeness. Every export is marked **loaded browser text only; completeness not verified**. Partial or unfinished sources remain partial when imported.

Dates and times are editable. A header such as `Sun Oct 18, 5:30 PM - 7:30 PM ET` supplies a 17:30 start time and the literal `ET` timezone; the range end is not used as the start. A visible full year is used directly. A season-URL year is only a suggestion requiring confirmation; no current-year fallback is used. Multiple different date/time candidates or weekday conflicts require review instead of silently choosing a date. No matching header leaves fields unknown. Source URLs retain only origin/path, dropping URL credentials, query strings and fragments. Nothing is uploaded. The generated text file contains player/game information you choose to export, so review it before sharing.

## Official export options

GameChanger documents [season-stat CSV exports for Staff](https://help.gc.com/hc/en-us/articles/360043583651-Exporting-Season-Stats). Those aggregate stats do not replace the detailed play descriptions and recorded pitch sequences used by Diamond-Scout. GameChanger also documents [web box scores and play-by-play access](https://help.gc.com/hc/en-us/articles/38263672363917-Box-Scores-and-Plays-on-Web-for-League-and-Tournament-Admins), with availability depending on account access. This helper captures only content the signed-in page already displays.

## Files and verification

- `gamechanger-capture.js`: readable helper source and dependency-free text/metadata functions.
- `gamechanger-capture.html`: ready-to-use installer containing the matching bookmarklet.
- `../tests/capture.cjs`: checks existing play preservation, Unicode, partial captures, screenshot-format metadata detection, year confirmation, unknown/ambiguous metadata, invalid dates, URL sanitization and installer/source consistency.

Run `node tests/capture.cjs`. It does not contact GameChanger or launch a browser. Existing runtime files and deployment instructions are unchanged; the `tools/` folder is optional and is not loaded by `index.html`. 
