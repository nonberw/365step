// The Gen Z voice of 365step (folk-style: lowercase, friendly, a bit of meme). One place for the phrases,
// so lessons, notifications and the plant speak the same way.

const pick = <T,>(xs: readonly T[], seed?: number) => xs[(seed ?? Math.floor(Math.random() * 1e6)) % xs.length]!;

export const PRAISE = ["это база 💅", "имба!", "ровно 🔥", "slay ✨", "красава 😎", "пушка 💥", "в точку 🎯", "легенда 🫡"] as const;
export const COMFORT = ["бывает, го ещё раз 💪", "не кринж, а опыт 🗿", "почти! разберём", "мимо, но мы не сдаёмся", "ошибка = +1 к скиллу"] as const;

/** A big meme sticker and caption for the end of a lesson. */
export const LESSON_MEMES: Record<"perfect" | "good", { sticker: string; caption: string }[]> = {
  perfect: [
    { sticker: "🗿", caption: "ноль ошибок. ты вообще человек?" },
    { sticker: "💅", caption: "без единой ошибки. это база" },
    { sticker: "👑", caption: "main character energy" },
  ],
  good: [
    { sticker: "😎", caption: "урок закрыт, вайб пойман" },
    { sticker: "🔥", caption: "серия горит, растение растёт" },
    { sticker: "🫡", caption: "ещё шаг к экзамену. уважение" },
  ],
};

export const praise = (seed?: number) => pick(PRAISE, seed);
export const comfort = (seed?: number) => pick(COMFORT, seed);
export const lessonMeme = (perfect: boolean) => pick(perfect ? LESSON_MEMES.perfect : LESSON_MEMES.good);
