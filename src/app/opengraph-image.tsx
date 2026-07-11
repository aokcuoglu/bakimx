import { ImageResponse } from "next/og"

// Only-logo tasarım: koyu OG zemininde beyaz kollu X ikonu (04 svg).
const ICON_DARK_SVG_BASE64 =
  "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciCiAgICAgd2lkdGg9IjIwOCIgaGVpZ2h0PSIxOTAiCiAgICAgdmlld0JveD0iODcgMTA4IDIwOCAxOTAiCiAgICAgcm9sZT0iaW1nIiBhcmlhLWxhYmVsbGVkYnk9InRpdGxlIj4KICA8dGl0bGUgaWQ9InRpdGxlIj5CYWtpbVggU3RhbmRhbG9uZSBTeW1ib2wgRGFyayBCYWNrZ3JvdW5kPC90aXRsZT4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYmx1ZUdyYWQiIHgxPSIxMDAiIHkxPSIyODMiIHgyPSIyODYiIHkyPSIxMTciIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjMkI3MkVFIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMC41MiIgc3RvcC1jb2xvcj0iIzRGODZGRiIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiM0QTg3RkYiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9IndoaXRlR3JhZCIgeDE9Ijk1IiB5MT0iMTI4IiB4Mj0iMjIyIiB5Mj0iMjM5IiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iI0ZGRkZGRiIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjAuNyIgc3RvcC1jb2xvcj0iI0Y5RjlGOSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNFRkVGRUYiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8ZmlsdGVyIGlkPSJsb2dvU2hhZG93IiB4PSI3MCIgeT0iOTYiIHdpZHRoPSIyNTAiIGhlaWdodD0iMjIwIiBmaWx0ZXJVbml0cz0idXNlclNwYWNlT25Vc2UiIGNvbG9yLWludGVycG9sYXRpb24tZmlsdGVycz0ic1JHQiI+CiAgICAgIDxmZURyb3BTaGFkb3cgZHg9IjAiIGR5PSIyIiBzdGREZXZpYXRpb249IjMiIGZsb29kLWNvbG9yPSIjMDAwMDAwIiBmbG9vZC1vcGFjaXR5PSIwLjIwIi8+CiAgICA8L2ZpbHRlcj4KICA8L2RlZnM+CiAgPGcgZmlsdGVyPSJ1cmwoI2xvZ29TaGFkb3cpIj4KICA8cGF0aCBkPSJNIDk2IDEzMCBMIDk3IDEzNCBMIDE0NCAxODQgTCAxNDQgMTg1IEwgMTUzIDE5NCBMIDE1MyAxOTUgTCAxNjggMjEwIEwgMTc2IDIwNSBMIDE4MiAyMDQgTCAxODMgMjAzIEwgMTg3IDIwMyBMIDE4OCAyMDIgTCAxOTkgMjAyIEwgMjAwIDIwMyBMIDIwNSAyMDMgTCAyMDYgMjA0IEwgMjE0IDIwNiBMIDIyMCAyMTAgTCAxOTMgMTgxIEwgMTkzIDE4MCBMIDE3OSAxNjYgTCAxNzkgMTY1IEwgMTcwIDE1NiBMIDE3MCAxNTUgTCAxNTQgMTM5IEwgMTU0IDEzOCBMIDE0NiAxMzIgTCAxMzggMTI5IEwgOTcgMTI5IFoiIGZpbGw9InVybCgjd2hpdGVHcmFkKSIvPgogIDxwYXRoIGQ9Ik0gMTAyIDI4NCBMIDExMCAyODQgTCAxMTEgMjg1IEwgMTQwIDI4NSBMIDE0MSAyODQgTCAxNDggMjgzIEwgMTU4IDI3NyBMIDE4NyAyNDYgTCAxODcgMjQ1IEwgMTkyIDI0MSBMIDE5NyAyNDIgTCAyMzAgMjc4IEwgMjM5IDI4MyBMIDI0MSAyODMgTCAyNDIgMjg0IEwgMjg0IDI4NCBMIDI4NiAyODIgTCAyODUgMjgwIEwgMjc1IDI3MCBMIDI3NSAyNjkgTCAyNjUgMjU5IEwgMjY1IDI1OCBMIDI0NCAyMzYgTCAyNDQgMjM1IEwgMjIxIDIxMSBMIDIwNyAyMDUgTCAxOTkgMjA0IEwgMTk4IDIwMyBMIDE4OSAyMDMgTCAxODggMjA0IEwgMTgwIDIwNSBMIDE3NyAyMDcgTCAxNzUgMjA3IEwgMTcxIDIwOSBMIDE2OSAyMTEgTCAxNjcgMjExIEwgMTY3IDIxMiBMIDE1NSAyMjMgTCAxNTUgMjI0IEwgMTQ2IDIzMyBMIDE0NiAyMzQgTCAxMTAgMjcyIEwgMTEwIDI3MyBMIDEwMiAyODEgWiIgZmlsbD0idXJsKCNibHVlR3JhZCkiLz4KICA8cGF0aCBkPSJNIDI4NCAxMTcgTCAyNDYgMTE3IEwgMjQ1IDExOCBMIDI0MSAxMTggTCAyNDAgMTE5IEwgMjM1IDEyMCBMIDIzMCAxMjMgTCAyMjIgMTMxIEwgMjIyIDEzMiBMIDIwOCAxNDYgTCAyMDggMTQ3IEwgMTk5IDE1NyBMIDIyMiAxODIgTCAyMjIgMTgzIEwgMjI0IDE4NSBMIDIyNiAxODUgTCAyNjkgMTM5IEwgMjY5IDEzOCBMIDI4MiAxMjUgTCAyODIgMTI0IEwgMjg2IDEyMCBaIiBmaWxsPSJ1cmwoI2JsdWVHcmFkKSIvPgogIDwvZz4KPC9zdmc+Cg=="

const logoDataUrl = `data:image/svg+xml;base64,${ICON_DARK_SVG_BASE64}`

export const alt = "BakimX — Oto Servis Yönetim Platformu"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0B1F3A 0%, #102A43 100%)",
          padding: 80,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 40,
          }}
        >
          <img
            src={logoDataUrl}
            width={219}
            height={200}
            style={{ objectFit: "contain" }}
            alt="BakimX"
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 48,
              height: 3,
              background: "#38BDF8",
              borderRadius: 9999,
            }}
          />
          <p
            style={{
              color: "#CBD5E1",
              fontSize: 32,
              fontWeight: 500,
              letterSpacing: 0.5,
              margin: 0,
            }}
          >
            Oto Servis Yönetim Platformu
          </p>
          <div
            style={{
              width: 48,
              height: 3,
              background: "#38BDF8",
              borderRadius: 9999,
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  )
}