"""Install the approved Laya runtime in a separate directory, then smoke-test it."""
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time
import urllib.request

BASE = Path('/root/sky-blaster-pyramid')
COMMIT = '0e6e5398dc7b5977325f713621437c373d4695ef'

def stage(message):
    print('\n[PYRAMID] ' + message, flush=True)

def run(args, timeout=900):
    subprocess.run([str(a) for a in args], check=True, timeout=timeout, stderr=subprocess.STDOUT)

def main():
    stage('Checking free storage, NPU provider and service port')
    if shutil.disk_usage('/root').free < 2 * 1024**3:
        raise RuntimeError('Need at least 2 GiB free under /root before downloading models')
    import axengine
    providers = axengine.get_available_providers()
    print('Available providers:', providers, flush=True)
    if 'AxEngineExecutionProvider' not in providers:
        raise RuntimeError('On-chip NPU provider is unavailable; installation stopped')
    with socket.socket() as check:
        check.bind(('0.0.0.0', 8010))
    marker = BASE / 'sky-blaster-managed.json'
    if BASE.exists() and not marker.is_file():
        raise RuntimeError('Target directory already exists without our marker; refusing to overwrite')
    BASE.mkdir(exist_ok=True)
    marker.write_text(json.dumps({'project': 'sky-blaster-pyramid', 'source_commit': COMMIT}), encoding='utf-8')
    stage('Checking common locations for existing Laya installations')
    for root in ['/root', '/home', '/opt']:
        checked = 0
        for folder, dirs, files in os.walk(root):
            checked += 1
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in {'node_modules', 'immich', 'val2017', 'containerd', 'aiisp', 'matmul', 'deps', 'sky-blaster-pyramid'}]
            if os.path.relpath(folder, root).count(os.sep) >= 5:
                dirs[:] = []
            for name in dirs:
                if 'laya' in name.lower():
                    print('Existing candidate:', os.path.join(folder, name), flush=True)
            if checked >= 2000:
                print('Search limit reached for:', root, flush=True)
                break
    repo = BASE / 'laya-axera'
    stage('Downloading pinned Laya source into ' + str(repo))
    if not repo.exists():
        run(['git', 'clone', '--depth', '1', 'https://github.com/AXERA-TECH/laya-axera.git', repo], 180)
    current = subprocess.check_output(['git', '-C', str(repo), 'rev-parse', 'HEAD'], text=True).strip()
    if current != COMMIT:
        run(['git', '-C', repo, 'fetch', '--depth', '1', 'origin', COMMIT], 180)
        run(['git', '-C', repo, 'checkout', '--detach', COMMIT])
    venv = BASE / '.venv'
    stage('Preparing isolated environment; existing system packages remain installed')
    py = venv / 'bin/python'
    pip_ready = py.exists() and subprocess.run([str(py), '-m', 'pip', '--version'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
    if not pip_ready:
        built = subprocess.run([sys.executable, '-m', 'venv', '--system-site-packages', str(venv)], timeout=60, stderr=subprocess.STDOUT)
        if built.returncode != 0:
            stage('venv support unavailable; using a project-local virtualenv bootstrap')
            bootstrap = BASE / 'bootstrap'
            run([sys.executable, '-m', 'pip', 'install', '--target', bootstrap, 'virtualenv'], 300)
            env = dict(os.environ)
            env['PYTHONPATH'] = str(bootstrap) + (os.pathsep + env['PYTHONPATH'] if env.get('PYTHONPATH') else '')
            subprocess.run([sys.executable, '-m', 'virtualenv', '--system-site-packages', str(venv)], env=env, check=True, timeout=90, stderr=subprocess.STDOUT)
    ready = subprocess.run([str(py), '-c', 'import laya_axera, fastapi, uvicorn, tokenizers, huggingface_hub; assert tuple(map(int, tokenizers.__version__.split(".")[:2])) >= (0,21)'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
    if not ready:
        run([py, '-m', 'pip', 'install', '--disable-pip-version-check', str(repo) + '[web]', 'huggingface_hub>=1,<2'], 900)
    else:
        stage('Existing isolated Laya installation verified; skipping dependency installation')
    stage('Downloading multilingual checkpoint only (resumable)')
    model_root = BASE / 'models/Laya'
    download = '''
import os
import socket
import httpx
os.environ['HF_HUB_DISABLE_XET'] = '1'
def ipv4_client():
    return httpx.Client(transport=httpx.HTTPTransport(local_address='0.0.0.0', retries=1), follow_redirects=True, trust_env=False, timeout=httpx.Timeout(60, connect=15))
endpoint = None
for candidate in ['https://huggingface.co', 'https://hf-mirror.com']:
    try:
        print('[DOWNLOAD] Testing IPv4 connectivity:', candidate, flush=True)
        host = candidate.split('//', 1)[1]
        print('[DOWNLOAD] IPv4 DNS:', sorted({a[4][0] for a in socket.getaddrinfo(host, 443, socket.AF_INET, socket.SOCK_STREAM)}), flush=True)
        with ipv4_client() as client:
            reply = client.get(candidate + '/api/models/AXERA-TECH/Laya', timeout=15)
            reply.raise_for_status()
            assert reply.json().get('id') == 'AXERA-TECH/Laya'
        endpoint = candidate
        break
    except Exception as error:
        print('[DOWNLOAD] Connectivity check failed:', type(error).__name__, str(error), flush=True)
if endpoint is None:
    raise RuntimeError('Neither official Hugging Face nor project-documented mirror reachable over IPv4. Download on PC and transfer instead.')
os.environ['HF_ENDPOINT'] = endpoint
from huggingface_hub import snapshot_download, set_client_factory
set_client_factory(ipv4_client)
print('[DOWNLOAD] Selected endpoint:', endpoint, flush=True)
snapshot_download(repo_id='AXERA-TECH/Laya', allow_patterns=['multilingual/*'], local_dir=MODEL_ROOT, max_workers=2)
'''.replace('MODEL_ROOT', repr(str(model_root)))
    run([py, '-u', '-c', download], 3600)
    model = model_root / 'multilingual'
    for needed in ['config.json', 'model.axmodel', 'tokenizer']:
        if not (model / needed).exists():
            raise RuntimeError('Downloaded checkpoint is incomplete: ' + needed)
    stage('Starting LAN decision service on port 8010')
    command = [str(venv / 'bin/laya-axera'), 'serve', '--model', 'multilingual=' + str(model), '--host', '0.0.0.0', '--port', '8010', '--provider', 'AxEngineExecutionProvider']
    (BASE / 'service-command.json').write_text(json.dumps(command), encoding='utf-8')
    with (BASE / 'service.log').open('ab') as log:
        service = subprocess.Popen(command, cwd=BASE, stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True)
    (BASE / 'service.pid').write_text(str(service.pid), encoding='ascii')
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    for _ in range(60):
        if service.poll() is not None:
            raise RuntimeError('Service exited; see ' + str(BASE / 'service.log'))
        try:
            with opener.open('http://127.0.0.1:8010/api/info', timeout=2) as reply:
                print(reply.read().decode(), flush=True)
            break
        except OSError:
            time.sleep(1)
    else:
        raise RuntimeError('Service did not become ready within 60 seconds')
    stage('Performing a real NPU prediction')
    request = {'model': 'multilingual', 'state': '敌方子弹正接近战机，需要优先躲避。', 'questions': {'tactic': {'type': 'choice', 'instructions': '现在优先采取哪个战术？', 'criteria': {'evade': '躲避来袭子弹', 'attack': '追击远处敌机'}}}}
    call = urllib.request.Request('http://127.0.0.1:8010/api/predict', data=json.dumps(request).encode(), headers={'Content-Type': 'application/json'})
    with opener.open(call, timeout=180) as reply:
        prediction = json.loads(reply.read())
    (BASE / 'npu-smoke-test.json').write_text(json.dumps(prediction, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(prediction, ensure_ascii=True), flush=True)
    stage('READY: http://192.168.1.100:8010 ; NPU response saved; game integration still pending')

try:
    main()
except Exception as error:
    print('\n[PYRAMID] STOPPED: ' + str(error), flush=True)
    sys.exit(1)
