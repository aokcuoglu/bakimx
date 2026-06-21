import { ImageResponse } from "next/og"

const ICON_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="303" height="190" viewBox="0 0 303 190" role="img" aria-labelledby="title">
  <title id="title">BakimX Standalone Symbol</title>
  <defs>
<linearGradient id="navy" x1="0%" y1="0%" x2="100%" y2="100%">
  <stop offset="0%" stop-color="#071F49"/>
  <stop offset="100%" stop-color="#031432"/>
</linearGradient>
<linearGradient id="blue" x1="0%" y1="0%" x2="100%" y2="100%">
  <stop offset="0%" stop-color="#2F84FF"/>
  <stop offset="55%" stop-color="#0865E8"/>
  <stop offset="100%" stop-color="#064BBF"/>
</linearGradient>
  </defs>
<path d="M 56.00,164.00 L 175.00,164.00 L 188.00,150.00 L 188.00,146.00 L 185.00,141.00 L 178.00,137.00 L 163.00,133.00 L 138.00,131.00 L 118.00,118.00 L 110.00,115.00 L 99.00,114.00 L 98.00,113.00 L 81.00,113.00 L 71.00,131.00 L 71.00,133.00 L 58.00,158.00 Z M 81.00,140.00 L 82.00,139.00 L 90.00,139.00 L 91.00,140.00 L 115.00,141.00 L 128.00,144.00 L 139.00,149.00 L 148.00,140.00 L 161.00,139.00 L 165.00,141.00 L 171.00,147.00 L 173.00,156.00 L 172.00,157.00 L 170.00,156.00 L 168.00,150.00 L 165.00,147.00 L 158.00,144.00 L 155.00,144.00 L 147.00,148.00 L 143.00,156.00 L 143.00,161.00 L 140.00,162.00 L 132.00,154.00 L 124.00,150.00 L 102.00,144.00 L 82.00,142.00 Z M 89.00,119.00 L 92.00,117.00 L 101.00,117.00 L 102.00,118.00 L 112.00,119.00 L 124.00,125.00 L 130.00,129.00 L 131.00,131.00 L 129.00,132.00 L 128.00,131.00 L 98.00,130.00 L 95.00,129.00 L 92.00,126.00 Z M 89.00,4.00 L 75.00,41.00 L 194.00,41.00 L 197.00,42.00 L 203.00,49.00 L 201.00,57.00 L 196.00,62.00 L 191.00,64.00 L 105.00,64.00 L 89.00,100.00 L 170.00,100.00 L 175.00,101.00 L 184.00,105.00 L 192.00,113.00 L 202.00,126.00 L 207.00,130.00 L 228.00,106.00 L 213.00,86.00 L 223.00,81.00 L 235.00,70.00 L 240.00,62.00 L 243.00,54.00 L 244.00,35.00 L 238.00,21.00 L 226.00,10.00 L 220.00,7.00 L 209.00,4.00 Z" fill="url(#navy)" fill-rule="evenodd"/>
<path d="M 19.00,135.00 L 21.00,134.00 L 24.00,135.00 L 37.00,135.00 L 38.00,134.00 L 46.00,134.00 L 47.00,135.00 L 53.00,132.00 L 57.00,122.00 L 26.00,122.00 L 22.00,126.00 L 19.00,132.00 Z M 291.00,184.00 L 233.00,117.00 L 172.00,185.00 L 174.00,184.00 L 179.00,185.00 L 207.00,185.00 L 231.00,161.00 L 233.00,161.00 L 250.00,181.00 L 255.00,185.00 L 265.00,185.00 L 266.00,184.00 L 287.00,185.00 Z M 4.00,103.00 L 5.00,104.00 L 58.00,104.00 L 59.00,103.00 L 69.00,103.00 L 76.00,91.00 L 75.00,90.00 L 14.00,90.00 L 11.00,91.00 L 8.00,94.00 Z M 298.00,89.00 L 263.00,89.00 L 243.00,111.00 L 243.00,113.00 L 255.00,128.00 L 259.00,131.00 Z M 28.00,73.00 L 78.00,73.00 L 81.00,72.00 L 84.00,69.00 L 88.00,60.00 L 36.00,60.00 L 31.00,64.00 L 28.00,70.00 Z" fill="url(#blue)" fill-rule="evenodd"/>
</svg>`

const iconDataUrl = `data:image/svg+xml;base64,${Buffer.from(ICON_SVG).toString("base64")}`

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FFFFFF",
        }}
      >
        <img
          src={iconDataUrl}
          width={140}
          height={140}
          style={{ objectFit: "contain" }}
          alt=""
        />
      </div>
    ),
    { ...size },
  )
}