"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import {
  Check,
  ClipboardList,
  LayoutDashboard,
  PackageSearch,
  ScanLine,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MacWindow, type MacWindowApi } from "@/components/sections/mac-window";
import { WorkflowDemoPanel } from "@/components/sections/WorkflowDemoSection";
import { MockAppDemo } from "@/components/sections/mock-app-demo";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import styles from "./landing-editorial.module.css";

const WINDOW_IDS = ["dashboard", "order", "parts", "workflow"] as const;
type WindowId = (typeof WINDOW_IDS)[number];

const BASE_Z: Record<WindowId, number> = {
  dashboard: 1,
  order: 3,
  parts: 2,
  workflow: 4,
};

function subscribeMobile(cb: () => void) {
  const mql = window.matchMedia("(max-width: 640px)");
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}

function useIsMobileStage() {
  return useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia("(max-width: 640px)").matches,
    () => false,
  );
}

export function ProductStage() {
  const reducedMotion = usePrefersReducedMotion();
  const isMobile = useIsMobileStage();
  const [zMap, setZMap] = useState<Record<WindowId, number>>(() => ({ ...BASE_Z }));
  const [closedMap, setClosedMap] = useState<Partial<Record<WindowId, boolean>>>({});
  const apis = useRef<Partial<Record<WindowId, MacWindowApi>>>({});

  const focusWindow = useCallback((id: string) => {
    const wid = id as WindowId;
    setZMap((prev) => {
      const nextZ = Math.max(...Object.values(prev), 10) + 1;
      return { ...prev, [wid]: nextZ };
    });
  }, []);

  const registerApi = useCallback((api: MacWindowApi) => {
    apis.current[api.id as WindowId] = api;
    setClosedMap((prev) => {
      const wid = api.id as WindowId;
      if (prev[wid] === api.closed) return prev;
      return { ...prev, [wid]: api.closed };
    });
  }, []);

  const stageWindowIds = isMobile
    ? (["dashboard"] as const)
    : WINDOW_IDS;
  const closedIds = stageWindowIds.filter((id) => closedMap[id]);

  const resetWindows = () => {
    for (const id of stageWindowIds) apis.current[id]?.restore();
    setZMap({ ...BASE_Z });
    setClosedMap({});
  };

  const draggable = !isMobile && !reducedMotion;

  return (
    <section
      id="ozellikler"
      aria-label="BakımX ürün gösterimi"
      className={styles.productSection}
      data-stage-layout={isMobile ? "mobile" : "desktop"}
    >
      <div className={styles.stage}>
        <div className={styles.stageGlow} aria-hidden />
        <div className={styles.stageGrid} aria-hidden />

        <MacWindow
          id="dashboard"
          title="BakımX · Servis yönetimi"
          className={styles.mainWindow}
          zIndex={zMap.dashboard}
          onFocus={focusWindow}
          onApi={registerApi}
          draggable={draggable}
        >
          <MockAppDemo />
        </MacWindow>

        {/* Attio mobil deseni: dar ekranda yalnızca etkileşimli dashboard.
            Uydu pencereler masaüstünde kalır; CSS de SSR/no-JS için gizler. */}
        {!isMobile && (
          <>
            <MacWindow
              id="order"
              title="İş emri #1024"
              className={styles.orderWindow}
              zIndex={zMap.order}
              onFocus={focusWindow}
              onApi={registerApi}
              draggable={draggable}
            >
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
                  <span className={styles.readyDot} role="img" aria-label="İşlemde" />
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
            </MacWindow>

            <MacWindow
              id="parts"
              title="Şaseden parça bulma"
              className={styles.partsWindow}
              zIndex={zMap.parts}
              onFocus={focusWindow}
              onApi={registerApi}
              draggable={draggable}
            >
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
            </MacWindow>

            <MacWindow
              id="workflow"
              title="Ruhsattan parçaya · canlı akış"
              className={styles.workflowWindow}
              zIndex={zMap.workflow}
              onFocus={focusWindow}
              onApi={registerApi}
              draggable={draggable}
            >
              <WorkflowDemoPanel compact />
            </MacWindow>
          </>
        )}
      </div>

      <div className={styles.stageActions}>
        <p className={styles.sampleNote}>
          <span className={styles.sampleNoteDesktop}>
            Ürün akışının örnek gösterimi. Ana pencerede Genel Bakış → İş Emirleri
            → Yeni İş Emri turu otomatik oynar; menüye tıklayınca siz de
            gezebilirsiniz. Diğer pencereleri sürükleyip büyütüp
            küçültebilirsiniz. Veriler demoya aittir.
          </span>
          <span className={styles.sampleNoteMobile}>
            Örnek panelde Genel Bakış → İş Emirleri → Yeni İş Emri turu otomatik
            oynar; menüye dokununca siz de gezebilirsiniz. Veriler demoya aittir.
          </span>
        </p>
        {closedIds.length > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={resetWindows}>
            {isMobile ? "Paneli geri getir" : `Pencereleri geri getir (${closedIds.length})`}
          </Button>
        )}
      </div>

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
              ScanLine,
              "Ruhsattan doğru parçaya.",
              "Ruhsatı okutun, iş emrini açın, araca özel parçaları listeleyin ve seçin.",
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
