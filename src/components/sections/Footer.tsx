"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Reveal } from "@/components/shared/reveal";
import { CookiePreferencesButton } from "@/components/cookie-consent/cookie-preferences-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ArrowRight } from "lucide-react";
import styles from "./footer.module.css";
import { EmailAddress } from "@/components/shared/email-address"

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function LinkedinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const socialLinks = [
  {
    label: "BakımX LinkedIn sayfası",
    href: "https://www.linkedin.com/company/bakimx/",
    icon: LinkedinIcon,
  },
  {
    label: "BakımX Instagram sayfası",
    href: "https://www.instagram.com/bakimxcom",
    icon: InstagramIcon,
  },
  {
    label: "BakımX X (Twitter) hesabı",
    href: "https://x.com/bakimxcom",
    icon: XIcon,
  },
] as const;

type FooterLink = { label: string; href: string };

type SolutionGroup = {
  title: string;
  links: readonly FooterLink[];
};

const solutionGroups: readonly SolutionGroup[] = [
  {
    title: "Oto servis programı",
    links: [
      { label: "Oto Servis Programı", href: "/oto-servis-programi" },
      { label: "Fiyatlar", href: "/fiyatlar" },
      { label: "Özellikler", href: "/#ozellikler" },
    ],
  },
  {
    title: "Dijital araç kabul",
    links: [{ label: "Dijital Araç Kabul", href: "/dijital-arac-kabul" }],
  },
  {
    title: "İş emri yönetimi",
    links: [
      { label: "İş Emri Programı", href: "/is-emri-programi" },
      {
        label: "Defter, Excel ve Program",
        href: "/karsilastir/defter-excel-oto-servis-programi",
      },
    ],
  },
] as const;

const companyLinks: readonly FooterLink[] = [
  { label: "Demo Talep Et", href: "/demo" },
  { label: "Ücretsiz Dene", href: "/register" },
  { label: "İletişim", href: "/contact-us" },
  { label: "Sistem Durumu", href: "/status" },
] as const;

const resourceLinks: readonly FooterLink[] = [
  { label: "Blog", href: "/blog" },
  { label: "Neden BakımX", href: "/#neden" },
  { label: "SSS", href: "/#sss" },
  { label: "Kullanım Kılavuzu", href: "/kilavuz" },
  { label: "Araç Kabul Formu Rehberi", href: "/rehber/arac-kabul-formu" },
  {
    label: "İş Emri Rehberi",
    href: "/rehber/oto-servis-is-emri-nasil-hazirlanir",
  },
] as const;

const legalLinks: readonly FooterLink[] = [
  { label: "Kullanım Koşulları", href: "/terms" },
  { label: "KVKK Aydınlatma Metni", href: "/kvkk" },
  { label: "Açık Rıza Metni", href: "/acik-riza" },
  { label: "Gizlilik ve Çerez Politikası", href: "/privacy" },
] as const;

function FooterNavLink({ href, label }: FooterLink) {
  if (href.startsWith("http")) {
    return (
      <a
        href={href}
        className={styles.link}
        target="_blank"
        rel="noopener noreferrer"
      >
        {label}
      </a>
    );
  }
  return (
    <Link href={href} className={styles.link}>
      {label}
    </Link>
  );
}

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.contactBand}>
          <Reveal amount={0.15} className={styles.contactBrand}>
            <Link
              href="/"
              aria-label="BakımX ana sayfa"
              className={styles.brandLink}
            >
              <BrandLogo variant="primary-light" height={40} alt="" />
              <span className={styles.brandName}>
                Bakım<span className={styles.brandAccent}>X</span>
              </span>
            </Link>
            <div className={styles.contactPitch}>
              <p className={styles.tagline}>
                Serviste işler yolunda.<br />
                Kontrol sizde.
              </p>
              <Button asChild variant="outline" size="xl" className={styles.demoButton}>
                <Link href="/demo">
                  Demo talep et <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </div>
            <div className={styles.socialRow}>
              {socialLinks.map(({ label, href, icon: Icon }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className={styles.socialLink}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </a>
              ))}
            </div>
          </Reveal>

          <Reveal amount={0.15} delay={80} className={styles.updatesBlock}>
            <h2 className={styles.updatesTitle}>Yeniliklerden haberdar olun</h2>
            <form className={styles.signupForm} action="/contact-us" method="get">
              <label className="sr-only" htmlFor="footer-email">E-posta adresiniz</label>
              <Input
                id="footer-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="E-posta adresiniz"
                required
                className={styles.emailInput}
              />
              <Button type="submit" variant="ghost" size="xl" className={styles.signupButton}>
                Abone ol <ArrowRight aria-hidden="true" />
              </Button>
            </form>
            <div className={styles.consentRow}>
              <Checkbox id="footer-consent" name="consent" required aria-label="Güncelleme e-postaları için onay" />
              <p className={styles.consentText}>
                <Link href="/privacy">Gizlilik Politikası</Link>’nı okuduğumu ve adım ile e-posta adresimin
                pazarlama iletişimi, promosyon ve güncellemeler göndermek amacıyla toplanıp kullanılacağını
                onaylıyorum. İznimi dilediğim zaman abonelikten çıkarak veya{" "}
                <EmailAddress address="hey@bakimx.com" link={false} /> üzerinden
                iletişime geçerek geri çekebilirim.
              </p>
            </div>
          </Reveal>
        </div>

        <div className={styles.menuGrid}>
          <Reveal amount={0.15} delay={80}>
            <h3 className={styles.columnTitle}>Çözümler</h3>
            <ul className={styles.linkList}>
              {solutionGroups.flatMap((group) =>
                group.links.map((link) => (
                  <li key={`${group.title}-${link.href}-${link.label}`}>
                    <FooterNavLink {...link} />
                  </li>
                )),
              )}
            </ul>
          </Reveal>

          <Reveal amount={0.15} delay={120}>
            <h3 className={styles.columnTitle}>Şirket</h3>
            <ul className={styles.linkList}>
              {companyLinks.map((link) => (
                <li key={`${link.href}-${link.label}`}>
                  <FooterNavLink {...link} />
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal amount={0.15} delay={160}>
            <h3 className={styles.columnTitle}>Kaynaklar</h3>
            <ul className={styles.linkList}>
              {resourceLinks.map((link) => (
                <li key={`${link.href}-${link.label}`}>
                  <FooterNavLink {...link} />
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal amount={0.15} delay={200}>
            <h3 className={styles.columnTitle}>Yasal</h3>
            <ul className={styles.linkList}>
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <FooterNavLink {...link} />
                </li>
              ))}
              <li>
                <CookiePreferencesButton className={`${styles.link} ${styles.cookieButton} h-auto rounded-none`} />
              </li>
            </ul>
          </Reveal>
        </div>

        <div className={styles.bottomBar}>
          <p>&copy; {currentYear} BakımX. Tüm hakları saklıdır.</p>
          <div className={styles.bottomMeta}>
            <Link href="/status" className={styles.link}>
              Sistem durumu
            </Link>
            <span>v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
          </div>
        </div>
      </div>

      <div className={styles.watermark} aria-hidden="true">
        <span className={styles.watermarkText}>BakımX</span>
      </div>
    </footer>
  );
}
