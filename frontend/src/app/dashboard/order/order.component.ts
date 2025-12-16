import { Component, OnInit, OnDestroy } from '@angular/core';
import { SidebarStateService } from 'src/app/services/sidebar-state.service';
import { Subscription } from 'rxjs';
import { OrderService } from './order.service';
import { BottomTexture, Brand, FDMConfig, FDMMaterial, OrderData, OrderType } from './models';

@Component({
  selector: 'app-order',
  templateUrl: './order.component.html',
})
export class OrderComponent implements OnInit, OnDestroy {
  sidebarCollapsed = false;
  private subscription?: Subscription;

  constructor(
    private sidebarService: SidebarStateService,
    private orderService: OrderService
  ) {
    this.sidebarCollapsed = this.sidebarService.isCollapsed;
  }

  ngOnInit(): void {
    this.subscription = this.sidebarService.collapsed$.subscribe(
      collapsed => this.sidebarCollapsed = collapsed
    );

    // Send mock order request on init
    this.sendMockOrder();
  }

  sendMockOrder(): void {
    const mockOrderData: OrderData = {
      file_id: "file_12345_stl_model",
      notes: "Please print with high quality settings. Need it by next week.",
      order_type: OrderType.FDM,
      order_detail: {
        material: FDMMaterial.PLA,
        brand: Brand.BAMBU_LAB,
        color: "Red",
        layer_height: 0.2,
        infill: 20,
        bottom_texture: BottomTexture.TEXTURED,
        nozzle_size: 0.4
      } as FDMConfig
    };

    this.orderService.createNewOrder(mockOrderData).subscribe({
      next: (response) => {
        console.log('Order created successfully:', response);
      },
      error: (error) => {
        console.error('Error creating order:', error);
      }
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}