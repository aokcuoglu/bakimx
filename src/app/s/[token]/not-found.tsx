export default function ShareNotFound() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Bağlantı Bulunamadı</h1>
          <p className="text-sm text-gray-500 mb-4">
            Bu bağlantı geçersiz veya süresi dolmuş olabilir. Lütfen servis danışmanınızdan yeni bir bağlantı talep edin.
          </p>
          <p className="text-xs text-gray-400">
            BakimX — Dijital Araç Kabul Platformu
          </p>
        </div>
      </div>
    </div>
  )
}