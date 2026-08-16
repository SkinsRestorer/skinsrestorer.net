"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldTitle,
} from "@/components/ui/field";

const HCaptcha = dynamic(() => import("@hcaptcha/react-hcaptcha"), {
  ssr: false,
  loading: () => (
    <p className="text-sm text-muted-foreground" role="status">
      Loading verification...
    </p>
  ),
});

interface AxolotlCaptchaProps {
  onTokenChange: (token: string | null) => void;
}

export function AxolotlCaptcha({ onTokenChange }: AxolotlCaptchaProps) {
  const [error, setError] = useState<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;

  const handleVerify = useCallback(
    (token: string) => {
      setError(null);
      onTokenChange(token);
    },
    [onTokenChange],
  );
  const handleExpire = useCallback(() => {
    onTokenChange(null);
    setError("Verification expired. Please complete it again.");
  }, [onTokenChange]);
  const handleError = useCallback(() => {
    onTokenChange(null);
    setError(
      "Verification could not load. Check your connection and try again.",
    );
  }, [onTokenChange]);

  const clearToken = useCallback(() => {
    setError(null);
    onTokenChange(null);
  }, [onTokenChange]);

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldTitle>Human verification</FieldTitle>
      {siteKey ? (
        <div className="max-w-full overflow-x-auto">
          <HCaptcha
            sitekey={siteKey}
            reCaptchaCompat={false}
            sentry={false}
            onLoad={clearToken}
            onVerify={handleVerify}
            onExpire={handleExpire}
            onError={handleError}
          />
        </div>
      ) : (
        <FieldError>
          Axolotl verification is not configured. Please use the official upload
          method.
        </FieldError>
      )}
      <FieldDescription>
        Required when a cape is uploaded through Axolotl.
      </FieldDescription>
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}
