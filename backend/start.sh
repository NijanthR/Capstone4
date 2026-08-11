#!/bin/sh
echo "Starting ResearchAI API..."
exec gunicorn app.main:app -b 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 120