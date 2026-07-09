import { Component } from '@angular/core';

@Component({
    selector: 'page-ifrn-login',
    templateUrl: './ifrn-login.html',
    styleUrls: ['./ifrn-login.scss'],
})
export class IfrnLoginPage {

    username = '';

    password = '';

    login(): void {
        console.log('Login');

        // Chamar a API do IFRN.
    }

    clear(): void {
        this.username = '';
        this.password = '';
    }

    forgotPassword(event: Event): void {
        event.preventDefault();

        // Abrir página de recuperação.
    }

    help(event: Event): void {
        event.preventDefault();

        // Abrir página de ajuda.
    }

}
