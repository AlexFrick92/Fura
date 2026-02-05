const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

// Новая вспомогательная функция для разбиения параграфов
async function splitParagraph(paragraphHtml, maxHeight, measurementPage) {
    const $ = cheerio.load(paragraphHtml);
    const p = $('p').first();
    const originalText = p.text(); // Получаем только текстовое содержимое, теряя внутреннее HTML-форматирование
    const words = originalText.split(/\s+/).filter(word => word.length > 0); // Разбиваем на слова, фильтруя пустые

    if (words.length === 0) {
        return []; // Пустой параграф
    }
    if (words.length === 1) {
        return [paragraphHtml]; // Нельзя разбить одно слово
    }

    const resultParts = [];
    let currentWords = [...words];

    while (currentWords.length > 0) {
        let low = 0;
        let high = currentWords.length;
        let bestFitIndex = 0; // Индекс последнего слова, которое помещается

        // Бинарный поиск для нахождения самой длинной части, которая помещается
        while (low <= high) {
            let mid = Math.floor((low + high) / 2);
            if (mid === 0) { // Если mid = 0, мы не можем тестировать пустую строку
                low = 1; // Начинаем с 1 слова
                continue;
            }

            const testText = currentWords.slice(0, mid).join(' ');
            const testHtml = `<p>${testText}</p>`; // Создаем новый P-тег для измерения

            const testHeight = await measurementPage.evaluate((html) => {
                document.getElementById('content-to-measure').innerHTML = html;
                return document.getElementById('content-to-measure').scrollHeight;
            }, testHtml);

            if (testHeight <= maxHeight) {
                bestFitIndex = mid;
                low = mid + 1; // Пытаемся вместить больше слов
            } else {
                high = mid - 1; // Слишком много слов, пытаемся вместить меньше
            }
        }

        if (bestFitIndex > 0) {
            const fitText = currentWords.slice(0, bestFitIndex).join(' ');
            resultParts.push(`<p>${fitText}</p>`);
            currentWords = currentWords.slice(bestFitIndex);
        } else {
            // Если даже первое слово (или очень короткий сегмент) не помещается,
            // или оно слишком высокое, чтобы предотвратить бесконечный цикл,
            // берем как минимум одно слово. Этот фрагмент может все еще переполнять,
            // если одно слово выше, чем maxHeight.
            resultParts.push(`<p>${currentWords[0]}</p>`);
            currentWords = currentWords.slice(1);
        }
    }

    console.log(`[DEBUG] splitParagraph returning: ${resultParts.map(p => p.substring(0, 30).replace(/\n/g, ' ')).join(' | ')}`);
    return resultParts;
}

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
  let elementsQueue = $('body').children().map((i, el) => $.html(el)).get(); // Get HTML strings initially

  let currentPageElements = [];

  while (elementsQueue.length > 0) {
    const nextElementHtml = elementsQueue.shift(); // Get the next element (as HTML string)

    // Attempt to add this element to the current page
    currentPageElements.push(nextElementHtml);
    const currentHtml = currentPageElements.join('');

    const currentHeight = await measurementPage.evaluate((html) => {
        document.getElementById('content-to-measure').innerHTML = html;
        return document.getElementById('content-to-measure').scrollHeight;
    }, currentHtml);

        if (currentHeight > maxHeight) { // Overflow detected

            currentPageElements.pop(); // Remove the overflowing element (nextElementHtml)

    

            // Calculate height of content *before* the overflowing item was added

            const previousPageContentHtml = currentPageElements.join('');

            const previousPageContentHeight = await measurementPage.evaluate((html) => {

                document.getElementById('content-to-measure').innerHTML = html;

                return document.getElementById('content-to-measure').scrollHeight;

            }, previousPageContentHtml);

    

                    const remainingSpace = maxHeight - previousPageContentHeight;

    

                    

    

                    // Check if the overflowing element is a paragraph

    

                    const isParagraph = nextElementHtml.trim().startsWith('<p') && nextElementHtml.trim().endsWith('</p>');

    

            

    

                    // Move elementAloneHeight calculation here, so it's always defined

    

                    const elementAloneHeight = await measurementPage.evaluate((html) => {

    

                        document.getElementById('content-to-measure').innerHTML = html;

    

                        return document.getElementById('content-to-measure').scrollHeight;

    

                    }, nextElementHtml);

    

            

    

                    if (isParagraph && remainingSpace > 0) { // If it's a paragraph and there's actually space left

                console.log(`[DEBUG] >>> Paragraph caused overflow. Attempting to split to fit remaining space (${remainingSpace}px).`);

                const splitParts = await splitParagraph(nextElementHtml, remainingSpace, measurementPage); // Split against remaining space

    

                if (splitParts.length > 0 && splitParts[0].trim().length > 0) {

                    // Add the first part that fits into the remaining space

                    currentPageElements.push(splitParts[0]);

                    pages.push(currentPageElements.join('')); // Finalize this page

                    currentPageElements = []; // Start new page

                    // Re-queue the rest of the split parts (if any)

                    elementsQueue.unshift(...splitParts.slice(1));

                } else {

                    // If no part fits even in remainingSpace, or splitParagraph returned empty/invalid parts

                    console.log(`[DEBUG] No part of paragraph fit remaining space. Re-queuing original for next page.`);

                    pages.push(currentPageElements.join('')); // Finalize previous page

                    currentPageElements = []; // Start new page

                    elementsQueue.unshift(nextElementHtml); // Original element goes to next page

                }

            } else {

                // Not a paragraph, or no space left, or no split happened, so just finalize current page and put original element on next page

                pages.push(currentPageElements.join('')); // Finalize previous page

                currentPageElements = []; // Start new page

                elementsQueue.unshift(nextElementHtml); // Original element goes to next page

            }

        } else { // Current element fits, continue accumulating

            // This is the 'else' for the main 'if (currentHeight > maxHeight)' block

            // No action needed here, currentPageElements has already been pushed with nextElementHtml

            // The loop will continue, and nextElementHtml will be part of currentPageElements

        }
  }

  // Add any remaining content as the last page
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
