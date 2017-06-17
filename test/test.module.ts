import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { RoutingModule } from './routing.module';

const routes = RouterModule.forRoot([
  {
    path: '', component: undefined, pathMatch: 'full', children: [
      { path: 'child', component: undefined }
    ]
  },
  { path: 'lazy', loadChildren: './lazy.module#LazyModule' },
]);

@NgModule({
  imports: [
    RoutingModule,
    routes
  ],
  providers: [],
})
export class TestModule { }
