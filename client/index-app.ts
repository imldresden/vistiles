import * as conf from "./conf";
import {App} from "./app/app";

conf.init(confLoaded);

function confLoaded() {
  new App();
}