import paramiko, os

HOST = "37.247.101.197"
USER = "root"
PASS = "!8!aav4z5HSX"

def upload_dir(sftp, local, remote):
    try: sftp.stat(remote)
    except: sftp.mkdir(remote)
    for item in os.listdir(local):
        lp = os.path.join(local, item)
        rp = f"{remote}/{item}"
        if os.path.isdir(lp):
            upload_dir(sftp, lp, rp)
        elif os.path.isfile(lp):
            sftp.put(lp, rp)

def run(c, cmd, t=60):
    print(f"$ {cmd[:150]}")
    _, so, se = c.exec_command(cmd, timeout=t)
    o = so.read().decode("utf-8","replace")
    e = se.read().decode("utf-8","replace")
    x = so.channel.recv_exit_status()
    txt = (o+e).strip().encode("ascii","replace").decode("ascii")
    if txt: print(txt[-1500:])
    print(f"[{x}]\n")
    return x

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASS, timeout=15)
print("Connected!\n")

base = r"c:\Users\Teatl\OneDrive\Desktop\nirvana\mars-rover-dashboard"

print("=== Upload backend files ===")
sftp = c.open_sftp()
for f in ["main.py","simulator.py","edge_processor.py","crud.py","database.py","models.py","schemas.py"]:
    sftp.put(os.path.join(base,"backend",f), f"/opt/nirvana/backend/{f}")
    print(f"  {f}")
for f in os.listdir(os.path.join(base,"backend","routers")):
    fp = os.path.join(base,"backend","routers",f)
    if os.path.isfile(fp):
        sftp.put(fp, f"/opt/nirvana/backend/routers/{f}")

print("\n=== Upload frontend dist ===")
run(c, "rm -rf /opt/nirvana/frontend/dist")
upload_dir(sftp, os.path.join(base,"frontend","dist"), "/opt/nirvana/frontend/dist")
print("  dist uploaded!")
sftp.close()

print("=== Restart services ===")
run(c, "systemctl restart nirvana")
import time; time.sleep(4)
run(c, "systemctl is-active nirvana")
run(c, "curl -sf http://localhost:8000/health")
run(c, "systemctl restart nginx")
run(c, "curl -s -o /dev/null -w 'HTTP_%{http_code}' http://37.247.101.197/")

print(f"Done! http://37.247.101.197")
c.close()
