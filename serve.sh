#!/bin/bash
PORT=8000

# Start Python HTTP server in background
python3 -m http.server $PORT &
SERVER_PID=$!

# Start ngrok tunnel and wait for it to be ready
ngrok http $PORT > /dev/null &
NGROK_PID=$!
sleep 2

# Get the public URL from ngrok API
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "import sys,json; print(json.load(sys.stdin)['tunnels'][0]['public_url'])" 2>/dev/null)

echo "Local:  http://localhost:$PORT"
echo "Public: $NGROK_URL"
echo ""
echo "Paste this as your redirect URI:"
echo "$NGROK_URL"

# Copy to clipboard
echo -n "$NGROK_URL" | pbcopy
echo "(copied to clipboard)"

# Open Simkl app settings and the app itself
open "https://simkl.com/settings/developer/edit/61491/"
open "$NGROK_URL"

# Wait for Ctrl+C, then clean up
trap "kill $SERVER_PID $NGROK_PID 2>/dev/null; exit" INT
wait
