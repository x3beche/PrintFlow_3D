import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface NonAdoptedTaskState {
  id: number;          
  orderId:string;
  name: string;        
  date: Date | string; 
  image: string;      
}

@Component({
  selector: 'app-non-adopted-task',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './non-adopted-task.component.html',
  styleUrl: './non-adopted-task.component.css'
})
export class NonAdoptedTaskComponent {
  @Input() imageSource: string = '';

  @Input() orderId: string = '';

  @Input() createdDate: string | Date = new Date();
  
  @Input() name: string = '';
}
