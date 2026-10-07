import { Image, StyleSheet, View } from "react-native";

import { colors } from "../theme";

export function SplashScreen() {
  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/splash.gif")}
        style={styles.image}
        resizeMode="cover"
        accessibilityLabel="App splash"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
});
