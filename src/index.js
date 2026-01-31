const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');
const puppeteer = require('puppeteer');

const md = new MarkdownIt();

async function convertMdToPdf(inputPath, outputPath, templatePath) {
  // Читаем MD файл
  const markdownContent = fs.readFileSync(inputPath, 'utf-8');

  // Конвертируем MD в HTML
  const htmlContent = md.render(markdownContent);

  // Читаем HTML шаблон
  const template = fs.readFileSync(templatePath, 'utf-8');

  // Вставляем контент в шаблон
  const fullHtml = template.replace('{{content}}', htmlContent);

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

if (args.length < 3) {
  console.log('Использование: node src/index.js <input.md> <template.html> <output.pdf>');
  process.exit(1);
}

const inputPath = path.resolve(args[0]);
const templatePath = path.resolve(args[1]);
const outputPath = path.resolve(args[2]);

convertMdToPdf(inputPath, outputPath, templatePath).catch(err => {
  console.error('Ошибка:', err);
  process.exit(1);
});
