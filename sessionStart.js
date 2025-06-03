import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import logger from "./utils/logger.js";
import { createClient } from "./controller/_whatsapp.controller.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Auto-load all existing sessions on server start
export const restoreSessions = async () => {
  try {
    const sessionsRoot = path.join(__dirname, "sessions");

    try {
      if (fs.existsSync(sessionsRoot)) {
        const sessionDirs = fs.readdirSync(sessionsRoot);

        for (const dir of sessionDirs) {
          try {
            const sessionPath = path.join(sessionsRoot, dir);
            const credFile = path.join(sessionPath, "creds.json");

            try {
              // If session directory and creds.json exist, load it
              if (fs.existsSync(credFile)) {
                console.log(`[${dir}] Loading existing session...`);
                const [userId, deviceId] = dir.split("-");
                if (userId && deviceId) {
                  try {
                    const clientId = `${userId}-${deviceId}`
                    await createClient(clientId);
                    // console.log(sessions)
                  } catch (clientError) {
                    logger.error(`Error creating client for ${dir}:`, clientError);
                  }
                } else {
                  logger.error(
                    `[${dir}] Skipped: Invalid folder name (expected userId-deviceId)`
                  );
                }
              }
            } catch (fsError) {
              logger.error(`Error checking credentials file for ${dir}:`, fsError);
            }
          } catch (innerError) {
            logger.error(`Error processing session directory ${dir}:`, innerError);
          }
        }
      }
    } catch (fsError) {
      logger.error("Error reading sessions directory:", fsError);
    }
  } catch (error) {
    logger.error("Error restoring sessions:", error);
    console.log("Error restoring sessions")
  }
};
