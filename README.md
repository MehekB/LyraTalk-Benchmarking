# Instructions

## Dashboard

* move into the 'client' folder
```bash
npm install
npm run dev
```
start the server
* move into 'server' folder 
'''
npm install
npm run dev
'''
server runs on like 127.0.0.01 or smth

## Benchmark run setup

* move into the 'agent' folder

### first time setup: 

1. install the livekitCLI 


macos do: 

```brew install livekit-cli```

windows do: 

```winget install LiveKit.LiveKitCLI```



2. Run these commands 
(u might need to install uv ask gpt if it bugs)

```
pip install uv
uv sync
lk cloud auth
uv run python src/agent.py download-files
```

3. Create a folder under agent/ called ".env.local" and paste in the below

```
LIVEKIT_API_KEY="API7d4ffGAy6xLQ"
LIVEKIT_API_SECRET="xSSa1Ko2nvjYIlOtIikgPFVLH0L0wQOW1JG2St98ovE"
LIVEKIT_URL="wss://lyratalk-5x60wac9.livekit.cloud"
```

--------------------------------------

Running the code pick one of the below:

Talk in the terminal 

```
uv run python src/agent.py console
```
Dev (frontend / telephony)

```
uv run python src/agent.py dev
```

Production

```
uv run python src/agent.py start
``` 
it should create a folder under agent/transcripts that writes down what was said in call
