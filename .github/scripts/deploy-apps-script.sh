#!/usr/bin/env bash
# Upload apps-script/ to the existing Apps Script project and point the
# current web app deployment at that version. Never creates a new deployment,
# so the /exec URL stays the same.
set -euo pipefail

cd "$(dirname "$0")/../.."

warn() { echo "::warning::$*"; }
err() { echo "::error::$*" >&2; }

script_files=()
if [[ -d apps-script ]]; then
  while IFS= read -r -d '' file; do
    script_files+=("$file")
  done < <(find apps-script -type f \( -name '*.gs' -o -name '*.js' \) -print0)
fi

manifest="apps-script/appsscript.json"
has_manifest=0
if [[ -f "$manifest" ]]; then
  has_manifest=1
fi

if [[ ${#script_files[@]} -eq 0 && "$has_manifest" -eq 0 ]]; then
  warn "後台程式還沒有放進 apps-script 資料夾，所以這次沒有更新 Google Apps Script，現在的網址也不會被改到。請先照 README 用 clasp pull 把線上程式下載下來，再推上 main。"
  exit 0
fi

if [[ ${#script_files[@]} -eq 0 || "$has_manifest" -eq 0 ]]; then
  err "apps-script 裡的檔案不完整。需要同時有 appsscript.json 和至少一個 .gs 或 .js。請用 clasp pull 下載線上那一份，不要只放空白檔或網頁裡複製的片段。這次沒有更新線上程式。"
  exit 1
fi

deployment_id="${GAS_DEPLOYMENT_ID:-}"
if [[ -z "$deployment_id" ]]; then
  if [[ ! -f .github/gas-deployment-id.txt ]]; then
    err "找不到部署編號。請設定 GitHub 密鑰 GAS_DEPLOYMENT_ID，或保留 .github/gas-deployment-id.txt。這次沒有建立新網址。"
    exit 1
  fi
  deployment_id="$(tr -d '[:space:]' < .github/gas-deployment-id.txt)"
else
  deployment_id="$(printf '%s' "$deployment_id" | tr -d '[:space:]')"
fi

if ! printf '%s' "$deployment_id" | grep -Eq '^AKfycb[0-9A-Za-z_-]+$'; then
  err "部署編號看起來不對。請到 Apps Script 的「部署 → 管理部署」，複製目前網頁正在用的那一筆（網址中間、/macros/s/ 後面那串），填進密鑰 GAS_DEPLOYMENT_ID。不要用清單裡標成 HEAD 的編號。這次沒有建立新網址。"
  exit 1
fi

if [[ -z "${CLASPRC_JSON:-}" ]]; then
  err "找不到 GitHub 密鑰 CLASPRC_JSON。請在自己的電腦執行 clasp login，把產生的 .clasprc.json 整份內容貼到倉庫的 Actions secrets，名稱要叫 CLASPRC_JSON。不要把這個檔案上傳到倉庫。這次沒有更新線上程式。"
  exit 1
fi

cred_file="$(mktemp)"
chmod 600 "$cred_file"
cleanup() {
  if [[ -n "${cred_file:-}" ]]; then
    rm -f "$cred_file"
  fi
}
trap cleanup EXIT
printf '%s' "$CLASPRC_JSON" > "$cred_file"
if ! python3 - "$cred_file" <<'PY'
import json, sys
path = sys.argv[1]
try:
    with open(path, encoding="utf-8") as handle:
        data = json.load(handle)
except Exception:
    sys.exit(2)
if not isinstance(data, dict) or not any(key in data for key in ("tokens", "token", "access_token", "refresh_token")):
    sys.exit(3)
PY
then
  err "CLASPRC_JSON 不是 clasp login 產生的那份檔案。請打開家目錄裡的 .clasprc.json，從第一個 { 到最後一個 } 整份貼上，不要只貼其中一行。這次沒有更新線上程式。"
  exit 1
fi

if [[ -n "${CLASP_BIN:-}" ]]; then
  clasp="$CLASP_BIN"
else
  tool_dir="${RUNNER_TEMP:-/tmp}/clasp-tool"
  npm install --prefix "$tool_dir" @google/clasp@3.4.1
  clasp="$tool_dir/node_modules/.bin/clasp"
fi

short_sha="${GITHUB_SHA:-manual}"
short_sha="${short_sha:0:7}"

echo "正在上傳 apps-script，並更新現有部署（網址保持不變）。"
"$clasp" --auth "$cred_file" push --force
"$clasp" --auth "$cred_file" update-deployment "$deployment_id" --description "GitHub ${short_sha}"
echo "已更新部署 ${deployment_id}，沒有建立新的網址。"
