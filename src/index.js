const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');
const puppeteer = require('puppeteer');

const md = new MarkdownIt();

async function convertMdToPdf(inputPaths, outputPath, templatePath) {
  console.log('Начинаю конвертацию...');

  // Читаем HTML шаблон
  console.log('Загрузка шаблона...');
  const template = fs.readFileSync(templatePath, 'utf-8');

  // Извлекаем тело шаблона для создания страниц
  const bodyMatch = template.match(/<body[^>]*>([\s\S]*)<\/body>/);
  if (!bodyMatch) {
    throw new Error('Invalid template: `<body>` tag not found.');
  }
  const pageTemplate = bodyMatch[1];
  
  const pagesHtml = [];
  for (const inputPath of inputPaths) {
      console.log(`Чтение markdown файла: ${path.basename(inputPath)}`);
      const markdownContent = fs.readFileSync(inputPath, 'utf-8');
      
      console.log('Конвертация MD → HTML...');
      const htmlContent = md.render(markdownContent);
      
      pagesHtml.push(pageTemplate.replace('{{content}}', htmlContent));
  }

  // Соединяем страницы, добавляя разрыв после каждой, кроме последней
  const allPagesCombinedHtml = pagesHtml.map((pageHtml, index) => {
    if (index < pagesHtml.length - 1) {
      return `<div style="page-break-after: always;">${pageHtml}</div>`;
    }
    return `<div>${pageHtml}</div>`;
  }).join('');

  // Собираем итоговый HTML
  const fullHtml = template.replace(pageTemplate, allPagesCombinedHtml);

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
    printBackground: true
  });

  await browser.close();

  console.log(`PDF успешно создан: ${outputPath}`);
}

// CLI интерфейс
const args = process.argv.slice(2);

if (args.length < 3) {
  console.log('Использование: node src/index.js <input1.md> [input2.md ...] <template.html> <output.pdf>');
  process.exit(1);
}

const inputPaths = args.slice(0, -2).map(p => path.resolve(p));
const templatePath = path.resolve(args[args.length - 2]);
const outputPath = path.resolve(args[args.length - 1]);

convertMdToPdf(inputPaths, outputPath, templatePath).catch(err => {
  console.error('Ошибка:', err);
  process.exit(1);
});
