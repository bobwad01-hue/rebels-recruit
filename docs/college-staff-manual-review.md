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

## Outstanding cross-division coach source reviews
These are independent of the college bootstrap review count and must remain visible even when D2 shows zero review schools:
- **Kayla Tauber — Saint Joseph's University (NCAA D1)**: original official bio link is broken; a broken link alone is not evidence of departure. Verify current official softball staff.
- **Jenna Redders — University of Wisconsin–Green Bay (NCAA D1)**: identity conflict with current coaching roster; athlete roster evidence must not be treated as coaching evidence. Verify current official staff before changing identity, role, or contact information.

Both remain in `college_coach_contact_recovery_queue` with status `needs_review`. Do not auto-replace, auto-close, or overwrite either coach based on a broken biography or athlete roster.

## Existing completed work
- One-time 960-coach contact backfill: completed; do not rerun.
- Targeted contact recovery pass: completed; the two unresolved source-review cases remain open.
- Paine College: excluded from supported divisions (NCCAA-only) with source history preserved.
