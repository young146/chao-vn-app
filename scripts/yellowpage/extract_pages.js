// Layer 3 (Execution): PDF에서 페이지 JPEG 추출 + sharp로 분할·확대 타일 생성.
// 입력: 561_yellowpage.pdf (스캔 이미지 PDF, 페이지당 1 JPEG)
// 출력: .tmp/yellowpage/tiles/page_NN_r{row}c{col}.png (2x3 그리드, 2배 확대 + 샤픈)
// 용도: 비전 OCR 정확도 확보 (200DPI 작은 전화번호 가독성 향상)
const fs = require('fs');
const path = require('path');
const sharp = require(process.env.SHARP_PATH || 'C:/vnkorlife-web/node_modules/sharp');

const PDF = process.env.YP_PDF || 'Z:/VOL/VOL_NEW/Vol-561/04-PDF/561_yellowpage-2.pdf';
const PAGES_DIR = 'C:/chao-vn-app/chao-vn-app/.tmp/yellowpage/pages';
const TILES_DIR = 'C:/chao-vn-app/chao-vn-app/.tmp/yellowpage/tiles';
fs.mkdirSync(PAGES_DIR, { recursive: true });
fs.mkdirSync(TILES_DIR, { recursive: true });

// 1) PDF 바이너리에서 JPEG(FFD8..FFD9) 세그먼트 추출
function extractJpegs() {
  const b = fs.readFileSync(PDF);
  let i = 0, count = 0;
  while (i < b.length - 1) {
    if (b[i] === 0xFF && b[i + 1] === 0xD8) {
      let j = i + 2;
      while (j < b.length - 1 && !(b[j] === 0xFF && b[j + 1] === 0xD9)) j++;
      if (j < b.length - 1) {
        const end = j + 2;
        const slice = b.slice(i, end);
        if (slice.length > 20000) {
          count++;
          fs.writeFileSync(path.join(PAGES_DIR, `page_${String(count).padStart(2, '0')}.jpg`), slice);
        }
        i = end; continue;
      }
    }
    i++;
  }
  return count;
}

// 2) 각 페이지를 ROWS x COLS 그리드 타일로 분할 + 2배 확대 + 샤픈 (살짝 겹치게)
const ROWS = 3, COLS = 2, SCALE = 2, OVERLAP = 0.04;
async function tilePage(file) {
  const name = path.basename(file, '.jpg');
  const img = sharp(file);
  const meta = await img.metadata();
  const W = meta.width, H = meta.height;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ox = Math.max(0, Math.floor(W * (c / COLS - OVERLAP)));
      const oy = Math.max(0, Math.floor(H * (r / ROWS - OVERLAP)));
      const ex = Math.min(W, Math.ceil(W * ((c + 1) / COLS + OVERLAP)));
      const ey = Math.min(H, Math.ceil(H * ((r + 1) / ROWS + OVERLAP)));
      const tw = ex - ox, th = ey - oy;
      const out = path.join(TILES_DIR, `${name}_r${r + 1}c${c + 1}.png`);
      await sharp(file)
        .extract({ left: ox, top: oy, width: tw, height: th })
        .resize({ width: Math.round(tw * SCALE), kernel: 'lanczos3' })
        .sharpen()
        .png({ compressionLevel: 9 })
        .toFile(out);
    }
  }
}

(async () => {
  const argv = process.argv.slice(2);
  if (argv[0] === 'extract' || !fs.existsSync(path.join(PAGES_DIR, 'page_01.jpg'))) {
    const n = extractJpegs();
    console.log('extracted pages:', n);
  }
  const only = argv.find(a => a.startsWith('--page='));
  let pages = fs.readdirSync(PAGES_DIR).filter(f => f.endsWith('.jpg')).sort();
  if (only) {
    const p = only.split('=')[1].padStart(2, '0');
    pages = pages.filter(f => f === `page_${p}.jpg`);
  }
  for (const f of pages) {
    await tilePage(path.join(PAGES_DIR, f));
    console.log('tiled', f);
  }
  console.log('done. tiles in', TILES_DIR);
})();
