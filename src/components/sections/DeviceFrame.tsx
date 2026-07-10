export function BrowserFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-2xl">
      <div className="flex items-center gap-1.5 border-b bg-muted/50 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
        <div className="mx-auto flex h-5 w-1/2 items-center justify-center rounded bg-background text-[10px] text-muted-foreground">
          app.bakimx.com
        </div>
      </div>
      {children}
    </div>
  );
}

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-[2rem] border-[6px] border-foreground/80 bg-card shadow-2xl">
      <div className="flex justify-center bg-card py-1.5">
        <span className="h-1.5 w-16 rounded-full bg-foreground/20" />
      </div>
      {children}
    </div>
  );
}
