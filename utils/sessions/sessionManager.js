const sessions = {};

function addSession(userId, deviceId, client) {
  if (!sessions[userId]) sessions[userId] = {};
  sessions[userId][deviceId] = client;
}

function getSession(userId, deviceId) {
  return sessions[userId]?.[deviceId] || null;
}

function removeSession(userId, deviceId) {
  if (sessions[userId]) {
    delete sessions[userId][deviceId];
    if (Object.keys(sessions[userId]).length === 0) {
      delete sessions[userId];
    }
  }
}

function listSessions(userId) {
  return sessions[userId] ? Object.keys(sessions[userId]) : [];
}

export { addSession, getSession, removeSession, listSessions };
