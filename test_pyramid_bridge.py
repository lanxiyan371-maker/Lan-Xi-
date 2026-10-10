import json
from pathlib import Path
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pyramid_bridge import make_server

class Device(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_GET(self):
        self.send_response(200); self.end_headers()
        self.wfile.write(json.dumps({'models': [{'name': 'multilingual', 'status': 'ready', 'provider': 'AxEngineExecutionProvider'}]}).encode())
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        assert list(body['questions']) == ['tactic']
        assert len(body['questions']['tactic']['criteria']) == 4
        self.send_response(200); self.end_headers()
        self.wfile.write(json.dumps({'model': 'laya-multilingual', 'engine': {'provider': 'AxEngineExecutionProvider'}, 'answers': {'tactic': {'choice': 'evade'}}, 'total_npu_latency_ms': 29}).encode())

class BridgeTest(unittest.TestCase):
    def test_static_info_prediction_and_validation(self):
        device = ThreadingHTTPServer(('127.0.0.1', 0), Device)
        threading.Thread(target=device.serve_forever, daemon=True).start()
        with tempfile.TemporaryDirectory() as folder:
            Path(folder, 'index.html').write_text('game')
            server = make_server(folder, f'http://127.0.0.1:{device.server_port}', port=0)
            threading.Thread(target=server.serve_forever, daemon=True).start()
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            url = f'http://127.0.0.1:{server.server_port}'
            try:
                with opener.open(url + '/') as r: self.assertEqual(r.read(), b'game')
                with opener.open(url + '/api/pyramid/info') as r: self.assertTrue(json.load(r)['connected'])
                request = urllib.request.Request(url + '/api/pyramid/decide', data=json.dumps({'state': {'hp': 3, 'position': [200, 575], 'threats': 2}}).encode(), headers={'Content-Type': 'application/json'})
                with opener.open(request) as r:
                    result = json.load(r)
                    self.assertEqual(result['tactic'], 'evade'); self.assertEqual(result['npuMs'], 29)
                with self.assertRaises(urllib.error.HTTPError) as failed:
                    opener.open(urllib.request.Request(url + '/api/pyramid/decide', data=b'{}'))
                self.assertEqual(failed.exception.code, 400)
            finally:
                server.shutdown(); server.server_close()
        device.shutdown(); device.server_close()

if __name__ == '__main__': unittest.main()
