// Settings pages always read the authenticated tenant's current data.
export const dynamic = "force-dynamic"

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children
}
