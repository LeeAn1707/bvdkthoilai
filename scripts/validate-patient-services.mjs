import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const checks = []
const check = (name, ok) => checks.push({ name, ok: Boolean(ok) })

const config = read('payload.config.ts')
const services = read('src/collections/Services.ts')
const prices = read('src/collections/ServicePrices.ts')
const vaccines = read('src/collections/Vaccines.ts')
const vaccinePrices = read('src/collections/VaccinePrices.ts')
const vaccinationSchedules = read('src/collections/VaccinationSchedules.ts')
const schedules = read('src/collections/Schedules.ts')
const importRoute = read('src/app/(frontend)/api/services-import/route.ts')
const importUI = read('src/components/admin/ServicesExcelImport.tsx')
const pricePage = read('src/app/(frontend)/bang-gia/page.tsx')
const vaccinationPage = read('src/app/(frontend)/tiem-chung/page.tsx')
const packageJson = JSON.parse(read('package.json'))

check('Collection servicePrices đã đăng ký', prices.includes("slug: 'servicePrices'") && config.includes('ServicePrices'))
check('Giá dịch vụ có lịch sử hiệu lực', prices.includes('effectiveFrom') && prices.includes('effectiveTo') && prices.includes('decisionNo'))
check('Services có đơn vị tính và giữ giá legacy', services.includes("name: 'unit'") && services.includes('tương thích dữ liệu cũ'))
check('Collection vaccines đã tách riêng', vaccines.includes("slug: 'vaccines'") && config.includes('Vaccines'))
check('Collection vaccinePrices đã tách riêng', vaccinePrices.includes("slug: 'vaccinePrices'") && config.includes('VaccinePrices'))
check('Giá vắc xin có lịch sử hiệu lực', vaccinePrices.includes('effectiveFrom') && vaccinePrices.includes('effectiveTo'))
check('Collection vaccinationSchedules đã tách riêng', vaccinationSchedules.includes("slug: 'vaccinationSchedules'") && config.includes('VaccinationSchedules'))
check('Lịch khám hỗ trợ đăng ảnh/tệp ưu tiên', (schedules.includes("defaultValue: 'attachment'") || schedules.includes("value: 'attachment'")) && schedules.includes('Ảnh lịch khám tuần (ưu tiên)'))
check('Lịch khám hỗ trợ lịch chính thức/điều chỉnh', schedules.includes("name: 'scheduleType'") && schedules.includes('adjustment'))
check('Import Center có bước preview', importRoute.includes("mode !== 'import'") && importUI.includes("send('preview')"))
check('Import Center bắt buộc ngày hiệu lực', importRoute.includes('thiếu/sai Hiệu lực từ') && importRoute.includes('effectiveFrom'))
check('Import lưu lịch sử servicePrices', importRoute.includes("collection: 'servicePrices'"))
check('Import có lịch sử importJobs', importRoute.includes("collection: 'importJobs'") && config.includes('ImportJobs'))
check('Frontend bảng giá ưu tiên giá có hiệu lực', pricePage.includes("collection: 'servicePrices'") && pricePage.includes('priceMap'))
check('Frontend tiêm chủng dùng collection mới', vaccinationPage.includes("collection: 'vaccinationSchedules'") && vaccinationPage.includes("collection: 'vaccines'") && vaccinationPage.includes("collection: 'vaccinePrices'"))
check('Giữ fallback dữ liệu tiêm chủng cũ', vaccinationPage.includes("collection: 'vaccinations'"))
check('Script validation đã đăng ký', packageJson.scripts?.['validate:patient-services'] === 'node scripts/validate-patient-services.mjs')

for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'} - ${item.name}`)
const passed = checks.filter(x => x.ok).length
console.log(`\nPatient Services static validation: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
