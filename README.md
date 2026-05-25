# PEAK Tracker

Cycle-synced training tracker with Supabase cloud storage.

---

## Deploy in 5 steps

### 1. Create a GitHub repo
- Go to github.com → click the **+** → New repository
- Name it `peak-tracker`
- Keep it **Public**
- Click **Create repository**
- You'll see a page with setup instructions — keep it open

### 2. Upload these files to GitHub
On the repo page, click **uploading an existing file**
- Drag the entire `peak-tracker` folder contents into the upload area
- OR use the GitHub Desktop app (easier): github.com/desktop
- Commit message: `Initial PEAK Tracker`
- Click **Commit changes**

### 3. Deploy to Vercel
- Go to vercel.com and log in with GitHub
- Click **Add New → Project**
- Find and select your `peak-tracker` repo
- Vercel will auto-detect it as a React app
- Click **Deploy** — takes about 60 seconds
- You'll get a URL like: `peak-tracker-yourname.vercel.app`

### 4. That's it
- Your app is live at the Vercel URL
- Data saves to Supabase automatically
- Works on phone, tablet, computer — any browser
- Data persists forever (Supabase free tier = 500MB, you'll use ~1MB/year)

### 5. Add to your phone home screen
- Open the URL in Safari (iPhone) or Chrome (Android)
- iPhone: tap Share → Add to Home Screen
- Android: tap menu → Add to Home Screen
- Now it works like a native app

---

## Database (Supabase)
- Project: https://yeexedluqmvekewrukpq.supabase.co
- Tables: `peak_logs` (daily entries) + `peak_milestones` (goal tracking)
- View your raw data: Supabase dashboard → Table Editor

---

## Local development (optional)
```bash
npm install
npm start
```
Opens at http://localhost:3000
