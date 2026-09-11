# Semantic Relevance & Space Analyzer

Инструмент для семантического анализа веб-контента, который помогает SEO-специалистам и контент-стратегам оценивать релевантность страниц относительно целевых ключевых слов и строить визуальные семантические карты.

## 🎯 Основные возможности

- **Семантический анализ контента** — разбиение текста на смысловые фрагменты (чанки) и вычисление их релевантности к целевому ключевому слову
- **Визуализации данных**:
  - **Semantic Proximity Map** — радиальная карта близости чанков к ключевому слову
  - **Semantic Relevance Dashboard** — линейный график релевантности по чанкам с зонами (Highly Relevant / Broad Match / Noise)
  - **Comparison Map** — граф конкурентного анализа с Tether-линиями и фильтрацией по порогу
- **Deep AI Semantic Analysis** — генерация Executive Summary, облака Missing Entities и Actionable Suggestions
- **Интерактивность** — клик по чанку подсвечивает соответствующий фрагмент в исходном тексте
- **Режимы работы**:
  - **Demo** — демо-режим с mock-данными
  - **Local AI** — локальные эмбеддинги через Transformers.js (без API-ключей)
  - **OpenAI** — облачные эмбеддинги через OpenAI API

## 🛠 Технологический стек

- **Frontend**: React 19 + Vite
- **Стилизация**: TailwindCSS v4 + Shadcn UI
- **Визуализации**: Recharts (графики), D3.js (радиальные карты и графы)
- **Эмбеддинги**: 
  - `@huggingface/transformers` (локальные, модель `onnx-community/all-MiniLM-L6-v2-ONNX`)
  - OpenAI Embeddings API (`text-embedding-3-small`)
- **State Management**: Zustand
- **Математика**: Косинусное сходство, векторная арифметика

## 📋 Требования к системе

- **Node.js**: версии 18.x или выше
- **npm**: версии 9.x или выше (или yarn/pnpm)
- **Браузер**: Chrome, Firefox, Safari, Edge (современные версии)

## 🚀 Установка и запуск

### 1. Клонирование репозитория

```bash
git clone git@github.com:Zuboskalik/SiteAnalyzerTestReact.git
cd SiteAnalyzerTestReact
```

### 2. Установка зависимостей

```bash
npm install
```

### 3. Запуск dev-сервера

```bash
npm run dev
```

После запуска приложение будет доступно по адресу `http://localhost:5173`

### 4. Production-сборка (опционально)

```bash
npm run build
```

Собранные файлы будут находиться в директории `dist/`. Для локального просмотра:

```bash
npm run preview
```

## 📖 Использование

### 1. Настройка анализа

В разделе **Analysis configuration** заполните поля:

- **Target Keyword** — целевое ключевое слово или фраза (обязательно)
- **Источник контента** — выберите URL или вставьте текст
- **Target Audience** — описание целевой аудитории
- **Content Purpose** — цель контента (информационный, коммерческий и т.д.)
- **Website Niche** — ниша/тематика сайта
- **Конкуренты** — добавьте URL конкурентов для сравнительного анализа (опционально)

### 2. Выбор режима эмбеддингов

В панели **Embedding settings** выберите режим:

- **Demo** — быстрый демо-режим с mock-данными (рекомендуется для ознакомления)
- **Local AI (Transformers.js)** — локальные эмбеддинги в браузере (без API-ключей, первый запуск загрузит модель ~500MB)
- **OpenAI** — облачные эмбеддинги (требуется API-ключ)

### 3. Запуск анализа

Нажмите кнопку **Run Semantic Analysis** и дождитесь завершения обработки.

### 4. Просмотр результатов

После завершения анализа вы увидите:

- **Analysis Overview** — сводка с метриками (Avg relevance, Overall cohesion, Optimization needed)
- **Semantic Proximity Map** — радиальная карта семантической близости чанков
- **Semantic Relevance Dashboard** — график релевантности по чанкам
- **Comparison Map** — граф конкурентного анализа с фильтрацией по Tether threshold
- **Deep AI Semantic Analysis** — карточки с AI-анализом:
  - Executive Summary
  - Missing Semantic Entities
  - Actionable Optimization Suggestions
- **Source Text** — исходный текст с подсветкой чанков

### 5. Интерактивность

- **Клик по точке на графике** — подсвечивает соответствующий чанк в исходном тексте
- **Hover** — показывает детальную информацию о чанке/узле
- **Слайдер Tether threshold** — фильтрует связи на Comparison Map в реальном времени
- **Клавиатурная навигация** — Tab + Enter/Space для выбора чанков

## 📁 Структура проекта

```
src/
├── components/
│   ├── analysis/          # Deep Analysis карточки
│   ├── config/            # Форма настройки анализа
│   ├── content/           # Панель исходного текста
│   ├── layout/            # Layout компоненты
│   ├── ui/                # Shadcn UI примитивы
│   └── visualizations/    # Графики и карты
├── services/
│   ├── embeddings/        # Провайдеры эмбеддингов
│   ├── analysisPipeline.js # Оркестрация анализа
│   └── deepAnalysisService.js # Генерация Deep Analysis
├── store/                 # Zustand сторы
├── types/                 # JSDoc типы данных
├── utils/                 # Утилиты (математика, layout)
└── mocks/                 # Mock-данные для демо-режима
```

## 🧪 Тестирование

```bash
npm run test
```

## 🔧 Конфигурация

### TailwindCSS v4

Проект использует TailwindCSS v4 с плагином `@tailwindcss/vite`. Конфигурация находится в `vite.config.js` и `src/index.css`.

### Shadcn UI

UI-компоненты сгенерированы через Shadcn UI (стиль `radix-nova`). Конфигурация в `components.json`.

## 📝 Документация

- **Спецификация**: `docs/spec.md` — функциональные требования
- **Технический план**: `docs/plan.md` — архитектура и стек
- **Чек-лист задач**: `docs/tasks.md` — статус реализации

## ⚠️ Ограничения

- **Загрузка URL из браузера** — ограничена CORS политикой. Для внешних сайтов используйте вкладку Text или настройте серверный прокси.
- **OpenAI API ключ** — хранится только в памяти сессии, не персистируется. Для продакшена рекомендуется использовать backend-прокси.
- **Размер бандла** — Transformers.js WASM ~500MB загружается только при выборе режима Local AI.

## 🤝 Вклад в проект

Проект находится в активной разработке. Для внесения изменений:

1. Создайте fork репозитория
2. Создайте ветку для вашей фичи (`git checkout -b feature/amazing-feature`)
3. Закоммитьте изменения (`git commit -m 'Add amazing feature'`)
4. Запушьте в ветку (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

## 📄 Лицензия

[Укажите лицензию вашего проекта]

## 🙏 Acknowledgments

- Дизайн вдохновлён современными SEO-инструментами для семантического анализа
- Используются открытые библиотеки: Recharts, D3.js, Transformers.js, Shadcn UI
