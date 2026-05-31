import { getIronSession } from "iron-session"
import { cookies } from "next/headers"

export interface SessionData {
  userId?: string
  workshopId?: string
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.trim() === "") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_SECRET ortam değişkeni production ortamında zorunludur. " +
          "Lütfen .env dosyanıza en az 32 karakter uzunluğunda rastgele bir SESSION_SECRET ekleyin."
      )
    }
    return "complex_password_at_least_32_characters_long_for_dev"
  }
  if (process.env.NODE_ENV === "production" && secret.length < 32) {
    throw new Error(
      "SESSION_SECRET en az 32 karakter uzunluğunda olmalıdır. " +
        "Mevcut uzunluk: " + secret.length
    )
  }
  return secret
}

export const sessionOptions = {
  password: getSessionSecret(),
  cookieName: "bakimx_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  },
}

export async function getSession() {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)
  return session
}
