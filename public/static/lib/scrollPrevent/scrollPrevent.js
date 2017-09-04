/**
 * Created by dennis.esders on 30.06.2016.
 */

//from http://stackoverflow.com/questions/29008194/disabling-androids-chrome-pull-down-to-refresh-feature

  window.addEventListener('load', function() {
    var maybePreventPullToRefresh = false;
    var lastTouchY = 0;
    var touchstartHandler = function(e) {
      if (e.touches.length != 1) return;
      lastTouchY = e.touches[0].clientY;
      // Pull-to-refresh will only trigger if the scroll begins when the
      // document's Y offset is zero.
      maybePreventPullToRefresh =
        window.pageYOffset == 0;
    };

    var touchmoveHandler = function(e) {
      var touchY = e.touches[0].clientY;
      var touchYDelta = touchY - lastTouchY;
      lastTouchY = touchY;

      if (maybePreventPullToRefresh) {
        // To suppress pull-to-refresh it is sufficient to preventDefault the
        // first overscrolling touchmove.
        maybePreventPullToRefresh = false;
        if (touchYDelta > 0) {
          e.preventDefault();
          return;
        }
      }
    };

    document.addEventListener('touchstart', touchstartHandler, false);
    document.addEventListener('touchmove', touchmoveHandler, false);
  });