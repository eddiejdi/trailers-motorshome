#!/usr/bin/env python3
"""Servidor HTTP estático para o Trailer 3D Studio em localhost:8123."""
import http.server
import socketserver
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
ROOT = os.path.dirname(os.path.abspath(__file__))

MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.glb': 'model/gltf-binary',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
}

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)
    def end_headers(self):
        # CORS + cache-bust no-store para JS
        if self.path.endswith('.js'):
            self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()
    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        return MIME.get(ext, 'application/octet-stream')

if __name__ == '__main__':
    os.chdir(ROOT)
    with socketserver.TCPServer(('127.0.0.1', PORT), Handler) as httpd:
        print(f'Servidor em http://127.0.0.1:{PORT}/  (root: {ROOT})')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nServidor parado.')