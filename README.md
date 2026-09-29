# Parfumerie

Онлайн магазин за парфюми и отливки, изграден с Medusa v2 и Next.js. В момента е локален проект за разработка; доставките и плащанията в checkout са тестови и не приемат реални плащания или заявки към куриери.

## Стартиране локално

В Windows стартирайте `D:\\New_project\\start-dev.cmd`. Скриптът използва включения Node.js 22 и PostgreSQL 17 и пуска Medusa и storefront.

- Storefront: http://localhost:8000
- Административен панел: http://localhost:9000/app
- Backend health: http://localhost:9000/health
- Спиране: `D:\\New_project\\stop-dev.cmd`

За ръчни команди в тази работна среда изберете включения Node.js 22 в PowerShell. На друга машина инсталирайте Node.js `^20.19.0 || >=22.12.0` и npm 10.9.3:

```powershell
$env:Path = "D:\New_project\.tools\node-22;$env:Path"
npm --version
npm ci
npm run lint
npm run typecheck
npm run test:unit
```

Българските публични адреси са без префикс на държава: `/parfyumi`, `/otlivki`, `/dizaynerski-kashti`, `/parfyumni-notki`, `/lyubimi`, `/koshnitsa`, `/vhod` и `/zavarshvane-na-porachka`. Старите английски адреси се пренасочват към тях.

## Настройки и тайни

Локалните настройки се пазят в `apps/backend/.env` и `apps/storefront/.env.local`. Не добавяйте тези файлове, пароли или API ключове в Git. `apps/backend/.env.template` е само пример; попълвайте SMTP паролата локално. В production `STOREFRONT_URL` трябва да бъде публичният HTTPS адрес на магазина.

## Проверки и текущи ограничения

GitHub Actions изпълнява lint, TypeScript проверка и backend unit тестове. Интеграционни тестове и production build още не са част от автоматичните проверки.

Поръчки могат да се използват за локално тестване на потока и наличностите. Не свързвайте реални клиенти: куриерските опции/тарифи и плащането са тестови, а реални интеграции и юридическа готовност още няма.
