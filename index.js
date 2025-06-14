import express from "express";
import authRouter from "./routes/auth.route.js";
import whatsappRouter from "./routes/whatsapp.route.js";
import whatsappApiRouter from "./routes/whatsapp.api.route.js";
import dashboardRouter from "./routes/dashboard.route.js";
import adminRouter from './routes/admin.route.js';
import connectDB from "./config/database.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import 'dotenv/config';
import { restoreSessions } from "./sessionStart.js";
import cron from "node-cron"; 

const PORT = process.env.PORT || 8080;
const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://msgzone.vercel.app",
      "https://whatsapp.webifyit.in",
      "https://whatsapp.web.webifyit.in",
      "https://dev.whatsapp.web.webifyit.in",

    ],
    credentials: true,
  })
);

app.use(cookieParser());

connectDB();
app.use(express.json());
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/wp", whatsappRouter);
app.use("/api/v1/wp", dashboardRouter);
app.use("/api/v1/dev", whatsappApiRouter);

// 👩🏻‍💻Admin Routes
app.use("/api/v1/admin", adminRouter)

// ❌ Old API Version
app.use("/api/v1/create-message", whatsappApiRouter);

app.get("/health", (req, res) => {
  return res.json({ msg: "System up and running" });
});

// Cron job to restore sessions every 5 hours
// cron.schedule("0 */5 * * *", async () => {
//   console.log("Running restoreSessions every 5 hours");
//   try {
//     await restoreSessions(); 
//     console.log("Sessions restored successfully");
//   } catch (err) {
//     console.error("Error restoring sessions:", err);
//   }
// });

cron.schedule("* * * * *", async () => {
  console.log("Running restoreSessions every 1 minute");
  try {
    await restoreSessions(); 
    console.log("Sessions restored successfully");
  } catch (err) {
    console.error("Error restoring sessions:", err);
  }
});


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  restoreSessions()
});
