// Handle Photo Selection
document.addEventListener('DOMContentLoaded', () => {
    // We already have 'addPhotoBtn' and 'fileInput' defined in script.js top-level,
    // so we can access them here directly. 

    addPhotoBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;

            const base64Data = await fileToBase64(file);
            const imageData = {
                mimeType: 'image/webp', // We always convert to WebP in fileToBase64
                data: base64Data.split(',')[1] // clean base64 data only
            };
            uploadedImages.push(imageData);

            // Add to UI Gallery
            const galleryItem = document.createElement('div');
            galleryItem.className = 'gallery-item';
            galleryItem.innerHTML = `
                <img src="${base64Data}" alt="Food Preview">
                <button class="photo-delete-btn" title="${i18n[currentLang].deletePhoto}">✕</button>
            `;
            imageGallery.insertBefore(galleryItem, addPhotoBtn);

            // Photo Delete Logic
            const deleteBtn = galleryItem.querySelector('.photo-delete-btn');
            deleteBtn.addEventListener('click', () => {
                const index = uploadedImages.indexOf(imageData);
                if (index > -1) {
                    uploadedImages.splice(index, 1);
                }
                galleryItem.remove();
                if (uploadedImages.length === 0) {
                    analyzeBtn.disabled = true;
                }
            });
        }

        if (uploadedImages.length > 0) {
            analyzeBtn.disabled = false;
        }
        fileInput.value = '';
    });
});

// Utility: File to Base64 (with Resize & WebP Compression)
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxDim = 1920; // Increased for better accuracy

                if (width > height) {
                    if (width > maxDim) {
                        height = Math.round(height * maxDim / width);
                        width = maxDim;
                    }
                } else {
                    if (height > maxDim) {
                        width = Math.round(width * maxDim / height);
                        height = maxDim;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to WebP with 80% quality
                const dataUrl = canvas.toDataURL('image/webp', 0.8);
                resolve(dataUrl);
            };
            img.onerror = error => reject(error);
            img.src = event.target.result;
        };
        reader.onerror = error => reject(error);
    });
}
