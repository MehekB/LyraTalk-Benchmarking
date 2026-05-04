import logging
import os
import re
import threading
import time
from pathlib import Path

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    ConversationItemAddedEvent,
    JobContext,
    JobProcess,
    cli,
    inference,
    room_io,
)
from livekit.agents.llm import ChatMessage
from livekit.plugins import ai_coustics, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

logger = logging.getLogger("agent")

load_dotenv(".env.local")

AGENT_MODEL = "openai/gpt-5.2-chat-latest"


class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="""You are a helpful voice AI assistant. The user is interacting with you via voice, even if you perceive the conversation as text.
            You eagerly assist users with their questions by providing information from your extensive knowledge.
            Your responses are concise, to the point, and without any complex formatting or punctuation including emojis, asterisks, or other symbols.
            You are curious, friendly, and have a sense of humor.""",
        )

    # To add tools, use the @function_tool decorator.
    # Here's an example that adds a simple weather tool.
    # You also have to add `from livekit.agents import function_tool, RunContext` to the top of this file
    # @function_tool
    # async def lookup_weather(self, context: RunContext, location: str):
    #     """Use this tool to look up current weather information in the given location.
    #
    #     If the location is not supported by the weather service, the tool will indicate this. You must tell the user the location's weather is unavailable.
    #
    #     Args:
    #         location: The location to look up weather information for (e.g. city name)
    #     """
    #
    #     logger.info(f"Looking up weather for {location}")
    #
    #     return "sunny with a temperature of 70 degrees."


server = AgentServer()


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


def _safe_filename_part(value: str, max_len: int = 96) -> str:
    cleaned = re.sub(r"[^\w.\-]+", "_", value.strip() or "x", flags=re.ASCII)
    return (cleaned[:max_len] if cleaned else "x").strip("_") or "x"


def _transcript_file_path(ctx: JobContext) -> Path:
    base_dir = os.environ.get("TRANSCRIPT_DIR", "transcripts").strip()
    root = Path(base_dir).expanduser()
    root.mkdir(parents=True, exist_ok=True)
    room_part = _safe_filename_part(ctx.room.name or "room")
    job_part = _safe_filename_part(str(ctx.job.id))
    ts = time.strftime("%Y%m%d_%H%M%S", time.gmtime())
    return root / f"{room_part}_{job_part}_{ts}.txt"


def _attach_transcript_file(session: AgentSession, ctx: JobContext, path: Path) -> None:
    lock = threading.Lock()
    with path.open("w", encoding="utf-8") as f:
        f.write(
            "# Session transcript\n"
            f"# room={ctx.room.name!r}\n"
            f"# job_id={ctx.job.id!r}\n"
            f"# started_utc={time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime())}\n\n"
        )

    def on_conversation_item(ev: ConversationItemAddedEvent) -> None:
        item = ev.item
        if not isinstance(item, ChatMessage):
            return
        if item.role not in ("user", "assistant"):
            return
        text = (item.text_content or "").strip()
        if not text:
            return
        if item.role == "user":
            block = f"You:\n{text}\n\n"
        else:
            suffix = " (interrupted)" if item.interrupted else ""
            block = f"Assistant:{suffix}\n{text}\n\n"
        with lock:
            with path.open("a", encoding="utf-8") as out:
                out.write(block)

    session.on("conversation_item_added", on_conversation_item)
    logger.info("Writing transcript to %s", path.resolve())


@server.rtc_session(agent_name="lyratalk")
async def my_agent(ctx: JobContext):
    # Logging setup
    # Add any other context you want in all log entries here
    ctx.log_context_fields = {
        "room": ctx.room.name,
    }

    # Set up a voice AI pipeline using OpenAI, Cartesia, Deepgram, and the LiveKit turn detector
    session = AgentSession(
        # Speech-to-text (STT) is your agent's ears, turning the user's speech into text that the LLM can understand
        # See all available models at https://docs.livekit.io/agents/models/stt/
        stt=inference.STT(model="deepgram/nova-3", language="multi"),
        # A Large Language Model (LLM) is your agent's brain, processing user input and generating a response
        # See all available models at https://docs.livekit.io/agents/models/llm/
        llm=inference.LLM(model=AGENT_MODEL),
        # Text-to-speech (TTS) is your agent's voice, turning the LLM's text into speech that the user can hear
        # See all available models as well as voice selections at https://docs.livekit.io/agents/models/tts/
        tts=inference.TTS(
            model="cartesia/sonic-3", voice="9626c31c-bec5-4cca-baa8-f8ba9e84c8bc"
        ),
        # VAD and turn detection are used to determine when the user is speaking and when the agent should respond
        # See more at https://docs.livekit.io/agents/build/turns
        turn_detection=MultilingualModel(),
        vad=ctx.proc.userdata["vad"],
        # allow the LLM to generate a response while waiting for the end of turn
        # See more at https://docs.livekit.io/agents/build/audio/#preemptive-generation
        preemptive_generation=True,
    )

    if os.environ.get("TRANSCRIPT_DISABLE", "").strip().lower() not in (
        "1",
        "true",
        "yes",
    ):
        transcript_path = _transcript_file_path(ctx)
        _attach_transcript_file(session, ctx, transcript_path)

    # To use a realtime model instead of a voice pipeline, use the following session setup instead.
    # (Note: This is for the OpenAI Realtime API. For other providers, see https://docs.livekit.io/agents/models/realtime/))
    # 1. Install livekit-agents[openai]
    # 2. Set OPENAI_API_KEY in .env.local
    # 3. Add `from livekit.plugins import openai` to the top of this file
    # 4. Use the following session setup instead of the version above
    # session = AgentSession(
    #     llm=openai.realtime.RealtimeModel(voice="marin")
    # )

    # # Add a virtual avatar to the session, if desired
    # # For other providers, see https://docs.livekit.io/agents/models/avatar/
    # avatar = hedra.AvatarSession(
    #   avatar_id="...",  # See https://docs.livekit.io/agents/models/avatar/plugins/hedra
    # )
    # # Start the avatar and wait for it to join
    # await avatar.start(session, room=ctx.room)

    # Start the session, which initializes the voice pipeline and warms up the models
    await session.start(
        agent=Assistant(),
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=ai_coustics.audio_enhancement(
                    model=ai_coustics.EnhancerModel.QUAIL_VF_L
                ),
            ),
        ),
    )

    # Join the room and connect to the user
    await ctx.connect()


if __name__ == "__main__":
    cli.run_app(server)
