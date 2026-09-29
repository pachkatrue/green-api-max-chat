# GREEN-API MAX Chat

React/Vite тестовое задание с минималистичным интерфейсом чата на базе GREEN-API для MAX.

Реализовано:
- ввод только `idInstance` и `apiTokenInstance`;
- создание чата по номеру телефона;
- текстовая отправка через `sendMessage`;
- получение входящих и исходящих сообщений через HTTP API;
- автоматическое включение необходимых уведомлений GREEN-API для HTTP API;
- синхронизация серверного `chatId` из уведомлений;
- удаление обработанных уведомлений;
- адаптивный UI в стиле web.max.ru.

API host не запрашивается у пользователя: для production можно переопределить его через переменную `VITE_GREEN_API_URL`. Для текущего MAX-инстанса используется стандартный host GREEN-API.

Credentials хранятся только в `sessionStorage` браузера и не входят в репозиторий.

Запуск:
```bash
npm install
npm run dev
```

Production:
```bash
npm run build
```
