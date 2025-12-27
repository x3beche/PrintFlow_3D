import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'orderIdShort',
  standalone: true
})
export class OrderIdShortPipe implements PipeTransform {
  transform(orderId: string, length: number = 8): string {
    if (!orderId) return '';
    
    // İlk N karakteri al ve başına # ekle
    return '#' + orderId.substring(0, length).toUpperCase();
  }
}
