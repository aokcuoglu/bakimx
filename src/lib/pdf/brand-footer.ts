export const BAKIMX_PRIMARY_LIGHT_SVG_PATH = "/01-bakimx-primary-light.svg"

export function bakimxPdfFooterBar(createdAt: Date | string): string {
  const fmtDate = (d: Date | string) =>
    new Date(d).toLocaleDateString("tr-TR")
  return `<div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid #E5E7EB;">
    <div style="display:flex;align-items:center;gap:6px;">
      <img src="${BAKIMX_PRIMARY_LIGHT_SVG_PATH}" alt="BakimX" style="height:14px;width:auto;object-fit:contain;" />
      <span style="font-size:8px;color:#999;">ile oluşturuldu</span>
    </div>
    <span style="font-size:8px;color:#999;">${fmtDate(createdAt)}</span>
  </div>`
}