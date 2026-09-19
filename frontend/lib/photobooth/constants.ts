export type PhotoboothPhoto = {
  id: string;
  src: string;
  alt: string;
  caption?: string;
  label?: string;
};

/** Main Foreground scrapbook photos - matches the uploaded screenshot */
export const ORBIT_PHOTOS: PhotoboothPhoto[] = [
  {
    id: 'o4',
    src: 'https://images.unsplash.com/photo-1616422285623-13ff0162193c?w=600&q=80',
    alt: 'Mirror outfit selfie',
    label: '[ 04 ]',
  },
  {
    id: 'o3',
    src: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&q=80',
    alt: 'B&W portrait of girl sitting',
    label: '[ 03 ]',
  },
  {
    id: 'o2',
    src: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=600&q=80',
    alt: 'Resort balconies at sunset',
    label: '[ 02 ]',
  },
  {
    id: 'o1',
    src: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&q=80',
    alt: 'Young girl with glasses portrait',
    label: '[ 01 ]',
  },
  {
    id: 'o8',
    src: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=600&q=80',
    alt: 'Iced coffee and mobile phone',
    label: '[ 08 ]',
  },
  {
    id: 'o7',
    src: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80',
    alt: 'White building and palm trees',
    label: '[ 07 ]',
  },
  {
    id: 'o6',
    src: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600&q=80',
    alt: 'B&W couple selfie',
    label: '[ 06 ]',
  },
  {
    id: 'o5',
    src: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=600&q=80',
    alt: 'Cozy road trip couple',
    label: '[ 05 ]',
  },
  {
    id: 'o9',
    src: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80',
    alt: 'Model in yellow dress',
    label: '[ 09 ]',
  },
  {
    id: 'o10',
    src: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=600&q=80',
    alt: 'Fashion portrait styling',
    label: '[ 10 ]',
  },
  {
    id: 'o11',
    src: 'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?w=600&q=80',
    alt: 'Girl holding phone in city',
    label: '[ 11 ]',
  },
  {
    id: 'o12',
    src: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=600&q=80',
    alt: 'Elegant portrait outdoor',
    label: '[ 12 ]',
  },
  {
    id: 'o13',
    src: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80',
    alt: 'Close up portrait of girl',
    label: '[ 13 ]',
  },
  {
    id: 'o14',
    src: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&q=80',
    alt: 'Man portrait studio style',
    label: '[ 14 ]',
  },
  {
    id: 'o15',
    src: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&q=80',
    alt: 'Girl sitting in the sun',
    label: '[ 15 ]',
  },
  {
    id: 'o16',
    src: 'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=600&q=80',
    alt: 'Vintage girl polaroid style',
    label: '[ 16 ]',
  },
];

/** Background scrapbook photos - rotates in a concentric loop behind the main loop */
export const BACKGROUND_PHOTOS: PhotoboothPhoto[] = [
  {
    id: 'bg1',
    src: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=500&q=80',
    alt: 'Scenic mountain lake',
    label: '[ 17 ]',
  },
  {
    id: 'bg2',
    src: 'https://images.unsplash.com/photo-1475924156734-496f6f6bb972?w=500&q=80',
    alt: 'Golden beach sunset',
    label: '[ 18 ]',
  },
  {
    id: 'bg3',
    src: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&q=80',
    alt: 'Ocean horizon waves',
    label: '[ 19 ]',
  },
  {
    id: 'bg4',
    src: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=500&q=80',
    alt: 'Green fields and mountains',
    label: '[ 20 ]',
  },
  {
    id: 'bg5',
    src: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=500&q=80',
    alt: 'Sunlit autumn forest',
    label: '[ 21 ]',
  },
  {
    id: 'bg6',
    src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500&q=80',
    alt: 'Snowy peak mountains',
    label: '[ 22 ]',
  },
  {
    id: 'bg7',
    src: 'https://images.unsplash.com/photo-1490759847868-880c31bd5dbe?w=500&q=80',
    alt: 'Meadow wildflowers sunset',
    label: '[ 23 ]',
  },
  {
    id: 'bg8',
    src: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=500&q=80',
    alt: 'Sandy desert hills',
    label: '[ 24 ]',
  },
  {
    id: 'bg9',
    src: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=500&q=80',
    alt: 'Forest footbridge scenic',
    label: '[ 25 ]',
  },
  {
    id: 'bg10',
    src: 'https://images.unsplash.com/photo-1472214222541-d510753a4907?w=500&q=80',
    alt: 'Green hills golden hour',
    label: '[ 26 ]',
  },
  {
    id: 'bg11',
    src: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=500&q=80',
    alt: 'Foggy forest valley dawn',
    label: '[ 27 ]',
  },
  {
    id: 'bg12',
    src: 'https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=500&q=80',
    alt: 'Yosemite cliffs and valley',
    label: '[ 28 ]',
  },
  {
    id: 'bg13',
    src: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=500&q=80',
    alt: 'Campfire under starry sky',
    label: '[ 29 ]',
  },
  {
    id: 'bg14',
    src: 'https://images.unsplash.com/photo-1500627869374-13cd993b1115?w=500&q=80',
    alt: 'Tropical green valley cliffs',
    label: '[ 30 ]',
  },
  {
    id: 'bg15',
    src: 'https://images.unsplash.com/photo-1482862549707-f63cb32c5fd9?w=500&q=80',
    alt: 'Foggy pine woodland winter',
    label: '[ 31 ]',
  },
  {
    id: 'bg16',
    src: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500&q=80',
    alt: 'Lush plant under morning sun',
    label: '[ 32 ]',
  },
];

export const CORNER_TOP_LEFT: PhotoboothPhoto[] = [];
export const CORNER_BOTTOM_RIGHT: PhotoboothPhoto[] = [];

export const MARGIN_WORDS = ['some', 'moments', 'of', 'my', 'life'] as const;

export const INTRO_DURATION_MS = 700;
export const INTRO_START_SCALE = 4.5;

/* Foreground Orbit Dimensions (vw/vh) */
export const ORBIT_RX = 39; // vw - slightly wider
export const ORBIT_RY = 26; // vh
export const ORBIT_ROTATION_SPEED = 0.00015; // rad/ms

/* Background Orbit Dimensions (vw/vh) - tighter concentric circle */
export const BG_ORBIT_RX = 24; // vw
export const BG_ORBIT_RY = 16; // vh
export const BG_ORBIT_ROTATION_SPEED = -0.00008; // rad/ms - rotates in opposite direction for parallax


