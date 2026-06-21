import { redirect } from "next/navigation"

// Public self-registration has been removed. Any visit to /register is sent to
// the login page (accounts are provisioned out-of-band).
export default function RegisterPage() {
  redirect("/login")
}
