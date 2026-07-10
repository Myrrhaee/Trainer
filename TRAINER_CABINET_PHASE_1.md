# Trainer Cabinet Phase 1: Product Spine

## Product Intent

Trainer cabinet is not an admin area for the client app. It is the trainer's daily command center: a premium, dark, action-oriented workspace for managing attention, client progress, programming, and revenue.

The client cabinet motivates an athlete to keep rhythm. The trainer cabinet helps a professional coach protect quality at scale.

## Core Promise

When a trainer opens the cabinet, they should immediately understand:

- who needs attention now;
- which clients are drifting or blocked;
- what has happened since the last visit;
- which workouts, check-ins, and programs require action;
- where money is coming from;
- what the next best action is.

## Primary User

The primary user is an online strength or fitness coach who manages multiple clients and may also sell programs.

This trainer needs a workspace that is:

- fast to scan;
- dense enough for professional use;
- visually premium, not generic SaaS;
- action-first, not report-first;
- mobile-usable, but desktop-strong.

## Daily Trainer Loop

1. Open dashboard.
2. Review attention queue.
3. Open clients who need feedback, check-ins, or programming.
4. Comment on completed workouts.
5. Assign or edit workouts/programs.
6. Check client rhythm and risk.
7. Review recent sales and public profile status.
8. Close the day with fewer unresolved items.

## Main Product Questions

Every trainer page should answer at least one of these questions:

- Who needs me?
- What changed?
- What should I do next?
- Is the client progressing?
- Is the program working?
- Is my coaching business moving?

If a block does not answer one of these questions, it is probably decorative.

## Core Entities

### Client

The client is the main operational unit for the trainer.

Important fields:

- name;
- goal;
- current status;
- current program;
- adherence;
- last activity;
- last workout;
- latest weight/check-in;
- risk/attention reason;
- communication link.

### Attention Item

Attention items are the heart of the trainer experience.

Examples:

- missed workout;
- no activity for several days;
- check-in overdue;
- client completed workout and waits for feedback;
- new client without program;
- program ending soon;
- payment issue;
- technique note requested.

Every attention item needs:

- client;
- reason;
- urgency;
- time;
- primary action;
- secondary action.

### Workout

Workouts exist in two states:

- planned by trainer;
- completed/logged by client.

Trainer needs to see both the prescription and the actual result: exercises, sets, weights, reps, RPE, feeling, notes, and technique context.

### Program

Programs are both coaching structure and monetization object.

Important fields:

- title;
- goal;
- weeks;
- days;
- visibility: private/public;
- price;
- assigned clients;
- status;
- sales performance.

### Exercise

The exercise library is a core product asset.

Trainer needs:

- system exercises;
- personal exercises;
- images/video;
- technique detail;
- filters;
- usage in builder;
- copy/save/favorite behavior.

### Sale

Sales connect the trainer workspace to business outcomes.

Important fields:

- program;
- amount;
- buyer/client;
- date;
- status;
- source: public profile, direct assignment, marketplace.

## Required Pages

### 1. Dashboard

Role: daily command center.

Must include:

- Today Command Center hero;
- Attention Queue;
- Client Rhythm / Adherence;
- Roster Preview;
- Recent Activity;
- Quick Actions;
- Business Snapshot.

This page sets the quality bar for the whole trainer cabinet.

### 2. Clients

Role: operational roster.

Must include:

- search;
- filters;
- attention states;
- client cards or table-card hybrid;
- adherence;
- last activity;
- current program;
- quick actions.

### 3. Client Detail

Role: complete coaching context for one client.

Must include:

- overview;
- workouts;
- progress;
- check-ins;
- photos;
- programs;
- trainer notes;
- action bar.

### 4. Builder

Role: create and assign workouts/program days.

Must include:

- exercise library;
- workout structure;
- per-set mode;
- comments;
- RPE;
- tempo;
- rest;
- save draft/template;
- assign to client/program;
- client preview.

### 5. Programs

Role: manage training products.

Must include:

- private programs;
- public programs;
- price;
- visibility;
- duplicate/archive;
- assign;
- edit content;
- sales packaging.

### 6. Library

Role: exercise knowledge base.

Must include:

- system library;
- trainer library;
- filters;
- media;
- detail modal;
- create/edit custom exercises;
- use in builder.

### 7. Calendar

Role: planning and schedule awareness.

Must include:

- planned workouts;
- missed workouts;
- check-ins;
- filters by client;
- reschedule actions;
- quick open client/workout.

### 8. Sales

Role: business layer.

Must include:

- revenue;
- program sales;
- average check;
- recent purchases;
- payment status;
- public profile link;
- CTA to create/sell program.

### 9. Settings

Role: trainer identity and workspace configuration.

Must include:

- name;
- team name;
- logo;
- Telegram/contact;
- public slug;
- profile visibility;
- notifications;
- payment/business settings.

## Page Priority

Build order:

1. Dashboard.
2. Clients.
3. Client Detail.
4. Builder visual upgrade.
5. Programs.
6. Library.
7. Sales.
8. Calendar.
9. Settings.

## Dashboard UX Requirements

Dashboard must not be a KPI wall.

It should act like a triage surface:

- high urgency items first;
- clear hierarchy;
- action buttons attached to context;
- no generic empty tables;
- no decorative metrics without next step.

Recommended dashboard sections:

1. Today Command Center.
2. Attention Queue.
3. Client Rhythm.
4. Latest Client Workouts.
5. Roster Preview.
6. Quick Actions.
7. Business Snapshot.

## Visual Direction

Use the client DEMO as the base quality standard, but make the trainer cabinet more professional and denser.

Shared with client cabinet:

- black/zinc surfaces;
- lime primary accents;
- cinematic cards;
- soft gradients;
- large rounded panels;
- exercise imagery;
- calm high-contrast typography.

Trainer-specific:

- more scan-friendly density;
- stronger status hierarchy;
- less motivational copy;
- more explicit actions;
- more compact data blocks;
- urgency and risk states;
- business context.

## MVP Definition For Phase 2

Phase 2 should implement a real `/trainer/dashboard` page that replaces the current redirect and proves the trainer cabinet direction.

Minimum scope:

- shared trainer shell;
- demo trainer data;
- Today Command Center;
- Attention Queue;
- Client Rhythm;
- Roster Preview;
- Quick Actions;
- Business Snapshot;
- responsive desktop/mobile behavior.

Done means:

- `/trainer/dashboard` no longer redirects to `/dashboard`;
- the page visually matches or exceeds the client DEMO quality;
- dashboard clearly answers "who needs me and what do I do next?";
- layout works on mobile and desktop;
- lint passes.
