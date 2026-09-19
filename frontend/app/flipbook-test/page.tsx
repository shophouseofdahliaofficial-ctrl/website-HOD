import ProductDigitalFlipbook from '@/components/product/ProductDigitalFlipbook';

const mockFlipbook = {
  enabled: true,
  sections: [
    {
      id: 's1',
      title: 'Chapter One',
      imageUrls: [
        'https://picsum.photos/seed/flower-a/520/700',
        'https://picsum.photos/seed/flower-b/520/700',
        'https://picsum.photos/seed/flower-c/520/700',
        'https://picsum.photos/seed/flower-d/520/700',
        // Narrow portrait document — much narrower than the page cell when height-filled
        'https://picsum.photos/seed/narrow-doc/260/700',
        'https://picsum.photos/seed/wide-land/900/500',
      ],
    },
  ],
};

export default function FlipbookTestPage() {
  return (
    <main style={{ padding: '2rem 1rem' }}>
      <ProductDigitalFlipbook flipbook={mockFlipbook} />
    </main>
  );
}
