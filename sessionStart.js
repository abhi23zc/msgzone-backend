

// export async function restoreSessions1() {
//   try {
//     console.log("Session Restoring.....")
//     const dirs = await fs.readdir(sessionBasePath);

//     for (const dir of dirs) {
//       if (dir.startsWith('session-')) {
//         // Extract userId and deviceId
//         const parts = dir.replace('session-', '').split('-');
//         if (parts.length < 2) continue;

//         const userId = parts[0];
//         const deviceId = parts.slice(1).join('-'); // In case deviceId has dashes

//         const client = new Client({
//           authStrategy: new LocalAuth({ clientId: `${userId}-${deviceId}` }),
//         });

//         client.on('ready', () => {
//           console.log(`✅ Restored session for user: ${userId}, device: ${deviceId}`);
//         });

//         client.on('auth_failure', (msg) => {
//           console.error(`❌ Auth failure for ${userId}-${deviceId}:`, msg);
//         });

//         client.on('disconnected', (reason) => {
//           console.warn(`⚠️ Disconnected: ${userId}-${deviceId}:`, reason);
//         });

//         client.initialize();
//         addSession(userId, deviceId, client);
//       }
//     }
//   } catch (err) {
//     console.error('❌ Failed to restore sessions:', err);
//   }
// }

import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import pkg from 'whatsapp-web.js';
import { addSession } from './utils/sessions/sessionManager.js';
import { fileURLToPath } from 'url';

const { Client, LocalAuth } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sessionBasePath = path.join(__dirname, '.wwebjs_auth');

async function waitForReadyOrFail(client, timeout = 15000) {
  return new Promise((resolve, reject) => {
    let isReady = false;

    const timer = setTimeout(() => {
      if (!isReady) reject(new Error('Timeout: Client not ready'));
    }, timeout);

    client.on('ready', () => {
      isReady = true;
      clearTimeout(timer);
      resolve(true);
    });

    client.on('auth_failure', (msg) => {
      clearTimeout(timer);
      reject(new Error('Auth failure: ' + msg));
    });

    client.on('disconnected', (reason) => {
      clearTimeout(timer);
      reject(new Error('Disconnected: ' + reason));
    });
  });
}

async function removeSessionDir(sessionKey) {
  const sessionPath = path.join(sessionBasePath, `session-${sessionKey}`);
  try {
    await fs.rm(sessionPath, { recursive: true, force: true });
    console.log(`🧹 Removed session folder: ${sessionPath}`);
  } catch (err) {
    console.warn(`⚠️ Could not remove session folder:`, err);
  }
}

export async function restoreSessions() {
  console.log("🔄 Restoring sessions if they exist...");
  try {
    await fs.mkdir(sessionBasePath, { recursive: true });

    const dirs = await fs.readdir(sessionBasePath);

    for (const dir of dirs) {
      if (dir.startsWith('session-')) {
        const parts = dir.replace('session-', '').split('-');
        if (parts.length < 2) continue;

        const userId = parts[0];
        const deviceId = parts.slice(1).join('-');
        const sessionKey = `${userId}-${deviceId}`;

        const client = new Client({
          authStrategy: new LocalAuth({
            clientId: sessionKey,
            dataPath: sessionBasePath
          }),
          puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          }
        });

        try {
          await client.initialize();
          await waitForReadyOrFail(client, 25000); // Wait up to 10s

          addSession(userId, deviceId, client);
          console.log(`✅ Restored session: ${sessionKey}`);
        } catch (err) {
          console.warn(`❌ Failed to restore ${sessionKey}: ${err.message}`);
          try {
            await client.destroy();
          } catch (e) {
            console.warn(`⚠️ Error destroying client: ${e.message}`);
          }
          await removeSessionDir(sessionKey); // Clean up locked folder
        }
      }
    }
  } catch (err) {
    console.error('❌ Error during session restore:', err);
  }
}
