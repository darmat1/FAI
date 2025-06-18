interface RenderLayoutMessage {
  type: 'render-layout';
  layoutData: string;
}
interface Settings {
  model: 'gemini' | 'openai' | 'deepseek' | 'ollama';
  keys: {
    gemini: string;
    openai: string;
    deepseek: string;
  };
  ollama?: { // Делаем опциональным
    modelName: string;
  };
}

interface SaveSettingsMessage {
  type: 'save-settings';
  settings: Settings;
}

interface GetSettingsMessage {
  type: 'get-settings';
}

interface AskAiMessage {
  type: 'ask-ai';
  prompt: string;
}

type PluginMessage = SaveSettingsMessage | GetSettingsMessage | AskAiMessage | RenderLayoutMessage;


// --- Основная логика плагина ---
figma.showUI(__html__, { width: 400, height: 450 });

const SETTINGS_KEY = 'multi-ai-assistant-settings';

figma.ui.onmessage = async (msg: PluginMessage) => {
  if (msg.type === 'save-settings') {
    await figma.clientStorage.setAsync(SETTINGS_KEY, msg.settings);
    figma.notify('Settings saved!');
  }

  if (msg.type === 'get-settings') {
    const settings = await figma.clientStorage.getAsync(SETTINGS_KEY) as Settings;
    figma.ui.postMessage({ type: 'settings-loaded', settings });
  }

  if (msg.type === 'ask-ai') {
    const settings = await figma.clientStorage.getAsync(SETTINGS_KEY) as Settings;

    if (!settings || !settings.model) {
      figma.ui.postMessage({ type: 'error', text: 'Please select a model in settings.' });
      return;
    }

    const { model, keys, ollama } = settings;
    const userPrompt = msg.prompt;

    // Системный промпт (без изменений)
    const systemPrompt = `
    You are an expert UX/UI designer acting as a Figma layout generator.
    Your task is to take a user's request and convert it into a structured JSON layout.
    The JSON object must have a 'pageName', a 'theme' object, and an array of 'blocks'.

    The 'theme' object must contain the following keys with HEX color codes:
    - 'primary': The main accent color for buttons and highlights.
    - 'background': The main page background color.
    - 'cardBackground': The background color for cards or sections.
    - 'textColor': The primary text color.
    - 'secondaryTextColor': The color for subtitles and less important text.

    Each block must have a 'type' and 'content'. Here are the available block types:
    - type: 'header', content: { logoText: string, navLinks: string[], ctaButton: string }
    - type: 'hero', content: { title: string, subtitle: string, ctaButton: string, imagePlaceholder: boolean }
    - type: 'feature_grid', content: { title: string, features: { icon: 'star' | 'check' | 'heart', title: string, description: string }[] }
    - type: 'footer', content: { footerText: string, links: string[] }

    Generate ONLY the JSON object, without any extra explanations or markdown formatting.
    If the user specifies colors (e.g., "in dark theme", "with blue accents"), use them. Otherwise, choose a suitable palette.

    Example user request: "A landing page for a productivity app called 'Flow' in a clean, minimalist style"
    Example JSON output:
    {
      "pageName": "Flow Landing Page",
      "theme": {
        "primary": "#007AFF",
        "background": "#FFFFFF",
        "cardBackground": "#F2F2F7",
        "textColor": "#1C1C1E",
        "secondaryTextColor": "#6E6E73"
      },
      "blocks": [
        {
          "type": "header",
          "content": {
            "logoText": "Flow",
            "navLinks": ["Features", "Pricing", "About"],
            "ctaButton": "Sign Up"
          }
        }
      ]
    }
  `;
    const finalPrompt = `${systemPrompt}\n\nUser request: "${userPrompt}"\n\nJSON output:`;

    try {
      let requestBody: object;
      let requestUrl: string;
      let requestHeaders;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parseResponse: (data: any) => string;

      // --- 👇 ГЛАВНОЕ ИЗМЕНЕНИЕ НАЧИНАЕТСЯ ЗДЕСЬ ---

      // Обрабатываем локальную модель отдельно
      if (model === 'ollama') {
        if (!ollama?.modelName) {
          throw new Error("Ollama model name is not set in settings.");
        }
        requestUrl = 'http://localhost:11434/v1/chat/completions';
        requestHeaders = { 'Content-Type': 'application/json' };
        requestBody = {
          model: ollama.modelName,
          messages: [{ role: 'user', content: finalPrompt }],
          stream: false
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parseResponse = (data: any) => data.choices[0].message.content;

      } else {
        // Обрабатываем все облачные модели, которым нужен ключ
        if (!keys) {
          throw new Error("API keys are not configured in settings.");
        }
        const apiKey = keys[model]; // Теперь это безопасно, т.к. 'ollama' исключен

        if (!apiKey) {
          throw new Error(`API key for ${model} not found. Please check your settings.`);
        }

        // Конфигурируем запрос в зависимости от облачной модели
        switch (model) {
          case 'gemini':
            requestUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
            requestHeaders = { 'Content-Type': 'application/json' };
            requestBody = { contents: [{ parts: [{ text: finalPrompt }] }] };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            parseResponse = (data: any) => data.candidates[0].content.parts[0].text;
            break;

          case 'openai':
            requestUrl = 'https://api.openai.com/v1/chat/completions';
            requestHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
            requestBody = { model: 'gpt-4o-mini', messages: [{ role: 'user', content: finalPrompt }] };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            parseResponse = (data: any) => data.choices[0].message.content;
            break;

          case 'deepseek':
            requestUrl = 'https://api.deepseek.com/chat/completions';
            requestHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
            requestBody = { model: 'deepseek-chat', messages: [{ role: 'user', content: finalPrompt }] };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            parseResponse = (data: any) => data.choices[0].message.content;
            break;
        }
      }

      // --- 👆 ГЛАВНОЕ ИЗМЕНЕНИЕ ЗАКАНЧИВАЕТСЯ ЗДЕСЬ ---

      // Отправляем запрос (этот блок остается без изменений)
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `HTTP Error: ${response.status}`);
      }

      const data = await response.json();
      const aiText = parseResponse(data);

      figma.ui.postMessage({ type: 'ai-response', text: aiText });

    } catch (error) {
      if (error instanceof Error) {
        figma.ui.postMessage({ type: 'error', text: error.message });
      } else {
        figma.ui.postMessage({ type: 'error', text: 'An unknown error occurred.' });
      }
    }
  }

  if (msg.type === 'render-layout') {
    try {
      const layout = cleanAndParseJSON(msg.layoutData);

      if (!layout.pageName || !Array.isArray(layout.blocks) || !layout.theme) {
        throw new Error('Invalid JSON structure. Could not find pageName, blocks, or theme.');
      }

      const theme = layout.theme;

      await figma.loadFontAsync({ family: "Inter", style: "Regular" });
      await figma.loadFontAsync({ family: "Inter", style: "Bold" });

      const pageFrame = figma.createFrame();
      pageFrame.name = layout.pageName;
      pageFrame.layoutMode = "VERTICAL";
      pageFrame.paddingTop = 0;
      pageFrame.paddingBottom = 0;
      pageFrame.paddingLeft = 0;
      pageFrame.paddingRight = 0;
      pageFrame.itemSpacing = 0; // Блоки будут прилегать друг к другу
      pageFrame.fills = [{ type: 'SOLID', color: hexToRgb(theme.background) }];
      pageFrame.resize(1440, 100);

      for (const block of layout.blocks) {
        let blockFrame: FrameNode | null = null;

        switch (block.type) {
          case 'header':
            blockFrame = createHeader(block.content, theme);
            break;
          case 'hero':
            blockFrame = createHero(block.content, theme);
            break;
          case 'feature_grid':
            // Здесь будет вызов createFeatureGrid
            blockFrame = createFeatureGrid(block.content, theme);
            break;
          case 'footer':
            // Здесь будет вызов createFooter
            blockFrame = createFooter(block.content, theme);
            break;
        }
        if (blockFrame) pageFrame.appendChild(blockFrame);
      }

      figma.currentPage.appendChild(pageFrame);
      figma.viewport.scrollAndZoomIntoView([pageFrame]);
      figma.notify('Layout generated successfully!');

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to parse or render layout.';
      figma.notify(message, { error: true });
    }
  }
};

function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  } : { r: 0, g: 0, b: 0 }; // Возвращаем черный в случае ошибки
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createHeader(content: any, theme: any): FrameNode {
  const frame = figma.createFrame();
  frame.fills = [{type: 'SOLID', color: hexToRgb(theme.background)}];
  frame.name = "Header";
  frame.layoutMode = "HORIZONTAL";
  frame.primaryAxisAlignItems = 'SPACE_BETWEEN'; // Лого слева, остальное справа
  frame.counterAxisAlignItems = 'CENTER';
  frame.layoutAlign = "STRETCH";
  frame.resize(1440, 80);
  frame.paddingLeft = 80;
  frame.paddingRight = 80;

  const logo = figma.createText();
  logo.fontName = { family: "Inter", style: "Bold" };
  logo.fontSize = 20;
  logo.characters = content.logoText || "Logo";
  logo.fills = [{type: 'SOLID', color: hexToRgb(theme.textColor)}];
  frame.appendChild(logo);

  const navContainer = figma.createFrame();
  navContainer.name = "Navigation";
  navContainer.layoutMode = "HORIZONTAL";
  navContainer.itemSpacing = 32;
  navContainer.fills = [];
  navContainer.counterAxisAlignItems = 'CENTER';

  (content.navLinks || []).forEach((linkText: string) => {
    const navLink = figma.createText();
    navLink.fontName = { family: "Inter", style: "Regular" };
    navLink.fontSize = 16;
    navLink.characters = linkText;
    navLink.fills = [{type: 'SOLID', color: hexToRgb(theme.secondaryTextColor)}];
    navContainer.appendChild(navLink);
  });
  frame.appendChild(navContainer);

  return frame;
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createHero(content: any, theme: any): FrameNode {
  const frame = figma.createFrame();
  frame.name = "Hero Section";
  frame.layoutMode = "VERTICAL";
  frame.layoutAlign = "STRETCH";
  frame.counterAxisAlignItems = 'CENTER';
  frame.itemSpacing = 24;
  frame.paddingTop = 80;
  frame.paddingBottom = 80;
  frame.paddingLeft = 200;
  frame.paddingRight = 200;
  frame.fills = [{type: 'SOLID', color: hexToRgb(theme.cardBackground)}];

  const title = figma.createText();
  title.fontName = { family: "Inter", style: "Bold" };
  title.fontSize = 56;
  title.characters = content.title || "Hero Title";
  title.textAlignHorizontal = "CENTER";
  title.layoutAlign = "STRETCH";
  title.fills = [{type: 'SOLID', color: hexToRgb(theme.textColor)}];
  frame.appendChild(title);

  const subtitle = figma.createText();
  subtitle.fontName = { family: "Inter", style: "Regular" };
  subtitle.fontSize = 20;
  subtitle.characters = content.subtitle || "Hero subtitle explaining the main value.";
  subtitle.textAlignHorizontal = "CENTER";
  subtitle.layoutAlign = "STRETCH";
  subtitle.fills = [{type: 'SOLID', color: hexToRgb(theme.secondaryTextColor)}];
  frame.appendChild(subtitle);

  if (content.ctaButton) {
    const button = figma.createFrame();
    button.name = "CTA Button";
    button.layoutMode = 'HORIZONTAL';
    button.counterAxisAlignItems = 'CENTER';
    button.primaryAxisSizingMode = 'AUTO';
    button.paddingTop = 12;
    button.paddingBottom = 12;
    button.paddingLeft = 24;
    button.paddingRight = 24;
    button.cornerRadius = 8;
    button.fills = [{type: 'SOLID', color: hexToRgb(theme.primary)}];

    const buttonText = figma.createText();
    buttonText.fontName = { family: "Inter", style: "Bold" };
    buttonText.characters = content.ctaButton;
    buttonText.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    button.appendChild(buttonText);
    frame.appendChild(button);
  }

  return frame;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cleanAndParseJSON(str: string): any {
  // Находим индекс первой открывающейся фигурной скобки
  const firstBrace = str.indexOf('{');
  // Находим индекс последней закрывающейся фигурной скобки
  const lastBrace = str.lastIndexOf('}');

  // Если обе скобки найдены и они образуют правильный порядок
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    // Извлекаем подстроку, которая является нашим JSON-объектом
    const jsonString = str.substring(firstBrace, lastBrace + 1);
    
    try {
      // Пытаемся распарсить только эту чистую строку
      return JSON.parse(jsonString);
    } catch (e) {
      // Если даже чистая строка не парсится, значит, AI сгенерировал сломанный JSON
      console.error("Failed to parse extracted JSON:", e);
      throw new Error("Failed to parse the AI's response. The generated JSON is malformed.");
    }
  }

  // Если мы не смогли найти фигурные скобки, значит, ответ AI вообще не содержит JSON
  throw new Error("Could not find a valid JSON object in the AI's response.");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createFeatureGrid(content: any, theme: any): FrameNode {
  const frame = figma.createFrame();
  frame.name = "Feature Grid";
  frame.layoutMode = "VERTICAL";
  frame.layoutAlign = "STRETCH";
  frame.counterAxisAlignItems = 'CENTER';
  frame.itemSpacing = 48;
  frame.paddingTop = 80;
  frame.paddingBottom = 80;
  frame.paddingLeft = 80;
  frame.paddingRight = 80;
  frame.fills = [{type: 'SOLID', color: hexToRgb(theme.background)}];

  if (content.title) {
    const sectionTitle = figma.createText();
    sectionTitle.fontName = { family: "Inter", style: "Bold" };
    sectionTitle.fontSize = 40;
    sectionTitle.characters = content.title;
    sectionTitle.textAlignHorizontal = "CENTER";
    sectionTitle.layoutAlign = "STRETCH";
    sectionTitle.fills = [{type: 'SOLID', color: hexToRgb(theme.textColor)}];
    frame.appendChild(sectionTitle);
  }

  // --- 👇 ГЛАВНОЕ ИЗМЕНЕНИЕ: РУЧНОЕ ПОСТРОЕНИЕ СЕТКИ ---
  const gridContainer = figma.createFrame();
  gridContainer.name = "Grid";
  gridContainer.layoutAlign = 'STRETCH'; // Растягиваем по ширине родителя
  gridContainer.fills = [];
  
  const features = content.features || [];
  const numColumns = features.length > 0 ? features.length : 3;
  const gap = 32;
  // Рассчитываем ширину контейнера. Общая ширина - боковые отступы
  const containerWidth = 1440 - (frame.paddingLeft + frame.paddingRight); 
  // Рассчитываем ширину каждой карточки
  const cardWidth = (containerWidth - (gap * (numColumns - 1))) / numColumns;
  let maxHeight = 0;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  features.forEach((feature: any, index: number) => {
    // Создаем карточку как и раньше, но без Auto Layout настроек для родителя
    const card = figma.createFrame();
    card.name = "Feature Card";
    card.layoutMode = "VERTICAL";
    card.itemSpacing = 16;
    card.paddingTop = 24;
    card.paddingBottom = 24;
    card.paddingLeft = 24;
    card.paddingRight = 24;
    card.fills = [{type: 'SOLID', color: hexToRgb(theme.cardBackground)}];
    card.cornerRadius = 16;
    // Задаем РАССЧИТАННУЮ ширину и автоматическую высоту
    card.resize(cardWidth, 100); // 100 - временная высота, Auto Layout ее исправит
    card.primaryAxisSizingMode = "AUTO";

    // ... (код для создания иконки, заголовка, описания внутри карточки остается БЕЗ ИЗМЕНЕНИЙ) ...
    const icon = figma.createEllipse();
    icon.resize(48, 48);
    icon.fills = [{type: 'SOLID', color: hexToRgb(theme.primary)}]; 
    card.appendChild(icon);

    const featureTitle = figma.createText();
    featureTitle.fontName = { family: "Inter", style: "Bold" };
    featureTitle.fontSize = 20;
    featureTitle.characters = feature.title || "Feature Title";
    featureTitle.layoutAlign = "STRETCH";
    featureTitle.fills = [{type: 'SOLID', color: hexToRgb(theme.textColor)}];
    card.appendChild(featureTitle);

    const featureDescription = figma.createText();
    featureDescription.fontName = { family: "Inter", style: "Regular" };
    featureDescription.fontSize = 14;
    featureDescription.characters = feature.description || "Feature description goes here.";
    featureDescription.layoutAlign = "STRETCH";
    featureDescription.fills = [{type: 'SOLID', color: hexToRgb(theme.secondaryTextColor)}];
    card.appendChild(featureDescription);

    // Добавляем карточку в контейнер
    gridContainer.appendChild(card);
    
    // Позиционируем карточку вручную
    card.x = index * (cardWidth + gap);

    // Находим максимальную высоту карточки
    if (card.height > maxHeight) {
      maxHeight = card.height;
    }
  });
  
  // Устанавливаем высоту контейнера равной высоте самой высокой карточки
  gridContainer.resize(gridContainer.width, maxHeight);
  
  frame.appendChild(gridContainer);
  return frame;
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createFooter(content: any, theme: any): FrameNode {
  const frame = figma.createFrame();
  frame.name = "Footer";
  frame.layoutMode = "VERTICAL";
  frame.layoutAlign = "STRETCH";
  frame.counterAxisAlignItems = 'CENTER';
  frame.itemSpacing = 24;
  frame.paddingTop = 60;
  frame.paddingBottom = 60;
  frame.paddingLeft = 80;
  frame.paddingRight = 80;
  // Используем цвет фона карточки или чуть темнее основного
  frame.fills = [{ type: 'SOLID', color: hexToRgb(theme.cardBackground || '#F2F2F7') }];

  // Контейнер для ссылок, если они есть
  if (content.links && content.links.length > 0) {
    const linksContainer = figma.createFrame();
    linksContainer.name = "Footer Links";
    linksContainer.layoutMode = "HORIZONTAL";
    linksContainer.itemSpacing = 32;
    linksContainer.fills = []; // Прозрачный фон
    
    content.links.forEach((linkText: string) => {
      const link = figma.createText();
      link.fontName = { family: "Inter", style: "Regular" };
      link.fontSize = 14;
      link.characters = linkText;
      link.fills = [{ type: 'SOLID', color: hexToRgb(theme.secondaryTextColor || '#6E6E73') }];
      linksContainer.appendChild(link);
    });
    
    frame.appendChild(linksContainer);
  }

  // Текст с копирайтом
  const footerText = figma.createText();
  footerText.fontName = { family: "Inter", style: "Regular" };
  footerText.fontSize = 12;
  footerText.characters = content.footerText || `© ${new Date().getFullYear()} MyApp. All rights reserved.`;
  footerText.fills = [{ type: 'SOLID', color: hexToRgb(theme.secondaryTextColor || '#6E6E73') }];
  frame.appendChild(footerText);

  return frame;
}