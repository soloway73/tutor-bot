#!/bin/bash

# VPN Control Script for Tutor Bot
# Usage: ./vpn-control.sh [status|restart|switch|logs]

PROXY_PORT="7891"
MIHOMO_CONFIG="/tmp/mihomo-config.yaml"
API_URL="http://127.0.0.1:9090"
API_SECRET="tutor-bot-secret"

case "$1" in
    status)
        echo "=== Mihomo Proxy Status ==="
        systemctl is-active mihomo && echo "✓ Mihomo is running" || echo "✗ Mihomo is stopped"
        
        echo ""
        echo "=== Listening Ports ==="
        ss -tlnp | grep -E "789|909"
        
        echo ""
        echo "=== Current Proxy ==="
        curl -s "$API_URL/proxies/GLOBAL" -H "Authorization: Bearer $API_SECRET" 2>/dev/null | \
            python3 -c "import sys,json; d=json.load(sys.stdin); print('Current:', d.get('now','Unknown'))" 2>/dev/null || echo "Cannot get proxy info"
        
        echo ""
        echo "=== Tutor Bot Status ==="
        pm2 status tutor-bot
        ;;
    
    restart)
        echo "Restarting Mihomo..."
        sudo systemctl restart mihomo
        sleep 2
        systemctl is-active mihomo && echo "✓ Mihomo restarted" || echo "✗ Failed to restart"
        
        echo "Restarting Tutor Bot..."
        cd /home/ilyas/tutor-bot/tutor-bot
        pm2 restart tutor-bot --update-env
        sleep 3
        pm2 status tutor-bot
        ;;
    
    switch)
        echo "Available proxies:"
        curl -s "$API_URL/proxies/GLOBAL" -H "Authorization: Bearer $API_SECRET" 2>/dev/null | \
            python3 -c "
import sys,json
d=json.load(sys.stdin)
proxies = d.get('all',[])
for i, p in enumerate(proxies[:15], 1):
    print(f'{i}. {p}')
" 2>/dev/null || echo "Cannot get proxy list"
        
        echo ""
        read -p "Enter proxy name: " PROXY_NAME
        if [ -n "$PROXY_NAME" ]; then
            curl -s -X PUT "$API_URL/proxies/GLOBAL" \
                -H "Authorization: Bearer $API_SECRET" \
                -d "{\"name\":\"$PROXY_NAME\"}" > /dev/null
            sleep 1
            echo "Switched to: $PROXY_NAME"
        fi
        ;;
    
    logs)
        echo "=== Last 50 lines of Mihomo log ==="
        sudo journalctl -u mihomo -n 50 --no-pager | tail -20
        
        echo ""
        echo "=== Last 30 lines of Tutor Bot log ==="
        tail -30 /home/ilyas/tutor-bot/tutor-bot/logs/pm2-combined.log
        ;;
    
    test)
        echo "Testing proxy connection..."
        RESULT=$(curl -s --connect-timeout 10 --socks5 127.0.0.1:$PROXY_PORT \
            "https://api.telegram.org/bot8677826917:AAE3prnNK2HAvXw_j8h1uep1-ofvnOyGzgc/getMe" 2>&1)
        
        if echo "$RESULT" | grep -q '"ok":true'; then
            BOT_NAME=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('result',{}).get('username','Unknown'))" 2>/dev/null)
            echo "✓ Telegram API: OK (Bot: $BOT_NAME)"
        else
            echo "✗ Telegram API: Failed"
            echo "$RESULT" | head -3
        fi
        
        echo ""
        echo "Testing Google..."
        if curl -s --connect-timeout 5 --socks5 127.0.0.1:$PROXY_PORT https://www.google.com > /dev/null 2>&1; then
            echo "✓ Google: OK"
        else
            echo "✗ Google: Failed"
        fi
        ;;
    
    *)
        echo "VPN Control Script for Tutor Bot"
        echo ""
        echo "Usage: $0 {status|restart|switch|logs|test}"
        echo ""
        echo "Commands:"
        echo "  status  - Show Mihomo and Tutor Bot status"
        echo "  restart - Restart Mihomo and Tutor Bot"
        echo "  switch  - Switch to different proxy server"
        echo "  logs    - Show recent logs"
        echo "  test    - Test proxy connection"
        ;;
esac
