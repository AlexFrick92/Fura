const path = require('path');
const fs = require('fs');

function parseArgs(args) {
    // Project-based mode
    if (args.length === 1) {
        const projectDir = path.resolve(args[0]);

        if (fs.existsSync(projectDir) && fs.lstatSync(projectDir).isDirectory()) {
            const templatePath = path.join(projectDir, 'template.html');
            const outputDir = path.join(projectDir, 'output');
            const projectName = path.basename(projectDir);
            const outputPath = path.join(outputDir, `${projectName}.pdf`);

            // The entry point is now the template. We no longer look for content.md here.
            if (!fs.existsSync(templatePath)) {
                console.error(`Ошибка: Не найден template.html в директории проекта: ${projectDir}`);
                process.exit(1);
            }

            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // Return an empty inputPaths array. The new logic will get includes from the template.
            return { inputPaths: [], templatePath, outputPath };
        } else {
            console.error(`Ошибка: Директория проекта не найдена или не является директорией: ${args[0]}`);
            process.exit(1);
        }
    }

    // File-based mode (backward compatibility)
    if (args.length < 3) {
        console.log('Использование:');
        console.log('  Режим проекта: node src/index.js <project_directory>');
        console.log('  Файловый режим: node src/index.js <input.md> [more_inputs.md...] <template.html> <output.pdf>');
        process.exit(1);
    }

    const inputPaths = args.slice(0, -2).map(p => path.resolve(p));
    const templatePath = path.resolve(args[args.length - 2]);
    const outputPath = path.resolve(args[args.length - 1]);

    return { inputPaths, templatePath, outputPath };
}

module.exports = {
    parseArgs,
};
