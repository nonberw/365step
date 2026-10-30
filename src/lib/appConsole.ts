// A small script injected into a student's app: it forwards console output and uncaught errors from the
// sandboxed iframe to the page with postMessage, so the student sees them like in browser developer tools.

export interface ConsoleLine {
  level: "log" | "warn" | "error";
  text: string;
  at: number;
}

const BRIDGE = `<script>(function(){
  function send(level, args){
    try {
      var text = Array.prototype.map.call(args, function(a){
        if (a instanceof Error) return a.message;
        if (typeof a === "string") return a;
        try { return JSON.stringify(a); } catch (e) { return String(a); }
      }).join(" ");
      parent.postMessage({ bsts: "console", level: level, text: text.slice(0, 2000), at: Date.now() }, "*");
    } catch (e) {}
  }
  ["log", "info", "warn", "error"].forEach(function(k){
    var orig = console[k];
    console[k] = function(){ send(k === "info" ? "log" : k, arguments); return orig && orig.apply(console, arguments); };
  });
  window.addEventListener("error", function(e){ send("error", [(e.message || "Ошибка") + (e.lineno ? " (строка " + e.lineno + ")" : "")]); });
  window.addEventListener("unhandledrejection", function(e){ send("error", ["Promise: " + (e.reason && e.reason.message || e.reason)]); });
})();</script>`;

/** The app's HTML with the console bridge as the very first script. */
export function withConsole(html: string): string {
  const m = /<head[^>]*>/i.exec(html);
  if (m) return html.slice(0, m.index + m[0].length) + BRIDGE + html.slice(m.index + m[0].length);
  return BRIDGE + html;
}
