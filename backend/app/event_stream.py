import asyncio
import json
import logging
from typing import Dict, Set, AsyncGenerator
from fastapi import APIRouter
from starlette.responses import StreamingResponse

logger = logging.getLogger("event_stream")


class EventBroadcaster:
    def __init__(self):
        self._channels: Dict[str, Set[asyncio.Queue]] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, channel: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        async with self._lock:
            if channel not in self._channels:
                self._channels[channel] = set()
            self._channels[channel].add(queue)
        return queue

    async def unsubscribe(self, channel: str, queue: asyncio.Queue):
        async with self._lock:
            if channel in self._channels and queue in self._channels[channel]:
                self._channels[channel].remove(queue)
                if not self._channels[channel]:
                    del self._channels[channel]

    async def publish(self, channel: str, event: str, data: dict):
        payload = f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"
        queues = []
        async with self._lock:
            if channel in self._channels:
                queues = list(self._channels[channel])
        for q in queues:
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                logger.warning(f"Queue full for subscriber on channel {channel}")

    def publish_sync(self, channel: str, event: str, data: dict):
        payload = f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"
        if channel in self._channels:
            for q in list(self._channels[channel]):
                try:
                    q.put_nowait(payload)
                except Exception:
                    pass


broadcast_manager = EventBroadcaster()


async def event_generator(channel: str) -> AsyncGenerator[str, None]:
    queue = await broadcast_manager.subscribe(channel)
    try:
        yield f"event: connected\ndata: {{\"channel\": \"{channel}\", \"status\": \"online\"}}\n\n"
        while True:
            try:
                msg = await asyncio.wait_for(queue.get(), timeout=15.0)
                yield msg
            except asyncio.TimeoutError:
                # Keepalive heartbeat
                yield ": keepalive\n\n"
    except asyncio.CancelledError:
        pass
    finally:
        await broadcast_manager.unsubscribe(channel, queue)


router = APIRouter(prefix="/events", tags=["events"])


@router.get("/stream/stores/{store_id}")
async def stream_store_events(store_id: str):
    channel = f"store:{store_id}"
    return StreamingResponse(
        event_generator(channel),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.get("/stream/orders/{order_id}")
async def stream_order_events(order_id: str):
    channel = f"order:{order_id}"
    return StreamingResponse(
        event_generator(channel),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.get("/stream/users/{user_id}")
async def stream_user_events(user_id: str):
    channel = f"user:{user_id}"
    return StreamingResponse(
        event_generator(channel),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )
