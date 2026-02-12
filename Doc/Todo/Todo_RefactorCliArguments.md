# Refactor CLI arguments

## Overview
Modify the `src/cli.js` file to support a new project-based command-line interface. Instead of explicitly providing input, template, and output paths, the user will provide a single path to a project directory. The tool will then discover the necessary files (`content.md`, `template.html`) and determine the output path (`<project_name>.pdf` in `output/`) based on a predefined convention. The old argument parsing method should be preserved for backward compatibility.

## Step-by-step 
1. Read the current `src/cli.js` to understand its argument parsing logic.
2. Implement new logic in `src/cli.js` to handle a single argument as a project directory path.
3. Within the project mode, derive `inputPaths` from `projectDir/content.md`.
4. Within the project mode, derive `templatePath` from `projectDir/template.html`.
5. Within the project mode, derive `outputPath` from `projectDir/output/<project_name>.pdf`.
6. Ensure the old argument parsing logic for multiple file paths remains functional for backward compatibility.
7. Update the usage message to explain both the project-based and file-based modes.

## Progress

## Summary
