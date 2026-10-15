# College Staff Intelligence — manual fallback and open source reviews

## Scope
Supported recruiting divisions: NCAA D1, NCAA D2, NCAA D3, NAIA, and JC (JUCO). The Super Owner manual fallback is **division-agnostic** and becomes available when a school's bootstrap queue is populated. Do not start new division-wide imports as part of manual cleanup.

## Access-blocked official athletics sites
1. HTTP 403, robots, forbidden or access-denied errors are **not** proof that the softball program is inactive. Confirm the program and current softball coaching staff on the school's official website.
2. The Super Owner opens **Blocked Schools Review**, reviews the official coaching page in their own browser, enters its full HTTPS URL, head coach and optional notes, and explicitly confirms the source.
3. A Super Owner-confirmed, exact official softball coaching URL is sufficient to enter **manual staff review** for an access-blocked page. No unrelated university-page search is required. The URL and school are preserved; no coach is approved by confirming a source.
4. Manual staff import uses the existing guarded procedure: 1–8 structured coaches, exactly one verified head coach, names and roles checked, optional emails checked against school/athletics domains; off-domain emails require an explicit per-coach Super Owner attestation that the exact email appears on the saved official coaching page, with the source URL, verifier and timestamp recorded in the coach source snapshot; no duplicate identities, no conflicting coach role/email overwrite, source snapshots and audit history.
5. If the saved head-coach suggestion conflicts with the official page (including scraped directory headings), the Super Owner must explicitly confirm the correct head coach. The manual import then updates the saved head-coach name and preserves the previous suggestion, source, verifier and timestamp in coach source history. Automatic imports continue to reject head-coach mismatches.
6. For access-blocked sources, import is never automatic after source confirmation: a separate per-coach confirmation is required. For accessible pages, the targeted importer may import coaches only after passing its identity, head-coach, and conflicting-contact quality gates. Existing verified contacts and source history are preserved.
7. Access-blocked status can be reclassified as a program-status hold only after independent evidence. Do not use this shortcut for inactive/discontinued programs.

## Division rollout
The same saved-source confirmation, direct one-school validation, and guarded manual fallback apply to NCAA D3, NAIA and JC as soon as their college staff bootstrap queues are initialized. No D3/NAIA/JC batch processing is initiated by this fallback feature.

## Saved coaching URLs — direct staff validation
- When the Super Owner has already verified a school's exact HTTPS softball coaching URL, do **not** require additional university-page discovery or an athletics-domain link.
- The signed-in Super Owner can confirm the saved URL and start a targeted one-school import. The route uses the saved URL without replacing it; verified sources do not fall back to rediscovery if fetching or parsing fails.
- The confirmation is audited as `college_staff_saved_source_direct_validation`. It does not create a claim of independently verified university-domain ownership, and it does not approve coaches.
- Fetches respect robots and strict same-host HTTPS redirects. If blocked, preserve the URL and flag manual review. Never fabricate missing head coaches or assign unverified contact details.
- On 2026-10-14, eight previously Super Owner-verified NCAA D2 coaching URLs (Delta State, Emmanuel GA, Glenville State, Lynn, Ouachita Baptist, Palm Beach Atlantic, Central Oklahoma, Upper Iowa) were queued for direct one-school validation. No division-wide backfill was initiated.
- Lynn's saved 2026 page lists an assistant but no head coach. Keep in review until a current head coach can be verified. Upper Iowa's 2027 page lists Rachel Rhode and Taylor Hamaker; legacy coaches absent from that page require individual lifecycle review, not an automatic historical rewrite.

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
