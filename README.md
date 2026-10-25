# ZERO TRACE
Real-time cybersecurity puzzle game. Fictional, locally simulated systems only. It never touches real networks.

Stack: React + Vite, Node + Express, WebSocket (ws), PostgreSQL, JWT, bcrypt, Docker, Nginx.

## Run with Docker
    docker compose up --build        # open http://localhost:8080
    JWT_SECRET=<long random string> docker compose up --build   # for any public deployment

## Run in VS Code (dev)
    # terminal 1: database
    docker run --rm -p 5432:5432 -e POSTGRES_USER=zt -e POSTGRES_PASSWORD=zt -e POSTGRES_DB=zerotrace postgres:16-alpine
    # terminal 2
    cd server && npm install && npm run dev
    # terminal 3
    cd client && npm install && npm run dev      # http://localhost:5173

## Architecture
Browser <-> Nginx (/api, /ws) <-> Node server <-> PostgreSQL.
The server is authoritative: timer, trace, puzzles, answers and scoring all live server-side. The client only sends commands and renders output.

## Commands
help, missions, start <id>, scan, connect <node>, answer <text>, abort

## Scoring
score = max(100, 1000 + secondsLeft*5 - trace*8). Leaderboard = sum of each user's best score per mission, pushed live to every connected player.

## Known limits
No rate limiting, email verification or password reset. Sessions are one mission at a time. Add helmet, rate limits and HTTPS before a public launch.
