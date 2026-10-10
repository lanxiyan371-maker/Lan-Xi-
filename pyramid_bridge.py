"""Loopback-only game server forwarding tactical decisions to a fixed Pyramid."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
import time
import urllib.error
import urllib.request
import urllib.parse

TACTICS = {'evade': '优先躲避来袭子弹和障碍', 'attack': '对准敌机争取得分', 'supply': '接近补给恢复或升级', 'hold': '保持后方安全位置'}

def make_server(directory, target='http://192.168.1.100:8010', port=8854):
    target = target.rstrip('/')
    parsed = urllib.parse.urlsplit(target)
    if parsed.scheme != 'http' or not parsed.hostname or parsed.username or parsed.password or parsed.path:
        raise ValueError('Pyramid target must be a plain HTTP host and port')
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    lock = threading.Semaphore(1)

    class Handler(SimpleHTTPRequestHandler):
        def log_message(self, *args): pass
        def reply(self, code, body):
            raw = json.dumps(body, ensure_ascii=False).encode()
            self.send_response(code)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(raw)))
            self.end_headers()
            try: self.wfile.write(raw)
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError): pass
        def do_GET(self):
            if self.path == '/api/bridge/status':
                self.reply(200, {'bridge': True, 'target': target})
            elif self.path == '/api/pyramid/info':
                try:
                    with opener.open(target + '/api/info', timeout=3) as r: info = json.load(r)
                    if not isinstance(info.get('models'), list): raise ValueError('Invalid device service response')
                    self.reply(200, {'connected': True, 'target': target, **info})
                except Exception as error:
                    self.reply(502, {'connected': False, 'error': str(error)})
            elif self.path.startswith('/api/'):
                self.reply(404, {'error': 'Unknown bridge endpoint'})
            else: super().do_GET()
        def do_POST(self):
            if self.path != '/api/pyramid/decide':
                self.reply(404, {'error': 'Unknown bridge endpoint'}); return
            if self.headers.get('Origin') and self.headers['Origin'] != 'http://' + self.headers.get('Host', ''):
                self.reply(403, {'error': 'Same-origin requests only'}); return
            try:
                size = int(self.headers.get('Content-Length', 0))
                if not 0 < size <= 8192: raise ValueError('Request size must be 1..8192 bytes')
                body = json.loads(self.rfile.read(size))
                state = body.get('state')
                if not isinstance(state, dict) or not state: raise ValueError('Current game state is required')
            except (ValueError, TypeError, AttributeError) as error:
                self.reply(400, {'error': str(error)}); return
            if not lock.acquire(timeout=0.3):
                self.reply(503, {'error': 'Pyramid is busy'}); return
            try:
                payload = {'model': 'multilingual', 'state': state, 'questions': {'tactic': {'type': 'choice', 'instructions': '你在驾驶战机。危险时优先躲避；没有紧迫威胁且存在可达补给时优先拾取，尤其是武器、火力和射速升级；否则攻击敌机。满血不追治疗包。', 'criteria': TACTICS}}}
                started = time.perf_counter()
                request = urllib.request.Request(target + '/api/predict', data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
                with opener.open(request, timeout=2) as r: prediction = json.load(r)
                tactic = prediction['answers']['tactic']['choice']
                provider = prediction['engine']['provider']
                npu_ms = prediction['total_npu_latency_ms']
                if tactic not in TACTICS or provider != 'AxEngineExecutionProvider' or not isinstance(npu_ms, (int, float)) or not 0 <= npu_ms < 10000:
                    raise ValueError('Invalid or non-NPU decision')
                self.reply(200, {'tactic': tactic, 'model': prediction['model'], 'provider': provider, 'npuMs': npu_ms, 'deviceRoundTripMs': round((time.perf_counter() - started) * 1000, 1)})
            except Exception as error:
                self.reply(502, {'error': str(error)})
            finally: lock.release()

    return ThreadingHTTPServer(('127.0.0.1', port), partial(Handler, directory=str(Path(directory).resolve())))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dist', default=str(Path(__file__).parent / 'polished-arcade-shooter/dist'))
    parser.add_argument('--pyramid', default='http://192.168.1.100:8010')
    parser.add_argument('--port', type=int, default=8854)
    args = parser.parse_args()
    if not Path(args.dist, 'index.html').is_file(): raise SystemExit('Built game index.html is missing')
    print(f'Game bridge: http://127.0.0.1:{args.port}/?pyramid=1#race -> {args.pyramid}', flush=True)
    make_server(args.dist, args.pyramid, args.port).serve_forever()
