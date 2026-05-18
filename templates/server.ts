import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middlewares
  app.use(express.json());

  // API Mock Endpoints (Mirroring Streamlit logic)
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    if ((username === 'admin' && password === 'admin') || (username === 'demo' && password === 'demo')) {
      res.json({
        id: username === 'admin' ? 1 : 2,
        username,
        role: username === 'admin' ? 'admin' : 'viewer',
        token: 'mock-jwt-token'
      });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // Proxy to actual MySQL would go here (using mysql2 package)
  app.post("/api/query", (req, res) => {
    // This is where you would execute the SQL from the dashboard
    // const { dashboardId, params } = req.body;
    res.json({ data: [] });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> TECH_DASH SERVER RUNNING AT http://localhost:${PORT}`);
  });
}

startServer();
