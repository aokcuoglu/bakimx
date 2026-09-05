/** Public OCR demo wire format. Uploaded documents and results are not persisted. */
export type DemoOcrField = {
  key: string;
  label: string;
  code: string;
  value: string;
  confidence?: number;
};

export type DemoOcrStatus = {
  status: "ready" | "used" | "limited" | "unavailable";
  siteKey?: string;
  message?: string;
  retryAfterSeconds?: number;
};

export type DemoOcrResponse =
  | { success: true; fields: DemoOcrField[] }
  | {
      success: false;
      code: "used" | "limited" | "unavailable" | "invalid_image" | "verification_failed" | "invalid_request" | "ocr_failed";
      error: string;
      retryAfterSeconds?: number;
    };

export const DEMO_OCR_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const DEMO_OCR_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
