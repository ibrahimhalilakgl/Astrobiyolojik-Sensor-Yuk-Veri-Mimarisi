import paramiko

HOST = "37.247.101.197"
USER = "root"
PASS = "!8!aav4z5HSX"

def run(c, cmd, timeout=300):
    print(f"\n$ {cmd[:150]}")
    _, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    text = (out + err).strip().encode("ascii", errors="replace").decode("ascii")
    if text: print(text[-2000:])
    print(f"[{code}]")
    return code, out, err

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASS, timeout=15)
print("Connected\n")

run(c, "cat /etc/os-release")
run(c, "python3 --version")
run(c, "lsb_release -a 2>&1")
run(c, "uname -r")
run(c, "ldd --version 2>&1 | head -1")
run(c, "apt list --installed 2>/dev/null | grep -i python3 | head -10")

c.close()
