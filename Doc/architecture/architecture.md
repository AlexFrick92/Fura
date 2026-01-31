# Технический стек Fura

## Основные инструменты

### Node.js
Runtime для выполнения JavaScript кода.

### markdown-it
Парсер Markdown разметки. Конвертирует `.md` файлы в HTML.

### Puppeteer
Headless Chrome браузер для генерации PDF из HTML.
- Поддержка CSS для стилизации
- Настройка параметров страницы (формат A4, отступы)
- Опция `printBackground: true` для печати фоновых стилей

## Структура файлов

```
src/index.js        - основной код конвертера
examples/           - примеры markdown и HTML шаблонов
output/             - результаты конвертации (PDF файлы)
```

## CLI использование

```bash
node src/index.js <input.md> <template.html> <output.pdf>
```
