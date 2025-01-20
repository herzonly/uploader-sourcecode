const express = require("express");
const multer = require("multer");
const { Octokit } = require("@octokit/rest");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const os = require('os');
const { fromBuffer } = require('file-type');
const app = express();
const PORT = 3000;

const octokit = new Octokit({ auth: "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" });
const owner = "Yunheel";
const repo = "database";
const branch = "main";

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

function generateFileName(buffer, ext = '') {
  const hash = crypto.createHash('sha256')
    .update(buffer)
    .update(Date.now().toString())
    .digest('hex')
    .slice(0, 10);
  return `${hash}${ext}`;
}

function getClientIP(req) {
  return req.headers['x-forwarded-for'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         req.connection.socket?.remoteAddress;
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "index.html"));
});

app.get("/files/count", async (req, res) => {
  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path: "files",
      ref: branch
    });
    const fileCount = Array.isArray(response.data) ? response.data.length : 0;
    res.json({ count: fileCount });
  } catch (error) {
    res.status(500).json({ error: "Gagal mendapatkan jumlah file" });
  }
});

const startTime = Date.now();

app.get("/stats", (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = uptimeSeconds % 60;
  const uptimeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const totalMemory = Math.round(os.totalmem() / (1024 * 1024 * 1024));
  const freeMemory = Math.round(os.freemem() / (1024 * 1024 * 1024));
  const usedMemory = totalMemory - freeMemory;

  res.json({
    uptime: uptimeString,
    memoryUsed: usedMemory,
    memoryTotal: totalMemory
  });
});

app.post("/upload", upload.single("file"), async (req, res) => {
  const clientIP = getClientIP(req);
  console.log(`IP [${clientIP}] want to upload a file`);

  try {
    let fileBuffer;
    let originalExt = '';

    if (req.file) {
      fileBuffer = req.file.buffer;
      originalExt = path.extname(req.file.originalname || '');
    } else if (req.body.buffer) {
      fileBuffer = Buffer.from(req.body.buffer);
      const fileType = await fromBuffer(fileBuffer);
      originalExt = '.' + fileType.ext;
    } else {
      return res.status(400).json({
        success: false,
        error: "Tidak ada file yang diunggah"
      });
    }

    const fileName = generateFileName(fileBuffer, originalExt);

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: `files/${fileName}`,
      message: `Upload file: ${fileName}`,
      content: fileBuffer.toString("base64"),
      branch,
    });

    const baseUrl = "https://cdn.notmebot.us.kg";
    const fileUrl = `${baseUrl}/file/${fileName}`;

    res.json({
      success: true,
      url: fileUrl
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Terjadi kesalahan saat mengunggah file.:\n\n" + error
    });
  }
});

app.get("/file/:filename", async (req, res) => {
  try {
    const { filename } = req.params;
    const files = await octokit.repos.getContent({
      owner,
      repo,
      path: "files",
      ref: branch,
    });

    const file = files.data.find(f => f.name === filename);
    if (!file) return res.status(404).send("File tidak ditemukan.");

    const fileData = await octokit.repos.getContent({
      owner,
      repo,
      path: file.path,
      ref: branch,
    });

    const content = Buffer.from(fileData.data.content, "base64");
    res.setHeader("Content-Disposition", `attachment; filename="${file.name}"`);
    res.send(content);
  } catch (error) {
    res.status(500).send("Terjadi kesalahan saat mengakses file.");
  }
});

app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));