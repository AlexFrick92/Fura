const { readFileSync } = require('./utils/file-utils');
const { parseArgs } = require('./cli');
const { parseMarkdownToHtml } = require('./parser');
const { paginateContent } = require('./paginator');
const { generatePdf } = require('./pdf-generator');
const path = require('path');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

async function convertMdToPdf(inputPaths, outputPath, templatePath) {
    console.log('Начинаю конвертацию...');
    const browser = await puppeteer.launch({ headless: true });
    const templateString = readFileSync(templatePath, 'utf-8');
    const templateDir = path.dirname(templatePath);
    let finalHtml;

    // New project-driven mode
    if (inputPaths.length === 0) {
        // Phase 1: Resolve simple includes synchronously.
        const genericIncludeRegex = /{{\s*([^}]+?)\s*}}/g;
        const templateWithSimpleIncludes = templateString.replace(genericIncludeRegex, (match, content) => {
            if (content.startsWith('FURA:PAGINATE')) {
                return match; // Not a simple include, return the original placeholder
            }

            if (content.endsWith('.md')) {
                const mdFileName = content;
                const mdFilePath = path.resolve(templateDir, mdFileName);
                console.log(`--- Включаем простой файл: ${mdFileName} ---`);
                try {
                    const markdownContent = readFileSync(mdFilePath, 'utf-8');
                    return parseMarkdownToHtml(markdownContent);
                } catch (error) {
                    console.warn(`[ПРЕДУПРЕЖДЕНИЕ] Не удалось включить простой файл ${mdFileName}: ${error.message}`);
                    return `<p style="color:red;"><strong>Ошибка: не удалось включить ${mdFileName}</strong></p>`;
                }
            }
            return match;
        });

        // Phase 2: Find the single paginated include.
        const paginatedIncludeRegex = /{{\s*FURA:PAGINATE\s+([^}]+?\.md)\s*}}/;
        const paginatedMatch = templateWithSimpleIncludes.match(paginatedIncludeRegex);

        if (!paginatedMatch) {
            // No main content to paginate, treat the result as a single page.
            finalHtml = templateWithSimpleIncludes;
        } else {
            const paginatedPlaceholder = paginatedMatch[0];
            const paginatedMdFileName = paginatedMatch[1];
            const paginatedMdFilePath = path.resolve(templateDir, paginatedMdFileName);

            console.log(`--- Обрабатываем основной файл: ${paginatedMdFileName} ---`);
            const mainMarkdownContent = readFileSync(paginatedMdFilePath, 'utf-8');
            const mainHtmlContent = parseMarkdownToHtml(mainMarkdownContent);
            
            // Phase 3: Paginate the main content.
            const contentPages = await paginateContent(mainHtmlContent, templateWithSimpleIncludes, browser, paginatedPlaceholder);
            
            // Phase 4: Assemble the final HTML.
            const bodyMatch = templateWithSimpleIncludes.match(/<body[^>]*>([\s\S]*)<\/body>/);
            if (!bodyMatch) throw new Error('Invalid template: `<body>` tag not found.');
            const pageBodyTemplate = bodyMatch[1];

            const pageBodies = contentPages.map(pageContent => {
                return pageBodyTemplate.replace(paginatedPlaceholder, pageContent);
            });

            const finalBodyContent = pageBodies.map((body, index) => {
                if (index < pageBodies.length - 1) {
                    return `<div style="page-break-after: always;">${body}</div>`;
                }
                return body;
            }).join('');

            finalHtml = templateWithSimpleIncludes.replace(pageBodyTemplate, finalBodyContent);
        }
    } else {
        // --- Old file-based mode (backward compatibility) ---
        let combinedHtmlContent = "";
        for (const inputPath of inputPaths) {
            console.log(`--- Обработка файла: ${path.basename(inputPath)} ---`);
            const markdownContent = readFileSync(inputPath, 'utf-8');
            combinedHtmlContent += parseMarkdownToHtml(markdownContent);
        }

        const contentPages = await paginateContent(combinedHtmlContent, templateString, browser, '{{content}}');
        
        const bodyMatch = templateString.match(/<body[^>]*>([\s\S]*)<\/body>/);
        if (!bodyMatch) throw new Error('Invalid template: `<body>` tag not found.');
        const pageTemplate = bodyMatch[1];

        const allFinalPageBodies = contentPages.map(page => {
            return pageTemplate.replace('{{content}}', page);
        });

        const finalBodyContent = allFinalPageBodies.map((body, index) => {
            if (index < allFinalPageBodies.length - 1) {
                return `<div style="page-break-after: always;">${body}</div>`;
            }
            return body;
        }).join('');

        finalHtml = templateString.replace(pageTemplate, finalBodyContent);
    }

    await generatePdf(browser, finalHtml, outputPath);
    await browser.close();
    console.log('Конвертация успешно завершена.');
}

// CLI interface
const { inputPaths, templatePath, outputPath } = parseArgs(process.argv.slice(2));

convertMdToPdf(inputPaths, outputPath, templatePath).catch(err => {
    console.error('Ошибка:', err);
    process.exit(1);
});
