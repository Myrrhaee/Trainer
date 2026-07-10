"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  RadioTower,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import { TrainerShell } from "@/components/trainer/trainer-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getDemoPrograms } from "@/lib/demo-data";
import { cn, createSafeId } from "@/lib/utils";

type ProductStatus = "published" | "draft";
type ProductFilter = "all" | ProductStatus;

type SalesProduct = {
  id: string;
  title: string;
  weeks: number;
  days: number;
  price: number;
  status: ProductStatus;
  sales: number;
  buyers: number;
  conversion: number;
  slug: string;
};

const recentSales = [
  { client: "Ольга Кузнецова", product: "Снижение веса 6 недель", amount: "4 900 ₽", time: "Сегодня" },
  { client: "Егор Никитин", product: "Персональное ведение 8 недель", amount: "18 000 ₽", time: "Сегодня" },
  { client: "Максим Орлов", product: "Силовой мезоцикл", amount: "6 900 ₽", time: "Вчера" },
];

const filterOptions: Array<{ value: ProductFilter; label: string }> = [
  { value: "all", label: "Все" },
  { value: "published", label: "Витрина" },
  { value: "draft", label: "Черновики" },
];

function formatPrice(value: number) {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-zа-я0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function initialProducts(): SalesProduct[] {
  return getDemoPrograms().map((program, index) => {
    const status: ProductStatus = program.status === "Черновик" ? "draft" : "published";

    return {
      id: program.id,
      title: program.title,
      weeks: program.weeks,
      days: program.dayOptions.length,
      price: program.price,
      status,
      sales: [7, 3, 2, 0][index] ?? 0,
      buyers: [9, 5, 4, 0][index] ?? 0,
      conversion: [9.8, 6.2, 5.4, 0][index] ?? 0,
      slug: normalizeSlug(program.title) || `product-${index + 1}`,
    };
  });
}

function emptyForm() {
  return {
    title: "",
    weeks: "6",
    days: "3",
    price: "4900",
  };
}

export default function TrainerSalesPage() {
  const [products, setProducts] = useState<SalesProduct[]>(initialProducts);
  const [activeFilter, setActiveFilter] = useState<ProductFilter>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const filteredProducts = useMemo(() => {
    return activeFilter === "all"
      ? products
      : products.filter((product) => product.status === activeFilter);
  }, [activeFilter, products]);

  const stats = useMemo(() => {
    const revenue = products.reduce((sum, product) => sum + product.price * product.sales, 0);
    const sold = products.reduce((sum, product) => sum + product.sales, 0);
    const buyers = products.reduce((sum, product) => sum + product.buyers, 0);
    const published = products.filter((product) => product.status === "published");
    const conversion =
      published.length > 0
        ? published.reduce((sum, product) => sum + product.conversion, 0) / published.length
        : 0;

    return [
      { label: "Доход месяца", value: formatPrice(revenue), helper: "ведение и программы", icon: WalletCards },
      { label: "Продано программ", value: String(sold), helper: "за текущий месяц", icon: ShoppingBag },
      { label: "Активных покупателей", value: String(buyers), helper: "с доступом к материалам", icon: Users },
      { label: "Конверсия витрины", value: `${conversion.toFixed(1)}%`, helper: "из просмотра в заявку", icon: TrendingUp },
    ];
  }, [products]);

  const publishReady = useMemo(
    () => products.filter((product) => product.status === "draft" && product.days > 0),
    [products]
  );

  function togglePublish(productId: string) {
    setProducts((current) =>
      current.map((product) =>
        product.id === productId
          ? { ...product, status: product.status === "published" ? "draft" : "published" }
          : product
      )
    );
    toast.success("Статус продукта обновлён");
  }

  async function copyProductLink(product: SalesProduct) {
    const link = `${window.location.origin}/explore/${product.slug}`;

    try {
      await navigator.clipboard.writeText(link);
      toast.success("Ссылка на продукт скопирована");
    } catch {
      toast.error(link);
    }
  }

  function duplicateProduct(product: SalesProduct) {
    setProducts((current) => [
      {
        ...product,
        id: createSafeId(),
        title: `${product.title} · копия`,
        status: "draft",
        sales: 0,
        buyers: 0,
        conversion: 0,
        slug: `${product.slug}-copy`,
      },
      ...current,
    ]);
    toast.success("Черновик продукта создан");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = form.title.trim();
    const weeks = Number.parseInt(form.weeks, 10);
    const days = Number.parseInt(form.days, 10);
    const price = Number.parseInt(form.price, 10);

    if (!title || Number.isNaN(weeks) || Number.isNaN(days) || Number.isNaN(price)) return;

    setProducts((current) => [
      {
        id: createSafeId(),
        title,
        weeks: Math.max(1, weeks),
        days: Math.max(1, days),
        price: Math.max(0, price),
        status: "draft",
        sales: 0,
        buyers: 0,
        conversion: 0,
        slug: normalizeSlug(title) || createSafeId(),
      },
      ...current,
    ]);
    setForm(emptyForm());
    setSheetOpen(false);
    toast.success("Продукт добавлен как черновик");
  }

  return (
    <TrainerShell
      title="Продажи"
      description="Программы, витрина тренера, покупки клиентов и коммерческая сводка."
      headerAction={
        <Button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="hidden h-11 rounded-full bg-lime-300 px-5 text-black hover:bg-lime-200 xl:inline-flex"
        >
          <Plus className="mr-2 h-4 w-4" />
          Новый продукт
        </Button>
      }
    >
      <div className="space-y-5">
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {stats.map(({ label, value, helper, icon: Icon }) => (
            <article key={label} className="rounded-[1.45rem] border border-zinc-800/85 bg-zinc-950/76 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50">{value}</p>
                  <p className="mt-1 text-sm text-zinc-500">{helper}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-black/24 text-zinc-300">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-4">
            <section className="rounded-[1.85rem] border border-zinc-800/85 bg-[linear-gradient(180deg,rgba(18,18,22,0.96),rgba(7,7,9,0.98))] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Storefront</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">Программы и продукты</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setActiveFilter(option.value)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        activeFilter === option.value
                          ? "border-lime-300/24 bg-lime-300/10 text-lime-100"
                          : "border-zinc-800 bg-black/18 text-zinc-500 hover:text-zinc-200"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSheetOpen(true)}
                    className="h-8 rounded-full border-zinc-800 bg-black/18 px-3 text-xs text-zinc-300 hover:bg-zinc-900"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Продукт
                  </Button>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {filteredProducts.map((product) => {
                  const published = product.status === "published";
                  return (
                    <article key={product.id} className="rounded-[1.35rem] border border-white/7 bg-black/18 p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold tracking-tight text-zinc-50">{product.title}</h3>
                            <Badge
                              className={cn(
                                "rounded-full border px-2.5 py-1",
                                published
                                  ? "border-lime-300/18 bg-lime-300/10 text-lime-100"
                                  : "border-zinc-800 bg-zinc-900/70 text-zinc-300"
                              )}
                            >
                              {published ? "Витрина" : "Черновик"}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                            {product.weeks} недель · {product.days} стартовых тренировочных дня · подходит для продажи или назначения клиенту.
                          </p>
                          <div className="mt-4 grid gap-3 sm:grid-cols-4">
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Цена</p>
                              <p className="mt-1 text-lg font-semibold text-zinc-50">{formatPrice(product.price)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Продажи</p>
                              <p className="mt-1 text-lg font-semibold text-zinc-50">{product.sales}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Покупатели</p>
                              <p className="mt-1 text-lg font-semibold text-zinc-50">{product.buyers}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Конверсия</p>
                              <p className="mt-1 text-lg font-semibold text-zinc-50">{product.conversion.toFixed(1)}%</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => togglePublish(product.id)}
                            className="h-9 rounded-full border-zinc-800 bg-zinc-950/45 text-zinc-200 hover:bg-zinc-900"
                          >
                            {published ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                            {published ? "Снять" : "Опубликовать"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => duplicateProduct(product)}
                            className="h-9 rounded-full border-zinc-800 bg-zinc-950/45 text-zinc-200 hover:bg-zinc-900"
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Копия
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void copyProductLink(product)}
                            className="h-9 rounded-full border-zinc-800 bg-zinc-950/45 text-zinc-200 hover:bg-zinc-900"
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Ссылка
                          </Button>
                          <Button asChild variant="outline" className="h-9 rounded-full border-zinc-800 bg-zinc-950/45 text-zinc-200 hover:bg-zinc-900">
                            <Link href="/explore">
                              Витрина
                              <ExternalLink className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
            <section className="rounded-[1.75rem] border border-zinc-800/85 bg-zinc-950/82 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Последние покупки</p>
              <div className="mt-4 space-y-3">
                {recentSales.map((sale) => (
                  <article key={`${sale.client}-${sale.product}`} className="rounded-[1.15rem] border border-white/7 bg-black/18 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-zinc-100">{sale.client}</p>
                        <p className="mt-1 text-xs text-zinc-500">{sale.product}</p>
                        <p className="mt-2 text-xs text-zinc-600">{sale.time}</p>
                      </div>
                      <p className="text-sm font-semibold text-lime-100">{sale.amount}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-zinc-800/85 bg-zinc-950/82 p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-lime-100" />
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Готово к публикации</p>
              </div>
              <div className="mt-4 space-y-3">
                {publishReady.length > 0 ? (
                  publishReady.map((product) => (
                    <article key={product.id} className="rounded-[1.15rem] border border-white/7 bg-black/18 p-3">
                      <p className="text-sm font-medium text-zinc-100">{product.title}</p>
                      <p className="mt-1 text-xs text-zinc-500">{formatPrice(product.price)} · {product.days} тренировочных дня</p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => togglePublish(product.id)}
                        className="mt-3 h-8 rounded-full bg-lime-300 text-xs text-black hover:bg-lime-200"
                      >
                        <RadioTower className="mr-1.5 h-3.5 w-3.5" />
                        Опубликовать
                      </Button>
                    </article>
                  ))
                ) : (
                  <p className="rounded-[1.15rem] border border-dashed border-zinc-800 bg-black/18 p-4 text-sm leading-relaxed text-zinc-500">
                    Все подготовленные продукты уже на витрине.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-lime-300/12 bg-[linear-gradient(180deg,rgba(163,230,53,0.08),rgba(7,7,9,0.96))] p-4">
              <ShoppingBag className="h-5 w-5 text-lime-100" />
              <h2 className="mt-4 text-lg font-semibold text-zinc-50">Продажи как часть ведения</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Витрина теперь управляемая: тренер видит статус продукта, может подготовить черновик, включить публикацию и быстро отправить ссылку.
              </p>
            </section>
          </aside>
        </section>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full border-l border-zinc-800 bg-zinc-950/98 text-zinc-100 sm:max-w-[440px]">
          <SheetHeader>
            <SheetTitle className="text-zinc-50">Новый продукт</SheetTitle>
            <SheetDescription className="text-zinc-400">
              Создайте коммерческий черновик, который позже можно связать с программой и опубликовать.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="space-y-4 px-4">
            <div className="space-y-2">
              <Label htmlFor="product-title" className="text-zinc-300">Название</Label>
              <Input
                id="product-title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Например: Набор массы 8 недель"
                className="border-zinc-800 bg-black/30 text-zinc-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="product-weeks" className="text-zinc-300">Недель</Label>
                <Input
                  id="product-weeks"
                  inputMode="numeric"
                  value={form.weeks}
                  onChange={(event) => setForm((current) => ({ ...current, weeks: event.target.value }))}
                  className="border-zinc-800 bg-black/30 text-zinc-100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-days" className="text-zinc-300">Дней</Label>
                <Input
                  id="product-days"
                  inputMode="numeric"
                  value={form.days}
                  onChange={(event) => setForm((current) => ({ ...current, days: event.target.value }))}
                  className="border-zinc-800 bg-black/30 text-zinc-100"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-price" className="text-zinc-300">Цена, ₽</Label>
              <Input
                id="product-price"
                inputMode="numeric"
                value={form.price}
                onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                className="border-zinc-800 bg-black/30 text-zinc-100"
              />
            </div>

            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)} className="rounded-full border-zinc-800 bg-black/18 text-zinc-300 hover:bg-zinc-900">
                Отменить
              </Button>
              <Button type="submit" disabled={!form.title.trim()} className="rounded-full bg-lime-300 text-black hover:bg-lime-200">
                <Plus className="mr-2 h-4 w-4" />
                Создать
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </TrainerShell>
  );
}
