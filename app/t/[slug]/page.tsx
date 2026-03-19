import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";

type ProfilePublic = {
  id: string;
  full_name: string | null;
  display_name: string | null;
  team_logo_url: string | null;
  telegram_link: string | null;
  slug: string | null;
  is_public: boolean | null;
};

function normalizeTelegramLink(value: string | null): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (v.startsWith("@")) return `https://t.me/${v.slice(1)}`;
  return v;
}

function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function loadProfileBySlug(slug: string): Promise<ProfilePublic | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, display_name, team_logo_url, telegram_link, slug, is_public")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  return data as ProfilePublic;
}

export async function generateMetadata(
  props: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await props.params;
  const normalizedSlug = slug.trim().toLowerCase();
  const profile = await loadProfileBySlug(normalizedSlug);

  if (!profile) {
    return {
      title: "Профиль тренера не найден",
      description: "Страница профиля тренера не найдена или была удалена.",
      robots: { index: false, follow: false },
    };
  }

  const team = profile.display_name?.trim() || "Команда";
  const name = profile.full_name?.trim() || "Тренер";
  const title = `${team} — ${name}`;
  const description = `Профиль тренера: ${name}. Команда: ${team}. Связь в Telegram и заявка на тренировки.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: profile.team_logo_url ? [{ url: profile.team_logo_url }] : undefined,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: profile.team_logo_url ? [profile.team_logo_url] : undefined,
    },
  };
}

export default async function PublicTrainerPage(
  props: { params: Promise<{ slug: string }> }
) {
  const { slug } = await props.params;
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) notFound();

  const profile = await loadProfileBySlug(normalizedSlug);
  if (!profile) notFound();

  const teamName = profile.display_name?.trim() || "Без названия";
  const trainerName = profile.full_name?.trim() || "Тренер";
  const telegramUrl = normalizeTelegramLink(profile.telegram_link);
  const fallbackLetter = (teamName.trim()?.[0] ?? "T").toUpperCase();

  return (
    <div className="min-h-screen bg-zinc-950 text-foreground">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12">
        <header className="flex flex-col items-center gap-5 text-center">
          <div className="relative h-28 w-28 overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-900 shadow-sm">
            {profile.team_logo_url ? (
              <Image
                src={profile.team_logo_url}
                alt={`Логотип команды ${teamName}`}
                fill
                sizes="112px"
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl font-semibold text-zinc-200">
                {fallbackLetter}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
              {teamName}
            </h1>
            <p className="text-sm text-zinc-400">{trainerName}</p>
          </div>
        </header>

        <section className="space-y-3">
          {telegramUrl ? (
            <a
              href={telegramUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center rounded-2xl bg-zinc-100 px-6 py-4 text-base font-medium text-black transition hover:bg-white"
            >
              Связаться в Telegram
            </a>
          ) : (
            <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/60 px-6 py-4 text-center text-sm text-zinc-400">
              Telegram не указан
            </div>
          )}

          <Link
            href={`/signup?role=client&trainer_id=${encodeURIComponent(profile.id)}`}
            className="inline-flex w-full items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/60 px-6 py-4 text-base font-medium text-zinc-100 transition hover:bg-zinc-900/60"
          >
            Стать моим клиентом
          </Link>
        </section>

        <footer className="pt-2 text-center text-xs text-zinc-500">
          <Link href="/" className="hover:text-zinc-300">
            На главную
          </Link>
        </footer>
      </main>
    </div>
  );
}

