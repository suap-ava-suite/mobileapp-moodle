import { Component } from '@angular/core';
import { CoreSharedModule } from '@/core/shared.module';
@Component({
    selector: 'page-ifrn-login',
    templateUrl: './ifrn-login.html',
    styleUrls: ['./ifrn-login.scss'],
    imports: [
        CoreSharedModule,
    ],
})
export class IfrnLoginPage {
    username = '';
    password = '';
    login(): void {
        console.log('Login');
    }
    clear(): void {
        this.username = '';
        this.password = '';
    }
    forgotPassword(event: Event): void {
        event.preventDefault();
    }
    help(event: Event): void {
        event.preventDefault();
    }

}
