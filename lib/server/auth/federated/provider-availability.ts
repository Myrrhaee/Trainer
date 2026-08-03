import "server-only";

export interface FederatedProviderAvailability {
  google: boolean;
  telegramBrowser: boolean;
  telegramMiniApp: boolean;
}

type EnvironmentMap = Readonly<Record<string, string | undefined>>;

function configured(env: EnvironmentMap, name: string) {
  return Boolean(env[name]?.trim());
}

export function federatedProviderAvailability(
  env: EnvironmentMap = process.env,
): FederatedProviderAvailability {
  return {
    google: configured(env, "GOOGLE_CLIENT_ID"),
    telegramBrowser:
      configured(env, "TELEGRAM_CLIENT_ID")
      && configured(env, "TELEGRAM_CLIENT_SECRET"),
    telegramMiniApp: configured(env, "TELEGRAM_BOT_TOKEN"),
  };
}
