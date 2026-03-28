import paramiko
import time

HOST = "37.247.101.197"
USER = "root"
PASS = "!8!aav4z5HSX"

def run(c, cmd, timeout=300):
    print(f"\n$ {cmd[:180]}")
    _, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    text = (out + err).strip().encode("ascii", errors="replace").decode("ascii")
    if text: print(text[-2500:])
    print(f"[{code}]")
    return code, out, err

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASS, timeout=15)
print("Connected!\n")

print("=== 1. Install Python 3.11 via deadsnakes PPA ===")
run(c, "apt-get install -y software-properties-common 2>&1 | tail -2", timeout=60)
run(c, "add-apt-repository -y ppa:deadsnakes/ppa 2>&1 | tail -3", timeout=60)
run(c, "apt-get update -qq 2>&1 | tail -1", timeout=60)
run(c, "apt-get install -y python3.11 python3.11-venv python3.11-dev 2>&1 | tail -5", timeout=120)
run(c, "python3.11 --version")

print("\n=== 2. Install Node 16 (GLIBC 2.27 compatible) ===")
run(c, "curl -fsSL https://deb.nodesource.com/setup_16.x | bash - 2>&1 | tail -5", timeout=60)
run(c, "apt-get install -y nodejs 2>&1 | tail -3", timeout=120)
run(c, "node --version && npm --version")

print("\n=== 3. Python venv with 3.11 ===")
run(c, "rm -rf /opt/nirvana/backend/venv")
run(c, "cd /opt/nirvana/backend && python3.11 -m venv venv && echo VENV_OK")
run(c, "cd /opt/nirvana/backend && ./venv/bin/pip install --upgrade pip setuptools wheel 2>&1 | tail -2")
run(c, "cd /opt/nirvana/backend && ./venv/bin/pip install -r requirements.txt 2>&1 | tail -8", timeout=300)
run(c, "test -f /opt/nirvana/backend/venv/bin/uvicorn && echo UVICORN_OK || echo UVICORN_FAIL")

print("\n=== 4. DB migration ===")
run(c, "cd /opt/nirvana/backend && ./venv/bin/alembic upgrade head 2>&1")

print("\n=== 5. Update systemd service to use python3.11 venv ===")
svc = """[Unit]
Description=Nirvana Astrobiology API
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/nirvana/backend
Environment=DATABASE_URL=postgresql+asyncpg://mars_user:mars_password_2024@localhost:5432/mars_rover_db
ExecStart=/opt/nirvana/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
"""
sftp = c.open_sftp()
with sftp.open("/etc/systemd/system/nirvana.service", "w") as f:
    f.write(svc)
sftp.close()

run(c, "systemctl daemon-reload && systemctl restart nirvana")
time.sleep(5)
run(c, "systemctl is-active nirvana")
run(c, "journalctl -u nirvana --no-pager -n 10 2>&1")
run(c, "curl -s http://localhost:8000/health")

print("\n=== 6. Frontend build ===")
run(c, "cd /opt/nirvana/frontend && rm -rf node_modules package-lock.json")
run(c, "cd /opt/nirvana/frontend && npm install 2>&1 | tail -5", timeout=300)
run(c, "cd /opt/nirvana/frontend && npx vite build 2>&1", timeout=120)
run(c, "ls /opt/nirvana/frontend/dist/index.html 2>&1 && echo BUILD_OK || echo BUILD_FAIL")

print("\n=== 7. Nginx restart ===")
run(c, "systemctl restart nginx")
time.sleep(2)
run(c, "curl -s http://localhost:8000/health")
run(c, "curl -s -o /dev/null -w 'HTTP_%{http_code}' http://37.247.101.197/")

print(f"\n{'='*60}")
print(f"  NIRVANA DEPLOYED!")
print(f"  Dashboard: http://37.247.101.197")
print(f"  API: http://37.247.101.197/health")
print(f"{'='*60}")
c.close()
