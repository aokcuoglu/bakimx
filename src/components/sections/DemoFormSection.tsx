import { DemoRequestButton } from "@/components/public/DemoRequestButton";
export function DemoFormSection() {
  return (
    <section className="border-t bg-card px-6 py-24 text-center sm:py-32">
      <p className="mb-5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Birlikte başlayalım
      </p>
      <h2 className="mx-auto max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
        Servisinize daha fazla
        <br />
        zaman kalsın.
      </h2>
      <p className="mx-auto mb-8 mt-6 max-w-lg text-lg leading-7 text-muted-foreground">
        Gününüzü anlatın. BakımX’in hangi işinizi kolaylaştıracağını birlikte
        görelim.
      </p>
      <DemoRequestButton location="home_closing" />
    </section>
  );
}
