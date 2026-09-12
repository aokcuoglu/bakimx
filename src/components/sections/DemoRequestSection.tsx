import { HeroLeadForm } from "./HeroLeadForm";
export function DemoRequestSection() {
  return (
    <section data-public-compact className="px-5 py-20 sm:py-28">
      <div className="mx-auto max-w-2xl">
        <p className="mb-5 text-xs uppercase tracking-widest text-muted-foreground">
          BakımX ile tanışın
        </p>
        <h1 className="text-5xl font-semibold tracking-tight">
          Servisinizi tanıyalım.
        </h1>
        <p className="mb-10 mt-6 text-lg leading-7 text-muted-foreground">
          Bilgilerinizi bırakın. Araç kabulünden iş emrine, BakımX’in
          servisinizde nasıl çalışacağını birlikte inceleyelim.
        </p>
        <div className="rounded-2xl border bg-background p-6 sm:p-10">
          <HeroLeadForm formLocation="demo_page" showNotes />
        </div>
      </div>
    </section>
  );
}
