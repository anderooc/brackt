/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { useEffect, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

/** Product timing: feedback → state → layout → signature entrance. */
export const motion = {
  instant: 120,
  state: 200,
  layout: 280,
  enter: 420,
  stagger: 45,
  staggerCap: 8,
} as const;

/** Ease-out quart — decelerates cleanly; never bounce/elastic. */
export const easeOut = Easing.bezier(0.25, 1, 0.5, 1);

let reduceMotionFlag = false;
void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
  reduceMotionFlag = enabled;
});
AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
  reduceMotionFlag = enabled;
});

/** Sync read for LayoutAnimation / Modal flags outside React. */
export function prefersReducedMotion() {
  return reduceMotionFlag;
}

/** Reactive Reduce Motion for components that animate with Reanimated. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(reduceMotionFlag);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (alive) setReduced(enabled);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

export function timingConfig(duration: number = motion.state) {
  return { duration, easing: easeOut };
}

/** One-shot entrance: fade + short rise. Snaps instantly when Reduce Motion is on. */
export function Enter({
  children,
  style,
  delay = 0,
  from = "up",
  duration = motion.enter,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  from?: "up" | "down" | "fade";
  duration?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <Animated.View style={style}>{children}</Animated.View>;
  }
  const entering =
    from === "fade"
      ? FadeIn.duration(duration).delay(delay).easing(easeOut)
      : from === "down"
        ? FadeInDown.duration(duration).delay(delay).easing(easeOut).withInitialValues({
            opacity: 0,
            transform: [{ translateY: -12 }],
          })
        : FadeInUp.duration(duration).delay(delay).easing(easeOut).withInitialValues({
            opacity: 0,
            transform: [{ translateY: 14 }],
          });
  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}

/** Sibling list rhythm. Caps delay so long lists don't feel choreographed. */
export function StaggerItem({
  index,
  children,
  style,
}: {
  index: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const delay = Math.min(index, motion.staggerCap) * motion.stagger;
  return (
    <Enter from="up" delay={delay} duration={motion.layout} style={style}>
      {children}
    </Enter>
  );
}

/** Soft content swap when a keyed panel changes (tabs, filters). */
export function Crossfade({
  id,
  children,
  style,
}: {
  id: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <Animated.View key={id} style={style}>
        {children}
      </Animated.View>
    );
  }
  return (
    <Animated.View
      key={id}
      entering={FadeIn.duration(motion.state).easing(easeOut)}
      exiting={FadeOut.duration(motion.instant)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Press feedback for wrapping a Pressable: attach `handlers` to the pressable
 * and `style` to an Animated.View around it (or the animated pressable itself).
 */
export function usePressScale(disabled = false, pressedScale = 0.97) {
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function setPressed(pressed: boolean) {
    if (reduce || disabled) return;
    scale.value = withTiming(
      pressed ? pressedScale : 1,
      timingConfig(pressed ? motion.instant : motion.state)
    );
  }

  return {
    style,
    handlers: {
      onPressIn: () => setPressed(true),
      onPressOut: () => setPressed(false),
    },
  };
}

/** Rotates a chevron 180° when open (disclosure / expand rows). */
export function AnimatedChevron({
  open,
  children,
  style,
}: {
  open: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReducedMotion();
  const rotation = useSharedValue(open ? 180 : 0);

  useEffect(() => {
    if (reduce) {
      rotation.value = open ? 180 : 0;
      return;
    }
    rotation.value = withTiming(open ? 180 : 0, timingConfig(motion.state));
  }, [open, reduce, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

/** Slow ambient float for brand art / empty-state icons. Static under Reduce Motion. */
export function Float({
  children,
  style,
  amplitude = 5,
  duration = 3200,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  amplitude?: number;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  const y = useSharedValue(0);

  useEffect(() => {
    if (reduce) {
      y.value = 0;
      return;
    }
    y.value = withRepeat(
      withTiming(-amplitude, { duration, easing: easeOut }),
      -1,
      true
    );
  }, [amplitude, duration, reduce, y]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
