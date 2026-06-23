# DebateSim – Developer Instructions

> **Live site:** https://debatesim.us  
> These notes are for contributors and self-hosters. Users can head straight to the live site.

---

## Contents
1. Local Setup
2. Running the App (Dev)
3. Production Deployment on a VM
4. CI/CD via GitHub Actions
5. Common Commands &amp; Tips
6. Contributing

---

## 1  Local Setup
```bash
# clone &amp; enter repo
git clone https://github.com/your-org/debatesim.git
cd DebateSim

# Python backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```
Create a `.env` file in the repo root:
```env
OPENROUTER_API_KEY=<your-key-here>
```

---

## 2  Running the App (Development)
```bash
# backend (from repo root)
python -m uvicorn main:app --reload

# frontend (in ./frontend)
npm run dev   # → http://localhost:3000
```
Update `src/api.js` if you change ports.

---

## 3  Production Deployment on an Ubuntu VM
These steps assume a **DigitalOcean Ubuntu 24.04** droplet (`206.189.217.9`) with Caddy installed and ports 22, 80, 443, 5000 open.

```bash
# 1  login & pull code
git clone https://github.com/your-org/debatesim.git
cd DebateSim

# 2  Python venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 3  Backend (port 5000)
nohup uvicorn main:app --host 0.0.0.0 --port 5000 --reload > backend.log 2>&1 &

# 4  Frontend
cd frontend
npm install
VITE_API_URL=https://debatesim.us npm run build   # → dist/

# serve with Caddy
sudo mkdir -p /var/www
sudo ln -sfn $(pwd)/dist /var/www/debatesim
sudo cp ../deploy/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```
Caddy serves `/` from the static `dist` files (ports 80/443) and reverse-proxies API routes to FastAPI on 5000. See [`guides/CADDY_RULES.md`](guides/CADDY_RULES.md) when adding new endpoints.

---

## 4  CI / CD
The **`.github/workflows/deploy.yml`** file performs:
1. SSH to VM using `VM_HOST`, `VM_USER`, `VM_SSH_KEY` secrets.
2. Pull latest code.
3. Restart backend (PID-file controlled).
4. Rebuild frontend and reload Caddy.

Secrets required:
- `VM_HOST` – public IP (`206.189.217.9`)
- `VM_USER` – ssh user (e.g. `root`)
- `VM_SSH_KEY` – private key corresponding to a public key in `~/.ssh/authorized_keys` on the VM.

---

## 5  Common Commands
| Action | Command |
|--------|---------|
| Check backend log | `tail -f backend.log` |
| Kill backend | `pkill -f "uvicorn main:app"` |
| Re-serve frontend temporarily | `sudo npx serve -s dist -l 80` |
| Find process on port 5000 | `lsof -i:5000` |
| Validate Caddy config | `sudo caddy validate --config /etc/caddy/Caddyfile` |
| Reload Caddy | `sudo systemctl reload caddy` |

---

## 6  Contributing
1. Fork → feature branch → PR.
2. Commit message style: `feat(component): add X (closes #123)`
3. Run linter: `npm run lint` in frontend.
4. Add/ update tests (coming soon).

Thanks for helping make DebateSim better!  ✨
