# PostgreSQL Migration History Recovery v1

Platform position: PostgreSQL is canonical; a clean Supabase staging project is the default implementation path. The configured remote is unknown legacy and receives no new migrations. Local migrations are not a proven complete source of truth.

## Local timeline

| Version | Local effect | Remote status | Confidence / later action |
|---|---|---|---|
| `20250316120000` | ALTER missing-baseline `profiles`: kg/cm target fields | Unknown | High local; reconcile duplicate facts |
| `20250317100000` | ALTER `profiles`: alternate weight/height/target fields | Unknown | High local; reconcile duplicate facts |
| `20260402120000` | Exercise library, seed/import, RLS, trigger, copy function | Unknown | High local; verify actual columns/policies/data |
| `20260402143000` | Exercise arrays, larger seed, replace copy function | Unknown | High local; verify seed provenance and function definition |
| `20260403120000` | Date reviews, policies, trigger, seen RPC | Unknown | High local; legacy-only target |
| `20260404120000` | Builder JSON templates, policies, trigger | Unknown | High local; import as drafts only |
| `20260405120000` | Trainer settings JSON, policies, trigger | Unknown | High local; non-core |
| `20260406120000` | Messages and policies | Unknown | High local; relation security remediation |
| `20260407120000` | Automation rules and policies | Unknown | High local; defer |
| `20260408120000` | Client insights and policies | Unknown | High local; derived projection/defer |
| `20260409120000` | Client reports and policies | Unknown | High local; defer |

Versions are unique with no ordering duplicate. There are 11 local files. Matching, remote-only and local-only counts are unknown.

## Missing baseline and unknown provenance

- The first migrations ALTER `profiles`; eight later tables reference it, but no local CREATE exists.
- Code expects nine additional database tables without CREATE migrations.
- Migration comments mention possible Supabase SQL Editor execution.
- No `supabase/config.toml`, CLI link metadata, local migration status cache or remote history is available.
- The configured project endpoint does not resolve; project name/region/environment are unknown.

Therefore local files cannot be declared authoritative, and manual Dashboard/SQL changes cannot be confirmed or excluded.

## Verified baseline procedure

1. Confirm owner-approved project ref/environment and restore read-only access.
2. Export schema-only metadata: application schemas, columns, constraints, indexes, owners/grants, RLS/policies, functions/triggers/extensions and migration history.
3. Record aggregate counts/provenance classes separately; do not include rows in Git.
4. Hash and compare remote definitions to each local migration effect.
5. Classify remote-only/local-only/divergent objects and establish creation provenance.
6. Produce a reviewed baseline migration capable of creating the verified legacy schema on an empty disposable PostgreSQL.
7. Add canonical Stage 3 changes only after baseline tests pass.

The first canonical staging baseline does not automatically import unknown remote rows, localStorage data or ambiguous date reviews. Legacy reviews require deterministic source evidence; no synthetic WorkoutSession is created. If the old project is found, preserve it read-only until data disposition is approved.

## Why migration repair is prohibited now

Repair changes history without proving schema equivalence. With an unidentified/unreachable environment and missing baseline, it could mark unapplied SQL as applied, hide manual changes or cause future destructive drift. No repair/push/reset should occur until exact remote history and schema hashes are reviewed.

## Portability validation

- Run core/baseline migrations against clean supported PostgreSQL in CI/disposable environment.
- Separate standard application objects from Supabase Auth/RLS grants and Storage infrastructure.
- Keep `auth.uid()` policies in a Supabase adapter migration layer.
- Avoid embedding Storage buckets, Auth triggers or service-role assumptions in core domain migrations.
- Validate canonical constraints/transitions both with PostgreSQL tests and Supabase integration tests.

## Recovery artifacts (not yet produced)

- Redacted environment identity record.
- Schema-only dump/catalog JSON outside tracked source.
- Remote migration version/hash list.
- Object drift manifest and row-count reconciliation.
- Verified baseline checksum and clean-build report.

## Decision candidates for Product Lead review

| Candidate | Recommendation | Required evidence |
|---|---|---|
| Declare local migrations authoritative | No | Remote schema/history equivalence |
| Repair remote history | No until baseline and hashes are verified | Owner-approved recovery review |
| Recover old project after staging | Proposed only when valuable/auditable data is confirmed | Founder confirmation and remote evidence |
| Keep migrations provider-neutral | Yes; isolate Auth/Storage policies | Clean PostgreSQL test |
| Include ProgressPhoto Storage objects in first migration | Proposed separately | Product/privacy decision |
