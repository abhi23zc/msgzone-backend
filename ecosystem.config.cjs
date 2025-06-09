module.exports = {
    apps: [
      {
        name: "msgzone",
        script: "index.js",
      },
      {
        name: "email-worker",
        script: "utils/EmailWorker.js",
      },
    ],
  };
  