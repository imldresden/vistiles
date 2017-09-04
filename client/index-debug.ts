import * as conf from "./conf";
import {DebugApp} from "./debug/debug";

conf.init(confLoaded);

function confLoaded() {
  new DebugApp();
}