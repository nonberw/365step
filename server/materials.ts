import fs from "node:fs";
import path from "node:path";
import mammoth from "mammoth";
import { del, get, put } from "@vercel/blob";
import type { MaterialInfo } from "../shared/types";
import { HttpError } from "./http";

// Teacher uploads (exam materials, textbooks): a private Vercel Blob store in production
// (BLOB_READ_WRITE_TOKEN), a folder next to the database locally.
// Text is extracted once on upload so AI features and search never re-parse the file.

const BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;
export const UPLOADS = path.resolve(process.env.UPLOADS_DIR || (process.env.VERCEL ? "/tmp/uploads" : path.join("data", "uploads")));
if (!BLOB) fs.mkdirSync(UPLOADS, { recursive: true });

export const MAX_UPLOAD = 32 * 1024 * 1024;

const KINDS: Record<string, MaterialInfo["kind"]> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "text",
  "text/markdown": "text",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "image/gif": "image",
};

const EXT: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export function detect(name: string, mime: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const type = KINDS[mime] ? mime : EXT[ext];
  const kind = type ? KINDS[type] : undefined;
  if (!type || !kind) throw new HttpError(415, "Поддерживаются PDF, DOCX, TXT и картинки (PNG, JPG, WebP)");
  return { mime: type, kind };
}

export async function extract(kind: MaterialInfo["kind"], buf: Buffer): Promise<{ text: string; pages: number | null; pageTexts?: string[] }> {
  if (kind === "text") return { text: buf.toString("utf8"), pages: null };
  if (kind === "docx") {
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return { text: value, pages: null };
  }
  if (kind === "pdf") {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = getDocument({ data: new Uint8Array(buf), useSystemFonts: true });
    const doc = await task.promise;
    const pageTexts: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pageTexts.push(
        content.items
          .map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : ""))
          .join("")
          .replace(/[ \t]+/g, " ")
          .trim(),
      );
    }
    const pages = doc.numPages;
    await task.destroy();
    return { text: pageTexts.join("\n\n"), pages, pageTexts };
  }
  return { text: "", pages: null };
}

const blobPath = (id: string) => `uploads/${path.basename(id)}`;

export async function save(id: string, buf: Buffer, mime: string) {
  if (BLOB) await put(blobPath(id), buf, { access: "private", contentType: mime, addRandomSuffix: false });
  else fs.writeFileSync(path.join(UPLOADS, path.basename(id)), buf);
}

export async function read(id: string): Promise<Buffer | null> {
  if (BLOB) {
    const r = await get(blobPath(id), { access: "private" }).catch(() => null);
    if (!r || r.statusCode !== 200) return null;
    return Buffer.from(await new Response(r.stream).arrayBuffer());
  }
  const file = path.join(UPLOADS, path.basename(id));
  return fs.existsSync(file) ? fs.readFileSync(file) : null;
}

export async function remove(id: string) {
  if (BLOB) await del(blobPath(id)).catch(() => {});
  else fs.rmSync(path.join(UPLOADS, path.basename(id)), { force: true });
}

export const fileName = (req: { header(name: string): string | undefined }) => {
  try {
    return decodeURIComponent(req.header("x-file-name") ?? "").slice(0, 160) || "Без названия";
  } catch {
    return "Без названия";
  }
};
