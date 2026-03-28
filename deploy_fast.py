import paramiko, time, os

HOST = "37.247.101.197"
USER = "root"
PASS = "!8!aav4z5HSX"

def run(c, cmd, t=300):
    print(f"$ {cmd[:200]}")
    _, so, se = c.exec_command(cmd, timeout=t)
    o = so.read().decode("utf-8","replace")
    e = se.read().decode("utf-8","replace")
    x = so.channel.recv_exit_status()
    txt = (o+e).strip().encode("ascii","replace").decode("ascii")
    if txt: print(txt[-2000:])
    print(f"[exit:{x}]\n")
    return x,o,e

def upload_dir(sftp, local, remote):
    try: sftp.stat(remote)
    except: sftp.mkdir(remote)
    for item in os.listdir(local):
        lp = os.path.join(local, item)
        rp = f"{remote}/{item}"
        if item in ("node_modules",".git","__pycache__","venv","data.zip","reference.pdf"): continue
        if os.path.isdir(lp):
            upload_dir(sftp, lp, rp)
        elif os.path.isfile(lp):
            sz = os.path.getsize(lp)
            if sz > 30_000_000: continue
            sftp.put(lp, rp)

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASS, timeout=15)
print("Connected!\n")

# Kill old broken builds
run(c, "pkill -f 'make.*Python' 2>/dev/null; systemctl stop nirvana 2>/dev/null; echo OK")

print("=== 1. Miniconda ===")
run(c, "test -f /opt/miniconda/bin/python && echo CONDA_EXISTS || echo NEED_INSTALL")
code, out, _ = run(c, "test -f /opt/miniconda/bin/python && echo YES")
if "YES" not in out:
    run(c, "wget -q https://repo.anaconda.com/miniconda/Miniconda3-py311_24.7.1-0-Linux-x86_64.sh -O /tmp/mc.sh && bash /tmp/mc.sh -b -p /opt/miniconda 2>&1 | tail -3", t=120)
run(c, "/opt/miniconda/bin/python --version")

print("=== 2. Install Python packages ===")
run(c, "/opt/miniconda/bin/pip install fastapi 'uvicorn[standard]' 'sqlalchemy[asyncio]' asyncpg alembic psycopg2-binary python-dotenv numpy pandas pydantic 2>&1 | tail -5", t=300)
run(c, "test -f /opt/miniconda/bin/uvicorn && echo UVICORN_OK")

print("=== 3. Upload backend (skip data, use existing) ===")
sftp = c.open_sftp()
base = r"c:\Users\Teatl\OneDrive\Desktop\nirvana\mars-rover-dashboard"
backend_files = [
    "main.py",
    "database.py",
    "models.py",
    "schemas.py",
    "crud.py",
    "simulator.py",
    "edge_processor.py",
    "compressor.py",
    "requirements.txt",
    "alembic.ini",
    ".env.example",
]
for f in backend_files:
    fp = os.path.join(base, "backend", f)
    if os.path.exists(fp):
        sftp.put(fp, f"/opt/nirvana/backend/{f}")
        print(f"  Uploaded {f}")

# routers
try: sftp.stat("/opt/nirvana/backend/routers")
except: sftp.mkdir("/opt/nirvana/backend/routers")
for f in os.listdir(os.path.join(base,"backend","routers")):
    fp = os.path.join(base,"backend","routers",f)
    if os.path.isfile(fp):
        sftp.put(fp, f"/opt/nirvana/backend/routers/{f}")
        print(f"  Uploaded routers/{f}")

# alembic
try: sftp.stat("/opt/nirvana/backend/alembic")
except: sftp.mkdir("/opt/nirvana/backend/alembic")
try: sftp.stat("/opt/nirvana/backend/alembic/versions")
except: sftp.mkdir("/opt/nirvana/backend/alembic/versions")
for sub in ["env.py","script.py.mako"]:
    fp = os.path.join(base,"backend","alembic",sub)
    if os.path.exists(fp):
        sftp.put(fp, f"/opt/nirvana/backend/alembic/{sub}")
for f in os.listdir(os.path.join(base,"backend","alembic","versions")):
    fp = os.path.join(base,"backend","alembic","versions",f)
    if os.path.isfile(fp):
        sftp.put(fp, f"/opt/nirvana/backend/alembic/versions/{f}")

print("=== 4. Upload pre-built frontend dist ===")
dist = os.path.join(base, "frontend", "dist")
try: sftp.stat("/opt/nirvana/frontend")
except: sftp.mkdir("/opt/nirvana/frontend")
upload_dir(sftp, dist, "/opt/nirvana/frontend/dist")
print("  Frontend dist uploaded!")
sftp.close()

print("=== 5. DB setup ===")
run(c, "systemctl start postgresql")
run(c, "su - postgres -c \"psql -tc \\\"SELECT 1 FROM pg_roles WHERE rolname='mars_user'\\\" | grep -q 1 || psql -c \\\"CREATE USER mars_user WITH PASSWORD 'mars_password_2024';\\\"\"")
run(c, "su - postgres -c \"psql -lqt | grep -q mars_rover_db || psql -c \\\"CREATE DATABASE mars_rover_db OWNER mars_user;\\\"\"")
run(c, "su - postgres -c \"psql -c \\\"GRANT ALL PRIVILEGES ON DATABASE mars_rover_db TO mars_user;\\\"\"")

print("=== 6. Alembic migration ===")
run(c, "cd /opt/nirvana/backend && /opt/miniconda/bin/alembic upgrade head 2>&1")

print("=== 7. Systemd service ===")
svc = """[Unit]
Description=Sentinel API
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/nirvana/backend
Environment=DATABASE_URL=postgresql+asyncpg://mars_user:mars_password_2024@localhost:5432/mars_rover_db
ExecStart=/opt/miniconda/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
"""
sftp = c.open_sftp()
with sftp.open("/etc/systemd/system/nirvana.service","w") as f:
    f.write(svc)
sftp.close()

run(c, "systemctl daemon-reload && systemctl restart nirvana")
time.sleep(5)
run(c, "systemctl is-active nirvana")
run(c, "curl -sf http://localhost:8000/health && echo API_OK || echo API_FAIL")

print("=== 8. Nginx ===")
nginx = """server {
    listen 80;
    server_name 37.247.101.197;
    root /opt/nirvana/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
    location /health {
        proxy_pass http://127.0.0.1:8000;
    }
}
"""
sftp = c.open_sftp()
with sftp.open("/etc/nginx/sites-available/nirvana","w") as f:
    f.write(nginx)
sftp.close()
run(c, "ln -sf /etc/nginx/sites-available/nirvana /etc/nginx/sites-enabled/nirvana && rm -f /etc/nginx/sites-enabled/default")
run(c, "nginx -t 2>&1")
run(c, "systemctl restart nginx")

print("=== 9. FINAL CHECK ===")
time.sleep(2)
run(c, "curl -sf http://localhost:8000/health")
run(c, "curl -s -o /dev/null -w 'HTTP_%{http_code}' http://37.247.101.197/")

print(f"\n{'='*50}")
print(f"  http://37.247.101.197")
print(f"{'='*50}")
c.close()
