// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CoreSharedModule } from '@/core/shared.module';
import { AuthService } from '@/core/services_mobile/auth.service';


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

    // Controla mostrar/esconder senha
    showPassword = false;



    constructor(
        private authService: AuthService,
        private router: Router
    ) {}



    /**
     * Alterna visualização da senha
     */
    togglePassword(): void {

        this.showPassword = !this.showPassword;

    }




    login(): void {

        if (!this.username || !this.password) {

            alert(
                'Por favor, preencha todos os campos.'
            );

            return;

        }



        const credenciais = {

            username: this.username,

            password: this.password

        };



        this.authService.login(credenciais).subscribe({

            next: (res) => {


                console.log(
                    'Login realizado com sucesso!',
                    res
                );



                // Salva access token JWT

                this.authService.saveToken(
                    res.access_token
                );



                // Salva refresh token

                this.authService.saveRefreshToken(
                    res.refresh_token
                );



                // Vai para tela inicial

                this.router.navigate([
                    '/home'
                ]);

            },


            error: (err) => {


                console.error(
                    'Erro na autenticação:',
                    err
                );


                alert(
                    'Falha ao realizar login. Verifique suas credenciais.'
                );


            }

        });

    }





    clear(): void {

        this.username = '';

        this.password = '';

    }





    forgotPassword(event: Event): void {

        event.preventDefault();

        console.log(
            'Esqueceu a senha clicado'
        );

    }





    help(event: Event): void {

        event.preventDefault();

        console.log(
            'Ajuda clicado'
        );

    }

}
