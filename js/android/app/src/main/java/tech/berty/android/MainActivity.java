package tech.berty.android;

import android.os.Bundle; // needed by react-native-bootsplash

import com.facebook.react.ReactActivity;
import com.zoontek.rnbootsplash.RNBootSplash; // needed by react-native-bootsplash

import com.shakebugs.shake.Shake;
import android.view.MotionEvent;

// needed by react-native-gesture-handler
import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.ReactRootView;
import com.swmansion.gesturehandler.react.RNGestureHandlerEnabledRootView;

public class MainActivity extends ReactActivity {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  @Override
  protected String getMainComponentName() {
    return "Berty";
  }

  @Override
  public boolean dispatchTouchEvent(MotionEvent ev) {
      Shake.handleTouchEvent(ev, this);
      return super.dispatchTouchEvent(ev);
  }

  // needed by react-native-gesture-handler
  protected ReactActivityDelegate createReactActivityDelegate() {
    return new ReactActivityDelegate(this, getMainComponentName()) {
      @Override
      protected ReactRootView createRootView() {
        return new RNGestureHandlerEnabledRootView(MainActivity.this);
      }
    };
  }

   // needed by react-native-bootsplash
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    RNBootSplash.init(R.drawable.bootsplash, MainActivity.this); // <- display the generated bootsplash.xml drawable over our MainActivity
  }
}
