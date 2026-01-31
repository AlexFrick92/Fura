const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');
const puppeteer = require('puppeteer');

const md = new MarkdownIt();

async function convertMdToPdf(inputPath, outputPath) {
  // Читаем MD файл
  const markdownContent = fs.readFileSync(inputPath, 'utf-8');

  // Конвертируем MD в HTML
  const htmlContent = md.render(markdownContent);

  // Создаем полный HTML документ с базовым стилем для A4
  const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: A4;
      margin: 2cm;
    }
    body {
      font-family: 'Arial', sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #333;
    }
    h1 { font-size: 24pt; margin-top: 0; }
    h2 { font-size: 18pt; margin-top: 1em; }
    h3 { font-size: 14pt; margin-top: 1em; }
    p { margin: 0.5em 0; }
    code {
      background-color: #f4f4f4;
      padding: 2px 4px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
    }
    pre {
      background-color: #f4f4f4;
      padding: 10px;
      border-radius: 5px;
      overflow-x: auto;
    }
    pre code {
      background-color: transparent;
      padding: 0;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>
  `;

  // Генерируем PDF через Puppeteer
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '2cm',
      right: '2cm',
      bottom: '2cm',
      left: '2cm'
    }
  });

  await browser.close();

  console.log(`PDF успешно создан: ${outputPath}`);
}

// CLI интерфейс
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('Использование: node src/index.js <input.md> <output.pdf>');
  process.exit(1);
}

const inputPath = path.resolve(args[0]);
const outputPath = path.resolve(args[1]);

convertMdToPdf(inputPath, outputPath).catch(err => {
  console.error('Ошибка:', err);
  process.exit(1);
});
