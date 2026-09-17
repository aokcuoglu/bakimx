"use client";
import styles from "./demo-request.module.css";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { HeroLeadForm } from "@/components/sections/HeroLeadForm";
import { trackMarketingEvent } from "@/lib/marketing-analytics";

export function DemoRequestButton({
  location = "public_page",
  onClick,
}: {
  location?: string;
  onClick?: () => void;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="xl"
          className="h-12 px-6"
          onClick={() => {
            if (onClick) onClick();
            else
              trackMarketingEvent("demo_cta_click", {
                cta_location: location,
                destination: "form",
              });
          }}
        >
          Birlikte inceleyelim
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className={`${styles.dialog} gap-7 rounded-xl bg-background p-6 sm:max-w-[640px] sm:p-10`}
        data-public-demo
      >
        <DialogClose asChild>
          <Button
            variant="outline"
            size="icon"
            className="absolute right-5 top-5 rounded-xl"
            aria-label="Kapat"
          >
            <X />
          </Button>
        </DialogClose>
        <DialogHeader className="pr-10">
          <DialogTitle className="text-3xl font-semibold leading-tight tracking-tight">
            Servisinizi tanıyalım.
          </DialogTitle>
          <DialogDescription className="text-base leading-6">
            Bilgilerinizi bırakın, sizin için nasıl çalışacağını birlikte
            inceleyelim.
          </DialogDescription>
        </DialogHeader>
        <HeroLeadForm showNotes />
      </DialogContent>
    </Dialog>
  );
}
