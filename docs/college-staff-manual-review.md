# College Staff Intelligence — manual fallback and open source reviews

## Scope
Supported recruiting divisions: NCAA D1, NCAA D2, NCAA D3, NAIA, and JC (JUCO). The Super Owner manual fallback is **division-agnostic** and becomes available when a school's bootstrap queue is populated. Do not start new division-wide imports as part of manual cleanup.

## Access-blocked official athletics sites
1. HTTP 403, robots, forbidden or access-denied errors are **not** proof that the softball program is inactive. Confirm the program and current softball coaching staff on the school's official website.
2. The Super Owner opens **Blocked Schools Review**, reviews the official coaching page in their own browser, enters its full HTTPS URL, head coach and optional notes, and explicitly confirms the source.
3. A known school-specific host proceeds to **manual staff review**, without retrying the blocked parser. A new athletics host must first be independently linked from the school's official university site and explicitly approved by the Super Owner. Host approval never approves a coach.
4. Manual staff import uses the existing guarded procedure: 1–8 structured coaches, exactly one verified head coach, names and roles checked, optional emails checked against school/athletics domains, no duplicate identities, no conflicting coach role/email overwrite, source snapshots and audit history.
5. Import is never automatic after source confirmation. A separate per-coach confirmation is required. Existing verified contacts and saved verification history are preserved.
6. Access-blocked status can be reclassified as a program-status hold only after independent evidence. Do not use this shortcut for inactive/discontinued programs.

## Division rollout
The same UI, verification endpoint, trusted-host approval, and manual staff import procedure apply to NCAA D3, NAIA and JC as soon as their college staff bootstrap queues are initialized. No D3/NAIA/JC batch processing is initiated by this fallback feature.

## Future program hold
Sonoma State University officially announced NCAA D2 softball will return for the 2027–28 season after its 2025 athletics shutdown (https://news.sonoma.edu/articles/2026/athletics-launch-fall-2027). Its queue stays blocked as a future-program hold until current coaching appointments can be independently verified. Do not import historical 2025 coaches as current.

## Cross-division coach source reviews — resolved 2026-10-14
The platform owner confirmed both cases; live records and review status were updated with audit entries. These are direct owner confirmations, not independent website verification.
- **Kayla Tauber — Saint Joseph's University (NCAA D1)**: no longer on softball staff. Marked departed, source verification stale, departure date unknown. Historical data preserved. Source-review status checked.
- **Jenna Redders — University of Wisconsin–Green Bay (NCAA D1)**: confirmed current Graduate Assistant with email reddersj@uwgb.edu. Existing role and email were correct; owner confirmation recorded. Source-review status checked.

**Unresolved source reviews: 0** in production as of 2026-10-14. Keep dynamic source-review display for future cases.

## Existing completed work
- One-time 960-coach contact backfill: completed; do not rerun.
- Targeted contact recovery pass: completed; both source-review cases resolved by owner confirmation on 2026-10-14.
- Paine College: excluded from supported divisions (NCCAA-only) with source history preserved.
