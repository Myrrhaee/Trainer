"use client";

import { useState } from "react";
import { Chrome, Send } from "lucide-react";

import { Button } from "@/components/ui/button";

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleMomentNotification {
  isNotDisplayed(): boolean;
  isSkippedMoment(): boolean;
  isDismissedMoment(): boolean;
}

interface GoogleIdentityApi {
  initialize(options: {
    client_id: string;
    nonce: string;
    callback(response: GoogleCredentialResponse): void;
    cancel_on_tap_outside?: boolean;
  }): void;
  prompt(callback?: (notification: GoogleMomentNotification) => void): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentityApi } };
    __aiStrengthGoogleScript?: Promise<void>;
    Telegram?: {
      WebApp: {
        initData: string;
        ready(): void;
        expand(): void;
      };
    };
    __aiStrengthTelegramScript?: Promise<void>;
  }
}

type StartResponse = {
  error?: string;
  flowId?: string;
  nonce?: string;
  clientId?: string;
  authorizationUrl?: string;
};

function loadGoogleIdentityServices() {
  if (window.google?.accounts.id) return Promise.resolve();
  window.__aiStrengthGoogleScript ??= new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-ai-google-identity]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("google_script_failed")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.aiGoogleIdentity = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("google_script_failed"));
    document.head.appendChild(script);
  });
  return window.__aiStrengthGoogleScript;
}

function loadTelegramWebApp() {
  if (window.Telegram?.WebApp) return Promise.resolve();
  window.__aiStrengthTelegramScript ??= new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-ai-telegram-web-app]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("telegram_script_failed")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-web-app.js?63";
    script.async = true;
    script.dataset.aiTelegramWebApp = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("telegram_script_failed"));
    document.head.appendChild(script);
  });
  return window.__aiStrengthTelegramScript;
}

function hasTelegramMiniAppLaunchContext() {
  if (window.Telegram?.WebApp?.initData) return true;
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return fragment.has("tgWebAppData");
}

export function FederatedLoginOptions({
  onAuthenticated,
  returnPath,
}: {
  onAuthenticated(): void;
  returnPath: string;
}) {
  const [loading, setLoading] = useState<"google" | "telegram" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(provider: "google" | "telegram") {
    const response = await fetch("/api/auth/federated/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, intent: "login", returnPath }),
    });
    const payload = await response.json().catch(() => ({})) as StartResponse;
    if (!response.ok) {
      throw new Error(payload.error ?? "provider_unavailable");
    }
    return payload;
  }

  async function continueWithGoogle() {
    setLoading("google");
    setError(null);
    try {
      const flow = await start("google");
      if (!flow.flowId || !flow.nonce || !flow.clientId) throw new Error("invalid_flow");
      await loadGoogleIdentityServices();
      if (!window.google) throw new Error("google_unavailable");
      window.google.accounts.id.initialize({
        client_id: flow.clientId,
        nonce: flow.nonce,
        cancel_on_tap_outside: true,
        callback: async (response) => {
          if (!response.credential) {
            setError("Google не вернул подтверждение. Используйте вход по email.");
            setLoading(null);
            return;
          }
          const verified = await fetch("/api/auth/google/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              flowId: flow.flowId,
              nonce: flow.nonce,
              credential: response.credential,
            }),
          });
          if (!verified.ok) {
            setError("Не удалось подтвердить Google. Используйте вход по email.");
            setLoading(null);
            return;
          }
          onAuthenticated();
          setLoading(null);
        },
      });
      window.google.accounts.id.prompt((notification) => {
        if (
          notification.isNotDisplayed()
          || notification.isSkippedMoment()
          || notification.isDismissedMoment()
        ) {
          setError("Окно Google недоступно в этом браузере. Используйте вход по email.");
          setLoading(null);
        }
      });
    } catch {
      setError("Google пока недоступен. Используйте вход по email.");
      setLoading(null);
    }
  }

  async function continueWithTelegram() {
    setLoading("telegram");
    setError(null);
    try {
      if (hasTelegramMiniAppLaunchContext()) {
        await loadTelegramWebApp();
        const miniApp = window.Telegram?.WebApp;
        if (!miniApp?.initData) throw new Error("mini_app_context_invalid");
        miniApp.ready();
        miniApp.expand();
        const response = await fetch("/api/auth/telegram/mini-app", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: miniApp.initData, returnPath }),
        });
        const payload = await response.json().catch(() => ({})) as {
          destination?: string;
        };
        if (!response.ok || !payload.destination) throw new Error("mini_app_auth_failed");
        window.location.assign(payload.destination);
        return;
      }

      const flow = await start("telegram");
      if (!flow.authorizationUrl) throw new Error("invalid_flow");
      window.location.assign(flow.authorizationUrl);
    } catch {
      setError("Telegram пока недоступен. Используйте вход по email.");
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        disabled={loading !== null}
        onClick={continueWithGoogle}
        className="h-10 w-full border-zinc-700 bg-zinc-950 text-zinc-100 hover:bg-zinc-900 hover:text-white"
      >
        <Chrome aria-hidden />
        {loading === "google" ? "Открываем Google..." : "Продолжить с Google"}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={loading !== null}
        onClick={continueWithTelegram}
        className="h-10 w-full border-zinc-700 bg-zinc-950 text-zinc-100 hover:bg-zinc-900 hover:text-white"
      >
        <Send aria-hidden />
        {loading === "telegram" ? "Открываем Telegram..." : "Продолжить с Telegram"}
      </Button>
      {error && <p className="text-sm text-amber-300" role="alert">{error}</p>}
    </div>
  );
}
