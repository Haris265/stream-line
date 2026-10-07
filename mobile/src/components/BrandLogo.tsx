import { Image } from "react-native";

import { useThemeStore } from "../stores/themeStore";

type BrandLogoProps = {
  size: number;
};

export function BrandLogo({ size }: BrandLogoProps) {
  const mode = useThemeStore((s) => s.mode);
  const source =
    mode === "light"
      ? require("../../assets/forever-culture-logo-light.png")
      : require("../../assets/forever-culture-logo.png");

  return (
    <Image
      source={source}
      style={{ width: size, height: size, alignSelf: "center" }}
      resizeMode="contain"
      accessibilityLabel="Forever Culture"
    />
  );
}
