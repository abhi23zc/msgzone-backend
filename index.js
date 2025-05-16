import express from "express";
import authRouter from "./routes/auth.route.js";
import whatsappRouter from "./routes/whatsapp.route.js";
import dashboardRouter from "./routes/dashboard.route.js";
import connectDB from "./config/database.js";
import cors from "cors";
const PORT = process.env.PORT || 8080;
const app = express();

// app.use(cors({ origin: 'http://localhost:3000' }))
app.use(cors({ origin: "https://msgzone.vercel.app" }));

connectDB();
app.use(express.json());
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/wp", whatsappRouter);
app.use("/api/v1/wp", dashboardRouter);
app.get("/health", (req, res) => {
  return res.json({ msg: "System up and running" });
});


import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from "./controller/_whatsapp.controller.js";


const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // ✅ Auto-load existing sessions on startup
  const sessionsRoot = path.join(__dirname, "sessions");
  if (fs.existsSync(sessionsRoot)) {
    const clientFolders = fs.readdirSync(sessionsRoot);
    clientFolders.forEach(async (clientId) => {
      const sessionPath = path.join(sessionsRoot, clientId);
      const credFile = path.join(sessionPath, "creds.json");
      if (fs.existsSync(credFile)) {
        console.log(`[${clientId}] Loading existing session...`);
        await createClient(clientId);
      }
    });
  }
});
