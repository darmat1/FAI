
# FAI - Figma AI Layout Generator

FAI (Figma AI) is a powerful Figma plugin that leverages large language models (both local and cloud-based) to generate entire webpage layouts from a single text prompt. It acts as a two-stage pipeline:

1.  **AI Architect:** An AI model takes your prompt and designs a structured JSON layout, including content, block types, and a color theme.
2.  **Plugin Builder:** The Figma plugin reads this JSON "blueprint" and programmatically builds the design on your canvas using real Figma layers, Auto Layout, and styles.

This tool is designed to dramatically speed up the initial wireframing and design exploration phases.

 <!-- Вы можете заменить это на свой скриншот -->

## Features

-   **Multi-AI Support:** Switch between different AI models on the fly.
    -   **Local Models via Ollama** (e.g., Llama 3, Qwen, Mistral) for privacy and offline use.
    -   **Cloud Models** (Google Gemini, OpenAI, DeepSeek) for powerful generation capabilities.
-   **Prompt-Based Generation:** Describe the website you want, and FAI will build it.
-   **Themed Designs:** The AI generates a suitable color palette (primary, background, text colors, etc.) based on your prompt, or you can specify your own.
-   **Modular Block System:** Generates pages using a system of reusable blocks:
    -   Header
    -   Hero Section
    -   Feature Grid
    -   Footer
    -   *(More blocks can be easily added)*

---

## 🚀 Quick Start & Installation

To get the plugin running locally, follow these steps.

### 1. Prerequisites (Figma's Official Guide)

This plugin template uses TypeScript and NPM, two standard tools in creating JavaScript applications.

First, download Node.js which comes with NPM. This will allow you to install TypeScript and other libraries. You can find the download link here:

  [https://nodejs.org/en/download/](https://nodejs.org/en/download/)

Next, install TypeScript globally using the command:

```bash
npm install -g typescript
```

Finally, in the directory of your plugin, get the latest type definitions for the plugin API by running:

```bash
npm install --save-dev @figma/plugin-typings
```

### 2. Compile the Plugin

Using TypeScript requires a compiler to convert TypeScript (`code.ts`) into JavaScript (`code.js`) for Figma to run. We recommend using Visual Studio Code:

1.  Download Visual Studio Code if you haven't already: [https://code.visualstudio.com/](https://code.visualstudio.com/).
2.  Open this plugin directory in Visual Studio Code.
3.  Compile TypeScript to JavaScript: Run the **"Terminal > Run Build Task..."** menu item (or press `Ctrl+Shift+B` / `Cmd+Shift+B`).
4.  Select **`tsc: watch - tsconfig.json`** from the dropdown.

That's it! VS Code will now watch for changes in `code.ts` and automatically regenerate the `code.js` file every time you save.

### 3. Run the Plugin in Figma

1.  Open the Figma desktop app.
2.  Go to `Plugins` > `Development` > `Import plugin from manifest...`.
3.  Select the `manifest.json` file from this project's directory.
4.  You can now run the plugin by going to `Plugins` > `Development` > `FAI`.

---

## ⚙️ Configuration & Usage

### Setting Up AI Models

The first time you run the plugin, you must configure your AI models.

1.  Click the **settings icon (⚙️)** in the top-right corner of the plugin.
2.  Select a model provider from the dropdown menu.
3.  **For Cloud Models (Gemini, OpenAI, DeepSeek):** Paste your API key into the corresponding input field.
4.  **For Local Models (Ollama):** Enter the name of the model you have installed (e.g., `llama3`, `qwen:7b`).
5.  Click **"Save"**.

### ⭐ Important: Running Ollama for Local Models

For the plugin to connect to your local Ollama server, you must start Ollama with the correct CORS policy to bypass browser security restrictions.

1.  **Stop any running Ollama process.**
2.  **Start the Ollama server** with the `OLLAMA_ORIGINS` environment variable set to allow all connections. Choose the command for your operating system:

    **macOS / Linux:**
    ```bash
    OLLAMA_ORIGINS='*' ollama serve
    ```

    **Windows (Command Prompt):**
    ```bash
    set OLLAMA_ORIGINS=*
    ollama serve
    ```

    **Windows (PowerShell):**
    ```bash
    $env:OLLAMA_ORIGINS="*"
    ollama serve
    ```
    Keep this terminal window open. It is now your Ollama server.

3.  **Run your desired model.** Open a **new, separate** terminal window and run a command like:
    ```bash
    ollama run llama3
    ```
    This will load the model into memory and make it ready for requests.

### Generating a Layout

1.  In the main plugin window, type a prompt describing the website you want. Be descriptive!
    -   *Good prompt:* "A modern landing page for a fictional company called 'QuantumLeap AI' that sells AI-powered analytics tools. Use a dark theme with vibrant green accents."
    -   *Simple prompt:* "A website about cats"
2.  Click **"Generate Layout"**. The plugin will contact the selected AI model and display the generated JSON structure.
3.  Once the JSON appears, a new button, **"Draw on Canvas"**, will become active. Click it.
4.  Watch as the plugin builds your design on the Figma canvas!

---

#### About TypeScript

If you are familiar with JavaScript, TypeScript will look very familiar. In fact, valid JavaScript code is already valid TypeScript code.

TypeScript adds type annotations to variables. This allows code editors such as Visual Studio Code to provide information about the Figma API while you are writing code, as well as help catch bugs you previously didn't notice.

For more information, visit [https://www.typescriptlang.org/](https://www.typescriptlang.org/)