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


// Génération des liens Dropbox + ZIP
app.post("/generate-links", async (req, res) => {
  try {
    const dbx = new Dropbox({ accessToken: process.env.DROPBOX_ACCESS_TOKEN });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Liens");

    console.log("[INFO] Lecture des fichiers dans 'cropped/'...");
    const files = fs.readdirSync(croppedDir).filter(f =>
      /\.(png|jpe?g)$/i.test(f)
    );
    console.log(`[INFO] ${files.length} fichier(s) trouvé(s) dans 'cropped/'`);

    if (files.length === 0) {
      console.warn("[WARN] Aucun fichier image trouvé dans 'cropped/'");
      return res.status(400).send("Aucune image rognée à traiter.");
    }

    for (const file of files) {
      const localPath = path.join(croppedDir, file);
      const dropboxPath = `/images/${file}`;
      console.log(`[UPLOAD] Upload de ${file} vers Dropbox...`);

      const content = fs.readFileSync(localPath);
      await dbx.filesUpload({ path: dropboxPath, contents: content, mode: 'overwrite' });

      let linkRes = await dbx.sharingListSharedLinks({ path: dropboxPath });
      let url;

      if (linkRes.result.links.length > 0) {
        url = linkRes.result.links[0].url;
        console.log(`[INFO] Lien existant trouvé pour ${file}`);
      } else {
        const newLink = await dbx.sharingCreateSharedLinkWithSettings({ path: dropboxPath });
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
        fs.readdirSync(croppedDir).forEach(file => fs.unlinkSync(path.join(croppedDir, file)));
        console.log("[INFO] Suppression des images dans 'uploads/'...");
        const uploadedFiles = fs.readdirSync(uploadsDir);
        for (const f of uploadedFiles) {
          const filePath = path.join(uploadsDir, f);
          fs.unlinkSync(filePath);
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
      const filePath = path.join(croppedDir, file);
      console.log(`  - Ajout de: ${filePath}`);
      archive.file(filePath, { name: `images/${file}` });
    }

    console.log("[INFO] Ajout de liens.xlsx à l'archive...");
    archive.file(excelPath, { name: "liens.xlsx" });

    await archive.finalize();
    console.log("[INFO] archive.finalize() lancé");

  } catch (err) {
    console.error("Erreur lors de la génération :", err);
    res.status(500).send("Erreur lors de la génération des liens.");
  }
});

app.get('/list-images', (req, res) => {
  try {
    const files = fs.readdirSync(uploadsDir).filter(f =>
      /\.(png|jpe?g)$/i.test(f)
    );

    const customDir = path.join(croppedDir, 'custom');

    const list = files.map(file => {
      const customPath = path.join(customDir, file);
      const croppedPath = path.join(croppedDir, file);

      let url;
      if (fs.existsSync(customPath)) {
        url = `/cropped/custom/${encodeURIComponent(file)}`;
      } else if (fs.existsSync(croppedPath)) {
        url = `/cropped/${encodeURIComponent(file)}`;
      } else {
        url = `/uploads/${encodeURIComponent(file)}`;
      }

      return { filename: file, url };
    });

    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la liste des images' });
  }
});


app.listen(3000, () => console.log('Server running on http://localhost:3000'));
