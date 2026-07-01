export type { OcrProvider, RegistrationOcrResult, OcrFieldConfidence, OcrProviderName } from "./types"
export { LOW_CONFIDENCE_THRESHOLD, SUPPORTED_IMAGE_MIME_TYPES, MAX_IMAGE_SIZE_BYTES, MAX_BODY_SIZE_BYTES } from "./types"
export { getOcrProvider, resetOcrProvider } from "./provider"
export { MockOcrProvider, getMockOcrProvider } from "./mock-ocr-provider"
export { OpenAiOcrProvider } from "./openai-ocr-provider"
export { AnthropicOcrProvider } from "./anthropic-ocr-provider"
// Plaka OCR (tesseract-text-extractor) tarafından kullanılan worker temizliği.
export { terminateTesseractWorker } from "./tesseract-text-extractor"