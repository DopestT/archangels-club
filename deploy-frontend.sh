#!/bin/bash
set -e

echo "==> Building frontend..."
cd "$(dirname "$0")/client"
npm run build

echo "==> Deploying to Vercel (production)..."
npx vercel --prod

echo ""
echo "==> Verifying deployment..."
sleep 5
CHUNK=$(curl -s https://www.archangelsclub.com/assets/index-*.js 2>/dev/null | grep -o 'MessagesPage-[^"'"'"']*\.js' | head -1 || true)
if [ -n "$CHUNK" ]; then
  echo "    Live chunk: $CHUNK"
else
  # Fall back to checking index.html
  HTML_CHUNK=$(curl -s https://www.archangelsclub.com/ | grep -o 'assets/index-[^"]*\.js' | head -1)
  echo "    Entry chunk: $HTML_CHUNK"
fi

HEALTH=$(curl -s https://www.archangelsclub.com/api/health)
echo "    API health:  $HEALTH"
echo ""
echo "==> Done. Check browser console for build SHA."
