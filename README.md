# GREEN-API MAX Chat

React/Vite тестовое задание с минималистичным интерфейсом чата на базе GREEN-API для MAX.

Реализовано:
- idInstance и apiTokenInstance;
- создание чата по номеру телефона;
- текстовая отправка через sendMessage;
- получение входящих через receiveNotification;
- удаление обработанных уведомлений;
- адаптивный UI в стиле web.max.ru.

Credentials хранятся только в sessionStorage браузера и не входят в репозиторий.

Запуск:
npm install
npm run dev

Production:
npm run build