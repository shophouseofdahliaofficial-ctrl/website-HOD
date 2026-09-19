# Custom Font Setup Guide

## Current Setup
- **Body text**: Inter (Google Font)
- **Headings**: Poppins (Google Font)

## Option 1: Change to a Different Google Font

Edit `app/layout.tsx` and replace the font import:

```typescript
// Popular options:
import { Roboto } from 'next/font/google';
import { Open_Sans } from 'next/font/google';
import { Montserrat } from 'next/font/google';
import { Lato } from 'next/font/google';
import { Playfair_Display } from 'next/font/google';

const customFont = Roboto({ 
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-custom',
});
```

Then update the className in the body tag.

## Option 2: Use Your Own Custom Font Files

### Step 1: Add font files
Create a `fonts` folder and add your font files:
```
milko-frontend/
├── fonts/
│   ├── YourFont-Regular.woff2
│   ├── YourFont-Bold.woff2
│   └── YourFont-Italic.woff2
```

### Step 2: Use next/font/local
Update `app/layout.tsx`:

```typescript
import localFont from 'next/font/local';

const customFont = localFont({
  src: [
    {
      path: '../fonts/YourFont-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/YourFont-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../fonts/YourFont-Italic.woff2',
      weight: '400',
      style: 'italic',
    },
  ],
  variable: '--font-custom',
  display: 'swap',
});
```

### Step 3: Apply the font
Update the body className:
```typescript
<body className={customFont.variable}>
```

And in `globals.css`:
```css
body {
  font-family: var(--font-custom), sans-serif;
}
```

## Available Google Fonts
Browse all available fonts: https://fonts.google.com/

Popular choices for modern websites:
- **Poppins** - Clean, modern (currently used for headings)
- **Roboto** - Google's signature font
- **Montserrat** - Geometric, professional
- **Open Sans** - Highly readable
- **Lato** - Friendly, rounded
- **Playfair Display** - Elegant serif for headings

## Font Weights
Common weights: '300' (light), '400' (regular), '500' (medium), '600' (semi-bold), '700' (bold)

## Performance Tips
- Use `display: 'swap'` for better loading performance
- Limit font weights to only what you need
- Use `woff2` format for custom fonts (best compression)



