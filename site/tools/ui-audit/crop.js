#!/usr/bin/env node
// Crops screenshots for review: node tools/ui-audit/crop.js <png> [top] [height] [out]
const sharp = require('sharp')
const [file, top = '0', height = '1100', out] = process.argv.slice(2)
;(async () => {
  const meta = await sharp(file).metadata()
  const t = Math.min(Number(top), Math.max(0, meta.height - 1))
  const h = Math.min(Number(height), meta.height - t)
  const dest = out || file.replace(/\.png$/, `.crop-${t}.png`)
  await sharp(file).extract({ left: 0, top: t, width: meta.width, height: h }).toFile(dest)
  console.log(dest)
})()
