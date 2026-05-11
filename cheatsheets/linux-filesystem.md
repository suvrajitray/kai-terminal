# Linux Filesystem Structure

## Root Directory Tree

```
/
├── bin/        Essential binaries (ls, cp, mv) — available before /usr mounts
├── sbin/       System binaries for root (fdisk, iptables)
├── boot/       Kernel and bootloader files
├── dev/        Device files (disks, TTYs, null, random)
├── etc/        Configuration files for all services (nginx.conf, systemd units)
├── home/       User home directories (/home/username)
├── lib/        Shared libraries needed by bin/ and sbin/
├── media/      Mount points for removable media (USB, CD)
├── mnt/        Temporary mount points
├── opt/        Optional/third-party software — self-contained apps
├── proc/       Virtual filesystem — live kernel and process info (/proc/cpuinfo)
├── root/       Home directory for the root user
├── run/        Runtime data — PIDs, sockets, cleared on reboot
├── srv/        Data served by the system (FTP, HTTP content)
├── sys/        Virtual filesystem — hardware and kernel info
├── tmp/        Temporary files — cleared on reboot
├── usr/
│   ├── bin/    Most user commands (dotnet, node, git)
│   ├── lib/    Libraries for usr/bin programs
│   └── local/  Manually installed software (not via package manager)
└── var/
    ├── log/    Application and system logs
    ├── lib/    Persistent app data (PostgreSQL data files)
    ├── cache/  Cached data (apt cache)
    └── tmp/    Temp files that persist across reboots
```

## Key Directories to Know

| Path | Purpose |
|------|---------|
| `/etc/` | All config files — edit these to configure services |
| `/var/log/` | All logs — first place to look when something breaks |
| `/opt/` | Self-contained apps that don't follow standard Linux layout |
| `/tmp/` | Safe scratch space — don't store anything important here |
| `/proc/` | Read-only window into the running kernel — not real files |
| `/home/` | Each user gets their own folder here |

## Common Log Locations

| Service | Log Path |
|---------|---------|
| Nginx | `/var/log/nginx/access.log`, `error.log` |
| PostgreSQL | `/var/log/postgresql/` |
| Systemd services | `/var/log/` or `journalctl -u <service>` |
| System general | `/var/log/syslog` |
| Auth/SSH | `/var/log/auth.log` |

## Useful Commands

```bash
# Disk usage
df -h                        # free space per partition
du -sh /var/log/*            # size of each log folder

# Find large files
find /var/log -size +100M

# Check what's eating disk
du -h --max-depth=1 /var | sort -hr
```

## File Permissions Basics

```
-rwxr-xr-x   1  user  group  size  date  filename
 ^^^           owner permissions
    ^^^        group permissions
       ^^^     everyone else permissions

r = read (4)
w = write (2)
x = execute (1)

chmod 755 file   # rwxr-xr-x  — owner full, others read+execute
chmod 600 file   # rw-------  — owner read+write only (secrets/env files)
chmod +x  file   # add execute for everyone
```

## Ownership

```bash
chown user:group file        # change owner and group
chown -R user:group folder/  # recursive
sudo chown root:root /etc/kaiterminal/api.env
sudo chmod 600 /etc/kaiterminal/api.env
```
