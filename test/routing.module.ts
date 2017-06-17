import { Routes, RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';

const routes: Routes = [
  {
    path: '', component: undefined, pathMatch: 'full', children: [
      { path: 'child', component: undefined }
    ]
  },
  { path: 'lazy', loadChildren: './lazy.module#LazyModule' },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class RoutingModule { }
