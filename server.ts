import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { openDatabase } from "./server/database.ts";
import { createApi } from "./server/api.ts";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const HOST = process.env.HOST || '127.0.0.1';

  // Caddy is the sole proxy on the private deployment network.
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(express.json({ limit: '256kb' }));
  app.use('/api', createApi(openDatabase()));
  app.use((req, res, next) => {
    if (/(^|\/)\.data(\/|$)/.test(req.path)) { res.sendStatus(404); return; }
    next();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
