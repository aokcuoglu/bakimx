import { NextResponse } from "next/server"

// Public self-registration is disabled. BakımX has no public register flow;
// accounts are provisioned out-of-band (seed / admin). This endpoint is kept
// only to return a clear 404 for any old clients still calling it.
export async function POST() {
  return NextResponse.json({ error: "Kayıt akışı kullanılmıyor" }, { status: 404 })
}
