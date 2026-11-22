import { Reveal } from "@/components/shared/reveal"
import { FeatureTile } from "../kit/feature-tile"
import { Wordmark } from "../kit/wordmark"
import { FEATURE_TILES, FEATURES } from "./content"
import { FeatureIcon } from "./feature-icons"
import styles from "./landing.module.css"

/** "BakımX diğer özellikleri" — gri kutular (e-santral `.tiles`). */
export function Features() {
  return (
    <section id="ozellikler" className={styles.sec} aria-labelledby="ozellikler-t">
      <div className={styles.wrap}>
        <h2 id="ozellikler-t" className={styles.title}>
          <Wordmark variant="inline" /> {FEATURES.titleAfterMark}
        </h2>
        <div className={styles.tiles}>
          {FEATURE_TILES.map((tile) => (
            <Reveal key={tile.title}>
              <FeatureTile icon={<FeatureIcon name={tile.icon} />} title={tile.title}>
                {tile.text}
              </FeatureTile>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
