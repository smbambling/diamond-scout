# Diamond Scout

A compact, read-only baseball scouting app for coaches. Hitting and pitching statistics come from captured GameChanger Plays and Box score data. The app runs as a static site with no build step, server, or runtime packages.

## Run locally

From the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open <http://127.0.0.1:8000/>. Use HTTP rather than opening `index.html` directly so the browser can fetch the team JSON files. GitHub Pages can host the same files under a project subdirectory.

## Using the app

- **Your team** in the header scopes the opponent list. All teams is the initial default. These are viewing filters, not authentication or access controls; published data is public.
- **Hitting** shows batting rates, swing/whiff tendencies, pitches per PA, steal tendency, a fielder contact map, and a contact profile. Tap information-marked metrics for additional counts.
- **Pitching** shows box-score summaries, linked-play tendencies, recorded pitch outcomes with a donut chart, and collapsible pitcher leaders. Performance by inning appears when exactly one game is selected; pitcher names are selectable.
- **Search** finds teams and participating players by name or jersey number.
- **Filters** supports multiple games, contact type, tab-specific player sorting, and participation/ranking thresholds. Games appear newest first. Done closes the panel.
- **Share view** inside Filters shares the current team, tab, player, games, and filters. A shared link uses the latest published data, rather than freezing a snapshot.

Tap **⇅** to the left of the player arrows to enter metric-sort mode. Select an outlined metric to rank players and display Entire team / All pitchers; the mode then turns off. In sort mode, ⇅ becomes a jersey icon of the same size. Tap the jersey to restore jersey-number order and Entire team / All pitchers, or press Escape on a metric to cancel without changing the sort. In normal mode, information-marked metrics still expand their details. Sorting is controlled directly from the grid; there is no Sort players by dropdown in Filters.

Changing games preserves Entire team / All pitchers or the current player. A player absent from the new selection falls back to the team view. Changing the sort displays Entire team / All pitchers while ordering the player list by the chosen metric. Changing the ranking-sample threshold selects the top eligible player. Expanded metric details close when the player or tab changes.

The app remembers team, tab, player, game selection, sort, and filters in the browser. Valid shared-view settings override remembered settings.

### Participation and ranking filters

**Minimum games played** defaults to **5**. Enter any nonnegative whole number; **0 includes everyone**. Eligibility uses full captured history, counting batting/running participation on Hitting and pitching appearances on Pitching. Players below the cutoff are excluded from player lists and aggregate statistics. The caption reports excluded players. This filter describes participation; it does not establish whether someone is a guest player.

The metric-specific **Minimum … for ranking** filter (for example, Minimum AB for ranking) defaults to **Any size**. A threshold prioritizes qualifying samples within selected games; it does not exclude players or change aggregate totals. Units follow the selected metric. Jersey sorting does not use a ranking threshold. Previously saved choices remain remembered.

### Reading the statistics

- The field shows the recorded fielder handling fair contact, including hits, outs, errors, and sacrifices. It does not show precise landing coordinates or ball trajectories. Caught foul balls are counted separately.
- Whiff rate is swinging misses divided by recorded swings. Swinging-strike percentage uses pitches as its denominator.
- Steal tendency is on-base trips containing at least one attempt divided by known on-base trips. Multiple attempts during one trip count once toward tendency. Stolen/caught totals count individual attempts. Unresolved trip links can withhold the percentage even when attempt counts are available.
- Box-score pitching totals can cover more pitches than linked-play tendencies, the pitch-outcome chart, or inning detail. Use their displayed samples when comparing rates.
- A dash means unavailable, not zero. Missing plays, uncertain scoring, or unreconciled pitcher assignments are never filled with invented statistics. Small samples remain observations, not predictions.

## Capture and import games

The bookmark tool runs on normally rendered GameChanger pages in your signed-in browser. It reads Plays and Box score, and checks Recap for a full date when needed. It does not use private APIs or account credentials.

1. Open [the capture installer](tools/gamechanger-capture.html), then drag **Capture GC data** onto your bookmarks bar.
2. On GameChanger, open a game and run the bookmark for single-game capture, or open a team's **Schedule** for the batch scanner.
3. Select teams to import, optional organization assignments, and an optional tournament label. Download the capture.
4. Run preflight, then import:

```sh
node tools/import-plays.cjs ~/Downloads/gamechanger-* --preflight
node tools/import-plays.cjs ~/Downloads/gamechanger-* --write
```

The schedule scanner preselects completed games and excludes practices and other events without final game results. It scans loaded schedule rows; scroll the schedule to load older events and rescan when needed. Capture runs sequentially, with Stop, retry failed games, and a single batch download. **Only import [schedule team]** excludes opponent histories from the import. Both teams are imported when unchecked. Capture failures and warnings are reported without requiring routine review of raw capture text.

All imports are planned before saving. Exact reimports are skipped. Matching event IDs or overlapping opponent/date/time metadata trigger checks, including games captured from opposing scorebooks with different event IDs. Distinct rematch dates or start times remain supported. Suspected corrections stop for review rather than silently replacing recorded history. Backups, original captures, and rollback information are saved under `work/import-backups/` when changes are written.

For unsupported plays, corrections, and source-backed manual updates, use [TEAM-DATA-PROMPT.md](TEAM-DATA-PROMPT.md). Detailed workflows and limitations:

- [Capture tool instructions](tools/README.md)
- [Importer and preflight reference](tools/IMPORT-PLAYS.md)
- [Test fixture provenance](tests/fixtures/README.md)

### Audit missing metrics

Imports report missing or partial metric coverage with suggested source checks. Audit all stored histories without changing files:

```sh
node tools/audit-metrics.cjs
```

Warnings can reflect incomplete scorekeeping, not just capture problems. Resolve against original source evidence; recapture when a screen failed to load. The audit does not certify completeness or automatically repair scoring discrepancies.

## Data and organization teams

`teams.json` lists scouting teams and their JSON paths. Its `organization_teams` entries contain `opponent_ids`, allowing multiple organization teams to share the same opponent history. Optional `scouting_team_id` identifies an organization's own scouting record. Assignment choices in the bookmark are embedded from this configuration during release preparation.

Each team JSON contains stable player/game IDs, plate appearances, and optional baserunning events, runner entries/outs, box-score evidence, and derived pitching samples. Keep original source text and unknown values. The validators in `index.html`, import utilities, and [data-update instructions](TEAM-DATA-PROMPT.md) define the accepted fields and evidence requirements.

## Checks

Node.js 18 or newer is required for the utilities. No package installation is needed. Run every test suite:

```sh
(for test in tests/*.cjs; do node "$test" || exit 1; done)
```

Run the phone-sized UI model separately:

```sh
DIAMOND_TEST_WIDTH=320 node tests/ui.cjs
```

Tests cover statistics, filters, source preservation, capture parsing, schedule discovery, imports, duplicate protection, backups, and rollback. Import write tests use temporary projects. UI models are not visual browser tests; signed-in GameChanger interaction and iPhone presentation should also be checked manually.

## Releases and refresh

Before committing a release:

```sh
node tools/prepare-release.cjs
```

This versions local image URLs, updates `version.json`, and rebuilds the capture bookmark with the latest capture code and organization choices. Commit the generated changes with the release. The app checks for a new version on launch and return to the foreground; supported home-screen views also offer pull-to-refresh.

To enable the repository's pre-push hook on this checkout:

```sh
git config core.hooksPath .githooks
```

The hook runs release preparation for pushes to `origin/main`. If preparation changes files, it stops the push so you can review and commit them before retrying. It does not commit automatically.

**After changing the capture utility or organization team list, reload the installer and replace your bookmark.** Installed bookmarks contain a copy of the code and do not update themselves.

## Repository layout

| Path | Purpose |
|---|---|
| `index.html` | App markup, responsive styles, statistics, validation, and UI code |
| `teams.json`, `data/` | Published team configuration and scouting history |
| `assets/` | App icons, navigation artwork, and field image |
| `site.webmanifest`, `version.json` | Home-screen metadata and release identification |
| `tools/` | Capture installer, scanner, import/preflight, audit, and release utilities |
| `tests/` | Regression suites and source fixtures |
| `.githooks/pre-push` | Release preparation before pushes to origin/main |
| `work/` | Ignored local backups and recovery artifacts; not required to run the app |

See [third-party notices](THIRD-PARTY-NOTICES.md) for artwork information. Unused artwork variants remain in `assets/` for now. Git history preserves earlier documentation and implementation revisions.
