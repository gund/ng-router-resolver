import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

@NgModule({
  imports: [
    RouterModule.forChild([
      { path: '', component: undefined },
      {
        path: 'child', component: undefined, children: [
          { path: 'sub-child', component: undefined }
        ]
      },
    ])
  ],
  providers: [],
})
export class LazyModule { }
