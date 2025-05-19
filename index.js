import express from "express";
import authRouter from "./routes/auth.route.js";
import whatsappRouter from "./routes/whatsapp.route.js";
import dashboardRouter from "./routes/dashboard.route.js";
import connectDB from "./config/database.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import { restoreSessions } from "./sessionStart.js";



const PORT = process.env.PORT || 8080;
const app = express();

// app.use(cors({
//   origin: 'https://msgzone.vercel.app',  // Remove trailing slash to match exact origin
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Explicitly allow methods
//   allowedHeaders: ['Content-Type', 'Authorization'], // Specify allowed headers
//   exposedHeaders: ['set-cookie'], // Expose set-cookie header for credentials
// }));
app.use(cors({ origin: "http://localhost:3000", credentials: true}));
// app.use(cors({ origin: "https://msgzone.vercel.app"}));
app.use(cookieParser())

connectDB();
app.use(express.json());
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/wp", whatsappRouter);
app.use("/api/v1/wp", dashboardRouter);
app.get("/health", (req, res) => {
  return res.json({ msg: "System up and running" });
});


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  restoreSessions()
});
