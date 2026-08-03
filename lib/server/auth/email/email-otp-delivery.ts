import "server-only";

export interface EmailOtpMessage {
  challengeId: string;
  email: string;
  code: string;
  expiresAt: Date;
}

export interface EmailOtpDelivery {
  send(message: EmailOtpMessage): Promise<void>;
  developmentCode?(challengeId: string): string | null;
}

const globalWithDevelopmentMailbox = globalThis as typeof globalThis & {
  __aiStrengthDevelopmentMailbox?: Map<string, string>;
};

export class MemoryEmailOtpDelivery implements EmailOtpDelivery {
  private mailbox() {
    globalWithDevelopmentMailbox.__aiStrengthDevelopmentMailbox ??= new Map();
    return globalWithDevelopmentMailbox.__aiStrengthDevelopmentMailbox;
  }

  async send(message: EmailOtpMessage) {
    this.mailbox().set(message.challengeId, message.code);
  }

  developmentCode(challengeId: string) {
    return this.mailbox().get(challengeId) ?? null;
  }
}

export class UnavailableEmailOtpDelivery implements EmailOtpDelivery {
  async send() {
    throw new Error("Email OTP delivery provider is not configured");
  }
}

export function getEmailOtpDelivery(): EmailOtpDelivery {
  const mode = process.env.AUTH_EMAIL_DELIVERY_MODE
    ?? (process.env.NODE_ENV === "production" ? "unavailable" : "memory");

  if (mode === "memory" && process.env.NODE_ENV !== "production") {
    return new MemoryEmailOtpDelivery();
  }
  return new UnavailableEmailOtpDelivery();
}

export function mayDiscloseDevelopmentCode() {
  return process.env.NODE_ENV !== "production"
    && process.env.AUTH_DEV_OTP_DISCLOSURE !== "false";
}
