from fastapi import HTTPException, Depends
from typing import List
import logging
from routes.authentication.auth_modules import get_session
from app import app
from datetime import datetime
from pydantic import BaseModel
from models.user import User, UserRoles
from crud.databases import orders, users
from routes.order.models import *

from pydantic import BaseModel
from datetime import datetime

class OrderSummary(BaseModel):
    order_id: str
    order_id_short: str
    preview_id: str

    order_received_date: datetime | None
    customer_name: str
    is_cancelled: bool

    order_type: str | None = None
    quantity: int | None = None

    material: str | None = None
    brand: str | None = None
    color: str | None = None
    layer_height: float | None = None
    infill: int | None = None

    # FDM extras
    nozzle_size: float | None = None
    bottom_texture: str | None = None

    # SLA extras
    resin_type: str | None = None
    uv_curing: str | None = None


class UnassignedOrdersResponse(BaseModel):
    success: bool
    count: int
    orders: List[OrderSummary]
    timestamp: datetime

class RejectOrderResponse(BaseModel):
    success: bool
    message: str
    order_id: str
    timestamp: datetime

def extract_order_detail_fields(order_doc: dict) -> dict:
    detail = order_doc.get("order_detail") or {}
    # DB’de enumlar string olarak duruyorsa direkt string gelir.
    # Eğer nested dict beklenmedikse, yine de .get ile güvenli.
    return {
        "order_type": order_doc.get("order_type"),
        "quantity": order_doc.get("quantity"),

        "material": detail.get("material"),
        "brand": detail.get("brand"),
        "color": detail.get("color"),
        "layer_height": detail.get("layer_height"),
        "infill": detail.get("infill"),

        # FDM
        "nozzle_size": detail.get("nozzle_size"),
        "bottom_texture": detail.get("bottom_texture"),

        # SLA
        "resin_type": detail.get("resin_type"),
        "uv_curing": detail.get("uv_curing"),
    }


@app.get("/manufacturer/unassigned_orders/", tags=["manufacturer"], response_model=UnassignedOrdersResponse)
def get_unassigned_orders(user: User = Depends(get_session)):
    """
    Get all orders that don't have a manufacturer assigned yet.
    Only accessible by users with manufacturer role.
    Orders are sorted by order_received timestamp (newest to oldest).
    Excludes cancelled orders and orders rejected by current manufacturer.
    """
    
    # Check if user has manufacturer role
    if user.role != UserRoles.manufacturer:
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions. Only manufacturers can access this endpoint."
        )
    
    try:
        # Find orders where manufacturer_id is empty or doesn't exist
        # AND current user is NOT in rejected_manufacturers array
        unassigned_orders_raw = list(orders.find({
            "$and": [
                {
                    "$or": [
                        {"manufacturer_id": ""},
                        {"manufacturer_id": {"$exists": False}},
                        {"manufacturer_id": None}
                    ]
                },
                {"is_cancelled": {"$ne": True}},  # Exclude cancelled orders
                {
                    "$or": [
                        {"rejected_manufacturers": {"$nin": [user.id]}},  # ✅ User NOT in array
                    ]
                }
            ]
        }).sort("order_timing_table.order_received.timestamp", -1))
        
        # Convert to summary format
        order_summaries = []
        for order_data in unassigned_orders_raw:
            try:
                # Get user information
                user_id = order_data.get("user_id", "")
                customer_name = "Unknown"
                
                if user_id:
                    user_doc = users.find_one({"id": user_id})
                    if user_doc and "first_name" in user_doc:
                        customer_name = f"{user_doc.get('first_name')} {user_doc.get('last_name')}"
                
                # Extract order received timestamp
                order_received_date = None
                if "order_timing_table" in order_data and order_data["order_timing_table"]:
                    order_received = order_data["order_timing_table"].get("order_received")
                    if order_received and "timestamp" in order_received:
                        timestamp_str = order_received["timestamp"]
                        # Parse timestamp if it's a string
                        if isinstance(timestamp_str, str):
                            order_received_date = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                        else:
                            order_received_date = timestamp_str
                
                # Create summary
                order_id = order_data.get("order_id", "")
                extra = extract_order_detail_fields(order_data)

                summary = OrderSummary(
                    order_id=order_id,
                    order_id_short=order_id[:8] if order_id else "",
                    preview_id=order_data.get("preview_id", ""),
                    order_received_date=order_received_date,
                    customer_name=customer_name,
                    is_cancelled=order_data.get("is_cancelled", False),
                    **extra
                )
                order_summaries.append(summary)

                
            except Exception as e:
                logging.warning(f"Failed to parse order {order_data.get('order_id', 'unknown')}: {str(e)}")
                continue
        
        return UnassignedOrdersResponse(
            success=True,
            count=len(order_summaries),
            orders=order_summaries,
            timestamp=datetime.now()
        )
        
    except Exception as e:
        logging.error(f"Error fetching unassigned orders: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch unassigned orders: {str(e)}"
        )

@app.post("/manufacturer/reject_order/{order_id}", tags=["manufacturer"], response_model=RejectOrderResponse)
def reject_order(order_id: str, user: User = Depends(get_session)):
    """
    Reject an order by adding current manufacturer to rejected_manufacturers list.
    Only accessible by users with manufacturer role.
    """
    
    # Check if user has manufacturer role
    if user.role != UserRoles.manufacturer:
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions. Only manufacturers can access this endpoint."
        )
    
    try:
        # Find the order
        order = orders.find_one({"order_id": order_id})
        
        if not order:
            raise HTTPException(
                status_code=404,
                detail=f"Order {order_id} not found"
            )
        
        # Check if order already has a manufacturer
        if order.get("manufacturer_id") and order.get("manufacturer_id") != "":
            raise HTTPException(
                status_code=400,
                detail="Cannot reject an order that already has a manufacturer assigned"
            )
        
        # Check if order is cancelled
        if order.get("is_cancelled"):
            raise HTTPException(
                status_code=400,
                detail="Cannot reject a cancelled order"
            )
        
        # Get current rejected_manufacturers list or create new one
        rejected_manufacturers = order.get("rejected_manufacturers", [])
        
        # Check if user already rejected this order
        if user.id in rejected_manufacturers:
            raise HTTPException(
                status_code=400,
                detail="You have already rejected this order"
            )
        
        # Add current user to rejected_manufacturers
        rejected_manufacturers.append(user.id)
        
        # Update order
        result = orders.update_one(
            {"order_id": order_id},
            {"$set": {"rejected_manufacturers": rejected_manufacturers}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(
                status_code=500,
                detail="Failed to reject order"
            )
        
        logging.info(f"Order {order_id} rejected by manufacturer {user.id}")
        
        return RejectOrderResponse(
            success=True,
            message=f"Order {order_id[:8]} has been rejected successfully",
            order_id=order_id,
            timestamp=datetime.now()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error rejecting order {order_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reject order: {str(e)}"
        )   
    


# Response Model
class AssignOrderResponse(BaseModel):
    success: bool
    message: str
    order_id: str
    manufacturer_id: str
    timestamp: datetime


@app.post("/manufacturer/assign_order/{order_id}", tags=["manufacturer"], response_model=AssignOrderResponse)
def assign_order(order_id: str, user: User = Depends(get_session)):
    """
    Assign (adopt) an order to the current manufacturer.
    Sets the manufacturer_id field to current user's ID.
    Only works if order is not already assigned to another manufacturer.
    """
    
    # Check if user has manufacturer role
    if user.role != UserRoles.manufacturer:
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions. Only manufacturers can assign orders."
        )
    
    try:
        # Check if order exists
        order = orders.find_one({"order_id": order_id})
        
        if not order:
            raise HTTPException(
                status_code=404,
                detail=f"Order {order_id} not found"
            )
        
        # Check if order is cancelled
        if order.get("is_cancelled", False):
            raise HTTPException(
                status_code=400,
                detail="Cannot assign a cancelled order"
            )
        
        # Check if order is already assigned to another manufacturer
        existing_manufacturer_id = order.get("manufacturer_id")
        if existing_manufacturer_id and existing_manufacturer_id != "":
            # If already assigned to same manufacturer
            if existing_manufacturer_id == user.id:
                raise HTTPException(
                    status_code=400,
                    detail="You have already adopted this order"
                )
            # If assigned to different manufacturer
            raise HTTPException(
                status_code=409,
                detail="This order has already been assigned to another manufacturer"
            )
        
        # Assign the order to current manufacturer and update timeline
        result = orders.update_one(
            {"order_id": order_id},
            {
                "$set": {
                    "manufacturer_id": user.id,
                    "last_updated": datetime.now().isoformat(),
                    "order_timing_table.assigned_to_manufacturer": {
                        "user_id": user.id,
                        "timestamp": datetime.now().isoformat(),
                        "status": "Assigned to Manufacturer"
                    }
                }
            }
        )

        if result.modified_count == 0:
            raise HTTPException(
                status_code=500,
                detail="Failed to assign order"
            )
        
        logging.info(f"✅ Order {order_id} assigned to manufacturer {user.id}")
        
        return AssignOrderResponse(
            success=True,
            message="Order assigned successfully",
            order_id=order_id,
            manufacturer_id=user.id, # type: ignore
            timestamp=datetime.now()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"❌ Error assigning order {order_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to assign order: {str(e)}"
        )


# Response Models
class OrderDetailsResponse(BaseModel):
    success: bool
    order: dict
    customer_info: dict
    timestamp: datetime


@app.get("/manufacturer/order_details/{order_id}", tags=["manufacturer"], response_model=OrderDetailsResponse)
def get_order_details(order_id: str, user: User = Depends(get_session)):
    """
    Get complete details of a specific order.
    Accessible by manufacturers and the order owner.
    """
    
    # Check if user has manufacturer role or is the order owner
    if user.role not in [UserRoles.manufacturer, UserRoles.user]:
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions."
        )
    
    try:
        # Find the order
        order = orders.find_one({"order_id": order_id})
        
        if not order:
            raise HTTPException(
                status_code=404,
                detail=f"Order {order_id} not found"
            )
        
        # If user is a regular user, they can only see their own orders
        if user.role == UserRoles.user and order.get("user_id") != user.id:
            raise HTTPException(
                status_code=403,
                detail="You can only view your own orders"
            )
        
        # Get customer information
        customer_id = order.get("user_id", "")
        customer_info = {
            "customer_id": customer_id,
            "customer_name": "Unknown",
            "customer_email": ""
        }
        
        if customer_id:
            customer = users.find_one({"id": customer_id})
            if customer:
                customer_info["customer_name"] = f"{customer.get('first_name', '')} {customer.get('last_name', '')}".strip()
                customer_info["customer_email"] = customer.get("email", "")
        
        # Get manufacturer information if assigned
        manufacturer_info = None
        manufacturer_id = order.get("manufacturer_id", "")
        if manufacturer_id and manufacturer_id != "":
            manufacturer = users.find_one({"id": manufacturer_id})
            if manufacturer:
                manufacturer_info = {
                    "manufacturer_id": manufacturer_id,
                    "manufacturer_name": f"{manufacturer.get('first_name', '')} {manufacturer.get('last_name', '')}".strip(),
                    "manufacturer_email": manufacturer.get("email", "")
                }
        
        # Clean up MongoDB _id field
        if "_id" in order:
            order["_id"] = str(order["_id"])
        
        # Add manufacturer info to response
        order["manufacturer_info"] = manufacturer_info
        
        logging.info(f"✅ Order details retrieved for {order_id} by user {user.id}")
        
        return OrderDetailsResponse(
            success=True,
            order=order,
            customer_info=customer_info,
            timestamp=datetime.now()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"❌ Error fetching order details {order_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch order details: {str(e)}"
        )




class AdoptedOrderSummary(BaseModel):
    order_id: str
    order_id_short: str
    preview_id: str
    assigned_date: str | None
    customer_name: str
    is_cancelled: bool
    current_status: str

    # ✅ yeni alanlar
    order_type: str | None = None
    quantity: int | None = None

    material: str | None = None
    brand: str | None = None
    color: str | None = None
    layer_height: float | None = None
    infill: int | None = None

    nozzle_size: float | None = None
    bottom_texture: str | None = None

    resin_type: str | None = None
    uv_curing: str | None = None



class AdoptedOrdersResponse(BaseModel):
    success: bool
    count: int
    orders: list[AdoptedOrderSummary]
    timestamp: datetime


@app.get("/manufacturer/adopted_orders/", tags=["manufacturer"], response_model=AdoptedOrdersResponse)
def get_adopted_orders(user: User = Depends(get_session)):
    """
    Get all orders that have been adopted (assigned) to the current manufacturer.
    """
    
    # Check if user has manufacturer role
    if user.role != UserRoles.manufacturer:
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions. Only manufacturers can view adopted orders."
        )
    
    try:
        # Find all orders assigned to this manufacturer that are not cancelled
        assigned_orders = list(orders.find({
            "manufacturer_id": user.id,
            "is_cancelled": False
        }))
        
        order_summaries = []
        
        for order in assigned_orders:
            # Get customer info
            customer_id = order.get("user_id", "")
            customer_name = "Unknown"
            
            if customer_id:
                customer = users.find_one({"id": customer_id})
                if customer:
                    customer_name = f"{customer.get('first_name', '')} {customer.get('last_name', '')}".strip()
            
            # Get assigned date from timing table
            timing_table = order.get("order_timing_table", {})
            assigned_entry = timing_table.get("assigned_to_manufacturer")
            assigned_date = assigned_entry.get("timestamp") if assigned_entry else None
            
            # Determine current status (last non-null timing entry)
            current_status = "Assigned to Manufacturer"
            if timing_table.get("ready_to_take"):
                current_status = "Ready to Take"
            elif timing_table.get("produced"):
                current_status = "Produced"
            elif timing_table.get("started_manufacturing"):
                current_status = "Started Manufacturing"
            
            # Create short order ID (first 8 chars)
            order_id_full = order.get("order_id", "")
            order_id_short = order_id_full[:8].upper() if order_id_full else "UNKNOWN"
            
            extra = extract_order_detail_fields(order)

            order_summaries.append(AdoptedOrderSummary(
                order_id=order_id_full,
                order_id_short=order_id_short,
                preview_id=order.get("preview_id", "default_preview"),
                assigned_date=assigned_date,
                customer_name=customer_name,
                is_cancelled=order.get("is_cancelled", False),
                current_status=current_status,

                # ✅ yeni alanlar
                **extra
            ))

        
        # Sort by assigned date (most recent first)
        order_summaries.sort(
            key=lambda x: x.assigned_date if x.assigned_date else "",
            reverse=True
        )
        
        logging.info(f"✅ Retrieved {len(order_summaries)} adopted orders for manufacturer {user.id}")
        
        return AdoptedOrdersResponse(
            success=True,
            count=len(order_summaries),
            orders=order_summaries,
            timestamp=datetime.now()
        )
        
    except Exception as e:
        logging.error(f"❌ Error fetching adopted orders for manufacturer {user.id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch adopted orders: {str(e)}"
        )
