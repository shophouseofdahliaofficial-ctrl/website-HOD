import CustomerAuthWrapper from './CustomerAuthWrapper';

/**
 * Customer Layout
 * Wraps all customer routes with navigation and auth protection
 */
export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <CustomerAuthWrapper>{children}</CustomerAuthWrapper>;
}

