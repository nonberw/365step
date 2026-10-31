import { ART, PHOTO } from "@/lib/format";

// Subject cover images: public-domain paintings from Wikimedia Commons and Unsplash photos.
const art = (file: string) => `https://commons.wikimedia.org/wiki/Special:FilePath/${file}?width=900`;

export const ENT_IMAGE: Record<string, string> = {
  "history-kz": ART.wanderer,
  reading: PHOTO.books,
  "math-lit": PHOTO.lecture,
  math: art("Da_Vinci_Vitruve_Luc_Viatour.jpg"),
  physics: art("Wright_of_Derby,_The_Orrery.jpg"),
  informatics: PHOTO.code,
  chemistry: art("Joseph_Wright_of_Derby_The_Alchemist.jpg"),
  biology: art("Rembrandt_-_The_Anatomy_Lesson_of_Dr_Nicolaes_Tulp.jpg"),
  geography: art("Johannes_Vermeer_-_The_Geographer_-_Google_Art_Project.jpg"),
  "world-history": art("Hans_Holbein_the_Younger_-_The_Ambassadors_-_Google_Art_Project.jpg"),
  law: art("Jacques-Louis_David_-_The_Death_of_Socrates_-_Google_Art_Project.jpg"),
  english: PHOTO.writing,
  kazakh: ART.starry,
  "kazakh-lit": ART.monet,
  russian: ART.painting,
  "russian-lit": ART.wave,
};

/** Accent per block on the 140-point score bar. */
export const ENT_COLOR: Record<string, string> = {
  "history-kz": "#2c7400",
  reading: "#b5121b",
  "math-lit": "#9be300",
};
export const PROFILE_COLORS = ["#1d1919", "#5f5a5a"];
