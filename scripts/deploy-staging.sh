#!/usr/bin/env bash
# Deploy only CECT's PUBLIC/member interface on the authorized AWS staging host.
# Does not replace the separate admin domain or modify database/financial settings.
set -Eeuo pipefail

if [[ "${CECT_STAGING_DEPLOY:-}" != "YES" ]]; then
  echo "Refusing to deploy: set CECT_STAGING_DEPLOY=YES explicitly." >&2
  exit 2
fi

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ "$(git -C "$SOURCE_DIR" remote get-url origin)" != "https://github.com/70-DIDIER/CECT-frontend.git" ]]; then
  echo "Refusing to deploy frontend outside the 70-DIDIER/CECT-frontend source repository." >&2
  exit 2
fi
API_ORIGIN="${VITE_API_URL:-https://api.13-49-203-235.sslip.io}"
PUBLIC_ORIGIN="${CECT_PUBLIC_ORIGIN:-https://13-49-203-235.sslip.io}"
LARAVEL_ENV="${CECT_LARAVEL_ENV_FILE:-/var/www/cect-api/.env}"
RELEASES="${CECT_FRONTEND_RELEASES:-/home/ubuntu/cect-releases}"
LINK="${CECT_FRONTEND_LINK:-/home/ubuntu/cect-current/frontend}"

if [[ ! -r "$LARAVEL_ENV" ]] || ! grep -Eq '^APP_ENV=staging$' "$LARAVEL_ENV"; then
  echo "Refusing to deploy: Laravel staging environment not verified." >&2
  exit 2
fi
if [[ "$API_ORIGIN" != https://* ]] || [[ "$PUBLIC_ORIGIN" != https://* ]]; then
  echo "HTTPS origins required." >&2
  exit 2
fi
for cmd in npm curl rsync flock; do command -v "$cmd" >/dev/null || { echo "Missing: $cmd"; exit 2; }; done
if [[ ! -L "$LINK" ]]; then
  echo "Expected existing symlink at $LINK, refusing replacement." >&2
  exit 2
fi
OLD="$(readlink -f "$LINK")"
if [[ "$(basename "$OLD")" != frontend-didier-* && "$(basename "$OLD")" != frontend-5f4f2b6* ]]; then
  echo "Refusing legacy or non-Didier frontend rollback source: $OLD" >&2
  exit 2
fi
if [[ ! -s "$OLD/index.html" ]]; then
  echo "Old release missing, refusing deployment." >&2
  exit 2
fi

# Validate the API and acquire an exclusive publication lock.
curl --fail --silent --show-error --max-time 12 "$API_ORIGIN/api/v1/health" >/dev/null
mkdir -p "$(dirname "$LINK")" "$RELEASES"
exec 9>"$(dirname "$LINK")/.cect-frontend-deploy.lock"
flock -n 9 || { echo "Another frontend deploy is running."; exit 2; }

cd "$SOURCE_DIR"
npm ci
VITE_API_URL="$API_ORIGIN" VITE_SIMULATE_PAYMENT=false npm run build
test -s dist/index.html
test -s dist/logos/CECT_logo_64.png

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RELEASE="$RELEASES/frontend-didier-$STAMP"
mkdir -p "$RELEASE"
rsync -a dist/ "$RELEASE/"

# Keep historical fingerprinted JS/CSS chunks available after deployment.
# An open SPA tab can lazy-load chunks for its original build minutes or hours
# later. Without this carry-over, Nginx returns 404 for those hashed files and
# the member sees a broken or blank screen until a force refresh.
# Only archived releases that were actually produced from 70-DIDIER are read;
# no HTML, API config, source maps, users or financial data is copied.
shopt -s nullglob
for previous_release in "$RELEASES"/frontend-didier-*/ "$RELEASES"/frontend-5f4f2b6*/; do
  [[ "$previous_release" == "$RELEASE/" ]] && continue
  [[ -d "$previous_release/assets" ]] || continue
  rsync -a --ignore-existing \
    --include='*/' --include='*.js' --include='*.css' --exclude='*' \
    "$previous_release/assets/" "$RELEASE/assets/"
done
shopt -u nullglob

# A fixed manifest lets us test that the latest and retained chunks are
# still present before publishing. Without the full request graph, checking
# only index.html is not sufficient.
for previous_asset in "$OLD"/assets/*.js "$OLD"/assets/*.css; do
  [[ -f "$previous_asset" ]] || continue
  test -s "$RELEASE/assets/$(basename "$previous_asset")" || {
    echo "Retained asset missing: $previous_asset" >&2
    exit 1
  }
done

find "$RELEASE" -type d -exec chmod 755 {} +
find "$RELEASE" -type f -exec chmod 644 {} +
grep -q '/logos/CECT_logo_64.png' "$RELEASE/index.html"
for asset in $(grep -oE '/assets/[^"]+\.(js|css)' "$RELEASE/index.html" | sort -u); do
  test -s "$RELEASE${asset}" || { echo "Missing built asset: $asset"; exit 1; }
done

ROLLBACK_DONE=0
restore() {
  if [[ "$ROLLBACK_DONE" == 0 ]]; then
    echo "Rolling back public UI to $OLD" >&2
    ln -s "$OLD" "$(dirname "$LINK")/.frontend-rollback-$STAMP"
    mv -Tf "$(dirname "$LINK")/.frontend-rollback-$STAMP" "$LINK"
  fi
}
trap restore ERR
ln -s "$RELEASE" "$(dirname "$LINK")/.frontend-candidate-$STAMP"
mv -Tf "$(dirname "$LINK")/.frontend-candidate-$STAMP" "$LINK"

# Check the actual Nginx output after symlink switch, not merely the local build.
curl --fail --silent --show-error --max-time 15 -H 'Cache-Control: no-cache' "$PUBLIC_ORIGIN/?revision=$STAMP" | cmp -s - "$RELEASE/index.html"
for path in /connexion /inscription /packs /espace /espace/marchand; do
  curl --fail --silent --show-error --max-time 12 -o /dev/null "$PUBLIC_ORIGIN$path"
done
curl --fail --silent --show-error --max-time 12 -o /dev/null "$PUBLIC_ORIGIN/logos/CECT_logo_64.png"
for asset in $(grep -oE '/assets/[^"]+\.(js|css)' "$RELEASE/index.html" | sort -u); do
  curl --fail --silent --show-error --max-time 12 -o /dev/null "$PUBLIC_ORIGIN$asset"
done
# Smoke-test at least the previous HTML's entrypoints: cached HTML and
# existing browser tabs must not fail after switching the frontend release.
for asset in $(grep -oE '/assets/[^"]+\.(js|css)' "$OLD/index.html" | sort -u); do
  test -s "$RELEASE${asset}"
  case "$asset" in
    *.js) expected_type='application/javascript' ;;
    *.css) expected_type='text/css' ;;
    *) continue ;;
  esac
  received_type="$(curl --fail --silent --show-error --max-time 12 -o /dev/null -w '%{content_type}' "$PUBLIC_ORIGIN$asset")"
  [[ "$received_type" == "$expected_type" ]] || {
    echo "Old bundle is unavailable or has the wrong MIME: $asset ($received_type)" >&2
    false
  }
done

curl --fail --silent --show-error --max-time 12 "$API_ORIGIN/api/v1/health" >/dev/null
ROLLBACK_DONE=1
trap - ERR
echo "Frontend Didier staging release active: $RELEASE"
echo "Previous release kept intact for rollback: $OLD"
echo "Authentication, merchant payments and redemption require separate logged-in E2E testing."
