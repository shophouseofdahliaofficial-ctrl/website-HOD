import {
  Bebas_Neue,
  Cormorant,
  Cormorant_Garamond,
  Epilogue,
  Hahmlet,
  JetBrains_Mono,
  Lato,
  Lora,
  Merriweather,
  Montserrat,
  Noto_Sans,
  Old_Standard_TT,
  Open_Sans,
  Oswald,
  Pacifico,
  Playfair_Display,
  Poppins,
  Raleway,
  Roboto,
  Roboto_Serif,
  Spectral,
} from 'next/font/google';

export type PbPhotobookFont = { name: string; family: string };

/** Safe default before photobook editor fonts are lazy-loaded. */
export const PB_PHOTOBOOK_FONTS_FALLBACK: PbPhotobookFont[] = [
  { name: 'Google Sans', family: 'var(--font-inter), "Google Sans", sans-serif' },
];

const pbFontPoppins = Poppins({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], display: 'swap', preload: false });
const pbFontMontserrat = Montserrat({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], display: 'swap', preload: false });
const pbFontPlayfair = Playfair_Display({ subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap', preload: false });
const pbFontLora = Lora({ subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap', preload: false });
const pbFontBebas = Bebas_Neue({ subsets: ['latin'], weight: ['400'], display: 'swap', preload: false });
const pbFontPacifico = Pacifico({ subsets: ['latin'], weight: ['400'], display: 'swap', preload: false });
const pbFontRobotoSerif = Roboto_Serif({ subsets: ['latin'], weight: ['400', '700'], display: 'swap', preload: false });
const pbFontMerriweather = Merriweather({ subsets: ['latin'], weight: ['400', '700'], display: 'swap', preload: false });
const pbFontCormorantGaramond = Cormorant_Garamond({ subsets: ['latin'], weight: ['400', '700'], display: 'swap', preload: false });
const pbFontRoboto = Roboto({ subsets: ['latin'], weight: ['400', '700'], display: 'swap', preload: false });
const pbFontOpenSans = Open_Sans({ subsets: ['latin'], weight: ['400', '700'], display: 'swap', preload: false });
const pbFontLato = Lato({ subsets: ['latin'], weight: ['400', '700'], display: 'swap', preload: false });
const pbFontNotoSans = Noto_Sans({ subsets: ['latin'], weight: ['400', '700'], display: 'swap', preload: false });
const pbFontRaleway = Raleway({ subsets: ['latin'], weight: ['400', '700'], display: 'swap', preload: false });
const pbFontOswald = Oswald({ subsets: ['latin'], weight: ['400', '700'], display: 'swap', preload: false });
const pbFontHahmlet = Hahmlet({ subsets: ['latin'], weight: ['400', '700'], display: 'swap', preload: false });
const pbFontJetBrainsMono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '700'], display: 'swap', preload: false });
const pbFontEpilogue = Epilogue({ subsets: ['latin'], weight: ['400', '700'], display: 'swap', preload: false });
const pbFontCormorant = Cormorant({ subsets: ['latin'], weight: ['400', '700'], display: 'swap', preload: false });
const pbFontSpectral = Spectral({ subsets: ['latin'], weight: ['400', '700'], display: 'swap', preload: false });
const pbFontOldStandardTt = Old_Standard_TT({ subsets: ['latin'], weight: ['400', '700'], display: 'swap', preload: false });

/** Loaded on demand when the photobook editor opens (keeps site fonts untouched). */
export const PB_PHOTOBOOK_FONTS: PbPhotobookFont[] = [
  { name: 'Google Sans', family: 'var(--font-inter), "Google Sans", sans-serif' },
  { name: 'Poppins', family: pbFontPoppins.style.fontFamily },
  { name: 'Montserrat', family: pbFontMontserrat.style.fontFamily },
  { name: 'Playfair Display', family: pbFontPlayfair.style.fontFamily },
  { name: 'Lora', family: pbFontLora.style.fontFamily },
  { name: 'Bebas Neue', family: pbFontBebas.style.fontFamily },
  { name: 'Pacifico', family: pbFontPacifico.style.fontFamily },
  { name: 'Cormorant', family: pbFontCormorant.style.fontFamily },
  { name: 'Cormorant Garamond', family: pbFontCormorantGaramond.style.fontFamily },
  { name: 'Epilogue', family: pbFontEpilogue.style.fontFamily },
  { name: 'Hahmlet', family: pbFontHahmlet.style.fontFamily },
  { name: 'JetBrains Mono', family: pbFontJetBrainsMono.style.fontFamily },
  { name: 'Lato', family: pbFontLato.style.fontFamily },
  { name: 'Merriweather', family: pbFontMerriweather.style.fontFamily },
  { name: 'Noto Sans', family: pbFontNotoSans.style.fontFamily },
  { name: 'Old Standard TT', family: pbFontOldStandardTt.style.fontFamily },
  { name: 'Open Sans', family: pbFontOpenSans.style.fontFamily },
  { name: 'Oswald', family: pbFontOswald.style.fontFamily },
  { name: 'Raleway', family: pbFontRaleway.style.fontFamily },
  { name: 'Roboto', family: pbFontRoboto.style.fontFamily },
  { name: 'Roboto Serif', family: pbFontRobotoSerif.style.fontFamily },
  { name: 'Spectral', family: pbFontSpectral.style.fontFamily },
];
