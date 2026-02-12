# Refactor: Template-Driven Content Inclusion

## Overview
The tool will be updated to support a "magazine-style" layout. The main `template.html` will be able to include multiple Markdown sources. A distinction will be made between small, static includes (`{{filename.md}}`) and one primary, paginated content block that flows across pages, which will use a special syntax: `{{ FURA:PAGINATE content.md }}`.

## Step-by-step (Old Task Summary)
*This section summarizes the previously completed refactoring.*
1. Implemented a "project mode" in `src/cli.js`.
2. Preserved backward compatibility for file-based arguments.

## Step-by-step (New Task)
1.  **Rework Core Logic in `index.js`:**
    a. **Simple Includes:** First, find and replace all simple `{{*.md}}` placeholders in the template with their corresponding HTML content.
    b. **Paginated Include:** Identify the single special placeholder `{{ FURA:PAGINATE *.md }}` and extract the path to the main markdown file.
    c. **Content Preparation:** Read and convert the main markdown file to a single HTML string.
    d. **Pagination:** Pass the main content HTML and the partially-resolved template to the `paginateContent` function.
    e. **Final Assembly:** Stitch the resulting pages together with page breaks to create the final document.
2.  **Adapt `paginator.js`:** Modify the `paginateContent` function. Instead of a hardcoded `{{content}}` placeholder, it must now accept the specific placeholder string (e.g., `{{ FURA:PAGINATE content.md }}`) that it needs to replace for its measurements.
3.  **Testing:** Create a new example project with a template that includes both simple and paginated placeholders to verify the new, flexible layout logic.

## Progress

## Summary
