# Diamond-Scout

## Full-width metric details

The introductory tap-instruction text is omitted; the information icons identify expandable metrics.


AVG, OBP and SLG expand directly below the first batting row, pushing H / AB, BB% and K% down together. BB% and K% expand below the second row. The detail panel remains full-width and only one metric is open at a time.


Metric details open in a full-width panel below the approach or batting group, rather than inside individual narrow columns. Only one metric is expanded at a time across these groups. Tap the active metric again to close it. Short labeled count columns keep the cards aligned: Attempts / Stolen / Caught (plus Unknown when recorded), Doubles / Triples / Home runs, or the relevant count and sample. Buttons expose their expanded state and associated panel to assistive technology and retain keyboard focus after switching details. Team, batter and game changes close the panel. No data or calculations changed. UI-model checks cover opening, replacement, closing and count evidence at 320px and 430px; no new visual browser verification was available.

## Quick-glance statistics and details

Expandable metrics use a small circled information icon, keyboard focus styling and a pressed background. Labels and values are not underlined. The full metric button is a touch target of at least 64px. Plain H / AB has no information icon or disclosure.

The approach row contains ground-ball rate, line-drive rate, first-pitch swing and steal tendency in four columns. Ground balls and line drives are plain, non-expandable tiles with contact-count / total-fair-contact fractions beneath the percentages. First-pitch swing is also non-expandable, with swings / tracked-first-pitches underneath. Their information icons are removed. Fair-contact denominators include outs, errors and sacrifices as well as hits, and do not change with the contact-type filter. A zero denominator shows a dash. Steal details contain only total attempts and SB/CS counts, plus explicitly unknown outcomes when supplied. Formulas and attempts/game are omitted from this quick-glance screen; missing trip evidence remains marked for review.

Batting disclosures show count evidence for AVG, OBP, BB% and K%. SLG expands to extra-base-hit counts split into doubles, triples and home runs. Partial-stat asterisks and coverage remain in place when an outcome is unresolved. The batter sample is abbreviated to PA and game counts, with incomplete appearances separately identified. These are recorded observations, not predictions.

Verified with data checks and UI models, including 320px and 430px. No fresh browser rendering review was available for this update.

## Current interface: Hitting and Pitching

Hitting and Pitching are the only tabs. Approach, Field, History and Scouting guide and their dedicated navigation, controls, styles and renderers have been removed. Hitting retains first-pitch swing, whiff rate, pitches per PA, batting rates, steals, contact profile and the field map. Pitching retains the summary, leader cards, expandable strike/strikeout details and recorded pitch outcomes chart. Original source evidence, game histories and shared calculations remain intact.

UI checks exercise both surviving views, including batter/game/contact filters, metric expansions and pitching selectors. These are DOM-model checks, not a fresh browser visual review.

## Repository layout and hosting

- `index.html`, `teams.json`, and `data/`: the complete runtime app. CSS, JavaScript, logo and field artwork are embedded in `index.html`.
- `tools/`: local capture, conversion and preflight utilities, with their instructions.
- `tests/`: automated checks; `tests/fixtures/` holds preserved source captures and fixed regression snapshots.
- `TEAM-DATA-PROMPT.md`: future game-update workflow. Say **“Use TEAM-DATA-PROMPT.md to add this game”** when providing plays.
- `work/`: local-only backups, importer recovery copies, reports, previews and archived design images. This entire folder is ignored by Git and is not required to run the app or tests.

The directory has not been initialized as a Git repository as of the October 29 cleanup. The `.gitignore` keeps local work, macOS metadata, optional dependencies, environment files and the importer lock out of a future repository. Ignoring files does not remove them from Git if they were previously tracked; review the staged file list before committing. Keep recovery backups until you no longer need them; do not delete an active importer lock.

For static hosting, publish only `index.html`, `teams.json` and the complete `data/` folder, preserving those relative paths. The app needs no compilation, package installation or Node server in production. A `.gitignore` controls Git tracking, not what a static server exposes: serving the whole repository can also expose development tools and fixtures. Use an explicit hosting file selection or a separate publication folder. Every JSON served by a public site, including its retained source text, is publicly downloadable.

Run all checks from the project root before committing:

```sh
node tests/verify.cjs
node tests/ui.cjs
node tests/import.cjs
node tests/preflight.cjs
node tests/capture.cjs
```

The cleanup moved source captures into `tests/fixtures/captures/` and copied the required pre-import snapshot into `tests/fixtures/`, so no tests require ignored backups. Historical Shockers assertions now use a fixed, source-backed four-game fixture; the data checks still validate every current manifest team. Expected historical totals have not been changed to match newer imports. All five checks passed after cleanup. UI checks use a DOM model; this cleanup did not include a new visual browser review. Runtime HTML, manifest and team JSON bytes were unchanged.

The remaining sections include historical development notes. Counts labeled as current in those older notes describe the data at the time of that change, rather than a live inventory.


A buildless, field-first baseball scouting app based on the approved Navy & Ice phone mockup. The simple diamond logo and colored fielder circles are inline SVG. The original natural green field PNG from Diamond Defence is embedded once in the HTML, with its colors and image bytes unchanged. Navy & Ice is the only app color scheme. Team history stays in JSON.

## Runtime files

| File | Purpose |
| --- | --- |
| `index.html` | Hitting and Pitching summaries, and all inline styling, embedded field artwork, vector labels, and JavaScript |
| `teams.json` | Team selector entries and paths to team-history files |
| `data/shockers-14u.json` | Shockers 14U player and game history |
| `data/gambrills-athletic-club-14u.json` | Gambrills Athletic Club 14U player and game history |
| `data/stars-camarata-14u.json` | Stars Camarata 14U player and game history |
| `data/dig-in-gribbin-14u.json` | Dig In (Gribbin) 14U player and game history |
| `data/bba-14u-east.json` | BBA 14u East player and game history |

Upload `index.html`, `teams.json`, and every team-history JSON listed in the manifest (currently the seven runtime files above), retaining the `data/` folder, to any static web host. There are no external scripts, fonts, packages, API keys, accounts, or build steps required. Team data is fetched from the same site. Anyone who can access your hosted JSON URLs can read their contents; these files do not implement access control.

For a local web preview from this directory:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8000`. Stop the server with Ctrl+C. The app automatically fetches `teams.json`, selects the first team, and reads its listed team-history JSON. It reads only project files served by the same site, with no upload or manual file-selection flow. Opening `index.html` directly with a `file:` URL cannot fetch adjacent JSON in a normal browser; the page explains how to start the local preview instead.

## Appearance

**Navy & Ice** is the fixed palette: off-white (`#F4F6F8`), white cards, deep navy (`#0A192F`) text, slate supporting text, and blue (`#0052CC`) selections and actions. There is no theme selector, alternate palette, saved appearance preference, or theme-switching JavaScript. Browser dark-mode preferences do not change the app palette. Earlier saved theme preferences are no longer read. The Filters panel now contains only Game and Contact type.

The fixed **Field Natural** heat scale uses neutral blue-gray for 0%, sage green for 1–24%, honey yellow for 25–49%, apricot for 50–74%, and coral for 75–100%. Zero-contact markers use `#DDE5ED`, visibly separated from observed contact; the remaining colors are `#88B594`, `#D9BC68`, `#E69759`, and `#DA6860`. Label colors are checked for contrast on every circle fill. The field uses the original 1536 × 1024 natural green Diamond Defence artwork, including its grass texture, dirt, fence, bases, mound, and home plate. The unchanged image bytes are presented at 82% opacity against the white card for a softer backdrop. The artwork is presented slightly taller, with more space between fielder labels. There is no tint or recolored image asset. The logo has a continuous rounded upper curve matching the approved mockup. Grass stripes, the dirt infield, bases, and foul lines are decorative orientation landmarks; they never change based on data. Only circle colors change with contact share. There is no heatmap palette selector.

Historical layout backups remain in `work/backups/`; they are not runtime files. The version before the uniform statistics block is `work/backups/index-before-unified-stats.html`.

## Using the workspace

The app opens on **Scout**, initially showing the entire team. Scout stays in one centered column, up to 560px wide, with the core scouting information grouped above and within the field. Short screens can scroll to preserve readability. The prominent batter selector is shared by all four views. Team selection is always available. **Filters** expands the game and contact-type controls; the current game and any active contact filter remain summarized when the controls are closed.

- **Scout:** one uniform statistics block above the field. Its first three-column row shows **Ground balls**, **1st-pitch swing**, and **Steal tendency**; the next two rows show **AVG / OBP / SLG** and **H / AB / BB% / K%**. All nine metrics share centered labels, matching number sizes, and consistent spacing. A thin divider separates tendencies from batting results. Steal tendency shows the **percentage of recorded on-base trips with at least one steal attempt**, with the trip fraction underneath (for example, `16%` above `11/70 trips`). Multiple attempts on one trip count once. Total attempts, SB/CS, unknown results and attempts per game are available by tapping. A known denominator with no recorded attempts shows `0%`; no trips, unknown reach status or missing trip links shows a dash instead of a guessed percentage. Tap a top-row metric for its sample counts and definitions. Each field circle contains a small position label, a prominent percentage, and a smaller contact count below; the total fair-contact count sits at the lower right. The percentage and color use that total as their denominator, including unknown fielders. The expand control opens **Field**, retaining selections. Recorded outcomes are in **Approach**. Recent appearances and the full-history shortcut remain removed from Scout.
- **Field:** the larger field with the same batting strip, five-band legend, explicit source-described areas only when supplied, and additional contact summaries. The redundant map explanation and **Read all fielder totals** table are removed. Unknown-fielder counts remain in the map header and all denominators. Foul catches use a separate collapsed section and denominator only when the current selection contains caught foul balls; the section and zero-count statistic are otherwise hidden. The **Batter gallery** stays collapsed by default, includes every player, and follows game/contact filters. Selecting a batter card retains the current view; **Entire team** clears the batter selection.

Contact filters affect both field diagrams, fielder evidence, separate foul summaries, and the gallery. **All contact** shows fair contact with separate foul information; **Fair contact only** and **Foul catches** isolate those categories. Ground/line/fly/bunt/unknown filters apply to fair and foul contacts. They do not change Quick read, recorded outcome, batting, Approach, or History denominators. Game and batter selections apply throughout.

A failed team load retains the previous valid team and its recovery selector. **Refreshing the page automatically reloads `teams.json` and team history** with `cache: 'no-store'`. All data updates happen in the project JSON files; the app never writes files.

## Scout statistics

Recorded outcomes in **Approach** use completed plate appearances only. Strikeouts looking, swinging, foul-tip strikeouts, and dropped-third-strike results are grouped as **Strikeout** in the summary; original results and all source detail remain in History. Rows sort by descending count, then result key for ties. A maximum of three rows is initially visible; it does not imply that a tied outcome is more likely than another. Expand the list to see all results. Incomplete PAs remain in History and are explicitly excluded from the outcome denominator.

AVG = hits / at-bats. OBP = (hits + walks + hit-by-pitches) / (at-bats + walks + hit-by-pitches + sacrifice flies). SLG = total bases / at-bats. Walks, hit-by-pitches, sacrifice flies, sacrifice bunts, and catcher’s interference are excluded from at-bats. Catcher’s interference is also excluded from the OBP denominator; it is neither a hit nor a walk. If a completed result cannot be classified, full-selection rates and official at-bats remain unknown. Scout and Field instead show a separately calculated summary of classified completed appearances, marking all six batting labels with an asterisk and stating its coverage (for example, 160 of 161 completed PAs). The unresolved PA remains in total appearances, outcomes and History; it is not guessed into an AB or removed from the data. BB% = walks / completed plate appearances; K% = strikeouts / completed plate appearances. For a marked partial summary, both denominators use only classified completed PAs. No classified PAs or a zero denominator displays a dash. Fully classified selections have no asterisk or coverage note.

Field counts summarize all fair contact, rather than just base hits. For example, in the two games recorded before September 13, Blake Weber has one hit in three at-bats: a single recorded to 1B and groundouts to 2B and SS. His field therefore shows three contacts, while H / AB shows `1/3`. Walks and hit-by-pitches do not add at-bats or fair contact.

The sample badge warns when fewer than ten fair contacts are available. This is a display caution, not a statistical confidence estimate or a prediction. The map includes **all fair contact**: hits, outs, errors, sacrifices, fielder’s choices, and one contact per double play. Unknown fielders remain in the denominator. No handedness, ball trajectory, pitch location, or defensive shift is inferred.

## Steal tendency

The main percentage is **recorded on-base trips with at least one steal attempt / recorded on-base trips**. It describes observed steal tendency while the player was on base. The smaller fraction shows trips with an attempt / all recorded trips. A runner who attempts second and third during one trip contributes one trip to the numerator, so the percentage stays between 0% and 100%. Both caught-stealing and unknown-outcome attempts count as attempts, independently of success. This is different from successful steals / attempts and from raw attempts / on-base visits.

Tap for total attempts, SB, CS, unknown attempt results, on-base evidence, games and attempts per game (rounded to one decimal). No recorded attempts with a known positive on-base count shows `0%`. No visits shows a dash. A missing attempt-to-trip link or an ambiguous completed reach withholds the percentage; known counts remain in the disclosure. Older team files without trip links still load and retain raw attempt counts, but cannot provide a complete tendency percentage until the links are supplied.

Recorded on-base visits include singles, doubles, triples, walks, HBP, reached-on-error results and fielder's choices (including a fielder's-choice double play where the batter reaches), plus explicit catcher’s-interference awards. Home runs (including inside-the-park home runs), ordinary outs, sacrifices, and incomplete PAs do not add a visit. An explicit `reached_base` classification can resolve an otherwise ambiguous completed result, such as a dropped third strike. An unclassified completed result or unknown reach status withholds the denominator; the known visit count remains in the disclosure. The percentage is an observed proportion of trips, not a prediction for a particular base, count, pitcher or game situation, and does not establish whether the next base was open.

Attempts and visits follow the selected team, player and game, independently of contact-type filters. Games are distinct selected games with a PA, explicit runner entry or steal event for the selected player; a roster entry alone does not establish participation. **Entire team** uses team evidence across the selected games. A zero visit count shows a dash instead of dividing by zero. No participation withholds the per-game rate.

Explicit courtesy- and pinch-runner entries count as an on-base visit for that runner. Link an entry to the replaced player's original reach when available: both players can have evidence of participating in the same trip, but the team denominator counts the trip once. The Aug 30 source explicitly names **Nate Henson in for Will Suettinger**; Nate has two batting reaches plus this courtesy entry in that game. The team still has 23 trips, rather than double-counting the replacement. Standalone entries whose original reach is outside the supplied history retain their own stable visit identity.

An explicitly placed runner (for example, `Deven Downs gets placed on 2nd`) starts a separate on-base opportunity, without a plate appearance, hit, pitch or steal. A subsequent recorded attempt links to that placement. The team's and runner's opportunity counts include it, since the runner can attempt a steal from that base. A courtesy/pinch runner replacing an entry-backed runner shares that original team trip through `replaced_entry_id`. This counts observed running opportunities, rather than official times reaching base through batting.

The current Shockers history shows **16%**, with **11/70 trips** underneath. Its 12 attempts include two attempts on the same Jackson Zangrilli trip in the Metro game. Jackson shows **44%** (4/9 trips), Gambrills **13%** (2/15 trips), and Stars Camarata **27%** (3/11 trips). The expanded details retain 3.0, 1.3, 2.0 and 3.0 attempts/game respectively. These are recorded samples, not complete career or season coverage. The Shockers' Aug 30 attempts belong to Keaghan Galotta-Withrow, Jackson Zangrilli and Bryce Ziegler (one each); Sep 13 adds two for Jackson and one each for Logan Sumrow, Bryce Ziegler and Blake Weber. Sep 12 adds four Shockers attempts: two by Jackson Zangrilli, one by Logan Sumrow and one by Keaghan Galotta-Withrow. Gambrills records one successful steal of second each for Bodie Sanders and Wesson Shepherd. Stars records one each for Lincoln Lee, Logan Pinkerton and Mark (“Trey”) Poncy. Dig In records four attempts on three trips, including Declan Class stealing both second and home on one trip; its tendency is **38%** (3/8 trips). BBA has **0%** observed tendency (0/15 trips) in the supplied capture. No caught-stealing events were supplied.

Only explicit steal attempts count. Pickoffs, pickoff attempts, passed balls, wild pitches, defensive indifference, ordinary advances, and substitutions are not assumed to be steal attempts. Missing runner events are not inferred; zero means zero observed attempts in the supplied history. Runner metadata never adds a PA, pitch, fair contact or hit. Original source descriptions and pitch sequences remain intact.

## Included history

The initial history contains **only the Shockers' batting side** of the supplied game against Rawlings Tigers NOVA Black 14U: 26 completed plate appearances, 104 recorded pitches, 19 fair balls put in play, and 5 hits. Every Shockers batter is listed, including those with no fair contact.

The original Tigers game's date was not supplied and remains `null`. The page does not assume that the pasted game was played on the date this project was created. It does not assume a final score. Opposing pitchers are named only where explicitly identified by the play description; missing names remain unknown. Runner events in pitch sequences are not extra pitches. The uncompleted bottom-seventh Tigers appearance is not part of this team's history.

Shockers history now includes:

| Game | Complete PAs | Incomplete PAs | Recorded pitches | Fair contacts | Hits |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tigers NOVA Black 14U — date unknown | 26 | 0 | 104 | 19 | 5 |
| Gambrills Athletic Club 14U — Aug 30, 2026, 10:00 AM | 34 | 1 | 129 | 16 | 6 |
| Stars Camarata 14U — Sep 12, 2026, 8:30 AM | 32 | 1 | 90 | 22 | 7 |
| Metro Senators 14U Central — Sep 13, 2026, start time unknown | 32 | 1 | 103 | 26 | 12 |
| **Total** | **124** | **3** | **426** | **83** | **30** |

The Gambrills game adds Kenyon Whitmore to the existing roster. Its source stops with Kenyon at bat in the bottom fifth; that incomplete appearance has no supplied pitches or result. Three hit-by-pitch results omit their terminal pitches from the listed sequences, so those pitches were not invented. The source provides no final score or timezone. The original complete play-by-play is retained in the game record for audit, while only Shockers batting appearances contribute to this team's statistics.

The September 13 game against **Metro Senators 14U Central** adds 32 complete PAs and one incomplete Logan Sumrow appearance in the bottom sixth. The recorded source covers completed Shockers batting through the fifth. Its 103 recorded pitches are split 24, 19, 33, 11, and 16 by innings 1–5. The 26 fair contacts include the sacrifice bunt, sacrifice fly, four fielder's choices, and a bunt single. Twelve hits include Logan Sumrow's double and inside-the-park home run, plus Bryce Ziegler's triple. Five successful steals are attributed to their runners independently of the batter at the plate. No completed result, pitch, or final score was inferred for the unfinished appearance. The user supplied the full date; start time and timezone remain `null`.

Two identical attached copies of the September play-by-play were imported as one game. Existing game, player, PA, pitch, and baserunning records and their IDs are unchanged. The complete supplied source and its SHA-256 digest are retained in the game record. A local recovery copy is `work/backups/shockers-before-sep13-2026.json`. Immediately after the Sep 13 import, the history had 94 PAs (92 complete and two incomplete), 336 recorded pitches, 61 fair contacts, 23 hits, and eight explicitly recorded successful steals across three games. No new players or manifest entries were needed.

No supplied Shockers PA description explicitly identifies a catch in foul territory. The history has not been retroactively reclassified; foul-catch support applies when the source supplies that information.

Gambrills Athletic Club 14U is now available as a separate team in `teams.json`. Its August 30, 2026, 10:00 AM game against Shockers has **27 complete PAs, 81 recorded pitches, 21 fair contacts, nine hits and two successful steals**, with 11 named batters. Top innings 1–5 contain 21, 11, 12, 11 and 26 recorded pitches. Noah Heavel's line-drive double play remains one contact to SS. Grady Kurtz's HBP result omits its terminal pitch; only its two listed balls are retained. No timezone, final score, missing pitches, precise ball locations or foul catches were inferred.

The latest supplied August source exactly matches the source already retained by Shockers. No Shockers games, PAs, pitches or steal events were duplicated or corrected. Gambrills was added once in `data/gambrills-athletic-club-14u.json`, with one manifest entry appended after Shockers to preserve the default selection. These per-team totals are separate: Shockers now has 127 PAs (124 complete and three incomplete), 426 pitches, 83 fair contacts, 30 hits and 12 recorded attempts across four games. The one added courtesy-entry record is metadata for an already supplied substitution.

The **September 12, 2026, 8:30 AM** source adds both Shockers and **Stars Camarata 14U**, stored separately. The year follows the established 2026 history; September 12, 2026 falls on Saturday. Timezone and final score remain unknown. Shockers adds 32 complete plus one incomplete PAs, 90 pitches, 22 fair contacts, seven hits and four successful steal attempts. Stars adds 27 complete PAs, 107 pitches, 20 fair contacts, five hits and three successful steal attempts, with 11 named batters. The original pasted source is retained in both game records and in `tests/fixtures/captures/2026-09-12-shockers-stars.txt`.

All six HBP results omit their terminal pitches (five Shockers, one Stars); only listed pitches are counted. Logan Sumrow's unfinished seventh-inning appearance has no invented pitches or result. David Duggan's sixth-inning **fielder's-choice double play** is one PA, one AB, one fair ground-ball contact to the reported CF, and a batter reach; the two runner outs do not add contacts. Blake Weber's bunt fielder's choice remains a bunt to the first recorded fielder, P. Kyle Reynolds' popup to catcher is **fair contact to C**, not a foul catch or an unknown fielder.

Mark (“Trey”) Poncy's second-inning offensive-interference out is stored separately in `runner_outs` and retained in the source JSON for audit; it does not become a PA or pitch. Logan Pinkerton's courtesy entry for Ishan Natnithithadha is linked to Ishan's walk, giving Logan his own runner visit while keeping the Stars team denominator at 11. Stars is registered once in `teams.json`, after the existing entries. A pre-import Shockers snapshot is `tests/fixtures/shockers-before-sep12-2026.json`; all earlier games, PAs, players, pitches and runner records remain unchanged. Reimporting the same source adds zero duplicates.

The **October 25, 2026, 10:00 AM** browser capture adds **Dig In (Gribbin) 14U** and **BBA 14u East** as separate teams. Dig In has 19 complete PAs, 76 recorded pitches, 13 fair contacts, three hits and four successful attempts across three on-base trips, with 11 named batters. BBA has 23 complete plus one incomplete PA, 88 recorded pitches, 16 fair contacts, eight hits and zero observed steal attempts, with 12 named batters. These are each new team's cumulative recorded totals; the existing three teams' data is unchanged. Dig In's pitch totals by innings 1–4 are 26, 9, 28 and 13; BBA's are 11, 66, 11 and zero. All 16 BBA second-inning PAs are retained separately.

The full capture, including its metadata and nonbreaking spaces, is retained in `tests/fixtures/captures/2026-10-25-dig-in-bba-capture.txt`. Both game records retain the supplied source URL, event ID, source digest and **loaded browser text only; completeness not verified** coverage. Parsing normalizes nonbreaking spaces without changing the raw source descriptions or pitch/event lines. The capture ends with Ben Thorn at bat in the bottom fourth, without pitches or a result; no final score or later innings were inferred, and the timezone remains unknown.

Dean Simmons' first-inning catcher’s-interference ruling is retained as `catchers_interference`: a completed PA and safe on-base visit, with no AB, hit, walk or fair contact. The source lists “Ball 4” as its last pitch despite that ruling; both are preserved, and the discrepancy is shown in the expanded History source note. No replacement pitch or walk classification was invented. Deven Downs is explicitly out at first on a dropped third strike (`reached_base: false`). Jack Wieland's foul-tip strikeout retains a terminal `foul_tip` pitch as strike three and never creates a foul-catch contact. Declan Class's explicit steal of home and earlier steal of second share one trip for tendency while both count as attempts. Jack Jameson's fly-ball double play remains one contact to the recorded RF; the throw to catcher does not add a contact. Liam McDermott's batter substitution is retained without a courtesy-runner entry or extra PA.

## Updating history

**Start with batch preflight** to find independent capture/parser problems together, before importing:

```sh
node tools/import-plays.cjs --preflight "/path/to/captures" --report work/preflight/latest.md
```

Pass a folder of TXT captures, several files or a wildcard. Preflight continues across files and recoverable records/tokens, reporting source line context, metadata errors, identity/reference problems and duplicate/game conflicts. It respects single-team instructions. It never writes team data; only the optional Markdown/JSON report is saved. A blocked file cannot contribute a partial import. Review notes as well as errors, then use the normal importer with explicit TXT paths and `--write`; its validation still runs afresh. See [tools/IMPORT-PLAYS.md](tools/IMPORT-PLAYS.md) for statuses, exit codes, scope, report formats and recovery limits.

To convert captured Plays TXT files yourself, use the dependency-free local utility (Node.js 18+):

```sh
cd /Users/smbambling/Documents/personal/git/github/diamond-scout
node tools/import-plays.cjs "/path/to/gamechanger-plays.txt"
node tools/import-plays.cjs "/path/to/gamechanger-plays.txt" --write
```

The first command previews without changing files. `--write` appends both supplied teams, registers new teams in `teams.json`, and saves original files, input text and a report under `work/import-backups/`. Several TXT paths or a wildcard can be supplied in one command; every input is checked before saving. Identical imports are skipped, and unsupported or overlapping records stop for review. The hosted app still reads only repository JSON on refresh. See [tools/IMPORT-PLAYS.md](tools/IMPORT-PLAYS.md) for metadata overrides, single-team imports, rematches, backups and limitations. This tool converts new games; it does not automatically correct or merge expanded captures into existing games.

Use [TEAM-DATA-PROMPT.md](TEAM-DATA-PROMPT.md) for a reusable prompt covering new teams, appended games, corrections, duplicate detection, source fidelity, and validation. Supply the play-by-play and whatever game metadata is known; missing details remain unknown. **Future imports cover both teams by default** when their plays are present. Each team keeps its own batting and baserunning history, and every new team gets a separate JSON file plus a `teams.json` entry as part of the import. Say **“import only [team name]”** to limit an import to one team.

For future additions, say **“Use TEAM-DATA-PROMPT.md to add this game”**, followed by the play-by-play, team, opponent, full game date (including year), and start time if known. For example:

```text
Use TEAM-DATA-PROMPT.md to add this game
Teams: Shockers 14U vs. [opponent]
Import: both teams (default)
Date: [YYYY-MM-DD]
Start time: [time, or unknown]
Timezone: [if known, otherwise unknown]
[Paste GameChanger play-by-play here]
```

1. Provide the new GameChanger play-by-play, game date/year, start time, and opponent. Existing team-history JSON is read directly from this project.
2. Identify both batting teams from the supplied plays. For each team, append its own PAs, recorded pitches, contacts, and runner events to its separate history file, reusing existing IDs. Keep opponent events out of that team's statistics.
3. Check both teams for previous imports before adding games or events. Preserve existing IDs and records. Repeated opponents reuse their existing team files and manifest entries.
4. For every new team with supplied plays, create `data/<stable-team-id>.json` and append exactly one entry to `teams.json`, preserving existing entries and selector order. Validate that each listed file exists and its `team.id` matches the manifest entry. The importer does this as part of the requested update; the app itself only reads JSON.
5. If only one side's plays are supplied, import that evidence and report the missing side. Do not invent an opponent roster, appearances, or an empty team history. An explicit single-team instruction overrides the default.
6. Copy updated team files and `teams.json` to your static host when ready. Refresh the page to fetch the updated manifest and data; newly registered teams appear in the selector. No HTML edits are needed.

Example team-list entry:

```json
{
  "id": "another-team-14u",
  "name": "Another Team 14U",
  "data_file": "data/another-team-14u.json"
}
```

Data-file paths are relative to the directory containing `index.html`, so hosting under a subdirectory also works. Use paths such as `data/another-team-14u.json`; absolute paths, parent-directory traversal, remote URLs, query strings, and redirects are rejected. Each page load requests both the manifest and selected team JSON with `cache: 'no-store'`. A full page refresh creates a fresh in-memory cache and fetches the files again. Hosts or CDNs that override caching may still need their normal cache refresh or appropriate JSON cache headers after a deployment.

## Capturing plays from GameChanger

An optional local bookmarklet is available in [tools/gamechanger-capture.html](tools/gamechanger-capture.html). Open it in your browser (or visit `http://127.0.0.1:8000/tools/gamechanger-capture.html` with the local preview running) and drag **Capture GC plays** to your bookmarks bar. Sign into GameChanger normally, open the game's Plays view, load the plays, then use the bookmark to review and download the text or copy an import prompt. Review the prefilled date, start time and displayed timezone. A missing header year can be suggested from the season URL only with an explicit year confirmation before export. Correct or clear uncertain fields. Replace your existing bookmark from the reloaded installer page to receive updates. Both teams are requested by default.

The helper uses the existing signed-in page and makes no network requests or credential/storage reads. It captures loaded text only; it cannot verify that every inning remains present after scrolling. Review both sides and the first/last supplied plays. Its parser/formatting and screenshot-format date/time detection checks pass, but live authenticated-page detection and browser behavior remain unverified. See [tools/README.md](tools/README.md) for instructions, limits and official GameChanger export references. These optional tools do not add dependencies or a login to the hosted scouting app.

## Data contract: schema version 1

The team file contains:

- `team`: stable `id`, display `name`, and optional metadata.
- `players`: stable `id`, `name`, and optional `bats` (`R`, `L`, `S`, or `null`).
- `games`: stable `id`, `date` in `YYYY-MM-DD` format or `null`, `opponent`, and optional display/source information. `start_time` is the supplied local start time in 24-hour `HH:MM` format, or `null`; `timezone` stays `null` when not supplied. The selector, game cards, log, and active-filter text display the date and time without assuming or converting timezones. Repeated opponents and same-day games must retain separate game IDs; use date, start time, source, and event/game identifiers to check for duplicates.
- `plate_appearances`: one record per plate appearance, including walks and strikeouts; fair contact is a nested object when present.

Each plate appearance has an `id`, `game_id`, `batter_id`, `sequence`, `inning`, `half` (`top` or `bottom`), `status` (`complete` or `incomplete`), `result`, `pitches`, `batted_ball`, `pitcher`, and `source_text`. An optional `foul_contact` object records a caught foul ball separately; existing files without this property remain valid under schema version 1.

The optional top-level `baserunning_events` array stores steal attempts independently of the batter at the plate. Older files without it remain valid. Each event has a stable unique `id`, an existing `game_id` and `runner_id` (player ID), `result` (`stolen_base`, `caught_stealing`, or `unknown`), `to_base` (`2B`, `3B`, `home`, or `null`), original `source_text`, and optional `inning`, `source_pa_id`, `reach_pa_id` and `runner_entry_id`. A linked source PA must belong to the same game; its batter may be a different player. Standalone runner events do not require a PA link. Preserve an unknown target base as `null`. Keep ambiguous runner identities in source notes for review instead of assigning them to a guessed player. Stable event IDs prevent duplicate imports; do not copy an event both from the full source and its PA excerpt.

Example, for an explicitly recorded successful steal:

```json
{
  "id": "[stable-event-id]",
  "game_id": "[existing-game-id]",
  "runner_id": "[existing-player-id]",
  "result": "stolen_base",
  "to_base": "2B",
  "source_text": "[Original runner-event description]"
}
```

For steal tendency, each attempt needs one source-backed trip link: `reach_pa_id` for the runner's own confirmed reach PA, or `runner_entry_id` for an explicit courtesy/pinch entry. Do not set both. A reach link must belong to the same game and runner, represent a confirmed reach, and precede the attempt's source PA in the same half-inning when that source PA is supplied. An entry link must identify the same game and runner. Linked replacements share the original trip key for team totals. The app counts each linked trip once regardless of how many attempts occurred. Missing or ambiguous links stay absent and withhold the percentage; do not assume every attempt represents a different trip.

The existing 17 attempt records across all three teams have been linked to their unambiguous earlier reaches in the supplied play order. Only these reference fields were added; IDs, original event text, PA results, pitch sequences, games and recorded totals are unchanged. Pre-link team snapshots are in `work/backups/*-before-steal-tendency.json`.

An optional PA `reached_base` value is `true`, `false`, or `null`, based only on explicit source evidence that the batter safely became a runner on first, second or third. When omitted, supported completed results determine reach status as described above. `null` explicitly means unknown. A dropped third strike requires this classification to establish whether the batter reached safely. Home runs cannot set `reached_base: true` for this metric. Incomplete PAs never add a reach.

An optional top-level `baserunning_entries` array records explicit replacements and placements. Each object has a stable unique `id`, existing `game_id`, `runner_id`, `entry_type`, and original `source_text`. A `courtesy_runner` or `pinch_runner` requires an existing `replaced_runner_id`. Optional `source_pa_id` links the PA containing its description. Optional `reach_pa_id` links the replaced runner's original completed reach in the same game, avoiding a second team trip. A link must reference a confirmed reach, not a home run or out. Alternatively, `replaced_entry_id` can reference the earlier placement/replacement entry for the replaced runner, sharing that entry's trip; use one original-trip link only, and retain entries in predecessor order. Keep an unavailable reference `null` or omit it; do not fabricate a missing PA. An unlinked replacement contributes its own visit, so check that the original reach is actually absent before leaving the link unknown. A `placed_runner` instead has `placed_base` (`1B`, `2B` or `3B`), `replaced_runner_id: null`, and no `reach_pa_id` or `replaced_entry_id`; it starts its own trip. Attempts link to its ID with `runner_entry_id`. The same team visit is counted once across linked replacements. Older team files without these optional fields remain valid under schema version 1. Use the updated `index.html` together with JSON containing placements; an older app version does not recognize `placed_runner`.

The optional top-level `runner_outs` array retains standalone outs on the bases. Each event has a stable unique `id`, an existing `game_id` and `runner_id`, positive integer `inning`, `half` (`top` or `bottom`), original `source_text`, and a nonempty source-backed `reason` such as `offensive_interference`. Optional `source_events` retains the original surrounding lines; optional `reach_pa_id` links that runner's confirmed reach in the same game. These records appear separately in History and never add a PA, pitch, hit, contact or steal attempt. A runner-only out can establish game participation without implying a missing on-base visit. Caught-stealing attempts still belong in `baserunning_events` when explicitly supplied.

`fielders_choice_double_play` is a supported completed result: one at-bat, zero hits and one fair contact. It is distinct from a generic `double_play` because the supplied description leaves the batter as a runner and identifies two other runners being put out. Its on-base visit counts once. Original descriptions and all outs remain in the source text.

`catchers_interference` is a supported completed result, excluded from at-bats and OBP calculations but included as a confirmed on-base trip. It has `batted_ball: null` and is distinct from a reached-on-error result. Keep any source-conflicting pitch sequence unchanged and record the discrepancy in PA `notes`; those notes appear in expanded History. See MLB's [at-bat definition](https://www.mlb.com/glossary/standard-stats/at-bat) and [official scoring rule 9.21(f)](https://content.mlb.com/documents/2/2/4/305750224/2019_Official_Baseball_Rules_FINAL_.pdf) for the interference exclusions. A source-specified foul tip with two strikes is strike three; see [MLB's foul-tip definition](https://www.mlb.com/glossary/rules/foul-tip).

Each pitch has a sequential `sequence`, `outcome`, `count_before`, `count_after`, and optional `pitch_type`, `velocity_mph`, and `location`. Unknown values stay `null`. An unknown `count_before` can be `null`: the recorded pitch still counts toward pitch totals and approach metrics but cannot contribute to the count-before-contact table. Supported classified outcomes are `ball`, `called_strike`, `swinging_strike`, `foul`, `foul_tip`, `foul_out`, `in_play`, and `hit_by_pitch`. A `foul_out` pitch is a recorded terminal catch, counts as a swing, and does not count as fair contact or a whiff. Other outcomes are retained as unclassified and excluded from swing-rate denominators. Known count-before values are balls 0–3 and strikes 0–2. A foul with two strikes does not increase the strike count. Do not use the current pitch-outcome set to represent a foul bunt strikeout without extending its classification first.

Fair contact has:

```json
{
  "contact_type": "ground_ball",
  "fielding_position": "SS",
  "location": {
    "zone": "shortstop_area",
    "precision": "fielder_zone",
    "direction": null,
    "depth": null
  },
  "source_text": "Original GameChanger description"
}
```

Supported contact types: `ground_ball`, `line_drive`, `fly_ball`, `bunt`, and `unknown`. `fielding_position` is `LF`, `CF`, `RF`, `3B`, `SS`, `P`, `2B`, `1B`, `C`, or `null`. Set `batted_ball` to `null` for walks, strikeouts, hit-by-pitches, dropped third strikes, and other events without a fair batted ball. A double play remains one contact event.

### Catches in foul territory

For a source explicitly describing a foul ball caught for an out, use `result: "foul_out"`, `status: "complete"`, `batted_ball: null`, and a separate `foul_contact`. This is one PA and one catch. Do not add a pitch unless it was recorded. If recorded, classify the terminal catch pitch as `foul_out`; it cannot also be an `in_play` pitch. `count_after` can remain `null` when no post-pitch count was supplied.

Example contact object, only for a source explicitly locating the catch on the left foul side:

```json
{
  "foul_contact": {
    "contact_type": "fly_ball",
    "fielding_position": "3B",
    "location": {
      "zone": "left_foul_territory",
      "precision": "described_area",
      "direction": null,
      "depth": null
    },
    "source_text": "Original description explicitly identifying a catch in left foul territory."
  }
}
```

Supported foul zones are `left_foul_territory`, `right_foul_territory`, and `behind_home_plate`. These are broad schematic regions, separate from fair-field geometry. Foul fielding positions also accept `C` for catcher. If only the fielder or an unspecified foul catch is reported, keep that fielder when known but use `zone: null` and `precision: "unknown"`; do not assign a side or behind-home location from the fielder. Unknown areas remain in the foul-catch percentage denominator. Explicit depth can be retained as metadata and displayed in the log; foul-region geometry does not subdivide by depth.

Uncaught foul balls stay in the pitch sequence without a contact object. A foul-tip strikeout also stays out of the foul-territory layer; retain its strikeout result and `foul_tip` pitch outcome.

### Broad location metadata

`left_field`, `center_field`, `right_field`, `third_base_area`, `shortstop_area`, `pitcher_area`, `second_base_area`, `first_base_area`, `catcher_area`.

Existing broad zone names remain supported as metadata for compatibility. Use `precision: "fielder_zone"` when the source only identifies a fielder. The diagram no longer draws these zones: it places fixed-size colored markers at schematic standard positions. The pitcher marker stays at the mound and does not extend toward second base. A reported fielder does not establish a landing location or ball path.

### Explicitly described areas

Supported explicitly described zones: `left_field_line`, `left_center`, `right_center`, `right_field_line`. The outfield zones also accept `depth: "shallow"` or `"deep"`; otherwise use `null`.

Example for a description explicitly saying “deep down the left-field line”:

```json
{
  "zone": "left_field_line",
  "precision": "described_area",
  "direction": null,
  "depth": "deep"
}
```

Explicit `described_area` records with a supplied zone appear in the separate **Explicitly described locations** summary, grouped by `zone` and `depth`. Their percentages use all selected fair contact. These rows do not add contacts or change fielder counts, and they are not drawn as territory overlays. A CF handling a ball described in left-center remains attributed to CF. If the fielder is not recorded, the contact stays in the unknown-fielder count even when its area is known. `direction` remains reserved metadata.

Use `precision: "unknown"` and `zone: null` when the contact area is unavailable. Keep a source-supplied `fielding_position`; use `null` only when no fielder is identified. Unknown-fielder contacts stay in the denominator and their count appears beside the field. Never infer a fielder from a location zone or infer precise coordinates, depth, line/gap placement, handedness, or pitch locations from generic descriptions.

The current records do not explicitly describe a hit passing between shortstop and second base. Keaghan Galotta-Withrow's Aug 30 single is described as a hard ground ball to center field; its path through the infield is unknown, so it is attributed only to the recorded CF. The Field view’s **Middle** fielder group combines CF, P and any explicit C contacts, rather than identifying a corridor between SS and 2B.

## Reading the statistics

- Fielder-marker percentages use **all selected fair contact**, including contacts without a known fielder. Counts are based on the recorded fielder only. They do not show where the ball landed or passed.
- The separate foul-territory layer uses **caught foul balls** as its denominator. It never changes fair-contact percentages, fair-contact totals, or recorded-hit totals.
- First-pitch swing rate uses known first-pitch outcomes. Swinging strikes, fouls, foul tips, foul catches and balls in play count as swings.
- Whiff rate is recorded swinging strikes divided by recorded swings.
- Pitches per PA uses complete plate appearances with a nonempty recorded pitch sequence. This is a recorded-pitch average, not a guarantee that a scorekeeper logged every pitch.
- Contact-type filters affect field diagrams, fielder summaries, and the batter gallery. Quick read, recorded outcomes, batting rates, and Approach retain all selected PAs for their appropriate denominators.
- Sample sizes remain visible. One-game patterns are observations, not calibrated predictions.

## Checks

No dependencies are needed:

```sh
node tests/verify.cjs
node tests/ui.cjs
node tests/capture.cjs
node tests/import.cjs
node tests/preflight.cjs
```

The app checks cover source totals, one-contact double plays, pitch-rate denominators, two-strike foul handling, no-contact batters, filters, multiple games, explicit-area summaries separated from recorded fielders, unknown fielders/locations/counts/contact types, duplicate/invalid IDs, real calendar dates, escaping, manifest file paths, and application-script syntax. The interaction model also checks automatic JSON loading, subdirectory hosting, localhost preview URLs, direct-file guidance, recovery by refreshing the page, all 104 readable pitch details, game-card filtering, keyboard tab selection, and usable recovery controls after a failed team load. App/capture checks model repository responses without writing history; importer checks exercise real writes in temporary test projects only. No check uploads data.

The local converter checks (`node tests/import.cjs`) pass against the archived August/September play sources and independent October 25 totals. They cover original pitch/contact reconciliation, both-team batches, courtesy/steal trip links, unusual results, dry runs, duplicate detection, rematches, team aliases, invalid input rejection, backups, concurrent-edit detection and write-failure rollback. The converter update changes no existing team JSON, manifest or app layout. At the start of the initial converter work, the older `verify.cjs` and `ui.cjs` checks failed because their Dig In fixture and selector entry were absent. Those checks depend on the original history fixtures and provenance metadata; the importer regression suite uses isolated temporary projects instead. The caught-stealing parser fix is verified by importer/capture checks and a preview of the actual supplied file. The capture check passes. No new visual browser verification was needed for this local command-line utility.

The October 24 converter regression retains a caught-stealing throw chain as runner-event context rather than treating it as a pitch or contact. The supplied Dig In-only capture previews as 24 complete plus one incomplete PAs, 77 pitches, 16 fair contacts, five hits and one caught-stealing attempt linked to Wesley Hurt's single in the fifth inning. Tests also cover the opponent's explicit `bunts out` wording and reject unattached or malformed defensive fragments. The original capture is retained in `tests/fixtures/captures/2026-10-24-dig-in-fielders-choice-capture.txt`; this regression does not itself import that game into the live team JSON.

The separate October 24 Stars Fontana capture is retained in `tests/fixtures/captures/2026-10-24-dig-in-stars-fontana-capture.txt` as a balk regression. The converter preserves `Balk by pitcher Declan Class` and its runner advance without adding a pitch, changing the count or recording a steal. Both supplied sides preview successfully: Stars has 34 complete plus one incomplete PAs, 110 pitches, 25 fair contacts and 11 hits; Dig In has 24 complete PAs, 86 pitches, 13 fair contacts and no recorded hits. These regression previews do not write team history.

The October 18 Cyclones capture (`tests/fixtures/captures/2026-10-18-dig-in-cyclones-capture.txt`) covers GameChanger's generic `Batter Out` / `out (other)` record. It stays a separate completed PA with every listed pitch, `result: batter_out`, and `reached_base: false`; its unspecified AB/contact classification is flagged rather than guessed. The report includes `unclassified_batting_results`. Full-selection batting rates remain unknown until review resolves the ruling; the card displays separately marked classified-only stats with coverage instead of blanking all available values. The full capture previews for both sides: Dig In has 34 complete plus one incomplete PAs, 127 recorded pitches, 20 classified fair contacts, one foul catch, nine hits and one unresolved generic out; Cyclones has 25 complete PAs, 91 pitches, 12 fair contacts and two hits. Regression tests also retain the reached dropped-third strike, separate runner-only caught stealing and courtesy-runner trip links. These previews do not import team history.

The October 18 Dirtbags capture (`tests/fixtures/captures/2026-10-18-dig-in-dirtbags-capture.txt`) covers explicitly placed runners for both sides in inning seven. No PA/pitch/steal is added for placement; Deven Downs' later steal of third links to his new placement trip. Dig In previews with 29 complete plus one incomplete PAs, 98 pitches, 18 fair contacts, seven hits, seven attempts and 14 on-base opportunities. Dirtbags previews with 31 complete PAs, 113 pitches, 17 fair contacts plus one foul catch, three hits, one attempt and 14 opportunities. The intentional walk retains its single listed pitch. Importer tests also cover a pinch runner replacing a placed runner, team-trip deduplication, player/game filtering, invalid placement bases and predecessor/attempt links. These are regression previews, not imports into live team history.

After the placed-runner update, all four checks (`verify.cjs`, `ui.cjs`, `capture.cjs`, `import.cjs`) pass. October 25 history assertions now select the original source event instead of assuming each team has only one game; their independent PA/pitch/contact expectations remain intact. Current game metadata can retain explicit later corrections. The interaction model also loads the placed-runner capture into the app, checks team and player opportunity counts, verifies that contact filters leave running denominators unchanged, and checks the intentional walk's recorded pitch count. This is DOM-model verification; browser tools were unavailable for a fresh visual check. The layout is unchanged.

The partial-stat display fix keeps an unresolved result from blanking every batting value in Scout/Field. A separately scoped classified-only summary supplies starred labels and an explicit classified/total completed-PA note. Full-selection computed rates remain null until resolved. Tests cover an unresolved out alongside hits/walks, preservation of all History/outcome records, unchanged contact-filter behavior, an unaffected batter, no classified appearances, and identical Scout/Field displays. Imported team files and source records are unchanged by this display fix. Automated calculation/interaction checks pass; no live-browser visual verification was available. The supplied screenshot text matches the unclassified-result case, but screenshot pixels could not be materialized for detailed layout inspection.

Batch preflight adds `node tests/preflight.cjs` as the fifth check. It verifies independent errors across files/records/tokens, metadata and heading recovery, original line/Unicode context, requested team scope, duplicates/conflicts across a staged in-memory batch, unreadable inputs/broken project state, report-file protections and exit codes. Blocked files never contribute partial staged data, diagnostic plans cannot be written, and a passing archived-capture preflight is checked against the normal import planner. The six captures archived when preflight was introduced passed as already imported games, with source limitations retained as notes. Preflight produces no team/manifest/app changes; optional reports are saved only when requested. The latest local review report can be regenerated under `work/preflight/`. The original import checks and existing app/capture checks also pass.

Synthetic foul-catch fixtures cover all three supported foul regions plus unknown location, separation from fair contacts/hits, first-pitch swing and whiff denominators, terminal-pitch validation, fair/foul/contact-type filters, and game-log rendering. These fixtures do not add invented games or catches to the real team history.

The Aug 30 import has independent checks for its 34 complete plus one incomplete PAs, 129 listed pitches, 16 fair contacts, six hits, per-inning pitch totals, original pitch/event sequences, missing HBP terminal pitches, and date/time display. Original-game checks still run against the unchanged Tigers game. The interaction model also checks cumulative history and that a new page load fetches changed JSON using `no-store`.

The September 13 import has independent checks for its 32 complete plus one incomplete PAs, all 103 recorded pitches and their original event order, per-inning pitch totals, 26 fair contacts and fielder totals, 12 hits, sacrifices, bunt single, inside-the-park home run, five runner-attributed steals, date display, unknown start time, and source digest. The original Tigers and prior two-game interaction regressions remain separate. Full-history interaction checks exercise game and batter selections, Approach, History, contact filters, and the new cumulative totals. Both Node checks pass. The local HTTP preview serves the updated team JSON; browser tools were unavailable for a visual check of this data-only import.

Appearance checks cover the fixed Navy & Ice palette, absence of theme controls and storage code, toolbar color, text/control contrast, marker-label contrast, and green/yellow/orange/red heat bands. Scout checks cover matching visible batting strips, removal of recent-appearance/history shortcuts, large-sample label fitting, base clearance, total-contact updates under filters, completed-only denominators, tie evidence, grouped strikeouts, missing results, sacrifices, AVG/OBP/SLG, expanded outcome rows, filters, help navigation, and full-field/history shortcuts.

Verification on October 29, 2026: both Node checks pass, including interaction models at 320, 375, 390, 430, 768, 844, and 1440 pixels. The local HTTP preview also runs successfully. Actual browser rendering was checked at 320, 375, 390, and 430 pixels portrait, 844 × 390 landscape, 768 × 1024 tablet, and 1440 × 900 desktop. No horizontal page overflow was observed at those sizes. The 320px Scout controls measured at least 48px high. Browser interactions checked batter selection, outcome expansion, batting details, contact filters, the full Field shortcut, collapsed gallery/foul sections, a no-fair-contact selection, Approach, and readable History with expanded pitches. Screenshots are saved in `work/previews/`.

The compact Scout update passes both Node checks. The interaction model verifies the restored fielder percentages with contact counts, hidden-by-default metric sample disclosures, BB% and K%, matching batting strips, and outcome expansion after moving the panel into Approach. A 456-contact synthetic fixture checks three-digit counts and percentage labels without changing team history.

During this update, the revised Scout layout was visually checked at 390 × 844 with Blake Weber selected: the approach row, batting strip, full field, and total of three fair contacts were visible together, with no horizontal overflow. The page was eight pixels taller than the viewport because of bottom padding; padding was subsequently reduced. That final padding adjustment, native disclosure interactions, and the revised layout at other viewport sizes could not be visually rechecked because the browser session became unavailable after resuming. Earlier browser results above describe the preceding layout, not a fresh verification of every size for this update. The local HTTP preview remains available and returns HTTP 200. Existing screenshots in `work/previews/` show preceding layouts; `large-sample-check.html` is an updated isolated synthetic layout fixture, not team history or a runtime file.

The zero-contact color and recorded-steals update passes both Node checks. New checks cover attribution to runners during another batter's PA, source-backed totals, game and contact filters, missing events, synthetic caught-stealing/unknown-result cases, duplicate event IDs, invalid references, and readable text on the neutral zero-contact fill. The local preview serves successfully. Browser tools were unavailable for this update, so its extra steals row and color change have not been visually verified; the earlier compact-layout measurements above predate this row.

The uniform statistics layout update passes both Node checks. Existing interaction checks verify attempts / times on base and the per-game supporting value, preserving runner/game/contact filtering and all batting/source totals. The top-row disclosures retain 48px minimum targets, and the same centered label/value styling is used for all nine Scout metrics and for batting values in Field. Browser tools were unavailable for this formatting update, so the new three-column alignment, wrapping and viewport height have not been visually verified. Earlier screenshots and viewport measurements describe preceding layouts. The underlying JSON files were not changed.

The steal-frequency update passes both Node checks, including caught and unknown-outcome attempts, unknown reach status, zero denominators, runner-only participation, home-run exclusion, explicit safe reaches and courtesy-runner team deduplication. It adds one source-backed courtesy entry without changing any existing Shockers record. The Gambrills import checks all source totals, pitch/event ordering, HBP omissions, line-drive double-play classification, team separation, manifest file paths/IDs, loading both teams, filtering and switching back to Shockers. Its source matches the existing Shockers game; an identical reimport adds zero duplicate records. Browser tools remain unavailable for visual verification of these changes.

The September 12 import passes both Node checks, with independent per-team PA, pitch, hit, contact, steal and on-base totals; pitch/event order and per-inning totals; omitted HBP pitches; the unfinished PA; catcher attribution; fielder-choice double-play classification; courtesy-runner trip deduplication; and the separate interference out. Tests retain earlier game regressions, validate all manifest files, exercise Stars team/batter/contact selection and runner-out visibility, and compare every earlier Shockers object against the snapshot. The local preview serves the new team JSON. Browser tools were unavailable, so the added catcher-circle layout and History disclosure have not been visually verified.

The Steal tendency percentage update passes both Node checks. New checks cover deduplication of second/third attempts on one trip, shared replacement trips, unsuccessful and unknown-outcome attempts, missing links, zero visits/attempts, unknown reach status, invalid cross-player/game references, and 0–100% bounds. Every real trip link is checked against the runner's earlier confirmed reach and source pitch/event text. All recorded source fields and totals are preserved. Browser tools were unavailable for visual verification; the three-column layout and typography are unchanged, with a percentage replacing the previous main fraction and a trip count in the supporting line.

The October 25 capture passes all three Node checks. New regressions independently check both teams' totals, source whitespace/digest/metadata, inning pitch totals, the 16-PA second inning, no duplicates, all manifest files, catcher-interference AB/OBP/reach handling, the source Ball 4 conflict, dropped-third-strike reach status, terminal foul-tip count, steal-of-home trip linkage, double-play contact counting, team switching, filters, and Ben Thorn's unfinished PA. Capture round-trip checks preserve the raw nonbreaking-space source. The local preview serves both new JSON files. Browser tools remain unavailable for visual checks; this is not a verification of the authenticated GameChanger page or a guarantee the source includes the full game.

These checks do not simulate direct sunlight, physical touch hardware, iOS browser chrome, or every possible future team/player name. Check the hosted JSON paths and caching behavior when you deploy; this work remains local.

## Phone and field use

The app supports 320–430px portrait screens, tablets, desktop, and short landscape windows. At 760px and below, and landscape windows up to 1000px wide and 500px high, **Hitting · Pitching** stay in bottom navigation with safe-area padding. On wider screens the navigation moves to the header. Scout remains one centered column, with the three-column statistics block above the field. The default layout aims to fit the core information on typical portrait phones; opening sample details, filters, or using a shorter screen can require scrolling. The footer is hidden on Scout to save space. Recorded outcomes are available in Approach.

The logo and live labels are vectors. The field is the unchanged `diamond-defense-soft-field.png` from the local Diamond Defence project, embedded as a data URI once in `index.html` and reused by Scout, Field, and the gallery. No separate image file or dependency on the Diamond Defence project is needed for hosting. The original PNG is about 2.4 MiB; embedding it makes the HTML about 3.3 MiB before HTTP compression. Every marker has a fixed radius of 35 field units. Each circle contains a small position abbreviation, a prominent percentage, and a smaller contact count. Repeated count / total fractions are omitted: the shared total appears beside the field. Position labels use 17 field units, percentages use 25 (23 for 100%), and counts use 18. Five or more count digits fit within a fixed 48-unit width. All labels scale with the field. The total fair-contact count appears in the lower-right space outside the field edge. An unknown-fielder count appears there only when needed. The field and labels share one SVG coordinate system, keeping them aligned as the layout scales. The full field, including home plate, remains visible. A ninth C circle appears only when selected fair contact is explicitly attributed to catcher; it is centered over home plate (center 297,390 in field units). The SVG retains its regular 470-unit height so the catcher does not shrink the rest of the field. Zero-contact selections retain the existing eight circles and field proportions. There is no bottom totals strip. Unknown-fielder counts appear by the total and remain in every denominator. Marker positions are schematic; they do not depict coverage or ball locations. No data-colored field territories are drawn. The pitcher marker stays near the mound, below second base. Circles are informational, not touch controls; navigation, filters, and disclosures retain at least 48px targets.

Buttons, selects, and disclosures have at least 48px touch targets. Form text is at least 16px. Narrow game logs become labeled vertical cards with expandable pitch detail. The last content scrolls clear of the bottom navigation. The app accounts for safe-area insets, preserves pinch zoom, and respects reduced-motion preferences.

To exercise the interaction model with phone widths:

```sh
DIAMOND_TEST_WIDTH=320 node tests/ui.cjs
DIAMOND_TEST_WIDTH=390 node tests/ui.cjs
```

## Repository

The folder is ready to place in a Git repository. No Git repository or remote has been created by this package. Keep `index.html` and `teams.json` at the host's document root, with all listed team-history files inside `data/`. The README and `tests/` can remain in your repository without being needed by the app.

The October 10/17 batch regression adds four preserved captures under `tests/fixtures/captures/`. It covers standalone pickoffs during unidentified unfinished batting turns, name-suffix commas, and explicit outs corrections. Recorded pitches on runner-only outs remain structured on those records (`pitches`, `source_pitch_sequence`, `batter_id: null`) and count in team/game pitch totals, with `runner_only_pitches` reported separately; they do not create PAs or enter player-specific pitch statistics. Pickoffs remain distinct from steals. The complete requested four-file batch passes preflight with no blocking errors; retained source limitations remain notes. Import, preflight, data and DOM-model checks cover these cases. No games are imported by this parser update. Refresh the updated app before displaying newly imported runner-only pitch records.

The October 4 Royals capture (`tests/fixtures/captures/2026-10-04-dig-in-royals-capture.txt`) is a regression for play-edit annotations, score corrections, scorekeeper-ended innings, single-fielder caught-stealing context, and a runner-only caught stealing with a recorded pitch. Raw source text is preserved. A conflicting play edit does not reassign the earlier PA: an affected entry uses `unresolved_trip: true` and the running opportunity denominator is withheld until reviewed. Administrative inning endings are stored in game `source_control_events`. Import/preflight checks pass for this capture; current legacy data/UI checks have fixed Shockers totals that are now stale after additional user imports (162 PAs versus the earlier 127-PA fixture). Those failures are separate from this capture/parser regression and were not resolved by changing historical expected totals. No team data is written by this parser fix.

September 24 and October 6/13 FallPrep captures add regressions for compound runner-only blocks: a caught stealing followed by a different runner's pickoff, a steal of home followed by a pickoff, and a steal of second followed by an out at third. Events are processed in order, each explicit attempt/out is counted once, shared pitches are retained once without an invented PA, and original captures remain unchanged. The requested seven-file Downloads batch passes preflight with zero blocking errors. Import, preflight and capture regression checks pass; older fixed Shockers data/UI expectations remain stale after subsequent imports as noted above. No live history is written by this parser update.

## Steal-tendency review (October 29, 2026)

A dash can mean no recorded on-base opportunities, an unresolved trip, or an attempt without a confirmed trip link. The Scout card now distinguishes **No on-base trips**, **Trip data needs review**, and **Attempt link needs review**. Open the metric for the retained attempts and known evidence. An unresolved opportunity in one game withholds the full-selection percentage; other players and fully linked game selections remain available.

The Dig In October 4, 08:00 Royals source has conflicting seventh-inning identities: Declan Class's single is followed by `(Play Edit) Quinn Kasprzak in for Declan Class` and a courtesy entry for Declan replacing Quinn. The raw source and unresolved flag are retained; no batter identity or denominator is guessed. An older October 17 duplicate courtesy entry had also produced a bogus player name containing pitch and pickoff text. That duplicate and its unused bogus roster record were removed after comparison with the preserved source and current parser. All game records, PAs, pitches, attempts and runner outs remained unchanged; a local recovery copy is under `work/backups/steal-tendency-review-*/`.

`node tests/steals.cjs` checks courtesy-trip deduplication, unresolved-opportunity withholding, unaffected players and all current manifest teams. It and preflight checks pass. The older capture/import/data/UI suites currently depend on removed Shockers/Gambrills runtime files or their old manifest entries and cannot complete with the current two-team dataset. Those test-fixture dependencies need further separation; the removed teams were not restored by this repair. No new visual browser verification was available.

### Confirmed October 4 running-trip correction

The user subsequently confirmed that Declan Class hit the seventh-inning single and was caught stealing second. His caught-stealing event now links directly to that single, without an additional courtesy-runner opportunity. The conflicting source entry is preserved in the game's `data_corrections` audit record and unchanged original capture, rather than counted as a new trip. No PA, pitch, contact or steal attempt was removed or reassigned. At correction time Dig In shows 30% (58/192 trips) and Declan 50% (5/10 trips), with 66 and seven raw attempts respectively. These supersede the unresolved-status note above. Preserve user-confirmed corrections when reviewing future overlaps; parsing the original uncorrected text alone will still flag the conflict. A backup and exact report are under `work/backups/confirmed-declan-trip-*/` and `work/preflight/confirmed-declan-repair.json`.

### Unfinished at-bats with pitches

The converter now accepts listed pitch/context lines after `Name at bat`, keeping the PA incomplete and preserving the source sequence. The August 29, 10:15 Tigers/Vols capture is retained unchanged in `tests/fixtures/captures/2026-08-29-tigers-vols-capture.txt`. Virginia Vols previews with 30 complete plus one incomplete PAs and 117 pitches; Tigers previews with 24 complete PAs and 107 pitches. `node tests/incomplete.cjs`, preflight and steal checks pass. No live team JSON or manifest was written by this fix. The current 13-file Downloads preflight has 12 ready and one blocked capture: September 20 Arlington has three descriptions missing batter names and one steal missing a runner name. Those identities were not invented; review the report at `work/preflight/latest.md`.

### September 20 missing-name support

The importer now retains supported unnamed batter descriptions and explicit unnamed steal attempts using separate, explicitly labeled unidentified placeholders; no real name or shared identity is inferred. All original source text stays unchanged. The September 20 Arlington capture previews as 37 complete plus one incomplete PAs, 137 pitches, 21 fair contacts, one foul catch and 15 attempts, including three unnamed batter appearances and one unnamed runner attempt. The latter has no inferred trip link, so Arlington team tendency remains unavailable pending review. Tigers previews as 31 complete PAs and 108 pitches, including one runner-only pitch.

The original capture is in `tests/fixtures/captures/2026-09-20-tigers-arlington-capture.txt`; verify with `node tests/unidentified.cjs`. The 13-file Downloads batch now preflights with 13 ready, zero blocked, zero errors and retained source notes. This supersedes the missing-name blockers described in the previous update. No live data or manifest was written by this parser fix.

### Tests independent of retained teams

Historical test scenarios now load the isolated mock manifest `tests/fixtures/teams.json` and fixed JSON under `tests/fixtures/teams/`, rather than requiring deleted teams in live `data/`. They do not append fixture teams to the real manifest or restore their live files. Current retained teams are independently schema-validated and exercised by the UI model. This resolves the missing-team test limitations noted above.

All eight checks pass: `verify`, `ui`, `capture`, `import`, `preflight`, `steals`, `incomplete` and `unidentified` (run as `node tests/<name>.cjs`). Live HTML, manifest and team files were verified byte-for-byte unchanged after running the checks. UI checks remain DOM-model tests, not a new browser visual review.

Deleting a team from the app does not establish an import exclusion. A later ordinary `--write` import still adds both captured teams by default; choose `--team "Captured Team Name"` if you only want one team from a capture. This test change does not alter import selection.

### Simplified batting tiles

AVG no longer expands because H / AB already provides its count evidence. BB% and K% are non-expandable, with walks / completed PAs and strikeouts / completed PAs directly underneath. These three metrics have no information icon. OBP, SLG and steal tendency retain their panels. Partial-stat fractions use the same classified completed PAs as their displayed percentages; zero denominators show a dash.

## Saved selection and missing data

The app remembers the selected team and batter in browser local storage, scoped to the site's directory. It stores only those two IDs, never team JSON or computed stats. Refresh still fetches the current manifest and selected history using `cache: no-store`. A removed saved team falls back to the first available team; a removed saved batter falls back to Entire team. Switching teams starts at Entire team. Game/contact filters and expanded metrics are not restored. If browser storage is blocked or damaged, the app still loads normally.

A dash means unavailable, with compact supporting text such as No fair contact, No first-pitch data, No completed PAs, Unavailable or the existing trip-review reason. Zero denominators never display 0%; an observed zero with a positive denominator does. Tiny positive rates that would round down to 0% retain a significant digit instead. Batting averages continue standard three-decimal formatting. UI tests cover saved selections, fresh fetches, stale/deleted IDs, storage failures and zero-versus-unavailable states.



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

### Recognized site-footer handling

Plays capture now excludes the exact trailing GameChanger footer beginning `Get the App`, `Status`, `Visit gc.com`, followed by recognized privacy/legal links. The importer also handles that footer in already-downloaded TXT and combined JSON captures, so recapturing is not required. Only a fully recognized terminal footer is excluded; unknown trailing text or any later play still blocks review rather than being discarded. Original downloaded files are not edited. For newly added games, the original footer is retained separately in `source_capture_footer`, while the play-source fingerprint excludes footer text so it cannot create a duplicate game. Backups retain the full input capture.

`node tests/footer.cjs` covers the actual supplied October 3 combined JSON, all 31 Winchester appearances and 117 pitches, fingerprint equivalence, original footer retention, CRLF and rejection of unfamiliar text. Import now previews successfully; separate box-score discrepancies remain review notes and do not alter play results automatically. Replace the bookmark to prevent footer inclusion in future captures.

### Jersey numbers in the batter dropdown

When a retained box-score lineup/pitching row supplies a unique player name and jersey number for the selected team, the batter dropdown displays `#22 Deven Downs`. It reads existing box-score evidence directly, so already-imported box scores need no reimport. Player IDs, selection persistence, calculations and name order are unchanged. Players without a recorded number stay name-only. Conflicting numbers across captured games or ambiguous player-name matches are omitted rather than guessed; opponent box-score rows never supply this team's numbers. `0` and `00` remain distinct source values.

Jersey lookup accepts both `Name #22` and GameChanger's actual DOM form `Name#22`. An importer `BOX-SCORE-DUPLICATE` message means that evidence is already attached and does not need rewriting for dropdown labels. Refresh the updated app to use it. Batting conflicts shown alongside duplicate notices remain pending review; they are distinct from jersey-label extraction.


### Pitching scouting

The **Hitting** and **Pitching** tabs share the team and game selections. Pitching uses the selected team's pitching tables, never that team's batting results. Choose a pitcher (with a confirmed jersey number when available) or all pitchers. Batter and contact-type filters apply to hitting only.

Pitching summary shows strike percentage, walk percentage, strikeout percentage and pitches per batter from captured pitching rows and Pitches-Strikes / Batters Faced notes. Each summary rate uses only outings with its required numerator and denominator; partial outing coverage is labeled beneath the metric. Missing components are never treated as zero. Detailed tendencies show first-pitch strikes, swinging strikes per known recorded pitch, ground balls per fair contact and AVG against. Fractions and a separate reconciled BF sample accompany these rates. Summary and detailed samples can differ.

`tools/pitching.cjs` derives optional `games[].pitching_scout` evidence during imports, including duplicate-play imports with box scores. It parses the opposing batting half from the retained full play log, including captures imported for only one team. It searches for a unique set of contiguous pitcher stints matching BF, pitch totals, H, BB, SO and all explicit pitcher identities; it does not assume pitching-table row order. Missing/conflicting sequences, ambiguous assignments, runner-only pitches or incomplete BF coverage withhold pitch-level tendencies for that game. Mid-appearance changes require review. Original batting records, source text and box scores remain unchanged; compact derived samples include first/last opposing PA sequence for audit. Pitching uses stacked label/value/count tiles with partial outing coverage on its own line. Attribution evidence remains in JSON and is omitted from the scouting screen.

Current Dig In history: 31 pitching summaries, 20 games with reconciled detailed samples and 11 summary-only games. These describe captured history; capture completeness remains unverified. ERA, WHIP, pitch types, locations and velocity are not included.

Run `node tests/pitching.cjs`, `node tests/verify.cjs` and `node tests/ui.cjs` to check derivation and UI models. UI models are not browser visual verification.

When All pitchers is selected, Pitcher leaders lists Most used by distinct recorded game appearances and Strikeout leader by total box-score SO, including ties. Strikeout cards include K rate and its BF sample; incomplete strikeout totals are excluded and partial rate samples are labeled. Leaders follow the game filter. Tap a leader to select that pitcher. These are recorded leaders, not an automatic ace ranking.

History and Scouting guide UI, navigation, dedicated styles, PA/source-detail renderers and event handlers were removed. Stored game histories, original source evidence, schema validation, imports, filters and shared pitch/baserunning calculations remain available to the surviving views.

Hitting now shows a compact Contact profile with horizontal ground-ball, line-drive and fly-ball bars, plus bunts and unknown types when recorded. Each row has a percentage and count / total fair contacts. It replaces the two contact tiles; first-pitch swing and steal tendency form a two-column row above. Contact profile uses all fair contacts for the selected batter/games regardless of contact-type filter. The redundant map caption is removed. Partial batting coverage is tucked into a short expandable review indicator; starred stats and source evidence remain intact.

Hitting quick tendencies now use three columns: First-pitch swing, Whiff rate, and Steal tendency. Whiff rate uses recorded swinging misses / recorded swings, with the fraction directly underneath and no expansion. No recorded swings shows a dash rather than 0%.

Pitches / PA joins the Hitting tendencies as the third tile, before Steal tendency. Four columns become a compact 2×2 grid at 560px and below. The mean and fraction use only completed PAs with recorded pitch sequences; incomplete PAs, missing sequences and runner-only pitches are excluded. Missing samples show a dash.

Hitting uses three compact stat rows: AVG / OBP / SLG; first-pitch swing / whiff rate / pitches per PA; BB% / K% / steal tendency. H/AB appears beneath AVG instead of a separate tile. The field precedes Contact profile. Routine Recorded history badges are hidden; no-data and small-sample warnings remain. Details still expand directly below their relevant stat group.

Pitching Strikeout % now opens a compact Looking / Swinging count panel with its tracked strikeout and BF sample. The split uses only reconciled sequences; foul-tip strikeouts are swinging, and dropped-third-strike results use an explicit terminal pitch to distinguish looking/swinging, otherwise remaining unclassified. Missing sequence detail is not treated as zero. Box-score K% continues using its own documented coverage. Existing captures have been backfilled; future imports derive the split automatically.

Swinging strikes is now a submetric opened by Strike % on Pitching, showing its percentage and misses / tracked pitches. It no longer occupies a standalone Pitch tendencies tile. Strike and strikeout detail panels are mutually exclusive.

Recorded pitch outcomes now appears at the bottom of Pitching. Horizontal bars show counts and shares of tracked reconciled pitches for the selected pitcher and games, including unknown outcomes when recorded. Box-score-only outings do not contribute to this chart. Existing pitching samples are backfilled and future imports derive outcome counts automatically.

Pitching now groups seven metrics into three compact rows: Strike / Walk / Strikeout percentages; Pitches per batter / First-pitch strikes; AVG against / Ground balls. Strike and strikeout details open directly beneath the first row. Section-heading duplication, large gaps and chart-row spacing are reduced; pitch-detail sample remains a short footer within the summary.

AVG against is displayed beside the Pitching summary title with H/AB beneath it. The remaining pitching metrics form two rows of three; detail panels still expand between the rows.

Approach removal also deletes its outcome/count tables, pitch-outcome renderer, disclosure state and obsolete view-restriction flag. The phone navigation uses two columns. Shared pitch summaries and runner-only pitch accounting remain available for Hitting and Pitching.
