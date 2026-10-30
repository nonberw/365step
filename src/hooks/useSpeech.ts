import { useCallback, useEffect, useRef, useState } from "react";

// Browser speech recognition (Chrome, Edge, Safari). Audio is processed by the
// browser's own speech service; our server only receives the text transcript.

type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

const Ctor = (): (new () => Rec) | null => {
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export function useSpeech(lang = "en-US") {
  const [supported] = useState(() => typeof window !== "undefined" && !!Ctor());
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const rec = useRef<Rec | null>(null);
  const wanted = useRef(false);

  const start = useCallback(() => {
    const C = Ctor();
    if (!C) return;
    setError("");
    const r = new C();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let fin = "";
      let mid = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        if (res.isFinal) fin += res[0].transcript + " ";
        else mid += res[0].transcript;
      }
      if (fin) setFinalText((t) => (t + " " + fin).replace(/\s+/g, " ").trim());
      setInterim(mid);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wanted.current = false;
        setError("Нет доступа к микрофону. Разреши его в настройках браузера или напечатай ответ.");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        setError("Распознавание речи прервалось. Можно продолжить или напечатать ответ.");
      }
    };
    // Browsers stop after a pause; restart while the student is still answering.
    r.onend = () => {
      if (wanted.current) {
        try {
          r.start();
        } catch {
          setListening(false);
        }
      } else setListening(false);
    };
    rec.current = r;
    wanted.current = true;
    try {
      r.start();
      setListening(true);
    } catch {
      setError("Не удалось включить микрофон");
    }
  }, [lang]);

  const stop = useCallback(() => {
    wanted.current = false;
    rec.current?.stop();
    setListening(false);
    setInterim("");
  }, []);

  useEffect(() => () => {
    wanted.current = false;
    rec.current?.stop();
  }, []);

  return { supported, listening, text: finalText, interim, setText: setFinalText, error, start, stop };
}
