const fs = require('fs');
const path = require('path');

function readFileSync(filePath, encoding = 'utf-8') {
    return fs.readFileSync(path.resolve(filePath), encoding);
}

module.exports = {
    readFileSync,
};
