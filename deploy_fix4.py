import paramiko
import time

HOST = "37.247.101.197"
USER = "root"
PASS = "!8!aav4z5HSX"

def ssh_exec(client, cmd, timeout=300):
    print(f"\n>>> {cmd[:120]}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    combined = (out + err).strip().encode("ascii", errors="replace").decode("ascii")
    if combined:
        print(combined[-2500:])
    print(f"[exit: {code}]")
    return code, out, err

def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASS, timeout=15)
    print("Connected!")

    print("\n=== Debug current state ===")
    ssh_exec(client, "python3 --version && node --version 2>&1 && npm --version 2>&1")
    ssh_exec(client, "cat /etc/os-release | head -3")
    ssh_exec(client, "which python3 && which pip3 && which node && which npm")
    ssh_exec(client, "ls /opt/nirvana/backend/venv/bin/ 2>&1 | head -10")

    print("\n=== Fix Node.js - install via snap or nvm ===")
    ssh_exec(client, "apt-get remove -y nodejs npm 2>&1 | tail -3")
    ssh_exec(client, "curl -fsSL https://deb.nodesource.com/setup_20.x -o /tmp/nodesource.sh 2>&1 && bash /tmp/nodesource.sh 2>&1 | tail -10", timeout=60)
    ssh_exec(client, "apt-get install -y nodejs 2>&1 | tail -5", timeout=120)
    ssh_exec(client, "node --version 2>&1 && npm --version 2>&1")

    print("\n=== Fix Python venv ===")
    ssh_exec(client, "rm -rf /opt/nirvana/backend/venv")
    ssh_exec(client, "apt-get install -y python3-venv python3-dev 2>&1 | tail -3")
    ssh_exec(client, "cd /opt/nirvana/backend && python3 -m venv venv")
    ssh_exec(client, "cd /opt/nirvana/backend && ./venv/bin/pip install --upgrade pip setuptools 2>&1 | tail -3")
    ssh_exec(client, "cd /opt/nirvana/backend && ./venv/bin/pip install -r requirements.txt 2>&1 | tail -10", timeout=300)
    ssh_exec(client, "ls /opt/nirvana/backend/venv/bin/uvicorn && echo 'UVICORN EXISTS'")

    print("\n=== DB migration ===")
    ssh_exec(client, "cd /opt/nirvana/backend && ./venv/bin/alembic upgrade head 2>&1")

    print("\n=== Backend service ===")
    ssh_exec(client, "systemctl restart nirvana && sleep 4 && systemctl is-active nirvana")
    ssh_exec(client, "curl -sf http://localhost:8000/health && echo '' || echo 'BACKEND_DOWN'")

    print("\n=== Frontend build ===")
    ssh_exec(client, "cd /opt/nirvana/frontend && rm -rf node_modules package-lock.json")
    ssh_exec(client, "cd /opt/nirvana/frontend && npm install 2>&1 | tail -5", timeout=300)
    ssh_exec(client, "cd /opt/nirvana/frontend && ./node_modules/.bin/vite build 2>&1", timeout=120)
    ssh_exec(client, "ls /opt/nirvana/frontend/dist/index.html 2>&1 && echo 'FRONTEND_BUILD_OK'")

    print("\n=== Nginx ===")
    ssh_exec(client, "systemctl restart nginx && sleep 1")
    ssh_exec(client, "curl -s -o /dev/null -w 'HTTP_%{http_code}' http://localhost/")

    print(f"\n{'='*60}")
    print(f"Dashboard: http://37.247.101.197")
    print(f"{'='*60}")
    client.close()

if __name__ == "__main__":
    main()
