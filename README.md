# Mebel RDN CRM

Мебельный CRM MVP на `Next 15 + React 19` для приёма, ведения и контроля заказов.

В проекте оставлен только основной контур:

- обзор
- смена
- сделки
- замеры

Предметный сценарий заточен под мебельный цикл:

`заявка -> квалификация -> расчёт -> замер/консультация -> повторный контакт -> статус сделки`

## Быстрый старт

1. Установить зависимости:

```powershell
npm install
```

2. Поднять локальный сервер:

```powershell
npm run dev
```

Если `3000` занят:

```powershell
npm run dev -- --port 3004
```

3. Открыть в браузере:

- `http://localhost:3000/`
- или `http://localhost:3004/`

## Что уже есть

- mock/live data слой с fallback в mock
- обзор с ключевыми показателями мебельной воронки
- смена с очередью заявок, расчётов, замеров и возвратов
- список сделок и карточка сделки
- контур замеров с подтверждением и фиксацией результата
- контур проекта, сметы, файлов и превью внутри сделки
- формы для смены этапа, замера, возврата и контекста заказа
- Telegram bot/control слой для ролей `директор / менеджер / замерщик`

## Быстрая проверка API

После запуска можно проверить основные endpoints:

```powershell
npm run check:system
```

По умолчанию скрипт смотрит на `http://localhost:3000`.
Если нужен другой адрес:

```powershell
$env:APP_BASE_URL="http://localhost:3004"
npm run check:system
```

## Telegram-бот

Локальный bot token и secret берутся из `.env.local`.

Полезные команды:

```powershell
npm run telegram:me
npm run telegram:commands:set
npm run telegram:webhook:info
```

### Локальный тест без деплоя

```powershell
npm run telegram:poll-loop
```

Этот режим забирает входящие обновления через `getUpdates` и пробрасывает их в локальный
`/api/telegram/webhook`.

### После деплоя на публичный https

1. Обновить `APP_BASE_URL` в `.env.local` или в env деплоя.
2. Проверить бота:

```powershell
npm run telegram:me
```

3. Подвесить webhook:

```powershell
npm run telegram:webhook:set
```

4. Проверить, что Telegram принял адрес:

```powershell
npm run telegram:webhook:info
```

Если нужно снять webhook:

```powershell
npm run telegram:webhook:delete
```

### Команды в Telegram

- `/start`
- `/help`
- `/register`
- `/status`
- `/today`
- `/control`
- `/alerts`
- `/appointments`

### Боевая рассылка и расписание

Есть 2 режима dispatch:

- `daily` — утренняя сводка по ролям
- `control` — контрольные сообщения по возвратам, срочным сделкам и ближайшим замерам

Ручные вызовы:

```powershell
Invoke-WebRequest "https://mebel-rdn.vercel.app/api/telegram/dispatch?dryRun=1&mode=daily"
```

Живая отправка через `/api/telegram/dispatch` в production теперь защищена `Authorization: Bearer <CRON_SECRET>`.
То есть публично можно смотреть `dryRun`, а боевые рассылки запускаются только авторизованно.

Пример live-запуска:

```powershell
Invoke-WebRequest "https://mebel-rdn.vercel.app/api/telegram/dispatch?dryRun=0&mode=control&force=1" `
  -Headers @{ Authorization = "Bearer $env:CRON_SECRET" }
```

Защищённые cron endpoints:

- `/api/telegram/cron/daily`
- `/api/telegram/cron/control`
- `/api/telegram/cron/director-control`
- `/api/telegram/cron/manager-control`
- `/api/telegram/cron/measurer-control`

В `vercel.json` уже добавлен безопасный ежедневный cron на `/api/telegram/cron/daily`
с запуском в `04:00 UTC` — это около `09:00` по `Asia/Almaty`.

Если в проекте задан `CRON_SECRET`, Vercel сам отправляет его в заголовке `Authorization`
для cron job. Если `CRON_SECRET` ещё не задан, route в проде временно принимает только
запросы с user-agent `vercel-cron/1.0`.

Для частых напоминаний по возвратам и замерам логично дальше вешать внешний scheduler
или Vercel Pro на `/api/telegram/cron/control`.

## Что логично делать дальше

- перевести Telegram-привязки с mock-store на live users/conversations
- дать директору и менеджерам реальные chat id и рабочую регистрацию
- после публичного деплоя включить настоящий webhook
- затем повесить частый `control`-scheduler через cron, n8n или Vercel job
