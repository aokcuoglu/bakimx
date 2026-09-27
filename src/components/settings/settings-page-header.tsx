export function SettingsPageHeader({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <header className="mb-6 sm:mb-8">
      <h1 className="text-page-title text-foreground">{title}</h1>
      {description ? (
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>
      ) : null}
    </header>
  )
}
