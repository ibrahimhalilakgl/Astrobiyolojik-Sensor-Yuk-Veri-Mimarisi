import paramiko
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
    safe_out = out.strip().encode("ascii", errors="replace").decode("ascii")
    safe_err = err.strip().encode("ascii", errors="replace").decode("ascii")
    if safe_out:
        print(safe_out[-2000:])
    if safe_err and code != 0:
        print(f"STDERR: {safe_err[-1000:]}")
    return code, out, err

def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {HOST}...")
    client.connect(HOST, username=USER, password=PASS, timeout=15)
    print("Connected!")

    print("\n=== Check backend service ===")
    ssh_exec(client, "systemctl restart nirvana")
    time.sleep(3)
    ssh_exec(client, "systemctl is-active nirvana")
    ssh_exec(client, "journalctl -u nirvana --no-pager -n 15 2>&1")

    print("\n=== Configure Nginx ===")
    nginx_conf = r"""server {
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
    sftp = client.open_sftp()
    with sftp.open("/etc/nginx/sites-available/nirvana", "w") as f:
        f.write(nginx_conf)
    sftp.close()

    ssh_exec(client, "ln -sf /etc/nginx/sites-available/nirvana /etc/nginx/sites-enabled/nirvana")
    ssh_exec(client, "rm -f /etc/nginx/sites-enabled/default")
    ssh_exec(client, "nginx -t 2>&1")
    ssh_exec(client, "systemctl restart nginx")

    print("\n=== Check frontend build ===")
    ssh_exec(client, "ls -la /opt/nirvana/frontend/dist/ 2>&1 | head -10")

    print("\n=== Verify ===")
    time.sleep(2)
    ssh_exec(client, "curl -s http://localhost:8000/health 2>&1")
    ssh_exec(client, "curl -s -o /dev/null -w '%{http_code}' http://localhost/ 2>&1")

    print(f"\n{'='*60}")
    print(f"DEPLOYMENT COMPLETE!")
    print(f"Dashboard: http://37.247.101.197")
    print(f"API:       http://37.247.101.197/api/sensor-data")
    print(f"Health:    http://37.247.101.197/health")
    print(f"{'='*60}")

    client.close()

if __name__ == "__main__":
    main()
