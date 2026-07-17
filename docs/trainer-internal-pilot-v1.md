# Trainer Internal Pilot v1

## 1. Pilot purpose

Verify that the accepted trainer surfaces form one coherent internal demo workflow before backend implementation. This is an expert walkthrough plus automated integration verification, not user research.

## 2. Method

The walkthrough used production-built local frontend state, desktop `1440x1000`, mobile `390x844`, keyboard-accessible Playwright locators, screenshot inspection, console/error-overlay checks, and assertions that no non-GET remote request occurred in the principal flows.

## 3. Scenarios

1. Artem: queue review, failure/retry, feedback, next assignment, Profile, queue continuation.
2. Alexandra: no template, Builder, add exercise, publish, Quick Assign, Profile.
3. Maria: calm Profile assignment without AttentionItem.
4. Olga: discomfort original text, careful feedback, resolution, retained history.
5. Artem: manual resolution without feedback.
6. Unknown athlete/session/template and mobile core transition.

## 4. Expected behavior

The same athlete/session remains selected; commands are the only mutation boundary; successful feedback/assignment propagates; failure preserves drafts; original discomfort text survives; no-template returns to assignment; queue advances; unknown IDs fail closed; mobile keeps CTA and return actions usable.

## 5. Observed behavior

All expected cross-surface facts propagated in the final run. Artem's first demo send intentionally failed and retried without closing the item. Feedback and assignment appeared in Profile. Alexandra's published revision appeared preselected in Quick Assign. Olga's original text and feedback coexisted after resolution. Manual resolution produced no TrainerFeedback. Unknown IDs showed dedicated not-found states.

## 6. Step counts

| Scenario | Primary decisions/actions | Result |
| --- | ---: | --- |
| Review to assignment | 10 | completed; queue advanced |
| No template to Builder | 9 | completed; template published and assigned |
| Calm athlete | 6 | completed; no artificial AttentionItem |
| Discomfort | 7 | completed; original text retained |
| Manual resolution | 5 | completed; reason retained, no feedback |
| Mobile linked path | 12 | completed; zero horizontal overflow |

Counts exclude passive scrolling and automated assertions.

## 7. Findings

- One shared runtime removed wrong-surface divergence without changing screen hierarchy.
- The Profile needed a durable existing surface for both feedback and source signal; its profile feed now provides it.
- Suitable-template filters differ correctly by athlete goal; tests must not assume one global template list.
- Queue continuity is understandable after receipt and return through main navigation.
- Builder-to-Quick-Assign context works, but the flow remains longer than direct assignment and should be observed with trainers.
- Quick Assign's fixed footer keeps the primary CTA visible on mobile.

## 8. P0/P1/P2/P3

| Priority | Finding |
| --- | --- |
| P0 | None in the frontend pilot. |
| P1 | Production backend, authorization, transactional/idempotent server commands, and canonical persistence remain absent; this blocks beta. |
| P1 | Full reload resets all integrated demo facts and queue position by design. |
| P2 | Existing Review draft `sessionStorage` is a second ephemeral mechanism and should be replaced by production draft policy later. |
| P2 | Builder-return flow has many actions; validate terminology and completion time with trainers. |
| P2 | Manual accessibility review with screen reader and mobile keyboard remains outstanding. |
| P3 | Development test startup exposed a parent-directory Tailwind resolution issue; production `next start` is unaffected. |
| P3 | Existing Recharts prerender warnings remain. |

## 9. Mobile findings

At `390x844`, Dashboard, Profile, Review, Quick Assign, and Builder reported zero document overflow. Sheets use nearly full viewport width without clipping. Assignment CTA was visible in the fixed footer above trainer bottom navigation. Core Builder interaction used buttons rather than drag. No desktop-only blocker was observed.

## 10. Accessibility findings

The automated keyboard-oriented contract found named queue buttons, tab semantics, labelled feedback fields, listbox template options, status/alert live regions, and dialog/sheet semantics. Focus restoration paths already present in Profile, Review, and Quick Assign were preserved. Reduced-motion behavior remains in Profile. Screen reader announcements, virtual keyboard occlusion, and long-session focus order need device/manual verification.

## 11. Remaining workflow gaps

- No persisted actor/session/repository across reload or devices.
- No real client-side workout completion enters this flow.
- No server-side audit log, delivery, read receipt, or notification.
- No conflict policy beyond current local date warning.
- No production queue pagination/high-volume test for 20-30 clients.
- No real trainer study of map-to-queue comprehension or Builder speed.

## 12. Recommendations

Keep the accepted screens and runtime contracts as a vertical-slice specification. Next, implement the canonical server command/repository boundaries against clean staging, preserve exact IDs and idempotency rules, add negative authorization tests, and run a moderated trainer pilot using the same six scenarios and measured completion time.

## 13. Beta blockers

Canonical PostgreSQL migrations, verified Supabase staging identity, auth/capability checks, trainer-athlete authorization, RLS negative tests, transactional commands, durable idempotency/audit, removal of unsafe privileged endpoints, and real completion-to-AttentionItem ingestion remain beta blockers.

## 14. Deferred backend requirements

Persist WorkoutTemplate revisions, Assignment snapshots, WorkoutSession facts, TrainerFeedback, AttentionItem lifecycle, manual reason, Team Activity projections, and audit events through provider-neutral repositories/server commands. Add transaction boundaries for feedback-plus-resolution and assignment-plus-optional-resolution. Keep Supabase as an adapter, not a UI/domain dependency. No Stage 12 code performs remote writes.
