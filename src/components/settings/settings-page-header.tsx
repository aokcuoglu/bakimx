export function SettingsPageHeader({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <header className="mb-6 sm:mb-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">{title}</h1>
      {description ? (
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>
      ) : null}
    </header>
  )
}
