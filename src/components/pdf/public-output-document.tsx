"use client"

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer"
import { DAMAGE_TYPES, DAMAGE_SEVERITY, VEHICLE_ZONES, INTAKE_STATUS, PHOTO_TYPES } from "@/lib/constants"
import { formatTRY, formatMileage } from "@/lib/format"

Font.register({
  family: "Inter",
  fonts: [
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiJfE.woff2" },
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hiJfE.woff2", fontWeight: 700 },
  ],
})

const styles = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 9,
    padding: 30,
    lineHeight: 1.4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "#0B1F3A",
    paddingBottom: 8,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#0B1F3A",
  },
  headerSub: {
    fontSize: 8,
    color: "#666",
  },
  sectionTitle: {
    fontSize: 8,
    fontWeight: 700,
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  card: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 4,
    padding: 8,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  label: {
    color: "#666",
    fontSize: 8,
  },
  value: {
    fontWeight: 700,
    fontSize: 9,
  },
  badge: {
    fontSize: 7,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    color: "#0B1F3A",
    borderWidth: 1,
    borderColor: "#0B1F3A",
  },
  damageRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 3,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    marginTop: 3,
  },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 4,
    borderTopWidth: 2,
    borderTopColor: "#0B1F3A",
    marginTop: 4,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    textAlign: "center",
    fontSize: 7,
    color: "#999",
  },
  disclaimer: {
    fontSize: 7,
    color: "#999",
    textAlign: "center",
    marginTop: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  grid2: {
    flexDirection: "row",
    gap: 8,
  },
  grid2Col: {
    flex: 1,
  },
  photoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
  },
  itemRowLast: {
    borderBottomWidth: 0,
  },
  typeLabel: {
    fontSize: 7,
    paddingHorizontal: 3,
    borderRadius: 2,
  },
  workshopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
})

type PublicOutputPdfProps = {
  workshop: { name: string; phone: string; city: string; address: string }
  intakeForm: {
    status: string
    mileageAtIntake: number | null
    customerComplaint: string
    approvedAt: Date | null
    createdAt: Date
    customer: { firstName: string; lastName: string; phone: string }
    vehicle: { plate: string; brand: string; model: string; modelYear: number | null; mileage: number | null; vin: string | null }
    photos: { type: string; label: string; fileUrl: string | null }[]
    damageMarks: { zone: string; damageType: string; severity: string; note: string | null }[]
    approvals: { status: string; approvedAt: Date | null }[]
    order: { status: string; items: { type: string; name: string; quantity: number; unitPrice: number | null; totalPrice: number | null }[] } | null
  }
  createdAt: Date
}

export function PublicOutputDocument({ workshop, intakeForm, createdAt }: PublicOutputPdfProps) {
  const statusInfo = INTAKE_STATUS[intakeForm.status as keyof typeof INTAKE_STATUS]
  const orderItems = intakeForm.order?.items ?? []
  const parts = orderItems.filter((i) => i.type === "part")
  const labor = orderItems.filter((i) => i.type === "labor")

  const partsTotal = parts.reduce((sum, i) => {
    if (i.totalPrice != null && i.totalPrice > 0) return sum + i.totalPrice
    if (i.unitPrice != null && i.unitPrice > 0) return sum + i.unitPrice * i.quantity
    return sum
  }, 0)
  const laborTotal = labor.reduce((sum, i) => {
    if (i.totalPrice != null && i.totalPrice > 0) return sum + i.totalPrice
    if (i.unitPrice != null && i.unitPrice > 0) return sum + i.unitPrice * i.quantity
    return sum
  }, 0)
  const grandTotal = partsTotal + laborTotal

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>{workshop.name}</Text>
            <Text style={styles.headerSub}>Araç Kabul ve İşlem Özeti</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 9, color: "#333" }}>
              {new Date(createdAt).toLocaleDateString("tr-TR")}
            </Text>
            <Text style={{ fontSize: 7, color: "#999" }}>BakimX ile oluşturuldu</Text>
          </View>
        </View>

        {/* Status */}
        <View style={[styles.row, { marginBottom: 8 }]}>
          <Text style={styles.label}>Durum:</Text>
          <Text style={styles.badge}>{statusInfo?.label || intakeForm.status}</Text>
        </View>

        {/* Customer & Vehicle */}
        <Text style={styles.sectionTitle}>Müşteri & Araç</Text>
        <View style={[styles.card, { marginBottom: 8 }]}>
          <View style={styles.grid2}>
            <View style={styles.grid2Col}>
              <Text style={styles.label}>Müşteri</Text>
              <Text style={styles.value}>{intakeForm.customer.firstName} {intakeForm.customer.lastName}</Text>
              <Text style={{ fontSize: 8, color: "#666" }}>Tel: {intakeForm.customer.phone}</Text>
            </View>
            <View style={styles.grid2Col}>
              <Text style={styles.label}>Araç</Text>
              <Text style={styles.value}>{intakeForm.vehicle.plate}</Text>
              <Text style={{ fontSize: 8, color: "#666" }}>
                {intakeForm.vehicle.brand} {intakeForm.vehicle.model}
                {intakeForm.vehicle.modelYear ? ` • ${intakeForm.vehicle.modelYear}` : ""}
              </Text>
              {intakeForm.mileageAtIntake != null && (
                <Text style={{ fontSize: 8, color: "#666" }}>Kilometre: {formatMileage(intakeForm.mileageAtIntake)}</Text>
              )}
              {intakeForm.vehicle.vin && (
                <Text style={{ fontSize: 7, color: "#999", fontFamily: "Inter" }}>VIN: {intakeForm.vehicle.vin}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Intake Details */}
        <Text style={styles.sectionTitle}>Kabul Detayı</Text>
        <View style={[styles.card, { marginBottom: 8 }]}>
          <Text style={styles.label}>Müşteri Şikayeti</Text>
          <Text style={{ fontSize: 9, marginTop: 2 }}>{intakeForm.customerComplaint}</Text>
          <View style={[styles.row, { marginTop: 4, borderTopWidth: 0.5, borderTopColor: "#E5E7EB", paddingTop: 3 }]}>
            <Text style={{ fontSize: 7, color: "#999" }}>Kayıt: {new Date(intakeForm.createdAt).toLocaleDateString("tr-TR")}</Text>
            {intakeForm.approvedAt && (
              <Text style={{ fontSize: 7, color: "#999" }}>Onay: {new Date(intakeForm.approvedAt).toLocaleDateString("tr-TR")}</Text>
            )}
          </View>
        </View>

        {/* Damage */}
        {intakeForm.damageMarks.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Hasar Kayıtları ({intakeForm.damageMarks.length})</Text>
            <View style={[styles.card, { marginBottom: 8 }]}>
              {intakeForm.damageMarks.map((mark, idx) => {
                const severityInfo = DAMAGE_SEVERITY[mark.severity as keyof typeof DAMAGE_SEVERITY]
                return (
                  <View key={idx} style={styles.damageRow}>
                    <View style={[styles.dot, { backgroundColor: severityInfo?.color || "#9CA3AF" }]} />
                    <Text style={{ fontSize: 8, fontWeight: 700 }}>
                      {VEHICLE_ZONES[mark.zone as keyof typeof VEHICLE_ZONES] || mark.zone}
                    </Text>
                    <Text style={{ fontSize: 8, color: "#666" }}>
                      — {DAMAGE_TYPES[mark.damageType as keyof typeof DAMAGE_TYPES]?.label || mark.damageType}
                    </Text>
                    <Text style={{ fontSize: 7, color: "#888" }}>({severityInfo?.label || mark.severity})</Text>
                    {mark.note && <Text style={{ fontSize: 7, color: "#999" }}> {mark.note}</Text>}
                  </View>
                )
              })}
            </View>
          </>
        )}

        {/* Photos */}
        {intakeForm.photos.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Fotoğraf Kontrol Listesi ({intakeForm.photos.length})</Text>
            <View style={[styles.card, { marginBottom: 8 }]}>
              {intakeForm.photos.map((photo, idx) => (
                <View key={idx} style={styles.photoItem}>
                  <Text style={{ fontSize: 8 }}>✓</Text>
                  <Text style={{ fontSize: 8 }}>
                    {PHOTO_TYPES[photo.type as keyof typeof PHOTO_TYPES]?.label || photo.label}
                  </Text>
                  {photo.fileUrl && <Text style={{ fontSize: 7, color: "#22C55E" }}>(fotoğraf mevcut)</Text>}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Approval */}
        {intakeForm.approvals.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Onay Durumu</Text>
            <View style={[styles.card, { marginBottom: 8 }]}>
              {intakeForm.approvals[0].status === "verified" ? (
                <Text style={{ fontSize: 9, fontWeight: 700, color: "#15803D" }}>✓ Müşteri onayı verildi</Text>
              ) : (
                <Text style={{ fontSize: 9, fontWeight: 700, color: "#A16207" }}>⏳ Onay bekliyor</Text>
              )}
              {intakeForm.approvals[0].approvedAt && (
                <Text style={{ fontSize: 7, color: "#999" }}>
                  Onay tarihi: {new Date(intakeForm.approvals[0].approvedAt).toLocaleDateString("tr-TR")}
                </Text>
              )}
            </View>
          </>
        )}

        {/* Service Order */}
        {intakeForm.order && orderItems.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Servis Emri</Text>
            <View style={[styles.card, { marginBottom: 8 }]}>
              {parts.length > 0 && (
                <View style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 7, fontWeight: 700, color: "#2563EB", marginBottom: 2 }}>PARÇALAR</Text>
                  {parts.map((item, idx) => (
                    <View key={`p-${idx}`} style={[styles.itemRow, idx === parts.length - 1 ? styles.itemRowLast : {}]}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Text style={{ fontSize: 8, fontWeight: 700 }}>{item.name}</Text>
                        <Text style={{ fontSize: 7, color: "#888" }}>×{item.quantity}</Text>
                        {item.unitPrice != null && item.unitPrice > 0 && (
                          <Text style={{ fontSize: 7, color: "#888" }}>({formatTRY(item.unitPrice)}/adet)</Text>
                        )}
                      </View>
                      <Text style={{ fontSize: 8, fontWeight: 700 }}>
                        {item.totalPrice != null && item.totalPrice > 0
                          ? formatTRY(item.totalPrice)
                          : item.unitPrice != null && item.unitPrice > 0
                            ? formatTRY(item.unitPrice * item.quantity)
                            : "—"}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              {labor.length > 0 && (
                <View style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 7, fontWeight: 700, color: "#7C3AED", marginBottom: 2 }}>İŞÇİLİK</Text>
                  {labor.map((item, idx) => (
                    <View key={`l-${idx}`} style={[styles.itemRow, idx === labor.length - 1 ? styles.itemRowLast : {}]}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Text style={{ fontSize: 8, fontWeight: 700 }}>{item.name}</Text>
                        <Text style={{ fontSize: 7, color: "#888" }}>×{item.quantity}</Text>
                        {item.unitPrice != null && item.unitPrice > 0 && (
                          <Text style={{ fontSize: 7, color: "#888" }}>({formatTRY(item.unitPrice)}/birim)</Text>
                        )}
                      </View>
                      <Text style={{ fontSize: 8, fontWeight: 700 }}>
                        {item.totalPrice != null && item.totalPrice > 0
                          ? formatTRY(item.totalPrice)
                          : item.unitPrice != null && item.unitPrice > 0
                            ? formatTRY(item.unitPrice * item.quantity)
                            : "—"}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              {(partsTotal > 0 || laborTotal > 0) && (
                <>
                  {partsTotal > 0 && (
                    <View style={styles.totalRow}>
                      <Text style={{ fontSize: 8, color: "#666" }}>Parça Toplamı</Text>
                      <Text style={{ fontSize: 8 }}>{formatTRY(partsTotal)}</Text>
                    </View>
                  )}
                  {laborTotal > 0 && (
                    <View style={styles.totalRow}>
                      <Text style={{ fontSize: 8, color: "#666" }}>İşçilik Toplamı</Text>
                      <Text style={{ fontSize: 8 }}>{formatTRY(laborTotal)}</Text>
                    </View>
                  )}
                  <View style={styles.grandTotal}>
                    <Text style={{ fontSize: 9, fontWeight: 700 }}>Genel Toplam</Text>
                    <Text style={{ fontSize: 9, fontWeight: 700 }}>{formatTRY(grandTotal)}</Text>
                  </View>
                </>
              )}
            </View>
          </>
        )}

        {/* Workshop */}
        <Text style={styles.sectionTitle}>İş Yeri Bilgileri</Text>
        <View style={[styles.card, { marginBottom: 8 }]}>
          <View style={styles.workshopRow}>
            <Text style={{ fontSize: 8, fontWeight: 700 }}>★</Text>
            <Text style={{ fontSize: 9, fontWeight: 700 }}>{workshop.name}</Text>
          </View>
          <Text style={{ fontSize: 8, color: "#666" }}>{workshop.city}, {workshop.address}</Text>
          <Text style={{ fontSize: 8, color: "#666" }}>Tel: {workshop.phone}</Text>
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text>Bu çıktı, servis kabul ve işlem özeti amacıyla oluşturulmuştur.</Text>
          <Text>BakimX ile oluşturuldu • {new Date(createdAt).toLocaleDateString("tr-TR")}</Text>
        </View>
      </Page>
    </Document>
  )
}