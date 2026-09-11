# Semantic Relevance & Space Analyzer — Технический план реализации

Документ фиксирует технические решения для реализации требований, описанных в [docs/spec.md](./spec.md). Описывает стек, архитектуру компонентов и схему данных. Реализация кода — вне рамок этого документа.

## 1. Стек и библиотеки

### 1.1 UI-слой

| Назначение | Выбор | Обоснование |
|---|---|---|
| Фреймворк | React 18 + Vite | Быстрый dev-server и сборка, нативная поддержка ESM, минимальный boilerplate по сравнению с CRA. |
| Стилизация | TailwindCSS | Утилитарные классы ускоряют вёрстку панелей настроек, карточек и форм; хорошо сочетается со Shadcn UI. |
| Компоненты UI | Shadcn UI | Готовые доступные (a11y) примитивы (Dialog, Slider, Tabs, Card, Select, Tooltip) поверх Radix UI — нужны для формы, порогового слайдера (Tether threshold) и карточек Deep Analysis. |
| Иконки | lucide-react | Стандартный набор иконок для Shadcn-экосистемы. |

### 1.2 Визуализации

| Визуализация | Библиотека | Обоснование выбора |
|---|---|---|
| **Relevance Dashboard** (линейный график по чанкам, п. 3.4 спецификации) | **Recharts** | React-нативный API, готовые `LineChart`/`ReferenceArea` для отрисовки трёх зон релевантности (Highly Relevant / Broad Match / Noise), встроенные `Tooltip` и обработчики кликов по точкам — закрывает требование п. 4.1 (hover, клик по чанку) с минимумом кода. |
| **Semantic Proximity Map** (радиальная карта близости чанков, п. 3.3) | **D3.js** (поверх SVG, управляемого React) | Это не «паучий» radar-график (несколько осей-метрик), а радиальный scatter: расстояние точки от центра = семантическая дистанция. Recharts/Chart.js не предоставляют такой примитив «из коробки». D3 даёт контроль над радиальной шкалой (`d3.scaleRadial`), концентрическими зонами-кольцами и кастомными hover/click-взаимодействиями. React управляет жизненным циклом компонента и данными; D3 используется как библиотека вычисления геометрии и шкал (без захвата DOM у React, где это возможно). |
| **Comparison Vector Map** (граф конкурентного анализа с Tether-линиями, п. 3.5) | **React Flow** + D3 (для раскладки) | React Flow даёт из коробки pan/zoom, hover-состояния узлов/рёбер, кастомные узлы (ромб для keyword, точки для страниц) и кастомные рёбра (Tether-линии с толщиной/прозрачностью по силе similarity) — существенно меньше самописного кода, чем чистый D3 force-graph. Позиции узлов вычисляются заранее (не силовая физика): радиальная раскладка на основе cosine similarity к ключевому слову (через `d3.scaleLinear`/`scaleRadial`), затем передаются в React Flow как фиксированные координаты. Фильтрация по Tether threshold (п. 4.1) реализуется через `useMemo`-фильтрацию массива рёбер по значению слайдера — без пересчёта раскладки. |
| Облако тегов Missing Entities | Кастомный компонент на Flexbox/Tailwind (без отдельной библиотеки) | Достаточно вариативного размера/цвета шрифта по частоте/значимости сущности; отдельная библиотека избыточна. |

Решение сознательно не использует один универсальный чарт-фреймворк на все три визуализации: Relevance Dashboard — это стандартный временной/позиционный line chart (Recharts закрывает это полностью), а обе карты (Proximity Map и Comparison Map) требуют кастомной геометрии, для которой Recharts/Chart.js не предназначены.

### 1.3 Эмбеддинги и математика

| Назначение | Решение |
|---|---|
| Локальные эмбеддинги в браузере | `@xenova/transformers` (Transformers.js), модель класса `Xenova/all-MiniLM-L6-v2` — работает полностью на клиенте, без API-ключа и без backend. Используется как основной вариант «реального режима» без внешних затрат. |
| Облачные эмбеддинги | OpenAI Embeddings API, модель `text-embedding-3-small` — используется при наличии у пользователя API-ключа, даёт более качественные векторы. **Важно**: прямой вызов OpenAI API из браузера требует передачи ключа на клиенте, что небезопасно для продакшена. В рамках SPA ключ хранится только в памяти сессии (не персистится), рекомендуется опциональный backend-прокси в будущих итерациях — вне рамок текущего плана. |
| Абстракция провайдера эмбеддингов | Единый интерфейс `EmbeddingProvider` с тремя реализациями: `MockEmbeddingProvider` (детерминированные псевдослучайные векторы для демо-режима), `TransformersEmbeddingProvider`, `OpenAIEmbeddingProvider`. Выбор реализации управляется настройкой режима (см. п. 4.2 спецификации). |
| Cosine Similarity | Единая утилитарная функция вычисления косинусного сходства между двумя векторами одинаковой размерности; используется всеми потребителями (chunk↔keyword, page↔keyword, page↔page для Comparison Map). |
| Chunking | Утилита разбиения текста на чанки (по абзацам с ограничением по длине в токенах/символах, конфигурируемая стратегия — см. п. 3.2 спецификации). |

### 1.4 Состояние приложения

- **Zustand** — единый лёгкий стор для результатов анализа (`AnalysisResult`), настроек режима (mock/transformers/openai) и общего состояния UI, разделяемого между визуализациями (например, `tetherThreshold`, выбранный/подсвеченный `chunkId`). Выбран вместо React Context + useReducer из-за меньшего boilerplate при частых точечных обновлениях (слайдер порога дергает перерисовку только Comparison Map, а не всего дерева), и вместо Redux — из-за отсутствия необходимости в middleware/devtools-инфраструктуре для SPA такого масштаба.

## 2. Архитектура компонентов

```
src/
├── components/
│   ├── config/
│   │   └── AnalysisForm.jsx          # Ввод URL/текста, Target Keyword, Target Audience,
│   │                                  # Content Purpose, Website Niche, список конкурентов
│   ├── visualizations/
│   │   ├── ProximityRadar.jsx        # Радар близости чанков (D3 + SVG)
│   │   ├── RelevanceChart.jsx        # Линейный график релевантности по чанкам (Recharts)
│   │   └── ComparisonVectorMap.jsx   # Граф конкурентного анализа (React Flow + D3-раскладка)
│   ├── analysis/
│   │   └── DeepAnalysisCards.jsx     # Executive Summary, Missing Entities, Suggestions
│   ├── content/
│   │   └── SourceTextPanel.jsx       # Отображение исходного текста/чанков с подсветкой
│   │                                  # выбранного чанка (клик из RelevanceChart/ProximityRadar)
│   ├── layout/
│   │   ├── SettingsPanel.jsx         # Переключатель режима Mock / Transformers.js / OpenAI,
│   │   │                              # поле ввода OpenAI API key (session-only)
│   │   └── AppShell.jsx              # Общая разметка страницы
│   └── ui/                            # Сгенерированные примитивы Shadcn UI
├── services/
│   ├── embeddings/
│   │   ├── EmbeddingProvider.js      # Интерфейс/контракт провайдера
│   │   ├── mockEmbeddingProvider.js
│   │   ├── transformersEmbeddingProvider.js
│   │   └── openaiEmbeddingProvider.js
│   ├── chunking/
│   │   └── chunkText.js
│   ├── similarity/
│   │   └── cosineSimilarity.js
│   ├── analysisPipeline.js           # Оркестрация: chunk → embed → similarity → AnalysisResult
│   ├── deepAnalysisService.js        # Формирование Executive Summary / Missing Entities /
│   │                                  # Suggestions (mock-генератор либо вызов LLM)
│   └── mockData/
│       └── fixtures.js               # Наборы демо-данных для Mock-режима
├── store/
│   ├── useAnalysisStore.js           # Zustand: AnalysisResult, статус загрузки, ошибки
│   └── useSettingsStore.js           # Zustand: режим эмбеддингов, tetherThreshold, apiKey
├── types/
│   └── models.js                     # JSDoc-описания моделей данных (см. раздел 3)
├── utils/
│   └── relevanceZones.js             # Классификация similarity → Highly Relevant/Broad Match/Noise
├── App.jsx
└── main.jsx
```

### 2.1 Поток данных

1. `AnalysisForm` собирает входные параметры и вызывает `analysisPipeline`.
2. `analysisPipeline` использует `chunkText` → активный `EmbeddingProvider` (по настройке из `useSettingsStore`) → `cosineSimilarity` → собирает `AnalysisResult` и кладёт его в `useAnalysisStore`.
3. Аналогичный пайплайн выполняется для страниц конкурентов (`CompetitorSite[]`), если они указаны в форме.
4. `deepAnalysisService` вызывается параллельно/после основного пайплайна и дополняет `AnalysisResult.deepAnalysis`.
5. `ProximityRadar`, `RelevanceChart`, `ComparisonVectorMap`, `DeepAnalysisCards`, `SourceTextPanel` — независимые подписчики на `useAnalysisStore`, перерисовываются при обновлении результата.
6. Клик по чанку в `RelevanceChart`/`ProximityRadar` записывает `highlightedChunkId` в `useAnalysisStore`; `SourceTextPanel` подсвечивает соответствующий диапазон текста (реализует критерий п. 4.1).
7. Изменение `tetherThreshold` в `ComparisonVectorMap` (слайдер Shadcn) обновляет `useSettingsStore` и мгновенно пересчитывает видимые рёбра через `useMemo`, без повторной раскладки узлов.

## 3. Схема данных (Data Models)

Ниже — JSDoc-описания моделей данных, используемых во всём приложении (файл `src/types/models.js`). Формат JSDoc выбран для совместимости с обычным `.jsx`/`.js` без обязательного перехода на TypeScript; при необходимости эти же контракты напрямую переносятся в `.ts`-интерфейсы.

```js
/**
 * Смысловой фрагмент анализируемого текста.
 * @typedef {Object} Chunk
 * @property {string} id
 * @property {string} text                 - Текст фрагмента.
 * @property {number} index                - Порядковая позиция чанка в исходном документе.
 * @property {number} charStart            - Смещение начала фрагмента в исходном тексте (для подсветки).
 * @property {number} charEnd              - Смещение конца фрагмента в исходном тексте.
 * @property {number[]|null} embedding     - Векторное представление чанка.
 * @property {number} similarity           - Cosine similarity к Target Keyword, диапазон [0, 1].
 * @property {'highly_relevant'|'broad_match'|'noise'} relevanceZone
 *   - Производное поле: highly_relevant >0.65, broad_match 0.43–0.64, noise <0.43.
 */

/**
 * Векторное представление одной страницы (целевой или конкурента) для карт близости/сравнения.
 * @typedef {Object} PageVector
 * @property {string} id
 * @property {string|null} url             - null, если страница задана как сырой текст без URL.
 * @property {string} label                - Отображаемое имя узла на графах.
 * @property {'target'|'competitor'} type
 * @property {string|null} competitorId    - Ссылка на CompetitorSite.id, если type === 'competitor'.
 * @property {number[]} embedding          - Агрегированный вектор страницы (например, среднее по chunk.embedding).
 * @property {number} similarityToKeyword  - Cosine similarity вектора страницы к Target Keyword.
 * @property {string[]} chunkIds           - Ссылки на связанные Chunk.id (для target-страницы).
 */

/**
 * Конкурентный сайт и его страницы, участвующие в Comparison Map.
 * @typedef {Object} CompetitorSite
 * @property {string} id
 * @property {string} name
 * @property {string} url
 * @property {string} color                - Цвет узлов конкурента на графах (назначается детерминированно).
 * @property {PageVector[]} pages
 */

/**
 * Результат Deep AI Semantic Analysis.
 * @typedef {Object} DeepAnalysis
 * @property {string} executiveSummary
 * @property {string[]} missingEntities
 * @property {{ id: string, title: string, description: string, priority: 'high'|'medium'|'low' }[]} suggestions
 */

/**
 * Полный результат одного анализа — центральный объект состояния приложения.
 * @typedef {Object} AnalysisResult
 * @property {string} id
 * @property {string} createdAt            - ISO-дата.
 * @property {string} targetKeyword
 * @property {number[]} keywordEmbedding
 * @property {{ type: 'url'|'text', value: string }} inputSource
 * @property {{ targetAudience: string, contentPurpose: string, websiteNiche: string }} meta
 * @property {Chunk[]} chunks
 * @property {PageVector} targetPage
 * @property {CompetitorSite[]} competitors
 * @property {DeepAnalysis|null} deepAnalysis
 * @property {'mock'|'transformers'|'openai'} embeddingMode
 *   - Режим, в котором был выполнен данный анализ (см. критерий п. 4.2 спецификации).
 */
```

Дополнительно (конфигурация UI, не часть результата анализа):

```js
/**
 * @typedef {Object} AppSettings
 * @property {'mock'|'transformers'|'openai'} embeddingMode
 * @property {string|null} openaiApiKey     - Хранится только в памяти сессии, не персистится.
 * @property {number} tetherThreshold       - Порог cosine similarity [0, 1] для видимости рёбер Comparison Map.
 */
```

## 4. Вне рамок текущего плана

Развёртывание (deployment), тестовая стратегия (unit/e2e), обработка ошибок сети при получении контента по URL (включая парсинг HTML на сервере/прокси, т.к. браузер не может напрямую скачать произвольный внешний URL из-за CORS), а также backend-прокси для безопасного хранения OpenAI API-ключа — не входят в рамки данного документа и подлежат отдельной проработке.
