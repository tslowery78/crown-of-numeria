#!/bin/bash
# Serve Crown of Numeria over HTTPS on your home Wi-Fi so the Quest browser
# allows WebXR. Usage: ./serve.sh   then open the printed https:// address
# on the Quest and tap "Advanced > Proceed" once on the certificate warning.
cd "$(dirname "$0")"
PORT=${PORT:-8443}
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')
mkdir -p .cert
if [ ! -f .cert/cert.pem ] || ! openssl x509 -in .cert/cert.pem -noout -text | grep -q "IP Address:$IP"; then
  openssl req -x509 -newkey rsa:2048 -nodes -days 825 -keyout .cert/key.pem -out .cert/cert.pem \
    -subj "/CN=Crown of Numeria" -addext "subjectAltName=IP:$IP,DNS:localhost" 2>/dev/null
fi
echo ""
echo "  On the Quest browser open:   https://$IP:$PORT"
echo "  (Ctrl+C to stop)"
echo ""
python3 - "$PORT" <<'PY'
import http.server, ssl, sys
port = int(sys.argv[1])
class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('0.0.0.0', port), H)
ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain('.cert/cert.pem', '.cert/key.pem')
srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
srv.serve_forever()
PY
