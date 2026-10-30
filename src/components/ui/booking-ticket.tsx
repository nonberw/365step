import { useEffect, useId, useRef } from "react";
import { CalendarPlus, MapPin, Video } from "lucide-react";
import type { ConsultSlot } from "@shared/types";
import { cn } from "@/lib/utils";

// Adapted from 21st.dev «Meeting Booking Calendar» (kedhareswer): a confirmed booking
// becomes a perforated ticket with a date stub, an ink stamp and an .ics download.

/** One-event calendar file that Google Calendar, Apple Calendar and Outlook import. */
export function icsFile(s: ConsultSlot) {
  const z = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (v: string) => v.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BSTS AI Lab//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${s.id}@bsts-ai-lab`,
    `DTSTAMP:${z(Date.now())}`,
    `DTSTART:${z(s.startsAt)}`,
    `DTEND:${z(s.startsAt + s.durationMin * 60_000)}`,
    `SUMMARY:${esc(`${s.title} — ${s.teacher}`)}`,
    `DESCRIPTION:${esc([s.description, s.onlineUrl].filter(Boolean).join("\n"))}`,
    `LOCATION:${esc(s.place || s.onlineUrl || "BSTS")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(s: ConsultSlot) {
  const url = URL.createObjectURL(new Blob([icsFile(s)], { type: "text/calendar;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `bsts-${s.startsAt}.ics` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const timeOf = (t: number) => new Date(t).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

const STUB = 92;
const perforation = `radial-gradient(circle 10px at ${STUB}px 0, transparent 97%, #000 100%) top/100% 51% no-repeat, radial-gradient(circle 10px at ${STUB}px 100%, transparent 97%, #000 100%) bottom/100% 51% no-repeat`;

function Impression({ words }: { words: string }) {
  const uid = useId().replace(/:/g, "");
  const ring = words.toUpperCase().repeat(3).slice(0, 40);
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" className="ticket-press pointer-events-none absolute right-2 top-2 size-[84px] rotate-[-12deg] text-primary opacity-90 mix-blend-multiply dark:mix-blend-screen">
      <defs>
        <path id={`${uid}-p`} d="M60,60 m-45,0 a45,45 0 1,1 90,0 a45,45 0 1,1 -90,0" />
        <filter id={`${uid}-ink`} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.25 1.45" result="m" />
          <feComposite in="SourceGraphic" in2="m" operator="in" />
        </filter>
      </defs>
      <g filter={`url(#${uid}-ink)`} fill="none" stroke="currentColor">
        <circle cx="60" cy="60" r="56" strokeWidth="4" />
        <circle cx="60" cy="60" r="34" strokeWidth="2.6" />
        <text fontSize="12" fontWeight="900" letterSpacing="1.2" fill="currentColor" stroke="none" className="font-display">
          <textPath href={`#${uid}-p`} textLength="276" lengthAdjust="spacing">
            {ring}
          </textPath>
        </text>
        <path d="M44 61l11 11 22-24" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** `stamp` plays the flip-and-stamp animation once, right after booking. */
export function BookingTicket({ slot, stamp, actions, className }: { slot: ConsultSlot; stamp?: boolean; actions?: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!stamp || !ref.current || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    ref.current.animate([{ transform: "perspective(1000px) rotateX(-90deg)" }, { transform: "perspective(1000px) rotateX(9deg)", offset: 0.68 }, { transform: "perspective(1000px) rotateX(0deg)" }], {
      duration: 460,
      easing: "cubic-bezier(.2,.8,.3,1)",
    });
    ref.current.querySelector(".ticket-press")?.animate(
      [
        { transform: "rotate(-26deg) scale(1.8)", opacity: 0 },
        { transform: "rotate(-12deg) scale(.9)", opacity: 0.95, offset: 0.62 },
        { transform: "rotate(-12deg) scale(1)", opacity: 0.9 },
      ],
      { duration: 360, delay: 420, easing: "cubic-bezier(.3,0,.25,1)", fill: "backwards" },
    );
  }, [stamp]);

  const d = new Date(slot.startsAt);
  const cancelled = slot.cancelled;
  return (
    <div ref={ref} className={cn("drop-shadow-[0_10px_18px_rgba(0,0,0,0.14)]", cancelled && "opacity-60", className)}>
    <div className="relative grid rounded-[18px] bg-card" style={{ gridTemplateColumns: `${STUB}px minmax(0,1fr)`, WebkitMask: perforation, mask: perforation }}>
      <div className={cn("flex flex-col items-center justify-center gap-0.5 rounded-l-[18px] border-r-2 border-dashed border-white/30 px-2 py-5 text-white", cancelled ? "bg-muted-foreground" : "bg-primary")}>
        <small className="text-[11px] font-bold tracking-[0.12em]">{d.toLocaleDateString("ru-RU", { month: "short" }).replace(".", "").toUpperCase()}</small>
        <strong className="font-display text-5xl font-extrabold leading-none tracking-tight">{d.getDate()}</strong>
        <small className="text-[11px] font-bold tracking-[0.12em]">{d.toLocaleDateString("ru-RU", { weekday: "short" }).toUpperCase()}</small>
      </div>
      <div className="relative min-w-0 px-5 py-4">
        {!cancelled && <Impression words={`Записан · ${d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} · `} />}
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">{cancelled ? "Отменено учителем" : slot.kind === "lesson" ? "Доп. урок" : "Консультация"}</p>
        <h3 className="mt-1 pr-20 font-display text-lg font-bold leading-snug">{slot.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          <b className="font-semibold text-foreground">
            {timeOf(slot.startsAt)} – {timeOf(slot.startsAt + slot.durationMin * 60_000)}
          </b>{" "}
          · {slot.teacher}
          {slot.subject && ` · ${slot.subject}`}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {slot.place && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" /> {slot.place}
            </span>
          )}
          {slot.onlineUrl && (
            <a href={slot.onlineUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline">
              <Video className="size-3.5" /> Онлайн-встреча
            </a>
          )}
        </p>
        {slot.myNote && <p className="mt-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">Твой вопрос: {slot.myNote}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {!cancelled && (
            <button type="button" onClick={() => downloadIcs(slot)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-secondary px-4 font-display text-[13px] font-semibold text-secondary-foreground transition-transform active:scale-[.97]">
              <CalendarPlus className="size-4" /> В календарь
            </button>
          )}
          {actions}
        </div>
      </div>
    </div>
    </div>
  );
}
