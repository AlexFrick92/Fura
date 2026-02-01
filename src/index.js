const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');
const puppeteer = require('puppeteer');

const md = new MarkdownIt();

async function convertMdToPdf(inputPath, outputPath, templatePath) {
  console.log('Начинаю конвертацию...');

  // Читаем MD файл
  console.log('Чтение markdown файла...');
  const markdownContent = fs.readFileSync(inputPath, 'utf-8');

  // Конвертируем MD в HTML
  console.log('Конвертация MD → HTML...');
  const htmlContent = md.render(markdownContent);

  // Читаем HTML шаблон
  console.log('Загрузка шаблона...');
  const template = fs.readFileSync(templatePath, 'utf-8');

  // Вставляем контент в шаблон
  const fullHtml = template.replace('{{content}}', htmlContent);

  // Генерируем PDF через Puppeteer
  console.log('Запуск браузера...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Загрузка контента в страницу...');
  await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

  console.log('Генерация PDF...');
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
