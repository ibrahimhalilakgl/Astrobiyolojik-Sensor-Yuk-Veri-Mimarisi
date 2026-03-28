import paramiko
import sys
import time

HOST = "37.247.101.197"
USER = "root"
PASS = "!8!aav4z5HSX"

def ssh_exec(client, cmd, timeout=120):
    print(f"\n>>> {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        safe = out.strip()[-2000:].encode("ascii", errors="replace").decode("ascii")
        print(safe)
    if err.strip() and code != 0:
        safe = err.strip()[-1000:].encode("ascii", errors="replace").decode("ascii")
        print(f"STDERR: {safe}")
    return code, out, err

def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {HOST}...")
    client.connect(HOST, username=USER, password=PASS, timeout=15)
    print("Connected!")

    ssh_exec(client, "uname -a")
    ssh_exec(client, "free -h | head -2")
    ssh_exec(client, "df -h / | tail -1")

    print("\n=== Installing system dependencies ===")
    ssh_exec(client, "apt-get update -qq && apt-get install -y -qq python3 python3-pip python3-venv nodejs npm nginx postgresql postgresql-contrib curl git > /dev/null 2>&1 && echo 'DEPS_OK'", timeout=300)

    print("\n=== Setting up PostgreSQL ===")
    ssh_exec(client, "systemctl start postgresql && systemctl enable postgresql")
    ssh_exec(client, "su - postgres -c \"psql -tc \\\"SELECT 1 FROM pg_roles WHERE rolname='mars_user'\\\" | grep -q 1 || psql -c \\\"CREATE USER mars_user WITH PASSWORD 'mars_password_2024';\\\"\"")
    ssh_exec(client, "su - postgres -c \"psql -lqt | grep -q mars_rover_db || psql -c \\\"CREATE DATABASE mars_rover_db OWNER mars_user;\\\"\"")
    ssh_exec(client, "su - postgres -c \"psql -c \\\"GRANT ALL PRIVILEGES ON DATABASE mars_rover_db TO mars_user;\\\"\"")

    print("\n=== Creating project directory ===")
    ssh_exec(client, "mkdir -p /opt/nirvana")

    print("\n=== Uploading project files ===")
    sftp = client.open_sftp()

    import os
    local_base = r"c:\Users\Teatl\OneDrive\Desktop\nirvana\mars-rover-dashboard"

    def upload_dir(local_dir, remote_dir):
        try:
            sftp.stat(remote_dir)
        except FileNotFoundError:
            sftp.mkdir(remote_dir)

        for item in os.listdir(local_dir):
            local_path = os.path.join(local_dir, item)
            remote_path = f"{remote_dir}/{item}"

            if item in ("node_modules", ".git", "__pycache__", ".env", "reference.pdf", "data.zip"):
                continue

            if os.path.isfile(local_path):
                size = os.path.getsize(local_path)
                if size > 50_000_000:
                    print(f"  SKIP (too large): {remote_path}")
                    continue
                print(f"  Upload: {remote_path} ({size} bytes)")
                sftp.put(local_path, remote_path)
            elif os.path.isdir(local_path):
                upload_dir(local_path, remote_path)

    upload_dir(local_base, "/opt/nirvana")
    sftp.close()
    print("Upload complete!")

    print("\n=== Setting up Python backend ===")
    ssh_exec(client, "cd /opt/nirvana/backend && python3 -m venv venv && source venv/bin/activate && pip install --upgrade pip > /dev/null 2>&1 && pip install -r requirements.txt > /dev/null 2>&1 && echo 'PIP_OK'", timeout=300)

    print("\n=== Running database migration ===")
    ssh_exec(client, "cd /opt/nirvana/backend && source venv/bin/activate && python -m alembic upgrade head 2>&1")

    print("\n=== Setting up Frontend ===")
    ssh_exec(client, "cd /opt/nirvana/frontend && npm install --production=false > /dev/null 2>&1 && echo 'NPM_OK'", timeout=300)
    ssh_exec(client, "cd /opt/nirvana/frontend && npx vite build 2>&1", timeout=120)

    print("\n=== Creating systemd service ===")
    service = """[Unit]
Description=Nirvana Mars Rover API
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
    ssh_exec(client, f"cat > /etc/systemd/system/nirvana.service << 'SVCEOF'\n{service}SVCEOF")
    ssh_exec(client, "systemctl daemon-reload && systemctl enable nirvana && systemctl restart nirvana")
    time.sleep(3)
    ssh_exec(client, "systemctl status nirvana --no-pager -l | head -15")

    print("\n=== Configuring Nginx ===")
    nginx_conf = """server {
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
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    location /health {
        proxy_pass http://127.0.0.1:8000;
    }
}
"""
    ssh_exec(client, f"cat > /etc/nginx/sites-available/nirvana << 'NGEOF'\n{nginx_conf}NGEOF")
    ssh_exec(client, "ln -sf /etc/nginx/sites-available/nirvana /etc/nginx/sites-enabled/nirvana")
    ssh_exec(client, "rm -f /etc/nginx/sites-enabled/default")
    ssh_exec(client, "nginx -t 2>&1")
    ssh_exec(client, "systemctl restart nginx")

    print("\n=== Verifying deployment ===")
    time.sleep(2)
    ssh_exec(client, "curl -s http://localhost:8000/health")
    ssh_exec(client, "curl -s -o /dev/null -w '%{http_code}' http://localhost/")

    print(f"\n{'='*60}")
    print(f"DEPLOYMENT COMPLETE!")
    print(f"Dashboard: http://37.247.101.197")
    print(f"API: http://37.247.101.197/api/sensor-data")
    print(f"Health: http://37.247.101.197/health")
    print(f"{'='*60}")

    client.close()

if __name__ == "__main__":
    main()
