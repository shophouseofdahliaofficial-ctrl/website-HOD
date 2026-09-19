# Custom Font Setup - Step by Step Guide

## ✅ Step 1: Add Your Font Files

1. Place your font files in the `milko-frontend/fonts/` folder:
   - Regular font: `YourFont-Regular.woff2` (or .woff, .ttf, .otf)
   - Bold font: `YourFont-Bold.woff2` (or .woff, .ttf, .otf)

## ✅ Step 2: Update Font File Names in layout.tsx

Open `app/layout.tsx` and update the file paths to match your actual font file names:

```typescript
const customFont = localFont({
  src: [
    {
      path: '../fonts/YourFont-Regular.woff2', // ← Change this
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/YourFont-Bold.woff2', // ← Change this
      weight: '700',
      style: 'normal',
    },
  ],
  // ...
});
```

**Example:** If your files are named `MilkoFont-Regular.ttf` and `MilkoFont-Bold.ttf`:
```typescript
path: '../fonts/MilkoFont-Regular.ttf',
path: '../fonts/MilkoFont-Bold.ttf',
```

## ✅ Step 3: Done!

The font is now configured. The dev server will automatically reload.

## How It Works

- **Regular text** (body, paragraphs) uses weight 400 (Regular)
- **Bold text** (strong, b, headings) uses weight 700 (Bold)
- The font is applied globally to the entire website

## Supported Font Formats

1. **.woff2** - Best (recommended) - smallest file size
2. **.woff** - Good - wider browser support
3. **.ttf** - Universal support
4. **.otf** - Universal support

## Testing

After adding your font files and updating the paths:
1. Save `app/layout.tsx`
2. The dev server will reload automatically
3. Check your browser - you should see your custom font!

## Troubleshooting

**Font not showing?**
- Check file paths are correct in `layout.tsx`
- Make sure file names match exactly (case-sensitive)
- Check browser console for errors
- Verify font files are in `milko-frontend/fonts/` folder

**Font looks wrong?**
- Make sure you're using the correct weight (400 for regular, 700 for bold)
- Check that font files are not corrupted



