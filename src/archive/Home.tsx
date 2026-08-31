import { Starfield } from "../components/Starfield";
import { ExperiencePreview } from "../components/ExperiencePreview";
import { Wordmark } from "../components/Logo";
import { experiences, featuredIds } from "../data/experiences";
import { categories } from "../data/categories";
import styles from "./Home.module.css";

export function Home() {
  const featured = featuredIds
    .map((id) => experiences.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e));

  const featuredSet = new Set(featuredIds);
  const availableCount = experiences.filter((e) => e.status === "available").length;

  return (
    <div className={styles.page}>
      <div className={styles.starfield}>
        <Starfield />
      </div>

      <div className={styles.content}>
        <header className={styles.hero}>
          <span className={styles.eyebrow}>
            {experiences.length} worlds catalogued · {availableCount} open now
          </span>
          <Wordmark />
          <p className={styles.philosophy}>Small idea. Complete wonder.</p>
        </header>

        <section className={styles.section} aria-labelledby="featured-heading">
          <div className={styles.sectionHead}>
            <h2 id="featured-heading" className={styles.sectionTitle}>
              Featured
            </h2>
            <span className={styles.sectionNote}>{featured.length} worlds</span>
          </div>
          <div className={styles.grid}>
            {featured.map((exp, i) => (
              <div key={exp.id} className={i === 0 ? styles.spanLg : undefined}>
                <ExperiencePreview experience={exp} size={i === 0 ? "lg" : "md"} />
              </div>
            ))}
          </div>
        </section>

        {categories.map((cat) => {
          const inCategory = experiences.filter(
            (e) => e.category === cat.id && !featuredSet.has(e.id),
          );
          if (inCategory.length === 0) return null;
          return (
            <section key={cat.id} className={styles.section} aria-labelledby={`${cat.id}-heading`}>
              <div className={styles.sectionHead}>
                <h2 id={`${cat.id}-heading`} className={styles.sectionTitle}>
                  {cat.label}
                </h2>
                <span className={styles.sectionNote}>{cat.description}</span>
              </div>
              <div className={styles.grid}>
                {inCategory.map((exp) => (
                  <ExperiencePreview key={exp.id} experience={exp} size="sm" />
                ))}
              </div>
            </section>
          );
        })}

        <footer className={styles.footer}>
          Mirari — from the Latin for wonder, marvel, astonishment.
        </footer>
      </div>
    </div>
  );
}
