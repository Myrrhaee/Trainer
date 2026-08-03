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

export class ResendEmailOtpDelivery implements EmailOtpDelivery {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly request: typeof fetch = fetch,
  ) {
    if (!apiKey.trim() || !from.trim()) {
      throw new Error("Resend email delivery is not configured");
    }
  }

  async send(message: EmailOtpMessage) {
    let response: Response;
    try {
      response = await this.request("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `email-otp/${message.challengeId}`,
        },
        body: JSON.stringify({
          from: this.from,
          to: [message.email],
          subject: "Код входа в AI Strength Coach",
          text: [
            `Ваш код входа: ${message.code}`,
            "",
            "Если вы не запрашивали код, проигнорируйте это письмо.",
          ].join("\n"),
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      throw new Error("Email OTP delivery transport failed");
    }

    if (!response.ok) {
      throw new Error(`Email OTP delivery failed with status ${response.status}`);
    }
  }
}

export function getEmailOtpDelivery(): EmailOtpDelivery {
  const mode = process.env.AUTH_EMAIL_DELIVERY_MODE
    ?? (process.env.NODE_ENV === "production" ? "unavailable" : "memory");

  if (mode === "memory" && process.env.NODE_ENV !== "production") {
    return new MemoryEmailOtpDelivery();
  }
  if (mode === "resend") {
    return new ResendEmailOtpDelivery(
      process.env.RESEND_API_KEY?.trim() ?? "",
      process.env.AUTH_EMAIL_FROM?.trim() ?? "",
    );
  }
  return new UnavailableEmailOtpDelivery();
}

export function mayDiscloseDevelopmentCode() {
  return process.env.NODE_ENV !== "production"
    && process.env.AUTH_DEV_OTP_DISCLOSURE !== "false";
}
