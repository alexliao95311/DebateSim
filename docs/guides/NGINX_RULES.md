Every time you add a new API endpoint, you need to do 2 things:

  1. Add the endpoint to your Python backend (main.py)
```
  @app.post("/your-new-endpoint")
  async def your_new_endpoint(request: YourRequestModel):
      # Your endpoint logic here
      return {"result": "success"}
```
  2. Add the endpoint to your nginx configuration

  Edit /etc/nginx/sites-enabled/debatesim and add this block before
   the location / block:
```
  location /your-new-endpoint {
      proxy_pass http://localhost:5000/your-new-endpoint;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_pass_request_body on;
      proxy_pass_request_headers on;
      proxy_read_timeout 300;
      proxy_connect_timeout 300;
      proxy_send_timeout 300;
  }
```
  Then reload nginx:
  `sudo nginx -t && sudo systemctl reload nginx`

  Example: Adding /my-new-endpoint

  1. Add to main.py:
  ```py
  @app.post("/my-new-endpoint")
  async def my_new_endpoint():
      return {"message": "Hello from new endpoint"}
    ```

  2. Add to nginx config (insert after line 132 in current config):
  ```
  location /my-new-endpoint {
      proxy_pass http://localhost:5000/my-new-endpoint;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_pass_request_body on;
      proxy_pass_request_headers on;
      proxy_read_timeout 300;
      proxy_connect_timeout 300;
      proxy_send_timeout 300;
  }
    ```
  3. Reload nginx:
  `sudo nginx -t && sudo systemctl reload nginx`

