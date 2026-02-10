import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { google } from "googleapis";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 4000;

function getServiceAccount() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON env var.");
  // Allow either raw JSON or base64 encoded JSON
  try {
    return JSON.parse(raw);
  } catch (e) {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    return JSON.parse(decoded);
  }
}

function makeDriveClient() {
  const sa = getServiceAccount();
  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} env var.`);
  return v;
}

const DRIVE_ROOT_FOLDER_ID = requireEnv("DRIVE_ROOT_FOLDER_ID");
const ADMIN_KEY = requireEnv("ADMIN_KEY");

app.get("/health", (req, res) => res.json({ ok: true }));

/**
 * Lists subject folders under DRIVE_ROOT_FOLDER_ID.
 * A "subject" = Google Drive folder directly inside root.
 */
app.get("/api/subjects", async (req, res) => {
  try {
    const drive = makeDriveClient();
    const r = await drive.files.list({
      q: `'${DRIVE_ROOT_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id,name,createdTime,modifiedTime)",
      orderBy: "name",
      pageSize: 1000,
    });
    res.json({ subjects: r.data.files || [] });
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

/**
 * Lists files inside a subject folder.
 * If you don't have subject folders and instead store files directly in root,
 * pass subjectId = DRIVE_ROOT_FOLDER_ID.
 */
app.get("/api/files", async (req, res) => {
  try {
    const subjectId = req.query.subjectId || DRIVE_ROOT_FOLDER_ID;
    const drive = makeDriveClient();

    const r = await drive.files.list({
      q: `'${subjectId}' in parents and trashed=false`,
      fields: "files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,iconLink)",
      orderBy: "folder,name",
      pageSize: 1000,
    });

    const files = (r.data.files || []).map(f => ({
      ...f,
      isFolder: f.mimeType === "application/vnd.google-apps.folder",
    }));

    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

/**
 * Streams a file download through the backend.
 * Works for PDFs, docs exports, images, etc.
 * For Google Docs/Sheets/Slides we export to PDF by default.
 */
app.get("/api/download/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;
    const drive = makeDriveClient();

    // Get metadata to decide export vs media
    const meta = await drive.files.get({
      fileId,
      fields: "id,name,mimeType",
    });

    const { name, mimeType } = meta.data;

    // Google-native files need export
    const isGoogleNative = mimeType?.startsWith("application/vnd.google-apps.");
    if (isGoogleNative) {
      // Export to PDF (best for students to view/download)
      res.setHeader("Content-Disposition", `attachment; filename="${sanitizeName(name)}.pdf"`);
      const exportRes = await drive.files.export(
        { fileId, mimeType: "application/pdf" },
        { responseType: "stream" }
      );
      exportRes.data.pipe(res);
      return;
    }

    res.setHeader("Content-Disposition", `attachment; filename="${sanitizeName(name)}"`);
    const fileRes = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );
    fileRes.data.pipe(res);
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

function sanitizeName(name = "file") {
  return String(name).replace(/[\/:*?"<>|]+/g, "_");
}

// Admin upload (simple key-based protection)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

app.post("/api/admin/upload", upload.single("file"), async (req, res) => {
  try {
    const key = req.header("x-admin-key") || req.body?.adminKey;
    if (!key || key !== ADMIN_KEY) return res.status(401).json({ error: "Unauthorized" });

    const subjectId = req.body?.subjectId || DRIVE_ROOT_FOLDER_ID;
    if (!req.file) return res.status(400).json({ error: "Missing file" });

    const drive = makeDriveClient();

    const created = await drive.files.create({
      requestBody: {
        name: req.file.originalname,
        parents: [subjectId],
      },
      media: {
        mimeType: req.file.mimetype,
        body: bufferToStream(req.file.buffer),
      },
      fields: "id,name,webViewLink",
    });

    res.json({ uploaded: created.data });
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

import { Readable } from "stream";
function bufferToStream(buffer) {
  return Readable.from(buffer);
}

app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});
