from fastapi import HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import AsyncGenerator
import json
import asyncio
import queue
import threading
import logging
from modules.gateway import MongoSocket
from models.user import User
from routes.authentication.auth_modules import get_session
from app import app
from datetime import datetime

logger = logging.getLogger(__name__)

@app.get("/stream/{channel}")
async def stream_channel_messages(
    channel: str,
    current_user: User = Depends(get_session)
):
    logger.info(f"Stream request for channel '{channel}' by user: {current_user.email}")
    
    async def event_generator() -> AsyncGenerator[str, None]:
        # Thread-safe queue for events
        event_queue = queue.Queue()
        
        # Create new MongoSocket instance for this connection
        socket = MongoSocket()
        
        try:
            # Ensure channel exists
            socket.ensure_channel(channel)
            
            # Send connection success
            yield f"data: {json.dumps({'event': 'connected', 'channel': channel, 'user': current_user.email, 'timestamp': datetime.utcnow().isoformat()})}\n\n"
            await asyncio.sleep(0)
            
        except Exception as e:
            logger.error(f"Channel ensure error: {e}")
            yield f"data: {json.dumps({'event': 'error', 'message': str(e)})}\n\n"
            socket.close()
            return
        
        # Callback for new messages
        def on_message(data):
            try:
                message = data.get("message", {})
                event_data = {
                    "event": "message",
                    "channel": channel,
                    "data": {
                        "message": {
                            "_id": str(message.get("_id")),
                            "sender": message.get("sender"),
                            "content": message.get("content"),
                            "ts": message.get("ts").isoformat() if message.get("ts") else None,
                            "metadata": message.get("metadata", {}),
                            "edited": message.get("edited", False)
                        }
                    }
                }
                event_queue.put(event_data)
            except Exception as e:
                logger.error(f"on_message callback error: {e}")
        
        # Callback for edited messages
        def on_edit(data):
            try:
                message = data.get("message", {})
                event_data = {
                    "event": "edit",
                    "channel": channel,
                    "data": {
                        "message": {
                            "_id": str(message.get("_id")),
                            "content": message.get("content"),
                            "edited": message.get("edited"),
                            "editedAt": message.get("editedAt").isoformat() if message.get("editedAt") else None
                        }
                    }
                }
                event_queue.put(event_data)
            except Exception as e:
                logger.error(f"on_edit callback error: {e}")
        
        # Callback for deleted messages
        def on_delete(data):
            try:
                event_data = {
                    "event": "delete",
                    "channel": channel,
                    "data": {
                        "messageId": data.get("messageId")
                    }
                }
                event_queue.put(event_data)
            except Exception as e:
                logger.error(f"on_delete callback error: {e}")
        
        # Callback for errors
        def on_error(data):
            try:
                event_data = {
                    "event": "error",
                    "channel": channel,
                    "message": data.get("error", "Unknown error")
                }
                event_queue.put(event_data)
            except Exception as e:
                logger.error(f"on_error callback error: {e}")
        
        # Register callbacks
        socket.on("message", on_message)
        socket.on("edit", on_edit)
        socket.on("delete", on_delete)
        socket.on("error", on_error)
        
        # Start listening in background thread
        def listen_worker():
            try:
                logger.info(f"Starting MongoSocket listener for channel: {channel}")
                socket.listen(channel, blocking=True)
            except Exception as e:
                logger.error(f"Listen worker error: {e}")
                event_queue.put({
                    "event": "error",
                    "message": str(e)
                })
        
        listener_thread = threading.Thread(target=listen_worker, daemon=True)
        listener_thread.start()
        
        try:
            keepalive_counter = 0
            
            while True:
                # Get event from queue (with 15 second timeout for keepalive)
                try:
                    event_data = event_queue.get(timeout=15)
                    yield f"data: {json.dumps(event_data)}\n\n"
                    await asyncio.sleep(0)
                    
                except queue.Empty:
                    # Send keepalive ping
                    keepalive_counter += 1
                    yield f"data: {json.dumps({'event': 'ping', 'count': keepalive_counter, 'channel': channel, 'timestamp': datetime.utcnow().isoformat()})}\n\n"
                    await asyncio.sleep(0)
                    
        except asyncio.CancelledError:
            logger.info(f"Stream cancelled for channel: {channel} by user: {current_user.email}")
            
        except Exception as e:
            logger.error(f"Stream error: {e}")
            yield f"data: {json.dumps({'event': 'error', 'message': str(e)})}\n\n"
            
        finally:
            # Cleanup
            socket.stop_listening()
            socket.close()
            logger.info(f"Stream closed for channel: {channel}")
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        }
    )