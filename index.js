require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const sharp = require('sharp');
const archiver = require("archiver");
const ExcelJS = require("exceljs");
const { Dropbox } = require("dropbox");
const fetch = require('node-fetch');

async function refreshAccessToken() {
  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: process.env.DROPBOX_REFRESH_TOKEN,
      grant_type: 'refresh_token',
      client_id: process.env.DROPBOX_CLIENT_ID,
      client_secret: process.env.DROPBOX_CLIENT_SECRET
    })
  });

  if (!response.ok) {
    console.error('[ERREUR] Impossible de rafraîchir le token');
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();
  console.log('[INFO] Nouveau token Dropbox obtenu');
  process.env.DROPBOX_ACCESS_TOKEN = data.access_token; // mise à jour en mémoire
}

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
const uploadsDir = path.join(__dirname, "uploads");
const croppedDir = path.join(__dirname, "cropped");
const archivePath = path.join(__dirname, "archive.zip");
const UPLOAD_FOLDER = path.join(__dirname, 'uploads');
const CROPPED_FOLDER = path.join(__dirname, 'cropped');

// Assure-toi que les dossiers existent
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(croppedDir)) fs.mkdirSync(croppedDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

app.use(express.static('public'));
app.use('/cropped', express.static(croppedDir));
app.use('/uploads', express.static(uploadsDir)); // pour servir les images uploadées

// Page d'accueil
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Upload des images
app.post('/upload', upload.array('images'), (req, res) => {
  const files = req.files.map(f => `/uploads/${encodeURIComponent(f.originalname)}`);
  res.json({ files });
});

// Rognage et copie vers 'cropped'
app.post('/crop', async (req, res) => {
  const { x, y, width, height, filename } = req.body;

  if ([x, y, width, height].some(v => typeof v !== 'number' || v < 0)) {
    return res.status(400).json({ error: 'Coordonnées invalides' });
  }

  try {
    if (filename) {
      // Crop d'une seule image
      const inputPath = path.join(UPLOAD_FOLDER, filename);
      const outputPath = path.join(croppedDir, filename);
      await sharp(inputPath)
        .extract({ left: Math.round(x), top: Math.round(y), width: Math.round(width), height: Math.round(height) })
        .toFile(outputPath);
    } else {
      // Crop global
      const files = fs.readdirSync(UPLOAD_FOLDER).filter(f =>
        /\.(png|jpe?g)$/i.test(f)
      );

      for (const file of files) {
        const inputPath = path.join(UPLOAD_FOLDER, file);
        const outputPath = path.join(croppedDir, file);
        await sharp(inputPath)
          .extract({ left: Math.round(x), top: Math.round(y), width: Math.round(width), height: Math.round(height) })
          .toFile(outputPath);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur lors du rognage' });
  }
});

app.get('/cropped-images', (req, res) => {
  try {
    if (!fs.existsSync(croppedDir)) {
      return res.json({ files: [] });
    }

    const files = fs.readdirSync(croppedDir).filter(f =>
      /\.(png|jpe?g)$/i.test(f)
    );

    // Retourne la liste des URLs accessibles via /cropped/
    const urls = files.map(f => `/cropped/${encodeURIComponent(f)}`);

    res.json({ files: urls });
  } catch (err) {
    console.error('Erreur /cropped-images:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la lecture des images cropées' });
  }
});

app.post('/reset-crop', async (req, res) => {
  try {
    const files = await fsp.readdir(CROPPED_FOLDER);
    for (const file of files) {
      await fsp.unlink(path.join(CROPPED_FOLDER, file));
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[ERREUR] Réinitialisation crop:', err);
    res.status(500).json({ success: false, error: 'Erreur lors de la suppression des fichiers cropped' });
  }
});

async function safeDropboxCall(fn) {
  let dbx = new Dropbox({ accessToken: process.env.DROPBOX_ACCESS_TOKEN, fetch });
  try {
    return await fn(dbx);
  } catch (err) {
    if (err.status === 401) {
      console.warn('[WARNING] Token expiré, tentative de rafraîchissement...');
      await refreshAccessToken();
      dbx = new Dropbox({ accessToken: process.env.DROPBOX_ACCESS_TOKEN, fetch });
      return await fn(dbx);
    } else {
      throw err;
    }
  }
}
app.get('/list-images', (req, res) => {
  const getFilesWithUrls = (dir, urlPath) =>
    fs.readdirSync(dir).map(filename => ({
      filename,
      url: `${urlPath}/${filename}`
    }));

  const uploads = getFilesWithUrls(uploadsDir, '/uploads');
  const cropped = getFilesWithUrls(croppedDir, '/cropped');

  // Fusionne, sans doublons (cropped en priorité)
  const merged = [...cropped, ...uploads.filter(u => !cropped.some(c => c.filename === u.filename))];

  res.json(merged);
});

// Génération des liens Dropbox + ZIP
app.post("/generate-links", async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Liens");

    // Chercher dans cropped d'abord
    let files = [];
    let sourceDir = croppedDir;

    console.log("[INFO] Lecture des fichiers dans 'cropped/'...");
    if (fs.existsSync(croppedDir)) {
      files = fs.readdirSync(croppedDir).filter(f => /\.(png|jpe?g)$/i.test(f));
    }

    if (files.length === 0) {
      console.warn("[WARN] Aucun fichier dans 'cropped/', on regarde dans 'uploads/'");
      sourceDir = uploadsDir;
      if (fs.existsSync(uploadsDir)) {
        files = fs.readdirSync(uploadsDir).filter(f => /\.(png|jpe?g)$/i.test(f));
      }
      if (files.length === 0) {
        return res.status(400).send("Aucune image trouvée à traiter dans cropped ou uploads.");
      }
    }

    console.log(`[INFO] ${files.length} fichier(s) à traiter depuis '${path.basename(sourceDir)}/'`);

    for (const file of files) {
      const localPath = path.join(sourceDir, file);
      const dropboxPath = `/images/${file}`;

      console.log(`[UPLOAD] Upload de ${file} vers Dropbox...`);
      const content = fs.readFileSync(localPath);
      await safeDropboxCall(dbx => dbx.filesUpload({ path: dropboxPath, contents: content, mode: 'overwrite' }));

      let linkRes = await safeDropboxCall(dbx => dbx.sharingListSharedLinks({ path: dropboxPath }));
      let url;

      if (linkRes.result.links.length > 0) {
        url = linkRes.result.links[0].url;
        console.log(`[INFO] Lien existant trouvé pour ${file}`);
      } else {
        const newLink = await safeDropboxCall(dbx => dbx.sharingCreateSharedLinkWithSettings({ path: dropboxPath }));
        url = newLink.result.url;
        console.log(`[INFO] Nouveau lien créé pour ${file}`);
      }

      const lienDirect = url
        .replace("www.dropbox.com", "www.dl.dropboxusercontent.com")
        .replace(/[\?&]dl=0/, "");

      const nomSansExtension = path.parse(file).name;
      sheet.addRow([nomSansExtension, lienDirect]);
    }

    const excelPath = path.join(__dirname, "liens.xlsx");
    console.log("[INFO] Écriture du fichier Excel...");
    await workbook.xlsx.writeFile(excelPath);

    console.log("[INFO] Création de l'archive ZIP...");
    const output = fs.createWriteStream(archivePath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log("[INFO] Archive ZIP terminée. Envoi au client...");
      res.download(archivePath, "archive.zip", () => {
        console.log("[INFO] Suppression du ZIP et du Excel après téléchargement...");
        fs.unlinkSync(archivePath);
        fs.unlinkSync(excelPath);

        // Supprimer images cropées si cropées utilisées
        if (sourceDir === croppedDir) {
          fs.readdirSync(croppedDir).forEach(file => fs.unlinkSync(path.join(croppedDir, file)));
        }

        // Supprimer images uploads toujours
        if (fs.existsSync(uploadsDir)) {
          const uploadedFiles = fs.readdirSync(uploadsDir);
          for (const f of uploadedFiles) {
            fs.unlinkSync(path.join(uploadsDir, f));
          }
        }
        console.log("[INFO] Suppression terminée.");
      });
    });

    archive.on("error", err => {
      console.error("[ZIP ERROR]", err);
      res.status(500).send("Erreur lors de la création du ZIP.");
    });

    archive.pipe(output);

    console.log("[INFO] Ajout des images à l'archive...");
    for (const file of files) {
      const filePath = path.join(sourceDir, file);
      console.log(`  - Ajout de: ${filePath}`);
      archive.file(filePath, { name: `images/${file}` });
    }

    console.log("[INFO] Ajout de liens.xlsx à l'archive...");
    archive.file(excelPath, { name: "liens.xlsx" });

    archive.finalize();
  } catch (err) {
    console.error("[ERREUR] /generate-links:", err);
    res.status(500).send("Erreur lors de la génération des liens et de l'archive.");
  }
});

app.post("/delete-image", (req, res) => {
  try {
    const { filename } = req.body;

    if (!filename || typeof filename !== "string") {
      return res.status(400).json({ error: "Nom de fichier invalide." });
    }

    // Sécurité : interdire chemins relatifs etc.
    if (filename.includes("..") || filename.includes("/")) {
      return res.status(400).json({ error: "Nom de fichier non autorisé." });
    }

    const croppedPath = path.join(croppedDir, filename);
    const uploadsPath = path.join(uploadsDir, filename);

    let deleted = false;

    // Supprime dans cropped s’il existe
    if (fs.existsSync(croppedPath)) {
      fs.unlinkSync(croppedPath);
      deleted = true;
      console.log(`[DELETE] ${croppedPath} supprimé`);
    }

    // Supprime dans uploads s’il existe
    if (fs.existsSync(uploadsPath)) {
      fs.unlinkSync(uploadsPath);
      deleted = true;
      console.log(`[DELETE] ${uploadsPath} supprimé`);
    }

    if (!deleted) {
      return res.status(404).json({ error: "Fichier non trouvé dans cropped ou uploads." });
    }

    res.json({ message: "Image supprimée avec succès." });

  } catch (err) {
    console.error("[ERREUR] /delete-image:", err);
    res.status(500).json({ error: "Erreur serveur lors de la suppression." });
  }
});


app.listen(port, () => {
  console.log(`Serveur démarré sur http://localhost:${port}`);
});
