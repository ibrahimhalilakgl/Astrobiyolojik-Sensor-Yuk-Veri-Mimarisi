import paramiko, time

HOST = "37.247.101.197"
USER = "root"
PASS = "!8!aav4z5HSX"

def run(c, cmd, t=300):
    print(f"\n$ {cmd[:200]}")
    _, so, se = c.exec_command(cmd, timeout=t)
    o = so.read().decode("utf-8","replace")
    e = se.read().decode("utf-8","replace")
    x = so.channel.recv_exit_status()
    txt = (o+e).strip().encode("ascii","replace").decode("ascii")
    if txt: print(txt[-2500:])
    print(f"[{x}]")
    return x,o,e

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASS, timeout=15)
print("Connected\n")

print("=== 1. Build Python 3.11 from source ===")
run(c, "apt-get install -y build-essential zlib1g-dev libncurses5-dev libgdbm-dev libnss3-dev libssl-dev libreadline-dev libffi-dev libsqlite3-dev wget libbz2-dev liblzma-dev 2>&1 | tail -3", t=120)

run(c, "test -f /usr/local/bin/python3.11 && echo 'ALREADY_BUILT' || echo 'NEED_BUILD'")

code, out, _ = run(c, "test -f /usr/local/bin/python3.11 && echo EXISTS", t=5)
if "EXISTS" not in out:
    print("Building Python 3.11.9 from source (this will take a few minutes)...")
    run(c, "cd /tmp && wget -q https://www.python.org/ftp/python/3.11.9/Python-3.11.9.tgz && tar -xzf Python-3.11.9.tgz && echo DOWNLOADED", t=120)
    run(c, "cd /tmp/Python-3.11.9 && ./configure --enable-optimizations --prefix=/usr/local 2>&1 | tail -3", t=300)
    run(c, "cd /tmp/Python-3.11.9 && make -j$(nproc) 2>&1 | tail -3", t=600)
    run(c, "cd /tmp/Python-3.11.9 && make altinstall 2>&1 | tail -3", t=120)
    run(c, "/usr/local/bin/python3.11 --version")
else:
    print("Python 3.11 already available!")

print("\n=== 2. Install Node 14 (GLIBC 2.27 compatible) ===")
run(c, "curl -fsSL https://deb.nodesource.com/setup_14.x | bash - 2>&1 | tail -3", t=60)
run(c, "apt-get install -y nodejs 2>&1 | tail -3", t=120)
run(c, "node --version && npm --version")

print("\n=== 3. Python venv ===")
run(c, "rm -rf /opt/nirvana/backend/venv")
run(c, "/usr/local/bin/python3.11 -m venv /opt/nirvana/backend/venv && echo VENV_OK")
run(c, "cd /opt/nirvana/backend && ./venv/bin/pip install --upgrade pip 2>&1 | tail -2")
run(c, "cd /opt/nirvana/backend && ./venv/bin/pip install -r requirements.txt 2>&1 | tail -8", t=300)
run(c, "test -f /opt/nirvana/backend/venv/bin/uvicorn && echo UVICORN_OK")

print("\n=== 4. DB migration ===")
run(c, "cd /opt/nirvana/backend && ./venv/bin/alembic upgrade head 2>&1")

print("\n=== 5. Backend service ===")
run(c, "systemctl daemon-reload && systemctl restart nirvana")
time.sleep(5)
run(c, "systemctl is-active nirvana")
run(c, "curl -s http://localhost:8000/health")

print("\n=== 6. Frontend ===")
run(c, "cd /opt/nirvana/frontend && rm -rf node_modules package-lock.json && npm install 2>&1 | tail -5", t=300)
run(c, "cd /opt/nirvana/frontend && npx vite build 2>&1", t=120)
run(c, "ls /opt/nirvana/frontend/dist/index.html 2>&1 && echo BUILD_OK")

print("\n=== 7. Nginx ===")
run(c, "systemctl restart nginx")
time.sleep(2)
run(c, "curl -s http://localhost:8000/health")
run(c, "curl -s -o /dev/null -w 'HTTP_%{http_code}' http://37.247.101.197/")

print(f"\nDashboard: http://37.247.101.197")
c.close()
