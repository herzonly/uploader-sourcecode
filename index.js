const express = require("express");
const multer = require("multer");
const { Octokit } = require("@octokit/rest");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const os = require('os')

const app = express();
const PORT = 3000;

// Konfigurasi Octokit
const octokit = new Octokit({ auth: "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" });
const owner = "Yunheel";
const repo = "database";
const branch = "main"; // Cabang di GitHub

// Folder penyimpanan sementara
const upload = multer({ dest: "uploads/" });

// Endpoint untuk menampilkan halaman utama
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Endpoint untuk mengunggah file
  app.get("/files/count", async (req, res) => {
    try {
      const response = await octokit.repos.getContent({
        owner,
        repo,
        path: "files",
        ref: branch
      });

      const fileCount = Array.isArray(response.data) ? response.data.length : 0;

      res.json({
        count: fileCount
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: "Gagal mendapatkan jumlah file"
      });
    }
  });

  
const startTime = Date.now(); // Server start time

// Modify the stats endpoint to include uptime
app.get("/stats", (req, res) => {
  // Calculate uptime
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = uptimeSeconds % 60;
  const uptimeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Calculate memory
  const totalMemory = Math.round(os.totalmem() / (1024 * 1024 * 1024)); // Convert to GB
  const freeMemory = Math.round(os.freemem() / (1024 * 1024 * 1024));
  const usedMemory = totalMemory - freeMemory;

  res.json({
    uptime: uptimeString,
    memoryUsed: usedMemory,
    memoryTotal: totalMemory
  });
});

  
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const ext = path.extname(file.originalname);
    const hash = crypto.createHash("md5").update(file.originalname + Date.now()).digest("hex").slice(0, 5);
    const fileName = `${hash}${ext}`;
    const fileContent = fs.readFileSync(file.path);

    // Mengunggah file ke GitHub
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: `files/${fileName}`,
      message: `Upload file: ${fileName}`,
      content: Buffer.from(fileContent).toString("base64"),
      branch,
    });

    // Hapus file dari penyimpanan sementara
    fs.unlinkSync(file.path);

    const baseUrl = "https://uploadfile.notmebot.us.kg";
    const fileUrl = `${baseUrl}/file/${fileName}`;

    // Kirim response dengan URL file
    res.json({
      success: true,
      url: fileUrl
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Terjadi kesalahan saat mengunggah file."
    })
  }
});

// Endpoint untuk mengakses file berdasarkan hash dan ekstensi
app.get("/file/:filename", async (req, res) => {
  try {
    const { filename } = req.params;
    const files = await octokit.repos.getContent({
      owner,
      repo,
      path: "files",
      ref: branch,
    });

    const file = files.data.find(f => f.name === filename); // Cocokkan nama file lengkap
    if (!file) return res.status(404).send("File tidak ditemukan.");

    const fileData = await octokit.repos.getContent({
      owner,
      repo,
      path: file.path,
      ref: branch,
    });

    const content = Buffer.from(fileData.data.content, "base64");
    res.setHeader("Content-Disposition", `attachment; filename="${file.name}"`);
    res.send(content); // Kirim konten file
  } catch (error) {
    console.error(error);
    res.status(500).send("Terjadi kesalahan saat mengakses file.");
  }
});

app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));
