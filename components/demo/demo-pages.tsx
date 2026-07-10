"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bell,
  ChevronRight,
  Clock3,
  Droplets,
  Flame,
  HeartPulse,
  MessageCircle,
  Play,
  Settings,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";

import {
  getDemoClientSummary,
  getDemoPrograms,
  getDemoTrainerSummary,
} from "@/lib/demo-data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function initials(value: string) {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function DemoTrainerDashboardPage() {
  const data = getDemoTrainerSummary();

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
        <Card className="rounded-[1.8rem] border-zinc-800/90 bg-zinc-950/90">
          <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <Avatar className="h-14 w-14 rounded-3xl bg-zinc-900">
                <AvatarImage src={data.trainer.teamLogoUrl ?? undefined} alt={data.trainer.fullName} />
                <AvatarFallback className="rounded-3xl bg-zinc-900 text-zinc-100">
                  {initials(data.trainer.fullName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                  Demo mode
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50">
                  Личный кабинет тренера
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                  Управление клиентами, программами и прогрессом в одном месте.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900">
                <Link href="/dashboard/library">Библиотека</Link>
              </Button>
              <Button asChild className="rounded-full bg-zinc-100 text-black hover:bg-white">
                <Link href="/trainer/builder">Открыть конструктор</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.metrics.map((metric) => (
            <Card key={metric.label} className="rounded-[1.4rem] border-zinc-800/90 bg-zinc-950/90">
              <CardContent className="p-4">
                <p className="text-sm text-zinc-500">{metric.label}</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-50">{metric.value}</p>
                <p className="mt-1 text-sm text-zinc-400">{metric.helper}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
          <Card className="rounded-[1.8rem] border-zinc-800/90 bg-zinc-950/90">
            <CardHeader>
              <CardTitle className="text-zinc-50">Требует внимания</CardTitle>
              <CardDescription className="text-zinc-400">
                События, по которым нужно действие тренера.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.attention.map((item) => (
                <div key={item.id} className="rounded-[1.2rem] border border-zinc-800 bg-black/20 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-zinc-100">{item.clientName}</p>
                        <Badge className="rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300">
                          {item.priority}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-zinc-200">{item.label}</p>
                      <p className="mt-1 text-sm text-zinc-500">{item.description}</p>
                    </div>
                    <div className="shrink-0 text-xs text-zinc-500">{item.eventTime}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" className="rounded-full bg-zinc-100 text-black hover:bg-white">
                      {item.action}
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900">
                      {item.secondaryAction}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[1.8rem] border-zinc-800/90 bg-zinc-950/90">
            <CardHeader>
              <CardTitle className="text-zinc-50">Быстрые действия</CardTitle>
              <CardDescription className="text-zinc-400">
                Самые частые действия без лишних переходов.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <QuickAction href="/trainer/builder" label="Создать тренировку" helper="Собрать день из библиотеки упражнений" />
              <QuickAction href="/dashboard/library" label="Открыть библиотеку" helper="Добавить или отредактировать упражнения" />
              <QuickAction href="/dashboard/programs" label="Программы" helper="Управление шаблонами и продажами" />
              <QuickAction href="/dashboard/analytics" label="Аналитика" helper="Доход, продажи и активность клиентов" />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
          <Card className="rounded-[1.8rem] border-zinc-800/90 bg-zinc-950/90">
            <CardHeader>
              <CardTitle className="text-zinc-50">Мои клиенты</CardTitle>
              <CardDescription className="text-zinc-400">
                Активные клиенты, статус прогресса и быстрые действия.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.clients.map((client) => (
                <div key={client.id} className="rounded-[1.2rem] border border-zinc-800 bg-black/20 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-zinc-100">{client.name}</p>
                        <Badge className="rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300">
                          {client.status}
                        </Badge>
                      </div>
                      <div className="mt-2 grid gap-1 text-sm text-zinc-400 md:grid-cols-2">
                        <span>Цель: {client.goal}</span>
                        <span>Вес: {client.currentWeight}</span>
                        <span>Последняя активность: {client.lastActive}</span>
                        <span>Программа: {client.program}</span>
                      </div>
                      <p className="mt-2 text-sm text-zinc-500">{client.progress}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900">
                        Открыть
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900">
                        Написать
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[1.8rem] border-zinc-800/90 bg-zinc-950/90">
            <CardHeader>
              <CardTitle className="text-zinc-50">Короткая аналитика</CardTitle>
              <CardDescription className="text-zinc-400">
                В demo-режиме здесь показана примерная сводка по работе тренера.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.analytics.map((metric) => (
                <div key={metric.label} className="rounded-[1.2rem] border border-zinc-800 bg-black/20 p-4">
                  <p className="text-sm text-zinc-500">{metric.label}</p>
                  <p className="mt-2 text-xl font-semibold text-zinc-50">{metric.value}</p>
                  <p className="mt-1 text-sm text-zinc-400">{metric.helper}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

export function DemoProgramsPage() {
  const programs = getDemoPrograms();

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
        <Card className="rounded-[1.8rem] border-zinc-800/90 bg-zinc-950/90">
          <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Demo mode</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50">Программы</h1>
              <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                В demo-режиме программы работают как mock-сущности: можно смотреть структуру и использовать их в конструкторе.
              </p>
            </div>
            <Button asChild className="rounded-full bg-zinc-100 text-black hover:bg-white">
              <Link href="/trainer/builder">Открыть конструктор</Link>
            </Button>
          </CardContent>
        </Card>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {programs.map((program) => (
            <Card key={program.id} className="rounded-[1.6rem] border-zinc-800/90 bg-zinc-950/90">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-lg font-semibold text-zinc-50">{program.title}</p>
                  <Badge className="rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300">
                    {program.status}
                  </Badge>
                </div>
                <div className="mt-3 space-y-1 text-sm text-zinc-400">
                  <p>{program.weeks} недель</p>
                  <p>{program.price > 0 ? `${program.price.toLocaleString("ru-RU")} ₽` : "Бесплатно"}</p>
                  <p>{program.dayOptions.length} тренировочных дня в первом цикле</p>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button asChild size="sm" className="rounded-full bg-zinc-100 text-black hover:bg-white">
                    <Link href="/trainer/builder">Открыть</Link>
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900">
                    Дублировать
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </main>
    </div>
  );
}

export function DemoAnalyticsPage() {
  const summary = getDemoTrainerSummary();

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
        <Card className="rounded-[1.8rem] border-zinc-800/90 bg-zinc-950/90">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-zinc-500" />
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">Аналитика</h1>
                <p className="mt-2 text-sm text-zinc-400">
                  В demo-режиме это локальная сводка по клиентам, продажам и активности.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4 md:grid-cols-3">
          {summary.analytics.map((item) => (
            <Card key={item.label} className="rounded-[1.5rem] border-zinc-800/90 bg-zinc-950/90">
              <CardContent className="p-5">
                <p className="text-sm text-zinc-500">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-50">{item.value}</p>
                <p className="mt-1 text-sm text-zinc-400">{item.helper}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card className="rounded-[1.8rem] border-zinc-800/90 bg-zinc-950/90">
          <CardHeader>
            <CardTitle className="text-zinc-50">Недавние продажи</CardTitle>
            <CardDescription className="text-zinc-400">
              Пример последних транзакций в demo-режиме.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.recentSales.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between rounded-[1.2rem] border border-zinc-800 bg-black/20 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-zinc-100">{sale.title}</p>
                  <p className="text-xs text-zinc-500">{sale.date}</p>
                </div>
                <p className="text-sm font-semibold text-zinc-50">{sale.amount}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export function DemoTrainerSettingsPage() {
  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
        <Card className="rounded-[1.8rem] border-zinc-800/90 bg-zinc-950/90">
          <CardHeader>
            <CardTitle className="text-zinc-50">Настройки тренера</CardTitle>
            <CardDescription className="text-zinc-400">
              В demo-режиме изменения не отправляются на сервер и сохраняются только локально в сессии страницы.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Имя тренера" defaultValue="Алексей Романов" />
            <Field label="Название команды" defaultValue="Romanov Coaching" />
            <Field label="Telegram" defaultValue="@romanov_coach" />
            <Field label="Публичный URL" defaultValue="/t/romanov-coach" />
            <Textarea defaultValue="Онлайн-ведение клиентов, силовые программы и работа с композицией тела." className="min-h-28 rounded-2xl border-zinc-800 bg-zinc-950/60 text-zinc-100" />
            <div className="flex gap-2">
              <Button className="rounded-full bg-zinc-100 text-black hover:bg-white">Сохранить локально</Button>
              <Button variant="outline" className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900">Открыть публичный профиль</Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export function DemoClientSettingsPage() {
  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
        <Card className="rounded-[1.8rem] border-zinc-800/90 bg-zinc-950/90">
          <CardHeader>
            <CardTitle className="text-zinc-50">Настройки клиента</CardTitle>
            <CardDescription className="text-zinc-400">
              Demo-режим позволяет посмотреть структуру профиля и настроек без подключения к Supabase.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Имя" defaultValue="Мария Волкова" />
            <Field label="Текущий вес" defaultValue="68.4" />
            <Field label="Целевой вес" defaultValue="63.0" />
            <Field label="Телеграм тренера" defaultValue="@romanov_coach" />
            <div className="flex gap-2">
              <Button className="rounded-full bg-zinc-100 text-black hover:bg-white">Сохранить локально</Button>
              <Button variant="outline" className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900">Запросить новые замеры</Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export function DemoClientMePage() {
  const data = getDemoClientSummary();

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
        <Card className="rounded-[1.8rem] border-zinc-800/90 bg-zinc-950/90">
          <CardContent className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <Avatar className="h-14 w-14 rounded-3xl bg-zinc-900">
                <AvatarFallback className="rounded-3xl bg-zinc-900 text-zinc-100">
                  {initials(data.client.fullName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm text-zinc-500">{data.client.greeting}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
                    {data.client.fullName}
                  </h1>
                  <Badge className="rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300">
                    {data.client.weekLabel}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-zinc-400">{data.client.goal}</p>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-3 lg:max-w-xl lg:items-end">
              <div className="flex w-full items-center gap-2 rounded-full border border-zinc-800 bg-black/30 px-3 py-2 lg:max-w-sm">
                <Sparkles className="h-4 w-4 text-zinc-500" />
                <span className="text-sm text-zinc-500">Поиск по тренировкам и заметкам</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300">
                  Вода: {data.client.water}
                </Badge>
                <Badge className="rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300">
                  Выполнение: {data.client.adherence}
                </Badge>
                <Button asChild variant="ghost" size="icon" className="rounded-2xl border border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50">
                  <Link href="/client/settings" aria-label="Настройки">
                    <Settings className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-6 xl:grid-cols-[1.25fr,0.95fr,0.8fr]">
          <Card className="rounded-[1.8rem] border-zinc-800/90 bg-[radial-gradient(circle_at_top,rgba(211,255,130,0.18),transparent_34%),linear-gradient(180deg,rgba(24,24,27,0.96),rgba(9,9,11,0.98))]">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-zinc-50">Тренировка на сегодня</CardTitle>
                  <CardDescription className="text-zinc-400">
                    Главная точка действия в приложении.
                  </CardDescription>
                </div>
                <Badge className="rounded-full border border-lime-300/20 bg-lime-300/10 text-lime-100">
                  {data.todayWorkout.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Сегодня</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50">
                    {data.todayWorkout.name}
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
                    {data.todayWorkout.focus}
                  </p>
                </div>
                <div className="rounded-[1.3rem] border border-zinc-800 bg-black/30 px-4 py-3 text-right">
                  <p className="text-xs text-zinc-500">Длительность</p>
                  <p className="mt-1 text-xl font-semibold text-zinc-50">{data.todayWorkout.duration}</p>
                </div>
              </div>

              <div className="grid gap-2">
                {data.todayWorkout.exercises.map((exercise, index) => (
                  <div
                    key={exercise.id}
                    className="flex items-center justify-between rounded-[1.15rem] border border-zinc-800 bg-black/20 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-xs font-semibold text-zinc-100">
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-100">{exercise.title}</p>
                        <p className="text-xs text-zinc-500">{exercise.detail}</p>
                      </div>
                    </div>
                    <Play className="h-4 w-4 text-zinc-600" />
                  </div>
                ))}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button className="h-12 rounded-full bg-zinc-100 text-black hover:bg-white">
                  <Play className="mr-2 h-4 w-4" />
                  Начать тренировку
                </Button>
                <Button variant="outline" className="h-12 rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900">
                  Внести веса и повторы
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.8rem] border-zinc-800/90 bg-zinc-950/90">
            <CardHeader className="pb-4">
              <CardTitle className="text-zinc-50">Активность</CardTitle>
              <CardDescription className="text-zinc-400">
                Ритм тренировок и активности за неделю.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex h-48 items-end gap-2 rounded-[1.4rem] border border-zinc-800 bg-black/20 p-4">
                {data.activity.week.map((item) => (
                  <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-full w-full items-end rounded-full bg-zinc-900/80 p-1">
                      <div
                        className="w-full rounded-full bg-[linear-gradient(180deg,rgba(214,255,128,0.95),rgba(111,255,217,0.82))]"
                        style={{ height: `${item.value}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-zinc-500">{item.label}</span>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <OverviewTile icon={<Target className="h-4 w-4" />} label="Выполнение недели" value={data.client.adherence} helper="Из плана выполнено вовремя" />
                <OverviewTile icon={<Droplets className="h-4 w-4" />} label="Вода" value={data.client.water} helper="Отслеживание привычек" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.8rem] border-zinc-800/90 bg-zinc-950/90">
            <CardHeader className="pb-4">
              <CardTitle className="text-zinc-50">Обзор</CardTitle>
              <CardDescription className="text-zinc-400">
                Короткая сводка по текущему состоянию.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative mx-auto flex h-40 w-40 items-center justify-center rounded-full border border-zinc-800 bg-[radial-gradient(circle_at_center,rgba(211,255,130,0.12),transparent_55%)]">
                <div
                  className="absolute inset-3 rounded-full border-8 border-lime-300/15"
                  style={{
                    background: `conic-gradient(rgba(211,255,130,0.95) ${data.overview.completion}%, rgba(39,39,42,0.8) ${data.overview.completion}% 100%)`,
                  }}
                />
                <div className="relative z-10 rounded-full bg-zinc-950 px-4 py-3 text-center">
                  <p className="text-3xl font-semibold text-zinc-50">{data.overview.completion}%</p>
                  <p className="text-xs text-zinc-500">Прогресс недели</p>
                </div>
              </div>

              <div className="grid gap-2">
                <MiniStat icon={<Flame className="h-4 w-4" />} label="Тренировок в неделю" value={data.overview.workoutsWeek} />
                <MiniStat icon={<Trophy className="h-4 w-4" />} label="Тренировок за месяц" value={data.overview.workoutsMonth} />
                <MiniStat icon={<Clock3 className="h-4 w-4" />} label="Изменение веса" value={data.overview.weightDelta} />
                <MiniStat icon={<HeartPulse className="h-4 w-4" />} label="Восстановление" value={data.overview.recovery} />
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr,0.9fr]">
          <Card className="rounded-[1.8rem] border-zinc-800/90 bg-zinc-950/90">
            <CardHeader>
              <CardTitle className="text-zinc-50">Цели на неделю</CardTitle>
              <CardDescription className="text-zinc-400">
                Небольшие ориентиры, которые помогают держать ритм.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {data.focusCards.map((card) => (
                <div
                  key={card.id}
                  className="rounded-[1.2rem] border border-zinc-800 bg-[linear-gradient(180deg,rgba(214,255,128,0.10),rgba(9,9,11,0.35))] p-4"
                >
                  <p className="text-sm font-medium text-zinc-100">{card.title}</p>
                  <p className="mt-2 text-sm text-zinc-400">{card.target}</p>
                  <p className="mt-3 text-xs text-lime-200">{card.status}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[1.8rem] border-zinc-800/90 bg-zinc-950/90">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-zinc-50">Прогресс</CardTitle>
                <CardDescription className="text-zinc-400">
                  Вес, силовой прогресс и заметные изменения.
                </CardDescription>
              </div>
              <Badge className="rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300">
                Еженедельно
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                {data.progress.map((item) => (
                  <div key={item.label} className="rounded-[1.2rem] border border-zinc-800 bg-black/20 p-4">
                    <p className="text-sm text-zinc-500">{item.label}</p>
                    <p className="mt-2 text-xl font-semibold text-zinc-50">{item.value}</p>
                    <p className="mt-1 text-sm text-zinc-400">{item.helper}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {data.highlights.map((item) => (
                  <div key={item.id} className="rounded-[1.2rem] border border-zinc-800 bg-black/20 p-4">
                    <p className="text-sm text-zinc-500">{item.label}</p>
                    <p className="mt-2 text-2xl font-semibold text-zinc-50">{item.value}</p>
                    <p className="mt-1 text-sm text-zinc-400">{item.helper}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.8rem] border-zinc-800/90 bg-zinc-950/90">
            <CardHeader>
              <CardTitle className="text-zinc-50">Связь с тренером</CardTitle>
              <CardDescription className="text-zinc-400">
                Telegram остаётся частью маршрута и усиливает поддержку.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-[1.2rem] border border-zinc-800 bg-black/20 p-4">
                <p className="text-sm font-medium text-zinc-100">{data.trainer.displayName}</p>
                <p className="mt-1 text-sm text-zinc-500">{data.trainer.name}</p>
              </div>
              <Button asChild className="w-full rounded-full bg-zinc-100 text-black hover:bg-white">
                <Link href={data.trainer.telegramLink} target="_blank" rel="noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Написать тренеру
                </Link>
              </Button>
              <div className="rounded-[1.2rem] border border-zinc-800 bg-black/20 p-4">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-zinc-500" />
                  <p className="text-sm font-medium text-zinc-100">Уведомления</p>
                </div>
                <div className="mt-3 grid gap-2">
                  {data.notifications.map((notification) => (
                    <div key={notification} className="rounded-2xl border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-400">
                      {notification}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr,0.95fr]">
          <Card className="rounded-[1.8rem] border-zinc-800/90 bg-zinc-950/90">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-zinc-50">История и рекомендации</CardTitle>
                <CardDescription className="text-zinc-400">
                  Последние тренировки и фокус на ближайшие дни.
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100">
                Смотреть всё
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {data.history.map((row) => (
                  <div key={row.id} className="flex items-center justify-between rounded-[1.2rem] border border-zinc-800 bg-black/20 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{row.detail}</p>
                      <p className="text-xs text-zinc-500">{row.date}</p>
                    </div>
                    <Badge className="rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300">
                      {row.status}
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="grid gap-3">
                {data.recommendations.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-[1.2rem] border border-zinc-800 bg-black/20 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{item.title}</p>
                      <p className="mt-1 text-sm text-zinc-500">{item.helper}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-zinc-600" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card className="rounded-[1.8rem] border-zinc-800/90 bg-zinc-950/90">
              <CardHeader>
                <CardTitle className="text-zinc-50">Пульс и восстановление</CardTitle>
                <CardDescription className="text-zinc-400">
                  Упрощённый wellness-слой без перегруза.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex h-40 items-end gap-2 rounded-[1.4rem] border border-zinc-800 bg-black/20 p-4">
                  {data.heartRate.map((item, index) => (
                    <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex h-full w-full items-end rounded-full bg-zinc-900/80 p-1">
                        <div
                          className={`w-full rounded-full ${index === data.heartRate.length - 2 ? "bg-lime-300" : "bg-[linear-gradient(180deg,rgba(111,255,217,0.9),rgba(77,208,255,0.75))]"}`}
                          style={{ height: `${item.value}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-zinc-500">{item.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[1.8rem] border-zinc-800/90 bg-zinc-950/90">
              <CardHeader>
                <CardTitle className="text-zinc-50">Питание и привычки</CardTitle>
                <CardDescription className="text-zinc-400">
                  Лёгкий мотивационный блок, который поддерживает основной режим.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {data.nutritionPlan.map((item, index) => (
                  <div
                    key={item.id}
                    className={`rounded-[1.2rem] border px-4 py-3 ${
                      index === 1
                        ? "border-emerald-300/20 bg-[linear-gradient(180deg,rgba(111,255,217,0.14),rgba(9,9,11,0.4))]"
                        : "border-zinc-800 bg-black/20"
                    }`}
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">{item.day}</p>
                    <p className="mt-2 text-sm font-medium text-zinc-100">{item.title}</p>
                    <p className="mt-1 text-sm text-zinc-500">{item.helper}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}

function QuickAction({
  href,
  label,
  helper,
}: {
  href: string;
  label: string;
  helper: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[1.2rem] border border-zinc-800 bg-black/20 p-4 transition hover:border-zinc-700 hover:bg-zinc-900/40"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-100">{label}</p>
          <p className="mt-1 text-sm text-zinc-500">{helper}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-zinc-600 transition group-hover:text-zinc-300" />
      </div>
    </Link>
  );
}

function Field({ label, defaultValue }: { label: string; defaultValue: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-zinc-300">{label}</Label>
      <Input defaultValue={defaultValue} className="h-11 rounded-2xl border-zinc-800 bg-zinc-950/60 text-zinc-100" />
    </div>
  );
}

function OverviewTile({
  icon,
  label,
  value,
  helper,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-[1.2rem] border border-zinc-800 bg-black/20 p-4">
      <div className="flex items-center gap-2 text-zinc-500">
        {icon}
        <p className="text-sm">{label}</p>
      </div>
      <p className="mt-2 text-xl font-semibold text-zinc-50">{value}</p>
      <p className="mt-1 text-sm text-zinc-400">{helper}</p>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-[1.1rem] border border-zinc-800 bg-black/20 px-4 py-3">
      <div className="flex items-center gap-2 text-zinc-400">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-semibold text-zinc-100">{value}</span>
    </div>
  );
}
