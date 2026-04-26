# DeFi Activity Monitor — Netlify edition

MVP для Netlify:
- Aave V3 работает через Netlify Function
- NAVI и Nostra пока как каркас
- фронтенд лежит в public/index.html

## Деплой через GitHub + Netlify

1. Создай репозиторий на GitHub.
2. Залей туда все файлы проекта.
3. В Netlify нажми:
 Add new project -> Import an existing project -> GitHub
4. Выбери репозиторий.
5. Build command оставь пустым.
6. Publish directory: public
7. Нажми Deploy.

## Структура

defi-netlify-v1/
├── README.md
├── netlify.toml
├── package.json
├── public/
│ └── index.html
└── netlify/
 └── functions/
 ├── aave-positions.js
 ├── navi-positions.js
 └── nostra-positions.js
