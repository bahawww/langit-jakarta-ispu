#!/bin/sh
# Publikasikan dashboard di https://udara.example.com lewat Cloudflare Tunnel yang sudah ada.
#  1. tambah aturan ingress udara.example.com -> http://localhost:8300 ke tunnel remote
#     (disisipkan sebelum catch-all; aturan lain tidak diubah; konfigurasi lama disimpan dulu)
#  2. buat DNS CNAME udara -> <tunnel>.cfargotunnel.com (proxied)
# Idempoten: aman dijalankan ulang. Token API dibaca dari ~/.cloudflare-token (tidak dicetak).
set -eu
HOST="${HOST:-udara.example.com}"
ORIGIN="${ORIGIN:-http://localhost:8300}"
ZONE=34370166f45a38533581fbc3a4a559ef
TUNNEL=7651720b-c7e8-44c4-bce1-2c4147e1177d
API=https://api.cloudflare.com/client/v4
AUTH="Authorization: Bearer $(cat "$HOME/.cloudflare-token")"
BACKUP_DIR="$(dirname "$0")/../backups"
mkdir -p "$BACKUP_DIR"

ACCOUNT=$(curl -fsS -H "$AUTH" "$API/zones/$ZONE" | python3 -c 'import json,sys;print(json.load(sys.stdin)["result"]["account"]["id"])')

before="$BACKUP_DIR/tunnel-config-$(date +%Y%m%d-%H%M%S).json"
curl -fsS -H "$AUTH" "$API/accounts/$ACCOUNT/cfd_tunnel/$TUNNEL/configurations" > "$before"
echo "konfigurasi tunnel lama disimpan: $before"

new=$(python3 - "$before" "$HOST" "$ORIGIN" <<'EOF'
import json, sys
path, host, origin = sys.argv[1:]
cfg = json.load(open(path))["result"]["config"]
ing = cfg["ingress"]
if any(r.get("hostname") == host for r in ing):
    print("")  # sudah ada
    sys.exit()
assert "hostname" not in ing[-1], "aturan terakhir harus catch-all"
ing.insert(len(ing) - 1, {"hostname": host, "service": origin, "originRequest": {}})
print(json.dumps({"config": cfg}))
EOF
)
if [ -n "$new" ]; then
  printf '%s' "$new" | curl -fsS -X PUT -H "$AUTH" -H 'Content-Type: application/json' --data @- \
    "$API/accounts/$ACCOUNT/cfd_tunnel/$TUNNEL/configurations" \
    | python3 -c 'import json,sys;d=json.load(sys.stdin);print("ingress ditambahkan, versi", d["result"]["version"])'
else
  echo "ingress untuk $HOST sudah ada"
fi

name="${HOST%%.*}"
exists=$(curl -fsS -H "$AUTH" "$API/zones/$ZONE/dns_records?name=$HOST" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["result"]))')
if [ "$exists" = 0 ]; then
  curl -fsS -X POST -H "$AUTH" -H 'Content-Type: application/json' \
    --data "{\"type\":\"CNAME\",\"name\":\"$name\",\"content\":\"$TUNNEL.cfargotunnel.com\",\"proxied\":true,\"comment\":\"ISPU dashboard via tunnel\"}" \
    "$API/zones/$ZONE/dns_records" \
    | python3 -c 'import json,sys;d=json.load(sys.stdin)["result"];print("DNS dibuat:", d["name"], d["type"], "proxied" if d["proxied"] else "")'
else
  echo "DNS $HOST sudah ada"
fi
echo "selesai. cek: curl -sI https://$HOST/ | head -1"
