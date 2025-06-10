module.exports = {
  apps: [
    {
      name: "msgzone-dev",
      script: "index.js",
    },
    {
      name: "email-dev",
      script: "utils/EmailWorker.js",
    },
  ],
};



