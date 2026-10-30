import type { PublicUser } from "@shared/types";
import { TITLES } from "@shared/types";

/** Time-of-day greeting in Almaty time (UTC+5). */
export function greeting(date = new Date()) {
  const h = (date.getUTCHours() + 5) % 24;
  if (h >= 5 && h < 12) return "Доброе утро";
  if (h >= 12 && h < 18) return "Добрый день";
  if (h >= 18 && h < 23) return "Добрый вечер";
  return "Доброй ночи";
}

/** Students by first name; teachers by title and surname: «Мистер Ахметов». */
export function addressOf(user: PublicUser) {
  if (user.role === "teacher") return `${user.title ? TITLES[user.title] : ""} ${user.lastName}`.trim();
  return user.firstName;
}

export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export function daysUntil(date: string | undefined) {
  if (!date) return null;
  const d = Date.parse(date + "T09:00:00+05:00");
  if (!Number.isFinite(d)) return null;
  return Math.max(0, Math.ceil((d - Date.now()) / 86_400_000));
}

export const fmtDate = (t: number | string) => new Date(t).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
export const fmtTime = (t: number) => new Date(t).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
export const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${Math.round(v * 100)}%`);

export function mmss(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Public-domain paintings (Wikimedia Commons) for the greeting banners, like the reference app.
const art = (file: string) => `https://commons.wikimedia.org/wiki/Special:FilePath/${file}?width=1600`;
export const ART = {
  athens: art("%22The_School_of_Athens%22_by_Raffaello_Sanzio_da_Urbino.jpg"),
  starry: art("Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg"),
  astronomer: art("Johannes_Vermeer_-_The_Astronomer_-_1668.jpg"),
  painting: art("Jan_Vermeer_-_The_Art_of_Painting_-_Google_Art_Project.jpg"),
  wave: art("Tsunami_by_hokusai_19th_century.jpg"),
  wanderer: art("Caspar_David_Friedrich_-_Wanderer_above_the_sea_of_fog.jpg"),
  monet: art("Claude_Monet,_Impression,_soleil_levant.jpg"),
};

export const PHOTO = {
  team: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1400&q=80&auto=format&fit=crop",
  books: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1400&q=80&auto=format&fit=crop",
  code: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1400&q=80&auto=format&fit=crop",
  writing: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1400&q=80&auto=format&fit=crop",
  classroom: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1400&q=80&auto=format&fit=crop",
  lecture: "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=1400&q=80&auto=format&fit=crop",
};
