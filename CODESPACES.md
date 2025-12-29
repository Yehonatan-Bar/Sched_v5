# Running Sched_v5 in GitHub Codespaces

## Quick Start

1. **Setup (first time only):**
   ```bash
   ./setup-backend.sh
   cd frontend && npm install && cd ..
   ```

2. **Start both services:**
   ```bash
   ./start-all.sh
   ```

## Important: Accessing the App in Codespaces

GitHub Codespaces forwards ports automatically, but you need to access the **correct URL**:

### ✅ CORRECT: Access the Frontend
- When you run `./start-all.sh`, Codespaces will forward **port 5173** (frontend)
- Look for the **"Ports"** tab in VS Code (bottom panel)
- Click on the globe icon 🌐 next to port **5173**
- This opens the **web application** in your browser

### ❌ INCORRECT: Don't Access Backend Directly
- If you open port **8000** (backend), you'll only see the API
- The backend serves JSON, not the web UI
- You'll get `{"detail":"Not Found"}` if you access a non-existent route

## Port Forwarding

Codespaces forwards these ports:
- **Port 5173**: Frontend (React app) - **Use this for the web UI** 🌐
- **Port 8000**: Backend (FastAPI) - Only for API calls

## Troubleshooting

### Issue: "Not Found" Error
**Solution**: Make sure you're accessing port **5173**, not port 8000.

### Issue: Can't Connect to Backend
1. Check both services are running: `./start-all.sh`
2. Verify ports are forwarded in VS Code "Ports" tab
3. Make sure port visibility is set to "Public" (right-click port → Port Visibility → Public)

### Issue: CORS Errors
The backend is already configured with `allow_origins=["*"]` for development.
If you still see CORS errors, ensure you're accessing the app via the Codespaces forwarded URL, not `localhost`.

## URLs in Codespaces

When ports are forwarded, Codespaces provides URLs like:
```
https://CODESPACE_NAME-5173.githubpreview.dev  ← Frontend (use this!)
https://CODESPACE_NAME-8000.githubpreview.dev  ← Backend API only
```

## Viewing Logs

To see logs while running:
```bash
# In another terminal
tail -f backend.log    # Backend logs
tail -f frontend.log   # Frontend logs
```

## Stopping Services

Press **Ctrl+C** in the terminal where `./start-all.sh` is running.
This will gracefully stop both backend and frontend.
