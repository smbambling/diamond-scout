# Convert captured plays to team JSON locally

`import-plays.cjs` reads GameChanger Plays TXT files and converts the supplied batting and running events into Diamond-Scout's existing JSON format. It runs entirely on your computer, makes no network requests, and requires **Node.js 18 or newer** with no packages to install. Check with `node --version`.

The scouting website stays buildless: it reads the updated JSON files on refresh. This utility is optional and is never loaded by the website.

## Batch preflight: recommended before importing

Put the captures you want to check into one folder, keeping the original TXT files intact. Then run:

```sh
node tools/import-plays.cjs --preflight "/path/to/captures" --report work/preflight/latest.md
```

You can also pass several individual TXT paths or a wildcard. Folder mode checks visible regular `.txt`/`.TXT` files directly in that folder, in filename order; it does not recurse into subfolders or follow directory entries that are symlinks. Repeated identical paths are checked once. A missing/unreadable file or empty folder is reported alongside the other inputs.

Preflight checks capture metadata, inning boundaries/order, result descriptions, every recoverable pitch/context token, team/player identity, schema references, and duplicate/overlapping games against both the repository and earlier valid files in the batch. It continues through independent problems, reporting filename, team/inning, original line numbers and source excerpts together. It respects `Import: only ...`, `--team`, team aliases and metadata overrides; unselected teams are explicitly listed as outside the requested scope.

| Status | Meaning |
| --- | --- |
| `READY` | The file can be parsed and planned for import; review any source notes. |
| `DUPLICATE` | Every selected team already has these plays; importing again adds nothing. |
| `BLOCKED` | One or more errors prevent this file from being imported. |

The entire batch must pass before using the normal `--write` command. Team rows inside a blocked file can describe independently checked data, but the file remains blocked and no partial import is offered. Unsupported records are never dropped to make the batch pass. Missing pitches, generic `out (other)` results and other faithfully retained source limitations appear as notes; those may leave statistics partial even when the import is technically ready.

**Preflight does not write team JSON, `teams.json`, app files, backups or locks.** It prints its report to Terminal. `--report` optionally saves a Markdown (`.md`) report to read/share, or a structured JSON (`.json`) report for scripts. Reports inside the project must go under `work/preflight/`; existing unrelated files and input captures cannot be overwritten. An existing preflight report at the same destination can be refreshed.

```sh
node tools/import-plays.cjs --preflight "/path/to/captures" --report work/preflight/latest.json
```

Exit code `0` means all inputs are ready/duplicate (notes may remain). Exit code `1` means blocking errors or an I/O/command error needs attention. `--preflight --write` is rejected. The source's full-game completeness is never established by a passing preflight.

After reviewing a clean report, use explicit file paths or a wildcard with the ordinary importer:

```sh
node tools/import-plays.cjs "/path/to/captures/first.txt" "/path/to/captures/second.txt" --write
```

Repeat any intended `--team`, alias or metadata override options on the import command. Folder paths are supported in preflight mode; the ordinary import command takes files. Importing runs validation again against the current repository, so a previously clean report cannot bypass subsequent source/repository changes. If every file is `DUPLICATE`, no import is needed.

To resolve a blocked batch, share the report with **“Use TEAM-DATA-PROMPT.md to review these preflight issues”**, along with the original captures. Correct parser support or source-backed metadata rather than deleting unfamiliar plays. The scanner recovers at recognized and likely result-heading boundaries; heavily malformed records may hide dependent details, and planning reports the first semantic conflict per selected team. Recheck the whole batch after corrections. Preflight improves coverage and diagnosis; it does not infer missing scoring decisions or guarantee support for every future format.

## Quick start

Open Terminal and enter the project directory:

```sh
cd /Users/smbambling/Documents/personal/git/github/diamond-scout
```

First preview an import. Replace the example filename with your downloaded capture. You can drag the TXT file from Finder into Terminal to insert its path.

```sh
node tools/import-plays.cjs "$HOME/Downloads/gamechanger-plays-2026-10-24.txt"
```

The preview prints per-team PA, pitch, contact, hit and running-event totals, plus source limitations. **Preview changes no files.** Review the notes, then run the same command with `--write`:

```sh
node tools/import-plays.cjs "$HOME/Downloads/gamechanger-plays-2026-10-24.txt" --write
```

This appends each side to its own history, creates new team files as needed, and updates `teams.json`. Existing selector order and existing records are preserved. Refresh Diamond-Scout afterward to load the updated repository JSON. Nothing is published or uploaded.

## Several games at once

Use one TXT file per game. Pass several paths, or a shell wildcard that matches only the games you intend to import:

```sh
node tools/import-plays.cjs "$HOME"/Downloads/gamechanger-plays-2026-10-*.txt
node tools/import-plays.cjs "$HOME"/Downloads/gamechanger-plays-2026-10-*.txt --write
```

All supplied files and both sides are planned and validated before live team files change. If any file contains an unsupported description or possible overlapping game, the batch stops before saving. Identical games already present are skipped. A filename ending in `-2` is not assumed to be a duplicate or a second game: the source plays and game metadata determine that.

## Input and metadata

The [capture bookmarklet](README.md) produces the expected format:

```text
Use TEAM-DATA-PROMPT.md to add this game
Import: both teams (default)
Date: 2026-10-24
Start time: 08:30
Timezone: ET
Source: https://web.gc.com/teams/.../schedule/game-event-id/plays
Capture coverage: loaded browser text only; completeness not verified.

PLAY-BY-PLAY
Bottom 1st - Team B
...
Top 1st - Team A
...
```

Plain pasted Plays text with inning headings also works. Missing dates, times and timezones stay null. The converter does not infer a year from a filename, season, weekday or current date. It retains a supplied timezone label without converting it to UTC or assuming an IANA zone.

If needed, supply explicit metadata on the command line:

```sh
node tools/import-plays.cjs "/path/to/plays.txt" --date 2026-10-24 --time "8:30 AM" --timezone ET
```

Command-line metadata overrides the capture fields and **applies to every input file in that command**. Omit overrides when batch files already contain their own dates/times. Use `unknown` to clear an uncertain value. Same-day rematches need distinct start times or event identifiers; uncertain overlap stops for review.

The default input order is **newest first**, matching GameChanger Plays and the supplied captures. For text arranged chronologically, use `--order oldest-first`; this changes ordering within innings as well as between them. Mixed or repeated inning headings stop for review. For a one-inning excerpt, ordering cannot be detected reliably: choose the option matching the actual text.

For a one-sided capture, add `--opponent "Opponent Name"` if known. Without it, the opponent is explicitly labeled `Unknown opponent`; the missing opponent's roster/history is never created. Both teams are imported whenever their plays are supplied.

## Team selection and names

To deliberately import only one supplied side:

```sh
node tools/import-plays.cjs "/path/to/plays.txt" --team "Shockers 14U" --write
```

The captured directive `Import: only Shockers 14U` also works. A command-line `--team` overrides that directive. Team names or existing team IDs are accepted; the requested team must appear in the inning headings.

Existing teams and players are matched by name with case, whitespace and typographic-quote normalization. There is no fuzzy identity matching. If a team has changed its displayed name, explicitly map it to the correct existing ID:

```sh
node tools/import-plays.cjs "/path/to/plays.txt" --team-alias "Shockers Fall 14U=shockers-14u" --write
```

Repeat `--team-alias` for multiple team names if needed. Distinct names that would create the same ID stop for review. Player spelling changes and ambiguous player identities should be resolved with **“Use TEAM-DATA-PROMPT.md to add this game”** rather than automatically merged.

## Preservation and review limits

Supported Plays descriptions include hits, walks, HBP, strikeouts, fair outs, errors, fielder choices (including FC double plays), ordinary double plays, sacrifices, infield flies, explicit foul catches, catcher interference, dropped third strikes, unfinished `at bat` records, explicit steals/caught stealing/unknown-result attempts, courtesy/pinch runners, and standalone runner outs. It retains the full supplied play text, original pitch lines and record context, including nonbreaking spaces. Multiple identical PA descriptions remain separate appearances.

Unfinished `Name at bat` records may include listed pitches and runner context. Those pitches are retained on the incomplete PA with their original sequence; no result, AB or contact is invented. Unrecognized following text still blocks import. The August 29 Tigers/Vols regression includes Liam Clark at bat with two recorded balls. Verify with `node tests/incomplete.cjs`.

- A double play remains one contact. Throws between fielders do not add contacts. Fair contact includes outs, errors, sacrifices and fielder choices.
- A `Batter Out` heading with `Name out (other)` is retained as its own completed PA with result `batter_out` and `reached_base: false`. Every listed pitch is kept. The unspecified ruling does not establish an official AB or contact classification: no batted-ball location/type is invented, the report flags `unclassified_batting_results`, and the app keeps full-selection rates unknown. Scout/Field can display separately marked stats from classified completed PAs, with their coverage stated; source review is still needed to resolve the full-selection totals. An `In play` token alone does not supply the missing out/contact description.
- Foul catches stay separate from fair contacts. A listed `In play` terminal pitch attached to an explicit foul-catch ruling is classified `foul_out`, retaining its original text. Fair catcher popups are not assumed foul.
- Recorded pitches stay in order. An omitted HBP/terminal pitch is not added. Missing or contradictory count evidence produces null counts and a note, without dropping pitches. Unrecognized pitch tokens, including unsupported foul-bunt wording, stop the import.
- `Balk` and `Balk by pitcher [name]` are preserved as non-pitch context. They do not change ball/strike counts or add pitches, PAs, contacts or steal attempts; explicitly listed runner advances/scores remain in the source context.
- Broad fielder descriptions remain broad. Explicit supported line/gap/depth descriptions can provide finer metadata; no trajectory, depth, fielder or landing location is invented.
- Explicit runner replacements and attempts are linked to recorded on-base trips when available. Multiple attempts on one trip retain separate attempts and share the trip link. Missing trip evidence stays unlinked with a warning; the app withholds steal tendency when required evidence is missing. Pickoffs and passed-ball/wild-pitch advances are not automatically steals.
- `Name gets placed on 1st/2nd/3rd` creates a `placed_runner` entry and a new recorded on-base opportunity. It adds no PA, pitch, hit or automatic steal. Later attempts use `runner_entry_id` to link to that opportunity, including a steal occurring in the same PA as the placement. A subsequent courtesy/pinch replacement shares the opportunity using `replaced_entry_id`; team totals count it once. Use the updated `index.html` so the app recognizes these new entries, and refresh after importing.
- `Name is intentionally walked` is a walk award. Retain just the listed pitches, even if fewer than four balls are shown; no missing pitches are manufactured.
- Comma-separated defensive throws immediately following a runner-out/caught-stealing event are retained as part of that event's context (for example, `Wesley Hurt caught stealing 2nd, catcher Gunnar Ronan to second baseman Atticus Johns`). They add no pitch, batting appearance, fair contact or second steal attempt. An unrelated or unrecognized fielding fragment still stops for review. A source-explicit `bunts out` is a ground-out result with bunt contact.
- Standalone pickoffs can end an inning during an unidentified batter's unfinished turn. Keep the out in `runner_outs` with reason `picked_off`; any explicitly listed pitches are stored on that record with `batter_id: null` and original `source_pitch_sequence`. They count toward team/game pitch totals, and the report separately lists `runner_only_pitches`. They do not create a PA, count as steal attempts, or enter player-specific pitch/first-pitch/average-pitches-per-completed-PA denominators. Courtesy-runner context is preserved before applying the out.
- Name suffix commas (`Christopher Belcher, Jr.`, `Sr.`, `II`, `III`, `IV`) remain part of names during pitch/context and narrative tokenization. `Outs changed to 0/1/2/3` is retained as scoring context without adding a pitch or changing the ball/strike count.
- Source URLs are sanitized to origin/path. Event IDs from schedule URLs help distinguish games. Identical full play sources are skipped even if whitespace changed. New metadata on a skipped duplicate is not applied; known conflicts stop. **Corrections, expanded partial captures and uncertain overlapping sources require review with TEAM-DATA-PROMPT.md.** This utility appends new games; it does not merge or replace an existing game's PAs.
- Unknown descriptions, conflicting result labels, unrecognized runner/steal forms, player ID collisions, and navigation/footer leftovers stop the import. Keep the original capture and use the data-update prompt to resolve them. There is no option to force an import by dropping unrecognized lines.

This is a deterministic parser for the supplied GameChanger text formats, not a general natural-language interpreter. It cannot prove that a loaded-browser capture includes the full game or that source scoring is correct. The report reconciles what was supplied. It never manufactures later innings, a final score or missing pitches. Check the preview against the source, particularly unfamiliar wording and partial captures.

## Backups and recovery

Every successful `--write` with changes prints a folder under `work/import-backups/<timestamp>/`:

- `before/`: exact previous bytes of every changed existing JSON file.
- `after/`: candidate JSON files saved by this import.
- `sources/`: copies of all input capture text, including original metadata.
- `report.json`: imported/skipped games, counts, warnings and changed paths; `existed` identifies files that were present before the import.

To undo an import, restore the listed existing files from `before/` to their original project paths, and remove only the new files whose report entries say `existed: false`. Restore `teams.json` along with team histories. Do not restore an older backup over later imports you intend to keep; review those changes first.

The writer stages every candidate, writes histories before the manifest, checks for intervening file edits, and rolls back completed replacements if an ordinary write fails. A process lock rejects concurrent imports. A power loss or forcibly killed process can interrupt a multi-file write; use the printed backup/report for recovery. If `.import-plays.lock` remains after an interruption, verify no importer is running and review recovery before removing it.

## Checks

```sh
node tests/import.cjs
node tests/preflight.cjs
node tests/capture.cjs
node tests/verify.cjs
node tests/ui.cjs
```

Importer tests write only to temporary projects. They reconcile original pitch/contact data against the archived August/September sources, independently check October 25 totals and unusual results, and exercise batch import, duplicates, rematches, aliases, source preservation, invalid inputs, write failure/rollback and backups. No check logs into GameChanger or proves capture completeness. Existing app tests also require their documented history fixtures to remain available.

Preflight checks cover multiple errors in one play and multiple files, recovery after unknown headings/invalid metadata, original Unicode/line context, team scope, duplicate and conflicting batch inputs, partial-existing-team imports, broken project/input files, every archived capture, folder scanning, report protection, exit codes and unchanged real runtime files. Reports/tests are local; nothing is uploaded.

Run `node tools/import-plays.cjs --help` for all options. Local history summaries printed in README are dated snapshots, not automatically regenerated totals; the app and import report use the JSON data.

Play-edit support retains `(Play Edit) Name in for Name` as original scoring context; it does not silently rewrite a prior batter identity or invent a substitution type. If an associated courtesy-runner entry cannot be linked because the edit conflicts with the recorded reach, `unresolved_trip: true` withholds the opportunity denominator pending source review. `Score changed to N-N` is non-pitch context and does not establish a final score. `Inning Ended / Half-inning ended by scorekeeper` is retained in game `source_control_events`, without a fabricated PA or runner out. Caught-stealing attribution may name a single fielder as well as a throw chain.

Runner-only blocks can contain several distinct events. The importer processes their context in source order: steals (including home), caught stealing, pickoffs and other explicit outs remain separate. Each runner out has its own record and source excerpt; the shared unknown-batter pitch sequence is stored once on the final out, with the complete block retained in source_events. A pickoff never becomes a steal attempt, and the complete sequence is never passed to the single-event steal classifier.

## Missing player names

Supported result descriptions without a batter name (for example, `grounds into fielder's choice ...`, `is hit by pitch ...`, or `strikes out looking ...`) retain their real PA, result, pitches and contact. Each receives a separate explicitly labeled **Unidentified batter** roster placeholder with `identity_status: unidentified`, a game-scoped ID and source-game reference. A display placeholder is not a recovered name: do not combine unidentified appearances or match them to a named player without confirmation. Raw descriptions and captures remain unchanged.

An explicit steal with no runner name (such as `steals 2nd`) is retained under its own **Unidentified runner** placeholder, with no guessed on-base-trip link. It counts toward team attempts, but the unresolved link withholds team steal tendency. The missing-name conditions appear as report notes. Unsupported descriptions and contradictory heading/result combinations still block imports; this support does not ignore arbitrary text.

`node tests/unidentified.cjs` covers the September 20 Arlington/Tigers source, both-team temporary writes, repeat-import deduplication and unknown-identity separation. Correct identities later only from supplied evidence; preserve the original source and audit the correction.



## One-click combined game capture

Replace the bookmark from the reloaded `tools/gamechanger-capture.html` installer. Open the intended signed-in GameChanger game and click **Capture GC data** once. It reads Plays and Box score in a temporary visible same-origin window and downloads one `gamechanger-game-<date>.json` file after review. No inning expansion is required. The current page remains open; no private API, credentials, cookies or browser storage are read. Cancel removes the the temporary window.

```sh
node tools/import-plays.cjs /path/gamechanger-game-2026-10-25.json
node tools/import-plays.cjs --preflight /path/gamechanger-game-2026-10-25.json --report work/preflight/combined.md
node tools/import-plays.cjs /path/gamechanger-game-2026-10-25.json --write
```

Normal import and preflight accept multiple game JSON captures alongside legacy Plays TXT files. Folder preflight discovers TXT files and `gamechanger-game-*.json` / `gamechanger-boxscore-*.json`, ignoring unrelated JSON. Game IDs, teams and known metadata must agree between screens. The importer routes the combined file through the existing Plays parser and box-score reconciliation without duplicating PAs, changing source results or guessing corrections. Original combined JSON, extracted plays and box-score evidence are included in write backups.

Capture waits for rendered screens to settle, with a bounded timeout per screen, but does not certify completeness. Both first-inning halves, team names, dates and table counts are checked or shown for review. Notes-only/canvas table warnings remain attached. Live capture-window loading and authenticated DOM compatibility are not verified in this environment. If the capture window is blocked, use **Capture current screen only** in the progress dialog and follow the separate-screen fallback below. No automatic full-game success is claimed when a screen cannot be read.

`node tests/combined-capture.cjs` covers sequential capture with simulated readers, wrong-route/event/team/metadata guards, explicit year confirmation, partial warnings, bundle processing, backed-up writes in temporary projects, preflight and duplicate detection. Browser loading, cancellation and rendering still need a live check.

## Separate-screen box-score fallback

Replace the existing bookmark from the reloaded `tools/gamechanger-capture.html` installer. Existing bookmarks retain old code. The updated **Capture GC data** bookmark recognizes `/plays` and `/box-score` automatically.

1. On Plays, load the innings and download the usual TXT capture.
2. On Box score for the same game, load both teams and click the bookmark. Download the separate `gamechanger-boxscore-<date>.json` file. Date/start time detection and explicit confirmation of a season-suggested year work on both pages.
3. Review the table counts and warnings. The helper reads rendered HTML/ARIA table cells directly, even when copy/paste omits them. It also captures team note entries. Canvas-drawn or unrecognized tables cannot be recovered as text: a notes-only export is explicitly marked incomplete. It makes no private API calls, reads no cookies/browser storage, and excludes navigation/account text from the box export.
4. Preview the pair, then use `--write` only when ready:

```sh
node tools/import-plays.cjs /path/plays.txt --box-score /path/boxscore.json
node tools/import-plays.cjs --preflight /path/plays.txt --box-score /path/boxscore.json --report work/preflight/with-box.md
node tools/import-plays.cjs /path/plays.txt --box-score /path/boxscore.json --write
```

Repeat `--box-score` for multiple games; supply the Plays files as the normal positional arguments. Sidecars are matched by source game event ID, never just filenames or dates. Conflicting known metadata, mismatched games, malformed rows or changed already-attached box scores stop the operation. Both-team and `--team` selection still apply to the Plays capture. The box score does not independently add teams or games.

The converter stores the original box JSON and source digest on the matched game as `box_score`, together with comparisons and review notes. It can attach evidence to an already-imported identical play capture without duplicating PAs. Repeating the same pair changes nothing. The existing locked, backed-up batch write procedure includes sidecar sources.

Batting comparisons cover supported supplied AB, H, BB, SO, HBP, TB, SB, CS and sacrifice/extra-base-hit counts. Player identity must match uniquely after stripping source jersey/position annotations; there is no fuzzy identity matching. Unknown/omitted values are not converted into zeros. Runs, RBI, errors and raw pitching tables/notes are retained as evidence, but are not reconstructed or used to create a pitching tab. Incomplete capture stages can cause legitimate differences; matching supplied totals does not certify completeness.

A scoring conflict is reported for review, without changing PA results, contacts, pitches or current app calculations. Example: the supplied BBA game credits Brian Gribbin with a double in the box score, while the Plays text records a single plus an advance on the throw. The preview flags 2B and TB differences. Resolve such differences through a confirmed correction with an audit trail; do not edit source text or silently manufacture a replacement event.

`node tests/box-score.cjs` exercises DOM table extraction, notes-only/canvas warnings, source scoping, the supplied screenshot transcription, substitutions, sacrifice/steal note formats, paired temporary writes, duplicates, mismatched events, malformed rows and preflight reporting. Live signed-in GameChanger DOM compatibility is not yet verified. If the bookmark finds zero tables, retain the screenshots and provide its JSON output for further layout support; the screenshots alone do not establish GameChanger's DOM structure.

### Capture fixes after live feedback

The capture helper now follows each team heading through lineup/pitching rows and team totals before associating notes, rather than assuming the preceding line is a team name. Known Plays teams and visible team links can anchor box sections. Numeric/stat-heading lines cannot become team names.

Automatic capture no longer uses hidden frames. A temporary visible window opens directly from the bookmark click, loads the normal Plays and Box score pages sequentially, and is closed after capture/cancellation. Keep that window open; permit this capture window if the browser blocks it. Blocked/closed windows are reported immediately, and loading has an 18-second timeout per screen. The original game stays open. Separate-screen capture remains available from the progress dialog. Replace the saved bookmark from the reloaded installer and close any old capture dialog before testing. Live window/session and box-table compatibility still require a browser check; automated tests cover numeric rows between team headings and notes, route/metadata guards, readable simulated windows, blocked/closed/cancelled windows and a bounded timeout.
