'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styles from './about.module.css';

export default function AboutPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Trigger entrance animation on mount
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 60);

    // Scroll reveal observer for elements further down
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.visible);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    const elements = containerRef.current?.querySelectorAll(`.${styles.fadeElement}`);
    elements?.forEach((el) => observer.observe(el));

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  return (
    <main ref={containerRef} className={styles.container}>
      <header className={styles.header}>
        <div className={`${styles.fadeElement} ${styles.delay0} ${isLoaded ? styles.visible : ''}`}>
          <span className={styles.taglineBadge}>Our Story</span>
        </div>
        <h1 className={`${styles.title} ${styles.fadeElement} ${styles.delay1} ${isLoaded ? styles.visible : ''}`}>
          For the girls who find magic in little moments.
        </h1>
      </header>

      <article className={styles.storyBody}>
        <p className={`${styles.leadParagraph} ${styles.fadeElement} ${styles.delay2} ${isLoaded ? styles.visible : ''}`}>
          House of Dahlia was born from a love for pretty things, slow evenings, dressing up for no particular reason, and the feeling you get when you put on something that just feels like you.
        </p>

        <p className={`${styles.paragraph} ${styles.fadeElement} ${styles.delay3} ${isLoaded ? styles.visible : ''}`}>
          We create dresses for the moments that deserve a little extra magic — a golden-hour dinner, a Sunday brunch, a night by the sea, a date with someone special, or simply a day when you feel like being your prettiest self.
        </p>

        <p className={`${styles.paragraph} ${styles.fadeElement} ${styles.delay4} ${isLoaded ? styles.visible : ''}`}>
          Every piece is imagined with a little romance and made with a lot of love. From the silhouette and fabric to the tiniest detail, we want each dress to feel special when you wear it.
        </p>

        <p className={`${styles.paragraph} ${styles.fadeElement} ${styles.delay5} ${isLoaded ? styles.visible : ''}`}>
          Because we don’t believe clothes are just clothes.
        </p>

        <div className={`${styles.quoteBlock} ${styles.fadeElement} ${styles.delay6} ${isLoaded ? styles.visible : ''}`}>
          <span className={styles.quoteLine}>Sometimes, a dress becomes the one you wore when you met someone.</span>
          <span className={styles.quoteLine}>The one you danced in until midnight.</span>
          <span className={styles.quoteLine}>The one you wore on your favourite holiday.</span>
          <span className={styles.quoteLine}>The one that made you look in the mirror and think, “Oh… I love this.”</span>
        </div>

        <p className={`${styles.paragraph} ${styles.fadeElement} ${styles.delay7} ${isLoaded ? styles.visible : ''}`}>
          House of Dahlia is for those moments.
        </p>

        <div className={`${styles.dreamyClosing} ${styles.fadeElement} ${styles.delay8} ${isLoaded ? styles.visible : ''}`}>
          <p className={styles.dreamyText}>
            A little dreamy. A little feminine.<br />
            And always, made with love.
          </p>
          <h2 className={styles.welcomeHeading}>Welcome to House of Dahlia. 🌸</h2>
        </div>
      </article>

      <div className={`${styles.actionRow} ${styles.fadeElement} ${styles.delay9} ${isLoaded ? styles.visible : ''}`}>
        <Link href="/products" className={styles.shopButton}>
          Explore Collection
        </Link>
      </div>
    </main>
  );
}
