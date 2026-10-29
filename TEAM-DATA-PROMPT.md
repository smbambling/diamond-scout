# Diamond-Scout team-data update prompt

Use this file whenever we add a team, append games, or correct existing history. In a new conversation, paste the prompt below with the play-by-play, or say **“Use TEAM-DATA-PROMPT.md to add this game”** and supply the game information and source.

**Default: import both teams represented in the supplied plays.** Update each team’s separate history file and register every newly added team in `teams.json`. An explicit request for only one team overrides this default.

Optional: use the local [GameChanger capture helper](tools/README.md) to download plays from your signed-in browser. Its output already includes this import request. Captures contain loaded text only; review coverage before importing.

For supported TXT captures, the local [plays-to-JSON converter](tools/IMPORT-PLAYS.md) can perform deterministic imports: `node tools/import-plays.cjs "/path/to/plays.txt"` previews; adding `--write` saves with backups. It handles both teams and `teams.json` by default. When using this prompt, prefer that utility for new supported games, then reconcile its report against the source and run the existing checks. Unsupported wording, identity questions, corrections and expanded/overlapping captures still require source review; never bypass an import error by dropping records. Do not rerun the utility to duplicate a game already present. CLI metadata overrides apply to every file in a batch. README history totals are snapshots; update them when requested or when reporting a reviewed import.

Fill in what you know. Leave missing facts marked unknown; a missing date does not prevent an import.

For multiple captures, start with `node tools/import-plays.cjs --preflight "/path/to/captures" --report work/preflight/latest.md`. Review the entire report and original sources together before importing. The folder scan is nonrecursive and reads TXT files only. Metadata/single-team overrides apply to every input in that command. Resolve unsupported wording or uncertain identities with source-backed fixes; do not remove plays or force partial imports. A passing report does not prove capture completeness, and the ordinary import command validates again before writing. You can say **“Use TEAM-DATA-PROMPT.md to review these preflight issues”** and supply the report plus captures. Keep the original **“Use TEAM-DATA-PROMPT.md to add this game”** instruction for additions.

## Reusable prompt

```text
Update Diamond-Scout's team data directly in:
/Users/smbambling/Documents/personal/git/github/diamond-scout

REQUEST
- Action: [add a new team / append game history / correct existing records]
- Teams to import: [both teams by default; name a single team only to limit scope]
- Team names and age groups: [as supplied, or identify from inning headings]
- Existing team IDs or history files, if known: [IDs/paths or unknown]
- Game date: [YYYY-MM-DD or unknown; list separately for multiple games]
- Start time: [local game time or unknown]
- Timezone: [only if supplied; otherwise unknown]
- Matchup: [team A vs. team B, or identify from the plays]
- Batting halves: [team A top/bottom; team B top/bottom; or identify from headings]
- Game/event identifier, if known: [existing game ID, tournament, game number, or source link]
- Requested corrections, if any: [which records and what the source establishes]
- Source: [paste GameChanger play-by-play below or identify the supplied local file]

Inspect teams.json, the relevant data/*.json files, README.md, the validators
in index.html, and existing checks before editing. Use current project files
as the baseline. Do not replace existing history with only the new game.

Keep the current buildless structure: index.html, teams.json, and one history
JSON per team. Read and update files in this project only. Do not add a file
picker, external data service, build step, or embedded duplicate data in HTML.
Keep changes focused on data and necessary documentation/check updates.
Do not publish, deploy, push, or change unrelated application behavior.

FOLLOW THE RULES BELOW
1. Identify the correct team, game, and players before merging. Reuse stable
   team, player, game, and plate-appearance IDs. Names alone do not establish
   that players on different teams are the same person. Do not silently merge
   ambiguous identities.
2. Check existing history for the supplied game and overlapping appearances.
   An identical reimport must add zero duplicate games, PAs, or pitches. For
   corrections, update the existing record in place and preserve its ID.
   Do not deduplicate separate appearances just because their text matches.
   Unknown dates alone cannot identify a game. If overlap or a correction
   cannot be resolved from the source, ask a focused question before merging
   those records; continue independent work where possible.
   Use supplied date, start time, opponent, and event identifiers to distinguish
   rematches or same-day games. Preserve existing IDs when correcting metadata.
3. Import BOTH teams by default when their plays are supplied. An explicit
   single-team request overrides this default. Identify each batting team from
   source inning headings and player descriptions, then update its own separate
   history file. Each file contains only that team's batting PAs and runner
   events; opponent names and explicitly identified pitchers remain context.
   Never count the opponent's PAs, hits, pitches, contacts or steals in that
   team's statistics. Retain every supplied PA, including walks, strikeouts,
   hit-by-pitches and explicitly incomplete PAs, and batters with no fair contact.
   A runner-only event is not a new PA. Retain standalone outs such as offensive
   interference in runner_outs with stable ID, game_id, runner_id, inning,
   half, source_text, reason and an existing reach_pa_id when known; preserve
   surrounding source_events. Do not invent a batter or unfinished PA when a
   half-inning ends on the bases. Runner-only outs count as steal attempts only when the source explicitly
   describes an attempt; a pickoff alone is not an attempt. If the runner-only block explicitly
   lists pitches but never identifies the batter, retain its pitches and
   source_pitch_sequence on runner_outs with batter_id:null. Include them in
   team/game pitch totals separately from PA-attributed pitches, without a
   fabricated PA or player attribution. Preserve name-suffix commas and
   "Outs changed to N" corrections as source context, not pitch events.
   Import only the supplied side when the
   source contains one team's plays; report missing coverage without inventing
   an opponent roster or empty history. Resolve ambiguous team attribution
   before merging affected records. Use the same supplied date/start time for
   both sides of the same game, with opponent and batting-half metadata reversed.
   Reuse each team's existing game ID, or create stable team-specific IDs for
   new records. Never merge player identities across teams from names alone.
4. Retain every recorded pitch, in source order, once. Preserve original source
   descriptions and relevant runner-event context in source text/notes, without
   counting steals, pickoffs, substitutions, or runner advances as pitches.
   Do not manufacture pitches to reconcile a final count or result. An empty
   pitch list means no sequence was supplied, not zero pitches were thrown.
   Also preserve explicit steal attempts in top-level baserunning_events,
   attributed to runner_id, not the batter at the plate. Reuse stable event IDs
   and valid game/player references. Store result as stolen_base,
   caught_stealing, or unknown for a recorded attempt with no supplied result;
   to_base is 2B, 3B, home, or null. Retain original source_text and, when known,
   inning and source_pa_id (same game). Runner-only events need no new PA.
   Link each attempt to its recorded on-base trip using reach_pa_id for the
   runner's own confirmed reach PA, or runner_entry_id for a courtesy/pinch
   entry (use one link only). Resolve from explicit play order and identity:
   the reach must precede the attempt in the same game and half-inning when
   source_pa_id is known. Several attempts on one trip reuse the same link.
   Do not invent a missing or ambiguous trip; leave its link absent and report
   that tendency is withheld. Preserve or add source-backed links on corrections.
   An explicit “scores on steal of home” is a stolen_base event with
   to_base:home. Reuse that runner's prior reach link when another steal
   occurred on the same trip. A passed-ball/wild-pitch score is not a steal.
   Deduplicate the same event appearing in both full source and PA excerpts.
   Do not count pickoffs, pickoff attempts, ordinary advances, passed balls,
   wild pitches, defensive indifference, or substitutions as steals unless the
   source explicitly identifies a steal attempt. Never infer a runner identity,
   attempted base, failure, or complete coverage from missing events. Leave
   unresolved identities in source notes for review. Preserve existing events.
   Preserve explicit courtesy- and pinch-runner substitutions in the optional
   baserunning_entries array (see README). Use a stable id, game_id, runner_id,
   replaced_runner_id, entry_type (courtesy_runner or pinch_runner), and original
   source_text. Link source_pa_id when the substitution occurs in a known PA,
   and reach_pa_id to the replaced runner's original confirmed reach in that
   game when present. This lets the replacement count toward their own times
   on base while counting the team trip once. Only leave reach_pa_id absent
   when that original reach is outside the supplied record; otherwise resolve
   the link before import. Do not turn a substitution into a PA or pitch.
   Also preserve explicit "Name gets placed on 1st/2nd/3rd" statements in
   baserunning_entries as entry_type:placed_runner with the supplied placed_base
   (1B/2B/3B), replaced_runner_id:null, source_text, and source_pa_id when known.
   A placement starts its own on-base opportunity, without a PA, pitch, hit or
   steal. Link later attempts with runner_entry_id; do not borrow a batting
   reach from an earlier inning. A courtesy/pinch runner replacing an entry-
   backed runner links to that earlier entry using replaced_entry_id instead
   of inventing a reach_pa_id. This keeps the team trip counted once. Retain
   predecessor order and validate the same game/runner and source half-inning.
   Steal tendency is the percentage of recorded on-base trips with at least
   one attempt, with a trips-with-attempt / all-trips fraction underneath.
   Multiple attempts on a trip count once, including caught or unknown-outcome
   attempts. Raw total attempts and attempts per game remain in the disclosure.
   Reaches include singles, doubles, triples, walks, HBP, errors and fielder
   choices, excluding HRs, ordinary outs, sacrifices and incomplete PAs.
   For ambiguous completed results such as dropped third strikes, set
   reached_base true/false only from explicit evidence, or null when unknown.
   Missing trip links or unknown reach status withholds the percentage.
   Games count supplied batting or running participation for that player.
   If the input comes from the capture helper, retain its supplied game date,
   time, displayed timezone label and sanitized source URL, and treat coverage
   as unverified unless
   independently reconciled. Do not treat capture time as a game date, infer
   missing innings, or assume scrolling/export guarantees a complete game.
   A year suggested from the season URL must be confirmed in the helper; do
   not invent a missing year or convert an ET/EDT/EST label to an assumed zone.
5. Include every fair contact: hits, outs, errors, sacrifices, bunts, and
   fielder's choices. A double play is one PA with one fair contact. For an
   explicit fielder's-choice double play that leaves the batter as a runner,
   use fielders_choice_double_play (one AB, no hit, one contact and one batter
   reach), preserving the identified runner outs in the source. Do not treat
   it as a batter-out double_play. Foul balls,
   walks, strikeouts, and dropped third strikes have no fair batted-ball object.
   Also retain foul balls explicitly caught for an out: use result:"foul_out",
   status:"complete", batted_ball:null, and a separate foul_contact object.
   A recorded terminal catch pitch uses outcome:"foul_out" and counts as a swing,
   not fair contact or a whiff. Do not add a pitch absent from the source.
   Uncaught fouls and foul-tip strikeouts have no foul_contact object.
   A source-explicit catcher-interference award uses catchers_interference:
   one completed PA and on-base visit, no AB, hit, walk or fair contact; exclude
   it from the OBP denominator. If its pitch list conflicts with the ruling,
   retain both, add a source note, and report the discrepancy rather than
   silently changing the result or inventing a terminal pitch. A dropped third
   strike with an explicit out at first uses dropped_third_strike and
   reached_base:false. An explicit foul-tip strikeout uses strikeout_foul_tip
   and the listed terminal foul_tip pitch as strike three, not foul_out.
   A hit-by-pitch result does not justify appending an unlisted terminal pitch;
   retain the listed pitch sequence and note any source omission.
   An explicit intentional walk is a walk award with only its listed pitches;
   do not invent four balls or change it into an ordinary four-pitch walk.
   A generic GameChanger Batter Out / "out (other)" is retained as a separate
   completed PA with result batter_out and reached_base:false. Preserve its
   listed pitches, leave unspecified contact/official AB classification
   unresolved, and add a review note. Do not replace it with an assumed ground
   out, strikeout or fair-contact location. Report the unclassified result;
   full-selection batting rates stay unknown until resolved. The app may show
   a separately marked classified-only summary with its PA coverage; never
   silently exclude an unresolved PA while presenting the result as a full total.
6. Never invent game dates, final scores, player handedness, pitcher identities,
   pitch types, speeds, counts, or ball locations. Missing scalar details stay
   null. Do not substitute today's date or infer a final score from a partial log.
   Store a supplied start time as start_time in 24-hour HH:MM format. Keep
   timezone null unless supplied; do not assume a timezone or convert to UTC.
   Preserve original capture whitespace (including nonbreaking spaces) in
   source text and source_pitch_sequence; normalize whitespace only for parsing.
   Retain source URL/event ID and the supplied unverified-coverage notice.
   Counts may be derived only from an unambiguous recorded sequence beginning
   at a known count. Unknown counts stay null. Ordinary two-strike fouls do not
   add a strike. If an event cannot be classified faithfully by the current
   schema (for example, a foul-bunt strikeout), flag it instead of misclassifying
   it or silently changing application logic.
7. Retain the reported fielding_position for generic descriptions such as a
   ground ball to shortstop, using fielder_zone precision as metadata. The app
   shows contact by recorded fielder using fixed-size position markers, not
   shaded fielding territories. Explicit line, gap, shallow, or deep descriptions may use
   supported described_area zones/depths. Do not convert a fielder's position
   into an exact landing spot, trajectory, depth, or line/gap location.
   For an unknown area use zone:null and precision:"unknown". Keep any
   source-supplied fielding_position; use fielding_position:null only when the
   fielder is unknown. Never infer a fielder from an area. Explicit described
   areas are summarized separately and must not override the recorded fielder.
   Fair-contact fielding_position also supports C for an explicit catcher
   popup or other fair ball; use catcher_area with fielder_zone precision as
   broad metadata. Never infer foul territory from catcher attribution alone.
   A C circle appears below the plate only when C has selected fair contact.
   Retain unknown-fielder contacts in the fair-contact denominator. Unknown
   contact type uses "unknown" rather than a guessed ground/line/fly label.
   Foul catches support left_foul_territory, right_foul_territory, or
   behind_home_plate only when explicitly described, with described_area
   precision. Otherwise use zone:null and precision:"unknown", retaining the
   known fielder (including C for catcher) without inferring the catch area.
   Never merge these catches into fair-contact fielder counts or their denominator.
8. Follow schema_version 1 and supported values in the current README and code.
   All game_id, batter_id, runner_id and source_pa_id references must exist
   within the appropriate team file when present, including replaced_runner_id,
   reach_pa_id and runner_entry_id for attempt/replacement trip links. Keep PA sequence numbers
   in game order and pitch sequence numbers contiguous from 1 within each PA.
   For EACH newly imported team, create data/<stable-team-id>.json and append
   exactly one teams.json entry with matching ID, name, and relative data_file
   path. This is part of the import, without a separate user request. Reuse
   existing files and entries for known teams; never duplicate an entry for a
   rematch. Preserve unrelated teams and existing selector order/default team.
   Before finishing, validate the manifest and load every listed JSON, checking
   that its team.id matches the entry.id. Refreshing must expose newly added
   teams in the selector. An existing team's new game needs no manifest edit.

VALIDATE AND REPORT
- Reconcile each supplied game separately for EACH imported team against its JSON: total and
  completed/incomplete PAs, recorded pitches, fair contacts, foul catches,
  stolen bases, caught-stealing and unknown-result attempts by runner,
  unknown foul-catch areas, recorded hits, on-base visits, explicit runner
  replacements, distinct trips with attempts and missing trip links,
  runner-only outs (separately from PAs), catcher contacts,
  fielder-choice double plays, and unknown reach statuses. Check that linked replacements
  do not duplicate team trips, multiple attempts on a trip count once toward
  tendency, and HRs are excluded from visit counts.
  Report additions and corrections separately from cumulative totals for each
  team. List new/reused team files and added/unchanged teams.json entries.
- Check duplicate team entries, game/PA/runner IDs, references, pitch ordering,
  cross-team separation, count handling, valid dates,
  supported map zones, and preservation of unrelated existing records.
- Run node tests/verify.cjs and node tests/ui.cjs. Inspect failures: current
  checks include fixed expectations for the initial Shockers history. If adding
  history legitimately changes totals, preserve checks for the original game
  (original baseline: 26 complete PAs, 104 pitches, 19 fair contacts, 5 hits)
  and add source-backed assertions for the new game. Do not change expected
  values merely to make a failing check pass or rewrite fixture history.
- If browser testing is available, use an HTTP local preview and verify team,
  batter, game, and contact-type filters plus Scout, Field, Approach, and History.
  Confirm that recorded outcomes exclude incomplete PAs and contact filters do not
  change batting, Quick read, recorded-steals, or pitch-rate denominators. Check
  that attempts and on-base visits follow the runner across the selected games;
  confirm that per-game rates use their recorded participation, not roster size
  or every game listed for the team.
  Report any limits honestly; DOM-model checks are not visual verification.
- Update README history summaries when they become stale, clearly separating
  the initial supplied game from later cumulative totals.
- Finish with changed paths, per-team/per-game imported or corrected totals,
  cumulative totals for each team, teams.json changes, duplicate handling,
  unresolved unknowns or missing-side coverage, and check results.
  Explain that refreshing the page reads updated project JSON; nothing was published.

PLAY-BY-PLAY / SOURCE MATERIAL
[Paste the source here, including inning boundaries, batter names, results,
 pitch sequences, and any explicitly supplied game metadata.]
```

## Common requests

- **Append a game:** “Use TEAM-DATA-PROMPT.md to add this game. Teams: Shockers 14U vs. [opponent] (both teams). Date: [date/year or unknown]. Start time: [time or unknown]. Here is the play-by-play: …”
- **Only one team:** “Use TEAM-DATA-PROMPT.md to add this game, but import only [team name]. Here is the play-by-play: …”
- **Add a team:** “Use TEAM-DATA-PROMPT.md. Add [team name/age] as a separate team using this history: …”
- **Correct a record:** “Use TEAM-DATA-PROMPT.md. Correct [team/game/PA ID or identifying description]. The source says […]. Keep its existing ID and all other history.”

The project files already provide the existing history; there is no need to attach a second copy of those JSON files when working in this directory.

### Missing names in Plays text

The local converter supports explicitly unidentified batter/runner placeholders. Preserve every supported nameless PA and its pitches, result and contact. Keep each unidentified appearance separate; never infer that several nameless records are one player. Keep a nameless steal as an attempt without guessing its runner or trip link. Flag missing identities in the import notes and withhold any tendency requiring unresolved links. Only assign or merge identities after source-backed/user-confirmed review; preserve the original source text and an audit of the correction.
