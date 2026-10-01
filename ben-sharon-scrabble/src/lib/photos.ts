export interface PhotoStorage { prepare(file: File): Promise<string> }
// Photos are bounded, embedded JPEGs locally; replace with Storage uploads later.
export const localPhotoStorage: PhotoStorage = {
  async prepare(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Please choose a JPEG, PNG, or WebP photo.');
    if (file.size > 20 * 1024 * 1024) throw new Error('Choose a photo smaller than 20 MB.');
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Your browser could not prepare the photo.');
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.65, 0.45]) { const data = canvas.toDataURL('image/jpeg', quality); if (data.length <= 700_000) return data; }
      throw new Error('This photo is too detailed for local storage. Try a smaller image.');
    } finally { bitmap.close(); }
  },
};
