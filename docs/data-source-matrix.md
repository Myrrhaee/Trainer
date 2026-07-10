# Data Source Matrix

Дата аудита: 2026-07-10  
Метод: imports, Supabase calls, mock files, localStorage keys, API usage.

## Source Legend

| Source | Meaning |
| --- | --- |
| inline mock | Data declared inside page/component. |
| mock file | Data imported from `mock-data.ts`. |
| demo adapter | Data from `lib/demo-data.ts` or `components/demo/*`. |
| Supabase | Direct Supabase client/admin calls. |
| API | Fetch to local API route. |
| localStorage | Browser persistence only. |
| mixed | More than one of the above. |
| unknown | Not enough evidence. |

## Core Mock/Demo Sources Checked

| File | What it contains | Evidence | Current use | Risk |
| --- | --- | --- | --- | --- |
| `lib/demo-data.ts` | Demo dashboard metrics, attention, roster clients, programs, exercise library, trainer/client summaries | types at `lib/demo-data.ts:4-44`; exports at `lib/demo-data.ts:1811-1861` | Client demo pages, trainer builder/programs/sales/review | Large central demo adapter can diverge from Supabase schema |
| `components/demo/demo-client-cabinet.tsx` | Demo client me/workouts/library/activity/progress/settings | exports at `components/demo/demo-client-cabinet.tsx:625`, `:1181`, `:3294`, `:3509`, `:4495`, `:5278` | `/client/*` demo mode, `/trainer/library` content | High design-source value but not real data |
| `components/trainer-os/home/mock-data.ts` | Trainer home team map/status/activity mock | starts at `components/trainer-os/home/mock-data.ts:5-23` | `/trainer/dashboard` | No real team/attention source |
| `components/trainer-os/dashboard/mock-data.ts` | Operating dashboard filters/clients/review/assignment queues | starts at `components/trainer-os/dashboard/mock-data.ts:13-43` | dashboard components | May duplicate home mock and attention model |
| `components/trainer-os/client-profile/mock-data.ts` | Full athlete profile: membership, events, analytics, achievements, titles, body/progress | starts at `components/trainer-os/client-profile/mock-data.ts:13`; getter at `:531-532` | `/trainer/clients/[clientId]` | Biggest divergence risk from actual client data |

## Screen And Component Data Sources

| Screen/component | Data displayed | Source | Domain entity implied | Shared client/trainer entity? | Divergence risk | Proposed source of truth |
| --- | --- | --- | --- | --- | --- | --- |
| Landing `components/landing/landing-page.tsx` | Auth role/CTA state | Supabase `profiles.role` | Profile/UserRole | Yes | Medium | `profiles.role` |
| Login `app/login/page.tsx` | Role, demo session, profile sync | mixed: demo mode + Supabase + API | User, Profile, TrainerClientRelation | Yes | High due redirect conflict | Supabase Auth + `profiles` + `trainer_clients` |
| Client home `/client/me` | Profile, trainer, logs, reviews, programs, weight trend | mixed: demo adapter or Supabase | ClientProfile, TrainerProfile, WorkoutLog, Review, Program, WeightLog | Partially | High | Supabase views/adapters for client dashboard |
| Client dashboard `/client/dashboard` | Loading/redirect only | Supabase auth | User | Yes | Low | Redirect route only |
| Client workouts `/client/workouts` | Workout hub | demo adapter; non-demo redirect | WorkoutAssignment, WorkoutSession | Not yet | High | `workout_assignments`/`assigned_programs` + `workout_logs` |
| Client progress `/client/progress` | Body/strength charts | demo adapter; non-demo redirect | WeightLog, BodyMeasurement, StrengthMetric, ProgressPhoto | Not yet | High | `weight_logs`, measurements table, workout logs, photos |
| Client activity `/client/activity` | Activity calendar/history | demo adapter; non-demo redirect | WorkoutSession, ActivityDay | Not yet | High | `workout_logs` + scheduled workouts |
| Client library `/client/library` | Exercise library | demo adapter or placeholder | Exercise | Partially with trainer | Medium | `exercise_library` |
| Client settings `/client/settings` | Profile, metrics, password | mixed: demo or Supabase | Profile, AuthUser | Yes | Medium | `profiles` + Supabase Auth |
| Legacy workout `/client/[id]` | Workout execution, access, logs, custom exercises | mixed: Supabase + localStorage + API | WorkoutTemplate, WorkoutLog, Exercise, AccessGrant | Partially | High | Assignment/session tables + `workout_logs` |
| Check-in `/check-in` | Weight/check-in summary | Supabase | Profile, WeightLog, WorkoutLog | Partially | Medium | `weight_logs`, future check-ins table |
| History `/history` | Workout history | Supabase | WorkoutLog | Yes | Medium | `workout_logs` |
| Programs `/programs` | Assigned/purchased programs | Supabase | Program, ClientProgram, AssignedProgram | Yes | High | One access model: `program_assignments` or current chosen table |
| Trainer dashboard `/trainer/dashboard` | Team state, activity, queue | mock file | TeamClient, AttentionItem | No | Very high | Persisted `trainer_clients` + generated `attention_items` |
| Trainer clients `/trainer/clients` | Roster, status, attention | mixed: inline demo + Supabase | TrainerClient, WorkoutLog, Review, AssignedProgram | Partially | High | `trainer_clients` joined with profile/log/review summaries |
| Trainer profile `/trainer/clients/[clientId]` | Full athlete profile | mock file | AthleteProfile, Membership, Events, Achievements, Progress | No | Very high | Unified athlete profile query/view |
| Trainer profile progress tab | Weight, body changes, strength, photos | mock props + Recharts | WeightLog, Measurement, ExerciseProgress, Photo | No | Very high | Same progress source as client progress |
| Trainer library `/trainer/library` | Exercise library content | demo component | Exercise | Partially | Medium | `exercise_library` with trainer-owned/system scopes |
| Builder `/trainer/builder` | Exercise library, clients, programs, templates, draft, assignments | mixed: demo + Supabase + localStorage + API | WorkoutTemplate, Exercise, Client, Assignment | Partially | High | `trainer_builder_templates`, `exercise_library`, assignment table |
| Programs `/trainer/programs` | Programs and assignments | mixed: demo + Supabase + localStorage | Program, AssignedProgram, Client | Partially | High | `workout_templates`, chosen assignment/access tables |
| Review page `/trainer/review/[workoutId]` | Workout review details, comments, exercises | inline mock + demo library | WorkoutReview, WorkoutLog | No | High | `trainer_workout_reviews` + `workout_logs` |
| Review drawer | Review action from profile/dashboard | unknown/local UI | WorkoutReview | No | High | Same as review page |
| Messages `/trainer/messages` | Threads, messages, replies | mixed: inline + localStorage + Supabase | MessageThread, TrainerClientMessage | Partially | Medium | `trainer_client_messages` + client counterpart |
| Automation `/trainer/automation` | Rules and queue | inline + localStorage | AutomationRule, AutomationQueueItem | No | High | `trainer_automation_rules` + generated queue |
| Insights `/trainer/insights` | Risk/growth cards/actions | inline mock | ClientInsight, InsightAction | No | High | `trainer_client_insights` |
| Reports `/trainer/reports` | Weekly reports | inline + localStorage | ClientReport | No | High | `trainer_client_reports` |
| Sales `/trainer/sales` | Products, sales stats | demo programs + local state | SalesProduct, Payment, Buyer | No | High | Product table + `payments`/payment provider |
| Payments API | Payment access updates | API + Supabase admin | ClientProgram, Profile, Payment | Partially | High | Provider webhook + payment/subscription tables |
| Achievements catalog | Achievement definitions | code catalog + assets | AchievementDefinition, UserAchievement | No confirmed | High | DB definitions or versioned static catalog + user state |
| Titles | Title definitions/status | docs + mock profile | TitleDefinition, UserTitle | No confirmed | High | DB/user title state |
| Reputation ranks | Rank definitions/current rank | code catalog + mock profile | ReputationRank, AthleteReputation | No confirmed | High | computed reputation service/table |

## Supabase Tables/Functions Observed In Code

| Table/function | Evidence | Used by |
| --- | --- | --- |
| `profiles` | many reads/writes, e.g. `app/login/page.tsx:224-248`, `app/client/settings/page.tsx:97-100` | auth, client, trainer, APIs |
| `trainer_clients` | `app/(client)/client/[id]/page.tsx:218-219`, `app/api/link-trainer/route.ts:118-123` | access/linking |
| `workout_logs` | `app/(client)/client/[id]/page.tsx:331-551`, `app/client/me/page.tsx:313-328` | client history/progress |
| `weight_logs` | `components/client/WeightTracker.tsx:45-131` | weight tracking |
| `workout_templates` | `app/trainer/programs/page.tsx:499-500`, `app/api/trainer/programs/route.ts:222-224` | programs/templates |
| `assigned_programs` | `app/client/me/page.tsx:367-368`, `app/trainer/programs/page.tsx:504-505` | assigned program access |
| `client_programs` | `app/api/webhooks/payment/route.ts:119-120` | purchased program access |
| `exercise_library` | `lib/exercise-library.ts:94-267` | library/builder |
| `trainer_builder_templates` | `app/trainer/builder/page.tsx:478-508` | builder templates |
| `trainer_workout_reviews` | `app/client/me/page.tsx:348-349`; migration exists | client home/review state |
| `trainer_client_messages` | `app/trainer/messages/page.tsx:477-658` | trainer messages |
| `trainer_settings` | `app/trainer/settings/page.tsx:269-376` | trainer settings |
| `payments` | `app/(admin)/dashboard/analytics/page.tsx:103-206` | legacy analytics |
| `mark_trainer_workout_review_seen` | `app/client/me/page.tsx:1622`; migration `20260403120000` | client review read state |
| `copy_system_exercise_to_my_library` | `lib/exercise-library.ts:267`; migration `20260402120000` | exercise library |

## Entity Consistency Notes

| Entity | Current state | Risk |
| --- | --- | --- |
| Athlete/Profile | `profiles` exists, but trainer profile uses `AthleteProfile` mock type | High |
| WorkoutAssignment | split between `assigned_programs`, localStorage assignment payloads, `client_programs` | High |
| WorkoutReview | `trainer_workout_reviews` exists, review route is inline mock | High |
| Progress | client uses real `weight_logs` in some screens; client progress and trainer progress are demo/mock | High |
| Exercise | strongest consistency: `exercise_library` plus demo exercise assets | Medium |
| Messages | table exists and trainer screen uses it with fallback | Medium |
| Achievements/Titles/Ranks | docs/code catalogs, no DB/user state | High |
| AttentionItem | multiple UI models, no confirmed DB table | Very high |

## Engineering Review

**Overall verdict:** data layer is the main source of product uncertainty. Several real Supabase paths exist, but the newest and most important product screens still rely on mock/demo/local state.

**Главные риски:** duplicated domain models, mock athlete profile, undefined assignment/review/attention source of truth.

**Блокеры следующего этапа:** decide canonical entities and adapters before extending UI.

**Нужны ответы:** source-of-truth owner for AthleteProfile, WorkoutAssignment, Review, AttentionItem, Achievement state.
