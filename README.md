# 🖼️ Application Web de Gestion d'Images avec Rognage, Dropbox & ZIP

Cette application permet d’uploader, rogner, visualiser, supprimer et exporter des images avec une interface intuitive et responsive. Le tout est entièrement automatisé, jusqu’à la génération d’un lien Dropbox et d’une archive `.zip` contenant vos images et un fichier Excel.

---

## ✨ Fonctionnalités

### 📁 Upload
- Upload **multiple** de fichiers ou **entiers dossiers**
- Galerie d’images affichée automatiquement à l’écran

### ✂️ Rognage (Crop)
- **Rognage global** : appliquer une découpe identique à toutes les images
- **Rognage individuel** : rogner une image spécifique via une **fenêtre modale** (CropperJS)
- Traitement serveur via [Sharp](https://sharp.pixelplumbing.com/)

### 🔁 Réinitialisation
- Réinitialise tous les rognages en supprimant le contenu du dossier `/cropped`

### 🗑️ Suppression
- Chaque image de la galerie affiche une **corbeille** (bouton ×) pour suppression individuelle
- Les images sont supprimées à la fois de `/uploads` et `/cropped` si présentes

### 🔗 Génération de Liens Dropbox + ZIP
- Upload automatique des images vers **Dropbox**
- Conversion des liens partagés en **liens directs**
- Génération d’un fichier `liens.xlsx` listant les noms + URLs
- Création d’une archive `archive.zip` contenant :
  - Les images cropées
  - Le fichier Excel
- Téléchargement automatique de l’archive par l’utilisateur

### 🧼 Interface Utilisateur
- Design épuré, responsive
- **Toasts** élégants pour le feedback utilisateur (succès/erreur)
- **Visualisation grand format** d’une image au clic
- **Thème clair moderne**, fond doux et discret

---

## 🛠️ Stack technique

- **Frontend** : HTML, CSS, Vanilla JS, CropperJS
- **Backend** : Node.js + Express
- **Traitement images** : Sharp
- **Stockage cloud** : Dropbox API (OAuth 2 avec refresh token)
- **Génération Excel** : ExcelJS
- **Archive ZIP** : `archiver` (Node.js)

---

## 🚀 Lancer l'application

### 1. Installer les dépendances

```bash
npm install
