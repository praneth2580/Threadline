import type { ReactNode } from "react"
import { Box, IconButton, Typography, alpha, useTheme } from "@mui/material"
import {
  AccountTree,
  Storage,
  People,
  Settings,
  DarkMode,
  LightMode
} from "@mui/icons-material"

export type AppSection = "graph" | "database" | "accounts"

const TOP_BAR_H = 56
const SIDE_RAIL_W = 80

export function AppShell(props: {
  section: AppSection
  onSectionChange: (next: AppSection) => void
  mode: "light" | "dark"
  onToggleTheme: () => void
  children: ReactNode
}) {
  const theme = useTheme()

  const navItems: Array<{ id: AppSection; label: string; icon: ReactNode }> = [
    { id: "graph", label: "Graph", icon: <AccountTree /> },
    { id: "database", label: "Database", icon: <Storage /> },
    { id: "accounts", label: "Accounts", icon: <People /> },
  ]

  return (
    <Box sx={{ height: "100vh", bgcolor: theme.palette.background.default, color: "text.primary", overflow: "hidden" }}>
      {/* Top bar */}
      <Box
        component="header"
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: TOP_BAR_H,
          zIndex: theme.zIndex.appBar,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2.5,
          bgcolor: alpha(theme.palette.background.paper, 0.85),
          backdropFilter: "blur(14px)",
          borderBottom: `1px solid ${alpha(theme.palette.common.white, theme.palette.mode === "dark" ? 0.06 : 0.08)}`,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: '"FILL" 1, "wght" 600, "opsz" 24' }}>
            hub
          </span>
          <Typography sx={{ fontWeight: 900, letterSpacing: -0.5, color: "primary.main" }}>
            Threadline
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <IconButton onClick={props.onToggleTheme} size="small" sx={{ color: alpha(theme.palette.text.primary, 0.7) }}>
            {props.mode === "dark" ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
          </IconButton>
        </Box>
      </Box>

      {/* Side rail */}
      <Box
        component="aside"
        sx={{
          position: "fixed",
          top: TOP_BAR_H,
          left: 0,
          width: SIDE_RAIL_W,
          height: `calc(100vh - ${TOP_BAR_H}px)`,
          zIndex: theme.zIndex.appBar - 1,
          py: 2,
          px: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Box
          className="glass-panel"
          sx={{
            width: 56,
            borderRadius: 4,
            border: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
            px: 1,
            py: 1.5,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0.5,
            boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.35)}`,
          }}
        >
          {navItems.map((item) => {
            const active = props.section === item.id
            return (
              <IconButton
                key={item.id}
                onClick={() => props.onSectionChange(item.id)}
                size="small"
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 3,
                  color: active ? theme.palette.primary.main : alpha(theme.palette.text.primary, 0.55),
                  bgcolor: active ? alpha(theme.palette.common.white, theme.palette.mode === "dark" ? 0.06 : 0.08) : "transparent",
                  "&:hover": {
                    bgcolor: alpha(theme.palette.common.white, theme.palette.mode === "dark" ? 0.08 : 0.1),
                    transform: "translateY(-1px)",
                  },
                  transition: "all 160ms cubic-bezier(0.4, 0, 0.2, 1)",
                }}
                aria-label={item.label}
              >
                {item.icon}
              </IconButton>
            )
          })}

          <Box sx={{ flex: 1 }} />

          <IconButton
            size="small"
            sx={{
              width: 44,
              height: 44,
              borderRadius: 3,
              color: alpha(theme.palette.text.primary, 0.55),
              "&:hover": { bgcolor: alpha(theme.palette.common.white, theme.palette.mode === "dark" ? 0.08 : 0.1) },
            }}
            aria-label="Settings"
          >
            <Settings />
          </IconButton>
        </Box>
      </Box>

      {/* Content */}
      <Box
        component="main"
        sx={{
          position: "relative",
          height: "100vh",
          pt: `${TOP_BAR_H}px`,
          pl: `${SIDE_RAIL_W}px`,
          overflow: "hidden",
        }}
      >
        {props.children}
      </Box>
    </Box>
  )
}

