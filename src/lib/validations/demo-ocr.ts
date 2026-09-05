import { z } from "zod";
import { DEMO_OCR_IMAGE_TYPES, DEMO_OCR_MAX_IMAGE_BYTES } from "@/lib/ocr/demo-contract";

export const demoOcrSchema = z.object({
  image: z.custom<File>((value) => typeof File !== "undefined" && value instanceof File, "Bir ruhsat fotoğrafı seçin.")
    .refine((file) => !file || file.size <= DEMO_OCR_MAX_IMAGE_BYTES, "Fotoğraf en fazla 8 MB olabilir.")
    .refine((file) => !file || DEMO_OCR_IMAGE_TYPES.some((type) => type === file.type), "JPEG, PNG veya WebP fotoğrafı seçin."),
  consent: z.boolean().refine(Boolean, "Devam etmek için bilgilendirmeyi onaylayın."),
  turnstileToken: z.string().min(1, "Güvenlik doğrulamasını tamamlayın."),
});
