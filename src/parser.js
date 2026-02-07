const MarkdownIt = require('markdown-it');

const md = new MarkdownIt({ html: true });

function parseMarkdownToHtml(markdownContent) {
    return md.render(markdownContent);
}

module.exports = {
    parseMarkdownToHtml,
};
