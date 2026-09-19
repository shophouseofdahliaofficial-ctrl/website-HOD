import TrialPackPageClient from '@/app/get-trial-pack/TrialPackPageClient';
import { SITE_NAME } from '@/lib/seo';

export const metadata = {
  title: `Trial Steps | ${SITE_NAME}`,
  description: 'Choose products, confirm address, and start your trial.',
};

export default function TrialStepsPage() {
  return <TrialPackPageClient stepsOnly />;
}
