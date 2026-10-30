import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/api";

// Browser version of the Bluebook-style locked lesson.
// A web page cannot stop a student from leaving, so leaving is detected,
// reported to the teacher and the lesson is paused until the student comes back.
// Real blocking needs the native wrapper (iOS Assessment Mode / Android Lock Task).

export function useLockMode(locked: boolean) {
  const [started, setStarted] = useState(!locked);
  const [away, setAway] = useState(false);
  const awayRef = useRef(false);

  const report = (type: "left" | "returned") => api("/coding/lock-event", { body: { type } }).catch(() => {});

  const releasedRef = useRef(false);

  const leave = useCallback(() => {
    if (awayRef.current || releasedRef.current) return;
    awayRef.current = true;
    setAway(true);
    report("left");
  }, []);

  // Not awaited: some embedded views never settle the request.
  // If fullscreen is refused (iPhone Safari, some app views), leaving is still detected.
  const enterFullscreen = () => {
    if (document.fullscreenEnabled && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const start = () => {
    enterFullscreen();
    setStarted(true);
  };

  const comeBack = () => {
    enterFullscreen();
    awayRef.current = false;
    setAway(false);
    report("returned");
  };

  useEffect(() => {
    if (!locked || !started) return;
    const onVisibility = () => {
      if (document.hidden) leave();
    };
    const onBlur = () => {
      // Clicking into the app preview moves focus into the iframe; that is not leaving.
      setTimeout(() => {
        if (document.activeElement?.tagName !== "IFRAME" && !document.hasFocus()) leave();
      }, 50);
    };
    const onFullscreen = () => {
      if (document.fullscreenEnabled && !document.fullscreenElement) leave();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFullscreen);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFullscreen);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [locked, started, leave]);

  const release = async () => {
    releasedRef.current = true;
    setStarted(false);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      // already out of fullscreen
    }
  };

  return { started, away, start, comeBack, release };
}
