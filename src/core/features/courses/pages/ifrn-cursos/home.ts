import { Component } from '@angular/core';
import { CoreSharedModule } from '@/core/shared.module';

@Component({
    selector: 'page-home',
    templateUrl: './home.html',
    styleUrls: ['./home.scss'],
    imports: [CoreSharedModule],
})
export class HomePage {
    constructor() {
        console.log('HOME CARREGADA');
    }
}
