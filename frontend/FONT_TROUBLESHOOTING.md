# Font Troubleshooting Guide

## Current Setup
- Font files: `VVDS-Fifties-Exp-Light.otf` and `VVDS-Fifties-Exp-SBold.otf`
- Location: `milko-frontend/fonts/`
- Applied via: `customFont.className` on body element

## How to Verify Font is Working

### 1. Check Browser DevTools
1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Filter by "Font"
4. Refresh the page
5. You should see the font files loading (VVDS-Fifties-Exp-Light.otf and VVDS-Fifties-Exp-SBold.otf)

### 2. Check Computed Styles
1. Open DevTools (F12)
2. Go to **Elements** tab
3. Select the `<body>` element
4. Check **Computed** styles
5. Look for `font-family` - it should show your custom font name

### 3. Check Console for Errors
1. Open DevTools (F12)
2. Go to **Console** tab
3. Look for any font loading errors

## Common Issues

### Issue: Font not loading
**Solution:**
- Make sure dev server is restarted after changes
- Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)
- Check that font files are in `milko-frontend/fonts/` folder

### Issue: Font loads but doesn't display
**Possible causes:**
- Inline styles overriding font-family
- Font file corrupted
- Browser doesn't support .otf format (rare)

**Solution:**
- Remove inline `font-family` styles
- Convert font to .woff2 format (better browser support)
- Check font file integrity

### Issue: Only one weight works
**Solution:**
- Verify both font files are in the fonts folder
- Check that both paths in `layout.tsx` are correct
- Make sure weights are set correctly (400 for regular, 700 for bold)

## Testing the Font

Add this to any page to test:
```tsx
<div>
  <p style={{ fontWeight: 400 }}>Regular text (400)</p>
  <p style={{ fontWeight: 700 }}>Bold text (700)</p>
  <h1>Heading (should be bold)</h1>
</div>
```

## Alternative: Convert to WOFF2

If .otf isn't working, convert to .woff2:
1. Use online converter: https://cloudconvert.com/otf-to-woff2
2. Replace .otf files with .woff2 files
3. Update paths in `layout.tsx`



