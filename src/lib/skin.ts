"use client";

/**
 * Valid skin variants supported by MineSkin and SkinsRestorer.
 */
export type SkinVariant = "classic" | "slim";

/**
 * Attempts to detect whether a skin texture is the slim (Alex) or classic (Steve) model.
 * The check relies on the transparency of specific pixel columns in the skin file.
 *
 * @throws When the image fails to load or the canvas context is unavailable.
 */
export async function detectSkinVariant(
  imageUrl: string,
): Promise<SkinVariant> {
  const isSlim = await new Promise<boolean>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "Anonymous";
    image.src = imageUrl;

    image.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      canvas.width = image.width;
      canvas.height = image.height;
      ctx.drawImage(image, 0, 0);

      const px1 = ctx.getImageData(46, 52, 1, 12).data;
      const px2 = ctx.getImageData(54, 20, 1, 12).data;

      for (let i = 3; i < 12 * 4; i += 4) {
        if (px1[i] === 255 || px2[i] === 255) {
          resolve(false);
          return;
        }
      }

      resolve(true);
    };

    image.onerror = () => {
      reject(new Error("Failed to load image"));
    };
  });

  return isSlim ? "slim" : "classic";
}

/**
 * Validates whether the provided skin name follows SkinsRestorer requirements.
 */
export function isValidSkinName(name: string): boolean {
  return /^[a-z0-9_]+$/.test(name);
}
