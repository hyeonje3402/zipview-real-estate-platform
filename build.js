const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const distDir = path.join(rootDir, 'dist');

console.log('[Build] ZipView Enterprise dist 빌드 시작...');

// 1. dist 디렉토리 초기화
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// 2. 필수 프론트엔드 파일 목록 정의
const requiredFiles = [
  'index.html',
  'TossStyleRealEstateDashboard.jsx',
  'App.jsx',
  'styles.css'
];

let copiedCount = 0;

requiredFiles.forEach((fileName) => {
  const src = path.join(rootDir, fileName);
  const dest = path.join(distDir, fileName);

  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    const stat = fs.statSync(dest);
    console.log(` [OK] ${fileName} (${(stat.size / 1024).toFixed(1)} KB)`);
    copiedCount++;
  } else {
    console.error(` [ERROR] 필수 파일 누락: ${fileName}`);
    process.exit(1);
  }
});

// 3. public 폴더가 있을 경우 정적 에셋 전체 복사
const publicDir = path.join(rootDir, 'public');
if (fs.existsSync(publicDir)) {
  const publicFiles = fs.readdirSync(publicDir);
  publicFiles.forEach((pf) => {
    const pSrc = path.join(publicDir, pf);
    const pDest = path.join(distDir, pf);
    if (!fs.existsSync(pDest)) {
      if (fs.statSync(pSrc).isDirectory()) {
        fs.cpSync(pSrc, pDest, { recursive: true });
      } else {
        fs.copyFileSync(pSrc, pDest);
      }
      console.log(` [ASSET] ${pf}`);
    }
  });
}

// 4. 빌드 산출물 최종 유효성 검증
const distFiles = fs.readdirSync(distDir);
console.log('----------------------------------------------------');
console.log(`[Build Complete] dist 디렉토리에 총 ${distFiles.length}개 파일이 정상 생성되었습니다.`);
distFiles.forEach((file) => {
  const fPath = path.join(distDir, file);
  const fStat = fs.statSync(fPath);
  console.log(`   - ${file.padEnd(35)} : ${(fStat.size / 1024).toFixed(1)} KB`);
});
console.log('----------------------------------------------------');
