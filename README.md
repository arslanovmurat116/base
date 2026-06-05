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
- `/alerts`
- `/appointments`

## Что логично делать дальше

- перевести Telegram-привязки с mock-store на live users/conversations
- дать директору и менеджерам реальные chat id и рабочую регистрацию
- после публичного деплоя включить настоящий webhook
- затем добавить расписание dispatch через cron, n8n или Vercel job
