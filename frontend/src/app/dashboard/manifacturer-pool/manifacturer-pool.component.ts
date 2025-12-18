import { Component } from '@angular/core';
import { Subscription } from 'rxjs';
import { SidebarStateService } from 'src/app/services/sidebar-state.service';
import { GraphComponent } from './graph/graph.component';
import { AdoptedTaskComponent, AdoptedTaskState} from './adopted-task/adopted-task.component';
import { NonAdoptedTaskComponent, NonAdoptedTaskState } from './non-adopted-task/non-adopted-task.component';

interface Task {
  id: string;
  date: string;
  name: string;
  image: string;
}

@Component({
  selector: 'app-manifacturer-pool',
  templateUrl: './manifacturer-pool.component.html',
  styleUrl: './manifacturer-pool.component.css'
})
export class ManifacturerPoolComponent {
  sidebarCollapsed = false;
  private subscription?: Subscription;

  continuingTasks: AdoptedTaskState[] = [
    {
      id: 1,
      name: 'Serhat Yılmaz',
      date: new Date(2025, 9, 22, 15, 12), 
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=200&auto=format&fit=crop' 
    },
    {
      id: 2,
      name: 'Ayşe Demir',
      date: '2025-10-22T16:45:00',
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=200&auto=format&fit=crop' 
    },
    {
      id: 3,
      name: 'Mehmet Öztürk',
      date: new Date(),
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=200&auto=format&fit=crop' 
    },
    {
      id: 4,
      name: 'Zeynep Kaya',
      date: new Date(2025, 9, 23, 9, 30),
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=200&auto=format&fit=crop' 
    }
  ];

  summaryStats = [
    { value: 26, label: 'Non-adopted tasks' },
    { value: 26, label: 'Non-adopted tasks' },
    { value: 26, label: 'Non-adopted tasks' },
    { value: 26, label: 'Non-adopted tasks' },
    { value: 26, label: 'Non-adopted tasks' },
    { value: 26, label: 'Non-adopted tasks' },
    { value: 26, label: 'Non-adopted tasks' },
    { value: 26, label: 'Non-adopted tasks' },
  ];

  availableTasks: NonAdoptedTaskState[] = [
    {
      id: 1,
      orderId: "#8829102",
      name: 'Serhat Yılmaz',
      date: new Date(2025, 9, 22, 15, 12), 
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=200&auto=format&fit=crop' 
    },
    {
      id: 2,
      orderId: "#8829102",
      name: 'Ayşe Demir',
      date: '2025-10-22T16:45:00',
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=200&auto=format&fit=crop' 
    },
    {
      id: 3,
      orderId: "#8829102",
      name: 'Mehmet Öztürk',
      date: new Date(),
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=200&auto=format&fit=crop' 
    }
  ];

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
