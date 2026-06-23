Every time you add a new API endpoint, you need to do 2 things:

1. Add the endpoint to your Python backend (`main.py`):
```py
@app.post("/your-new-endpoint")
async def your_new_endpoint(request: YourRequestModel):
    # Your endpoint logic here
    return {"result": "success"}
```

2. Add the endpoint to the `@api` matcher in `deploy/Caddyfile`:
```
@api {
    path /your-new-endpoint
    # ... existing paths ...
}
```

Then deploy (or on the VM manually):
```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy serves the React SPA from `/var/www/debatesim` and reverse-proxies matched API paths to FastAPI on port 5000.

Example: Adding `/my-new-endpoint`

1. Add to `main.py`:
```py
@app.post("/my-new-endpoint")
async def my_new_endpoint():
    return {"message": "Hello from new endpoint"}
```

2. Add to the `@api` block in `deploy/Caddyfile`:
```
path /my-new-endpoint
```

3. Reload Caddy:
```bash
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
```
