/**
 * İstemci tarafı Cloudinary proxy çağrısı (sunucu SDK içermez).
 * Tam origin kullanır; göreli /api yolu bazı proxy / PWA senaryolarında kırılabiliyor.
 */
export function getCloudinaryUploadApiUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/cloudinary/upload`;
  }
  return "/api/cloudinary/upload";
}

export async function fetchCloudinaryUpload(formData: FormData): Promise<Response> {
  const url = getCloudinaryUploadApiUrl();
  try {
    return await fetch(url, {
      method: "POST",
      body: formData,
      credentials: "same-origin",
    });
  } catch (err) {
    const msg =
      err instanceof TypeError ||
      (err instanceof Error && /Failed to fetch|NetworkError|Load failed/i.test(err.message))
        ? "Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin; reklam engelleyici veya güvenlik eklentisi /api isteklerini kesiyor olabilir."
        : err instanceof Error
          ? err.message
          : "Bağlantı hatası";
    throw new Error(msg);
  }
}
