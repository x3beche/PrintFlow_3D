from fastapi import Depends
from models.user import User
from routes.authentication.auth_modules import get_session
from app import app
from stl import mesh
from routes.order.models import *  
from crud.databases import orders
import uuid 

def volume_finder():
    your_mesh = mesh.Mesh.from_file('5frame.stl')
    volume, cog, inertia = your_mesh.get_mass_properties()
    volume_cm3 = volume / 1000
    print(f"Hacim: {volume:.2f} mm³")
    print(f"Hacim: {volume_cm3:.2f} cm³")
    

@app.post("/order/new")
def new_order_route(
    order_data: OrderData,
    user: User = Depends(get_session)
):
    
    order_form = OrderForm(
        user_id=user.id, # type: ignore
        data=order_data,
        order_id=str(uuid.uuid4())
    )

    orders.insert_one(order_form.model_dump())
        
    return {
        "success": True,
        "message": "Order received successfully",
        "order_data": order_data.dict(),
        "user_id": user.id
    }