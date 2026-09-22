#!/usr/bin/env python3
"""Servidor HTTP estático para o Trailer 3D Studio em localhost:8123."""
import http.server
import socketserver
import os
import sys
import hashlib
import time
import json
import math

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8130
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

_js_hash_cache = None
_js_hash_time = 0

def get_js_hash():
    global _js_hash_cache, _js_hash_time
    now = time.time()
    if _js_hash_cache and (now - _js_hash_time) < 1:
        return _js_hash_cache
    h = hashlib.md5()
    src_dir = os.path.join(ROOT, 'src')
    for root, dirs, files in os.walk(src_dir):
        for f in sorted(files):
            if f.endswith('.js'):
                fp = os.path.join(root, f)
                try:
                    h.update(open(fp, 'rb').read())
                except Exception:
                    pass
    _js_hash_cache = h.hexdigest()[:12]
    _js_hash_time = now
    return _js_hash_cache

def _file_hash(relpath):
    fp = os.path.join(ROOT, relpath)
    try:
        return hashlib.md5(open(fp, 'rb').read()).hexdigest()[:12]
    except Exception:
        return 'missing'

def get_dev_versions():
    """Hashes para auto-reload: JS (full page) + project/catalog/utilities (soft apply)."""
    return {
        'version': get_js_hash(),
        'project': _file_hash('project.json'),
        'catalog': _file_hash('data/palette-catalog.json'),
        'utilities': _file_hash('data/utilities-network.json'),
    }

def _extract_parts_deterministic(proj):
    geometry = proj.get('geometry', {})
    parts_list = None
    if isinstance(geometry, dict):
        parts_list = geometry.get('parts')
    if parts_list is None and 'parts' in proj:
        parts_list = proj['parts']
    if not parts_list or not isinstance(parts_list, list):
        return {"parts": [], "groups": []}

    # Get material thickness (default 15mm)
    material_thickness_mm = 15
    if 'geometry' in proj and 'material' in proj['geometry']:
        mat = proj['geometry']['material']
        if isinstance(mat, dict) and 'color' in mat:
            material_color = mat['color']
        else:
            material_color = '#c9a86c'
    else:
        material_color = '#c9a86c'

    name_counts = {}
    for p in parts_list:
        if isinstance(p, dict):
            name = p.get('name', 'Peça')
            name_counts[name] = name_counts.get(name, 0) + 1

    seen = set()
    parts = []
    for p in parts_list:
        if not isinstance(p, dict): continue
        name = p.get('name', 'Peça')
        if name in seen: continue
        seen.add(name)
        box = p.get('box', [0, 0, 0])
        if len(box) >= 3:
            # Find thickness dimension (matches material thickness ~15mm = 0.015m)
            t_idx = None
            for i, dim in enumerate(box[:3]):
                if abs(dim - 0.015) < 0.005 or abs(dim - 0.010) < 0.005:
                    t_idx = i
                    break
            if t_idx is None:
                # Fallback: smallest dimension is thickness
                t_idx = min(range(3), key=lambda i: box[i])
            # Remaining two are width and height
            other = [i for i in range(3) if i != t_idx]
            w_mm = round(box[other[0]] * 1000)
            h_mm = round(box[other[1]] * 1000)
            t_mm = round(box[t_idx] * 1000)
        else:
            w_mm = 0; h_mm = 0; t_mm = 15
        qty = name_counts.get(name, 1)
        parts.append({"name": name, "qty": qty, "w_mm": w_mm, "h_mm": h_mm, "t_mm": t_mm, "material": material_color})

    groups = {}
    for p in parts:
        key = str(p['t_mm'])
        if key not in groups:
            groups[key] = {"thickness_mm": p['t_mm'], "part_count": 0, "total_area_cm2": 0, "sheets_needed": 0}
        groups[key]["part_count"] += p['qty']
        groups[key]["total_area_cm2"] += (p['w_mm'] * p['h_mm'] * p['qty']) / 100

    sheet_area = 2170 * 1070
    for g in groups.values():
        g["sheets_needed"] = max(1, math.ceil(g["total_area_cm2"] / (sheet_area / 100)))

    return {"parts": parts, "groups": list(groups.values())}

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def do_GET(self):
        if self.path == '/dev-version':
            body = json.dumps(get_dev_versions()).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def do_POST(self):
        if self.path == '/cut-plan':
            self._handleCutPlan()
            return
        if self.path == '/audit/correct':
            self._handleAuditCorrection()
            return
        self.send_response(404)
        self.end_headers()

    def _handleCutPlan(self):
        import urllib.request
        length = int(self.headers.get('Content-Length', 0))
        raw = self.rfile.read(length) if length else b'{}'
        try:
            proj = json.loads(raw.decode('utf-8') or '{}')
        except Exception:
            proj = {}

        result = _extract_parts_deterministic(proj)
        body = json.dumps(result).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _handleAuditCorrection(self):
        import urllib.request
        length = int(self.headers.get('Content-Length', 0))
        raw = self.rfile.read(length) if length else b'{}'
        try:
            data = json.loads(raw.decode('utf-8') or '{}')
        except Exception:
            data = {}
        
        error = data.get('error', {})
        project = data.get('project', {})
        
        # Try to use homelab AI service for correction suggestions
        suggestion = self._getHomelabCorrection(error, project)
        
        # Fallback to local suggestions
        if not suggestion:
            suggestion = self._getLocalCorrection(error)
        
        result = {'suggestion': suggestion}
        body = json.dumps(result).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    
    def _getHomelabCorrection(self, error, project):
        try:
            import urllib.request
            import json
            
            # Try to communicate with homelab MCP service
            homelab_url = 'http://192.168.15.2:8503/api/audit/correct'
            payload = {
                'error': error,
                'project': project,
                'context': {
                    'timestamp': time.time(),
                    'request_type': 'audit_correction'
                }
            }
            
            data = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(
                homelab_url,
                data=data,
                headers={'Content-Type': 'application/json'},
                timeout=5
            )
            
            with urllib.request.urlopen(req) as response:
                result = json.loads(response.read().decode('utf-8'))
                return result.get('suggestion', '')
                
        except Exception as e:
            print(f"Homelab correction service unavailable: {e}")
            return None
    
    def _getLocalCorrection(self, error):
        # Local fallback suggestions based on error patterns
        suggestions = {
            'eng-001': 'Ajustar dimensões do chassi para dentro do padrão (L: 2.5-4.0m, W: 1.2-2.0m)',
            'eng-002': 'Reduzir peso de componentes ou aumentar limite PBT',
            'eng-003': 'Reduzir altura da caixa ou reposicionar componentes pesados',
            'arch-001': 'Aumentar altura interna mínima para 1.7m',
            'arch-002': 'Aumentar largura interna ou reorganizar layout',
            'arch-003': 'Ajustar dimensões do banheiro (W: >=0.7m, H: >=1.8m)',
            'mec-001': 'Verificar especificação das rodas (10-25kg)',
            'mec-002': 'Ajustar altura do engate para 40-50cm do solo',
            'carp-001': 'Ajustar espessura das paredes para 15-25mm',
            'carp-002': 'Usar serviço /cut-plan para otimização',
            'carp-003': 'Corrigir inconsistência nas dimensões internas',
            'des-001': 'Ajustar proporções para melhor harmonia visual',
            'des-002': 'Adicionar porta de entrada se não existir',
            'des-003': 'Aumentar largura da porta para mínimo 0.6m'
        }
        
        error_id = error.get('id', '')
        return suggestions.get(error_id, 'Revisar parâmetros relacionados ao erro')

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()
    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        return MIME.get(ext, 'application/octet-stream')

if __name__ == '__main__':
    os.chdir(ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('0.0.0.0', PORT), Handler) as httpd:
        print(f'Servidor em http://0.0.0.0:{PORT}/  (também http://127.0.0.1:{PORT}/)  root: {ROOT}')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nServidor parado.')