const { readFileSync } = require('./utils/file-utils');
const { parseArgs } = require('./cli');
const { parseMarkdownToHtml } = require('./parser');
const { paginateContent } = require('./paginator');
const { generatePdf } = require('./pdf-generator');
const path = require('path'); // Keep path for path.basename
const puppeteer = require('puppeteer'); // Keep puppeteer for browser launch

async function convertMdToPdf(inputPaths, outputPath, templatePath) {
    console.log('Начинаю конвертацию...');
    const browser = await puppeteer.launch({ headless: true });

    const template = readFileSync(templatePath, 'utf-8');
    const bodyMatch = template.match(/<body[^>]*>([\s\S]*)<\/body>/);
    if (!bodyMatch) {
        await browser.close();
        throw new Error('Invalid template: `<body>` tag not found.');
    }
    const pageTemplate = bodyMatch[1];

    let allFinalPages = [];

    for (const inputPath of inputPaths) {
        console.log(`--- Обработка файла: ${path.basename(inputPath)} ---`);
        const markdownContent = readFileSync(inputPath, 'utf-8');
        const htmlContent = parseMarkdownToHtml(markdownContent);

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

    await generatePdf(browser, finalHtml, outputPath);
    await browser.close();
}

// CLI interface
const { inputPaths, templatePath, outputPath } = parseArgs(process.argv.slice(2));

convertMdToPdf(inputPaths, outputPath, templatePath).catch(err => {
    console.error('Ошибка:', err);
    process.exit(1);
});
