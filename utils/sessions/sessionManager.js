const sessions = {};

function addSession(userId, client) {
  sessions[userId] = client;
}

function getSession(userId) {
  return sessions[userId];
}

function removeSession(userId) {
  delete sessions[userId];
}

export { addSession, getSession, removeSession };