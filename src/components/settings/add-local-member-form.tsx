"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { Check, Loader2, UserPlus, X } from "lucide-react"
import type { UserRole } from "@prisma/client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/roles"
import { normalizeUsername, suggestUsername } from "@/lib/user-identity"
import {
  checkUsernameAvailabilityAction,
  createLocalMemberAction,
} from "@/app/(app)/settings/team/actions"
import type { IssuedCredentials } from "@/components/settings/member-credentials-dialog"

/** Kullanıcı adı sorgusu tuş başına atılmasın. */
const AVAILABILITY_DEBOUNCE_MS = 400

type Availability =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "taken"; message: string }

/**
 * E-postası olmayan usta/çırak açma formu (BAK-37).
 *
 * E-posta davet akışının YANINDA durur, onun yerine geçmez: büro personeli ve
 * müdürler davetle gelmeye devam eder (o rollerde e-posta zorunlu — BAK-40).
 */
export function AddLocalMemberForm({
  assignableRoles,
  onCreated,
  onCancel,
  technicianId,
  initialFullName = "",
}: {
  assignableRoles: UserRole[]
  onCreated: (credentials: IssuedCredentials) => void
  onCancel: () => void
  technicianId?: string
  initialFullName?: string
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [seatLimited, setSeatLimited] = useState(false)
  const nameParts = initialFullName.trim().split(/\s+/)
  const [firstName, setFirstName] = useState(nameParts.shift() ?? "")
  const [lastName, setLastName] = useState(nameParts.join(" "))
  const [username, setUsername] = useState("")
  const [role, setRole] = useState<UserRole>(assignableRoles[0] ?? "usta")
  /** Son gelen sunucu cevabı, HANGİ kullanıcı adına ait olduğuyla birlikte. */
  const [checked, setChecked] = useState<{
    username: string
    available: boolean
    error?: string
  } | null>(null)
  /** Kullanıcı alana bir kez dokunduysa öneri artık üzerine yazmaz. */
  const usernameTouched = useRef(false)

  const normalized = normalizeUsername(username)

  // Anlık müsaitlik geri bildirimi. Yarış koşulu kapalı: geç dönen eski cevap
  // yeni girdinin sonucunu ezmesin diye hem iptal bayrağı var, hem de cevap
  // kendi kullanıcı adıyla saklanıp aşağıda eşleşme kontrolünden geçiyor.
  useEffect(() => {
    if (!normalized) return
    let cancelled = false
    const timer = setTimeout(async () => {
      const res = await checkUsernameAvailabilityAction(normalized)
      if (!cancelled) {
        setChecked({ username: normalized, available: res.available, error: res.error })
      }
    }, AVAILABILITY_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [normalized])

  // Durum TÜRETİLİR, effect içinde setState ile yazılmaz: yazılsaydı her tuşta
  // fazladan bir render turu doğardı (react-hooks/set-state-in-effect).
  const availability: Availability = !normalized
    ? { state: "idle" }
    : checked?.username !== normalized
      ? { state: "checking" }
      : checked.available
        ? { state: "available" }
        : { state: "taken", message: checked.error ?? "Bu kullanıcı adı kullanılamaz." }

  /** Ad-soyad değiştikçe kullanıcı adı önerisi — sahip her seferinde ad uydurmasın. */
  function handleNameChange(next: { firstName?: string; lastName?: string }) {
    const first = next.firstName ?? firstName
    const last = next.lastName ?? lastName
    if (next.firstName !== undefined) setFirstName(next.firstName)
    if (next.lastName !== undefined) setLastName(next.lastName)
    if (!usernameTouched.current) setUsername(suggestUsername(first, last))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setSeatLimited(false)
    const fd = new FormData()
    fd.set("firstName", firstName)
    fd.set("lastName", lastName)
    fd.set("username", normalized)
    fd.set("role", role)
    if (technicianId) fd.set("technicianId", technicianId)
    startTransition(async () => {
      const res = await createLocalMemberAction(fd)
      if (res.ok) {
        onCreated(res.credentials)
      } else {
        setError(res.error)
        setSeatLimited(res.code === "seat_limit")
      }
    })
  }

  const canSubmit =
    !isPending &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    availability.state === "available"

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-3 mb-4"
    >
      <div>
        <h4 className="text-sm font-semibold text-foreground">
          {technicianId ? "Personelin giriş hesabını tamamla" : "E-postasız kullanıcı ekle"}
        </h4>
        <p className="text-xs text-muted-foreground mt-0.5">
          E-posta adresi olmayan usta ve çıraklar için. Sistem tek seferlik bir geçici şifre üretir.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive-strong text-sm"
        >
          {error}
          {seatLimited && (
            <>
              {" "}
              <Link href="/billing" className="font-semibold underline underline-offset-2">
                Paketleri görüntüleyin
              </Link>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="local-first-name" className="text-xs text-muted-foreground">
            Ad *
          </Label>
          <Input
            id="local-first-name"
            value={firstName}
            onChange={(e) => handleNameChange({ firstName: e.target.value })}
            placeholder="Mehmet"
            autoComplete="off"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="local-last-name" className="text-xs text-muted-foreground">
            Soyad *
          </Label>
          <Input
            id="local-last-name"
            value={lastName}
            onChange={(e) => handleNameChange({ lastName: e.target.value })}
            placeholder="Yılmaz"
            autoComplete="off"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="local-username" className="text-xs text-muted-foreground">
            Kullanıcı adı *
          </Label>
          <Input
            id="local-username"
            value={username}
            onChange={(e) => {
              usernameTouched.current = true
              setUsername(e.target.value)
            }}
            placeholder="mehmet.yilmaz"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-describedby="local-username-hint"
            required
          />
          <p
            id="local-username-hint"
            aria-live="polite"
            className={cn(
              "text-xs flex items-center gap-1",
              availability.state === "available" && "text-success-strong",
              availability.state === "taken" && "text-destructive-strong",
              (availability.state === "idle" || availability.state === "checking") &&
                "text-muted-foreground"
            )}
          >
            {availability.state === "checking" && (
              <>
                <Loader2 className="size-3 animate-spin" /> Kontrol ediliyor…
              </>
            )}
            {availability.state === "available" && (
              <>
                <Check className="size-3" /> Bu kullanıcı adı müsait
              </>
            )}
            {availability.state === "taken" && (
              <>
                <X className="size-3" /> {availability.message}
              </>
            )}
            {availability.state === "idle" && "Kullanıcı adı iş yerinizde benzersiz olmalıdır."}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="local-role" className="text-xs text-muted-foreground">
            Rol *
          </Label>
          <Select
            items={ROLE_LABELS}
            value={role}
            onValueChange={(v) => v && setRole(v as UserRole)}
          >
            <SelectTrigger id="local-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {assignableRoles.map((r) => (
                <SelectItem key={r} value={r}>
                  <span className="flex flex-col items-start">
                    <span>{ROLE_LABELS[r]}</span>
                    <span className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Yönetici ve Servis Müdürü için e-posta zorunludur — onları davet edin.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button type="submit" size="lg" disabled={!canSubmit} className="touch-manipulation">
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
          Kullanıcıyı Oluştur
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onCancel}
          className="touch-manipulation"
        >
          İptal
        </Button>
      </div>
    </form>
  )
}
