import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { MessageLog } from "../models/message.log.schema";

const sessions = {};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createClient(clientId) {
  try {
    const sessionFolder = path.join(__dirname, "..", "sessions", clientId);
    console.log("✅ Session creating for:", clientId);
    try {
      if (!fs.existsSync(sessionFolder)) {
        fs.mkdirSync(sessionFolder, { recursive: true });
      }
    } catch (err) {
      console.error(`Failed to create session folder: ${err.message}`);
      throw new Error("Session folder creation failed");
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      generateHighQualityLinkPreview: true,
      getMessage: async () => ({}),
    });

    sessions[clientId] = {
      sock,
      qr: null,
      qrGeneratedAt: null,
      user: null,
    };

    sock.ev.on(
      "connection.update",
      async ({ connection, qr, lastDisconnect }) => {
        try {
          if (qr && connection!="open") {
            try {
              const qrImage = await qrcode.toDataURL(qr);
              sessions[clientId].qr = qrImage;
              sessions[clientId].qrGeneratedAt = Date.now();
              console.log(`[${clientId}] QR generated`);
            } catch (err) {
              console.error(`QR generation failed: ${err.message}`);
            }
          }

          if (connection === "open") {
            sessions[clientId].user = sock.user;
            sessions[clientId].qr = null;
            sessions[clientId].qrGeneratedAt = null;
            console.log(`[${clientId}] Logged in as ${sock.user.id}`);
          }

          if (connection === "close") {
            const shouldReconnect =
              lastDisconnect?.error?.output?.statusCode !==
              DisconnectReason.loggedOut;
            console.log(
              `[${clientId}] Connection closed. Reconnect: ${shouldReconnect}`
            );
            delete sessions[clientId];
            if (shouldReconnect) {
              try {
                
                const credFile = path.join(sessionFolder, "creds.json");
                if (fs.existsSync(credFile)) {
                  console.log(`[${clientId}] Loading existing session...`);
                  await createClient(clientId);
                }
              } catch (err) {
                console.error(`Reconnection failed: ${err.message}`);
              }
            } else {
              setTimeout(() => {
                fs.rm(
                  sessionFolder,
                  { recursive: true, force: true },
                  (err) => {
                    if (err) {
                      console.error(
                        "Failed to remove session folder:",
                        err.message
                      );
                    } else {
                      console.log("Session folder removed:", sessionFolder);
                    }
                  }
                );
              }, 1000);
            }
          }
        } catch (err) {
          console.error(`Connection update error: ${err.message}`);
        }
      }
    );

    sock.ev.on("creds.update", async () => {
      try {
        if (!fs.existsSync(sessionFolder)) {
          fs.mkdirSync(sessionFolder, { recursive: true });
        }
        await saveCreds();
      } catch (err) {
        console.error(`Failed to save credentials: ${err.message}`);
      }
    });
  } catch (err) {
    console.error(`Client creation failed: ${err.message}`);
    throw err;
  }
}

// ✅ Start session
export const start = async (req, res) => {
  try {
    const { clientId } = req.body;
    if (!clientId) {
      return res
        .status(400)
        .json({ status: false, data: null, message: "Client ID is required" });
    }

    await createClient(clientId);
    res.json({ status: true, message: "Client started" });
  } catch (err) {
    console.error(`Start session failed: ${err.message}`);
    res.status(500).json({
      status: false,
      message: "Failed to start client",
      error: err.message,
    });
  }
};

// ✅ Get QR (with auto-refresh if expired)
export const connect = async (req, res) => {
  try {
    const { clientId } = req.body;
    if (!clientId) {
      return res.status(400).json({
        status: false,
        message: "Client ID is required",
      });
    }

    const session = sessions[clientId];
    if (!session) {
      return res.status(404).json({
        status: false,
        message: "Client not found",
      });
    }

    const qrAge = Date.now() - (session.qrGeneratedAt || 0);
    const QR_TIMEOUT = 15 * 1000;

    if (!session.qr || qrAge > QR_TIMEOUT) {
      console.log(
        `[${clientId}] QR expired or not available, restarting session...`
      );
      await createClient(clientId);
      return res.status(202).json({
        status: true,
        message: "QR expired. Session restarted, please try again shortly.",
      });
    }

    res.send(`<img src="${session.qr}" alt="QR Code"/>`);
  } catch (err) {
    console.error(`Connect failed: ${err.message}`);
    res.status(500).json({
      status: false,
      message: "Connection failed",
      error: err.message,
    });
  }
};

// ✅ Send message
export const sendSingle = async (req, res) => {
  try {
    const { clientId, number, message } = req.body;

    if (!clientId || !number || !message) {
      return res.status(400).json({
        status: false,
        message: "ClientId, number and message are required",
      });
    }

    const session = sessions[clientId];
    if (!session || !session.user) {
      return res.status(400).json({
        status: false,
        message: "Client not logged in",
      });
    }

    const jid = number.includes("@s.whatsapp.net")
      ? number
      : number + "@s.whatsapp.net";

    await session.sock.sendMessage(jid, { text: message });
    res.json({ status: true, message: "Message sent successfully" });
  } catch (err) {
    console.error(`Send message failed: ${err.message}`);
    res.status(500).json({
      status: false,
      message: "Failed to send message",
      error: err.message,
    });
  }
};

// ✅ Logout & delete session
// app.get("/logout/:clientId", async (req, res) => {
export const logout = async (req, res) => {
  const { clientId } = req.body;
  if (sessions[clientId]) {
    try {
      await sessions[clientId].sock.logout();
    } catch (e) {}
    delete sessions[clientId];
    const sessionPath = path.join(__dirname, "sessions", clientId);
    fs.rmSync(sessionPath, { recursive: true, force: true });
  }
  res.json({ message: "Client logged out and session deleted" });
}

// 📜 Get message logs
export const getLogs = async (req, res) => {
    try {
      const logs = await MessageLog.find({ userId: req.user.userId }).sort({
        sentAt: -1,
      });
      if (!logs.length)
        return res.json({ success: false, message: "No logs found" });
      return res.json({ success: true, data: logs });
    } catch (err) {
      console.error("Log error:", err);
      res.status(500).json({ success: false, message: "Failed to fetch logs" });
    }
  };
  
  // 📋 List all active deviceIds for user
  export const listUserSessions = async (req, res) => {
    const sessions = await User.findById(req.user.userId).select("devices");
    if (!sessions)
      return res.json({ success: false, message: "No sessions found" });
    res.json({ success: true, data: sessions, message: "Sessions listed" });
  };
  