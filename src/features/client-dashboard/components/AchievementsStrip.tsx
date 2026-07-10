import { Flame, Lock, Trophy } from "lucide-react";

type Achievement = {
  title: string;
  status: "earned" | "locked";
  icon: "flame" | "trophy" | "lock";
  helper: string;
};

const achievements: Achievement[] = [
  {
    title: "6 тренировок подряд",
    status: "earned",
    icon: "flame",
    helper: "Серия без пропусков",
  },
  {
    title: "+5 кг в жиме ногами",
    status: "earned",
    icon: "trophy",
    helper: "Новый силовой прогресс",
  },
  {
    title: "10 тренировок подряд",
    status: "locked",
    icon: "lock",
    helper: "Следующая цель",
  },
];

function AchievementIcon({ icon, earned }: { icon: Achievement["icon"]; earned: boolean }) {
  const className = earned ? "h-4 w-4 text-black" : "h-4 w-4 text-zinc-500";

  if (icon === "flame") return <Flame className={className} />;
  if (icon === "trophy") return <Trophy className={className} />;
  return <Lock className={className} />;
}

export function AchievementsStrip() {
  return (
    <section className="rounded-[1.6rem] border border-zinc-800/90 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.06),transparent_24%),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(10,10,12,0.98))] p-4 text-zinc-100 shadow-[0_16px_42px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold tracking-[-0.02em] text-zinc-50">Достижения</h3>
        <span className="rounded-full border border-zinc-800 bg-zinc-950/80 px-2.5 py-1 text-[11px] text-zinc-400">
          Мотивация недели
        </span>
      </div>

      <div className="mt-3 grid gap-2.5 md:grid-cols-3">
        {achievements.map((achievement) => {
          const earned = achievement.status === "earned";

          return (
            <article
              key={achievement.title}
              className={[
                "rounded-[1.15rem] border px-3.5 py-3 transition",
                earned
                  ? "border-lime-300/20 bg-[linear-gradient(180deg,rgba(214,255,128,0.12),rgba(0,0,0,0.12))]"
                  : "border-zinc-800/90 bg-black/20",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={[
                    "inline-flex h-9 w-9 items-center justify-center rounded-full border",
                    earned
                      ? "border-lime-300/20 bg-lime-300 text-black shadow-[0_0_18px_rgba(163,230,53,0.2)]"
                      : "border-zinc-700 bg-zinc-900/80 text-zinc-500",
                  ].join(" ")}
                >
                  <AchievementIcon icon={achievement.icon} earned={earned} />
                </span>

                <span
                  className={[
                    "rounded-full px-2.5 py-1 text-[11px] font-medium",
                    earned
                      ? "border border-lime-300/15 bg-lime-300/10 text-lime-100"
                      : "border border-zinc-700 bg-zinc-950/75 text-zinc-400",
                  ].join(" ")}
                >
                  {earned ? "Получено" : "Скоро"}
                </span>
              </div>

              <div className="mt-3">
                <p className={earned ? "text-sm font-semibold text-zinc-50" : "text-sm font-semibold text-zinc-300"}>
                  {achievement.title}
                </p>
                <p className="mt-1 text-xs text-zinc-500">{achievement.helper}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
