import { createTheme, type PaletteMode, type ThemeOptions } from "@mui/material/styles"

const getDesignTokens = (mode: PaletteMode): ThemeOptions => ({
  palette: {
    mode,
    ...(mode === "dark"
      ? {
          primary: { main: "#f2c36b" }, // stitch primary
          background: {
            default: "#0d0d0d",
            paper: "#1a1a1a",
          },
          divider: "rgba(255,255,255,0.08)",
        }
      : {
          primary: { main: "#7b5804" },
          background: {
            default: "#f5f5f5",
            paper: "#ffffff",
          },
          divider: "rgba(0,0,0,0.08)",
        }),
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Manrope", "Roboto","Helvetica","Arial",sans-serif',
    fontSize: 14,
    h6: { fontWeight: 600 },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          borderBottom: "1px solid",
          borderColor: "divider",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 600 },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: "outlined",
        size: "small",
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid",
          borderColor: "divider",
        },
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: { flexWrap: "wrap" as const },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: { textTransform: "none" as const },
      },
    },
  },
})

export const createAppTheme = (mode: PaletteMode) =>
  createTheme(getDesignTokens(mode) as Parameters<typeof createTheme>[0])
