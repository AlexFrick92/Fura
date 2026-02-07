const path = require('path');

function parseArgs(args) {
    if (args.length < 3) {
        console.log('Использование: node src/index.js <input1.md> [input2.md ...] <template.html> <output.pdf>');
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
