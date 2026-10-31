import { createTheme, type MantineColorsTuple } from "@mantine/core";

const ink: MantineColorsTuple = [
  "#eef2fa", "#d9e1f3", "#b0c1e6", "#85a0d9", "#6283cd", "#4b70c6", "#3d64c3", "#2b4c9b", "#25448c", "#1c3a7d",
];

export const theme = createTheme({
  primaryColor: "ink",
  primaryShade: 7,
  colors: { ink },
  black: "#1c2541",
  fontFamily: "'Atkinson Hyperlegible Next', system-ui, sans-serif",
  headings: {
    fontFamily: "'Atkinson Hyperlegible Next', system-ui, sans-serif",
    fontWeight: "700",
    sizes: {
      h1: { fontSize: "1.563rem", lineHeight: "1.25" },
      h2: { fontSize: "1.125rem", lineHeight: "1.35" },
    },
  },
  radius: { xs: "4px", sm: "6px", md: "10px" },
  defaultRadius: "sm",
  components: {
    Button: { defaultProps: { fw: 600 } },
  },
});
