# Deployment Instructions (GitHub + Vercel)

Follow these steps to host your **Study Timer by Sai** app on Vercel using GitHub.

## 1. Prepare for GitHub
1.  **Download your code**: Use the "Export to ZIP" option in the AI Studio settings menu.
2.  **Initialize Git**:
    ```bash
    git init
    git add .
    git commit -m "Initial commit"
    ```
3.  **Create a GitHub Repo**: Create a new repository on GitHub and push your code:
    ```bash
    git remote add origin https://github.com/your-username/your-repo-name.git
    git branch -M main
    git push -u origin main
    ```

## 2. Deploy to Vercel
1.  Go to [Vercel](https://vercel.com) and click **"Add New" -> "Project"**.
2.  Import your GitHub repository.
3.  **Environment Variables**: This is the most important step. In the Vercel project settings, add the following variables (copy values from your `firebase-applet-config.json`):
    *   `VITE_FIREBASE_API_KEY`
    *   `VITE_FIREBASE_AUTH_DOMAIN`
    *   `VITE_FIREBASE_PROJECT_ID`
    *   `VITE_FIREBASE_STORAGE_BUCKET`
    *   `VITE_FIREBASE_MESSAGING_SENDER_ID`
    *   `VITE_FIREBASE_APP_ID`
    *   `VITE_FIREBASE_DATABASE_ID`
4.  Click **Deploy**.

## 3. Firebase Authentication Setup
Since you are moving to a new domain (e.g., `your-app.vercel.app`), you must allowlist it in the Firebase Console:
1.  Go to **Firebase Console -> Authentication -> Settings -> Authorized Domains**.
2.  Add your Vercel deployment URL (e.g., `study-timer-sai.vercel.app`).

## 4. Security Note
The `firebase-applet-config.json` file contains your Firebase keys. While these are safe to be public in a client-side app, it is best practice to:
1.  Add `firebase-applet-config.json` to your `.gitignore` before pushing to a public GitHub repo.
2.  Rely entirely on the Environment Variables in Vercel.

---
**Happy Focusing!** ⏱️
