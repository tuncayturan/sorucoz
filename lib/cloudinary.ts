import { v2 as cloudinary } from "cloudinary";

// Cloudinary yapılandırması
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "",
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || "",
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

    fetch(
      `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
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
  } catch (error) {
    console.error("Error deleting image from Cloudinary:", error);
  }
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

