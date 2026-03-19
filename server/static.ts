import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // Rota de captura (catch-all) usando RegExp para o Express 5 (SPA)
  // Qualquer rota que não comece com /api e não seja arquivo estático devolve o index.html
  app.get(/^(?!\/api).*/, (req, res) => {
    // Evita loop infinito se tentar carregar algo em /api que não existe
    if (!req.path.startsWith("/api")) {
      res.sendFile(path.resolve(distPath, "index.html"));
    } else {
      res.status(404).json({ message: "Rota da API não encontrada" });
    }
  });
}
