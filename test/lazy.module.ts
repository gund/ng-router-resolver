import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

const SOME_ROUTES = [
  { path: 'external', component: undefined }
];

const ROUTES = [
  { path: '', component: undefined },
  {
    path: 'child', component: undefined, children: SOME_ROUTES
  },
  ...SOME_ROUTES,
];

@NgModule({
  imports: [
    RouterModule.forChild(ROUTES)
  ],
  providers: [],
})
export class LazyModule { }
