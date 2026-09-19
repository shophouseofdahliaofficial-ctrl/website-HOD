import AuthBackground from '@/components/AuthBackground';

const BG_IMAGES = [
  'https://plus.unsplash.com/premium_photo-1771772686698-63ddd4ad1fb0?q=80&w=378&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'https://plus.unsplash.com/premium_photo-1772375004476-d75916615a44?q=80&w=893&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'https://plus.unsplash.com/premium_photo-1770914038395-1c0ee5787834?q=80&w=875&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'https://plus.unsplash.com/premium_photo-1771673064534-49cd2af4b7c5?q=80&w=824&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {BG_IMAGES.map((src) => (
        <link key={src} rel="preload" href={src} as="image" />
      ))}
      <AuthBackground />
      {children}
    </>
  );
}
