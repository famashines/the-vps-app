import { createTheme, type MantineColorsTuple } from "@mantine/core";

const accent: MantineColorsTuple = [
  "#eef0ff", "#dae1ff", "#b3c5ff", "#8ba8fe", "#708ee1", "#5574c5", "#3b5baa", "#2e4e9d", "#1f4291", "#002b75",
];

const red: MantineColorsTuple = [
  "#ffedea", "#ffdad6", "#ffb4ab", "#ff897d", "#ff5449", "#de3730", "#ba1a1a", "#ba1a1a", "#93000a", "#690005",
];

const font = "'Google Sans Flex Variable', system-ui, sans-serif";

export const theme = createTheme({
  primaryColor: "accent",
  primaryShade: 7,
  colors: { accent, red },
  black: "#1a1b21",
  fontFamily: font,
  headings: {
    fontFamily: font,
    fontWeight: "600",
    sizes: {
      h1: { fontSize: "2rem", lineHeight: "1.2" },
      h2: { fontSize: "1.125rem", lineHeight: "1.3" },
    },
  },
  radius: { xs: "8px", sm: "12px", md: "16px", lg: "28px", xl: "48px" },
  defaultRadius: "sm",
  components: {
    Button: { defaultProps: { fw: 500, radius: "xl" } },
    Modal: { defaultProps: { radius: "lg" } },
    Tooltip: { defaultProps: { radius: "xs" } },
  },
});
