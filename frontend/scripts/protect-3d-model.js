/**
 * 3D Model Protection & Binary Obfuscator Tool
 * 
 * Usage:
 *   node frontend/scripts/protect-3d-model.js <input-file.glb> [output-file.hod3d]
 * 
 * Example:
 *   node frontend/scripts/protect-3d-model.js public/model.glb public/models/model.hod3d
 */

const fs = require('fs');
const path = require('path');

const MASK_KEY = 0x5a;
const HEADER_MASK_SIZE = 128;

function protectModel(inputPath, outputPath) {
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Error: File not found at "${inputPath}"`);
    process.exit(1);
  }

  const resolvedInput = path.resolve(inputPath);
  const ext = path.extname(resolvedInput).toLowerCase();

  if (ext !== '.glb' && ext !== '.gltf' && ext !== '.bin') {
    console.warn(`⚠️ Warning: Expected a .glb file, got "${ext}"`);
  }

  let finalOutput = outputPath;
  if (!finalOutput) {
    const baseName = path.basename(resolvedInput, ext);
    finalOutput = path.join(path.dirname(resolvedInput), `${baseName}.hod3d`);
  }

  const resolvedOutput = path.resolve(finalOutput);

  // Ensure target folder exists
  const targetDir = path.dirname(resolvedOutput);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  console.log(`📦 Reading: ${resolvedInput}`);
  const buffer = fs.readFileSync(resolvedInput);

  // XOR mask the first 128 bytes
  const bytesToMask = Math.min(buffer.length, HEADER_MASK_SIZE);
  const maskedBuffer = Buffer.from(buffer);
  for (let i = 0; i < bytesToMask; i++) {
    maskedBuffer[i] ^= MASK_KEY;
  }

  fs.writeFileSync(resolvedOutput, maskedBuffer);

  const originalSizeMb = (buffer.length / (1024 * 1024)).toFixed(2);
  const protectedSizeMb = (maskedBuffer.length / (1024 * 1024)).toFixed(2);

  console.log(`\n✅ Model protected successfully!`);
  console.log(`🔒 Output: ${resolvedOutput}`);
  console.log(`📊 Size: ${protectedSizeMb} MB`);
  console.log(`\n💡 How to use in Next.js:`);
  
  // Calculate relative path for Next.js public/
  const publicIndex = resolvedOutput.indexOf(path.normalize('public'));
  const nextJsPublicPath = publicIndex !== -1 
    ? resolvedOutput.substring(publicIndex + path.normalize('public').length).replace(/\\/g, '/')
    : `/models/${path.basename(resolvedOutput)}`;

  console.log(`   <ModelViewer3D modelPath="${nextJsPublicPath}" />\n`);
}

// CLI entry point
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log(`
🛡️ House of Dahlia - 3D Model Protection Tool
---------------------------------------------
Usage:
  node frontend/scripts/protect-3d-model.js <input-path.glb> [output-path.hod3d]

Example:
  node frontend/scripts/protect-3d-model.js "frontend/public/fashion+model+3d+model-reduced (1).glb" "frontend/public/models/fashion-model.hod3d"
`);
  process.exit(0);
}

protectModel(args[0], args[1]);
