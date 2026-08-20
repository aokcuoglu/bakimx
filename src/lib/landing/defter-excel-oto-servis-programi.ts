export const COMPARISON_PATH = "/karsilastir/defter-excel-oto-servis-programi" as const

export const COMPARISON_TITLE = "Defter, Excel ve Oto Servis Programı Karşılaştırması"

export const COMPARISON_DESCRIPTION =
  "Oto servisinde defter, Excel ve servis programını erişim, kayıt bütünlüğü, ekip paylaşımı ve takip ölçütleriyle dengeli biçimde karşılaştırın."

export const COMPARISON_ROWS = [
  {
    criterion: "Başlangıç",
    notebook: "Ek kurulum gerektirmez; fiziksel bir kayıt düzeni yeterlidir.",
    spreadsheet: "Dosya ve sütun yapısının servis tarafından hazırlanması gerekir.",
    software: "Hesap açılır; araç ve iş emri akışı hazır alanlarla ilerler.",
  },
  {
    criterion: "Erişim",
    notebook: "Defterin bulunduğu yerde kullanılabilir.",
    spreadsheet: "Dosyanın saklandığı veya paylaşıldığı ortamdan açılır.",
    software: "İnternet bağlantısıyla telefon, tablet veya bilgisayardan açılır.",
  },
  {
    criterion: "Kayıt bütünlüğü",
    notebook: "Bilgi serbest biçimde yazılır; eksik alanları süreçle kontrol etmek gerekir.",
    spreadsheet: "Sütunlar standartlaştırılabilir; satır yapısını ekip korur.",
    software: "Araç, müşteri, iş emri, parça, işçilik ve fotoğraf aynı servis kaydında tutulur.",
  },
  {
    criterion: "Ekip paylaşımı",
    notebook: "Aynı fiziksel kayıt üzerinden sırayla çalışılır.",
    spreadsheet: "Paylaşım yöntemi dosya sürümünü ve eşzamanlı kullanımı etkiler.",
    software: "Yetkili kullanıcılar güncel servis kaydını aynı uygulamada görür.",
  },
  {
    criterion: "İş takibi ve kanıt",
    notebook: "Durum, onay ve görseller ayrı kayıtlarla izlenebilir.",
    spreadsheet: "Durum alanları kurulabilir; fotoğraf ve onay bağlantıları ayrıca yönetilir.",
    software: "İş durumu, işlem geçmişi, fotoğraflar ve müşteri onayı iş emriyle ilişkilidir.",
  },
] as const
