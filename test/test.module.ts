import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

@NgModule({
  imports: [
    RouterModule.forRoot([
      {
        path: '', component: undefined, pathMatch: 'full', children: [
          { path: 'child', component: undefined }
        ]
      },
      { path: 'lazy', loadChildren: './lazy.module#LazyModule' },
    ])
  ],
  providers: [],
})
export class TestModule { }
