declare module "heic-convert" {
  type HeicConvertOptions = {
    buffer: ArrayBuffer | Uint8Array | Buffer
    format: "JPEG" | "PNG"
    quality?: number
  }

  function convert(options: HeicConvertOptions): Promise<Uint8Array>

  export default convert
}

