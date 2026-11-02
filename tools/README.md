# GameChanger play capture

## One-click combined game capture

Replace the bookmark from the reloaded `tools/gamechanger-capture.html` installer. Open the intended signed-in GameChanger game and click **Capture GC data** once. It reads Plays and Box score in a temporary visible same-origin window and downloads one `gamechanger-game-<date>.json` file after review. In the review dialog, choose **Teams to import**: **Both teams (default)** or **Only [team name]**. The choice is saved in the export and applies to both plays and box-score reconciliation; all captured source evidence remains available. Plays-only TXT exports support the same choice. Box-score-only exports use the team selection from their paired Plays capture. No inning expansion is required. The current page remains open; no private API, credentials, cookies or browser storage are read. Cancel removes the the temporary window.

```sh
node tools/import-plays.cjs /path/gamechanger-game-2026-10-25.json
node tools/import-plays.cjs --preflight /path/gamechanger-game-2026-10-25.json --report work/preflight/combined.md
node tools/import-plays.cjs /path/gamechanger-game-2026-10-25.json --write
```

Normal import and preflight accept multiple game JSON captures alongside legacy Plays TXT files. Folder preflight discovers TXT files and `gamechanger-game-*.json` / `gamechanger-boxscore-*.json`, ignoring unrelated JSON. Game IDs, teams and known metadata must agree between screens. The importer routes the combined file through the existing Plays parser and box-score reconciliation without duplicating PAs, changing source results or guessing corrections. Original combined JSON, extracted plays and box-score evidence are included in write backups.

Capture waits for rendered screens to settle, with a bounded timeout per screen, but does not certify completeness. Both first-inning halves, team names, dates and table counts are checked or shown for review. Notes-only/canvas table warnings remain attached. Live capture-window loading and authenticated DOM compatibility are not verified in this environment. If the capture window is blocked, use **Capture current screen only** in the progress dialog and follow the separate-screen fallback below. No automatic full-game success is claimed when a screen cannot be read.

`node tests/combined-capture.cjs` covers sequential capture with simulated readers, wrong-route/event/team/metadata guards, explicit year confirmation, partial warnings, bundle processing, backed-up writes in temporary projects, preflight and duplicate detection. Browser loading, cancellation and rendering still need a live check.


To convert a captured TXT file into the app's team JSON locally, see [IMPORT-PLAYS.md](IMPORT-PLAYS.md): `node tools/import-plays.cjs "/path/to/plays.txt"` previews, and adding `--write` saves both teams with backups. The converter is separate from the browser capture helper described below.

Before a batch import, run `node tools/import-plays.cjs --preflight "/path/to/captures" --report work/preflight/latest.md`. This collects independent source/parser errors across TXT files and plays, with line context, while keeping all team data unchanged. See the converter guide for folder scope, optional JSON reports and import instructions after review.

This optional bookmarklet helps capture plays you can already view in your own signed-in GameChanger browser session. It saves reviewed text with the `TEAM-DATA-PROMPT.md` import request and supplied game metadata. It does not sign in, call private APIs, read browser session data, write team JSON, or change the hosted Diamond-Scout app.

## Install and use

1. Open `gamechanger-capture.html` from this folder in your browser. With the local preview running, use <http://127.0.0.1:8000/tools/gamechanger-capture.html>.
2. Show your browser’s bookmarks bar and drag **Capture GC data** onto it. To update an existing installation, reload the installer page and replace the old bookmark with this new button; bookmarks contain their own copy of the code.
3. Sign into <https://web.gc.com/> normally. Open the relevant game and its **Plays** view if available to your account.
4. No inning expansion is needed. Click the **Capture GC data** bookmark while viewing that GameChanger page.
5. Check the prefilled game date, start time and timezone, select teams to import and optional organization assignments. Raw captured data stays collapsed under **Captured data (troubleshooting)**; routine captures do not require reading it. The helper reads the game header from the page even if you selected only the plays. Correct any field or leave missing metadata blank; capture time is never substituted for game time. If the page omits the year, a year from a season URL such as `2026-fall-...` is suggested only when the date/weekday agree, and you must confirm that year before export (or edit/clear the date).
6. Resolve visible warnings with **Retry capture** if a table failed to load, then choose **Download game JSON** (or TXT for a single Plays screen) or **Copy**. Attach or paste the result in the Diamond-Scout conversation. It already begins with **“Use TEAM-DATA-PROMPT.md to add this game”** and requests both teams by default.

If automatic text detection fails, select the play text, including inning and team headings, then click the bookmark again. If the browser or site blocks the bookmarklet, normal copy/paste remains available; browser security settings do not need to be changed.

## Capture limits

**First version: authenticated GameChanger page compatibility is unverified.** The helper recognizes the `Top 1st - Team Name` / `Bottom 1st - Team Name` format used in the supplied examples. Date/time detection is tested against the header format in the supplied screenshot, including nonbreaking spaces, ranges, noon/midnight, missing years and ambiguous dates. The actual signed-in DOM extraction, browser clipboard permissions, styling and download behavior have not been tested in a live browser here.

The helper reads the selected text, or searches the loaded main/page text for an inning heading. It retains everything from that heading onward so unfamiliar plays are not silently filtered out. Remove navigation or footer text in the review box before exporting. Selection is useful when the page contains other unrelated game text.

Only text presently available in the page is captured. GameChanger may load plays lazily or remove earlier rows while scrolling. Load both sides and check the earliest and latest supplied plays, pitch sequences and runner events. Finding both first-inning halves is a sanity check, not proof of completeness. Every export is marked **loaded browser text only; completeness not verified**. Partial or unfinished sources remain partial when imported.

Dates and times are editable. A header such as `Sun Oct 18, 5:30 PM - 7:30 PM ET` supplies a 17:30 start time and the literal `ET` timezone; the range end is not used as the start. A visible full year is used directly. A season-URL year is only a suggestion requiring confirmation; no current-year fallback is used. Multiple different date/time candidates or weekday conflicts require review instead of silently choosing a date. No matching header leaves fields unknown. Source URLs retain only origin/path, dropping URL credentials, query strings and fragments. Nothing is uploaded. The generated text file contains player/game information you choose to export, so review it before sharing.

## Official export options

GameChanger documents [season-stat CSV exports for Staff](https://help.gc.com/hc/en-us/articles/360043583651-Exporting-Season-Stats). Those aggregate stats do not replace the detailed play descriptions and recorded pitch sequences used by Diamond-Scout. GameChanger also documents [web box scores and play-by-play access](https://help.gc.com/hc/en-us/articles/38263672363917-Box-Scores-and-Plays-on-Web-for-League-and-Tournament-Admins), with availability depending on account access. This helper captures only content the signed-in page already displays.

## Files and verification

- `gamechanger-capture.js`: readable helper source and dependency-free text/metadata functions.
- `gamechanger-capture.html`: ready-to-use installer containing the matching bookmarklet.
- `../tests/capture.cjs`: checks existing play preservation, Unicode, partial captures, screenshot-format metadata detection, year confirmation, unknown/ambiguous metadata, invalid dates, URL sanitization and installer/source consistency.

Run `node tests/capture.cjs`. It does not contact GameChanger or launch a browser. Existing runtime files and deployment instructions are unchanged; the `tools/` folder is optional and is not loaded by `index.html`. 

The capture bookmark now supports Plays TXT and Box score JSON. Replace the saved bookmark from the reloaded installer. Pair files with `node tools/import-plays.cjs plays.txt --box-score boxscore.json` (preview), add `--write` to save, or use `--preflight` with the same flag. Read IMPORT-PLAYS.md for matching, incomplete DOM captures and review-only scoring conflicts. `box-score.cjs` validates sidecar evidence and compares recorded batting counts; it never rewrites play results.


### Assign captured scouting to organization teams

Reload `tools/gamechanger-capture.html` and replace your **Capture GC data** bookmark to get the new controls. In the review dialog, use **Assign scouting to your teams (optional)** to check one or more organization teams. Keep **Teams to import** set to the captured teams whose scouting you want to retain. No assignment is selected by default.

Plays TXT and combined game JSON exports include an `Assign to: id, id` directive. Run the usual import command: preview shows `OPPONENT-ASSIGNED` entries; `--write` saves assignments together with the import and its backup. The same captured opponent can be assigned to several organization teams without duplicating history. Existing/duplicate games can add assignments too. Unknown organization IDs stop the import instead of creating a new internal team. Box-score-only exports use assignments from their paired Plays export.

For an older capture, the equivalent repeatable CLI flag is:

```sh
node tools/import-plays.cjs /path/gamechanger-game.json --assign-to 14u-black
```

Add `--write` after reviewing the preview. Capture metadata and CLI assignments are combined. Configure organization teams in `teams.json`; optional `scouting_team_id` identifies an internal team's own scouting record, which is excluded from its opponent assignments. A record can still be assigned to another internal team. Run `node tools/prepare-release.cjs` after configuration changes: it embeds current organization choices into the self-contained capture helper and rebuilds its installer. Reinstall the bookmark to receive the updated list; no cross-site fetch or browser storage is used.


### Optional tournament label

The capture review dialog includes **Tournament (optional)** for Plays and combined Plays + Box score captures. Enter a consistent name including the year, for example `Halloween Havoc 2026`, or leave it blank. The export carries a `Tournament:` metadata line; imports save it as `game.tournament` on each imported team's game. Nothing is inferred from dates or consecutive games, and the app does not yet expose tournament search/filtering.

For existing captures, use `--tournament "Halloween Havoc 2026"` with the import command. Duplicate plays may add a previously missing label without duplicating the game or changing its plays. Conflicting existing labels stop the import for explicit review; a blank field does not erase a saved label. Labels must be single-line text of at most 160 characters. Box-score-only captures continue to use the label supplied with their paired Plays capture.

Reload the capture installer and replace the bookmark to receive the new field.


### Full dates from Recap

If Plays and Box score provide only a season-derived year or no full date, combined capture also opens the same game's `/recap` screen. It reads a game heading such as `August 23, 2025 vs. RISE 13U`, validates the calendar date and checks its month/day against the other screens. An explicit matching Recap date replaces a season-year hint and removes the year-confirmation requirement. Start time and timezone still come from Plays/Box score; none are inferred from the recap date. The exported bundle retains the recap heading, date and source URL as `recap_date` evidence.

A conflicting game date or redirected Recap stops capture for review. If Recap cannot be loaded or has no unique full-date heading, capture retains its existing manual date/year-confirmation flow with a warning. Captures already carrying an explicit year do not need the extra navigation. Reinstall the bookmark from the updated installer to receive this behavior. Authenticated live-site compatibility still needs verification.

## Capture diagnostics

Loading failures offer **Retry capture**, current-screen capture, or Cancel. The result also has a Retry button; cancelling that retry retains the previous capture. Missing batting and pitching tables name the affected team. Warnings do not certify completeness or replace import validation: the importer checks game identity and reconciles supported box-score totals before saving.

Downloads include game date, start time, both team names, and an event-ID suffix to distinguish games. Unknown metadata is named explicitly. Exports include a capture-version fingerprint for diagnosing problems; keep the original export if an import fails. Updating the bookmark requires replacing it from the refreshed installer page.

## Capture a team schedule

Replace your capture bookmark using the refreshed `gamechanger-capture.html` installer. While signed into GameChanger, open the team's **Schedule** and run the bookmark. The scanner lists completed games, selected by default; deselect any games you do not want. Practices, other events, upcoming games and events without a final W/L/T score are excluded. Games sharing a date remain separate entries.

Choose both teams or schedule-team only, optional scouting assignments, and an optional tournament label for the batch. Click **Capture selected games**. One visible capture window reads each game's Plays, Box score and (when needed) Recap sequentially. Keep that window open. The schedule's full calendar date is checked against the game screens and used to resolve the year.

Failures are listed and do not stop the remaining games. **Retry failed games** retains prior successes. **Stop capture** preserves completed captures for download; **Download captured games** produces one `gamechanger-game-schedule-*.json` file containing successful game captures and the failure summary. Warnings from captured games appear in the results. No repository data changes until you run the importer.

The scanner reads only loaded schedule rows. Scroll the schedule to load any older events, then use **Load / rescan schedule**. You can also paste another team's schedule URL and load it through the signed-in capture window; for lazy-loaded schedules, open that schedule directly and load its rows before scanning. Unknown page layouts are not treated as complete schedules. Live authenticated browser behavior still requires verification.

Import the downloaded batch normally:

```sh
node tools/import-plays.cjs ~/Downloads/gamechanger-game-schedule-*.json --preflight
node tools/import-plays.cjs ~/Downloads/gamechanger-game-schedule-*.json --write
```

Existing duplicate/overlap checks and all-or-nothing saving apply to every game. Failed captures are not imported; the importer warns when the batch was stopped or contains failures. A successful capture is not a guarantee of complete scorekeeping data.
