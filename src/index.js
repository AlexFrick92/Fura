const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

const md = new MarkdownIt({ html: true });

async function paginateContent(htmlContent, template, browser) {
  console.log('Начинается разбиение контента на страницы...');
  const pages = [];
  const measurementPage = await browser.newPage();

  // Устанавливаем пустой шаблон для измерения
  const measurementContent = template.replace('{{content}}', '<div id="content-to-measure"></div>');
  await measurementPage.setContent(measurementContent, { waitUntil: 'networkidle0' });

  // Получаем максимальную высоту для контента
      const maxHeight = await measurementPage.evaluate(() => {
        const actualContentBlock = document.querySelector('.actual-content-block');
        return actualContentBlock.clientHeight;
      });  console.log(`Максимальная высота контента на странице: ${maxHeight}px`);

  const $ = cheerio.load(htmlContent);
  const elements = $('body').children().toArray();
  
  let currentPageElements = [];
  for (const element of elements) {
    currentPageElements.push($.html(element));
    
    const currentHtml = currentPageElements.join('');
    
    const currentHeight = await measurementPage.evaluate((html) => {
      document.getElementById('content-to-measure').innerHTML = html;
      return document.getElementById('content-to-measure').scrollHeight;
    }, currentHtml);

    if (currentHeight > maxHeight) {
      console.log(`Контент превысил максимальную высоту, создается новая страница.`);
      // Последний элемент не поместился, убираем его с текущей страницы
      const lastElement = currentPageElements.pop();
      // Сохраняем готовую страницу
      pages.push(currentPageElements.join(''));
      // Начинаем новую страницу с элемента, который не поместился
      currentPageElements = [lastElement];
    }
  }

  // Добавляем последнюю страницу, если на ней что-то есть
  if (currentPageElements.length > 0) {
    pages.push(currentPageElements.join(''));
  }

  await measurementPage.close();
  console.log(`Контент разбит на ${pages.length} страниц.`);
  return pages;
}

async function convertMdToPdf(inputPaths, outputPath, templatePath) {
  console.log('Начинаю конвертацию...');
  const browser = await puppeteer.launch({ headless: true });
  
  const template = fs.readFileSync(templatePath, 'utf-8');
  const bodyMatch = template.match(/<body[^>]*>([\s\S]*)<\/body>/);
  if (!bodyMatch) {
    await browser.close();
    throw new Error('Invalid template: `<body>` tag not found.');
  }
  const pageTemplate = bodyMatch[1];

  let allFinalPages = [];

  for (const inputPath of inputPaths) {
    console.log(`--- Обработка файла: ${path.basename(inputPath)} ---`);
    const markdownContent = fs.readFileSync(inputPath, 'utf-8');
    const htmlContent = md.render(markdownContent);
    
    const contentPages = await paginateContent(htmlContent, template, browser);
    
    for (const page of contentPages) {
      allFinalPages.push(pageTemplate.replace('{{content}}', page));
    }
  }
  
  const finalHtml = template.replace(
    pageTemplate,
    allFinalPages.map((pageHtml, index) => {
      if (index < allFinalPages.length - 1) {
        return `<div style="page-break-after: always;">${pageHtml}</div>`;
      }
      return `<div>${pageHtml}</div>`;
    }).join('')
  );

  console.log('Генерация итогового PDF...');
  const pdfPage = await browser.newPage();
  await pdfPage.setContent(finalHtml, { waitUntil: 'networkidle0' });
  await pdfPage.pdf({
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
