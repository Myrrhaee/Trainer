import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-foreground">
      <div className="w-full max-w-md space-y-5 text-center">
        <div className="mx-auto h-12 w-12 rounded-2xl border border-zinc-800 bg-zinc-950/60" />
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            Профиль не найден
          </h1>
          <p className="text-sm text-zinc-400">
            Возможно, ссылка неверная или тренер удалил профиль.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Link
            href="/"
            className="inline-flex w-full items-center justify-center rounded-2xl bg-zinc-100 px-6 py-3 text-sm font-medium text-black transition hover:bg-white"
          >
            На главную
          </Link>
          <Link
            href="/login?role=client"
            className="inline-flex w-full items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/60 px-6 py-3 text-sm font-medium text-zinc-100 transition hover:bg-zinc-900/60"
          >
            Войти как клиент
          </Link>
        </div>
      </div>
    </div>
  );
}

