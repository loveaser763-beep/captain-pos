import fs from 'fs';
import path from 'path';

function normalizeCasing() {
  console.log('[Prebuild] Normalizing folder casing for Vite compilation on Linux...');
  
  // 1. Standardize src directory to lowercase 'src'
  const rootFiles = fs.readdirSync('.');
  const srcDir = rootFiles.find(f => f.toLowerCase() === 'src');
  
  if (srcDir && srcDir !== 'src') {
    console.log(`[Prebuild] Renaming directory: "${srcDir}" -> "src"`);
    fs.renameSync(srcDir, 'src');
  }

  // 2. Standardize main.tsx casing within src to lowercase 'main.tsx'
  const finalSrcFolder = 'src';
  if (fs.existsSync(finalSrcFolder)) {
    const srcFiles = fs.readdirSync(finalSrcFolder);
    const mainFile = srcFiles.find(f => f.toLowerCase() === 'main.tsx');
    if (mainFile && mainFile !== 'main.tsx') {
      console.log(`[Prebuild] Renaming file: "${finalSrcFolder}/${mainFile}" -> "${finalSrcFolder}/main.tsx"`);
      fs.renameSync(path.join(finalSrcFolder, mainFile), path.join(finalSrcFolder, 'main.tsx'));
    }
  }
  
  console.log('[Prebuild] Casing normalization complete!');
}

try {
  normalizeCasing();
} catch (error) {
  console.error('[Prebuild] Casing normalization failed:', error);
}
