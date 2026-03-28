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
    safe_out = out.strip().encode("ascii", errors="replace").decode("ascii")
    safe_err = err.strip().encode("ascii", errors="replace").decode("ascii")
    if safe_out:
        print(safe_out[-3000:])
    if safe_err:
        print(f"STDERR: {safe_err[-1500:]}")
    print(f"[exit: {code}]")
    return code, out, err

def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {HOST}...")
    client.connect(HOST, username=USER, password=PASS, timeout=15)
    print("Connected!")

    print("\n=== 1. Fix Python venv & install deps ===")
    ssh_exec(client, "cd /opt/nirvana/backend && python3 -m venv venv")
    ssh_exec(client, "cd /opt/nirvana/backend && ./venv/bin/pip install --upgrade pip setuptools wheel 2>&1 | tail -3")
    ssh_exec(client, "cd /opt/nirvana/backend && ./venv/bin/pip install -r requirements.txt 2>&1 | tail -5", timeout=300)
    ssh_exec(client, "ls /opt/nirvana/backend/venv/bin/uvicorn")

    print("\n=== 2. Run database migration ===")
    ssh_exec(client, "cd /opt/nirvana/backend && DATABASE_URL=postgresql+asyncpg://mars_user:mars_password_2024@localhost:5432/mars_rover_db ./venv/bin/python -m alembic upgrade head 2>&1")

    print("\n=== 3. Restart backend service ===")
    ssh_exec(client, "systemctl restart nirvana")
    time.sleep(4)
    ssh_exec(client, "systemctl is-active nirvana")
    ssh_exec(client, "curl -s http://localhost:8000/health")

    print("\n=== 4. Fix frontend build ===")
    ssh_exec(client, "which node && node --version && which npm && npm --version")
    ssh_exec(client, "cd /opt/nirvana/frontend && npm install 2>&1 | tail -5", timeout=300)
    ssh_exec(client, "cd /opt/nirvana/frontend && npx vite build 2>&1", timeout=120)
    ssh_exec(client, "ls -la /opt/nirvana/frontend/dist/ 2>&1")

    print("\n=== 5. Restart nginx ===")
    ssh_exec(client, "systemctl restart nginx")

    print("\n=== 6. Final verification ===")
    time.sleep(2)
    ssh_exec(client, "curl -s http://localhost:8000/health")
    code, out, _ = ssh_exec(client, "curl -s -o /dev/null -w '%{http_code}' http://localhost/")

    print(f"\n{'='*60}")
    print(f"Dashboard: http://37.247.101.197")
    print(f"API:       http://37.247.101.197/api/sensor-data")
    print(f"Health:    http://37.247.101.197/health")
    print(f"{'='*60}")

    client.close()

if __name__ == "__main__":
    main()
