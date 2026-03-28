import paramiko
import time

HOST = "37.247.101.197"
USER = "root"
PASS = "!8!aav4z5HSX"

def ssh_exec(client, cmd, timeout=300):
    print(f"\n>>> {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    combined = (out + err).strip().encode("ascii", errors="replace").decode("ascii")
    if combined:
        print(combined[-3000:])
    print(f"[exit: {code}]")
    return code, out, err

def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASS, timeout=15)
    print("Connected!")

    print("\n=== 1. Install Node 20.x ===")
    ssh_exec(client, "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>&1 | tail -5", timeout=60)
    ssh_exec(client, "apt-get install -y nodejs 2>&1 | tail -3", timeout=120)
    ssh_exec(client, "node --version && npm --version && npx --version")

    print("\n=== 2. Fix Python venv ===")
    ssh_exec(client, "rm -rf /opt/nirvana/backend/venv")
    ssh_exec(client, "python3 --version")
    ssh_exec(client, "cd /opt/nirvana/backend && python3 -m venv venv && ./venv/bin/pip install --upgrade pip 2>&1 | tail -2")
    ssh_exec(client, "cd /opt/nirvana/backend && ./venv/bin/pip install -r requirements.txt 2>&1 | tail -8", timeout=300)
    ssh_exec(client, "test -f /opt/nirvana/backend/venv/bin/uvicorn && echo 'UVICORN_OK' || echo 'UVICORN_MISSING'")

    print("\n=== 3. Database migration ===")
    ssh_exec(client, "cd /opt/nirvana/backend && DATABASE_URL_SYNC=postgresql://mars_user:mars_password_2024@localhost:5432/mars_rover_db ./venv/bin/python -m alembic upgrade head 2>&1")

    print("\n=== 4. Restart backend ===")
    ssh_exec(client, "systemctl restart nirvana")
    time.sleep(5)
    ssh_exec(client, "systemctl is-active nirvana")
    ssh_exec(client, "journalctl -u nirvana --no-pager -n 5 2>&1")
    ssh_exec(client, "curl -s http://localhost:8000/health")

    print("\n=== 5. Frontend build ===")
    ssh_exec(client, "cd /opt/nirvana/frontend && rm -rf node_modules package-lock.json")
    ssh_exec(client, "cd /opt/nirvana/frontend && npm install 2>&1 | tail -5", timeout=300)
    ssh_exec(client, "cd /opt/nirvana/frontend && npx vite build 2>&1", timeout=120)
    ssh_exec(client, "ls /opt/nirvana/frontend/dist/index.html && echo 'BUILD_OK'")

    print("\n=== 6. Final check ===")
    ssh_exec(client, "systemctl restart nginx")
    time.sleep(2)
    ssh_exec(client, "curl -s http://localhost:8000/health")
    ssh_exec(client, "curl -s -o /dev/null -w 'HTTP_%{http_code}' http://localhost/")

    print(f"\n{'='*60}")
    print(f"Dashboard: http://37.247.101.197")
    print(f"{'='*60}")
    client.close()

if __name__ == "__main__":
    main()
