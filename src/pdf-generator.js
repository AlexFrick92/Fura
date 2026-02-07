async function generatePdf(browser, finalHtmlContent, outputPath) {
    console.log('Генерация итогового PDF...');
    const pdfPage = await browser.newPage();
    await pdfPage.setContent(finalHtmlContent, { waitUntil: 'networkidle0' });
    await pdfPage.pdf({
        path: outputPath,
        format: 'A4',
        printBackground: true
    });
    console.log(`PDF успешно создан: ${outputPath}`);
}

module.exports = {
    generatePdf,
};
