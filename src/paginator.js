const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

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

module.exports = {
  paginateContent,
};