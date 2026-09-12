"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  PackageSearch,
  Search,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import styles from "./landing-editorial.module.css";

function WindowBar({ title }: { title: string }) {
  return (
    <div className={styles.windowBar}>
      <span className={styles.windowDots} aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <span>{title}</span>
      <span className={styles.windowIcon} aria-hidden>
        ↗
      </span>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className={styles.dashboard}>
      <aside className={styles.sidebar} aria-hidden="true">
        <div className={styles.appLogo}>
          bakım<span>x</span>
          <ChevronDown size={12} />
        </div>
        <p className={styles.workspace}>Örnek servis</p>
        {[
          [LayoutDashboard, "Genel bakış"],
          [ClipboardList, "İş emirleri"],
          [Users, "Müşteriler"],
          [Wrench, "Araçlar"],
          [PackageSearch, "Stok / Parçalar"],
          [Wallet, "Kasa"],
          [CalendarDays, "Randevular"],
        ].map(([Icon, label], index) => {
          const ItemIcon = Icon as typeof LayoutDashboard;
          return (
            <div
              key={String(label)}
              className={index === 0 ? styles.navSelected : styles.navItem}
            >
              <ItemIcon size={15} />
              {String(label)}
            </div>
          );
        })}
        <div className={styles.sidebarBottom}>
          <span className={styles.avatar}>AS</span>
          <span>
            Atlas Servis<small>Örnek çalışma alanı</small>
          </span>
        </div>
      </aside>
      <div className={styles.dashboardBody}>
        <div className={styles.breadcrumb}>
          Çalışma alanı <span>/</span> Genel bakış <Search size={14} />
        </div>
        <div className={styles.dashboardHeading}>
          <div>
            <p>HER ŞEY YOLUNDA</p>
            <h3>Serviste bugün</h3>
          </div>
          <span>
            Günlük özet <ChevronDown size={12} />
          </span>
        </div>
        <div className={styles.kpis}>
          {[
            ["Aktif iş emri", "12", "4 araç teslimata hazır"],
            ["Bugünkü randevu", "8", "Sıradaki araç 14.30’da"],
            ["Bugünkü tahsilat", "₺24.850", "Kasa hareketleri güncel"],
          ].map(([label, value, detail]) => (
            <div key={label}>
              <p>{label}</p>
              <strong>{value}</strong>
              <small>{detail}</small>
            </div>
          ))}
        </div>
        <div className={styles.orderTable}>
          <div className={styles.tableHeading}>
            <h4>Aktif iş emirleri</h4>
            <span>
              Tümünü gör <ArrowUpRight size={12} />
            </span>
          </div>
          <table>
            <caption className="sr-only">
              Örnek servisin aktif iş emirleri
            </caption>
            <thead>
              <tr>
                <th>Araç / Müşteri</th>
                <th>İşlem</th>
                <th>Durum</th>
                <th>Tutar</th>
              </tr>
            </thead>
            <tbody>
              {[
                [
                  "34 ABC 123",
                  "Ahmet Yılmaz",
                  "Periyodik bakım",
                  "İşlemde",
                  "₺6.450",
                ],
                [
                  "34 DEF 456",
                  "Elif Demir",
                  "Fren bakımı",
                  "Onay bekliyor",
                  "₺4.200",
                ],
                [
                  "34 GHI 789",
                  "Mehmet Kaya",
                  "Yağ değişimi",
                  "Teslime hazır",
                  "₺2.850",
                ],
              ].map(([plate, name, job, status, price], index) => (
                <tr key={plate}>
                  <td>
                    <strong>{plate}</strong>
                    <small>{name}</small>
                  </td>
                  <td>{job}</td>
                  <td>
                    <span className={styles.status}>
                      <i data-status={index} />
                      {status}
                    </span>
                  </td>
                  <td>{price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.bottomCards}>
          <div>
            <span>Haftalık iş akışı</span>
            <div className={styles.bars} aria-hidden>
              {[36, 65, 48, 90, 73, 55, 24].map((height, index) => (
                <i key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
            <div className={styles.days}>
              <span>Pzt</span>
              <span>Sal</span>
              <span>Çar</span>
              <span>Per</span>
              <span>Cum</span>
              <span>Cmt</span>
              <span>Paz</span>
            </div>
          </div>
          <div>
            <span>Sıradaki randevu</span>
            <strong>
              14.30 <span>·</span> Araç kabul
            </strong>
            <p>34 JKL 012 · Volkswagen Golf</p>
            <small>Periyodik bakım</small>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProductStage() {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "center center"],
  });
  const mainY = useTransform(scrollYProgress, [0, 1], [140, 0]);
  const mainScale = useTransform(scrollYProgress, [0, 1], [0.92, 1]);
  const leftY = useTransform(scrollYProgress, [0, 1], [240, -12]);
  const rightY = useTransform(scrollYProgress, [0, 1], [280, 12]);
  return (
    <section
      id="ozellikler"
      aria-label="BakımX ürün gösterimi"
      className={styles.productSection}
    >
      <div ref={ref} className={styles.stage}>
        <div className={styles.stageGlow} aria-hidden />
        <div className={styles.stageGrid} aria-hidden />
        <motion.div
          initial={false}
          style={reducedMotion ? undefined : { y: mainY, scale: mainScale }}
          className={styles.mainWindow}
          data-product-window="dashboard"
        >
          <WindowBar title="BakımX · Servis yönetimi" />
          <DashboardPreview />
        </motion.div>
        <motion.div
          initial={false}
          style={reducedMotion ? undefined : { y: leftY }}
          className={styles.orderWindow}
          data-product-window="order"
        >
          <WindowBar title="İş emri #1024" />
          <div className={styles.orderCard}>
            <p className={styles.smallLabel}>ARAÇ KABULDEN TESLİMATA</p>
            <h3>Her işlem aynı kayıtta.</h3>
            <div className={styles.vehicle}>
              <span>
                <Wrench size={19} />
              </span>
              <div>
                <strong>34 ABC 123</strong>
                <p>Ford Transit · Periyodik bakım</p>
              </div>
              <span
                className={styles.readyDot}
                role="img"
                aria-label="İşlemde"
              />
            </div>
            <div className={styles.jobLine}>
              <Check size={14} />
              <span>Motor yağı ve filtre değişimi</span>
            </div>
            <div className={styles.jobLine}>
              <Check size={14} />
              <span>Fren sistemi kontrolü</span>
            </div>
            <div className={styles.orderTotal}>
              <span>İş emri toplamı</span>
              <strong>₺6.450</strong>
            </div>
          </div>
        </motion.div>
        <motion.div
          initial={false}
          style={reducedMotion ? undefined : { y: rightY }}
          className={styles.partsWindow}
          data-product-window="parts"
        >
          <WindowBar title="Şaseden parça bulma" />
          <div className={styles.partsHeading}>
            <PackageSearch size={18} />
            <div>
              <h3>Doğru araç. Doğru parça.</h3>
              <p>Şaseyle tanınan araç için katalog sonuçları</p>
            </div>
          </div>
          <div className={styles.partsImage}>
            <Image
              src="/landing/screens/parts-catalog.png"
              alt="Araçla ilişkili katalogda yağ filtresi sonuçlarının örnek görünümü"
              width={1440}
              height={900}
              sizes="1000px"
              className={styles.catalogCrop}
            />
          </div>
        </motion.div>
      </div>
      <p className={styles.sampleNote}>
        Ürün akışının örnek gösterimi. Servis, araç ve tutar bilgileri demo
        verisidir.
      </p>
      <div className={styles.productSummary}>
        <p className={styles.sectionLabel}>DAHA AZ TAKİP. DAHA ÇOK İŞ.</p>
        <h2>
          Servisinizin her adımı,
          <br />
          <span>birbirine bağlı.</span>
        </h2>
        <div className={styles.featureRow}>
          {[
            [
              LayoutDashboard,
              "Günün tamamını görün.",
              "İş emirleri, randevular ve tahsilatlar. Serviste ne olduğunu tek bakışta bilin.",
            ],
            [
              ClipboardList,
              "İşi baştan sona yönetin.",
              "Müşteri talebi, parça, işçilik ve onaylar. Her aracın hikâyesi aynı kayıtta kalsın.",
            ],
            [
              PackageSearch,
              "Parçaya araçtan ulaşın.",
              "Şaseyle aracı tanıyın, katalog sonuçlarını inceleyin ve parçayı iş emrine ekleyin.",
            ],
          ].map(([Icon, title, description]) => {
            const FeatureIcon = Icon as typeof LayoutDashboard;
            return (
              <div key={String(title)}>
                <FeatureIcon size={20} />
                <h3>{String(title)}</h3>
                <p>{String(description)}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
