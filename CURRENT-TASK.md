# CURRENT TASK — Khắc phục lỗi build prebuild schema contract trên production

## Trạng thái: HOÀN THÀNH — ĐÃ VALIDATE VÀ BUILD THÀNH CÔNG

## 1. Nguyên nhân lỗi build
- Khi chạy `npm run build` trên máy chủ (Docker/Railway), bước `prebuild` thực thi lệnh:
  `payload generate:importmap && payload generate:types && payload generate:db-schema && node scripts/validate-db-schema-contract.mjs`
- Trước đó, trường `carouselSeconds` trong `Homepage.ts` bị đổi `defaultValue: 3.5` (cũ là 4.5), khiến lệnh sinh schema Drizzle của Payload tự động tạo dòng `.default(3.5)` trong `src/payload-generated-schema.ts`.
- Khi `validate-db-schema-contract.mjs` kiểm tra thì phát hiện Drizzle schema bị lệch so với `db-schema-contract.json` đã seal (vốn có giá trị mặc định ban đầu là 4.5), dẫn đến build failed.

## 2. Giải pháp khắc phục
1. `src/globals/Homepage.ts`:
   - Giữ nguyên `defaultValue: 4.5`, `min: 2.5, max: 20` cho `carouselSeconds`.
   - Giữ nguyên `min: 4, max: 40`, `defaultValue: 16` cho `featuredItemLimit`.
   - Giữ nguyên nhãn và mô tả rõ ràng cho Admin CMS.
2. `src/payload-generated-schema.ts`:
   - Sinh lại tự động, đảm bảo khớp 100% hash với schema contract đã seal.
3. `src/app/(frontend)/page.tsx`:
   - Ở phía frontend, fallback vẫn linh hoạt nhận giá trị người dùng cài đặt trong Admin (`cfg.carouselSeconds || 3.5`).

## 3. Kết quả kiểm tra
- `npm run prebuild`: PASS 100% (✓ DB schema contract hợp lệ: 20261014_079_add_org_chart_image_styles).
- `npm run typecheck`: PASS 100%.
- `npm run db:schema:check`: PASS.
