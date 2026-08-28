/**
 * Kayıt "resume" (devam ettirme) kararı — SAF fonksiyon (yan etkisiz, test edilebilir).
 *
 * /register aynı e-postayla ikinci kez POST edildiğinde: hesap ele geçirme yolu
 * OLMASIN diye yalnızca ÜÇ koşul birden sağlanırsa doğrulama token'ı geri verilir:
 *  1) gönderilen şifre saklı hash'le DOĞRULANIYOR (login'in kullandığı bcrypt.compare),
 *  2) workshop hâlâ `pending` (henüz onaylanmamış/aktifleşmemiş),
 *  3) trial HENÜZ başlamamış (trialStartedAt null — yani e-posta doğrulaması yapılmamış).
 *
 * Herhangi biri sağlanmazsa çağıran taraf sıradan "e-posta kullanımda" hatasını
 * döndürür (yanlış şifre ile "doğrulanmamış-pending ama-tutmayan" ayırt edilemez).
 */
export function canResumeVerification(input: {
  passwordValid: boolean
  approvalStatus: string
  trialStartedAt: Date | null
}): boolean {
  return (
    input.passwordValid === true &&
    input.approvalStatus === "pending" &&
    input.trialStartedAt === null
  )
}
