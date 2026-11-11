import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Skull, Trophy } from "lucide-react";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { ErrorBox, PageHeader } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import type { IeltsContent } from "./content";

// «Не молчи»: speak without stopping. While you are silent the pressure bar
// moves towards the edge; your voice pushes it back. Trains fluency for Part 2.

const LEVELS = [
  { id: "easy", label: "Easy", band: "IELTS 4–5", silence: 12 },
  { id: "mid", label: "Medium", band: "IELTS 5.5–6", silence: 8 },
  { id: "hard", label: "Hard", band: "IELTS 7+", silence: 5 },
  { id: "pro", label: "Very hard", band: "IELTS 8+", silence: 2.5 },
];
const ROUND = 60;
const FALLBACK_TOPICS = ["Describe a place you would like to visit.", "Talk about a skill you want to learn.", "Describe your favourite teacher."];

export default function Games() {
  const content = useApi<IeltsContent>("/ielts/content");
  const topics = content.data?.speaking.part2.map((c) => c.topic) ?? FALLBACK_TOPICS;
  const [level, setLevel] = useState(LEVELS[1]!);
  const [state, setState] = useState<"idle" | "play" | "lost" | "won">("idle");
  const [topic, setTopic] = useState("");
  const [pressure, setPressure] = useState(0); // 0..1
  const [time, setTime] = useState(0);
  const [loud, setLoud] = useState(false);
  const [error, setError] = useState("");
  const [xp, setXp] = useState<number | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const raf = useRef(0);

  const cleanup = () => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    ctx.current?.close().catch(() => {});
    stream.current = null;
    ctx.current = null;
  };
  useEffect(() => cleanup, []);

  async function start() {
    setError("");
    setXp(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access is needed to detect speech. Allow access in your browser settings.");
      return;
    }
    const ac = new AudioContext();
    ctx.current = ac;
    const analyser = ac.createAnalyser();
    analyser.fftSize = 1024;
    ac.createMediaStreamSource(stream.current).connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    setTopic(topics[Math.floor(Math.random() * topics.length)]!);
    setPressure(0);
    setTime(0);
    setState("play");
    let last = performance.now();
    let p = 0;
    let t = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += ((v - 128) / 128) ** 2;
      const rms = Math.sqrt(sum / buf.length);
      const speaking = rms > 0.035;
      setLoud(speaking);
      p = speaking ? Math.max(0, p - dt / 1.5) : p + dt / level.silence;
      t += dt;
      setPressure(Math.min(1, p));
      setTime(t);
      if (p >= 1) return end("lost", t);
      if (t >= ROUND) return end("won", t);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }

  async function end(result: "lost" | "won", t: number) {
    cleanup();
    setState(result);
    const mult = LEVELS.indexOf(level) + 1;
    const score = Math.round(t * 10 * mult + (result === "won" ? 200 * mult : 0));
    const r = await api<{ xp: number }>("/me/game-score", { body: { game: "speak-or-die", score } }).catch(() => null);
    setXp(r?.xp ?? 0);
  }

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <PageHeader eyebrow={"IELTS · Games"} title={"Keep speaking"} description={"Speak about a random Part 2 topic for 60 seconds. Long pauses fill the meter; speaking reduces it. This is a fluency exercise, not a band assessment."} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        {LEVELS.map((l) => (
          <button key={l.id} type="button" disabled={state === "play"} onClick={() => setLevel(l)} className={cn("rounded-2xl border-2 p-3 text-left", level.id === l.id ? "border-primary" : "border-border hover:border-foreground/30")}>
            <p className="font-display font-semibold">{l.label}</p>
            <p className="text-xs text-muted-foreground">{l.band}</p>
            <p className="mt-1 text-xs">{l.silence} Silence limit</p>
          </button>
        ))}
      </div>

      <Card className="flex flex-col gap-5 bg-secondary text-secondary-foreground">
        {state === "idle" && <p className="text-sm text-white/70">Select Play, allow microphone access and speak about the topic shown.</p>}
        {topic && state !== "idle" && <p className="font-display text-xl font-semibold">{topic}</p>}
        <div className="relative h-14 overflow-hidden rounded-2xl bg-white/10">
          <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent/70 to-primary transition-[width] duration-100" style={{ width: `${pressure * 100}%` }} />
          <div className="absolute inset-y-0 right-3 grid place-items-center">
            <Skull className={cn("size-7", pressure > 0.75 ? "text-white" : "text-white/40")} />
          </div>
          <div className="absolute inset-y-0 left-3 flex items-center gap-2 text-sm font-semibold">
            {loud ? <Mic className="size-5 text-white" /> : <MicOff className="size-5 text-white/50" />}
            {state === "play" && (loud ? "Speaking…" : "Silence…")}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Badge tone="brand" className="tabular">
            {Math.floor(time)} / {ROUND} s
          </Badge>
          {state === "play" ? (
            <Button variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10" onClick={() => end("lost", time)}>
              Stop
            </Button>
          ) : (
            <Button variant="accent" onClick={start}>
              {state === "idle" ? "Play" : "Try again"}
            </Button>
          )}
        </div>
        {(state === "lost" || state === "won") && (
          <p className="flex items-center gap-2 text-sm">
            {state === "won" ? <Trophy className="size-5 text-accent" /> : <Skull className="size-5" />}
            {state === "won" ? "You spoke for the full minute!" : `The pause limit was reached. ${Math.floor(time)}seconds remaining.`}
            {xp !== null && ` +${xp} XP`}
          </p>
        )}
      </Card>
      <ErrorBox message={error} />
      <p className="text-xs text-muted-foreground">Audio is not recorded or uploaded. Your browser only measures volume to detect speech.</p>
    </div>
  );
}
