# Parfumerie

Онлайн магазин за парфюми и отливки, изграден с Medusa v2 и Next.js. В момента е локален проект за разработка; доставките и плащанията в checkout са тестови и не приемат реални плащания или заявки към куриери.

## Стартиране локално

В Windows стартирайте `D:\\New_project\\start-dev.cmd`. Скриптът използва включения Node.js 22 и PostgreSQL 17 и пуска Medusa и storefront.

- Storefront: http://localhost:8000
- Административен панел: http://localhost:9000/app
- Backend health: http://localhost:9000/health
- Спиране: `D:\\New_project\\stop-dev.cmd`

За ръчни команди в тази работна среда изберете включения Node.js 22.20.0 в PowerShell. За друга среда използвайте Node.js `22.20.x` и npm 10.9.3; версията на Node.js е записана и в `.node-version`:

```powershell
$env:Path = "D:\New_project\.tools\node-22;$env:Path"
npm --version
npm ci
npm run lint
npm run typecheck
npm run test:unit
npm run build
```

Българските публични адреси са без префикс на държава: `/parfyumi`, `/otlivki`, `/dizaynerski-kashti`, `/parfyumni-notki`, `/lyubimi`, `/koshnitsa`, `/vhod` и `/zavarshvane-na-porachka`. Старите английски адреси се пренасочват към тях.

## Настройки и тайни

Локалните настройки се пазят в `apps/backend/.env` и `apps/storefront/.env.local`. Не добавяйте тези файлове, пароли или API ключове в Git. `apps/backend/.env.template` е само пример; `SMTP_PASS` трябва да е попълнена локално, защото backend-ът вече изисква SMTP при стартиране и не симулира изпращане. В production `STOREFRONT_URL` трябва да бъде публичният HTTPS адрес на магазина.

## Проверки и текущи ограничения

GitHub Actions проверява фиксираните версии на Node.js/npm, изпълнява lint, TypeScript проверка, backend unit тестове, production build и отделен интеграционен job с временен PostgreSQL. Build-ът в CI използва само временни тестови стойности за публични настройки и SMTP; те не са production secrets и артефактът не се публикува.

## Интеграционни тестове за наличности и поръчки

Пуснете `npm run test:integration:orders`, за да проверите наличностите на цели бутилки и отливки, едновременни резервации, освобождаване при отказ и подготовка на поръчка. За локално изпълнение е нужен отделен тестов PostgreSQL сървър и `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD` в `apps/backend/.env.test`. Medusa създава временна база с уникално име и я изтрива след тестовете. Потребителят на PostgreSQL трябва да може да създава бази. Използвайте само локален/тестов сървър — никога production база или production credentials. GitHub Actions стартира собствен PostgreSQL контейнер за този job.

Поръчки могат да се използват за локално тестване на потока и наличностите. Не свързвайте реални клиенти: куриерските опции/тарифи и плащането са тестови, а реални интеграции и юридическа готовност още няма.
