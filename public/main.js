const form = document.getElementById('uploadForm');
  const fileInput = document.getElementById('fileInput');
  const gallery = document.getElementById('gallery');
  const viewImageModal = document.getElementById('viewImageModal');
  const viewedImage = document.getElementById('viewedImage');
  const cropThisImageBtn = document.getElementById('cropSingleBtn');

  let currentImageSrc = "";
  let currentFilename = "";

  let cropMode = 'global'; // "global" ou "single"
  let cropTargetFilename = ''; // utilisé si cropMode = 'single'

  gallery.addEventListener('click', e => {
    if (e.target.tagName === 'IMG') {
      currentImageSrc = e.target.src;
      viewedImage.src = currentImageSrc;
      viewImageModal.style.display = 'flex';

      try {
        const urlObj = new URL(currentImageSrc);
        currentFilename = decodeURIComponent(urlObj.pathname.split('/').pop());
      } catch {
        currentFilename = "";
      }

      cropThisImageBtn.style.display = 'inline-block';
    }
  });

  viewImageModal.addEventListener('click', (e) => {
    if (e.target === viewImageModal) {
      viewImageModal.style.display = 'none';
      viewedImage.src = '';
      cropThisImageBtn.style.display = 'none';
    }
  });

  cropThisImageBtn.addEventListener('click', () => {
    if (!currentFilename) {
        // alert('Impossible de récupérer le nom du fichier');
        showToast('Impossible de récupérer le nom du fichier', 'error');
      return;
    }
    cropMode = 'single';
    cropTargetFilename = currentFilename;
    openCropperModal(`/uploads/${encodeURIComponent(currentFilename)}`);
    viewImageModal.style.display = 'none';
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!fileInput.files.length) {
        // alert('Sélectionne au moins un fichier');
        showToast('Sélectionne au moins un fichier', 'error');
      return;
    }

    const formData = new FormData();
    for (const file of fileInput.files) {
      formData.append('images', file, file.name);
    }

    const res = await fetch('/upload', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
        // alert('Erreur lors de l\'upload');
        showToast('Erreur lors de l\'upload', 'error');
      return;
    }

    const data = await res.json();
    await loadCroppedImages();
  });

  async function reloadGallery() {
  try {
    const res = await fetch('/list-images');
    if (!res.ok) throw new Error('Erreur réseau');

    const images = await res.json();

    gallery.innerHTML = '';

    images.forEach(({ url, filename }) => {
      const wrapper = document.createElement('div');
      wrapper.classList.add('image-wrapper');

      const img = document.createElement('img');
      img.src = `${url}?_=${Date.now()}`;
      img.alt = filename;

      const btnDelete = document.createElement('button');
      btnDelete.classList.add('delete-btn');
      btnDelete.textContent = '×';
      btnDelete.title = 'Supprimer cette image';

      btnDelete.addEventListener('click', async (e) => {
        e.stopPropagation();
        // if (!confirm(`Voulez-vous vraiment supprimer "${filename}" ?`)) return;

        try {
          const res = await fetch('/delete-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename }),
          });

          if (!res.ok) throw new Error('Erreur lors de la suppression');

          wrapper.remove();
        //   alert('Image supprimée');
          showToast('Image supprimée avec succès', 'success');
        } catch (err) {
        //   alert('Erreur : ' + err.message);
          showToast('Erreur lors de la suppression', 'error');
        }
      });

      wrapper.appendChild(img);
      wrapper.appendChild(btnDelete);
      gallery.appendChild(wrapper);
    });
  } catch (err) {
    alert('Erreur lors du chargement des images : ' + err.message);
  }
}
async function loadCroppedImages() {
  try {
    const res = await fetch('/list-images'); // route qui retourne images cropped + uploads
    if (!res.ok) throw new Error('Erreur chargement des images');

    const data = await res.json();

    gallery.innerHTML = '';

    data.forEach(({ url, filename }) => {
      const wrapper = document.createElement('div');
      wrapper.classList.add('image-wrapper');

      const img = document.createElement('img');
      img.src = `${url}?_=${Date.now()}`;
      img.alt = filename;

      const btnDelete = document.createElement('button');
      btnDelete.classList.add('delete-btn');
      btnDelete.textContent = '×';
      btnDelete.title = 'Supprimer cette image';

      btnDelete.addEventListener('click', async (e) => {
        e.stopPropagation();
        // if (!confirm(`Voulez-vous vraiment supprimer "${filename}" ?`)) return;

        try {
          const res = await fetch('/delete-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename }),
          });

          if (!res.ok) throw new Error('Erreur lors de la suppression');

          wrapper.remove();
        //   alert('Image supprimée');
          showToast('Image supprimée avec succès', 'success');
        } catch (err) {
        //   alert('Erreur : ' + err.message);
            showToast('Erreur lors de la suppression', 'error');
        }
      });

      wrapper.appendChild(img);
      wrapper.appendChild(btnDelete);
      gallery.appendChild(wrapper);
    });
  } catch (err) {
    console.error(err);
    // alert('Erreur lors du chargement des images');
    showToast('Erreur lors du chargement des images', 'error');
  }
}


  window.addEventListener('load', () => {
    loadCroppedImages();
  });

  const cropModal = document.getElementById('cropModal');
  const imageToCrop = document.getElementById('imageToCrop');
  const applyCropBtn = document.getElementById('applyCropBtn');
  const closeCropBtn = document.getElementById('closeCropBtn');
  let cropper = null;

  function openCropperModal(url) {
    imageToCrop.src = url;
    cropModal.style.display = 'flex';

    if (cropper) cropper.destroy();
    cropper = new Cropper(imageToCrop, {
      aspectRatio: NaN,
      viewMode: 1,
      autoCropArea: 0.8,
    });
  }

  applyCropBtn.addEventListener('click', async () => {
    if (!cropper) return;

    const cropData = cropper.getData(true);

    const payload = {
      x: cropData.x,
      y: cropData.y,
      width: cropData.width,
      height: cropData.height
    };

    if (cropMode === 'single') {
      payload.filename = cropTargetFilename;
    }

    try {
      const res = await fetch('/crop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        // alert('✅ Rognage appliqué ' + (cropMode === 'single' ? 'à cette image' : 'à toutes les images') + ' !');
        showToast('Rognage appliqué ' + (cropMode === 'single' ? 'à cette image' : 'à toutes les images') + ' !', 'success');
        cropModal.style.display = 'none';
        cropper.destroy();
        cropper = null;
        cropMode = 'global';
        cropTargetFilename = '';

        await loadCroppedImages();
      } else {
        // alert('❌ Erreur côté serveur : ' + (data.error || 'Erreur inconnue'));
        showToast('Erreur côté serveur : ' + (data.error || 'Erreur inconnue'), 'error');
      }
    } catch (err) {
    //   alert('❌ Erreur réseau : ' + err.message);
      showToast('Erreur réseau : ' + err.message, 'error');
    }
  });

  closeCropBtn.addEventListener('click', () => {
    cropModal.style.display = 'none';
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
  });

  const cropButton = document.createElement('button');
  cropButton.textContent = 'Rogner les images';
  cropButton.style.marginLeft = '10px';
  form.appendChild(cropButton);

  cropButton.addEventListener('click', e => {
    e.preventDefault();
    if (gallery.children.length === 0) {
    //   alert('Upload d\'abord des images !');
      showToast('Upload préalable nécessaire', 'error');
      return;
    }
    const firstImg = gallery.querySelector('img');
    cropMode = 'global';
    cropTargetFilename = '';
    openCropperModal(firstImg.src);
  });



  document.getElementById("generateLinksBtn").addEventListener("click", async () => {
    const btn = document.getElementById("generateLinksBtn");
    btn.disabled = true;
    btn.textContent = "Génération en cours...";

    const res = await fetch("/generate-links", { method: "POST" });
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "archive.zip";
      a.click();
      window.URL.revokeObjectURL(url);
      gallery.innerHTML = '';
    } else {
    //   alert("Erreur lors de la génération.");
      showToast('Erreur lors de la génération.', 'error');
    }

    btn.disabled = false;
    btn.textContent = "Générer les liens";
  });


  document.getElementById("resetCropBtn").addEventListener("click", async () => {
//   if (!confirm("Voulez-vous vraiment réinitialiser tous les crops ?")) return;

  const res = await fetch("/reset-crop", { method: "POST" });
  if (res.ok) {
    // alert("✅ Tous les crops ont été réinitialisés.");
    showToast('Tous les crops ont été réinitialisés.', 'success');
    // Recharger la galerie avec les images originales
    await reloadGallery();
  } else {
    // alert("❌ Erreur lors de la réinitialisation.");
    showToast('Erreur lors de la réinitialisation', 'error');
  }
});



function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = document.createElement('span');
  icon.className = 'icon';
//   icon.textContent = type === 'success' ? '✅' : '❌';

  const text = document.createElement('span');
  text.textContent = message;

  toast.appendChild(icon);
  toast.appendChild(text);
  container.appendChild(toast);

  // Supprime le toast après 4 secondes
  setTimeout(() => {
    toast.remove();
  }, 4000);
}
