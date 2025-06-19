
# CONFIG.md

# 🚀 Installation & Configuration Complète de l’Application Image Manager

Ce document contient TOUT ce dont vous avez besoin pour installer, configurer, lancer et utiliser l’application de gestion d’images (upload, rognage, suppression, export Dropbox + ZIP).

---

## 📋 Sommaire

- [Prérequis](#-prérequis)  
- [Installation](#-installation)  
- [Création du fichier .env](#-création-du-fichier-env)  
- [Configuration Dropbox](#-configuration-dropbox)  
- [Lancement du serveur](#-lancement-du-serveur)  
- [Tester l’application](#-tester-lapplication)  
- [Réinitialiser les crops](#-réinitialiser-les-crops)  
- [Structure des dossiers](#-structure-des-dossiers)  
- [Dépannage](#-dépannage)  
- [Licence](#-licence)

---

## 🧾 Prérequis

- Node.js v18 ou supérieur : https://nodejs.org/  
- Compte Dropbox Developer : https://www.dropbox.com/developers  
- Terminal (bash, PowerShell, cmd)  
- Git

---

## 📦 Installation

### 1. Cloner le projet

```bash
git clone https://github.com/votre-utilisateur/image-app.git
cd image-app
```

### 2. Installer les dépendances

```bash
npm install
```

---

## 🔐 Création du fichier .env

À la racine du projet, créez un fichier `.env` avec ce contenu :

```env
DROPBOX_ACCESS_TOKEN=Votre_access_token_initial
DROPBOX_REFRESH_TOKEN=Votre_refresh_token
DROPBOX_CLIENT_ID=Votre_client_id
DROPBOX_CLIENT_SECRET=Votre_client_secret
```

Ces valeurs sont fournies par votre application Dropbox (voir ci-dessous).

---

## 🪣 Configuration Dropbox

### Étapes pour créer votre application Dropbox

1. Rendez-vous sur : https://www.dropbox.com/developers/apps
2. Cliquez sur **Create App**
3. Choisissez :  
   - Scoped access  
   - Full Dropbox
4. Donnez un nom unique à votre application.
5. Dans l’onglet **Permissions**, cochez au minimum :  
   - files.content.write  
   - files.content.read  
   - sharing.create_shared_link_with_settings
6. Dans l’onglet **Settings**, ajoutez la Redirect URI suivante (même si non utilisée directement) :  
   http://localhost:3000/oauth/callback

### Obtenir les tokens OAuth 2

Pour récupérer les tokens, utilisez par exemple ce guide officiel ou cet outil :

- Dropbox OAuth 2 Playground

Suivez la procédure d’authentification pour obtenir :

- access_token (jeton d’accès initial)  
- refresh_token (jeton permettant de renouveler l’accès)  
- client_id (identifiant client de votre app)  
- client_secret (secret client)

⚠️ Ne partagez jamais ces informations publiquement !

---

## ▶️ Lancement du serveur

Dans votre terminal, lancez la commande suivante :

```bash
npm run dev
```

Le serveur sera accessible à l’adresse :  
➡️ http://localhost:3000

---

## 🧪 Tester l’application

- Ouvrez http://localhost:3000 dans votre navigateur  
- Upload : glissez-déposez des images ou dossiers dans le formulaire  
- Galerie : visualisez automatiquement toutes les images uploadées  
- Rognage : appliquez un crop global ou individuel avec le modal CropperJS  
- Suppression : supprimez une image avec la corbeille en haut à droite  
- Génération liens Dropbox : cliquez sur “Générer les liens” pour uploader sur Dropbox, obtenir des liens directs, et télécharger un fichier ZIP avec les images + un fichier Excel liens.xlsx  

---

## 🧹 Réinitialiser les crops

Un bouton “Réinitialiser” permet de supprimer tous les crops (dossier /cropped).

Les images originales sont alors de nouveau affichées.

---

## 📁 Structure des dossiers

```bash
/public
  ├── /uploads    # Images uploadées brutes
  └── /cropped    # Images après rognage
```

---

## 🆘 Dépannage

- Vérifiez que le fichier .env est bien configuré  
- Contrôlez les logs serveur pour détecter les erreurs ([ERREUR])  
- Assurez-vous que les tokens Dropbox sont valides et pas expirés  
- Utilisez des console.log côté serveur pour tracer le déroulement si besoin  

---

