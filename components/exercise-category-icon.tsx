import Image from "next/image";
import { Dumbbell } from "lucide-react";

import { getExerciseCategoryIconPath } from "@/lib/exercise-categories";
import { cn } from "@/lib/utils";

export function ExerciseCategoryIcon({
  category,
  alt,
  className,
}: {
  category: string;
  alt?: string;
  className?: string;
}) {
  const iconPath = getExerciseCategoryIconPath(category);

  if (!iconPath) {
    return <Dumbbell className={cn("h-4 w-4", className)} aria-hidden="true" />;
  }

  return (
    <Image
      src={iconPath}
      alt={alt ?? category}
      width={20}
      height={20}
      className={cn("h-5 w-5 object-contain", className)}
      unoptimized
    />
  );
}
