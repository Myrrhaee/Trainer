# Product Context For GPT

## Short Product Summary

We are building **AI Strength Coach**: a premium fitness web app with two connected experiences:

1. **Client cabinet**: a mobile-first/premium personal training experience where the athlete follows workouts, logs results, tracks progress, uses an exercise library, communicates with a trainer, and can train with or without a trainer.
2. **Trainer cabinet**: a professional workspace for trainers to manage clients, build workouts/programs, track adherence and progress, sell programs, and act on alerts.

The current strongest source of product direction is the **DEMO client cabinet** already implemented in the app. The trainer cabinet should be designed in the same visual and UX language: cinematic dark UI, premium fitness feel, soft lime accents, large rounded cards, glassy panels, rich exercise visuals, and calm but powerful information architecture.

## Current Tech Context

- Framework: Next.js App Router.
- UI stack: React, Tailwind CSS utility classes, local shadcn-style UI primitives.
- Data/storage direction: Supabase is already wired for real trainer/client data in several routes.
- Demo mode exists through `lib/demo-mode.ts` and `lib/demo-data.ts`.
- Exercise library exists with many exercise images in `public/exercises/**`.
- Main demo implementation files:
  - `components/demo/demo-client-cabinet.tsx`
  - `components/demo/demo-pages.tsx`
  - `lib/demo-data.ts`
- Current trainer-related routes:
  - `/trainer/builder`
  - `/trainer/clients`
  - `/trainer/calendar`
  - `/trainer/library`
  - `/trainer/sales`
  - `/dashboard` and `/dashboard/*` legacy/admin trainer dashboard routes

## Product Roles

### Client / Athlete

The client is someone training either independently or with a trainer. The client cabinet supports several states:

- New user.
- User with trainer.
- User without trainer.
- User without selected program.
- User with active plan.

Client needs:

- Understand what to do today.
- Train immediately from a plan.
- Log results after training.
- Track body and performance progress.
- Browse exercise library and learn technique.
- Communicate with trainer.
- See history, achievements, and rhythm.

### Trainer

The trainer is an online coach managing multiple clients and/or selling programs.

Trainer needs:

- Quickly see which clients need attention.
- Understand client adherence, progress, and risk.
- Open a client profile with workouts, weight, photos/check-ins, history, notes, and assigned programs.
- Create workouts and programs from exercise library.
- Assign workouts/programs to clients or save templates.
- Manage their own exercise library, including custom exercises.
- Track sales, revenue, program purchases, and public trainer profile.
- Communicate with clients through Telegram or in-app messaging hooks.

## Visual Language

The product should feel like a **premium dark fitness operating system**, not a generic admin panel.

Core visual patterns:

- Black/zinc background.
- Subtle gradients and radial lime highlights.
- Lime accent for active progress and primary actions.
- Rounded large cards: `rounded-[1.5rem]` to `rounded-[2.25rem]`.
- Thin low-contrast borders: zinc/white opacity.
- Glassy panels over cinematic background images.
- Large typography with tight tracking.
- Calm text hierarchy: zinc-50 for main, zinc-400/500 for supporting text.
- Exercise images are central to perceived quality.
- UI should be information-rich but not noisy.

Avoid:

- Generic white SaaS dashboard look.
- Flat tables as the only client management surface.
- Empty placeholder pages.
- Overly bright neon.
- Cramped mobile-unfriendly layouts.

## Current DEMO Client Cabinet Screens

These are the most important reference screens for product quality and interaction design.

### `/client/me` - Client Home

Implemented as `DemoClientMePage` in `components/demo/demo-client-cabinet.tsx`.

Purpose:

- Client overview and daily orientation.
- Shows current state, goal, rhythm, workout/program status, trainer relation, tasks, and next actions.

Important patterns:

- Multiple client states are simulated: new, with trainer, no trainer, no program, active plan.
- Hero section changes based on state.
- Cards show progress, upcoming tasks, trainer comment, activity, recommendations.
- Trainer mode includes trainer comment and CTA to message trainer.
- The screen is not just metrics; it guides behavior.

For trainer cabinet, mirror this idea: dashboard should tell the trainer what matters now, not just list numbers.

### `/client/workouts` - Workouts

Implemented as `DemoClientWorkoutsPage`.

Purpose:

- Client workout hub.
- Supports two modes: with trainer and solo.
- Has large cinematic hero, weekly rhythm, planned sessions, history, trainer sidebar, and best-performance anchors.

Key interactions:

- Top actions:
  - Start by plan.
  - Free workout.
  - Repeat workout.
- Choosing a workout opens a decision dialog:
  - **Train now**.
  - **Log results**.

#### Train Now

This is a premium guided workout mode:

- Hero with session context.
- Current exercise card.
- Exercise image.
- Technique modal.
- Set progression.
- Rest timer.
- Route/sequence of exercises.
- Finish modal with RPE, feeling, and note.

This is the quality bar for trainer-side program builder and client workout review.

#### Log Results

Recently upgraded and important:

- Starts empty.
- User adds exercises from the library or creates a custom exercise.
- Library exercise cards include images.
- Clicking exercise image opens the same exercise detail modal as the library.
- Each exercise gets empty set rows.
- When the first set is filled, values are auto-filled into untouched later sets.
- Auto-filled values are shown in grey.
- If user edits a later set manually, that field disconnects from auto-sync.
- A set cannot be marked "done" unless both weight and reps are filled.
- Empty journal cannot be saved.

This pattern is important for trainer-side review: trainers should be able to inspect logged workouts with actual sets, auto-filled vs manually changed values, completion state, and notes.

### `/client/library` - Exercise Library

Implemented as `DemoClientLibraryPage`.

Purpose:

- Browse exercise library.
- Search and filter by category/equipment.
- Exercise cards are visual and premium.
- Detail modal contains technique, muscles, usage notes, tips, and mistakes.

Trainer cabinet should reuse this library as a central primitive:

- Build workouts from it.
- Add custom exercises.
- Open exercise detail in modals.
- Possibly copy system exercises into trainer library.

### `/client/activity` - Activity

Implemented as `DemoClientActivityPage`.

Purpose:

- Calendar/month view of activity.
- Highlights training days, best days, PR days, streaks, monthly comparison, and exercise details.
- Shows workout sessions with exercise images and tonnage/reps.

Trainer-side client detail should reuse this mental model:

- Client activity calendar.
- Missed sessions.
- Last completed workouts.
- Recent PRs.
- Training density and adherence.

### `/client/progress` - Progress

Implemented as `DemoClientProgressPage`.

Purpose:

- Body metrics, strength progress, records, trends, charts.
- Helps client and trainer understand progress over time.

Trainer-side client detail should include:

- Weight trend.
- Measurements.
- Strength records.
- Photos/check-ins.
- Adherence and volume.
- Notes from trainer.

### `/client/settings` - Client Settings

Implemented as `DemoClientSettingsPage`.

Purpose:

- Profile data, trainer connection, privacy, notifications, progress visibility.

Trainer cabinet should have analogous settings:

- Trainer profile.
- Public page.
- Telegram/contact.
- Subscription/sales.
- Team/logo.
- Program visibility.

## Current DEMO Trainer Screens

There is an older/simple demo trainer dashboard in `components/demo/demo-pages.tsx`. It is useful for content but not yet at the same visual quality level as the new client DEMO.

### `DemoTrainerDashboardPage`

Current content:

- Trainer identity: Алексей Романов / Romanov Coaching.
- Metrics from `getDemoTrainerSummary()`.
- "Requires attention" cards.
- Quick actions.
- Client roster.
- Short analytics.

Demo trainer data includes:

- Trainer:
  - full name: Алексей Романов.
  - display name: Romanov Coaching.
  - slug: `romanov-coach`.
  - public link: `/t/romanov-coach`.
- Metrics:
  - active clients.
  - monthly revenue/sales.
  - client activity/completion.
- Attention items:
  - clients needing action.
  - priorities.
  - suggested action and secondary action.
- Clients:
  - name, email, goal, status, weight, last active, progress, program.
- Analytics:
  - activity clients.
  - program sales.
  - average check.
- Recent sales.

This content should be redesigned into the new premium visual system.

### `DemoProgramsPage`

Simple program cards:

- Program title.
- Number of weeks.
- Price.
- Status.
- Number of training days.
- Actions: open/duplicate.

Trainer cabinet should turn this into a serious program management space.

### `DemoAnalyticsPage`

Simple analytics:

- Client activity.
- Program sales.
- Average check.
- Recent sales list.

Trainer cabinet should expand this into sales + client engagement analytics.

### `DemoTrainerSettingsPage`

Simple settings:

- Trainer name.
- Team name.
- Telegram.
- Public URL.
- Description.
- Save locally.
- Open public profile.

Useful for trainer profile/settings scope.

## Existing Real Trainer Routes

These routes exist but are inconsistent in quality and routing style.

### `/trainer/builder`

This is the most advanced trainer-side real feature.

Purpose:

- Build workouts/program days from exercise library.
- Choose client/program/day.
- Add exercises from system or custom library.
- Edit exercise parameters:
  - sets.
  - reps.
  - weight.
  - rest.
  - comments.
  - RPE.
  - tempo.
  - per-set mode.
- Save draft locally.
- Save templates locally.
- Persist program through API `/api/trainer/programs`.
- Uses Supabase when not in demo mode.

Important files:

- `app/trainer/builder/page.tsx`
- `components/trainer/exercise-library-panel.tsx`
- `components/trainer/workout-exercise-card.tsx`
- `components/trainer/workout-form-header.tsx`
- `components/trainer/workout-builder-types.ts`

This builder should be visually upgraded to match the DEMO client quality, but its functional core is valuable.

### `/trainer/clients`

Currently mostly placeholder:

- Sidebar navigation.
- Empty "Clients" content.

This is a top priority for building trainer cabinet.

### `/trainer/dashboard`

Currently redirects to `/dashboard`.

Potential issue:

- There are two route groups/styles: `/trainer/*` and legacy `/dashboard/*`.
- For product clarity, trainer cabinet should ideally live under `/trainer/*`, or there should be one clear route convention.

### `/trainer/calendar`, `/trainer/library`, `/trainer/sales`

These routes exist. Some proxy to `src/app/(trainer)` pages or are placeholders. Need review before building.

### `/dashboard/*` Legacy/Admin Trainer Pages

There are substantial pages under `app/(admin)/dashboard/*`:

- dashboard.
- clients.
- client detail.
- programs.
- program detail.
- library.
- analytics.
- subscribe.
- settings.

They contain useful Supabase loading/query logic and data contracts, but the visual quality and routing should be reconciled with the new trainer cabinet direction.

## Suggested Trainer Cabinet Information Architecture

Recommended main navigation:

1. **Dashboard**
2. **Clients**
3. **Calendar**
4. **Builder**
5. **Programs**
6. **Library**
7. **Sales**
8. **Settings**

The current `/trainer/builder` nav has:

- Dashboard
- Clients
- Builder
- Calendar
- Library
- Sales

Add or merge Programs depending on product decision.

## Trainer Dashboard Direction

The trainer dashboard should not be a generic KPI page. It should answer:

- Who needs my attention today?
- Which clients are drifting?
- What programs/sessions are due?
- What happened since I last opened the app?
- Where can I act quickly?
- How is my business doing?

Recommended sections:

### Hero / Today Command Center

Content:

- Trainer identity.
- Today summary.
- Number of active clients.
- Alerts count.
- This week completion rate.
- Monthly revenue.
- Primary CTA: create workout / open attention queue.

Visual:

- Cinematic large card.
- Trainer avatar/logo.
- Lime highlight for urgent action.
- Maybe background with gym/training imagery.

### Attention Queue

Cards for:

- Missed workout.
- No activity for X days.
- Weight/check-in overdue.
- Client completed workout and needs feedback.
- Program ending soon.
- Payment/subscription issue.
- Technique note requested.

Each item should have:

- Client name/avatar.
- Reason.
- Priority.
- Last event time.
- Primary action.
- Secondary action.

### Client Rhythm / Adherence

Show:

- Clients on plan.
- Clients at risk.
- Completed sessions this week.
- Missed sessions.
- Upcoming check-ins.

### Quick Actions

Actions:

- Create workout.
- Assign program.
- Message client.
- Review latest results.
- Open library.
- Add payment/program.

### Business Snapshot

For trainer monetization:

- Revenue this month.
- Program purchases.
- Average check.
- Recent sales.
- Public profile link.

## Clients Page Direction

The clients page should be a premium roster, not just a table.

Recommended features:

- Search.
- Filters:
  - all.
  - active.
  - needs attention.
  - paused.
  - no program.
  - check-in overdue.
- Client cards/table hybrid.
- Each client item:
  - avatar/initials.
  - status.
  - goal.
  - current weight and delta.
  - adherence.
  - last workout.
  - next workout.
  - program.
  - last activity.
  - quick actions: open, message, assign.
- Summary strip:
  - active clients.
  - at risk.
  - due check-ins.
  - average adherence.

Empty state:

- Premium card encouraging adding/linking first client.
- Actions:
  - copy invite link.
  - create public profile.
  - import/demo client.

## Client Detail For Trainer

This will likely be one of the most important trainer screens.

Recommended tabs/sections:

1. Overview
2. Workouts
3. Progress
4. Check-ins
5. Programs
6. Notes

### Overview

Content:

- Client identity and goal.
- Current program/week.
- Adherence.
- Weight trend.
- Last workout.
- Next workout.
- Alerts.
- Trainer notes.
- CTA: message, assign workout, update program.

### Workouts

Use client DEMO workout log patterns:

- Completed sessions.
- Actual sets.
- Exercise images.
- RPE/feeling/note.
- Missed/planned sessions.
- Trainer comments.
- Ability to open exercise detail modal.

### Progress

Use client progress/activity patterns:

- Weight chart.
- Measurements.
- Photos/check-ins.
- Strength records.
- Volume/adherence.

### Notes

Private trainer notes:

- Date/time.
- Category.
- Pin important note.
- Link note to workout/check-in.

## Builder / Program Creation Direction

The existing `/trainer/builder` already has functional depth. Product direction:

- Make it feel like the client "Train Now" and "Exercise Library" screens.
- Left side: workout/program structure.
- Right side: searchable exercise library with images.
- Exercise cards should open detail modal.
- Drag/reorder could be future.
- Support:
  - day templates.
  - per-set mode.
  - blocks/supersets.
  - notes.
  - RPE.
  - tempo.
  - rest.
  - preview as client.
  - save as template.
  - assign to client/program day.

Program builder should support:

- Multi-week program.
- Week/day structure.
- Paid/free programs.
- Marketplace/public availability.
- Duplicate day/week.
- Copy template.

## Library Direction

The exercise library is a core asset.

Current library supports:

- System exercises.
- Custom trainer exercises.
- Images.
- Muscle groups.
- Equipment.
- Difficulty.
- Technique steps.
- Tips.
- Detail modal.

Trainer library should support:

- Browse system exercises.
- Save/copy to my library.
- Create custom exercise.
- Add custom image/video.
- Mark favorites.
- Use in builder.
- Filter by category/equipment.

## Sales / Monetization Direction

The product includes trainer monetization:

- Paid programs.
- Consultations.
- Subscriptions or packages.
- Public trainer page at `/t/[slug]`.
- Recent sales.
- Revenue dashboard.

Trainer sales screen should include:

- Monthly revenue.
- Sales count.
- Average check.
- Program conversion.
- Recent purchases.
- Public profile status.
- CTA to create paid program.

## Public Trainer Profile

A public route exists conceptually:

- `/t/romanov-coach`
- Trainer has `slug`, `displayName`, `publicLink`.

This page should help clients discover/buy/connect:

- Trainer bio.
- Programs.
- Social proof.
- Contact/Telegram.
- CTA to start or buy program.

## Data Concepts

Important entities already implied by code:

- `profiles`
  - trainer and client profiles.
  - client can have `trainer_id`.
  - trainer can have public metadata: name, slug, logo, etc.
- `trainer_clients`
  - link between trainer and client.
  - access state.
- `programs`
  - trainer-owned programs.
  - weeks.
  - price/status.
- `workouts` / workout logs
  - planned and completed sessions.
  - exercises.
  - sets.
  - weight/reps.
  - status.
- `exercise_library`
  - system and trainer-owned exercises.
- `payments`
  - sales/revenue.
- check-ins/photos/weight logs
  - used by client progress and trainer review.

## Style/UX Rules For New Trainer Screens

Use these rules when generating UI:

- Use the client DEMO as the quality bar.
- Keep dark premium aesthetic.
- Use lime only for active/positive/primary states.
- Keep secondary UI muted, not colorful.
- Use exercise images wherever exercise context exists.
- Avoid plain empty tables.
- Use cards that imply action and priority.
- Make "what should I do next?" obvious.
- Add skeleton/empty states that feel designed.
- Make mobile responsive from the start.
- Keep content Russian-facing for UI copy.
- Prefer concise Russian labels.

## Immediate Product Goal

We want to start building the **trainer personal cabinet** based on the DEMO screens.

Recommended starting point:

1. Build a premium `/trainer/dashboard` that does not redirect to `/dashboard`.
2. Reuse `getDemoTrainerSummary()` as initial data.
3. Match the client DEMO visual system from `DemoClientWorkoutsPage` and `DemoClientMePage`.
4. Build the dashboard around:
   - Today command center.
   - Attention queue.
   - Client roster preview.
   - Business snapshot.
   - Quick actions.
5. Then build `/trainer/clients` as the next major page.

## Suggested Prompt For GPT

Use this prompt after this context:

> We are building the trainer cabinet for AI Strength Coach. Use the current DEMO client cabinet as the visual and UX standard. Design and implement the trainer dashboard first. It should feel premium, dark, cinematic, action-oriented, and should use demo trainer data. Avoid generic admin tables. Include a command-center hero, attention queue, client rhythm/adherence, quick actions, client roster preview, and business snapshot. Keep the UI Russian-facing and consistent with the existing Tailwind/shadcn style.

