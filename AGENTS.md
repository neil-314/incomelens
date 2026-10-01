# IncomeLens development

Python 3.12 app. Business rules: pipeline.py. Plaid: plaid.py.
Routes: app.py. Presentation: views.py. Use normal functions and dictionaries.
Run: python -m uvicorn app:app --reload --port 8000
Checks: python -m pytest tests/test_pipeline.py tests/test_server.py
Browser checks (server running): python -m pytest tests/test_browser.py

Keep credentials in .env.local or Vercel. Never log access tokens or cookies.
Use Plaid Sandbox only. HTML/CSS and the small Plaid SDK callback are embedded
presentation code in views.py. There is no Node.js or frontend build step.
