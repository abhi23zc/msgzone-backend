import express from "express";
import authRouter from "./routes/auth.route.js";
import whatsappRouter from "./routes/whatsapp.route.js";
import whatsappApiRouter from "./routes/whatsapp.api.route.js";
import dashboardRouter from "./routes/dashboard.route.js";
import paymentRouter from "./routes/payment.route.js";
import adminRouter from './routes/admin.route.js';
import connectDB from "./config/database.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import 'dotenv/config';
import { restoreSessions } from "./sessionStart.js";
import cron from "node-cron"; 
import planRouter from './routes/plan.route.js'
import paymentSettingsRouter from './routes/paymentSettings.route.js'
import generalSettingsRouter from './routes/generalSettings.route.js'
import messageTemplatesRouter from './routes/messageTemplates.route.js'
import morgan from 'morgan'
// Import email worker to start it automatically
import './utils/EmailWorker.js';

const PORT = process.env.PORT || 8081;
const app = express();

app.use(
  cors({
    origin: [
      "http://192.168.1.8:3000",
      "http://192.168.1.8:3001",
      "http://localhost:3000",
      "https://msgzone.vercel.app",
      "https://whatsapp.webifyit.in",
      "https://whatsapp.web.webifyit.in",
      "https://dev.whatsapp.web.webifyit.in",
      "https://msgzone.live",
      "https://m.msgzone.live",
      "https://wp.webifyit.in",
      "https://wp.goyalpay.in"

    ],
    credentials: true,
  })
);

app.use(cookieParser());
app.use(morgan('dev'));
// Make uploads folder public
app.use('/uploads', express.static('uploads'));

connectDB();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/wp", whatsappRouter);
app.use("/api/v1/wp", dashboardRouter);
app.use("/api/v1/dev", whatsappApiRouter);
app.use("/api/v1/plan", planRouter)


// 👩🏻‍💻Admin Routes
app.use("/api/v1/admin", adminRouter)

// 💰Payment Routes
app.use('/api/v1/payment', paymentRouter);

// ⚙️Payment Settings Routes
app.use('/api/v1', paymentSettingsRouter);

// ⚙️General Settings Routes
app.use('/api/v1', generalSettingsRouter);

// 📝Message Templates Routes
app.use('/api/v1/admin', messageTemplatesRouter);

// ❌ Old API Version
app.use("/api/v1/create-message", whatsappApiRouter);

app.get("/health", (req, res) => {
  return res.json({ msg: "System up and running" });
});


// Cron job to restore sessions every 5 hours
cron.schedule("0 */5 * * *", async () => {
  console.log("Running restoreSessions every 5 hours");
  try {
    await restoreSessions(); 
    console.log("Sessions restored successfully");
  } catch (err) {
    console.error("Error restoring sessions:", err);
  }
});

// cron.schedule("* * * * *", async () => {
//   console.log("Running restoreSessions every 1 minute");
//   try {
//     await restoreSessions(); 
//     console.log("Sessions restored successfully");
//   } catch (err) {
//     console.error("Error restoring sessions:", err);
//   }
// });


app.listen(PORT, () => {
  console.log(`🟢 ${process.env.NODE_ENV.toUpperCase()} server running on port ${PORT}`);
  restoreSessions()
});
