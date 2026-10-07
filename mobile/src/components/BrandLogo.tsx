import { Image } from "react-native";

type BrandLogoProps = {
  size: number;
};

export function BrandLogo({ size }: BrandLogoProps) {
  return (
    <Image
      source={require("../../assets/forever-culture-logo.png")}
      style={{ width: size, height: size, alignSelf: "center" }}
      resizeMode="contain"
      accessibilityLabel="Forever Culture"
    />
  );
}
