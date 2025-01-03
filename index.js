const express = require("express");
const multer = require("multer");
const { Octokit } = require("@octokit/rest");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

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
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const hash = crypto.createHash("md5").update(file.originalname + Date.now()).digest("hex").slice(0, 5);
    const fileName = `${hash}-${file.originalname}`;
    const fileContent = fs.readFileSync(file.path, "utf8");

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

    const baseUrl = "example.com"; // Ganti dengan domain Anda
    res.send({ url: `https://${baseUrl}/file/${hash}` });
  } catch (error) {
    console.error(error);
    res.status(500).send("Terjadi kesalahan saat mengunggah file.");
  }
});

// Endpoint untuk mengakses file berdasarkan hash
app.get("/file/:filename", async (req, res) => {
  try {
    const { filename } = req.params;
    const files = await octokit.repos.getContent({
      owner,
      repo,
      path: "files",
      ref: branch,
    });

    const file = files.data.find(f => f.name.startsWith(filename));
    if (!file) return res.status(404).send("File tidak ditemukan.");

    const fileData = await octokit.repos.getContent({
      owner,
      repo,
      path: file.path,
      ref: branch,
    });

    const content = Buffer.from(fileData.data.content, "base64").toString("utf8");
    res.setHeader("Content-Disposition", `attachment; filename="${file.name}"`);
    res.send(content);
  } catch (error) {
    console.error(error);
    res.status(500).send("Terjadi kesalahan saat mengakses file.");
  }
});

app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));
