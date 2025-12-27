# routes/manufacturer/manufacturer_routes.py
from fastapi import Depends, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from models.user import User, UserRoles
from routes.authentication.auth_modules import get_session
from app import app
from routes.order.models import *
from crud.databases import orders, fs
import uuid, io
from bson import ObjectId
from datetime import datetime
from typing import Optional
from routes.order.models import *

# Color to Hex mapping dictionary
COLOR_HEX_MAP: Dict[str, str] = {
    # Basic Colors
    "Red": "#EF4444",
    "Blue": "#3B82F6",
    "Yellow": "#FCD34D",
    "Black": "#1F2937",
    "White": "#F9FAFB",
    "Green": "#10B981",
    "Orange": "#F97316",
    "Purple": "#8B5CF6",
    "Gray": "#6B7280",
    
    # Additional Colors (opsiyonel)
    "Pink": "#EC4899",
    "Cyan": "#06B6D4",
    "Brown": "#78350F",
    "Gold": "#F59E0B",
    "Silver": "#9CA3AF",
    "Transparent": "#E5E7EB",
    "Lime": "#84CC16",
    "Teal": "#14B8A6",
    "Indigo": "#6366F1",
    "Navy": "#1E3A8A",
}
@app.get("/manufacturer/order/{order_id}")
async def get_order_details(
    order_id: str,
    user: User = Depends(get_session)
):
    """Get complete order details for manufacturer processing (NO rejected_manufacturers)"""

    # Verify manufacturer role
    if user.role != "manufacturer":
        raise HTTPException(status_code=403, detail="Only manufacturers can access this endpoint")

    # Find order (explicitly exclude rejected_manufacturers)
    order = orders.find_one({"order_id": order_id}, {"rejected_manufacturers": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Verify manufacturer is assigned to this order
    if order.get("manufacturer_id") != user.id:
        raise HTTPException(status_code=403, detail="You are not assigned to this order")

    # Get customer info
    from crud.databases import users
    customer = users.find_one({"id": order["user_id"]})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Count customer's previous completed orders
    order_history_count = orders.count_documents({
        "user_id": order["user_id"],
        "order_timing_table.ready_to_take": {"$exists": True}
    })

    # Initials
    name_parts = customer.get("name", "Unknown User").split()
    initials = "".join([part[0].upper() for part in name_parts[:2]]) if name_parts else "UU"

    # ---- Parse/normalize order into OrderFormMain (your DB schema) ----
    order_clean = dict(order)
    order_clean.pop("_id", None)
    order_clean.pop("rejected_manufacturers", None)  # extra safety

    # Validate with Pydantic (Union[FDMConfig, SLAConfig] + quantity included)
    try:
        order_form: OrderFormMain = OrderFormMain.model_validate(order_clean)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Order schema validation failed: {str(e)}")

    # Convenience dicts (JSON-safe)
    order_json = order_form.model_dump(mode="json")
    order_detail = order_json.get("order_detail", {})
    timing_table = order_json.get("order_timing_table", {}) or {}

    # Material label
    material_label = f"{order_detail.get('material', 'N/A')} ({order_json.get('order_type', 'N/A')})"

    # ---- Build steps (UI friendly) ----
    step_mapping = [
        ("order_received", "Order Received"),
        ("assigned_to_manufacturer", "Assigned to Manufacturer"),
        ("started_manufacturing", "Started Manufacturing"),
        ("produced", "Produced"),
        ("ready_to_take", "Ready to Take")
    ]

    steps = []
    for idx, (key, label) in enumerate(step_mapping, 1):
        entry = timing_table.get(key)

        if entry and entry.get("timestamp"):
            ts = entry["timestamp"]
            # entry["timestamp"] can be str or datetime-like
            if isinstance(ts, str):
                try:
                    ts_obj = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                except ValueError:
                    try:
                        ts_obj = datetime.strptime(ts, "%Y-%m-%dT%H:%M:%S.%f")
                    except ValueError:
                        ts_obj = None
            else:
                ts_obj = ts

            date_str = ts_obj.strftime("%B %d, %Y, %H:%M") if ts_obj else "-"
            completed = True if ts_obj else False
        else:
            date_str = "-"
            completed = False

        steps.append({
            "id": idx,
            "label": label,
            "date": date_str,
            "completed": completed
        })

    # ---- Order date formatting ----
    order_date = (timing_table.get("order_received") or {}).get("timestamp")
    if isinstance(order_date, str):
        try:
            order_date_obj = datetime.fromisoformat(order_date.replace("Z", "+00:00"))
        except ValueError:
            try:
                order_date_obj = datetime.strptime(order_date, "%Y-%m-%dT%H:%M:%S.%f")
            except ValueError:
                order_date_obj = None
    else:
        order_date_obj = order_date if order_date else None

    formatted_date = order_date_obj.strftime("%b %d, %Y") if order_date_obj else datetime.now().strftime("%b %d, %Y")

    # ---- Finalization (if exists) ----
    finalization = None
    if (
        order_clean.get("manufacturer_notes")
        or order_clean.get("delivery_address")
        or order_clean.get("actual_filament_usage") is not None
        or order_clean.get("final_price") is not None
    ):
        finalization = {
            "notesToCustomer": order_clean.get("manufacturer_notes", ""),
            "deliveryAddress": order_clean.get("delivery_address", ""),
            "filamentUsage": order_clean.get("actual_filament_usage", 0.0),
            "finalPrice": order_clean.get("final_price", 0.0)
        }

    # ---- Response (UI-friendly + FULL OrderFormMain) ----
    response_data = {
        "success": True,

        # ✅ FULL DB shape (OrderFormMain) — includes quantity + order_detail union fields
        # ❌ does NOT include rejected_manufacturers (excluded via projection + pop)
        "order_raw": order_json,

        # ✅ Existing UI-friendly shape (kept + expanded)
        "order": {
            "order_id": order_json["order_id"],
            "order_type": order_json["order_type"],
            "is_cancelled": order_json.get("is_cancelled", False),
            "quantity": order_json.get("quantity", 1),
            "preview_id": order_json.get("preview_id"),
            "manufacturer_id": order_json.get("manufacturer_id", ""),

            "specs": {
                "materialLabel": material_label,
                "brand": order_detail.get("brand", "N/A"),
                "colorName": order_detail.get("color", "N/A"),
                "colorHex": COLOR_HEX_MAP.get(order_detail.get("color")),
                "layerHeight": f"{order_detail.get('layer_height', 0)} mm",
                "infill": f"{order_detail.get('infill', 0)}%",
                # FDM-only extras:
                "buildPlate": order_detail.get("bottom_texture", "N/A") if order_json["order_type"] == "FDM" else "N/A",
                "nozzleSize": f"{order_detail.get('nozzle_size', 0)} mm" if order_json["order_type"] == "FDM" else "N/A",
                # SLA-only extras:
                "resinType": order_detail.get("resin_type", "N/A") if order_json["order_type"] == "SLA" else "N/A",
                "uvCuring": order_detail.get("uv_curing", "N/A") if order_json["order_type"] == "SLA" else "N/A",
            },

            "file": {
                "name": f"order_{order_id}.stl",
                "size": "N/A",
                "fileId": order_json["file_id"],
            },

            "customer": {
                "fullName": (customer.get("first_name", "Unknown User") + " " + customer.get("last_name", "Unknown User")).strip(),
                "initials": initials,
                "userId": f"#{customer['id'][-7:]}",
                "notes": order_json.get("notes", "No notes provided"),
                "orderHistory": f"{order_history_count} Completed",
                # Eğer istersen email’i de ekleyebilirsin:
                # "email": customer.get("email")
            },

            "orderInfo": {
                "date": formatted_date,
                "estimatedWeight": (order_json.get("estimations") or {}).get("estimated_weight", 0),
                "estimatedCost": (order_json.get("estimations") or {}).get("estimated_cost", 0),
            },

            "steps": steps,
        }
    }

    if finalization:
        response_data["order"]["finalization"] = finalization
        response_data["finalization"] = finalization  # istersen üstte de dursun

    return response_data



# ==================== START PRODUCTION ====================
@app.post("/manufacturer/order/{order_id}/start_production")
async def start_production(
    order_id: str,
    user: User = Depends(get_session)
):
    """Mark order as started manufacturing"""
    
    if user.role != UserRoles.manufacturer:
        raise HTTPException(status_code=403, detail="Only manufacturers can start production")
    
    order = orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("manufacturer_id") != user.id:
        raise HTTPException(status_code=403, detail="Not your order")
    
    # Check if already started
    if order.get("order_timing_table", {}).get("started_manufacturing"):
        raise HTTPException(status_code=400, detail="Production already started")
    
    # Update timing table
    timing_entry = OrderTimingEntry(
        user_id=user.id,
        timestamp=datetime.now(),
        status=OrderStatus.STARTED_MANUFACTURING
    )
    
    orders.update_one(
        {"order_id": order_id},
        {"$set": {"order_timing_table.started_manufacturing": timing_entry.model_dump(mode='json')}}
    )
    
    return {"success": True, "message": "Production started successfully"}


# ==================== COMPLETE PRODUCTION ====================
@app.post("/manufacturer/order/{order_id}/complete_production")
async def complete_production(
    order_id: str,
    user: User = Depends(get_session)
):
    """Mark order as produced"""
    
    if user.role != "manufacturer":
        raise HTTPException(status_code=403, detail="Only manufacturers can complete production")
    
    order = orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("manufacturer_id") != user.id:
        raise HTTPException(status_code=403, detail="Not your order")
    
    # Check if production was started
    if not order.get("order_timing_table", {}).get("started_manufacturing"):
        raise HTTPException(status_code=400, detail="Production not started yet")
    
    # Check if already completed
    if order.get("order_timing_table", {}).get("produced"):
        raise HTTPException(status_code=400, detail="Production already completed")
    
    # Update timing table
    timing_entry = OrderTimingEntry(
        user_id=user.id,
        timestamp=datetime.now(),
        status=OrderStatus.PRODUCED
    )
    
    orders.update_one(
        {"order_id": order_id},
        {"$set": {"order_timing_table.produced": timing_entry.model_dump(mode='json')}}
    )
    
    return {"success": True, "message": "Production completed successfully"}


# ==================== UPLOAD PRODUCT IMAGE ====================
@app.post("/manufacturer/order/{order_id}/upload_image")
async def upload_product_image(
    order_id: str,
    image: UploadFile = File(...),
    user: User = Depends(get_session)
):
    """Upload final product image"""
    
    if user.role != "manufacturer":
        raise HTTPException(status_code=403, detail="Only manufacturers can upload images")
    
    order = orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("manufacturer_id") != user.id:
        raise HTTPException(status_code=403, detail="Not your order")
    
    # Validate image
    if not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Generate unique file_id
    file_id = str(uuid.uuid4())
    
    # Read and store in GridFS
    image_data = await image.read()
    file_extension = image.filename.split('.')[-1] if '.' in image.filename else 'jpg'
    
    gridfs_id = fs.put(
        image_data,
        filename=f"product_{order_id}_{file_id}.{file_extension}",
        content_type=image.content_type,
        metadata={
            "file_id": file_id,
            "order_id": order_id,
            "uploaded_by": user.id,
            "uploaded_at": datetime.utcnow()
        }
    )
    
    # Update order with file_id
    orders.update_one(
        {"order_id": order_id},
        {
            "$set": {
                "product_file_id": file_id,
                "product_image_uploaded_at": datetime.utcnow()
            }
        }
    )
    
    return {
        "success": True, 
        "file_id": file_id,
        "gridfs_id": str(gridfs_id)
    }

@app.get("/manufacturer/product_image/{order_id}")
async def download_product_image(
    order_id: str,
    user: User = Depends(get_session)
):
    """Download product image as attachment"""
    
    order = orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    is_manufacturer = order.get("manufacturer_id") == user.id
    is_customer = order.get("user_id") == user.id
    
    if not (is_manufacturer or is_customer):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    file_id = order.get("product_file_id")
    if not file_id:
        raise HTTPException(status_code=404, detail="Product image not found")
    
    grid_out = fs.find_one({"metadata.file_id": file_id})
    if not grid_out:
        raise HTTPException(status_code=404, detail="File not found")
    
    # attachment yerine inline kullanırsak tarayıcıda açılır
    return StreamingResponse(
        io.BytesIO(grid_out.read()),
        media_type=grid_out.content_type,
        headers={
            "Content-Disposition": f"attachment; filename={grid_out.filename}"
        }
    )


# ==================== FINALIZE ORDER ====================
class FinalizeOrderRequest(BaseModel):
    notes_to_customer: str
    delivery_address: str
    filament_usage: float
    final_price: float

@app.post("/manufacturer/order/{order_id}/finalize")
async def finalize_order(
    order_id: str,
    data: FinalizeOrderRequest,
    user: User = Depends(get_session)
):
    """Finalize order with notes, address, and pricing"""
    
    if user.role != "manufacturer":
        raise HTTPException(status_code=403, detail="Only manufacturers can finalize orders")
    
    order = orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("manufacturer_id") != user.id:
        raise HTTPException(status_code=403, detail="Not your order")
    
    # Check if production is completed
    if not order.get("order_timing_table", {}).get("produced"):
        raise HTTPException(status_code=400, detail="Production must be completed first")
    
    # Update order with finalization data
    timing_entry = OrderTimingEntry(
        user_id=user.id,
        timestamp=datetime.now(),
        status=OrderStatus.READY_TO_TAKE
    )
    
    orders.update_one(
        {"order_id": order_id},
        {"$set": {
            "manufacturer_notes": data.notes_to_customer,
            "delivery_address": data.delivery_address,
            "actual_filament_usage": data.filament_usage,
            "final_price": data.final_price,
            "order_timing_table.ready_to_take": timing_entry.model_dump(mode='json')
        }}
    )
    
    return {"success": True, "message": "Order finalized successfully"}


# ==================== DOWNLOAD FILE ====================
@app.get("/manufacturer/order/{order_id}/download_file")
def download_order_file(
    order_id: str,
    user: User = Depends(get_session)
):
    """Download the STL file for the order"""
    from fastapi.responses import StreamingResponse
    
    if user.role != UserRoles.manufacturer:
        raise HTTPException(status_code=403, detail="Only manufacturers can download files")
    
    order = orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("manufacturer_id") != user.id:
        raise HTTPException(status_code=403, detail="Not your order")
    
    # Get file from GridFS
    try:
        file_id = ObjectId(order["file_id"])
        grid_out = fs.get(file_id)
        
        return StreamingResponse(
            io.BytesIO(grid_out.read()),
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename=order_{order_id}.stl"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error downloading file: {str(e)}")
