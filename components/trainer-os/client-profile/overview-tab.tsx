"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useState } from "react";
import { Camera, CheckCircle2, Dumbbell, Flame, Lock, MessageCircle, Star, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { MiniEmptyState, Panel, formatProfileDate, toneClass } from "./client-profile-ui";
import type { AthleteProfile } from "./types";

const AchievementCatalogDialog = dynamic(
  () => import("./achievement-catalog-dialog").then((mod) => mod.AchievementCatalogDialog),
  {
    ssr: false,
    loading: () => null,
  }
);

export function OverviewTab({
  athlete,
}: {
  athlete: AthleteProfile;
}) {
  return (
    <section className="grid gap-5">
      <AthleteVisitingCard athlete={athlete} />
      <ClientPortraitPanel athlete={athlete} />
      <AchievementsShowcase athlete={athlete} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <ProfileStoryFeed athlete={athlete} />
        <CoachNotesPreview athlete={athlete} />
      </div>
    </section>
  );
}

function AthleteVisitingCard({ athlete }: { athlete: AthleteProfile }) {
  const favoriteExercises = athlete.bestResults.slice(0, 3);

  return (
    <Panel title="Визитная карточка спортсмена" eyebrow="Любимые движения">
      <div className="grid gap-3 md:grid-cols-3">
        {favoriteExercises.map((result, index) => (
          <article
            key={result.id}
            className="relative min-h-[190px] overflow-hidden rounded-[1.8rem] border border-zinc-800 bg-[linear-gradient(145deg,rgba(24,24,27,0.72),rgba(5,5,5,0.82))] p-5"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_16%,rgba(190,242,100,0.11),transparent_34%)]" />
            <div className="relative z-10 flex h-full flex-col justify-between gap-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex size-12 items-center justify-center rounded-full border border-lime-300/16 bg-lime-300/8 text-lime-100">
                  {index === 0 ? <Dumbbell className="size-5" /> : index === 1 ? <Trophy className="size-5" /> : <Flame className="size-5" />}
                </div>
                <span className="rounded-full border border-zinc-800 bg-black/28 px-3 py-1 text-xs text-zinc-500">
                  {result.delta}
                </span>
              </div>

              <div>
                <p className="text-sm text-zinc-500">{index === 0 ? "Главное движение" : index === 1 ? "Сильная сторона" : "Ассоциация"}</p>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50">{result.exercise}</h3>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-lime-100">{result.value}</p>
                <p className="mt-2 text-sm text-zinc-500">{result.date}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function ClientPortraitPanel({ athlete }: { athlete: AthleteProfile }) {
  const availableEquipment = athlete.equipment.filter((item) => item.availability !== "missing");
  const mainLimitation = athlete.limitations.find((item) => item.severity !== "low") ?? athlete.limitations[0];

  return (
    <Panel title="Портрет спортсмена" eyebrow="Человек и контекст">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-[1.8rem] border border-zinc-800 bg-black/18 p-5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-600">О себе</p>
          <p className="mt-4 text-base leading-relaxed text-zinc-300">{athlete.about}</p>

          {mainLimitation ? (
            <div className="mt-5 rounded-[1.5rem] border border-amber-300/14 bg-amber-300/6 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 size-2 rounded-full bg-amber-300" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-100">{mainLimitation.label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-500">{mainLimitation.detail}</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-3">
          <PortraitContextRow label="Опыт" value={athlete.trainingExperience} />
          <PortraitContextRow label="Тренировочный ритм" value={athlete.preferredTrainingDays.join(", ")} />
          <PortraitContextRow
            label="Оборудование"
            value={availableEquipment.slice(0, 3).map((item) => item.label).join(", ")}
          />
          <PortraitContextRow label="Программа" value={athlete.currentProgram.name} />
        </div>
      </div>
    </Panel>
  );
}

function PortraitContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-zinc-800 bg-black/18 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-600">{label}</p>
      <p className="mt-1 text-sm font-medium leading-relaxed text-zinc-200">{value}</p>
    </div>
  );
}

function AchievementsShowcase({ athlete }: { athlete: AthleteProfile }) {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const unlockedCount = athlete.achievements.filter((achievement) => achievement.status === "unlocked").length;
  const totalScore = athlete.achievements
    .filter((achievement) => achievement.status === "unlocked")
    .reduce((sum, achievement) => sum + (achievement.score ?? 0), 0);

  return (
    <Panel title="Достижения" eyebrow="Витрина прогресса">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <p className="max-w-2xl text-sm leading-relaxed text-zinc-500">
          Системные награды клиента: ритм, силовые рубежи, прогресс и редкие уровни из общего каталога AI Strength Coach.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="shrink-0 rounded-full border border-zinc-800 bg-black/20 px-3 py-1.5 text-xs text-zinc-400">
            {unlockedCount} получено
          </span>
          <span className="shrink-0 rounded-full border border-lime-300/18 bg-lime-300/8 px-3 py-1.5 text-xs text-lime-100">
            {totalScore} Achievement Score
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full border-zinc-700 bg-black/20 text-zinc-200 hover:bg-zinc-900"
            onClick={() => setCatalogOpen(true)}
          >
            Все достижения
          </Button>
        </div>
      </div>

      {athlete.achievements.length > 0 ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5">
          <div className="flex min-w-max gap-3">
            {athlete.achievements.map((achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} layout="rail" />
            ))}
          </div>
        </div>
      ) : (
        <MiniEmptyState title="Достижения ещё не открыты" detail="Когда клиент начнёт закрывать цели, система покажет первые награды." />
      )}

      {catalogOpen ? <AchievementCatalogDialog athlete={athlete} open={catalogOpen} onOpenChange={setCatalogOpen} /> : null}
    </Panel>
  );
}

function AchievementCard({
  achievement,
  layout = "rail",
}: {
  achievement: AthleteProfile["achievements"][number];
  layout?: "rail" | "grid";
}) {
  const progress = achievementProgressValue(achievement);

  return (
    <article
      className={cn(
        "group overflow-hidden rounded-[30px] border p-4 transition duration-300",
        layout === "rail" ? "w-[220px] shrink-0" : "min-w-0",
        achievementSurfaceClass(achievement.rarity, achievement.status)
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn("rounded-full border px-2.5 py-1 text-[11px]", achievementStatusClass(achievement.status))}>
          {achievementStatusLabel(achievement.status)}
        </span>
        <span className="text-[11px] uppercase tracking-[0.16em] text-zinc-600">
          {achievementTierLabel(achievement.tier) ?? achievement.rarity}
        </span>
      </div>

      <div className="mt-4 flex justify-center">
        <div className="relative flex size-32 items-center justify-center">
          <div className="absolute bottom-1 h-6 w-24 rounded-full bg-black/40 blur-xl" />
          {achievement.assetSrc ? (
            <Image
              src={achievement.assetSrc}
              alt={achievement.title}
              width={128}
              height={128}
              className={cn(
                "relative z-10 size-32 object-contain drop-shadow-[0_22px_32px_rgba(0,0,0,0.42)] transition duration-300 group-hover:scale-[1.04]",
                achievement.status === "locked" && "grayscale opacity-45",
                achievement.status === "in_progress" && "opacity-88"
              )}
              sizes="128px"
            />
          ) : (
            <div className={cn("relative z-10 flex size-24 items-center justify-center rounded-[30px] border", achievementMedalClass(achievement.rarity, achievement.status))}>
              <div className="absolute inset-3 rounded-[22px] border border-white/6 bg-black/22" />
              <AchievementIconGlyph category={achievement.category} status={achievement.status} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 min-h-[98px]">
        <p className="line-clamp-1 text-xs text-zinc-600">{achievement.collection ?? achievement.collectionId ?? "Каталог"}</p>
        <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-tight text-zinc-50">{achievement.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-zinc-500">{achievement.description}</p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-zinc-600">
        <span className="line-clamp-1">{achievement.levelId ?? achievement.id}</span>
        {typeof achievement.score === "number" && achievement.score > 0 ? (
          <span className="shrink-0 text-lime-200/80">+{achievement.score}</span>
        ) : null}
      </div>

      <div className="mt-4">
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-900">
          <div
            className={cn("h-full rounded-full transition-all duration-500", achievement.status === "locked" ? "bg-zinc-600" : "bg-lime-300")}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-zinc-600">
          {achievement.status === "unlocked"
            ? `Получено · ${achievement.unlockedAt ?? "система"}`
            : achievement.progress?.label ?? "Пока закрыто"}
        </p>
      </div>
    </article>
  );
}

function AchievementIconGlyph({
  category,
  status,
}: {
  category: AthleteProfile["achievements"][number]["category"];
  status: AthleteProfile["achievements"][number]["status"];
}) {
  const className = "relative z-10 size-9";

  if (status === "locked") {
    return <Lock className={className} />;
  }

  if (category === "training") {
    return <Dumbbell className={className} />;
  }

  if (category === "progress") {
    return <Trophy className={className} />;
  }

  if (category === "consistency") {
    return <Flame className={className} />;
  }

  if (category === "strength") {
    return <Star className={className} />;
  }

  return <CheckCircle2 className={className} />;
}

function ProfileStoryFeed({ athlete }: { athlete: AthleteProfile }) {
  const [featuredPost, ...restPosts] = athlete.profilePosts;

  return (
    <Panel title="Лента профиля" eyebrow="Посты и события">
      {featuredPost ? (
        <div className="space-y-3">
          <FeaturedProfilePost post={featuredPost} />

          <div className="space-y-2">
            {restPosts.slice(0, 4).map((post) => (
              <ProfilePostRow key={post.id} post={post} />
            ))}
          </div>
        </div>
      ) : (
        <MiniEmptyState title="Лента пока пустая" detail="Здесь появятся посты клиента, фотоотчёты, чек-ины и значимые события." />
      )}
    </Panel>
  );
}

function FeaturedProfilePost({ post }: { post: AthleteProfile["profilePosts"][number] }) {
  return (
    <article className="rounded-[28px] border border-zinc-800 bg-[linear-gradient(135deg,rgba(24,24,27,0.9),rgba(0,0,0,0.34))] p-4">
      <div className="flex items-start gap-3">
        <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-full border", toneClass(post.tone))}>
          <ProfilePostIconGlyph type={post.type} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-zinc-800 bg-black/20 px-2 py-1 text-[11px] text-zinc-500">
              {profilePostAuthorLabel(post.author)}
            </span>
            <span className="text-xs text-zinc-600">{post.time}</span>
          </div>
          <h3 className="mt-3 text-xl font-semibold tracking-tight text-zinc-50">{post.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{post.body}</p>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
            {post.meta ? <span>{post.meta}</span> : null}
            {post.stats?.reactions ? <span>· {post.stats.reactions} реакции</span> : null}
            {post.stats?.comments ? <span>· {post.stats.comments} комментарий</span> : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function ProfilePostRow({ post }: { post: AthleteProfile["profilePosts"][number] }) {
  return (
    <article className="flex gap-3 rounded-[24px] border border-zinc-800 bg-black/18 p-3">
      <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-full border", toneClass(post.tone))}>
        <ProfilePostIconGlyph type={post.type} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-50">{post.title}</h3>
          <span className="text-xs text-zinc-600">{post.time}</span>
        </div>
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-zinc-500">{post.body}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
          <span>{post.meta ?? profilePostTypeLabel(post.type)}</span>
          {post.stats?.reactions ? <span>· {post.stats.reactions} реакции</span> : null}
          {post.stats?.comments ? <span>· {post.stats.comments} комм.</span> : null}
        </div>
      </div>
    </article>
  );
}

function ProfilePostIconGlyph({ type }: { type: AthleteProfile["profilePosts"][number]["type"] }) {
  const className = "size-4";

  if (type === "post") {
    return <MessageCircle className={className} />;
  }

  if (type === "workout") {
    return <Dumbbell className={className} />;
  }

  if (type === "achievement") {
    return <Trophy className={className} />;
  }

  if (type === "photo") {
    return <Camera className={className} />;
  }

  if (type === "check_in") {
    return <CheckCircle2 className={className} />;
  }

  return <Star className={className} />;
}

function CoachNotesPreview({ athlete }: { athlete: AthleteProfile }) {
  return (
    <Panel title="Заметки тренера" eyebrow="Приватно">
      {athlete.coachNotes.length > 0 ? (
        <div className="space-y-3">
          {athlete.coachNotes.slice(0, 2).map((note) => (
            <div key={note.id} className="rounded-[24px] border border-zinc-800 bg-black/18 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {note.pinned ? <span className="size-2 rounded-full bg-lime-300 shadow-[0_0_12px_rgba(190,242,100,0.28)]" /> : null}
                    <h3 className="text-sm font-semibold text-zinc-50">{note.title}</h3>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-zinc-500">{note.body}</p>
                </div>
                <span className="shrink-0 text-xs text-zinc-600">{formatProfileDate(note.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <MiniEmptyState title="Заметок пока нет" detail="Приватные тренерские наблюдения появятся здесь." />
      )}
      <Button type="button" variant="outline" className="mt-4 w-full rounded-full border-zinc-700 bg-black/20 text-zinc-200 hover:bg-zinc-900">
        Добавить заметку
      </Button>
    </Panel>
  );
}

function achievementStatusLabel(status: AthleteProfile["achievements"][number]["status"]) {
  return {
    unlocked: "получено",
    in_progress: "в прогрессе",
    locked: "закрыто",
  }[status];
}

function achievementStatusClass(status: AthleteProfile["achievements"][number]["status"]) {
  return {
    unlocked: "border-lime-300/18 bg-lime-300/8 text-lime-100",
    in_progress: "border-amber-300/18 bg-amber-300/8 text-amber-100",
    locked: "border-zinc-800 bg-black/20 text-zinc-500",
  }[status];
}

function achievementProgressValue(achievement: AthleteProfile["achievements"][number]) {
  if (achievement.progress) {
    return Math.min(100, Math.max(0, Math.round((achievement.progress.current / achievement.progress.target) * 100)));
  }

  return achievement.status === "unlocked" ? 100 : 0;
}

function achievementTierLabel(tier: AthleteProfile["achievements"][number]["tier"]) {
  if (!tier) return null;

  return {
    bronze: "бронза",
    silver: "серебро",
    gold: "золото",
    master: "мастер",
    cup: "кубок",
    secret: "секретное",
  }[tier];
}

function achievementSurfaceClass(
  rarity: AthleteProfile["achievements"][number]["rarity"],
  status: AthleteProfile["achievements"][number]["status"]
) {
  if (status === "locked") {
    return "border-zinc-800 bg-zinc-950/54 opacity-70";
  }

  return {
    base: "border-zinc-800 bg-black/22 hover:border-lime-300/20",
    rare: "border-lime-300/16 bg-[radial-gradient(circle_at_30%_0%,rgba(190,242,100,0.12),transparent_40%),rgba(0,0,0,0.22)] hover:border-lime-300/28",
    epic: "border-amber-300/18 bg-[radial-gradient(circle_at_30%_0%,rgba(251,191,36,0.12),transparent_42%),rgba(0,0,0,0.24)] hover:border-amber-300/28",
  }[rarity];
}

function achievementMedalClass(
  rarity: AthleteProfile["achievements"][number]["rarity"],
  status: AthleteProfile["achievements"][number]["status"]
) {
  if (status === "locked") {
    return "border-zinc-800 bg-zinc-950 text-zinc-600";
  }

  return {
    base: "border-zinc-700 bg-[linear-gradient(135deg,#18181b,#050505)] text-lime-200 shadow-[0_20px_44px_rgba(0,0,0,0.3)]",
    rare: "border-lime-300/24 bg-[linear-gradient(135deg,rgba(190,242,100,0.14),#050505)] text-lime-200 shadow-[0_20px_52px_rgba(132,204,22,0.12)]",
    epic: "border-amber-300/24 bg-[linear-gradient(135deg,rgba(251,191,36,0.14),#050505)] text-amber-100 shadow-[0_20px_52px_rgba(251,191,36,0.12)]",
  }[rarity];
}
function profilePostAuthorLabel(author: AthleteProfile["profilePosts"][number]["author"]) {
  return {
    client: "от клиента",
    coach: "от тренера",
    system: "система",
  }[author];
}

function profilePostTypeLabel(type: AthleteProfile["profilePosts"][number]["type"]) {
  return {
    post: "Пост",
    workout: "Тренировка",
    achievement: "Достижение",
    photo: "Фото",
    check_in: "Чек-ин",
    coach_note: "Комментарий тренера",
  }[type];
}
