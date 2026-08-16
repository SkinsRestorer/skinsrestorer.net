import { useCallback, useState } from "react";

export function useAxolotlCaptcha() {
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const resetCaptcha = useCallback(() => {
    setCaptchaToken(null);
    setCaptchaResetKey((current) => current + 1);
  }, []);

  return {
    captchaToken,
    captchaResetKey,
    setCaptchaToken,
    resetCaptcha,
  };
}
