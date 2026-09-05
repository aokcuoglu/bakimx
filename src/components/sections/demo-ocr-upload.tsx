"use client";

import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { LoaderCircle, ScanLine } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { demoOcrSchema } from "@/lib/validations/demo-ocr";
import type { DemoOcrField, DemoOcrResponse, DemoOcrStatus } from "@/lib/ocr/demo-contract";

type TurnstileApi = {
  render: (container: HTMLElement, options: {
    sitekey: string;
    action: string;
    size: "compact";
    language: string;
    callback: (token: string) => void;
    "expired-callback": () => void;
    "error-callback": () => void;
    "timeout-callback": () => void;
  }) => string;
  remove: (id: string) => void;
};

function turnstileApi() {
  return (window as Window & { turnstile?: TurnstileApi }).turnstile;
}

function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const api = turnstileApi();
    if (!ready || !api || !container.current) return;
    let active = true;
    const id = api.render(container.current, {
      sitekey: siteKey,
      action: "demo_ocr",
      size: "compact",
      language: "tr",
      callback: (token) => { if (active) { onToken(token); setError(undefined); } },
      "expired-callback": () => { if (active) { onToken(""); setError("Doğrulamanın süresi doldu; lütfen yeniden doğrulayın."); } },
      "error-callback": () => { if (active) { onToken(""); setError("Güvenlik doğrulaması tamamlanamadı. Bağlantınızı kontrol edip yeniden deneyin."); } },
      "timeout-callback": () => { if (active) { onToken(""); setError("Doğrulama zaman aşımına uğradı; lütfen yeniden doğrulayın."); } },
    });
    return () => { active = false; api.remove(id); };
  }, [ready, siteKey, onToken]);

  return (
    <div className="space-y-2">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
        onError={() => { onToken(""); setError("Güvenlik doğrulaması yüklenemedi. Bağlantınızı kontrol edip sayfayı yenileyin."); }}
      />
      <div ref={container} aria-label="Güvenlik doğrulaması" />
      {error && <p role="alert" className="text-xs text-destructive-strong">{error}</p>}
    </div>
  );
}

function RegisterCta() {
  return <Button asChild><Link href="/register">Hesap oluştur</Link></Button>;
}

export function DemoOcrUpload() {
  const [status, setStatus] = useState<DemoOcrStatus | null>(null);
  const [fields, setFields] = useState<DemoOcrField[] | null>(null);
  const [error, setError] = useState<string>();
  const [preview, setPreview] = useState<string>();
  const [processing, setProcessing] = useState(false);
  const [verificationRound, setVerificationRound] = useState(0);
  const previewRef = useRef<string | undefined>(undefined);
  const requestRef = useRef<AbortController | null>(null);
  const form = useForm<z.infer<typeof demoOcrSchema>>({
    resolver: zodResolver(demoOcrSchema),
    defaultValues: { consent: false, turnstileToken: "" },
  });
  const { setValue } = form;
  const onToken = useCallback((token: string) => {
    setValue("turnstileToken", token, { shouldValidate: true });
  }, [setValue]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/demo-ocr", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const nextStatus = await response.json() as DemoOcrStatus;
        if (!nextStatus || !["ready", "used", "limited", "unavailable"].includes(nextStatus.status)
          || (nextStatus.status === "ready" && !response.ok)) throw new Error("status");
        if (!controller.signal.aborted) setStatus(nextStatus);
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus({ status: "unavailable", message: "Ruhsat okuma demosuna şu anda ulaşılamıyor. Daha sonra yeniden deneyin." });
      });
    return () => {
      controller.abort();
      requestRef.current?.abort();
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const submit = async (values: z.infer<typeof demoOcrSchema>) => {
    if (processing || requestRef.current || status?.status !== "ready") return;
    const controller = new AbortController();
    requestRef.current = controller;
    setProcessing(true);
    setError(undefined);
    const body = new FormData();
    body.set("image", values.image);
    body.set("consent", "true");
    body.set("turnstileToken", values.turnstileToken);
    try {
      const response = await fetch("/api/demo-ocr", { method: "POST", body, signal: controller.signal });
      const result = await response.json() as DemoOcrResponse;
      if (controller.signal.aborted) return;
      if (result.success) {
        setFields(result.fields);
        setStatus({ status: "used" });
      } else {
        setError(result.error);
        if (result.code === "used" || result.code === "limited" || result.code === "unavailable") {
          setStatus({ status: result.code, message: result.error, retryAfterSeconds: result.retryAfterSeconds });
        }
      }
    } catch {
      if (!controller.signal.aborted) setError("İstek tamamlanamadı. Bağlantınızı kontrol edip yeniden deneyin.");
    } finally {
      if (!controller.signal.aborted) {
        requestRef.current = null;
        setProcessing(false);
        onToken("");
        setVerificationRound((round) => round + 1);
      }
    }
  };

  if (!status) return <p role="status" className="py-10 text-center text-sm text-muted-foreground">Deneme hakkınız kontrol ediliyor…</p>;

  if (status.status !== "ready" && !fields) {
    return (
      <div className="rounded-xl border bg-card p-6 sm:p-8 space-y-4">
        <h3 className="font-semibold">{status.status === "used" ? "Ücretsiz denemeniz tamamlandı" : status.status === "limited" ? "Deneme sınırına ulaşıldı" : "Ruhsat okuma şu anda kullanılamıyor"}</h3>
        <p role="status" className="text-sm text-muted-foreground">{status.message ?? "Ruhsat okuma deneyimine hesabınızla devam edebilirsiniz."}</p>
        {status.retryAfterSeconds && <p className="text-xs text-muted-foreground">Yaklaşık {Math.ceil(status.retryAfterSeconds / 60)} dakika sonra yeniden deneyebilirsiniz.</p>}
        <RegisterCta />
      </div>
    );
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-12">
      <div className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
        <h3 className="text-base font-semibold">Kendi ruhsatını dene</h3>
        <p className="mt-2 text-sm text-muted-foreground">Üyelik gerekmez. Tarayıcı başına bir başarılı deneme; aynı IP adresinden 24 saatte bir deneme yapılabilir.</p>
        {preview && <div className="relative mt-5 h-[360px] rounded-lg border bg-muted/50 sm:h-[440px]"><Image src={preview} alt="Seçtiğiniz ruhsat fotoğrafı" fill unoptimized className="object-contain p-3" /></div>}
        {!fields && (
          <Form {...form}>
            <form onSubmit={(event) => { void form.handleSubmit(submit)(event); }} className="mt-5 space-y-5">
              <FormField control={form.control} name="image" render={({ field: { onChange, value: _value, ...field } }) => (
                <FormItem>
                  <FormLabel>Ruhsat fotoğrafı</FormLabel>
                  <FormControl><Input {...field} type="file" accept="image/jpeg,image/png,image/webp" disabled={processing} onChange={(event) => {
                    const file = event.target.files?.[0];
                    onChange(file);
                    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
                    const validImage = file && demoOcrSchema.shape.image.safeParse(file).success;
                    previewRef.current = validImage ? URL.createObjectURL(file) : undefined;
                    setPreview(previewRef.current);
                    void form.trigger("image");
                  }} /></FormControl>
                  <FormDescription>JPEG, PNG veya WebP · En fazla 8 MB. Yalnızca paylaşma yetkiniz olan bir belgeyi seçin.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="consent" render={({ field }) => (
                <FormItem>
                  <div className="flex items-start gap-3">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} disabled={processing} /></FormControl>
                    <FormLabel className="text-xs leading-relaxed font-normal">Fotoğrafın ruhsat okuma işlemi için harici bir okuma hizmetine gönderileceğini; BakımX tarafından yalnızca okuma amacıyla kullanılacağını, fotoğraf ve sonuçların BakımX&apos;te saklanmayacağını anladım.</FormLabel>
                  </div>
                  <FormDescription><Link href="/privacy" className="underline underline-offset-4">Gizlilik politikası</Link></FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              {status.siteKey ? <FormField control={form.control} name="turnstileToken" render={() => (
                <FormItem>
                  <Turnstile key={verificationRound} siteKey={status.siteKey!} onToken={onToken} />
                  <FormMessage />
                </FormItem>
              )} /> : <Alert><AlertDescription>Güvenlik doğrulaması şu anda kullanılamıyor.</AlertDescription></Alert>}
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
              <Button type="submit" disabled={processing || !status.siteKey} className="w-full gap-2">
                {processing ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : <ScanLine className="size-4" />}
                {processing ? "Ruhsat okunuyor…" : "Ruhsatımı oku"}
              </Button>
              {processing && <p role="status" className="text-xs text-muted-foreground">Fotoğrafınız okunuyor. Bu işlem birkaç saniye sürebilir.</p>}
            </form>
          </Form>
        )}
      </div>
      <div className="rounded-xl border bg-card p-5 shadow-sm sm:p-6" aria-live="polite" aria-busy={processing}>
        <h3 className="text-base font-semibold">{fields ? "Ruhsatınızdan okunan bilgiler" : "Okuma sonucu"}</h3>
        {fields ? <>
          <p className="mt-2 text-xs text-muted-foreground">Okunan bilgileri ruhsatınızla karşılaştırın. Sonuçlar otomatik kaydedilmez.</p>
          <dl className="mt-5 grid grid-cols-2 gap-2">
            {fields.map((field) => <div key={field.key} className="min-w-0 rounded-lg border bg-muted/40 p-3">
              <dt className="text-xs text-muted-foreground">{field.label}{field.code ? ` (${field.code})` : ""}</dt>
              <dd className="mt-1 break-words text-sm font-medium">{field.value}</dd>
              {field.confidence !== undefined && field.confidence < 0.7 && <dd className="mt-1 text-xs text-warning-strong">Düşük güven · Ruhsattan kontrol edin</dd>}
            </div>)}
          </dl>
          <div className="mt-6 space-y-3 border-t pt-5"><p className="text-sm text-muted-foreground">Ücretsiz denemeniz tamamlandı. Devam etmek için hesabınızı oluşturun.</p><RegisterCta /></div>
        </> : <p className="py-12 text-sm text-muted-foreground">Fotoğrafınızı seçip okumayı başlatın. Yalnızca belgenizden okunabilen bilgiler burada gösterilir.</p>}
      </div>
    </div>
  );
}
