# VPN Setup for Tutor Bot

## Настройка завершена! ✅

### Компоненты:

| Компонент | Статус | Порт | Описание |
|-----------|--------|------|----------|
| **Mihomo Proxy** | ✅ Работает | 7890/7891/9090 | HTTP/SOCKS5 прокси |
| **Prizrak-Box** | ✅ Установлен | - | GUI для управления VPN |
| **Tutor Bot** | ✅ Работает | 3000 | Telegram бот |

### Расположение:

- **Конфиг Mihomo:** `/tmp/mihomo-config.yaml`
- **Профиль VPN:** `~/Prizrak-Box-V3/profiles/Profile_*.yaml`
- **Скрипт управления:** `/home/ilyas/tutor-bot/tutor-bot/scripts/vpn-control.sh`

---

## Управление

### 1. Проверка статуса

```bash
# Через скрипт
./scripts/vpn-control.sh status

# Или вручную
systemctl status mihomo
pm2 status tutor-bot
```

### 2. Тест подключения

```bash
./scripts/vpn-control.sh test
```

### 3. Переключение прокси-сервера

```bash
./scripts/vpn-control.sh switch
```

Или через API:

```bash
# Получить список прокси
curl -s http://127.0.0.1:9090/proxies/GLOBAL \
  -H "Authorization: Bearer tutor-bot-secret" | python3 -m json.tool

# Переключиться на другой сервер
curl -X PUT http://127.0.0.1:9090/proxies/GLOBAL \
  -H "Authorization: Bearer tutor-bot-secret" \
  -d '{"name":"🇳🇱 Нидерланды"}'
```

### 4. Перезапуск

```bash
# Полный перезапуск
./scripts/vpn-control.sh restart

# Или по отдельности
sudo systemctl restart mihomo
pm2 restart tutor-bot --update-env
```

### 5. Просмотр логов

```bash
# Логи Mihomo
sudo journalctl -u mihomo -f

# Логи бота
pm2 logs tutor-bot --lines 100

# Или через скрипт
./scripts/vpn-control.sh logs
```

---

## Доступные прокси-серверы:

- ⭐️ Авто | Самый быстрый ⚡️⚡️⚡️
- 🇳🇱 Нидерланды
- 🇳🇱 Нидерланды (резерв 2)
- 🇩🇪 Германия
- 🇪🇪 Эстония
- 🇫🇮 Финляндия
- 🇱🇻 Латвия
- 🇸🇪 Швеция
- 🇺🇸 США (Gemini, GPT)
- 🇵🇱 Польша
- 🇦🇹 Австрия
- 🇫🇷 Франция
- 🇨🇭 Швейцария
- 🇷🇺 Россия
- 🇹🇷 Турция

---

## Решение проблем

### Бот не подключается к Telegram

1. Проверьте статус прокси:
   ```bash
   ./scripts/vpn-control.sh test
   ```

2. Переключитесь на другой сервер:
   ```bash
   ./scripts/vpn-control.sh switch
   ```

3. Перезапустите сервисы:
   ```bash
   ./scripts/vpn-control.sh restart
   ```

### Ошибка "ECONNREFUSED 127.0.0.1:7890"

Проверьте, что Mihomo запущен:
```bash
systemctl status mihomo
ss -tlnp | grep 7890
```

Если не работает - перезапустите:
```bash
sudo systemctl restart mihomo
```

### Ошибка "socket hang up"

Проблема с VPN сервером. Переключитесь на другой:
```bash
curl -X PUT http://127.0.0.1:9090/proxies/GLOBAL \
  -H "Authorization: Bearer tutor-bot-secret" \
  -d '{"name":"🇩🇪 Германия"}'
```

### Напоминания не отправляются

Проверьте логи:
```bash
pm2 logs tutor-bot --lines 50 | grep -E "Reminder|Error"
```

Проверьте, что пользователь зарегистрирован:
```bash
cd /home/ilyas/tutor-bot/tutor-bot
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.findMany().then(users => console.log(users));
"
```

---

## Автозагрузка при старте системы

Оба сервиса настроены на автозагрузку:

- **Mihomo:** systemd сервис (`/etc/systemd/system/mihomo.service`)
- **Tutor Bot:** PM2 процесс

При перезагрузке системы:
```bash
# Проверьте, что всё запустилось
systemctl status mihomo
pm2 status tutor-bot
```

---

## Обновление VPN профиля

Для обновления подписки:

1. Откройте Prizrak-Box GUI
2. Обновите профиль
3. Перезапустите Mihomo:
   ```bash
   sudo systemctl restart mihomo
   ```

---

## Переменные окружения

```bash
# Прокси для Telegram (HTTP)
TELEGRAM_PROXY_URL=http://127.0.0.1:7890

# Прокси для Telegram (SOCKS5) - альтернатива
# TELEGRAM_PROXY_URL=socks5://127.0.0.1:7891
```

---

## Контакты

VPN провайдер: Black Cat VPN  
Поддержка: https://t.me/m/vJbYcRtAZjdi
