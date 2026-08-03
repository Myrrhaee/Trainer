import "server-only";

import type { Pool } from "pg";

import { normalizeEmail } from "@/lib/server/auth/email/email-normalization";

export type ClosedAlphaActivationState =
  | "activated"
  | "already_active"
  | "account_not_found"
  | "ambiguous_email"
  | "account_unavailable"
  | "identity_unverified"
  | "trainer_request_missing"
  | "trainer_state_unavailable";

export type ClosedAlphaCohortStatus = {
  ready: boolean;
  trainer: {
    registered: boolean;
    identityVerified: boolean;
    active: boolean;
  };
  athletes: Array<{
    registered: boolean;
    identityVerified: boolean;
    relationActive: boolean;
  }>;
  blockers: string[];
};

const activationStates = new Set<ClosedAlphaActivationState>([
  "activated",
  "already_active",
  "account_not_found",
  "ambiguous_email",
  "account_unavailable",
  "identity_unverified",
  "trainer_request_missing",
  "trainer_state_unavailable",
]);

function normalizedEmail(value: unknown) {
  const email = normalizeEmail(value);
  if (!email) throw new Error("invalid_alpha_email");
  return email.normalized;
}

export class ClosedAlphaOperator {
  constructor(private readonly pool: Pool) {}

  async activateTrainer(input: {
    trainerEmail: unknown;
    operatorRef: string;
    release: string;
  }): Promise<ClosedAlphaActivationState> {
    const result = await this.pool.query<{ state: string }>(
      "SELECT app_private.closed_alpha_activate_trainer($1, $2, $3) AS state",
      [normalizedEmail(input.trainerEmail), input.operatorRef, input.release],
    );
    const state = result.rows[0]?.state as ClosedAlphaActivationState | undefined;
    if (!state || !activationStates.has(state)) throw new Error("alpha_activation_state_invalid");
    return state;
  }

  async status(input: {
    trainerEmail: unknown;
    athleteEmails: unknown[];
  }): Promise<ClosedAlphaCohortStatus> {
    if (input.athleteEmails.length !== 2) throw new Error("exactly_two_athletes_required");
    const trainerEmail = normalizedEmail(input.trainerEmail);
    const athleteEmails = input.athleteEmails.map(normalizedEmail);
    if (new Set([trainerEmail, ...athleteEmails]).size !== 3) {
      throw new Error("alpha_participant_emails_must_be_distinct");
    }
    const result = await this.pool.query<{ status: ClosedAlphaCohortStatus }>(
      "SELECT app_private.closed_alpha_cohort_status($1, $2, $3) AS status",
      [trainerEmail, athleteEmails[0], athleteEmails[1]],
    );
    const status = result.rows[0]?.status;
    if (!status || !Array.isArray(status.athletes) || status.athletes.length !== 2) {
      throw new Error("alpha_cohort_status_invalid");
    }
    return status;
  }
}
