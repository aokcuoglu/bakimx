import { NextResponse } from "next/server"
import { logoutAction } from "@/app/(auth)/login/actions"

export async function POST() {
  try {
    await logoutAction()
  } catch {
    // logoutAction redirects, which throws in API route
  }
  return NextResponse.redirect(new URL("/login", process.env.APP_URL || "http://localhost:3000"))
}