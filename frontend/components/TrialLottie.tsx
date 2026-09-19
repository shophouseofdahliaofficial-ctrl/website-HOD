'use client';

import React from 'react';
import { DotLottiePlayer } from '@dotlottie/react-player';
import styles from '@/app/get-trial-pack/page.module.css';

export default function TrialLottie() {
  const lottieUrl = "/animations/trial.lottie";

  return (
    <div className={styles.lottieContainer}>
      <div className={styles.lottieRow}>
        <DotLottiePlayer
          autoplay
          loop
          src={lottieUrl}
          speed={0.5}
          className={`${styles.lottiePlayer} ${styles.lottieLeft}`}
        />
        <DotLottiePlayer
          autoplay
          loop
          src={lottieUrl}
          speed={0.5}
          className={`${styles.lottiePlayer} ${styles.lottieRight}`}
        />
      </div>
    </div>
  );
}
