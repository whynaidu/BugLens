import { NextRequest, NextResponse } from "next/server";

/**
 * Trello callback route
 * Trello returns the token in the URL hash, which is client-side only.
 * This route serves a simple HTML page that extracts the token and displays it.
 */
export async function GET(request: NextRequest) {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const searchParams = request.nextUrl.searchParams;
  const state = searchParams.get("state"); // Contains orgSlug

  // Return an HTML page that extracts the token from the hash
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Trello Authorization</title>
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          background: #f5f5f5;
        }
        .container {
          background: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          text-align: center;
          max-width: 500px;
        }
        h1 { color: #0079BF; }
        .token-box {
          background: #f0f0f0;
          padding: 1rem;
          border-radius: 4px;
          word-break: break-all;
          font-family: monospace;
          margin: 1rem 0;
        }
        .instructions {
          color: #666;
          margin-bottom: 1rem;
        }
        button {
          background: #0079BF;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 4px;
          cursor: pointer;
          font-size: 1rem;
        }
        button:hover {
          background: #026AA7;
        }
        .copied {
          color: #22c55e;
          margin-top: 0.5rem;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Trello Authorization</h1>
        <div id="loading">
          <p>Processing authorization...</p>
        </div>
        <div id="success" style="display:none;">
          <p class="instructions">
            Copy the token below and paste it in BugLens to complete the connection:
          </p>
          <div class="token-box" id="token"></div>
          <button onclick="copyToken()">Copy Token</button>
          <p class="copied" id="copied" style="display:none;">Token copied!</p>
          <p style="margin-top: 1rem; color: #666; font-size: 0.875rem;">
            You can close this window after copying the token.
          </p>
        </div>
        <div id="error" style="display:none;">
          <p style="color: #dc2626;">Authorization was cancelled or failed.</p>
          <a href="${APP_URL}/${state}/settings/integrations">Return to settings</a>
        </div>
      </div>
      <script>
        const hash = window.location.hash;
        if (hash && hash.includes('token=')) {
          const token = hash.split('token=')[1].split('&')[0];
          document.getElementById('loading').style.display = 'none';
          document.getElementById('success').style.display = 'block';
          document.getElementById('token').textContent = token;
        } else {
          document.getElementById('loading').style.display = 'none';
          document.getElementById('error').style.display = 'block';
        }

        function copyToken() {
          const token = document.getElementById('token').textContent;
          navigator.clipboard.writeText(token).then(() => {
            document.getElementById('copied').style.display = 'block';
          });
        }
      </script>
    </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
    },
  });
}
