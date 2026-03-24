import { v2 as cloudinary } from "cloudinary";

/** Railway / panodan yapıştırmada sonda gelen boşluk veya satır sonu imzayı bozabilir. */
export function getCloudinaryCredentials() {
  const t = (v: string | undefined) => (v ?? "").trim();
  return {
    cloud_name:
      t(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) ||
      t(process.env.CLOUDINARY_CLOUD_NAME),
    api_key:
      t(process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY) ||
      t(process.env.CLOUDINARY_API_KEY),
    api_secret: t(process.env.CLOUDINARY_API_SECRET),
  };
}

const _cloudinaryCreds = getCloudinaryCredentials();
cloudinary.config({
  cloud_name: _cloudinaryCreds.cloud_name,
  api_key: _cloudinaryCreds.api_key,
  api_secret: _cloudinaryCreds.api_secret,
});

/**
 * Cloudinary'e resim yükleme (signed upload)
 */
export async function uploadImageToCloudinary(
  file: File,
  folder: string = "sorucoz"
): Promise<string> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "sorucozApp");
    formData.append("folder", folder);

    const cn =
      getCloudinaryCredentials().cloud_name ||
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
      process.env.CLOUDINARY_CLOUD_NAME;
    fetch(
      `https://api.cloudinary.com/v1_1/${cn}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    )
      .then((response) => response.json())
      .then((data) => {
        if (data.secure_url) {
          resolve(data.secure_url);
        } else {
          reject(new Error("Upload failed"));
        }
      })
      .catch((error) => {
        reject(error);
      });
  });
}

/**
 * Cloudinary'den resim silme
 */
export async function deleteImageFromCloudinary(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {  }
}

/**
 * Public ID'yi URL'den çıkar
 */
export function extractPublicIdFromUrl(url: string): string | null {
  try {
    const parts = url.split("/");
    const filename = parts[parts.length - 1];
    const publicId = filename.split(".")[0];
    return `sorucoz/${publicId}`;
  } catch {
    return null;
  }
}

export { cloudinary };

