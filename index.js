import express from "express";
import authRouter from "./routes/auth.route.js";
import whatsappRouter from "./routes/whatsapp.route.js";
import whatsappApiRouter from "./routes/whatsapp.api.route.js";
import dashboardRouter from "./routes/dashboard.route.js";
import connectDB from "./config/database.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import { restoreSessions } from "./sessionStart.js";

const PORT = process.env.PORT || 8080;
const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://msgzone.vercel.app",
      "https://whatsapp.webifyit.in",
      "https://whatsapp.web.webifyit.in"
    ],
    credentials: true,
  })
);
// app.use(cors({ origin: "https://msgzone.vercel.app", credentials: true}));
app.use(cookieParser());

connectDB();
app.use(express.json());
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/wp", whatsappRouter);
app.use("/api/v1/wp", dashboardRouter);
app.use("/api/v1/dev", whatsappApiRouter);

// ❌ Old API Version
app.use("/api/v1/create-message", whatsappApiRouter);

app.get("/health", (req, res) => {
  return res.json({ msg: "System up and running" });
});

// ✅ Memory Usage
// setInterval(() => {
//   const mem = process.memoryUsage();
//   console.log(`[WORKER] 🧠 RSS: ${Math.round(mem.rss / 1024 / 1024)} MB`);
// }, 5000);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  restoreSessions();
});
