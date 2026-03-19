import type { Metadata } from "next";
import { TrainersCatalogClient } from "@/app/trainers/TrainersCatalogClient";

export const metadata: Metadata = {
  title: "Каталог лучших тренеров | Trainer",
  description:
    "Найди своего идеального наставника. Просматривай профили тренеров, их команды и записывайся на тренировки онлайн.",
};

export default function TrainersCatalogPage() {
  return <TrainersCatalogClient />;
}

