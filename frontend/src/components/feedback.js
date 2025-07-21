const express = require("express");
const router = express.Router();
const fs = require("fs");

router.post("/", express.json(), (req, res) => {
  const { text, page } = req.body;
  if (!text) return res.status(400).send("Missing feedback");

  const logLine = `[${new Date().toISOString()}] [${page}] ${text}\n`;
  fs.appendFile("feedback.log", logLine, (err) => {
    if (err) return res.status(500).send("Failed to store feedback");
    res.sendStatus(200);
  });
});

module.exports = router;
