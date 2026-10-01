# IncomeLens development

Python 3.12 app. Business rules: pipeline.py. Plaid: plaid.py.
Routes: app.py. Presentation: views.py. Use normal functions and dictionaries.
Run: python -m uvicorn app:app --reload --port 8000
Checks: python -m pytest tests/test_pipeline.py tests/test_server.py
Browser checks (server running): python -m pytest tests/test_browser.py

