// The study companion: the student picks a plant, and it grows as XP is earned.

export type PlantSpecies = "cactus" | "sakura" | "flower" | "sunflower";

export const PLANT_SPECIES: PlantSpecies[] = ["cactus", "sakura", "flower", "sunflower"];

export const PLANTS: Record<PlantSpecies, { name: string; blurb: string }> = {
  cactus: { name: "Кактус", blurb: "Упрямый и выносливый: растёт медленно, но цветёт даже в засуху." },
  sakura: { name: "Сакура", blurb: "Из тонкого саженца в облако розовых цветов." },
  flower: { name: "Цветок", blurb: "Бутон раскрывается с каждым пройденным заданием." },
  sunflower: { name: "Подсолнух", blurb: "Тянется к свету и вырастает выше всех." },
};

/** Total XP at which each stage (1–5) starts. */
export const STAGE_XP = [0, 40, 150, 400, 1000] as const;

export const STAGE_NAMES = ["Первый лист", "Побег", "Подросток", "Расцвет", "Мастер"] as const;

export interface PlantGrowth {
  stage: 1 | 2 | 3 | 4 | 5;
  name: string;
  /** XP still needed for the next stage; null at the last stage. */
  toNext: number | null;
  /** 0–1 progress inside the current stage. */
  progress: number;
  nextAt: number | null;
}

export function plantGrowth(xp: number): PlantGrowth {
  let stage = 1;
  for (let i = 0; i < STAGE_XP.length; i++) if (xp >= STAGE_XP[i]!) stage = i + 1;
  const from = STAGE_XP[stage - 1]!;
  const to = STAGE_XP[stage] ?? null;
  return {
    stage: stage as PlantGrowth["stage"],
    name: STAGE_NAMES[stage - 1]!,
    toNext: to === null ? null : Math.max(0, to - xp),
    progress: to === null ? 1 : Math.min(1, Math.max(0, (xp - from) / (to - from))),
    nextAt: to,
  };
}
