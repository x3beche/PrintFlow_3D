from fastapi import HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import AsyncGenerator, List
import json
import asyncio
import queue
import threading
import logging
from models.user import User
from routes.authentication.auth_modules import get_session
from app import app
from datetime import datetime
from crud.databases import orders
from bson import ObjectId
from routes.order.models import (
    OrderFormMain, 
    OrderEstimations, 
    OrderType, 
    PrintingConfig,
    FDMConfig,
    SLAConfig,
    OrderTimingTable,
    OrderTimingEntry,
    OrderStatus,
    FDMMaterial,
    SLAMaterial,
    Brand,
    BottomTexture
)


@app.get("/order/list", response_model=List[OrderFormMain])
async def list_orders(
    user: User = Depends(get_session)
):
    """List all orders for current user"""
    
    try:
        # Fetch all orders for the current user
        user_orders = list(orders.find({"user_id": str(user.id)}))
        
        if not user_orders:
            return []
        
        # Format orders as OrderFormMain pydantic objects
        formatted_orders = []
        for order in user_orders:
            try:
                # Parse OrderEstimations
                estimations = OrderEstimations(
                    estimated_weight=order.get("estimations", {}).get("estimated_weight", 0.0),
                    estimated_cost=order.get("estimations", {}).get("estimated_cost", 0.0)
                )
                
                # Parse OrderTimingTable
                timing_table_data = order.get("order_timing_table", {})
                
                def parse_timing_entry(entry_data):
                    if not entry_data:
                        return None
                    return OrderTimingEntry(
                        user_id=entry_data.get("user_id", ""),
                        timestamp=entry_data.get("timestamp", datetime.utcnow()),
                        status=OrderStatus(entry_data.get("status", "Order Received"))
                    )
                
                timing_table = OrderTimingTable(
                    order_received=parse_timing_entry(timing_table_data.get("order_received")),
                    assigned_to_manufacturer=parse_timing_entry(timing_table_data.get("assigned_to_manufacturer")),
                    started_manufacturing=parse_timing_entry(timing_table_data.get("started_manufacturing")),
                    produced=parse_timing_entry(timing_table_data.get("produced")),
                    ready_to_take=parse_timing_entry(timing_table_data.get("ready_to_take"))
                )
                
                # Parse PrintingConfig (FDMConfig or SLAConfig)
                order_detail_data = order.get("order_detail", {})
                order_type = OrderType(order.get("order_type", "FDM"))
                
                if order_type == OrderType.FDM:
                    order_detail = FDMConfig(
                        material=FDMMaterial(order_detail_data.get("material", "PLA")),
                        brand=Brand(order_detail_data.get("brand", "Creality")),
                        color=order_detail_data.get("color", ""),
                        layer_height=order_detail_data.get("layer_height", 0.2),
                        infill=order_detail_data.get("infill", 20),
                        bottom_texture=BottomTexture(order_detail_data.get("bottom_texture", "Smooth")),
                        nozzle_size=order_detail_data.get("nozzle_size", 0.4)
                    )
                else:  # SLA
                    order_detail = SLAConfig(
                        material=SLAMaterial(order_detail_data.get("material", "Standard Resin")),
                        brand=Brand(order_detail_data.get("brand", "Formlabs")),
                        color=order_detail_data.get("color", ""),
                        layer_height=order_detail_data.get("layer_height", 0.05),
                        infill=order_detail_data.get("infill", 100),
                        resin_type=order_detail_data.get("resin_type", "Standard"),
                        uv_curing=order_detail_data.get("uv_curing", "Standard")
                    )
                
                # Create OrderFormMain object
                order_form = OrderFormMain(
                    order_id=order["order_id"],
                    user_id=order["user_id"],
                    estimations=estimations,
                    file_id=order.get("file_id", ""),
                    notes=order.get("notes", ""),
                    order_type=order_type,
                    order_detail=order_detail,
                    order_timing_table=timing_table,
                    preview_id=order.get("preview_id", "default_preview")
                )
                
                formatted_orders.append(order_form)
                
            except Exception as e:
                logging.error(f"Error parsing order {order.get('order_id', 'unknown')}: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        # Sort by creation date (newest first)
        formatted_orders.sort(
            key=lambda x: x.order_timing_table.order_received.timestamp if x.order_timing_table.order_received else datetime.min,
            reverse=True
        )
        
        return formatted_orders
        
    except Exception as e:
        logging.error(f"Error fetching orders: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch orders: {str(e)}")