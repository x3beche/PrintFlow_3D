import { Component } from '@angular/core';
import { Subscription } from 'rxjs';
import { SidebarStateService } from 'src/app/services/sidebar-state.service';

@Component({
  selector: 'app-manifacturer-pool',
  templateUrl: './manifacturer-pool.component.html',
  styleUrl: './manifacturer-pool.component.css'
})
export class ManifacturerPoolComponent {
  sidebarCollapsed = false;
  private subscription?: Subscription;

  constructor(
    private sidebarService: SidebarStateService,
  ) {
    this.sidebarCollapsed = this.sidebarService.isCollapsed;
  }

  ngOnInit(): void {
    this.subscription = this.sidebarService.collapsed$.subscribe(
      collapsed => this.sidebarCollapsed = collapsed
    );
  
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
