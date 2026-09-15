#!/usr/bin/env bash
# infra/deploy-vps.sh — выкладка ShareTrip на общий VPS.
#
#   ./infra/deploy-vps.sh --dry-run       # показать, что будет сделано
#   ./infra/deploy-vps.sh                 # выложить файлы
#   ./infra/deploy-vps.sh --recaddy       # ещё и перерисовать блок Caddy
#   ./infra/deploy-vps.sh --rollback      # вернуть предыдущую версию
#
# Настройки — в infra/deploy.env (образец: deploy.env.example). Адреса и имя
# машины в репозиторий не попадают.
#
# Сборки нет, поэтому «выложить» — это скопировать каталог web/. Ни Node, ни
# контейнеров, ни памяти ShareTrip на сервере не занимает: файлы отдаёт уже
# работающий Caddy на :8443.
#
# ⚠️  ЭТОТ СКРИПТ НИ РАЗУ НЕ ВЫПОЛНЯЛСЯ: у сессии, которая его писала, не было
#     доступа к серверу. Первый запуск делайте при себе и обязательно начните
#     с --dry-run. Проверено только то, что bash разбирает синтаксис.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"

ENV_FILE="${ENV_FILE:-$HERE/deploy.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Нет файла настроек: $ENV_FILE"
  echo "Скопируйте infra/deploy.env.example в infra/deploy.env и заполните."
  exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

: "${SSH_TARGET:?SSH_TARGET не задан в deploy.env}"
: "${SITE_HOST:?SITE_HOST не задан в deploy.env}"
REMOTE_ROOT="${REMOTE_ROOT:-/opt/sharetrip}"
CADDYFILE="${CADDYFILE:-/etc/caddy/Caddyfile}"
NEIGHBOURS="${NEIGHBOURS:-}"

# Предохранитель: пустая или корневая переменная не должна уметь снести систему.
case "$REMOTE_ROOT" in
  ""|"/"|"/opt"|"/etc"|"/var"|"/home"|"/usr"|"/root")
    echo "REMOTE_ROOT выглядит опасно: '$REMOTE_ROOT'. Остановился."
    exit 1 ;;
esac
if [[ "$REMOTE_ROOT" != /* ]]; then
  echo "REMOTE_ROOT должен быть абсолютным путём, а не '$REMOTE_ROOT'."
  exit 1
fi

DRY_RUN=""
DO_CADDY=""
DO_ROLLBACK=""
for arg in "$@"; do
  case "$arg" in
    --recaddy)  DO_CADDY=1 ;;
    --rollback) DO_ROLLBACK=1 ;;
    --dry-run)  DRY_RUN=1 ;;
    *) echo "Неизвестный аргумент: $arg"; exit 1 ;;
  esac
done

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
remote() {
  if [[ -n "$DRY_RUN" ]]; then
    printf '   [dry-run] ssh %s %q\n' "$SSH_TARGET" "$1"
  else
    ssh "$SSH_TARGET" "$1"
  fi
}
local_run() {
  if [[ -n "$DRY_RUN" ]]; then printf '   [dry-run] %s\n' "$*"; else "$@"; fi
}

# --- коды соседних сайтов ----------------------------------------------------
declare -A BEFORE
check_neighbours() {
  local phase="$1" url code
  [[ -z "$NEIGHBOURS" ]] && { echo "   NEIGHBOURS не заданы — пропускаю"; return 0; }
  for url in $NEIGHBOURS; do
    if [[ -n "$DRY_RUN" ]]; then printf '   [dry-run] curl %s\n' "$url"; continue; fi
    code=$(ssh "$SSH_TARGET" "curl -sS -o /dev/null -w '%{http_code}' --max-time 10 -k '$url'" || echo "ERR")
    if [[ "$phase" == "before" ]]; then
      BEFORE["$url"]="$code"
      printf '   %s → %s\n' "$url" "$code"
    else
      printf '   %s → %s (было %s)\n' "$url" "$code" "${BEFORE[$url]:-?}"
      if [[ "$code" != "${BEFORE[$url]:-}" ]]; then
        echo
        echo "СОСЕД ИЗМЕНИЛСЯ: $url было ${BEFORE[$url]:-?}, стало $code."
        echo "Это наша выкладка, даже если неочевидно как. Откат: $0 --rollback"
        exit 1
      fi
    fi
  done
}

# --- откат -------------------------------------------------------------------
if [[ -n "$DO_ROLLBACK" ]]; then
  say "Откат на предыдущую версию"
  remote "test -d '$REMOTE_ROOT/web.prev'"
  remote "set -e
    trash=\"\$(mktemp -d '$REMOTE_ROOT/.trash.XXXXXX')\"
    mv '$REMOTE_ROOT/web' \"\$trash/\"
    mv '$REMOTE_ROOT/web.prev' '$REMOTE_ROOT/web'
    echo \"Прошлая версия отправлена в \$trash — удалите её сами, когда убедитесь.\""
  say "Готово. Предыдущая версия снова на месте."
  exit 0
fi

# --- выкладка ----------------------------------------------------------------
say "Проверки перед выкладкой"
if [[ -n "$DRY_RUN" ]]; then
  echo "   [dry-run] npm test"
else
  ( cd "$REPO" && npm test >/dev/null ) \
    && echo "   тесты: пройдены" \
    || { echo "   ТЕСТЫ КРАСНЫЕ — выкладка отменена"; exit 1; }
fi

say "Коды соседних сайтов ДО"
check_neighbours before

say "Копирую web/ в $REMOTE_ROOT/web"
remote "mkdir -p '$REMOTE_ROOT'"
# Предыдущая версия сохраняется рядом: откат тогда — это переименование.
remote "set -e
  if [ -d '$REMOTE_ROOT/web' ]; then
    trash=\"\$(mktemp -d '$REMOTE_ROOT/.prev.XXXXXX')\"
    if [ -d '$REMOTE_ROOT/web.prev' ]; then mv '$REMOTE_ROOT/web.prev' \"\$trash/\"; fi
    cp -a '$REMOTE_ROOT/web' '$REMOTE_ROOT/web.prev'
  fi"
local_run rsync -az --delete "$REPO/web/" "$SSH_TARGET:$REMOTE_ROOT/web/"

# --- блок Caddy --------------------------------------------------------------
if [[ -n "$DO_CADDY" ]]; then
  say "Обновляю блок Caddy (только свой, между маркерами)"
  BLOCK=$(sed -e "s|{{HOST}}|$SITE_HOST|g" -e "s|{{ROOT}}|$REMOTE_ROOT/web|g" "$HERE/caddy-sharetrip.caddy")

  if [[ -n "$DRY_RUN" ]]; then
    echo "   [dry-run] блок, который был бы записан:"
    printf '%s\n' "$BLOCK" | sed 's/^/      /'
  else
    remote "cp '$CADDYFILE' '$CADDYFILE.bak.\$(date +%s)'"
    printf '# ===== BEGIN sharetrip =====\n%s\n# ===== END sharetrip =====\n' "$BLOCK" \
      | ssh "$SSH_TARGET" "cat > /tmp/sharetrip.caddy"

    # Никакого `cat >` поверх общего Caddyfile: в нём живут десять чужих сайтов.
    # Меняется ровно наш блок между маркерами, всё остальное — байт в байт.
    ssh "$SSH_TARGET" "python3 - <<'PY'
import re, pathlib
cf = pathlib.Path('$CADDYFILE')
text = cf.read_text()
block = pathlib.Path('/tmp/sharetrip.caddy').read_text().rstrip() + '\n'
pat = re.compile(r'# ===== BEGIN sharetrip =====.*?# ===== END sharetrip =====\n?', re.S)
text = pat.sub(block, text) if pat.search(text) else text.rstrip() + '\n\n' + block
cf.write_text(text)
print('   блоков sharetrip в файле:', len(pat.findall(text)))
PY"
  fi

  # Порядок обязателен. validate под root пересоздаёт лог с владельцем root,
  # и СЛЕДУЮЩАЯ перезагрузка падает молча. Поэтому chown стоит между ними.
  # reload, никогда restart: restart рвёт соединения всем сайтам машины.
  say "caddy validate → chown лога → reload"
  remote "caddy validate --config '$CADDYFILE'"
  remote "chown caddy:caddy /var/log/caddy/access.log || true"
  remote "systemctl reload caddy"
fi

say "Коды соседних сайтов ПОСЛЕ"
check_neighbours after

say "Слушающие порты"
remote "ss -tlnp | grep -E ':(8443|443|80)\b' || true"

say "Свободная память"
remote "free -m | head -2"

say "Готово: https://$SITE_HOST:8443"
echo "   ShareTrip не занимает ни контейнеров, ни портов, ни памяти:"
echo "   это статические файлы, которые отдаёт уже работающий Caddy."
