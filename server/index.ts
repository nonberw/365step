import fs from "node:fs";
import path from "node:path";
import express from "express";
import { app } from "./app";
import { aiMode } from "./ai";

const dist = path.resolve("dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

// API_PORT, not PORT: dev tools often set PORT for the web server (vite) itself.
const port = Number(process.env.API_PORT) || 8787;
app.listen(port, () => {
  console.log(`Нурбек Чурбек API: http://localhost:${port} (ИИ: ${aiMode === "ai" ? "Claude" : "демо-режим"})`);
});
