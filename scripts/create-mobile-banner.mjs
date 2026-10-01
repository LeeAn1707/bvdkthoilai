import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function createMobileBanner() {
  const width = 1080;
  const height = 540; // Tỉ lệ 2:1 chuẩn mobile

  const svgOverlay = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#04569e"/>
          <stop offset="55%" stop-color="#0284c7"/>
          <stop offset="100%" stop-color="#0891b2"/>
        </linearGradient>
        <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.2)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
        </linearGradient>
      </defs>
      
      <!-- Nền gradient xanh y tế -->
      <rect width="${width}" height="${height}" fill="url(#bgGrad)"/>
      
      <!-- Họa tiết y tế mờ -->
      <circle cx="950" cy="70" r="280" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="45"/>
      <circle cx="150" cy="500" r="220" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="30"/>
      
      <!-- Dấu thập y tế chìm -->
      <path d="M890,160 h50 v-50 h40 v50 h50 v40 h-50 v50 h-40 v-50 h-50 z" fill="rgba(255,255,255,0.07)"/>
      <path d="M120,60 h30 v-30 h24 v30 h30 v24 h-30 v30 h-24 v-30 h-30 z" fill="rgba(255,255,255,0.08)"/>
      
      <!-- Sóng lượn năng động -->
      <path d="M0,${height} Q300,350 620,430 T${width},370 L${width},${height} Z" fill="rgba(255,255,255,0.16)"/>
      <path d="M0,${height} Q380,410 740,470 T${width},450 L${width},${height} Z" fill="rgba(255,255,255,0.22)"/>

      <!-- Nền viền sáng cho khối logo -->
      <circle cx="185" cy="245" r="132" fill="#ffffff" filter="drop-shadow(0 8px 24px rgba(0,0,0,0.25))"/>
      <circle cx="185" cy="245" r="126" fill="none" stroke="#bae6fd" stroke-width="3"/>

      <!-- Khối chữ tên bệnh viện & slogan -->
      <!-- Cơ quan chủ quản -->
      <text x="350" y="125" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="23" font-weight="800" fill="#bae6fd" letter-spacing="2">SỞ Y TẾ THÀNH PHỐ CẦN THƠ</text>
      
      <!-- Tiêu đề bệnh viện -->
      <text x="350" y="185" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="44" font-weight="900" fill="#ffffff" letter-spacing="-0.5">BỆNH VIỆN ĐA KHOA</text>
      <text x="350" y="242" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="44" font-weight="900" fill="#fef08a" letter-spacing="-0.5">KHU VỰC THỚI LAI</text>
      
      <!-- Đường gạch nhấn màu sáng -->
      <rect x="350" y="268" width="320" height="5" rx="2.5" fill="#38bdf8"/>

      <!-- Slogan uy tín -->
      <text x="350" y="318" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="24" font-style="italic" font-weight="600" fill="#ffffff">“Điều trị bằng trái tim – Chăm sóc bằng tấm lòng”</text>

      <!-- Badge Cấp cứu 24/7 -->
      <g transform="translate(350, 355)">
        <rect width="365" height="56" rx="28" fill="#ffffff" filter="drop-shadow(0 6px 16px rgba(0,0,0,0.22))"/>
        <circle cx="28" cy="28" r="22" fill="#ef4444"/>
        <!-- Dấu thập đỏ/trắng -->
        <rect x="25" y="14" width="6" height="28" fill="#ffffff" rx="2"/>
        <rect x="14" y="25" width="28" height="6" fill="#ffffff" rx="2"/>
        
        <text x="64" y="25" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="13" font-weight="800" fill="#64748b" letter-spacing="0.5">CẤP CỨU 24/7:</text>
        <text x="64" y="47" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="21" font-weight="900" fill="#dc2626">0292 368 9115</text>
      </g>

      <!-- Badge Địa chỉ bệnh viện -->
      <g transform="translate(350, 432)">
        <rect width="490" height="46" rx="23" fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.45)" stroke-width="1.2"/>
        <circle cx="23" cy="23" r="16" fill="#ffffff"/>
        <path d="M23,12 C18.5,12 15,15.5 15,20 C15,25 23,32 23,32 C23,32 31,25 31,20 C31,15.5 27.5,12 23,12 Z M23,22.5 C21.6,22.5 20.5,21.4 20.5,20 C20.5,18.6 21.6,17.5 23,17.5 C24.4,17.5 25.5,18.6 25.5,20 C25.5,21.4 24.4,22.5 23,22.5 Z" fill="#0284c7"/>
        <text x="52" y="29" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="16" font-weight="700" fill="#ffffff">Ấp Thới Phong, xã Thới Lai, TP. Cần Thơ</text>
      </g>
    </svg>
  `);

  const logoPath = path.resolve(process.cwd(), 'public/branding/logo-bvdk-thoi-lai.png');
  let logoBuffer = null;
  if (fs.existsSync(logoPath)) {
    logoBuffer = await sharp(logoPath)
      .resize(230, 230, { fit: 'contain' })
      .toBuffer();
  }

  const composites = [
    { input: svgOverlay, top: 0, left: 0 }
  ];

  if (logoBuffer) {
    composites.push({
      input: logoBuffer,
      top: 130,
      left: 70
    });
  }

  const outputDir = path.resolve(process.cwd(), 'public/banners');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path.join(outputDir, 'banner-bvdk-thoi-lai-mobile.png');

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 4, g: 86, b: 158, alpha: 1 }
    }
  })
  .composite(composites)
  .png({ quality: 95 })
  .toFile(outputPath);

  console.log(`[Success] Mobile banner created at: ${outputPath}`);
}

createMobileBanner().catch(console.error);
