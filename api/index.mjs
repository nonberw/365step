// Vercel serverless entry: every /api/* request is rewritten here (see vercel.json).
// The server is bundled into server-dist/app.mjs by `npm run build:server` during the build.
export { default } from "../server-dist/app.mjs";
