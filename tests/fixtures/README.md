# Regression fixtures

`captures/` contains original GameChanger text used by importer, capture, preflight and data checks. Preserve its Unicode, punctuation and source details; fix parsing code rather than editing source text to make tests pass.

`shockers-four-games.json` is the source-backed Shockers regression snapshot containing the original supplied game, Aug 30 Gambrills, Sep 13 Metro and Sep 12 Stars. It is scoped from the existing history, with its records and IDs unchanged. Fixed historical UI/stat assertions use it so new live games do not change their denominators.

`shockers-before-sep12-2026.json` is the preserved pre-import snapshot used to check that earlier source records remain unchanged. It was copied byte-for-byte from the local recovery backup.

These fixtures are development files, not app runtime files. Do not include them in the static publication folder. Live team JSON is independently schema-validated by `tests/verify.cjs`.
