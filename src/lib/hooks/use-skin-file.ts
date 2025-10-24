"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { detectSkinVariant, type SkinVariant } from "@/lib/skin";

type UseSkinFileOptions = {
  /**
   * When true, automatically detect the skin variant after file selection.
   */
  autoDetectVariant?: boolean;
};

export function useSkinFile({
  autoDetectVariant = true,
}: UseSkinFileOptions = {}) {
  const [file, setFile] = useState<File | null>(null);
  const [skinUrl, setSkinUrl] = useState<string | null>(null);
  const [skinType, setSkinType] = useState<SkinVariant>("classic");
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const handleFileChange = useCallback(
    (nextFile: File | null) => {
      setFile(nextFile);

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      if (!nextFile) {
        setSkinUrl(null);
        return;
      }

      const nextUrl = URL.createObjectURL(nextFile);
      objectUrlRef.current = nextUrl;
      setSkinUrl(nextUrl);

      if (autoDetectVariant) {
        toast.promise(
          detectSkinVariant(nextUrl).then((variant) => {
            setSkinType(variant);
            return variant;
          }),
          {
            loading: "Detecting skin type...",
            success: (variant) => `Skin file detected as a ${variant} skin.`,
            error: (error) =>
              `Failed to detect skin type: ${
                error instanceof Error ? error.message : String(error)
              }`,
          },
        );
      }
    },
    [autoDetectVariant],
  );

  const clear = useCallback(() => {
    handleFileChange(null);
    setSkinType("classic");
  }, [handleFileChange]);

  return {
    file,
    skinUrl,
    skinType,
    setSkinType,
    handleFileChange,
    clear,
  };
}
