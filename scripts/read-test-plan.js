/* eslint-disable */
const path = require('path')
const ExcelJS = require(path.join(__dirname, '..', 'node_modules', 'exceljs'))

async function main() {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(path.join(__dirname, '..', 'CREW_SCHEDULE_TEST_PLAN.xlsx'))
  for (const ws of wb.worksheets) {
    console.log(`\n\n====== SHEET: ${ws.name} (${ws.rowCount} rows) ======`)
    ws.eachRow({ includeEmpty: false }, (row, i) => {
      const vals = row.values.slice(1).map((v) => {
        if (v == null) return ''
        if (typeof v === 'object') {
          if (v.richText) return v.richText.map((r) => r.text).join('')
          if (v.text) return v.text
          return JSON.stringify(v)
        }
        return String(v)
      })
      const line = vals.map((v) => (v.length > 200 ? v.slice(0, 200) + '…' : v)).join(' | ')
      console.log(`  ${String(i).padStart(3)} | ${line}`)
    })
  }
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
